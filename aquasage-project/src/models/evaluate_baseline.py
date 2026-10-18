"""
Standardized Evaluation Runner for Area 1 Leak Detection Baseline.
Computes Precision, Recall, F1, False Alarm Rate, Confusion Matrix,
and generates diagnostic plots.
"""

import os
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Add parent directory to sys.path
sys.path.append(os.path.abspath('.'))
from src.models.statistical_baseline import DiurnalResidualBaseline


def evaluate_area1_baseline(
    splits_dir: str = "data/splits/Area_1",
    model_save_path: str = "models/baseline_area1.json",
    report_json_path: str = "reports/baseline_metrics_area1.json",
    plot_path: str = "reports/figures/area1_baseline_evaluation.png"
):
    print("--- 1. Loading Chronological Splits ---")
    train_df = pd.read_csv(os.path.join(splits_dir, "train.csv"))
    val_df = pd.read_csv(os.path.join(splits_dir, "val.csv"))
    test_df = pd.read_csv(os.path.join(splits_dir, "test.csv"))

    train_df['result_time'] = pd.to_datetime(train_df['result_time'])
    val_df['result_time'] = pd.to_datetime(val_df['result_time'])
    test_df['result_time'] = pd.to_datetime(test_df['result_time'])

    print(f"Train period: {train_df['result_time'].min()} to {train_df['result_time'].max()} ({len(train_df)} hrs, {train_df['Leak_Detected'].sum()} leaks)")
    print(f"Val period:   {val_df['result_time'].min()} to {val_df['result_time'].max()} ({len(val_df)} hrs, {val_df['Leak_Detected'].sum()} leaks)")
    print(f"Test period:  {test_df['result_time'].min()} to {test_df['result_time'].max()} ({len(test_df)} hrs, {test_df['Leak_Detected'].sum()} leaks)")

    print("\n--- 2. Training Diurnal Baseline Model ---")
    model = DiurnalResidualBaseline(window=12)
    model.fit(train_df)

    print("\n--- 3. Calibrating Operating Threshold on Validation Set ---")
    # 99th percentile bounds normal false alarm rate to <= 1% on validation period
    opt_threshold = model.calibrate_threshold(val_df, target_fpr_percentile=99.0)
    model.save(model_save_path)

    print("\n--- 4. Evaluating on Unseen Out-of-Time Test Set ---")
    test_y = test_df['Leak_Detected'].astype(int).values
    test_scores = model.score_series(test_df).values
    test_pred = (test_scores >= opt_threshold).astype(int)

    tp = int(np.sum((test_pred == 1) & (test_y == 1)))
    fp = int(np.sum((test_pred == 1) & (test_y == 0)))
    fn = int(np.sum((test_pred == 0) & (test_y == 1)))
    tn = int(np.sum((test_pred == 0) & (test_y == 0)))

    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    far = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    accuracy = float((tp + tn) / len(test_y))

    metrics = {
        'area': 'Area_1',
        'model': 'DiurnalResidualBaseline',
        'window_hours': model.window,
        'calibrated_threshold': opt_threshold,
        'metrics': {
            'precision': round(precision, 4),
            'recall': round(recall, 4),
            'f1_score': round(f1, 4),
            'false_alarm_rate': round(far, 4),
            'specificity': round(specificity, 4),
            'accuracy': round(accuracy, 4)
        },
        'confusion_matrix': {
            'true_positives': tp,
            'false_positives': fp,
            'false_negatives': fn,
            'true_negatives': tn,
            'total_test_samples': len(test_y)
        },
        'periods': {
            'train_start': str(train_df['result_time'].min()),
            'train_end': str(train_df['result_time'].max()),
            'val_start': str(val_df['result_time'].min()),
            'val_end': str(val_df['result_time'].max()),
            'test_start': str(test_df['result_time'].min()),
            'test_end': str(test_df['result_time'].max())
        }
    }

    print("\n" + "="*50)
    print("EVALUATION RESULTS SUMMARY (Area 1 Statistical Baseline)")
    print("="*50)
    print(f"Calibrated Threshold: {opt_threshold:.3f}")
    print(f"Precision:            {precision:.4f} ({precision*100:.2f}%)")
    print(f"Recall:               {recall:.4f} ({recall*100:.2f}%)")
    print(f"F1-Score:             {f1:.4f}")
    print(f"False Alarm Rate:     {far:.4f} ({far*100:.2f}%)")
    print(f"Specificity:          {specificity:.4f} ({specificity*100:.2f}%)")
    print(f"Accuracy:             {accuracy:.4f} ({accuracy*100:.2f}%)")
    print(f"Confusion Matrix:     TP={tp}, FP={fp}, FN={fn}, TN={tn}")
    print("="*50)

    # Save metrics JSON
    os.makedirs(os.path.dirname(report_json_path), exist_ok=True)
    with open(report_json_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics JSON to {report_json_path}")

    # Generate Visualization Plot
    os.makedirs(os.path.dirname(plot_path), exist_ok=True)
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(15, 8), sharex=False)

    # Plot 1: Precision-Recall Curve across threshold sweep
    th_sweep = np.linspace(0.5, 4.0, 150)
    precs, recs = [], []
    for th in th_sweep:
        p_ = (test_scores >= th).astype(int)
        tp_ = np.sum((p_ == 1) & (test_y == 1))
        fp_ = np.sum((p_ == 1) & (test_y == 0))
        fn_ = np.sum((p_ == 0) & (test_y == 1))
        pr = tp_ / (tp_ + fp_) if (tp_ + fp_) > 0 else 0
        rc = tp_ / (tp_ + fn_) if (tp_ + fn_) > 0 else 0
        precs.append(pr)
        recs.append(rc)

    ax1.plot(recs, precs, color='darkcyan', lw=2, label='Baseline PR Curve')
    ax1.scatter([recall], [precision], color='crimson', s=90, zorder=5, 
                label=f'Calibrated Operating Point (th={opt_threshold:.2f}, F1={f1:.3f})')
    ax1.set_xlabel('Recall')
    ax1.set_ylabel('Precision')
    ax1.set_title('Area 1 Statistical Baseline - Precision-Recall Curve on Test Set (2024-06 to 2025-02)')
    ax1.grid(True, alpha=0.3)
    ax1.legend(loc='lower left')

    # Plot 2: Test Flow Time Series with Ground Truth vs Online Detection
    ax2.plot(test_df['result_time'], test_df['Flow'], color='gray', alpha=0.6, lw=0.8, label='Inlet Flow (m³/h)')
    detected_mask = test_pred == 1
    ax2.plot(test_df.loc[detected_mask, 'result_time'], test_df.loc[detected_mask, 'Flow'], 'r.', markersize=2.5, label='Online Leak Flagged')

    # Shaded ground truth intervals
    diff = test_df['Leak_Detected'].astype(int).diff().fillna(0)
    starts = test_df[diff == 1]['result_time'].tolist()
    ends = test_df[diff == -1]['result_time'].tolist()
    if test_df['Leak_Detected'].iloc[0]:
        starts.insert(0, test_df['result_time'].iloc[0])
    if test_df['Leak_Detected'].iloc[-1]:
        ends.append(test_df['result_time'].iloc[-1])

    for s, e in zip(starts, ends):
        ax2.axvspan(s, e, color='red', alpha=0.15)

    ax2.set_xlabel('Date')
    ax2.set_ylabel('Flow (m³/h)')
    ax2.set_title('Test Set Operational Timeline: Ground Truth Benchmark Leaks (Shaded) vs Online Baseline Detections (Red Dots)')
    ax2.legend(loc='upper right')
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(plot_path, dpi=200)
    plt.close()
    print(f"Saved evaluation plot to {plot_path}")

    return metrics


if __name__ == '__main__':
    evaluate_area1_baseline()
