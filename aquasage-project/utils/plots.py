


def visualize_transitions(df, col='Flow', window_points=100, max_plots=5, min_gap_size=24):
    """
    Visualizes the transition periods between ground truth and interpolated data.
    
    Parameters:
    - df: DataFrame containing the data and a 'replaced' column.
    - col: Name of the column to plot.
    - window_points: Number of data points to show before and after the interpolated gap.
    - max_plots: Maximum number of gaps to visualize.
    - min_gap_size: Minimum number of points in a gap to be visualized.
    """
    if 'replaced' not in df.columns:
        print("Error: 'replaced' column not found in DataFrame.")
        return

    # Identify contiguous blocks of interpolated values
    is_replaced = df['replaced']
    if not is_replaced.any():
        print("No interpolated values found.")
        return

    # Create groups for contiguous regions
    groups = is_replaced.ne(is_replaced.shift()).cumsum()
    
    # Get unique group IDs for the replaced sections
    gap_groups = groups[is_replaced].unique()
    
    # Calculate sizes
    group_sizes = groups.value_counts()
    
    # Filter for large gaps
    large_gaps = [g for g in gap_groups if group_sizes[g] >= min_gap_size]
    
    print(f"Found {len(gap_groups)} interpolated gaps. ({len(large_gaps)} large gaps >= {min_gap_size})")
    
    for i, gap_id in enumerate(large_gaps):
        if i >= max_plots:
            print(f"Showing first {max_plots} large transitions only...")
            break
            
        # Get the indices for this gap
        gap_indices = groups[groups == gap_id].index
        start_time = gap_indices[0]
        end_time = gap_indices[-1]
        
        # Find integer locations for slicing
        try:
            start_iloc = df.index.get_loc(start_time)
            end_iloc = df.index.get_loc(end_time)
            
            # Define window
            p_start = max(0, start_iloc - window_points)
            p_end = min(len(df), end_iloc + window_points)
            
            subset = df.iloc[p_start:p_end]
            
            plt.figure(figsize=(20, 4))
            
            # Plot the whole subset line (background)
            plt.plot(subset.index, subset[col], color='gray', alpha=0.5, label='Context')
            
            # Plot Ground Truth (replaced == False)
            ground_truth = subset[~subset['replaced']]
            plt.scatter(ground_truth.index, ground_truth[col], color='blue', s=10, label='Known Values', alpha=0.7)
            
            # Plot Interpolated (replaced == True)
            interpolated = subset[subset['replaced']]
            plt.scatter(interpolated.index, interpolated[col], color='red', s=10, label='Interpolation (Linear + Seasonal)', zorder=5)
            
            # Add vertical lines for start/end
            plt.axvline(start_time, color='green', linestyle='--', alpha=0.7, label='Start Gap')
            plt.axvline(end_time, color='green', linestyle='--', alpha=0.7, label='End Gap')
            
            #plt.title(f"Gap {i+1} (Size: {group_sizes[gap_id]}): {start_time} to {end_time}")
            plt.xlabel('Time', fontsize=20)
            plt.ylabel(col, fontsize=20)
            #plt.legend()
            plt.grid(True, alpha=0.3)
            plt.show()
            
        except KeyError as e:
            print(f"Error plotting gap {i}: {e}")
            continue