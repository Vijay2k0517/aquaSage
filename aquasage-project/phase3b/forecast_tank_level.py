"""
Phase 3B: Multi-Horizon Tank-Level Forecasting Script.
Forecasts tank water level at +5, +15, and +30 minutes ahead using:
1. Persistence Baseline
2. Linear Velocity / Drift Baseline
3. Hydraulic Autoregressive (Ridge) Predictor

CRITICAL: ALL EVALUATED READINGS ARE FROM SIMULATED TANK HYDRAULICS.
"""

import os
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(os.path.abspath('.'))

import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.linear_model import Ridge

from phase3b.tank_simulation import generate_area1_tank_simulation


def run_tank_forecasting(
    sim_csv_path: str = "phase3b/data/simulated_tank_level_area1.csv",
    output_metrics_dir: str = "phase3b/metrics",
    output_plots_dir: str = "phase3b/plots"
):
    os.makedirs(output_metrics_dir, exist_ok=True)
    os.makedirs(output_plots_dir, exist_ok=True)

    if not os.path.exists(sim_csv_path):
        print(f"Generating simulated dataset at {sim_csv_path}...")
        df = generate_area1_tank_simulation(output_csv_path=sim_csv_path)
    else:
        df = pd.read_csv(sim_csv_path)

    df['timestamp'] = pd.to_datetime(df['timestamp'])
    n_total = len(df)
    print(f"Loaded {n_total} simulated 5-minute tank records ({df['timestamp'].min()} to {df['timestamp'].max()})")

    # Chronological Split (60% Train, 20% Val, 20% Test)
    idx_train_end = int(n_total * 0.60)
    idx_val_end = int(n_total * 0.80)

    train_df = df.iloc[:idx_train_end].copy().reset_index(drop=True)
    val_df = df.iloc[idx_train_end:idx_val_end].copy().reset_index(drop=True)
    test_df = df.iloc[idx_val_end:].copy().reset_index(drop=True)

    print(f"Train set: {len(train_df)} steps ({train_df['timestamp'].min()} to {train_df['timestamp'].max()})")
    print(f"Val set:   {len(val_df)} steps ({val_df['timestamp'].min()} to {val_df['timestamp'].max()})")
    print(f"Test set:  {len(test_df)} steps ({test_df['timestamp'].min()} to {test_df['timestamp'].max()})")

    # Target horizons in 5-minute steps
    # 5 min = 1 step
    # 15 min = 3 steps
    # 30 min = 6 steps
    horizons = {
        '5min': 1,
        '15min': 3,
        '30min': 6
    }

    # Feature Engineering (strictly lookback features up to time t)
    def create_features_and_targets(df_subset, horizons_dict):
        levels = df_subset['simulated_sensor_level_m'].values
        inflow = df_subset['simulated_inflow_m3h'].values
        outflow = df_subset['simulated_outflow_m3h'].values
        max_h = max(horizons_dict.values())
        lookback = 6  # 30 minutes of past readings

        features = []
        targets = {h_name: [] for h_name in horizons_dict}
        indices = []

        for i in range(lookback, len(levels) - max_h):
            # Past level history: [y_t, y_{t-1}, ..., y_{t-5}]
            past_levels = levels[i - lookback + 1 : i + 1][::-1]  # current first
            delta_1 = past_levels[0] - past_levels[1]
            delta_3 = past_levels[0] - past_levels[3]
            recent_net_flow = inflow[i] - outflow[i]

            feat = list(past_levels) + [delta_1, delta_3, recent_net_flow]
            features.append(feat)
            indices.append(i)

            for h_name, h_steps in horizons_dict.items():
                targets[h_name].append(levels[i + h_steps])

        return np.array(features, dtype=np.float64), {k: np.array(v, dtype=np.float64) for k, v in targets.items()}, indices

    X_train, Y_train, _ = create_features_and_targets(train_df, horizons)
    X_val, Y_val, _ = create_features_and_targets(val_df, horizons)
    X_test, Y_test, test_indices = create_features_and_targets(test_df, horizons)

    # Train Ridge Multi-Horizon Forecaster for each horizon
    models = {}
    for h_name in horizons:
        model = Ridge(alpha=1.0)
        model.fit(X_train, Y_train[h_name])
        models[h_name] = model

    # Evaluate all models on held-out Test Split
    results = []
    test_levels = test_df['simulated_sensor_level_m'].values
    test_actual_clean = test_df['simulated_true_level_m'].values

    for h_name, h_steps in horizons.items():
        actual_test_h = Y_test[h_name]
        n_samples = len(actual_test_h)

        # Baseline 1: Persistence y_hat[t+h] = y[t]
        pred_persist = np.array([test_levels[i] for i in test_indices])

        # Baseline 2: Linear Drift Extrapolation y_hat[t+h] = y[t] + h * (y[t] - y[t-1])
        pred_drift = np.array([
            test_levels[i] + h_steps * (test_levels[i] - test_levels[i-1])
            for i in test_indices
        ])
        # Bound physically to [0, 10] m
        pred_drift = np.clip(pred_drift, 0.0, 10.0)

        # Autoregressive Ridge Model
        pred_ridge = models[h_name].predict(X_test)
        pred_ridge = np.clip(pred_ridge, 0.0, 10.0)

        # Compute Metrics
        def get_metrics(act, pr, model_name, horizon_str):
            mae = float(np.mean(np.abs(act - pr)))
            rmse = float(np.sqrt(np.mean((act - pr)**2)))
            mape = float(np.mean(np.abs((act - pr) / np.maximum(act, 0.1))) * 100.0)
            return {
                'horizon': horizon_str,
                'horizon_minutes': h_steps * 5,
                'model': model_name,
                'mae_meters': round(mae, 4),
                'rmse_meters': round(rmse, 4),
                'mape_percent': round(mape, 2)
            }

        results.append(get_metrics(actual_test_h, pred_persist, 'Persistence (Current Level)', h_name))
        results.append(get_metrics(actual_test_h, pred_drift, 'Linear Drift Extrapolation', h_name))
        results.append(get_metrics(actual_test_h, pred_ridge, 'Hydraulic AR Forecaster', h_name))

    df_results = pd.DataFrame(results)
    print("\n=== MULTI-HORIZON TANK LEVEL FORECASTING RESULTS (TEST SPLIT) ===")
    print(df_results[['horizon', 'model', 'mae_meters', 'rmse_meters', 'mape_percent']].to_string(index=False))

    # Save metrics JSON
    metrics_path = os.path.join(output_metrics_dir, "tank_forecasting_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Saved metrics to {metrics_path}")

    # Plot 1: 24-hour test slice showing true level vs forecasts at 5, 15, 30 min
    slice_len = 288  # 288 * 5min = 24 hours
    slice_start = 500
    slice_end = slice_start + slice_len
    sub_indices = test_indices[slice_start:slice_end]
    sub_times = test_df['timestamp'].iloc[sub_indices]

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(15, 9), sharex=True)

    ax1.plot(sub_times, test_df['simulated_true_level_m'].iloc[sub_indices], 'k-', lw=2.0, label='True Tank Level [SIMULATED] (m)')
    ax1.plot(sub_times, test_df['simulated_sensor_level_m'].iloc[sub_indices], 'gray', alpha=0.5, lw=1.0, label='Noisy Sensor Telemetry (m)')
    ax1.plot(sub_times, models['5min'].predict(X_test)[slice_start:slice_end], 'g--', lw=1.5, label='Forecast +5 min (m)')
    ax1.plot(sub_times, models['15min'].predict(X_test)[slice_start:slice_end], 'b-.', lw=1.5, label='Forecast +15 min (m)')
    ax1.plot(sub_times, models['30min'].predict(X_test)[slice_start:slice_end], 'r:', lw=1.8, label='Forecast +30 min (m)')
    ax1.set_ylabel('Water Level (m)')
    ax1.set_title('Phase 3B: Simulated Hydraulic Tank Level & Multi-Horizon Forecasts [SIMULATED DATA]')
    ax1.grid(True, alpha=0.3)
    ax1.legend(loc='upper right')

    # Lower subplot: Inflow vs Consumer Outflow
    ax2.plot(sub_times, test_df['simulated_inflow_m3h'].iloc[sub_indices], 'teal', lw=1.5, label='Pump Station Inflow Q_in (m³/h)')
    ax2.plot(sub_times, test_df['simulated_outflow_m3h'].iloc[sub_indices], 'coral', lw=1.2, label='Area 1 Consumer Outflow Q_out (m³/h)')
    ax2.set_ylabel('Flow Rate (m³/h)')
    ax2.set_xlabel('Time (5-min intervals)')
    ax2.set_title('Tank Inflow (Pump Station Control) vs Consumer Demand Outflow')
    ax2.grid(True, alpha=0.3)
    ax2.legend(loc='upper right')

    plt.tight_layout()
    p1_path = os.path.join(output_plots_dir, "tank_level_simulation_and_forecast.png")
    plt.savefig(p1_path, dpi=200)
    plt.close()

    # Plot 2: Forecast Errors (MAE & RMSE) across horizons
    fig, ax = plt.subplots(figsize=(10, 5))
    bar_width = 0.25
    x_pos = np.arange(3)  # 5, 15, 30 min

    persist_maes = [r['mae_meters'] for r in results if r['model'] == 'Persistence (Current Level)']
    drift_maes = [r['mae_meters'] for r in results if r['model'] == 'Linear Drift Extrapolation']
    ridge_maes = [r['mae_meters'] for r in results if r['model'] == 'Hydraulic AR Forecaster']

    ax.bar(x_pos - bar_width, persist_maes, width=bar_width, label='Persistence Baseline', color='steelblue')
    ax.bar(x_pos, drift_maes, width=bar_width, label='Linear Drift Baseline', color='orange')
    ax.bar(x_pos + bar_width, ridge_maes, width=bar_width, label='Hydraulic AR Model', color='crimson')

    ax.set_xticks(x_pos)
    ax.set_xticklabels(['+5 min (h=1)', '+15 min (h=3)', '+30 min (h=6)'])
    ax.set_ylabel('MAE (meters)')
    ax.set_title('Forecast Error (MAE) by Prediction Horizon on Test Set [SIMULATION]')
    ax.grid(True, alpha=0.3, axis='y')
    ax.legend()

    plt.tight_layout()
    p2_path = os.path.join(output_plots_dir, "tank_forecast_errors_by_horizon.png")
    plt.savefig(p2_path, dpi=200)
    plt.close()

    # Copy plots to artifact directory
    artifact_dir = r"C:\Users\Lokesh U\.gemini\antigravity-ide\brain\58bcc980-bde9-413f-b26f-2977ccccd3da"
    if os.path.exists(artifact_dir):
        import shutil
        for p in [p1_path, p2_path]:
            shutil.copy(p, os.path.join(artifact_dir, os.path.basename(p)))
        print(f"Copied plots to {artifact_dir}")

    return df_results


if __name__ == '__main__':
    run_tank_forecasting()
