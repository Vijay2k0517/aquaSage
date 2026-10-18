import pandas as pd
import pickle
from pathlib import Path
import os
import sys
import matplotlib.pyplot as plt
import numpy as np


MIN_TRAIN_SAMPLES = 24 * 60 
MIN_VAL_SAMPLES = 24 * 30
MIN_TEST_SAMPLES = 24 * 30



# Configuration
CSV_DIR = '../data/processed_flow_data'  # Directory containing the cleaned CSV files
DATA_NAME = 'custom'  # This becomes your --data argument
FILE_NAMES = os.listdir(CSV_DIR)

def find_largest_contiguous_segment(df, time_col='result_time', freq='H'):
    """Find the largest contiguous segment with no time gaps."""
    df = df.sort_values(time_col).reset_index(drop=True)
    
    # Calculate expected time difference
    expected_diff = pd.Timedelta(freq)
    
    # Find where gaps occur (difference > expected)
    time_diffs = df[time_col].diff()
    gap_indices = time_diffs[time_diffs > expected_diff].index.tolist()
    
    # Build segment boundaries
    segment_starts = [0] + gap_indices
    segment_ends = gap_indices + [len(df)]
    
    # Find largest segment
    largest_start, largest_end = 0, 0
    max_length = 0
    
    for start, end in zip(segment_starts, segment_ends):
        length = end - start
        if length > max_length:
            max_length = length
            largest_start, largest_end = start, end
    
    return df.iloc[largest_start:largest_end].reset_index(drop=True)

for FILE_NAME in FILE_NAMES:
    if not FILE_NAME.endswith('.csv'):
        continue 

    #reading and preprocessing
    CSV_PATH = os.path.join(CSV_DIR, FILE_NAME)
    print(f"\nProcessing file: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    df['result_time'] = pd.to_datetime(df['result_time'])
    df.set_index('result_time', inplace=True)
    df = df.resample('h').agg({
        'Flow' : 'mean',
        'Leak_Detected' : 'any'
    }).dropna().reset_index()
    
    # Find and use the largest contiguous segment
    original_len = len(df)
    df = find_largest_contiguous_segment(df, time_col='result_time', freq='1h')
    print(f"Original samples: {original_len}, Largest contiguous segment: {len(df)}")
    if len(df) < original_len:
        print(f"  Time range: {df['result_time'].iloc[0]} to {df['result_time'].iloc[-1]}")
    
    print(df.head())

    labeled_data = df[['Flow', 'Leak_Detected']].values.tolist()

    labels = [row[-1] for row in labeled_data]

    anomaly_indices = [i for i, label in enumerate(labels) if label]
    print(f"Total samples: {len(labeled_data)}")
    print(f"Total anomalies: {len(anomaly_indices)}")

    def find_contiguous_normal_segments(labels):
        """Find all contiguous segments of normal data (label=0)."""
        segments = []
        start = None
        for i, label in enumerate(labels):
            if not label:  # Normal
                if start is None:
                    start = i
            else:  # Anomaly
                if start is not None:
                    segments.append((start, i))
                    start = None
        # Handle segment at the end
        if start is not None:
            segments.append((start, len(labels)))
        return segments

    def find_contiguous_anomaly_segments(labels):
        """Find all contiguous segments containing anomalies."""
        segments = []
        start = None
        for i, label in enumerate(labels):
            if label:  # Anomaly
                if start is None:
                    start = i
            else:  # Normal
                if start is not None:
                    segments.append((start, i))
                    start = None
        # Handle segment at the end
        if start is not None:
            segments.append((start, len(labels)))
        return segments

    def intersects(seg1, seg2):
        """Check if two segments (start, end) intersect."""
        return not (seg1[1] <= seg2[0] or seg2[1] <= seg1[0])

    def subset(seg1, seg2):
        """Check if seg1 is a subset of seg2."""
        return seg1[0] >= seg2[0] and seg1[1] <= seg2[1]
    
    def strict_subset(seg1, seg2):
        """Check if seg1 is a strict subset of seg2."""
        if subset(seg1, seg2):
            return seg1[0] > seg2[0] or seg1[1] < seg2[1]
        return False

    
    if len(anomaly_indices) > 0:
        first_anomaly_idx = anomaly_indices[0]
        last_anomaly_idx = anomaly_indices[-1]
        print(f"Anomalies located at indices {first_anomaly_idx} to {last_anomaly_idx}")

        
        # Find all contiguous normal segments
        normal_segments = find_contiguous_normal_segments(labels)
        anomaly_segments = find_contiguous_anomaly_segments(labels)
        print(f"Found {len(normal_segments)} contiguous normal segments:")
        for i, (start, end) in enumerate(normal_segments):
            print(f"  Segment {i}: indices {start}-{end} (length: {end-start})")
        
  
      
        
        train_data_final = None
        val_data = None
        test_data = None
        train_start_global = None
        train_end_global_final = None
        val_start_global = None
        val_end_global = None
        test_start = None
        test_end = None
        
        #used to find minimum test segment before last anomaly
        latest_anomaly_segment = max(anomaly_segments, key=lambda seg: seg[0])

        if latest_anomaly_segment[1] - latest_anomaly_segment[0] < MIN_TEST_SAMPLES:
            latest_anomaly_segment = (latest_anomaly_segment[1] - MIN_TEST_SAMPLES, latest_anomaly_segment[1])

        
        usable_normal_segments = [seg for seg in normal_segments if seg[1] <= latest_anomaly_segment[0]]


        largest_segment = max(usable_normal_segments, key=lambda seg: seg[1]-seg[0])
        largest_segment_length = largest_segment[1] - largest_segment[0]

        # Check for normal segment after largest segment to use for validation
        possible_val_segments = [seg for seg in usable_normal_segments if seg[0] >= largest_segment[1] and (seg[1]-seg[0]) >= MIN_VAL_SAMPLES]

        if possible_val_segments:
            val_segment = max(possible_val_segments, key=lambda seg: seg[1]-seg[0])
            train_segment = (largest_segment[0], largest_segment[1])
        elif largest_segment_length >= MIN_TRAIN_SAMPLES + MIN_VAL_SAMPLES:
            # Split from largest segment if it's big enough for both
            val_segment = (largest_segment[1] - MIN_VAL_SAMPLES, largest_segment[1])
            train_segment = (largest_segment[0], largest_segment[1] - MIN_VAL_SAMPLES)
        else:
            # Segment too small - skip this file or use all for training
            print(f"ERROR: Largest usable segment ({largest_segment_length} samples) is too small for train+val split")
            print(f"       Need at least {MIN_TRAIN_SAMPLES + MIN_VAL_SAMPLES} samples")
            print(f"       Skipping file: {FILE_NAME}")
            continue  # Skip to next file

        test_segment = (val_segment[1], len(labeled_data))
                

        #check if any of them are less than minimum required samples
        if (train_segment[1] - train_segment[0]) < MIN_TRAIN_SAMPLES:
            print(f"Warning: Training segment too small ({train_segment[1] - train_segment[0]} samples)")
        if (val_segment[1] - val_segment[0]) < MIN_VAL_SAMPLES:
            print(f"Warning: Validation segment too small ({val_segment[1] - val_segment[0]} samples)")
        if (test_segment[1] - test_segment[0]) < MIN_TEST_SAMPLES:
            print(f"Warning: Test segment too small ({test_segment[1] - test_segment[0]} samples)")

        #calibration data:
        calibration_segment = (train_segment[1], test_segment[0])
        print("File:", FILE_NAME)
        if strict_subset(val_segment, calibration_segment):
            print("Val segment engulfs calibration segment, adjusting val segment")
            print('*'*50)
        else:
            #find first anomaly in test segment
            first_anomaly_in_test = min(seg for seg in anomaly_segments if intersects(seg, test_segment))
            last_anomaly_in_test = max(seg for seg in anomaly_segments if intersects(seg, test_segment))
        
            #split anomaly
            mid = (first_anomaly_in_test[0] + last_anomaly_in_test[1]) // 2
            print("Start:" , first_anomaly_in_test[0], "End:", first_anomaly_in_test[1], "Mid:", mid, "Days", (first_anomaly_in_test[1]-first_anomaly_in_test[0])/24)
            test_segment = (mid, test_segment[1])
            calibration_segment = (train_segment[1], mid)
            

        print(f"Calibration segment: {calibration_segment}")
        print(f"Val segment before adjustment: {val_segment}")
        print('*'*50)

        val_segment = (val_segment[0], val_segment[1] - 7 * 24)
        calibration_segment = (calibration_segment[0], calibration_segment[1] - 7 * 24)
        test_segment = (test_segment[0] - 7 * 24, test_segment[1])


        train_data_final = labeled_data[train_segment[0]:train_segment[1]]
        train_start_global = train_segment[0]
        train_end_global_final = train_segment[1]

        val_data = labeled_data[val_segment[0]:val_segment[1]]
        val_start_global = val_segment[0]
        val_end_global = val_segment[1]

        test_data = labeled_data[test_segment[0]:test_segment[1]]
        test_start = test_segment[0]
        test_end = test_segment[1]

        cal_data = labeled_data[calibration_segment[0]:calibration_segment[1]]




    

    
    else:
        # If no anomalies, use simple 60/20/20 split
        print("No anomalies found - using 60/20/20 split")
        split1 = int(len(labeled_data) * 0.6)
        split2 = int(len(labeled_data) * 0.8)
        
        train_data_final = labeled_data[:split1]
        val_data = labeled_data[split1:split2]
        test_data = labeled_data[split2:]
        
        train_start_global = 0
        train_end_global_final = split1
        val_start_global = split1
        val_end_global = split2
        test_start = split2
        test_end = len(labeled_data)

    # Verify temporal order: train < val < test (skip if anomalies forced different order)
    if train_start_global > test_start:
        print(f"\nWARNING: Non-standard temporal order due to early anomalies")
        print(f"Order is: TEST ({test_start}-{test_end}) < TRAIN ({train_start_global}-{train_end_global_final}) < VAL ({val_start_global}-{val_end_global})")
    else:
        assert train_end_global_final <= val_start_global, \
            f"Temporal order violation: train ends at {train_end_global_final} but val starts at {val_start_global}"
        assert val_end_global <= test_start, \
            f"Temporal order violation: val ends at {val_end_global} but test starts at {test_start}"
    
    print(f"\n=== Final Split ===")
    print(f"Train: indices {train_start_global}-{train_end_global_final}")
    print(f"Val:   indices {val_start_global}-{val_end_global}")
    print(f"Test:  indices {test_start}-{test_end}")

    # Verify splits
    train_anomalies = sum(1 for row in train_data_final if row[-1])
    val_anomalies = sum(1 for row in val_data if row[-1])
    test_anomalies = sum(1 for row in test_data if row[-1])
    print(f"Train samples: {len(train_data_final)} (anomalies: {train_anomalies})")
    print(f"Val samples: {len(val_data)} (anomalies: {val_anomalies})")
    print(f"Test samples: {len(test_data)} (anomalies: {test_anomalies})")

    # Create directories and save
    train_path = Path('dataset', DATA_NAME, 'labeled', 'train', FILE_NAME).with_suffix('.pkl')
    val_path = Path('dataset', DATA_NAME, 'labeled', 'val', FILE_NAME).with_suffix('.pkl')
    test_path = Path('dataset', DATA_NAME, 'labeled', 'test', FILE_NAME).with_suffix('.pkl')
    cal_path = Path('dataset', DATA_NAME, 'labeled', 'calibration', FILE_NAME).with_suffix('.pkl')
    plots_path = Path('dataset', DATA_NAME, 'labeled', 'plots')

    train_path.parent.mkdir(parents=True, exist_ok=True)
    val_path.parent.mkdir(parents=True, exist_ok=True)
    test_path.parent.mkdir(parents=True, exist_ok=True)
    cal_path.parent.mkdir(parents=True, exist_ok=True)
    plots_path.mkdir(parents=True, exist_ok=True)


    with open(train_path, 'wb') as f:
        pickle.dump(train_data_final, f)
    
    with open(val_path, 'wb') as f:
        pickle.dump(val_data, f)
        
    with open(test_path, 'wb') as f:
        pickle.dump(test_data, f)
    
    with open(cal_path, 'wb') as f:
        pickle.dump(cal_data, f)

    print(f"Train data saved to {train_path}")
    print(f"Val data saved to {val_path}")
    print(f"Test data saved to {test_path}")

    # Create visualization for train/val/test split
    print(f"Creating visualization for {FILE_NAME}...")
    
    # Reconstruct the full timeline with split markers
    all_values = [row[0] for row in labeled_data]
    all_labels = [row[1] for row in labeled_data]
    
    # Use the indices already computed above
    train_start_idx = train_start_global
    train_end_idx = train_end_global_final
    val_start_idx = val_start_global
    val_end_idx = val_end_global
    test_start_idx = test_start
    test_end_idx = test_end

    cal_start_idx = calibration_segment[0]
    cal_end_idx = calibration_segment[1]
    
    # Create figure
    fig, ax = plt.subplots(figsize=(16, 6))
    
    # Plot all data
    time_indices = np.arange(len(all_values))
    ax.plot(time_indices, all_values, 'lightgray', linewidth=0.5, alpha=0.5, label='All Data')
    
    # Highlight train data
    train_indices = np.arange(train_start_idx, train_end_idx)
    ax.plot(train_indices, all_values[train_start_idx:train_end_idx], 
            'blue', linewidth=1, label=f'Train ({len(train_data_final)} samples)', alpha=0.7)
    
    # Highlight validation data
    val_indices = np.arange(val_start_idx, val_end_idx)
    ax.plot(val_indices, all_values[val_start_idx:val_end_idx], 
            'orange', linewidth=1, label=f'Val ({len(val_data)} samples)', alpha=0.7)
    
    # Highlight test data
    test_indices = np.arange(test_start_idx, test_end_idx)
    ax.plot(test_indices, all_values[test_start_idx:test_end_idx], 
            'green', linewidth=1, label=f'Test ({len(test_data)} samples)', alpha=0.7)
    
    cal_indices = np.arange(cal_start_idx, cal_end_idx)
    ax.fill_between(cal_indices, 
                    all_values[cal_start_idx:cal_end_idx], 
                    color='purple', alpha=0.2, label=f'Calibration ({cal_end_idx - cal_start_idx} samples)')
    # Mark anomalies with red dots
    anomaly_mask = np.array(all_labels, dtype=bool)
    if np.any(anomaly_mask):
        anomaly_times = time_indices[anomaly_mask]
        anomaly_values = np.array(all_values)[anomaly_mask]
        ax.scatter(anomaly_times, anomaly_values, c='red', s=20, 
                  label=f'Anomalies ({sum(anomaly_mask)})', zorder=5, alpha=0.8)
    
    # Add vertical lines to mark split boundaries
    ax.axvline(x=train_start_idx, color='blue', linestyle='--', alpha=0.5, linewidth=1)
    ax.axvline(x=train_end_idx, color='blue', linestyle='--', alpha=0.5, linewidth=1)
    ax.axvline(x=val_start_idx, color='orange', linestyle='--', alpha=0.5, linewidth=1)
    ax.axvline(x=val_end_idx, color='orange', linestyle='--', alpha=0.5, linewidth=1)
    ax.axvline(x=test_start_idx, color='green', linestyle='--', alpha=0.5, linewidth=1)
    ax.axvline(x=test_end_idx, color='green', linestyle='--', alpha=0.5, linewidth=1)
    
    ax.set_xlabel('Time Index')
    ax.set_ylabel('Flow Value')
    ax.set_title(f'Train/Val/Test Split Visualization - {FILE_NAME}')
    ax.legend(loc='best')
    ax.grid(True, alpha=0.3)
    
    # Save plot
    plot_file = plots_path / f"{Path(FILE_NAME).stem}_split.png"
    plt.tight_layout()
    plt.savefig(plot_file, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"Visualization saved to {plot_file}")