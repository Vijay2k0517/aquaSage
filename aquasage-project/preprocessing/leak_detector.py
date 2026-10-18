import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import ruptures as rpt

from scipy import stats



class LeakDetector:
    def __init__(self, df, df_leaks, **kwargs):
        '''
        Initializes the LeakDetector with flow data and leakage reports.
        Computes validated drops (df_drop) internally from df_leaks.
        Args:
            df (pd.DataFrame): DataFrame containing flow data with 'result_time' and 'Flow' columns.
            df_leaks (pd.DataFrame): DataFrame containing leakage reports (already filtered by area).
            kwargs: Additional parameters for detection algorithms.
        '''
        self.df = df
        self.df_nightflow = self._preprocess_data(df)
        self.df_leaks = df_leaks
        self.params = kwargs
        self.leak_periods = {}  # store detected leak periods per detection algorithm
        # Compute validated drops from leak reports
        self.df_drop = self._compute_drops()
    
    @staticmethod
    def _preprocess_data(df):
        """Preprocess flow data: filter by time window and resample daily."""
        df = df.copy()
        if 'result_time' not in df.columns and isinstance(df.index, pd.DatetimeIndex):
            df = df.reset_index(names='result_time')
        df['result_time'] = pd.to_datetime(df['result_time'])
        df.set_index('result_time', inplace=True)
        df = df.between_time('03:00', '05:00').resample('D').mean().reset_index()
        df = df.dropna(subset=['Flow']).reset_index(drop=True)
        df['flow_diff'] = df['Flow'].diff()
        # remove flow < 0
        df = df[df['Flow'] >= 0].reset_index(drop=True)
        return df
    
    @staticmethod
    def _find_significant_drops(df, threshold=None):
        """Find indices where flow drops significantly."""
        diff = df['Flow'].diff()
        if threshold is None:
            threshold = diff.quantile(0.01)  # Default to 1st percentile
        return df[diff < threshold].index

    @staticmethod
    def _find_most_likely_leak(df):
        """Find the most likely leak report from candidates."""
        mask = ~((df["severity"] == "Low") | (df['severity'].isna()) & (df["repeated"] <= 0)) | (df["topic"] == "Αφανής διαρροή")
        df = df[mask].copy()

        severity_order = {"High": 0, "Med": 1, "Low": 2}
        topic_order = {"Αφανής διαρροή": 0}

        df["severity_sort"] = df["severity"].map(severity_order)
        df["topic_sort"] = df["topic"].map(lambda x: topic_order.get(x, 1))

        df_sorted = df.sort_values(
            by=["topic_sort", "severity_sort", "repeated"],
            ascending=[True, True, False]
        ).drop(columns=["severity_sort", "topic_sort"])

        if not df_sorted.empty:
            return df_sorted.iloc[0]
        return None

    def _compute_drops(self):
        """Compute validated drops by matching significant flow drops with leak reports."""
        drop_threshold = self.params.get('drop_threshold', None)
        min_day = self.params.get('drop_min_day', 4)
        max_day = self.params.get('drop_max_day', 3)

        df_drop = pd.DataFrame(columns=['timestamp', 'diff_value', 'topic', 'severity', 'repeated', 'reason', 'action'])

        index_drops = self._find_significant_drops(self.df_nightflow, threshold=drop_threshold)
        diff = self.df_nightflow['Flow'].diff()

        for idx in index_drops:
            drop_date = self.df_nightflow.loc[idx, 'result_time']

            close_reports = self.df_leaks[
                (pd.to_datetime(self.df_leaks['timestamp']).dt.date <= (drop_date + pd.Timedelta(days=max_day)).date()) &
                (pd.to_datetime(self.df_leaks['timestamp']).dt.date >= (drop_date - pd.Timedelta(days=min_day)).date())
            ]

            if close_reports.empty:
                continue

            likely_leak = self._find_most_likely_leak(close_reports)

            if likely_leak is not None:
                df_drop = pd.concat([df_drop, pd.DataFrame([{
                    'timestamp': pd.to_datetime(drop_date),
                    'diff_value': diff.loc[idx],
                    'topic': likely_leak['topic'],
                    'severity': likely_leak['severity'],
                    'repeated': likely_leak['repeated'],
                    'reason': likely_leak['reason'],
                    'action': likely_leak['action']
                }])], ignore_index=True)

        return df_drop

    @staticmethod
    def _prune_boundaries(boundaries, min_size):
        """
        Remove boundaries that create segments smaller than min_size.
        Args:
            boundaries (list): List of boundary indices.
            min_size (int): Minimum allowed segment size.
        """
        pruned = boundaries.copy()
        
        for i in range(1, len(boundaries) - 1):
            if boundaries[i + 1] - boundaries[i] < min_size:
                if boundaries[i] in pruned:
                    pruned.remove(boundaries[i])
        
        return pruned
    
    def detect_abrupt_leaks(self):
        SPIKE_THRESHOLD_PERCENTILE = self.params.get('spike_threshold_percentile', 97)
        MAX_SPIKE_DURATION = self.params.get('max_spike_duration', 14)

        self.leak_periods['abrupt'] = []
        
        for drop in self.df_drop['timestamp']:
            drop_dt = pd.to_datetime(drop)
            # Find the index in nightflow corresponding to the drop
            drop_idx_search = self.df_nightflow[self.df_nightflow['result_time'] >= drop_dt].index
            
            if len(drop_idx_search) == 0:
                continue
            
            d_idx = drop_idx_search[0]
            search_start = max(0, d_idx - MAX_SPIKE_DURATION)
            
            # Create lookback zone and calculate gradient (flow_diff)
            lookback_zone = self.df_nightflow.iloc[search_start:d_idx+1].copy()  
            lookback_zone['flow_diff'] = lookback_zone['Flow'].diff()

            # Calculate threshold based on positive gradients in this zone
            positive_diffs = lookback_zone[lookback_zone['flow_diff'] > 0]['flow_diff']
            if positive_diffs.empty:
                continue
                
            spike_threshold = positive_diffs.quantile(SPIKE_THRESHOLD_PERCENTILE / 100)
            spikes_in_zone = lookback_zone[lookback_zone['flow_diff'] > spike_threshold]
            
            if not spikes_in_zone.empty:
                # 1. Start with the index of the first detected spike
                s_idx = spikes_in_zone.index[0]
                leak_start = s_idx
                
                # 2. Walk backwards from the spike to include the full rising trend
                # We look at the flow_diff to see if the flow was already increasing
                current_idx = s_idx
                while current_idx > search_start:
                    # Check the gradient at the current point
                    # If the gradient is positive, it's part of the 'climb' to the spike
                    if lookback_zone.loc[current_idx, 'flow_diff'] > 0:
                        leak_start = current_idx - 1 # Move the start back
                        current_idx -= 1
                    else:
                        break # Stop once the gradient is zero or negative
                
                self.leak_periods['abrupt'].append((leak_start, d_idx))
        
        return self.leak_periods['abrupt']


    def _find_data_start(self, idx):
        """
        Given an index, walk backward to find where continuous data begins.
        Returns the index right after the last gap of missing values.
        If no gap is found, returns 0.
        """
        if idx <= 0:
            return 0

        times = self.df_nightflow['result_time'].iloc[:idx]
        if len(times) < 2:
            return 0

        time_diffs = times.diff()
        gap_mask = time_diffs > pd.Timedelta(days=2)
        gap_indices = times.index[gap_mask]

        if len(gap_indices) > 0:
            return gap_indices[-1]
        return 0
    
    def detect_sustained_leaks(self):
        # --- Parameters ---
        REF_WINDOW_SIZE = self.params.get('ref_window_size', 14)
        TEST_WINDOW_SIZE = self.params.get('test_window_size', 7)
        ALPHA = self.params.get('alpha', 0.05)
        PERSISTENCE = self.params.get('persistence', 5)
        MIN_SEGMENT_SIZE = self.params.get('min_segment_size', 5)
        MAX_LEAK_DURATION_DAYS = self.params.get('max_leak_duration_days', 30*12)
        STD_MUL = self.params.get('std', 0.5)

        self.leak_periods['sustained'] = []
        
        # Identify segment boundaries based on drops/interventions
        # We find the index in nightflow closest to the drop timestamp
        drop_indices = self.df_drop['timestamp'].apply(
            lambda d: self.df_nightflow[self.df_nightflow['result_time'] >= pd.to_datetime(d)].index.min()
        ).dropna().astype(int).tolist()
        
        # Create segments: [0, drop_1, drop_2, ..., end]
        boundaries = [0] + sorted(drop_indices) + [len(self.df_nightflow)]
        pruned_boundaries = self._prune_boundaries(boundaries, MIN_SEGMENT_SIZE)
        print("Pruned Boundaries:", pruned_boundaries)


        for i in range(len(pruned_boundaries) - 1):
            start_idx = self._find_data_start(pruned_boundaries[i+1])
            end_idx = pruned_boundaries[i + 1] 
          
            ref_end_limit = min(end_idx + REF_WINDOW_SIZE, len(self.df_nightflow))
            ref_window = self.df_nightflow.iloc[end_idx : ref_end_limit]['Flow'].values
            ref_window = np.array([x for x in ref_window if x > np.percentile(ref_window, 15) and x < np.percentile(ref_window, 85)])

            
            # Skip if reference window is too small or empty
            if len(ref_window) < 5:
                continue

            mu_ref = np.mean(ref_window)
            std_ref = np.std(ref_window)

            consecutive_passes = 0
            for t in range(end_idx, start_idx + TEST_WINDOW_SIZE, -1):
                
                # Define Test Window (The period immediately before 't')
                test_window = self.df_nightflow.iloc[t - TEST_WINDOW_SIZE : t]['Flow'].values
                
                if len(test_window) < TEST_WINDOW_SIZE:
                    continue

                mu_test = np.mean(test_window)
                std_test = np.std(test_window)

                # --- Statistical Comparison ---
                is_significantly_higher = False
                
                # Avoid T-test if variance is 0 (constant flow) to prevent NaNs
                if std_ref == 0 and std_test == 0:
                    is_significantly_higher = mu_test > mu_ref
                else:
                    # Perform T-test
                    try:
                        t_stat, p_val = stats.ttest_ind(test_window,  ref_window + STD_MUL * np.std(ref_window), alternative='less', equal_var=False)
                       

                        if not np.isnan(p_val) and (p_val > ALPHA) and (mu_test > mu_ref):
                            is_significantly_higher = True
                    except Exception as e:
                        # Fallback if t-test fails (e.g. extremely small numbers)
                        is_significantly_higher = mu_test > mu_ref * 1.1 # Simple threshold fallback

                # --- Detection Logic ---
                if is_significantly_higher:
                    consecutive_passes += 1
                else:
                    if consecutive_passes >= PERSISTENCE:
  
                        detected_start = t  
                        self.leak_periods['sustained'].append((detected_start, end_idx))
                        break # Stop looking for this segment once the start is found
                    
                    # If we haven't hit persistence yet, it was just noise; reset counter
                    consecutive_passes = 0
        
        for s, e in self.leak_periods['sustained']:
            if e - s > MAX_LEAK_DURATION_DAYS:
                self.leak_periods['sustained'].remove((s, e))
        return self.leak_periods['sustained']

    # def detect_sustained_leaks(self):
    #     # --- Parameters ---
    #     REF_WINDOW_SIZE = self.params.get('ref_window_size', 14)
    #     TEST_WINDOW_SIZE = self.params.get('test_window_size', 7)
    #     ALPHA = self.params.get('alpha', 0.05)
    #     PERSISTENCE = self.params.get('persistence', 5)
    #     MIN_SEGMENT_SIZE = self.params.get('min_segment_size', 5)
    #     MAX_LEAK_DURATION_DAYS = self.params.get('max_leak_duration_days', 30 * 12)

    #     self.leak_periods['sustained'] = []

    #     # Identify segment boundaries based on drops/interventions
    #     drop_indices = self.df_drop['timestamp'].apply(
    #         lambda d: self.df_nightflow[self.df_nightflow['result_time'] >= pd.to_datetime(d)].index.min()
    #     ).dropna().astype(int).tolist()

    #     # Create segments: [0, drop_1, drop_2, ..., end]
    #     boundaries = [0] + sorted(drop_indices) + [len(self.df_nightflow)]
    #     pruned_boundaries = self._prune_boundaries(boundaries, MIN_SEGMENT_SIZE)
    #     print("Pruned Boundaries:", pruned_boundaries)

    #     for i in range(len(pruned_boundaries) - 1):
    #         start_idx = 0
    #         end_idx = pruned_boundaries[i + 1]
    #         end_idx = min(end_idx, len(self.df_nightflow) - 1)
    #         segment = self.df_nightflow.iloc[start_idx:end_idx]

    #         # Need enough data for at least a reference window + test window
    #         if len(segment) < REF_WINDOW_SIZE + TEST_WINDOW_SIZE:
    #             continue

    #         # Reference window: the first REF_WINDOW_SIZE points of the segment
    #         # (represents the "normal" baseline before the leak)
    #         ref_window = segment['Flow'].iloc[:REF_WINDOW_SIZE].values
    #         mu_ref = np.mean(ref_window)

    #         # Cap the backward search based on MAX_LEAK_DURATION_DAYS
    #         max_steps_back = min(
    #             end_idx - start_idx - TEST_WINDOW_SIZE,
    #             MAX_LEAK_DURATION_DAYS
    #         )

    #         # Walk backward from the drop (end of segment) to find where the leak started
    #         consecutive_passes = 0
    #         detected_start = None

    #         for t in range(end_idx - 1, start_idx + REF_WINDOW_SIZE + TEST_WINDOW_SIZE - 1, -1):
    #             # Ensure we don't exceed max leak duration
    #             if (end_idx - t) > max_steps_back:
    #                 break

    #             # Build the test window ending at t
    #             tw_start = max(t - TEST_WINDOW_SIZE, start_idx)
    #             test_window = self.df_nightflow['Flow'].iloc[tw_start:t].values

    #             if len(test_window) < TEST_WINDOW_SIZE:
    #                 break

    #             # One-sample t-test: is the test window mean significantly greater than mu_ref?
    #             t_stat, p_val = stats.ttest_1samp(test_window, mu_ref, alternative='greater')

    #             is_significantly_higher = False
    #             if not np.isnan(p_val) and p_val < ALPHA:
    #                 is_significantly_higher = True

    #             if is_significantly_higher:
    #                 consecutive_passes += 1
    #             else:
    #                 # Flow is at or below reference level
    #                 if consecutive_passes >= PERSISTENCE:
    #                     detected_start = t
    #                     self.leak_periods['sustained'].append((detected_start, end_idx))
    #                     break
    #                 consecutive_passes = 0
    #         else:
    #             # Loop completed without break — check if we had an ongoing leak
    #             if consecutive_passes >= PERSISTENCE:
    #                 detected_start = start_idx + REF_WINDOW_SIZE + TEST_WINDOW_SIZE
    #                 self.leak_periods['sustained'].append((detected_start, end_idx))

    #     # Print detected periods
    #     for s, e in self.leak_periods['sustained']:
    #         start_date = self.df_nightflow.iloc[s]['result_time']
    #         end_date = self.df_nightflow.iloc[min(e, len(self.df_nightflow) - 1)]['result_time']
    #         print(f"Sustained leak detected: index [{s}, {e}] -> [{start_date}, {end_date}]")

    #     return self.leak_periods['sustained']

    def detect_sustained_leaks_with_window(self):
        # Window Parameters
        WINDOW_PENALTY = self.params.get('window_penalty', 50)
        WINDOW_MIN_SIZE = self.params.get('window_min_size', 30)
        WINDOW_WIDTH = self.params.get('window_width', 14)
        WINDOW_MODEL = self.params.get('window_model', 'l2')
        MAX_LEAK_DURATION_DAYS = self.params.get('max_leak_duration_days', 30*12)

        self.leak_periods['window'] = []
        
        # Identify segment boundaries based on drops/interventions
        drop_indices = self.df_drop['timestamp'].apply(
            lambda d: self.df_nightflow[self.df_nightflow['result_time'] >= pd.to_datetime(d)].index.min()
        ).dropna().astype(int).tolist()
        
        boundaries = [0] + sorted(drop_indices) + [len(self.df_nightflow)]
        pruned_boundaries = self._prune_boundaries(boundaries, WINDOW_MIN_SIZE)
        print("Window Pruned Boundaries:", pruned_boundaries)

        for i in range(len(pruned_boundaries) - 2):
            start_idx = pruned_boundaries[i]
            end_idx = pruned_boundaries[i + 1]
            segment = self.df_nightflow.iloc[start_idx:end_idx]
            signal = segment['Flow'].values.reshape(-1, 1)
            
            try:
                model = rpt.Window(model=WINDOW_MODEL, min_size=WINDOW_MIN_SIZE, width=WINDOW_WIDTH).fit(signal)
                changepoints = model.predict(pen=WINDOW_PENALTY, n_bkps=1)
                
                for cp in changepoints[:-1]:  # Exclude last point
                    mu_before = np.mean(signal[max(0, cp-10):cp])
                    mu_after = np.mean(signal[cp:min(len(signal), cp+10)])
                    
                    if mu_after > mu_before:
                        actual_start_idx = segment.index[cp]
                        actual_end_idx = segment.index[-1]
                        self.leak_periods['window'].append((actual_start_idx, actual_end_idx))
            
            except Exception as e:
                print(f"Window failed: {e}")
        
        for s, e in self.leak_periods['window']:
            if e - s > MAX_LEAK_DURATION_DAYS:
                self.leak_periods['window'].remove((s, e))
        
        return self.leak_periods['window']

    def visualize_leak_periods(self, verbose=False, save_path=None):
        '''
        Visualizes detected leak periods on the flow data.
        Shows individual method results and the unified 'all' selection.
        '''
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(30, 14), sharex=True)
        
        # TOP PLOT: Individual method results
        ax1.plot(self.df_nightflow['result_time'], self.df_nightflow['Flow'], 
                color='black', alpha=0.7, label='Flow', linewidth=1)
        
        # Plot individual method results (excluding 'all')
        colors = {'window': 'blue', 'abrupt': 'green', 'sustained': 'red'}
        for leak_type, periods in self.leak_periods.items():
            if leak_type == 'all':
                continue
            
            color = colors.get(leak_type, 'gray')
            for idx, (s, e) in enumerate(periods):
                s = min(s, len(self.df_nightflow) - 1)
                e = min(e, len(self.df_nightflow) - 1)
                ax1.axvspan(self.df_nightflow.loc[s, 'result_time'], 
                        self.df_nightflow.loc[e, 'result_time'], 
                        color=color, alpha=0.15)
                ax1.axvline(self.df_nightflow.loc[s, 'result_time'], 
                        color=color, linestyle='-', linewidth=1.5, alpha=0.6,
                        label=f'{leak_type.upper()}' if idx == 0 else "")
        
        # Mark known drops
        for idx, drop in enumerate(self.df_drop['timestamp'].values):
            ax1.axvline(pd.to_datetime(drop), color='darkred', linestyle='--', 
                    alpha=0.8, linewidth=2, label='Known Fix' if idx == 0 else "")
        
        ax1.set_ylabel('Flow')
        ax1.set_title('Individual Detection Methods')
        ax1.legend(loc='upper left')
        ax1.grid(True, alpha=0.3)
        
        # BOTTOM PLOT: Unified 'all' selection with priority
        ax2.plot(self.df_nightflow['result_time'], self.df_nightflow['Flow'], 
                color='black', alpha=0.7, label='Flow', linewidth=1)
        
        # Plot unified leak periods
        if 'all' in self.leak_periods:
            for idx, leak in enumerate(self.leak_periods['all']):
                s, e = leak['start_idx'], leak['end_idx']
                s = min(s, len(self.df_nightflow) - 1)
                e = min(e, len(self.df_nightflow) - 1)
                method = leak['method']
                candidates = leak['candidates']
                
                color = colors.get(method, 'gray')
                
                # Create label with method info
                if idx == 0:
                    label = f"Selected Leak (by {method.upper()})"
                else:
                    label = ""
                
                ax2.axvspan(self.df_nightflow.loc[s, 'result_time'], 
                        self.df_nightflow.loc[e, 'result_time'], 
                        color=color, alpha=0.3)
                ax2.axvline(self.df_nightflow.loc[s, 'result_time'], 
                        color=color, linestyle='-', linewidth=2,
                        label=label)
                
                # Annotate with method and candidates
                mid_time = self.df_nightflow.loc[s, 'result_time']
                mid_flow = self.df_nightflow.loc[s, 'Flow']
                candidates_str = '+'.join([c[0].upper() for c in candidates])
                ax2.annotate(f'{candidates_str}', 
                            xy=(mid_time, mid_flow),
                            xytext=(0, 10), textcoords='offset points',
                            fontsize=8, alpha=0.7, ha='center')
        
        # Mark known drops
        for idx, drop in enumerate(self.df_drop['timestamp'].values):
            ax2.axvline(pd.to_datetime(drop), color='darkred', linestyle='--', 
                    alpha=0.8, linewidth=2, label='Known Fix' if idx == 0 else "")
        
        ax2.set_xlabel('Date')
        ax2.set_ylabel('Flow')
        ax2.set_title('Unified Leak Detection (Priority: Window > Abrupt > Sustained)')
        ax2.legend(loc='upper left')
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        if save_path is not None:
            plt.savefig(save_path, dpi=300)
        else:
            plt.show()
        
        plt.close()

        if verbose:
            # Print summary
            if 'all' in self.leak_periods:
                print(f"\n{'='*80}")
                print(f"LEAK DETECTION SUMMARY")
                print(f"{'='*80}")
                for idx, leak in enumerate(self.leak_periods['all'], 1):
                    s_date = self.df_nightflow.loc[leak['start_idx'], 'result_time'].strftime('%Y-%m-%d')
                    e_date = self.df_nightflow.loc[leak['end_idx'], 'result_time'].strftime('%Y-%m-%d')
                    duration = leak['end_idx'] - leak['start_idx']
                    method = leak['method'].upper()
                    candidates = ', '.join([c.upper() for c in leak['candidates']])
                    
                    print(f"\nLeak #{idx}:")
                    print(f"  Period: {s_date} → {e_date} ({duration} days)")
                    print(f"  Selected Method: {method}")
                    print(f"  Detected By: {candidates}")   

    def detect_leaks(self):
        """
        Detect leaks using all methods and prioritize them per drop.
        Priority: Window < Abrupt < Sustained
        
        Exception: If abrupt and sustained detect the same leak and their start indices
        are within one TEST_WINDOW_SIZE apart, prefer abrupt.
        
        For each known drop/fix, we check which methods detected a leak ending at that drop,
        and select the one with highest priority.
        """
        # Run all detection methods
        abrupt = self.detect_abrupt_leaks()
        sustained = self.detect_sustained_leaks()
        window = self.detect_sustained_leaks_with_window()
        
        # Get TEST_WINDOW_SIZE for the proximity check
        TEST_WINDOW_SIZE = self.params.get('test_window_size', 7)
        
        # Initialize the unified leak periods list
        self.leak_periods['all'] = []
        
        # Get all known drops with their indices
        drop_info = []
        for drop_ts in self.df_drop['timestamp']:
            drop_dt = pd.to_datetime(drop_ts)
            drop_idx_search = self.df_nightflow[self.df_nightflow['result_time'] >= drop_dt].index
            if len(drop_idx_search) > 0:
                drop_info.append({
                    'timestamp': drop_dt,
                    'index': drop_idx_search[0]
                })
        
        # For each drop, find which methods detected it and apply priority
        for drop in drop_info:
            drop_idx = drop['index']
            candidates = []
            
            # Check Window (lowest priority)
            for start_idx, end_idx in window:
                if abs(end_idx - drop_idx) <= 7:
                    candidates.append({
                        'method': 'window',
                        'priority': 2,
                        'period': (start_idx, end_idx),
                        'distance': abs(end_idx - drop_idx)
                    })
            
            # Check Abrupt (medium priority)
            for start_idx, end_idx in abrupt:
                if abs(end_idx - drop_idx) <= 7:
                    candidates.append({
                        'method': 'abrupt',
                        'priority': 3,
                        'period': (start_idx, end_idx),
                        'distance': abs(end_idx - drop_idx)
                    })
            
            # Check Sustained (highest priority)
            for start_idx, end_idx in sustained:
                if abs(end_idx - drop_idx) <= 7:
                    candidates.append({
                        'method': 'sustained',
                        'priority': 1,
                        'period': (start_idx, end_idx),
                        'distance': abs(end_idx - drop_idx)
                    })
            
            # Special condition: If both abrupt and sustained detected this leak
            # and their start indices are within TEST_WINDOW_SIZE, prefer abrupt
            abrupt_candidates = [c for c in candidates if c['method'] == 'abrupt']
            sustained_candidates = [c for c in candidates if c['method'] == 'sustained']
            
            if abrupt_candidates and sustained_candidates:
                # Check if any abrupt start is within TEST_WINDOW_SIZE of any sustained start
                for ac in abrupt_candidates:
                    for sc in sustained_candidates:
                        abrupt_start = ac['period'][0]
                        sustained_start = sc['period'][0]
                        
                        if abs(abrupt_start - sustained_start) <= TEST_WINDOW_SIZE:
                            # Override: boost abrupt priority to be higher than sustained
                            ac['priority'] = 0  # Make it highest priority
            
            # Select the candidate with highest priority (lowest priority number)
            # If multiple with same priority, choose the one with smallest distance
            if candidates:
                candidates.sort(key=lambda x: (x['priority'], x['distance']))
                selected = candidates[0]
                
                # Add to unified list with metadata
                self.leak_periods['all'].append({
                    'start_idx': selected['period'][0],
                    'end_idx': selected['period'][1],
                    'method': selected['method'],
                    'drop_timestamp': drop['timestamp'],
                    'candidates': [c['method'] for c in candidates]
                })
        
        return self.leak_periods['all']

    def to_csv(self, filepath):
        """
        Export detected leak periods to a CSV file.
        Args:
            filepath (str): Path to save the CSV file.
        """
        if 'all' not in self.leak_periods:
            print("No unified leak periods detected. Run detect_leaks() first.")
            return
        
        df_results = self.df.copy()
        
        # Ensure result_time is a column, not the index
        if 'result_time' not in df_results.columns and isinstance(df_results.index, pd.DatetimeIndex):
            df_results = df_results.reset_index(names='result_time')
        
        df_results['Leak_Detected'] = False

        for leak in self.leak_periods['all']:
            s = min(leak['start_idx'], len(self.df_nightflow) - 1)
            e = min(leak['end_idx'], len(self.df_nightflow) - 1)
            s_date = self.df_nightflow.loc[s, 'result_time']
            e_date = self.df_nightflow.loc[e, 'result_time']

            mask = (df_results['result_time'] >= s_date) & (df_results['result_time'] <= e_date)
            df_results.loc[mask, 'Leak_Detected'] = True

        df_results.to_csv(filepath, index=False)