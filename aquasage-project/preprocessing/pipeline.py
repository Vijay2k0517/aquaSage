import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from prophet import Prophet

from leak_detector import LeakDetector

import sys
import os

# Add the parent directory to sys.path to allow relative imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import plots

def consecutive_zeros_mask(df, column_name, thresh=2):    
    '''
    Create a mask to remove consecutive zeros from a column in a DataFrame.
    '''

    arr = df[column_name].to_numpy()

    is_zero = arr == 0

    padded = np.concatenate(([False], is_zero, [False]))

    diff = np.diff(padded.astype(int))

    starts = np.flatnonzero(diff == 1)
    ends = np.flatnonzero(diff == -1)

    mask = np.ones_like(arr, dtype=bool)

    for start, end in zip(starts, ends):
        if end - start >= thresh:
            mask[start:end] = False

    return mask


def clean_data(df: pd.DataFrame, column_name,  min_threshold=None, max_threshold=None, delta_threshold=None, interpolate=False, island_ratio_threshold=0.1):
    """
    Clean CSV data by removing:
    1. Consecutive zeros
    2. Values where delta between adjacent values exceeds a threshold
    3. Values outside a specified range
    4. Islands of valid data where the ratio of island length to surrounding gaps is low
    
    
    Parameters:
    df (pd.DataFrame): Input DataFrame.
    min_threshold (pd.Series): Minimum threshold for each column.
    max_threshold (pd.Series): Maximum threshold for each column.
    delta_threshold (pd.Series): Maximum allowable change between consecutive rows for each column.
    island_ratio_threshold (float): Minimum ratio of island length to surrounding gap length to keep the island.
    
    Returns:
    pd.DataFrame: Cleaned DataFrame.
    """
    
    df = df.copy()
    df = df.resample("5min").mean() # resample to 5min intervals
    df_no_na = df.dropna(subset=[column_name])
    keep_mask = pd.Series(True, index=df.index)
    
    # 1. Remove values outside the specified range
    if min_threshold is None:
        min_threshold = df_no_na[column_name].quantile(0.005)



    keep_mask = keep_mask & (df[column_name] >= min_threshold)
    

    if max_threshold is None:
        max_threshold = df_no_na[column_name].quantile(0.95) * 2


    keep_mask = keep_mask & (df[column_name] <= max_threshold)
    
    
    # 2. Remove large deltas
    if delta_threshold is None:
        deltas = df[column_name].diff().abs()
        delta_q = deltas.quantile(0.90)
        delta_threshold = 2*delta_q


    deltas = df[column_name].diff().abs()
    # Shift to also catch the value after a big jump
    large_deltas = (deltas > delta_threshold) | (deltas.shift(-1) > delta_threshold)
    keep_mask = keep_mask & ~large_deltas

    print("\tmin_threshold:", min_threshold)
    print("\tmax_threshold:", max_threshold)
    print("\tdelta_threshold:", delta_threshold)
    
    # 3. Remove consecutive zeros
    zero_mask = consecutive_zeros_mask(df, column_name) # true values are non-zero
    keep_mask = keep_mask & zero_mask
    
    # 4. Remove islands based on ratio
    if island_ratio_threshold is not None:
        mask_values = keep_mask.to_numpy()
        # Pad with False to handle edges
        padded = np.concatenate(([False], mask_values, [False]))
        diff = np.diff(padded.astype(int))
        
        starts = np.flatnonzero(diff == 1)
        ends = np.flatnonzero(diff == -1)
        
        total_len = len(mask_values)
        
        for i in range(len(starts)):
            start = starts[i]
            end = ends[i]
            island_len = end - start
            
            # Calculate gap before
            if i == 0:
                gap_before = start
            else:
                gap_before = start - ends[i-1]
                
            # Calculate gap after
            if i == len(starts) - 1:
                gap_after = total_len - end
            else:
                gap_after = starts[i+1] - end
                
            total_gap = gap_before + gap_after
            
            if total_gap > 0:
                ratio = island_len / total_gap
                if ratio < island_ratio_threshold:
                    mask_values[start:end] = False
        
        keep_mask[:] = mask_values
    
    if not interpolate:
        # Apply mask
        df = df[keep_mask]
    else:
        
        df[column_name] = df[column_name].where(keep_mask, np.nan)
        df[column_name] = df[column_name].interpolate(method='linear', limit = 24, limit_direction='both') 
        df['replaced'] = ~keep_mask 

    return df


def clean_csvs(files,input_folder,  output_folder, plots_folder = None, interpolate=False):   
    """
    Clean all CSV files in a folder.
    
    Parameters:
    files (list): List of CSV files.
    output_folder (str): Output folder.
    """
    
    for file in files:
        print(f'Cleaning {file}...')
        df = pd.read_csv(os.path.join(input_folder, file), index_col=1, parse_dates=True)
        df = df.drop(columns=['Unnamed: 0'], errors='ignore')
        original_size = len(df) 
        
        value_col = df.columns[-1] #last column contains the timeseries data

        #plot histogram of values
        plt.figure(figsize=(10, 5))
        
        df_clean = clean_data(df, value_col, min_threshold=.5, interpolate=False)
        clean_size = len(df_clean)
        
        #percentage of datapoints removed
        excluded_ratio = 1 -  clean_size / original_size
       
        df_clean = df_clean.drop(columns=['nodeid'])
        print(df_clean.head())
        print('Renaming column:', df_clean.columns[-1], 'to Flow')
        df_clean = df_clean.rename(columns={df_clean.columns[-1]: 'Flow'})

       
        # Save cleaned data
        df_clean.to_csv(os.path.join(output_folder, file), index=True)

        if plots_folder is not None:
            # Plot original and cleaned data
            plt.figure(figsize=(40, 5))
            plt.plot(df_clean['Flow'], label='Cleaned no interpolation')
            plt.title(file + " | {:.2f}%".format(excluded_ratio*100))
            plt.savefig(os.path.join(plots_folder, file.replace('.csv', '.png')))
            plt.close()

    print('Done!')

def interpolate_prophet_local(df, col='Flow', gap_threshold=5, max_gap=None, 
                              window_days=14, interp_method='linear'):
    """
    Interpolates gaps using Prophet trained ONLY on local data around the gap.
    This is significantly faster than training on the full dataset.
    """
    # 1. Ensure frequency and identify gaps
    df = df.resample('5min').asfreq()
    s = df[col].copy()
    
    is_na = s.isna()
    if not is_na.any():
        return df.assign(replaced=False)

    # 2. Group contiguous NaNs
    na_blocks = is_na.ne(is_na.shift()).cumsum()
    gap_series = na_blocks[is_na]
    gap_counts = gap_series.value_counts()

    # 3. Categorize gaps
    small_gap_ids = gap_counts[gap_counts < gap_threshold].index
    large_gap_ids = gap_counts[gap_counts >= gap_threshold].index
    
    if max_gap:
        large_gap_ids = gap_counts[(gap_counts >= gap_threshold) & (gap_counts <= max_gap)].index

    # 4. Handle Small Gaps (Linear)
    s_filled = s.copy()
    small_mask = na_blocks.isin(small_gap_ids)
    s_filled[small_mask] = s_filled.interpolate(method=interp_method)[small_mask]

    # 5. Handle Large Gaps (Local Prophet)
    replaced_mask = small_mask.copy()
    
    if not large_gap_ids.empty:
        large_mask = na_blocks.isin(large_gap_ids)
        replaced_mask |= large_mask
        
        # Convert window to points (assuming 5min data: 12 points/hr * 24 hr/day)
        window_points = window_days * 24 * 12
        
        # Iterate over each large gap individually
        for gap_id in large_gap_ids:
            gap_mask = na_blocks == gap_id
            gap_indices = s.index[gap_mask]
            start_gap = gap_indices[0]
            end_gap = gap_indices[-1]
            
            # Define local window indices
            start_window = max(s.index[0], start_gap - pd.Timedelta(days=window_days))
            end_window = min(s.index[-1], end_gap + pd.Timedelta(days=window_days))
            
            # Extract local training data (excluding the gap itself)
            local_slice = s_filled.loc[start_window:end_window].copy()
            # Mask out the current gap in the training slice so we don't train on NaNs
            local_slice.loc[start_gap:end_gap] = np.nan
            
            # Prepare for Prophet
            df_local = local_slice.reset_index()
            df_local.columns = ['ds', 'y']
            train_df = df_local.dropna()
            
            if len(train_df) < 50: # Not enough data to train
                s_filled.loc[gap_mask] = s_filled.loc[gap_mask].interpolate(method='linear')
                continue

            try:
                # Disable yearly seasonality for local windows (usually too short)
                m = Prophet(daily_seasonality=True, weekly_seasonality=True, yearly_seasonality=False)
                m.fit(train_df)
                
                # Predict for the gap
                future = pd.DataFrame({'ds': gap_indices})
                forecast = m.predict(future)
                
                # Fill
                s_filled.loc[gap_mask] = forecast['yhat'].values
                
            except Exception as e:
                print(f"Local Prophet Error for gap at {start_gap}: {e}")
                s_filled.loc[gap_mask] = s_filled.loc[gap_mask].interpolate(method='linear')

    df_out = df.copy()
    df_out[col] = s_filled
    df_out['replaced'] = replaced_mask
    return df_out


if __name__ == "__main__":
    # Example usage
    input_folder = '../data/raw_flow_data'
    leak_file = '../data/processed_reports_data/leak_reports.csv'
    output_folder = '../data/processed_flow_data'
    plots_folder = '../plots/leak_detection'
    os.makedirs(output_folder, exist_ok=True)
    os.makedirs(plots_folder, exist_ok=True)

    df_leaks = pd.read_csv(leak_file, parse_dates=['timestamp'])
    files = [f for f in os.listdir(input_folder) if f.endswith('.csv')]

    for file in files:
        print(f'Processing {file} with Seasonal Mean Interpolation...')
        
        # Load cleaned data
        file_path = os.path.join(input_folder, file)
        if not os.path.exists(file_path):
            print(f"File {file_path} not found.")
            continue
            
        df = pd.read_csv(file_path, index_col=0, parse_dates=True)
        df_leaks_area = df_leaks_area = df_leaks[df_leaks['area'] == file.split('.')[0]] # filter leaks for the area corresponding to the file
        #oulier removal
        df_clean = clean_data(df, 'Flow', min_threshold=0.5)
        
        # Seasonal + Linear Interpolation
        df_seasonal = interpolate_prophet_local(df_clean, gap_threshold=24, col='Flow',
                                        max_gap=2016*4, interp_method='linear')
        print(df_seasonal.head())
        detector = LeakDetector(df_seasonal, df_leaks_area,
                        #drop detection params
                        drop_threshold=None,  # None = auto (1st percentile)
                        drop_min_day=4,
                        drop_max_day=3,

                        #abrupt leak params
                        spike_threshold_percentile=97,
                        max_spike_duration=14,
                        
                        #t-test leak params
                        ref_window_size=7*2,
                        test_window_size=7,
                        alpha=.05,
                        persistence=2,
                        min_segment_size=14,
                        std=.5,

                        #pelt leak params
                        window_penalty=20,
                        max_leak_duration_days=30*6,
                        window_width=14,
                        window_model = 'l2')
        
        detector.detect_leaks()
        detector.visualize_leak_periods(verbose=False, save_path=os.path.join(plots_folder, file.replace('.csv', '_leak_detection.png')))
        detector.to_csv(os.path.join(output_folder, file))
        #df_seasonal.to_csv(os.path.join(output_folder, file), index=True)
        