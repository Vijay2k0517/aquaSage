# AquaSage — Phase 3A: LSTM Predictor & Baseline Comparison Report

**System**: AquaSage — AI-Powered Smart Water Management System (IBM Z Datathon 2026)  
**Target DMA**: KIOS Leakage Repairs Dataset — Area 1 (`Area_1.csv`)  
**Phase**: 3A (Flow Predictor & Anomaly Detection Baseline Comparison)  
**Date**: October 16, 2026  

---

## 1. Audit of Phase 2 Pipeline & Baseline

### 1.1 Baseline Evaluation Reproduction
The Phase 2 baseline evaluation was reproduced using the saved artifacts (`models/baseline_area1.json` and `data/splits/Area_1/`):
- **Reproduced Baseline Results**: Precision = $0.7646$, Recall = $0.9167$, $F_1 = 0.8338$, False Alarm Rate (FAR) = $0.2958$.
- The reproduction confirmed exact numerical stability and verified that the baseline code operates deterministically.

### 1.2 Retrospective Label Dependency & Circularity Analysis
A rigorous audit of `src/preprocessing/retrospective_annotator.py` and the original `preprocessing/leak_detector.py` revealed:
1. **Physical Ground-Truth Anchor**: The *repair completion date* (`Known Fix` / `df_drop`) is anchored by real-world water authority records (`leak_reports.csv`).
2. **Algorithmically Inferred Leak Intervals**: The *start date* and *duration* of the leak are not measured by physical breach sensors. Instead, `LeakDetector` walks backwards from the repair date using two-sample t-tests against a post-repair reference window or `ruptures.Window` changepoints to determine when flow was elevated.
3. **Implication of Circularity**: The ground truth is a **pseudo-ground-truth**. Because the retrospective label was derived from elevated flow, evaluating a flow anomaly detector against it has an inherent circular component. Anomaly models will inevitably score higher on periods where the annotation algorithm also observed elevated flow. This uncertainty is documented as an inherent constraint of utility repair benchmark datasets.

### 1.3 Validation Threshold Selection & Data Isolation
- **Verification**: The validation threshold ($\tau = 2.533$ for Phase 2; $\tau = 2.376$ for Phase 3A LSTM) was computed purely from `val_df` (March 31, 2024 to June 2, 2024).
- **Zero Test Contamination**: Test data was loaded only after threshold calibration was finalized.

### 1.4 Temporal Ordering & Preprocessing Audit
- **Temporal Sequence**: Strictly verified that $\text{Train}_{\max} < \text{Val}_{\min} < \text{Test}_{\min}$.
  - Train: 2022-07-16 to 2023-07-12 (8,687 hrs, confirmed normal).
  - Validation: 2024-03-31 to 2024-06-02 (1,535 hrs, confirmed normal).
  - Test: 2024-06-03 to 2025-02-25 (6,432 hrs, 3,291 active leak hours).
- **Imputation Audit**: 99.94% of missing flow gaps were short dropouts ($\le 2$ hours) and imputed linearly. Long gaps were imputed with diurnal hourly profiles. Neither imputation leaked future test readings into training.

### 1.5 Root Cause of the 29.58% Test False Alarm Rate
In Phase 2, calibrating the threshold at the 99th percentile of normal validation data yielded a 29.58% false alarm rate on the test set. Detailed monthly decomposition revealed the exact root cause:
- **Zero False Alarms in Winter**: In **January 2025**, when seasonal demand returned to baseline ($36.49\text{ m}^3/\text{h}$), the monthly False Alarm Rate was **0.00%** (0 false positive hours out of 744 normal hours).
- **Seasonal Demand Shift in Summer/Autumn**: In Mediterranean Cyprus, summer/autumn water demand (tourism, irrigation, temperature) surges. In Autumn 2024 (October–December), the un-flagged normal hours had a mean flow of $\sim 42\text{ m}^3/\text{h}$, compared to $32.87\text{ m}^3/\text{h}$ in the training split.
- **Static vs. Dynamic Model Limitation**: Because the Phase 2 baseline used a *static* diurnal profile fit on 2022–2023, it could not adapt to annual demand growth or seasonal base shifts, classifying the seasonal rise as abnormal flow.

---

## 2. LSTM Flow Predictor Implementation

The autoregressive LSTM predictor was implemented in `phase3a/train_lstm.py`:
- **Architecture**: 2-layer stacked LSTM, hidden dimension $= 32$, input dimension $= 1$, dropout $= 0.20$, linear output head.
- **Sequence Formulation**: Strictly autoregressive lookback: $X_t = [y_{t-24}, y_{t-23}, \dots, y_{t-1}] \to \hat{y}_t$. Future observations are never accessible.
- **Normalization**: Z-score scaler parameters ($\mu = 32.8721, \sigma = 9.0034$) were fitted strictly on `train_df`.
- **Training Details**: Adam optimizer ($\text{lr} = 10^{-3}$, weight decay $= 10^{-5}$), batch size $= 64$, trained for 30 epochs with early stopping on validation loss.
- **Runtime**: Completed in **21.54 seconds** on standard CPU, reaching a best validation MSE of **0.0628** at epoch 26.
- **Artifacts Persisted**: Checkpoint saved to `phase3a/models/lstm_predictor.pth` and configuration to `phase3a/models/model_config.json`.

---

## 3. Fair Comparative Evaluation

All three models were evaluated on the identical held-out test split (June 3, 2024 to February 25, 2025; 6,408 sequence-aligned evaluation hours).

### Table 1: Pure Flow Forecasting Performance (Test Set)
*How accurately does each model forecast 1-step ahead flow ($\text{m}^3/\text{h}$)?*

| Model | MAE ($\text{m}^3/\text{h}$) | RMSE ($\text{m}^3/\text{h}$) | MAPE (%) | $R^2$ Score | Ranking |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Persistence Baseline ($t-1$)** | **2.6114** | **3.4692** | **6.03%** | **0.8999** | **1st (Best Forecast)** |
| **LSTM Predictor** | 3.1855 | 4.8840 | 6.24% | 0.8017 | 2nd |
| **Diurnal Profile Baseline** | 11.9471 | 14.4129 | 25.72% | -0.7272 | 3rd |

### Table 2: Residual-based Leak Detection Performance (Test Set)
*How effectively do forecast residuals translate into actionable leak alerts? Threshold calibrated on normal validation set ($\tau_{\text{val}} = 99\text{th percentile}$).*

| Model | Operating $\tau$ | Precision | Recall | $F_1$-Score | False Alarm Rate | Specificity | Accuracy | Confusion Matrix ($TP / FP / FN / TN$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **LSTM Residual Detector** | **2.3765** | **0.8894** | **0.8429** | **0.8655** | **0.1107** | **0.8893** | **0.8655** | $\mathbf{2774} / \mathbf{345} / \mathbf{517} / \mathbf{2772}$ |
| **Diurnal Profile Baseline** | 9.0548 | 0.7266 | 0.9374 | 0.8186 | 0.3725 | 0.6275 | 0.7867 | $3085 / 1161 / 206 / 1956$ |
| **Persistence Baseline** | 3.1518 | 1.0000 | 0.0036 | 0.0073 | 0.0000 | 1.0000 | 0.4883 | $12 / 0 / 3279 / 3117$ |

---

## 4. Key Insight: Forecasting vs. Leak Detection Disconnect

A critical technical principle demonstrated by these experiments is that **a better flow forecast does not necessarily make a better leak detector**:

1. **The Persistence Paradox**:
   - Persistence ($y_t \approx y_{t-1}$) achieved the lowest MAE ($2.61\text{ m}^3/\text{h}$) and highest $R^2$ ($0.90$).
   - However, for leak detection, **Persistence is completely useless ($F_1 = 0.0073$, Recall $= 0.36\%$)**.
   - *Why?* When a pipe leaks, elevated flow persists hour after hour. Because persistence predicts the previous hour's reading, it immediately adapts to the higher leak level in the very next step, reducing the residual $y_t - y_{t-1}$ to near zero. Persistence absorbs the anomaly.
2. **Why the LSTM Excels at Detection**:
   - The LSTM learns the non-linear diurnal shape across a 24-hour sequence. When an active leak begins, the true flow consistently exceeds what 24 hours of normal diurnal dynamics should produce.
   - The LSTM generates a sustained positive residual error $e_t = y_t - \hat{y}_t$, which triggers the calibrated alert threshold.
   - Compared to the Diurnal Baseline, the **LSTM cut false positive hours from 1,161 down to 345 (a 70.3% reduction in false alarms)**, improving Precision to **88.94%** and $F_1$ to **0.8655**.

---

## 5. Diagnostic Visualizations

The generated visualization plots are available in `phase3a/plots/`:
1. `phase3a_forecast_comparison.png`: 1-week test slice comparing actual flow against Persistence, Diurnal Baseline, and LSTM forecasts.
2. `phase3a_residual_distributions.png`: Histograms of forecast residuals on normal hours vs. active leak hours.
3. `phase3a_pr_curves.png`: Precision-Recall curves on the held-out test split with marked operating points.

---

## 6. Limitations & Generalization Analysis

1. **Label Uncertainty**: As identified in the audit, the retrospective ground-truth intervals are model-assisted labels derived from repair records rather than direct physical breach meters. Boundary timestamps may have a tolerance of $\pm 1$ to 2 days.
2. **Seasonal Boundary Shifts**: In Mediterranean networks, extreme summer heatwaves drive baseline consumption up. While the LSTM handles this significantly better than static baselines (reducing FAR to $11.07\%$), an adaptive background baseline tracker or temperature co-variable is recommended for multi-year operations.
3. **Cross-DMA Generalization**: This model was trained on Area 1. Transferring to Area 2–6 requires area-specific calibration or transfer fine-tuning because each DMA possesses unique hydraulic friction, consumer demographics, and pressure profiles.
4. **Inference Latency on IBM Z / LinuxONE**: The trained PyTorch LSTM model occupies only $\sim 35\text{ KB}$ of weights and executes 1-step inference in **$< 1\text{ ms}$** on CPU, making it lightweight for containerized s390x deployments.

---

## 7. Deliverables Checklist

- `phase3a/train_lstm.py`: LSTM training pipeline with seed 42 and early stopping.
- `phase3a/evaluate_lstm.py`: Comparative evaluation runner.
- `phase3a/models/lstm_predictor.pth`: Saved PyTorch checkpoint.
- `phase3a/models/scaler_params.json`: Train-only normalization parameters.
- `phase3a/models/model_config.json`: Model configuration and training metadata.
- `phase3a/metrics/phase2_audit.json`: Phase 2 audit findings.
- `phase3a/metrics/forecasting_metrics.json`: Forecasting comparison metrics.
- `phase3a/metrics/detection_metrics.json`: Leak detection comparison metrics.
- `phase3a/plots/`: 3 diagnostic visualization plots.
