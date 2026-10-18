"""
Online Statistical Leak Detection Baseline Model.
Learns regular diurnal and day-of-week consumption patterns strictly from normal training periods.
Performs streaming forward inference with zero future-data leakage.
"""

import os
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import json
import pickle
import pandas as pd
import numpy as np


class DiurnalResidualBaseline:
    """
    Lightweight, interpretable statistical leak detector:
    1. Learns empirical expected flow distribution (mean and std) per (day-of-week, hour).
    2. Calculates standardized excess residual:
       z_t = max(0, (y_t - mu_{d,h}) / sigma_{d,h})
    3. Filters transient consumption noise via rolling lookback window (default 12h) persistence.
    4. Evaluates anomaly score against calibrated threshold tau.
    """

    def __init__(self, window: int = 12):
        self.window = window
        self.profile = {}
        self.global_mean = 0.0
        self.global_std = 1.0
        self.threshold = 2.0
        self.lookback_buffer = []

    def fit(self, train_df: pd.DataFrame, flow_col: str = 'Flow', time_col: str = 'result_time'):
        """Fit diurnal baseline profile strictly on normal training data."""
        df = train_df.copy()
        df[time_col] = pd.to_datetime(df[time_col])
        df['dow'] = df[time_col].dt.dayofweek
        df['hour'] = df[time_col].dt.hour

        self.global_mean = float(df[flow_col].mean())
        self.global_std = float(df[flow_col].std()) if df[flow_col].std() > 0 else 1.0

        grouped = df.groupby(['dow', 'hour'])[flow_col].agg(['mean', 'std']).reset_index()
        self.profile = {}
        for _, row in grouped.iterrows():
            key = f"{int(row['dow'])}_{int(row['hour'])}"
            std_val = float(row['std']) if not np.isnan(row['std']) and row['std'] > 0 else self.global_std
            self.profile[key] = {
                'mean': float(row['mean']),
                'std': std_val
            }
        print(f"Fitted diurnal profile over {len(self.profile)} (day-of-week, hour) bins.")

    def calibrate_threshold(self, val_df: pd.DataFrame, target_fpr_percentile: float = 99.0, flow_col: str = 'Flow', time_col: str = 'result_time') -> float:
        """
        Calibrate operating threshold on normal validation data.
        target_fpr_percentile=99.0 bounds false alarm rate to <= 1% on normal validation period.
        """
        scores = self.score_series(val_df, flow_col=flow_col, time_col=time_col)
        valid_scores = scores.dropna()
        self.threshold = float(np.percentile(valid_scores, target_fpr_percentile))
        print(f"Calibrated threshold at {target_fpr_percentile}th percentile of normal validation: {self.threshold:.3f}")
        return self.threshold

    def score_series(self, df_subset: pd.DataFrame, flow_col: str = 'Flow', time_col: str = 'result_time') -> pd.Series:
        """Score an entire time series batch in chronological order."""
        df = df_subset.copy()
        df[time_col] = pd.to_datetime(df[time_col])
        df['dow'] = df[time_col].dt.dayofweek
        df['hour'] = df[time_col].dt.hour

        means = []
        stds = []
        for _, row in df.iterrows():
            key = f"{int(row['dow'])}_{int(row['hour'])}"
            params = self.profile.get(key, {'mean': self.global_mean, 'std': self.global_std})
            means.append(params['mean'])
            stds.append(params['std'])

        residuals = (df[flow_col].values - np.array(means)) / np.array(stds)
        excess = np.clip(residuals, a_min=0, a_max=None)
        rolling_score = pd.Series(excess, index=df.index).rolling(window=self.window, min_periods=1).mean()
        return rolling_score

    def predict_series(self, df_subset: pd.DataFrame, flow_col: str = 'Flow', time_col: str = 'result_time') -> np.ndarray:
        """Generate binary leak predictions (0=Normal, 1=Leak) for time series."""
        scores = self.score_series(df_subset, flow_col=flow_col, time_col=time_col)
        return (scores.values >= self.threshold).astype(int)

    def predict_step(self, flow_reading: float, timestamp: pd.Timestamp) -> dict:
        """
        Streaming online inference: predicts anomaly status for a single incoming reading.
        Maintains internal lookback buffer of size self.window.
        """
        dow = timestamp.dayofweek
        hour = timestamp.hour
        key = f"{dow}_{hour}"
        params = self.profile.get(key, {'mean': self.global_mean, 'std': self.global_std})

        residual = (flow_reading - params['mean']) / params['std']
        excess = max(0.0, residual)

        self.lookback_buffer.append(excess)
        if len(self.lookback_buffer) > self.window:
            self.lookback_buffer.pop(0)

        score = float(np.mean(self.lookback_buffer))
        is_leak = bool(score >= self.threshold)

        return {
            'timestamp': str(timestamp),
            'flow': flow_reading,
            'expected_mean': params['mean'],
            'expected_std': params['std'],
            'residual': residual,
            'anomaly_score': score,
            'threshold': self.threshold,
            'is_leak_detected': is_leak
        }

    def save(self, filepath: str):
        """Save model configuration and profile parameters."""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        payload = {
            'window': self.window,
            'threshold': self.threshold,
            'global_mean': self.global_mean,
            'global_std': self.global_std,
            'profile': self.profile
        }
        with open(filepath, 'w') as f:
            json.dump(payload, f, indent=2)
        print(f"Saved baseline model to {filepath}")

    def load(self, filepath: str):
        """Load model configuration and profile parameters."""
        with open(filepath, 'r') as f:
            payload = json.load(f)
        self.window = payload['window']
        self.threshold = payload['threshold']
        self.global_mean = payload['global_mean']
        self.global_std = payload['global_std']
        self.profile = payload['profile']
        print(f"Loaded baseline model from {filepath}")
