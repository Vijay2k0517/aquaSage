"""
Retrospective Historical Leakage Ground-Truth Annotation Module.
Pairs cleaned 5-minute DMA flow with verified repair logs (df_leaks)
to identify and label ground-truth leakage periods.
"""

import os
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import pandas as pd
import numpy as np

# Add preprocessing directory to sys.path to reuse existing LeakDetector
sys.path.append(os.path.abspath('preprocessing'))
from leak_detector import LeakDetector


def annotate_ground_truth_leaks(
    df_clean: pd.DataFrame,
    leak_reports_csv: str,
    area_name: str = 'Area_1',
    output_csv_path: str = None
) -> pd.DataFrame:
    """
    Retrospective Historical Analysis:
    Uses verified historical repair logs to identify significant flow drops (fixes),
    then walks backward in time to determine the start of the leak.

    IMPORTANT: This is strictly an offline labeling step to produce benchmark ground truth.
    It uses future knowledge (the fact that a repair occurred on date X) to label the past.
    It MUST NOT be used as an online detection algorithm for incoming telemetry.
    """
    # Load and filter leak reports for the specified area
    df_leaks = pd.read_csv(leak_reports_csv, encoding='utf-8')
    df_leaks_area = df_leaks[df_leaks['area'] == area_name].copy()
    df_leaks_area['timestamp'] = pd.to_datetime(df_leaks_area['timestamp'])

    # Instantiate LeakDetector
    detector = LeakDetector(
        df_clean, df_leaks_area,
        drop_threshold=None,
        drop_min_day=4,
        drop_max_day=3,
        spike_threshold_percentile=97,
        max_spike_duration=14,
        ref_window_size=14,
        test_window_size=7,
        alpha=0.05,
        persistence=2,
        min_segment_size=14,
        std=0.5,
        window_penalty=20,
        max_leak_duration_days=180,
        window_width=14,
        window_model='l2'
    )

    # Detect leak periods
    detector.detect_leaks()

    # Create labeled dataframe
    df_results = df_clean.copy()
    if 'result_time' not in df_results.columns and isinstance(df_results.index, pd.DatetimeIndex):
        df_results = df_results.reset_index(names='result_time')

    df_results['Leak_Detected'] = False

    for leak in detector.leak_periods.get('all', []):
        s = min(leak['start_idx'], len(detector.df_nightflow) - 1)
        e = min(leak['end_idx'], len(detector.df_nightflow) - 1)
        s_date = detector.df_nightflow.loc[s, 'result_time']
        e_date = detector.df_nightflow.loc[e, 'result_time']

        mask = (df_results['result_time'] >= s_date) & (df_results['result_time'] <= e_date)
        df_results.loc[mask, 'Leak_Detected'] = True

    if output_csv_path:
        os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)
        df_results.to_csv(output_csv_path, index=False)
        print(f"Saved annotated dataset to {output_csv_path}")

    return df_results, detector


if __name__ == '__main__':
    from clean_flow import clean_and_interpolate_flow

    raw_flow = "data/raw_flow_data/Area_1.csv"
    leak_file = "data/processed_reports_data/leak_reports.csv"
    out_file = "data/processed_flow_data/Area_1.csv"

    print("Cleaning raw flow...")
    df_c = clean_and_interpolate_flow(raw_flow)
    print("Annotating ground truth leaks...")
    df_annotated, det = annotate_ground_truth_leaks(df_c, leak_file, 'Area_1', out_file)
    print(f"Total rows: {len(df_annotated)}")
    print(f"Leak positive timesteps: {df_annotated['Leak_Detected'].sum()} ({df_annotated['Leak_Detected'].mean()*100:.2f}%)")
