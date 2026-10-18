"""
Phase 3B: Exploratory Water-Quality Anomaly Detection Module.
Inspects, cleans, profiles, and evaluates grab-sample water quality parameters:
pH, Turbidity, Conductivity, Dissolved Oxygen (DO), TDS, Salinity, Temperature.

CRITICAL NOTICE: WITH ONLY 29 VALID GRAB SAMPLES, THIS MODULE PROVIDES
CONSERVATIVE EXPLORATORY SCREENING ONLY. IT DOES NOT VALIDATE DRINKING WATER SAFETY.
"""

import os
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
from sklearn.covariance import EllipticEnvelope


def clean_water_quality_data(
    raw_csv_path: str = "WQ Dataset/WQ Sampling Data-2024and2025.csv",
    output_cleaned_path: str = "phase3b/data/cleaned_water_quality.csv"
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Clean and sanitize raw water quality sampling data:
    1. Parse with latin1 encoding to handle special characters (°C, µS/cm).
    2. Drop empty trailing columns.
    3. Forward-fill merged date rows.
    4. Detect and isolate text remarks (e.g. uncollected samples due to low water).
    5. Convert measurement values to standard numeric types.
    """
    os.makedirs(os.path.dirname(output_cleaned_path), exist_ok=True)
    df_raw = pd.read_csv(raw_csv_path, encoding='latin1')

    # Drop empty un-named columns
    drop_cols = [c for c in df_raw.columns if 'Unnamed' in c]
    df = df_raw.drop(columns=drop_cols).copy()

    # Standardize column names
    col_map = {
        'Date': 'date',
        'Station': 'station',
        df.columns[2]: 'temperature_c',
        df.columns[3]: 'turbidity_ntu',
        df.columns[4]: 'conductivity_us_cm',
        'pH': 'ph',
        'DO (mg/L)': 'dissolved_oxygen_mg_l',
        'TDS (mg/L)': 'tds_mg_l',
        'Salinity': 'salinity_ppt'
    }
    df.rename(columns=col_map, inplace=True)

    # Forward-fill date
    df['date'] = df['date'].ffill()

    # Isolate non-numeric remarks
    is_remark = df['temperature_c'].astype(str).str.contains('[a-zA-Z]', regex=True)
    uncollected_df = df[is_remark].copy()
    valid_df = df[~is_remark].copy()

    # Convert numeric columns
    numeric_cols = ['temperature_c', 'turbidity_ntu', 'conductivity_us_cm', 'ph', 'dissolved_oxygen_mg_l', 'tds_mg_l', 'salinity_ppt']
    for col in numeric_cols:
        valid_df[col] = pd.to_numeric(valid_df[col], errors='coerce')

    valid_df['date'] = pd.to_datetime(valid_df['date'])
    valid_df = valid_df.sort_values(['date', 'station']).reset_index(drop=True)

    valid_df.to_csv(output_cleaned_path, index=False)
    print(f"Cleaned WQ dataset: {len(valid_df)} valid samples, {len(uncollected_df)} uncollected remarks.")
    return valid_df, uncollected_df


def run_water_quality_analysis(
    raw_csv_path: str = "WQ Dataset/WQ Sampling Data-2024and2025.csv",
    output_metrics_dir: str = "phase3b/metrics",
    output_plots_dir: str = "phase3b/plots"
):
    os.makedirs(output_metrics_dir, exist_ok=True)
    os.makedirs(output_plots_dir, exist_ok=True)

    df, uncollected = clean_water_quality_data(raw_csv_path)

    # 1. Missingness & Profiling
    numeric_cols = ['temperature_c', 'turbidity_ntu', 'conductivity_us_cm', 'ph', 'dissolved_oxygen_mg_l', 'tds_mg_l', 'salinity_ppt']
    profiling = {}
    for c in numeric_cols:
        s = df[c]
        profiling[c] = {
            'count_valid': int(s.count()),
            'count_missing': int(s.isna().sum()),
            'missing_percent': round(float(s.isna().mean() * 100.0), 1),
            'mean': round(float(s.mean()), 2) if s.count() > 0 else None,
            'std': round(float(s.std()), 2) if s.count() > 0 else None,
            'min': round(float(s.min()), 2) if s.count() > 0 else None,
            'median': round(float(s.median()), 2) if s.count() > 0 else None,
            'max': round(float(s.max()), 2) if s.count() > 0 else None
        }

    print("\n=== WATER QUALITY PARAMETER PROFILES & MISSINGNESS ===")
    for k, v in profiling.items():
        print(f"  {k:22s} | Valid: {v['count_valid']}/{len(df)} (Missing {v['missing_percent']}%) | Min: {v['min']}, Median: {v['median']}, Max: {v['max']}")

    # 2. Potable Water Regulatory Safety Guideline Checks (WHO / EPA Standards)
    # References:
    # - pH: 6.5 to 8.5
    # - Turbidity: < 5.0 NTU (acceptable for drinking), ideally < 1.0 NTU
    # - Dissolved Oxygen: Healthy > 5.0 mg/L; Hypoxic / stagnant < 2.0 mg/L
    # - Conductivity: < 1000 µS/cm (potable municipal distribution)
    # - TDS: < 500 mg/L (EPA secondary aesthetic standard)
    df['ph_violation'] = (df['ph'] < 6.5) | (df['ph'] > 8.5)
    df['turbidity_violation'] = df['turbidity_ntu'] > 5.0
    df['do_violation'] = df['dissolved_oxygen_mg_l'] < 5.0
    df['conductivity_violation'] = df['conductivity_us_cm'] > 1000.0

    df['total_regulatory_violations'] = (
        df['ph_violation'].astype(int) +
        df['turbidity_violation'].astype(int) +
        df['do_violation'].astype(int) +
        df['conductivity_violation'].astype(int)
    )

    # 3. Conservative Multivariate Anomaly Detection
    # Using 5 core parameters present across all 29 rows
    core_cols = ['temperature_c', 'turbidity_ntu', 'conductivity_us_cm', 'ph', 'dissolved_oxygen_mg_l']
    X_core = df[core_cols].values

    # Standardize with Robust Quantile / Median scaling
    med = np.median(X_core, axis=0)
    iqr = np.subtract(*np.percentile(X_core, [75, 25], axis=0))
    iqr = np.where(iqr == 0, 1.0, iqr)
    X_scaled = (X_core - med) / iqr

    # Isolation Forest for conservative multi-attribute outlier scoring
    # Set conservative contamination = 0.15 (flags top 15% most unusual multi-parameter signatures)
    iso = IsolationForest(contamination=0.15, random_state=42)
    iso.fit(X_scaled)
    df['iforest_anomaly_score'] = -iso.score_samples(X_scaled)
    df['is_multivariate_anomaly'] = (iso.predict(X_scaled) == -1)

    # Flag combined alerts
    df['alert_level'] = 'Normal'
    df.loc[df['total_regulatory_violations'] >= 1, 'alert_level'] = 'Advisory'
    df.loc[(df['total_regulatory_violations'] >= 2) | df['is_multivariate_anomaly'], 'alert_level'] = 'Elevated'
    df.loc[(df['total_regulatory_violations'] >= 3) & df['is_multivariate_anomaly'], 'alert_level'] = 'Critical'

    print("\n=== WATER QUALITY ALERT LEVEL DISTRIBUTION ===")
    print(df['alert_level'].value_counts())

    print("\n=== TOP FLAGGED WATER QUALITY SAMPLES ===")
    alert_df = df[df['alert_level'] != 'Normal'][['date', 'station', 'ph', 'turbidity_ntu', 'conductivity_us_cm', 'dissolved_oxygen_mg_l', 'total_regulatory_violations', 'alert_level']].sort_values('total_regulatory_violations', ascending=False)
    print(alert_df.to_string(index=False))

    # Save summary metrics JSON
    summary_payload = {
        'dataset': 'WQ Sampling Data-2024and2025.csv',
        'total_samples_analyzed': len(df),
        'uncollected_samples_isolated': len(uncollected),
        'uncollected_details': uncollected.to_dict(orient='records'),
        'parameter_profiling': profiling,
        'regulatory_standards_applied': {
            'ph_acceptable_range': [6.5, 8.5],
            'turbidity_max_ntu': 5.0,
            'dissolved_oxygen_min_mg_l': 5.0,
            'conductivity_max_us_cm': 1000.0
        },
        'alert_summary': {
            'normal_count': int((df['alert_level'] == 'Normal').sum()),
            'advisory_count': int((df['alert_level'] == 'Advisory').sum()),
            'elevated_count': int((df['alert_level'] == 'Elevated').sum()),
            'critical_count': int((df['alert_level'] == 'Critical').sum())
        },
        'scientific_disclaimer': 'Small dataset of N=29 samples across 9 stations. Strictly exploratory for sensor anomaly prototyping; does NOT certify potable safety.'
    }

    metrics_path = os.path.join(output_metrics_dir, "water_quality_summary.json")
    with open(metrics_path, "w") as f:
        json.dump(summary_payload, f, indent=2)
    print(f"Saved WQ summary metrics to {metrics_path}")

    # 4. Generate Diagnostic Visualization Plot
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # Plot 1: pH vs Turbidity with regulatory thresholds
    ax = axes[0, 0]
    scatter = ax.scatter(df['ph'], df['turbidity_ntu'], c=df['iforest_anomaly_score'], cmap='viridis', s=60, edgecolors='black', alpha=0.8)
    ax.axvline(6.5, color='red', linestyle='--', alpha=0.7, label='pH Minimum (6.5)')
    ax.axvline(8.5, color='red', linestyle='--', alpha=0.7, label='pH Maximum (8.5)')
    ax.axhline(5.0, color='orange', linestyle='--', alpha=0.7, label='Turbidity WHO Guideline (5 NTU)')
    ax.set_xlabel('pH')
    ax.set_ylabel('Turbidity (NTU)')
    ax.set_title('pH vs Turbidity (Color = Isolation Forest Score)')
    ax.grid(True, alpha=0.3)
    ax.legend(loc='upper right', fontsize=8)
    plt.colorbar(scatter, ax=ax, label='Anomaly Score')

    # Plot 2: Conductivity vs Dissolved Oxygen
    ax = axes[0, 1]
    scatter2 = ax.scatter(df['conductivity_us_cm'], df['dissolved_oxygen_mg_l'], c=df['iforest_anomaly_score'], cmap='plasma', s=60, edgecolors='black', alpha=0.8)
    ax.axvline(1000.0, color='red', linestyle='--', alpha=0.7, label='Conductivity Limit (1000 µS/cm)')
    ax.axhline(5.0, color='green', linestyle='--', alpha=0.7, label='DO Target (5.0 mg/L)')
    ax.axhline(2.0, color='red', linestyle='--', alpha=0.7, label='DO Hypoxia Limit (2.0 mg/L)')
    ax.set_xlabel('Conductivity (µS/cm)')
    ax.set_ylabel('Dissolved Oxygen (mg/L)')
    ax.set_title('Conductivity vs DO (Color = Isolation Forest Score)')
    ax.grid(True, alpha=0.3)
    ax.legend(loc='upper right', fontsize=8)
    plt.colorbar(scatter2, ax=ax, label='Anomaly Score')

    # Plot 3: Alert Levels Breakdown Bar Chart
    ax = axes[1, 0]
    alert_counts = df['alert_level'].value_counts().reindex(['Normal', 'Advisory', 'Elevated', 'Critical']).fillna(0)
    colors = ['green', 'gold', 'orange', 'red']
    ax.bar(alert_counts.index, alert_counts.values, color=colors, edgecolor='black', alpha=0.85)
    ax.set_ylabel('Sample Count')
    ax.set_title('Water Quality Alert Distribution (N=29 Grab Samples)')
    for i, v in enumerate(alert_counts.values):
        ax.text(i, v + 0.3, str(int(v)), ha='center', fontweight='bold')
    ax.grid(True, alpha=0.3, axis='y')

    # Plot 4: Parameter Boxplot (Standardized)
    ax = axes[1, 1]
    param_labels = ['Temp (°C)', 'Turb (NTU)', 'Cond (µS/cm)', 'pH', 'DO (mg/L)']
    box = ax.boxplot(X_core, patch_artist=True)
    ax.set_xticks(range(1, len(param_labels) + 1))
    ax.set_xticklabels(param_labels)
    for patch in box['boxes']:
        patch.set_facecolor('lightblue')
    ax.set_yscale('log')
    ax.set_ylabel('Measured Value (Log Scale)')
    ax.set_title('Parameter Distributions Across Field Stations')
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    p_path = os.path.join(output_plots_dir, "water_quality_parameters_and_anomalies.png")
    plt.savefig(p_path, dpi=200)
    plt.close()

    # Copy plot to artifact directory
    artifact_dir = r"C:\Users\Lokesh U\.gemini\antigravity-ide\brain\58bcc980-bde9-413f-b26f-2977ccccd3da"
    if os.path.exists(artifact_dir):
        import shutil
        shutil.copy(p_path, os.path.join(artifact_dir, os.path.basename(p_path)))
        print(f"Copied WQ plot to {artifact_dir}")

    return df, summary_payload


if __name__ == '__main__':
    run_water_quality_analysis()
