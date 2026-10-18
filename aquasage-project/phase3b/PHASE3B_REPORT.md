# AquaSage — Phase 3B: Simulated Hydraulic Tank Forecasting & Exploratory Water Quality Report

**System**: AquaSage — AI-Powered Smart Water Management System (IBM Z Datathon 2026)  
**Modules**: 
1. Simulated Hydraulic Storage Tank Multi-Horizon Level Forecasting (+5, +15, +30 min)
2. Exploratory Water-Quality Anomaly Detection (`WQ Sampling Data-2024and2025.csv`)
**Phase**: 3B  
**Date**: October 16, 2026  

---

## 1. Focused Audit of Phase 3A Artifacts

Before initiating Phase 3B, an automated mathematical audit was executed via `scratch/audit_phase3a.py` against all Phase 3A artifacts:

1. **Five-Minute to Hourly Aggregation Verification**:
   - `df_5m.resample('h')` produced strictly uniform 1-hour steps (`Timedelta('0 days 01:00:00')`, zero gaps or skipped hours).
   - `seq_len = 24` with 1-hour steps mathematically represents exactly $24 \times 1\text{ hour} = 24\text{ hours}$ (one complete diurnal consumer demand cycle).
2. **Timestamp Alignment Verification**:
   - Tested samples across the sequence pipeline:
     - Sample 0: Input sequence $[y_0, \dots, y_{23}]$ spans `2024-06-03 00:00:00` to `2024-06-03 23:00:00` $\to$ Target $y_{24}$ corresponds to `2024-06-04 00:00:00`.
     - Sample 100: Input `2024-06-07 04:00:00` to `2024-06-08 03:00:00` $\to$ Target `2024-06-08 04:00:00`.
     - Sample 1000: Input `2024-07-14 16:00:00` to `2024-07-15 15:00:00` $\to$ Target `2024-07-15 16:00:00`.
   - Verified that input features end strictly at $t-1$ and targets occur at $t$. Zero future lookahead.
3. **Validation Threshold Calibration Verification**:
   - Verified that `val_df` contains **0 active leaks** (`sum(Leak_Detected) == 0`).
   - The alert threshold $\tau = 2.3765$ was derived solely from the 99th percentile of `val_scores`, completely independent of test data.
4. **Reproduction of Confusion Matrix & Performance Metrics**:
   - Re-running the saved checkpoint (`phase3a/models/lstm_predictor.pth`) reproduced the exact confusion matrix:
     $$\mathbf{TP = 2,774}, \quad \mathbf{FP = 345}, \quad \mathbf{FN = 517}, \quad \mathbf{TN = 2,772} \quad (\text{Total} = 6,408)$$
     $$\text{Precision} = \mathbf{0.8894}, \quad \text{Recall} = \mathbf{0.8429}, \quad F_1 = \mathbf{0.8655}, \quad \text{FAR} = \mathbf{0.1107}$$
- **Audit Verdict**: **PASS (100% verified and reproducible).**

---

## 2. Module 1: Simulated Hydraulic Storage Tank Level Forecasting

> [!IMPORTANT]
> **SIMULATION DISCLOSURE**: The KIOS dataset provides DMA inlet flow telemetry, not reservoir water level readings. All tank levels, volumes, and pumping rates produced in this module are generated from a calibrated physical hydraulic simulation. They are explicitly tagged as **`[SIMULATED DATA]`** and must not be presented as physical sensor measurements.

### 2.1 Physical Specifications & Mass-Balance Formulation
- **Tank Geometry**: Cylindrical elevated municipal storage reservoir.
  - Cross-sectional Area: $A_{\text{tank}} = 50.0\text{ m}^2$ (diameter $\approx 8.0\text{ m}$).
  - Maximum Physical Height: $H_{\max} = 10.0\text{ meters}$.
  - Minimum Operating Buffer: $H_{\min} = 1.0\text{ meter}$.
  - Total Storage Capacity: $V_{\max} = 500.0\text{ m}^3$ ($500,000\text{ liters}$).
  - Initial Level: $H_0 = 6.0\text{ meters}$ ($300\text{ m}^3$ stored).
- **Time Step**: $\Delta t = 5\text{ minutes} = \frac{1}{12}\text{ hour}$.
- **Mass Conservation Law**:
  $$\frac{dV(t)}{dt} = Q_{\text{in}}(t) - Q_{\text{out}}(t) \implies H_{t+1} = H_t + \frac{\Delta t}{A_{\text{tank}}} \left( Q_{\text{in}}(t) - Q_{\text{out}}(t) \right)$$
- **Flow Inflow & Outflow Dynamics**:
  - **Outflow ($Q_{\text{out}}$)**: Driven directly by real Area 1 5-minute consumer demand flow ($0$ to $70\text{ m}^3/\text{h}$, median $\approx 36\text{ m}^3/\text{h}$).
  - **Inflow ($Q_{\text{in}}$)**: Supplied by variable-rate supply pump station with closed-loop level control:
    - If level $H < 4.5\text{ m}$ (low buffer trigger): $Q_{\text{in}} = 52.0\text{ m}^3/\text{h}$ (high refill rate).
    - If level $H > 8.0\text{ m}$ (high limit trigger): $Q_{\text{in}} = 26.0\text{ m}^3/\text{h}$ (throttled rate).
- **Sensor Noise Model**:
  $$y_t^{\text{sensor}} = H_t + \epsilon_t, \quad \epsilon_t \sim \mathcal{N}(0, \sigma_{\text{sensor}}^2), \quad \sigma_{\text{sensor}} = 0.05\text{ meters (5 cm)}$$

### 2.2 Multi-Horizon Forecasting Evaluation (Test Split)
Evaluated on the held-out test split ($66,356$ sequential 5-minute steps; July 10, 2024 to February 25, 2025):

| Horizon | Prediction Steps | Model | MAE (meters) | RMSE (meters) | MAPE (%) | Ranking |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| **+5 min** | $h = 1$ step | **Hydraulic AR Forecaster** | **0.0481** | **0.0615** | **1.55%** | **1st (Best)** |
| | | Persistence Baseline | 0.0600 | 0.0753 | 1.51% | 2nd |
| | | Linear Drift Extrapolation | 0.0985 | 0.1235 | 2.53% | 3rd |
| **+15 min** | $h = 3$ steps | **Hydraulic AR Forecaster** | **0.0527** | **0.0697** | **1.91%** | **1st (Best)** |
| | | Persistence Baseline | 0.0827 | 0.1025 | 1.89% | 2nd |
| | | Linear Drift Extrapolation | 0.2044 | 0.2565 | 5.26% | 3rd |
| **+30 min** | $h = 6$ steps | **Hydraulic AR Forecaster** | **0.0611** | **0.0853** | **2.38%** | **1st (Best)** |
| | | Persistence Baseline | 0.1336 | 0.1636 | 2.72% | 2nd |
| | | Linear Drift Extrapolation | 0.3723 | 0.4670 | 9.55% | 3rd |

### 2.3 Diagnostic Insights
1. **Horizon Degradation**: As lookahead extends from 5 min to 30 min, Persistence error more than doubles (from $0.060\text{ m}$ to $0.134\text{ m}$). Linear drift error explodes to $0.372\text{ m}$ due to measurement noise amplification ($h \cdot \Delta y$).
2. **Physical Advantage of Hydraulic AR**: The Hydraulic Autoregressive model incorporates recent net flow $(Q_{\text{in}} - Q_{\text{out}})$ and lookback level velocity, maintaining low error ($0.061\text{ m}$) even at the 30-minute horizon.

---

## 3. Module 2: Exploratory Water-Quality Anomaly Detection

> [!CAUTION]
> **SCIENTIFIC HONESTY DISCLAIMER**: The dataset `WQ Sampling Data-2024and2025.csv` contains only **29 valid grab samples** across 9 field stations. This small sample size is suitable only for exploratory anomaly screening and pipeline prototyping. **It CANNOT and DOES NOT statistically validate biological potable safety or guarantee regulatory compliance.**

### 3.1 Data Cleaning, Sanitization & Missingness Analysis
- **Encoding Fix**: The raw file was encoded in Latin-1 (`cp1252`) due to special characters (`°C`, `µS/cm`). Decoded with `encoding='latin1'`.
- **Merged Date Handling**: Forward-filled date cells across grouped multi-station sampling days.
- **Uncollected Sample Isolated**: Row 22 (Station FFX 2 on 3/11/2025) contained text: `"Water level is too low to collect sample"`. Correctly segregated as an uncollected sampling failure rather than corrupting numeric metrics.
- **Parameter Missingness**:
  - `temperature_c`: 29/29 valid (0.0% missing, Range: $5.85 - 26.70^\circ\text{C}$).
  - `turbidity_ntu`: 29/29 valid (0.0% missing, Range: $4.00 - 35.40\text{ NTU}$).
  - `conductivity_us_cm`: 29/29 valid (0.0% missing, Range: $151.7 - 1,736.3\text{ µS/cm}$).
  - `ph`: 29/29 valid (0.0% missing, Range: $5.01 - 8.10$).
  - `dissolved_oxygen_mg_l`: 29/29 valid (0.0% missing, Range: $1.67 - 11.40\text{ mg/L}$).
  - `tds_mg_l` & `salinity_ppt`: 17/29 valid (**41.4% missing** — completely unmeasured for all 2025 samples).

### 3.2 Potable Regulatory Standards & Violation Screening
Compared against WHO and EPA drinking water guidelines:
- **pH Standard ($6.5 \le \text{pH} \le 8.5$)**: 
  - Violations: Highly acidic surface runoff detected at station FFX 14 on 8/2/2024 ($\text{pH} = 5.015$) and FFX 12 ($\text{pH} = 5.350$).
- **Turbidity Standard ($< 5.0\text{ NTU}$)**:
  - Severe Violations: Mean turbidity across all samples was $18.81\text{ NTU}$ (max $35.40\text{ NTU}$). **27 of 29 samples exceeded the 5.0 NTU WHO limit**, indicating severe particulate suspension.
- **Dissolved Oxygen (DO Target $> 5.0\text{ mg/L}$)**:
  - Hypoxia / Stagnation: In March 2025, DO dropped below $2.0\text{ mg/L}$ across multiple stations (minimum $1.67\text{ mg/L}$ at FFX 9), indicating potential stagnant water or microbial activity.
- **Conductivity Standard ($< 1,000\text{ µS/cm}$)**:
  - Violation: Station FFX 13 on 3/11/2025 spiked to **$1,736.3\text{ µS/cm}$** (flagged as a `Critical` water quality alert).

### 3.3 Alert Distribution (Conservative Multi-Parameter Model)
- **Normal**: 0 samples (due to widespread turbidity non-compliance).
- **Advisory**: 3 samples (1 regulatory violation).
- **Elevated**: 25 samples (2 to 3 regulatory violations).
- **Critical**: 1 sample (Station FFX 13 on 3/11/2025: extreme conductivity $1,736\text{ µS/cm}$, turbidity $27.5\text{ NTU}$, hypoxic $\text{DO} = 1.77\text{ mg/L}$).

---

## 4. Deliverables Checklist for Phase 3B

| Artifact | Path | Description |
| :--- | :--- | :--- |
| **Tank Simulation Script** | `phase3b/tank_simulation.py` | Physical mass-balance simulator with closed-loop pump control and sensor noise. |
| **Tank Forecasting Script** | `phase3b/forecast_tank_level.py` | Multi-horizon (+5m, +15m, +30m) forecasting pipeline with Persistence, Drift, and AR Ridge. |
| **Simulated Level Dataset** | `phase3b/data/simulated_tank_level_area1.csv` | 331,776 5-minute simulated tank levels and volume records. |
| **Tank Forecast Metrics** | `phase3b/metrics/tank_forecasting_metrics.json` | MAE, RMSE, MAPE across all models and horizons. |
| **Tank Level Visualizations** | `phase3b/plots/tank_level_simulation_and_forecast.png` | 24-hour simulation slice with multi-horizon forecast overlays. |
| **Forecast Error Barplot** | `phase3b/plots/tank_forecast_errors_by_horizon.png` | MAE comparison across +5m, +15m, and +30m. |
| **Water Quality Script** | `phase3b/water_quality_analysis.py` | Latin-1 cleaning, missingness analysis, regulatory audit, and Isolation Forest scoring. |
| **Cleaned WQ Dataset** | `phase3b/data/cleaned_water_quality.csv` | Sanitized 29-sample dataset with numeric conversions and dates. |
| **WQ Metrics Summary** | `phase3b/metrics/water_quality_summary.json` | Parameter distributions, missingness rates, and alert breakdown. |
| **WQ Diagnostic Plot** | `phase3b/plots/water_quality_parameters_and_anomalies.png` | pH vs Turbidity, Conductivity vs DO, and alert level distribution. |
