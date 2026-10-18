"""
Phase 3A: Evaluation & Fair Baseline Comparison Script.
Evaluates Persistence (t-1), Diurnal Historical Profile, and LSTM Predictor on:
1. Pure time-series flow forecasting performance (MAE, RMSE, MAPE, R2).
2. Residual-based leak detection performance (Precision, Recall, F1, FAR, Specificity, Confusion Matrix).
Thresholds are calibrated strictly on the normal Validation split.
"""

import os
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(os.path.abspath('.'))

import json
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# Re-import model class
from phase3a.train_lstm import FlowLSTM, make_sequences, SEED

torch.manual_seed(SEED)
np.random.seed(SEED)


def evaluate_phase3a(
    splits_dir: str = "data/splits/Area_1",
    model_path: str = "phase3a/models/lstm_predictor.pth",
    output_metrics_dir: str = "phase3a/metrics",
    output_plots_dir: str = "phase3a/plots",
    window_hours: int = 12
):
    os.makedirs(output_metrics_dir, exist_ok=True)
    os.makedirs(output_plots_dir, exist_ok=True)

    print("--- 1. Loading Splits and Trained Artifacts ---")
    train_df = pd.read_csv(os.path.join(splits_dir, "train.csv"))
    val_df = pd.read_csv(os.path.join(splits_dir, "val.csv"))
    test_df = pd.read_csv(os.path.join(splits_dir, "test.csv"))

    train_df['result_time'] = pd.to_datetime(train_df['result_time'])
    val_df['result_time'] = pd.to_datetime(val_df['result_time'])
    test_df['result_time'] = pd.to_datetime(test_df['result_time'])

    checkpoint = torch.load(model_path, map_location='cpu')
    config = checkpoint['config']
    scaler = checkpoint['scaler']
    seq_len = config['seq_len']

    train_mean = scaler['mean']
    train_std = scaler['std']

    model = FlowLSTM(
        input_size=1,
        hidden_size=config['hidden_size'],
        num_layers=config['num_layers'],
        dropout=config['dropout']
    )
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()
    print(f"Loaded LSTM checkpoint (trained {config['seq_len']} sequence length, scaler mean={train_mean:.2f}, std={train_std:.2f})")

    # Standardize data using train statistics
    val_scaled = (val_df['Flow'].values - train_mean) / train_std
    test_scaled = (test_df['Flow'].values - train_mean) / train_std

    X_val, y_val = make_sequences(val_scaled, seq_len=seq_len)
    X_test, y_test = make_sequences(test_scaled, seq_len=seq_len)

    # 1. Model Predictions
    with torch.no_grad():
        lstm_val_scaled = model(torch.from_numpy(X_val)).numpy().flatten()
        lstm_test_scaled = model(torch.from_numpy(X_test)).numpy().flatten()

    lstm_val_pred = lstm_val_scaled * train_std + train_mean
    lstm_test_pred = lstm_test_scaled * train_std + train_mean

    # Aligned ground-truth targets (offset by seq_len)
    val_actual = val_df['Flow'].values[seq_len:]
    test_actual = test_df['Flow'].values[seq_len:]
    test_labels = test_df['Leak_Detected'].astype(int).values[seq_len:]
    test_times = test_df['result_time'].values[seq_len:]

    # 2. Persistence Baseline (t-1): y_hat[t] = y[t-1]
    val_persist_pred = val_df['Flow'].values[seq_len - 1:-1]
    test_persist_pred = test_df['Flow'].values[seq_len - 1:-1]

    # 3. Diurnal Historical Profile Baseline: y_hat[t] = mean(dow, hour) from train
    train_df['dow'] = train_df['result_time'].dt.dayofweek
    train_df['hour'] = train_df['result_time'].dt.hour
    diurnal_profile = train_df.groupby(['dow', 'hour'])['Flow'].mean().to_dict()

    val_aligned = val_df.iloc[seq_len:].copy()
    val_aligned['dow'] = val_aligned['result_time'].dt.dayofweek
    val_aligned['hour'] = val_aligned['result_time'].dt.hour
    val_diurnal_pred = np.array([diurnal_profile.get((d, h), train_mean) for d, h in zip(val_aligned['dow'], val_aligned['hour'])])

    test_aligned = test_df.iloc[seq_len:].copy()
    test_aligned['dow'] = test_aligned['result_time'].dt.dayofweek
    test_aligned['hour'] = test_aligned['result_time'].dt.hour
    test_diurnal_pred = np.array([diurnal_profile.get((d, h), train_mean) for d, h in zip(test_aligned['dow'], test_aligned['hour'])])

    # -------------------------------------------------------------
    # PART A: Flow Forecasting Performance Evaluation
    # -------------------------------------------------------------
    print("\n--- 2. Computing Forecasting Metrics on Test Split ---")
    def compute_forecasting_metrics(actual, pred, model_name):
        mae = float(np.mean(np.abs(actual - pred)))
        rmse = float(np.sqrt(np.mean((actual - pred)**2)))
        mape = float(np.mean(np.abs((actual - pred) / np.maximum(actual, 1e-4))) * 100.0)
        ss_res = np.sum((actual - pred)**2)
        ss_tot = np.sum((actual - np.mean(actual))**2)
        r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot > 0 else 0.0
        return {
            'model': model_name,
            'mae': round(mae, 4),
            'rmse': round(rmse, 4),
            'mape': round(mape, 2),
            'r2_score': round(r2, 4)
        }

    forecasting_results = [
        compute_forecasting_metrics(test_actual, test_persist_pred, 'Persistence (t-1)'),
        compute_forecasting_metrics(test_actual, test_diurnal_pred, 'Diurnal Profile Baseline'),
        compute_forecasting_metrics(test_actual, lstm_test_pred, 'LSTM Predictor')
    ]

    f_json_path = os.path.join(output_metrics_dir, "forecasting_metrics.json")
    with open(f_json_path, "w") as f:
        json.dump(forecasting_results, f, indent=2)

    print("FORECASTING PERFORMANCE COMPARISON:")
    print(pd.DataFrame(forecasting_results).to_string(index=False))

    # -------------------------------------------------------------
    # PART B: Residual-based Leak Detection Evaluation
    # -------------------------------------------------------------
    print("\n--- 3. Evaluating Residual-based Anomaly/Leak Detection ---")
    def evaluate_leak_detection(val_act, val_p, test_act, test_p, test_y, model_name, window=12):
        # Directional excess residual (positive deviation indicates excess unaccounted flow)
        val_residual = np.maximum(0.0, val_act - val_p)
        val_scores = pd.Series(val_residual).rolling(window=window, min_periods=1).mean().values

        # Calibrate threshold on normal validation data at 99th percentile (target FPR <= 1%)
        tau = float(np.percentile(val_scores, 99.0))

        # Test scores
        test_residual = np.maximum(0.0, test_act - test_p)
        test_scores = pd.Series(test_residual).rolling(window=window, min_periods=1).mean().values

        # Binary alert decision
        test_pred_bin = (test_scores >= tau).astype(int)

        tp = int(np.sum((test_pred_bin == 1) & (test_y == 1)))
        fp = int(np.sum((test_pred_bin == 1) & (test_y == 0)))
        fn = int(np.sum((test_pred_bin == 0) & (test_y == 1)))
        tn = int(np.sum((test_pred_bin == 0) & (test_y == 0)))

        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        far = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
        spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
        acc = float((tp + tn) / len(test_y))

        return {
            'model': model_name,
            'calibrated_threshold': round(tau, 4),
            'precision': round(prec, 4),
            'recall': round(rec, 4),
            'f1_score': round(f1, 4),
            'false_alarm_rate': round(far, 4),
            'specificity': round(spec, 4),
            'accuracy': round(acc, 4),
            'confusion_matrix': {'tp': tp, 'fp': fp, 'fn': fn, 'tn': tn, 'total': len(test_y)},
            'test_scores': test_scores,
            'threshold_value': tau
        }

    det_persist = evaluate_leak_detection(val_actual, val_persist_pred, test_actual, test_persist_pred, test_labels, 'Persistence Baseline', window=window_hours)
    det_diurnal = evaluate_leak_detection(val_actual, val_diurnal_pred, test_actual, test_diurnal_pred, test_labels, 'Diurnal Profile Baseline', window=window_hours)
    det_lstm = evaluate_leak_detection(val_actual, lstm_val_pred, test_actual, lstm_test_pred, test_labels, 'LSTM Residual Detector', window=window_hours)

    detection_summary = [
        {k: v for k, v in det_persist.items() if k not in ['test_scores', 'threshold_value']},
        {k: v for k, v in det_diurnal.items() if k not in ['test_scores', 'threshold_value']},
        {k: v for k, v in det_lstm.items() if k not in ['test_scores', 'threshold_value']}
    ]

    d_json_path = os.path.join(output_metrics_dir, "detection_metrics.json")
    with open(d_json_path, "w") as f:
        json.dump(detection_summary, f, indent=2)

    print("LEAK DETECTION PERFORMANCE COMPARISON:")
    print(pd.DataFrame(detection_summary)[['model', 'calibrated_threshold', 'precision', 'recall', 'f1_score', 'false_alarm_rate', 'specificity', 'accuracy']].to_string(index=False))

    # -------------------------------------------------------------
    # PART C: Diagnostic Plots Generation
    # -------------------------------------------------------------
    print("\n--- 4. Generating Diagnostic Visualizations ---")

    # Plot 1: Forecast Comparison on a 1-week test slice
    slice_start = 500
    slice_end = 500 + 168  # 1 week = 168 hours
    fig, ax = plt.subplots(figsize=(15, 5))
    ax.plot(test_times[slice_start:slice_end], test_actual[slice_start:slice_end], 'k-', lw=1.5, label='Actual Flow (m³/h)')
    ax.plot(test_times[slice_start:slice_end], test_persist_pred[slice_start:slice_end], 'b--', alpha=0.6, label='Persistence (t-1)')
    ax.plot(test_times[slice_start:slice_end], test_diurnal_pred[slice_start:slice_end], 'g:', alpha=0.7, label='Diurnal Profile')
    ax.plot(test_times[slice_start:slice_end], lstm_test_pred[slice_start:slice_end], 'r-', lw=1.2, alpha=0.9, label='LSTM Forecast')
    ax.set_title('Phase 3A: 1-Week Out-of-Time Flow Forecasting Comparison on Test Split')
    ax.set_xlabel('Date')
    ax.set_ylabel('Inlet Flow (m³/h)')
    ax.grid(True, alpha=0.3)
    ax.legend(loc='upper right')
    plt.tight_layout()
    p1_path = os.path.join(output_plots_dir, "phase3a_forecast_comparison.png")
    plt.savefig(p1_path, dpi=200)
    plt.close()

    # Plot 2: Residual Error Distributions (Normal vs Leak)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    lstm_res = test_actual - lstm_test_pred
    diurnal_res = test_actual - test_diurnal_pred

    normal_mask = (test_labels == 0)
    leak_mask = (test_labels == 1)

    ax1.hist(diurnal_res[normal_mask], bins=40, alpha=0.6, color='blue', density=True, label='Normal Hours')
    ax1.hist(diurnal_res[leak_mask], bins=40, alpha=0.6, color='red', density=True, label='Active Leak Hours')
    ax1.set_title('Diurnal Baseline Residuals')
    ax1.set_xlabel('Residual: Actual - Forecast (m³/h)')
    ax1.set_ylabel('Density')
    ax1.grid(True, alpha=0.3)
    ax1.legend()

    ax2.hist(lstm_res[normal_mask], bins=40, alpha=0.6, color='blue', density=True, label='Normal Hours')
    ax2.hist(lstm_res[leak_mask], bins=40, alpha=0.6, color='red', density=True, label='Active Leak Hours')
    ax2.set_title('LSTM Predictor Residuals')
    ax2.set_xlabel('Residual: Actual - Forecast (m³/h)')
    ax2.set_ylabel('Density')
    ax2.grid(True, alpha=0.3)
    ax2.legend()

    plt.tight_layout()
    p2_path = os.path.join(output_plots_dir, "phase3a_residual_distributions.png")
    plt.savefig(p2_path, dpi=200)
    plt.close()

    # Plot 3: Precision-Recall Curves across thresholds
    fig, ax = plt.subplots(figsize=(10, 6))
    th_grid = np.linspace(0.1, 15.0, 300)

    for det_obj, color, label in [
        (det_persist, 'blue', 'Persistence Baseline'),
        (det_diurnal, 'green', 'Diurnal Profile Baseline'),
        (det_lstm, 'crimson', 'LSTM Residual Detector')
    ]:
        scores = det_obj['test_scores']
        pr_list, rc_list = [], []
        for th in th_grid:
            p_bin = (scores >= th).astype(int)
            _tp = np.sum((p_bin == 1) & (test_labels == 1))
            _fp = np.sum((p_bin == 1) & (test_labels == 0))
            _fn = np.sum((p_bin == 0) & (test_labels == 1))
            _pr = _tp / (_tp + _fp) if (_tp + _fp) > 0 else 0
            _rc = _tp / (_tp + _fn) if (_tp + _fn) > 0 else 0
            pr_list.append(_pr)
            rc_list.append(_rc)

        ax.plot(rc_list, pr_list, color=color, lw=2, label=f"{label} (PR Curve)")
        ax.scatter([det_obj['recall']], [det_obj['precision']], color=color, s=90, zorder=5,
                   label=f"Calibrated Operating Point (F1={det_obj['f1_score']:.3f})")

    ax.set_title('Phase 3A: Precision-Recall Curves on Test Set (June 2024 - February 2025)')
    ax.set_xlabel('Recall')
    ax.set_ylabel('Precision')
    ax.grid(True, alpha=0.3)
    ax.legend(loc='lower left')
    plt.tight_layout()
    p3_path = os.path.join(output_plots_dir, "phase3a_pr_curves.png")
    plt.savefig(p3_path, dpi=200)
    plt.close()

    print(f"Saved diagnostic plots to {output_plots_dir}")

    # Copy plots to antigravity artifact directory for embedding
    artifact_dir = r"C:\Users\Lokesh U\.gemini\antigravity-ide\brain\58bcc980-bde9-413f-b26f-2977ccccd3da"
    if os.path.exists(artifact_dir):
        import shutil
        for f in [p1_path, p2_path, p3_path]:
            shutil.copy(f, os.path.join(artifact_dir, os.path.basename(f)))
        print(f"Copied plots to artifact directory {artifact_dir}")

    return forecasting_results, detection_summary


if __name__ == '__main__':
    evaluate_phase3a()
