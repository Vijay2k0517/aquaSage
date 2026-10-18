"""
Data cleaning and interpolation module for DMA flow time series.
Preserves original datasets and exports cleaned, chronologically sorted,
and regularly sampled flow series.
"""

import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import pandas as pd
import numpy as np


def clean_and_interpolate_flow(
    input_csv_path: str,
    flow_col: str = 'Flow',
    time_col: str = 'result_time',
    freq: str = '5min',
    min_flow: float = 0.5,
    max_flow_quantile: float = 0.999,
    linear_gap_limit: int = 24
) -> pd.DataFrame:
    """
    Clean raw DMA inlet flow measurements:
    1. Parse timestamps and sort in strict ascending chronological order.
    2. Resample to a regular grid (default 5 minutes).
    3. Filter sensor corruption outliers (e.g. extreme values outside physical bounds).
    4. Fill small gaps (<= linear_gap_limit points) with linear interpolation.
    5. Impute remaining large gaps using seasonal diurnal profiles (day-of-week & time-of-day mean).

    Assumptions:
    - Flow unit: m³/h (inlet DMA measurement).
    - Physical flow lower bound is positive (> 0.5 m³/h) under operational pressure.
    - Extreme packet corruption (> 100x normal max or negative) represents telemetry glitches.
    - Small gaps (<= 2 hours) reflect brief packet transmission dropouts.
    - Large gaps preserve seasonal and diurnal consumer demand patterns.
    """
    # 1. Load data
    df = pd.read_csv(input_csv_path)
    df[time_col] = pd.to_datetime(df[time_col])

    # 2. Sort chronologically ascending
    df = df.sort_values(time_col).reset_index(drop=True)

    # 3. Resample to uniform grid
    df.set_index(time_col, inplace=True)
    df_grid = df.resample(freq).mean()

    # 4. Outlier rejection
    valid_flows = df_grid[flow_col].dropna()
    q_high = valid_flows.quantile(max_flow_quantile) * 2.0
    
    # Mark corrupt readings as NaN
    is_valid = (df_grid[flow_col] >= min_flow) & (df_grid[flow_col] <= q_high)
    df_grid.loc[~is_valid, flow_col] = np.nan

    # 5. Short gap imputation: Linear interpolation (<= 24 steps = 2 hours)
    df_grid[flow_col] = df_grid[flow_col].interpolate(method='linear', limit=linear_gap_limit)

    # 6. Long gap imputation: Diurnal seasonal profile (day-of-week + hour + minute)
    if df_grid[flow_col].isna().any():
        df_grid['dow'] = df_grid.index.dayofweek
        df_grid['hour'] = df_grid.index.hour
        df_grid['minute'] = df_grid.index.minute
        profile = df_grid.groupby(['dow', 'hour', 'minute'])[flow_col].transform('mean')
        df_grid[flow_col] = df_grid[flow_col].fillna(profile)
        # Global mean fallback if any edge case remains
        df_grid[flow_col] = df_grid[flow_col].fillna(df_grid[flow_col].mean())
        df_grid.drop(columns=['dow', 'hour', 'minute'], inplace=True)

    return df_grid.reset_index()


if __name__ == '__main__':
    raw_path = "data/raw_flow_data/Area_1.csv"
    print(f"Testing clean_and_interpolate_flow on {raw_path}...")
    df_clean = clean_and_interpolate_flow(raw_path)
    print(f"Cleaned shape: {df_clean.shape}")
    print(f"Time range: {df_clean['result_time'].min()} to {df_clean['result_time'].max()}")
    print(f"Remaining NaNs: {df_clean['Flow'].isna().sum()}")
    print("Flow Summary:")
    print(df_clean['Flow'].describe())
