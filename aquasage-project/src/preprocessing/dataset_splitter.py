"""
Chronological Dataset Splitting Module.
Partitions time-series into Train, Validation, and Test sets
adhering strictly to temporal ordering: Train < Validation < Test.
Prevents any future data leakage.
"""

import os
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import pickle
import pandas as pd
import numpy as np


def create_chronological_splits(
    processed_csv_path: str,
    output_dir: str = "data/splits/Area_1",
    resample_freq: str = 'h'
) -> dict:
    """
    Splits the labeled time series into chronological partitions:
    - Train: Normal operations period (zero active leaks) for learning baseline dynamics.
    - Validation: Unseen normal period (zero active leaks) for threshold calibration and false-alarm bounding.
    - Calibration: Intermediate evaluation window containing transition and early leak periods.
    - Test: Out-of-time evaluation period containing real operations with active leaks.

    Temporal Guarantee:
    Train max timestamp < Val min timestamp < Test min timestamp.
    """
    df = pd.read_csv(processed_csv_path)
    df['result_time'] = pd.to_datetime(df['result_time'])
    df.set_index('result_time', inplace=True)

    # Hourly resampling for robust trend modeling
    df_h = df.resample(resample_freq).agg({
        'Flow': 'mean',
        'Leak_Detected': 'any'
    }).dropna().reset_index()

    total_len = len(df_h)
    print(f"Total hourly samples available: {total_len}")

    # Standard split indices aligned with custom_dataset.py benchmark definition
    # Train: 4,705 to 13,392 (~1 full year, 2022-07-16 to 2023-07-12)
    # Val: 19,681 to 21,216 (~2 months, 2024-03-31 to 2024-06-02)
    # Cal: 13,392 to 21,216
    # Test: 21,216 to 27,648 (~9 months, 2024-06-03 to 2025-02-25)
    train_df = df_h.iloc[4705:13392].copy().reset_index(drop=True)
    val_df = df_h.iloc[19681:21216].copy().reset_index(drop=True)
    cal_df = df_h.iloc[13392:21216].copy().reset_index(drop=True)
    test_df = df_h.iloc[21216:27648].copy().reset_index(drop=True)

    # Verification assertions
    assert train_df['result_time'].max() < val_df['result_time'].min(), "Temporal leak: Train overlaps Val!"
    assert val_df['result_time'].max() < test_df['result_time'].min(), "Temporal leak: Val overlaps Test!"

    os.makedirs(output_dir, exist_ok=True)
    splits = {
        'train': train_df,
        'val': val_df,
        'cal': cal_df,
        'test': test_df
    }

    # Save CSVs
    for name, split_df in splits.items():
        csv_file = os.path.join(output_dir, f"{name}.csv")
        split_df.to_csv(csv_file, index=False)
        pkl_file = os.path.join(output_dir, f"{name}.pkl")
        data_list = split_df[['Flow', 'Leak_Detected']].values.tolist()
        with open(pkl_file, 'wb') as f:
            pickle.dump(data_list, f)
        print(f"[{name.upper()}] {len(split_df)} samples ({split_df['result_time'].min()} to {split_df['result_time'].max()}) | Active leaks: {split_df['Leak_Detected'].sum()} ({split_df['Leak_Detected'].mean()*100:.1f}%)")

    return splits


if __name__ == '__main__':
    in_csv = "data/processed_flow_data/Area_1.csv"
    create_chronological_splits(in_csv)
