"""
Feature Engineering and Dataset Generator for Future-Event Risk Prediction.
Constructs causal features available strictly up to prediction time t,
defines a forward-looking prediction target (H = 6 hours),
and enforces strict chronological splitting without target leakage.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


def compute_diurnal_profile(train_df: pd.DataFrame, flow_col: str = "Flow", time_col: str = "result_time") -> Dict[str, Dict[str, float]]:
    """Compute empirical mean and std for each (day_of_week, hour) bin on training set only."""
    df = train_df.copy()
    df[time_col] = pd.to_datetime(df[time_col])
    df["dow"] = df[time_col].dt.dayofweek
    df["hour"] = df[time_col].dt.hour

    grouped = df.groupby(["dow", "hour"])[flow_col].agg(["mean", "std"]).reset_index()
    global_mean = float(df[flow_col].mean())
    global_std = float(df[flow_col].std()) if df[flow_col].std() > 0 else 1.0

    profile = {}
    for _, row in grouped.iterrows():
        key = f"{int(row['dow'])}_{int(row['hour'])}"
        std_val = float(row["std"]) if pd.notna(row["std"]) and row["std"] > 0 else global_std
        profile[key] = {
            "mean": float(row["mean"]),
            "std": std_val,
        }
    profile["_global"] = {"mean": global_mean, "std": global_std}
    return profile


def extract_causal_features(
    df: pd.DataFrame,
    diurnal_profile: Dict[str, Dict[str, float]],
    horizon_hours: int = 6,
    flow_col: str = "Flow",
    time_col: str = "result_time",
    leak_col: str = "Leak_Detected",
) -> pd.DataFrame:
    """
    Extract strictly causal feature set at time t:
    - Lagged flow (t, t-1h, t-2h, t-3h)
    - Short-term rolling aggregates (6h mean, std, min, max)
    - 24h rolling aggregates (mean, std)
    - Diurnal standardized residual z_t = (flow_t - profile_mean) / profile_std
    - 6h rolling residual excess
    - Night flow anomaly indicator (mean deviation between 03:00-05:00 in past 24h)
    - Rate of change (delta 1h, delta 3h)
    - Cyclical calendar features (hour sine/cosine, day-of-week)

    Target:
    - y_future_risk: Binary indicator if active leak / sustained elevated flow occurs in (t, t + horizon_hours]
    """
    df = df.copy()
    df[time_col] = pd.to_datetime(df[time_col])
    df = df.sort_values(by=time_col).reset_index(drop=True)

    # 1. Base time features
    df["hour"] = df[time_col].dt.hour
    df["dow"] = df[time_col].dt.dayofweek
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24.0)

    # 2. Match diurnal expected mean and std
    g_mean = diurnal_profile["_global"]["mean"]
    g_std = diurnal_profile["_global"]["std"]

    def get_profile_vals(row):
        key = f"{int(row['dow'])}_{int(row['hour'])}"
        p = diurnal_profile.get(key, diurnal_profile["_global"])
        return p["mean"], p["std"]

    profiles = df.apply(get_profile_vals, axis=1)
    df["diurnal_mean"] = [p[0] for p in profiles]
    df["diurnal_std"] = [p[1] for p in profiles]
    df["diurnal_zscore"] = (df[flow_col] - df["diurnal_mean"]) / df["diurnal_std"].replace(0, g_std)

    # 3. Lagged features (hourly steps)
    df["flow_lag_1h"] = df[flow_col].shift(1)
    df["flow_lag_2h"] = df[flow_col].shift(2)
    df["flow_lag_3h"] = df[flow_col].shift(3)

    # 4. Deltas
    df["flow_delta_1h"] = df[flow_col] - df["flow_lag_1h"]
    df["flow_delta_3h"] = df[flow_col] - df["flow_lag_3h"]

    # 5. Rolling statistics (lookback only)
    df["flow_roll_mean_6h"] = df[flow_col].rolling(window=6, min_periods=1).mean()
    df["flow_roll_std_6h"] = df[flow_col].rolling(window=6, min_periods=1).std().fillna(0.0)
    df["flow_roll_min_6h"] = df[flow_col].rolling(window=6, min_periods=1).min()
    df["flow_roll_max_6h"] = df[flow_col].rolling(window=6, min_periods=1).max()

    df["flow_roll_mean_24h"] = df[flow_col].rolling(window=24, min_periods=1).mean()
    df["flow_roll_std_24h"] = df[flow_col].rolling(window=24, min_periods=1).std().fillna(0.0)

    df["excess_z_mean_6h"] = df["diurnal_zscore"].rolling(window=6, min_periods=1).mean()

    # 6. Night flow feature: Is night flow (03:00 - 05:00) abnormally elevated?
    is_night = (df["hour"] >= 3) & (df["hour"] <= 5)
    df["night_flow_reading"] = np.where(is_night, df[flow_col], np.nan)
    # Forward-fill previous night's minimum/mean night flow up to 24h
    df["recent_night_flow"] = df["night_flow_reading"].ffill().fillna(df[flow_col].median())
    df["night_flow_z"] = (df["recent_night_flow"] - g_mean) / g_std

    # 7. Construct Future Prediction Target (H = horizon_hours)
    # Check if ANY active leak occurs in the window [t+1, t+H]
    if leak_col in df.columns:
        # Rolling forward sum: shift(-H).rolling(H)
        future_leak = df[leak_col].iloc[::-1].rolling(window=horizon_hours, min_periods=1).max().iloc[::-1].shift(-horizon_hours)
        df["target_future_leak"] = future_leak.fillna(0).astype(int)
    else:
        df["target_future_leak"] = 0

    return df


FEATURE_COLUMNS = [
    "Flow",
    "flow_lag_1h",
    "flow_lag_2h",
    "flow_lag_3h",
    "flow_delta_1h",
    "flow_delta_3h",
    "flow_roll_mean_6h",
    "flow_roll_std_6h",
    "flow_roll_min_6h",
    "flow_roll_max_6h",
    "flow_roll_mean_24h",
    "flow_roll_std_24h",
    "diurnal_zscore",
    "excess_z_mean_6h",
    "recent_night_flow",
    "night_flow_z",
    "hour_sin",
    "hour_cos",
    "dow",
]


def build_chronological_feature_splits(
    splits_dir: str = "data/splits/Area_1",
    horizon_hours: int = 6,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """
    Load raw chronological hourly splits:
    - Train: train.csv (2022-07 to 2023-07) + pre-validation cal.csv (2023-07 to 2024-03).
      Provides 20 months of history with both normal operations and verified leak events.
    - Val: val.csv (2024-03 to 2024-06), strictly held out for threshold calibration.
    - Test: test.csv (2024-06 to 2025-02), untouched out-of-time operational test set.

    Strict Temporal Ordering:
    max(Train) < min(Val) < max(Val) < min(Test)
    """
    p = Path(splits_dir)
    train_raw = pd.read_csv(p / "train.csv")
    cal_raw = pd.read_csv(p / "cal.csv")
    val_raw = pd.read_csv(p / "val.csv")
    test_raw = pd.read_csv(p / "test.csv")

    train_raw["result_time"] = pd.to_datetime(train_raw["result_time"])
    cal_raw["result_time"] = pd.to_datetime(cal_raw["result_time"])
    val_raw["result_time"] = pd.to_datetime(val_raw["result_time"])
    test_raw["result_time"] = pd.to_datetime(test_raw["result_time"])

    # Slice cal_raw strictly before val_raw start to avoid any overlap
    val_start = val_raw["result_time"].min()
    cal_pre_val = cal_raw[cal_raw["result_time"] < val_start].copy()

    # Combine train_raw and cal_pre_val into full historical training set
    full_train_raw = pd.concat([train_raw, cal_pre_val], ignore_index=True)
    full_train_raw = full_train_raw.sort_values(by="result_time").reset_index(drop=True)

    # Assert strict temporal ordering
    assert full_train_raw["result_time"].max() < val_raw["result_time"].min(), "Temporal leak: Train overlaps Val!"
    assert val_raw["result_time"].max() < test_raw["result_time"].min(), "Temporal leak: Val overlaps Test!"

    diurnal_profile = compute_diurnal_profile(train_raw)

    train_feat = extract_causal_features(full_train_raw, diurnal_profile, horizon_hours=horizon_hours)
    val_feat = extract_causal_features(val_raw, diurnal_profile, horizon_hours=horizon_hours)
    test_feat = extract_causal_features(test_raw, diurnal_profile, horizon_hours=horizon_hours)

    # Purge the last H points of train and val where target cannot look ahead safely
    train_feat = train_feat.iloc[:-horizon_hours].dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)
    val_feat = val_feat.iloc[:-horizon_hours].dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)
    test_feat = test_feat.iloc[:-horizon_hours].dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)

    metadata = {
        "horizon_hours": horizon_hours,
        "feature_count": len(FEATURE_COLUMNS),
        "features": FEATURE_COLUMNS,
        "train_samples": len(train_feat),
        "val_samples": len(val_feat),
        "test_samples": len(test_feat),
        "train_pos_rate": float(train_feat["target_future_leak"].mean()),
        "val_pos_rate": float(val_feat["target_future_leak"].mean()),
        "test_pos_rate": float(test_feat["target_future_leak"].mean()),
    }

    return train_feat, val_feat, test_feat, metadata
