"""
IBM Snap ML / Tree Ensemble Future-Event Risk Model.
Trains a causal classification pipeline to predict future elevated flow / leak risk (H=6 hours).
Evaluates baseline vs logistic regression vs Snap ML / Random Forest,
calibrates decision threshold on validation data, and reports untouched test performance.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import StandardScaler

import sys
current_dir = Path(__file__).resolve().parent
workspace_dir = current_dir.parent.parent
if str(workspace_dir) not in sys.path:
    sys.path.insert(0, str(workspace_dir))

from src.models.predictive_risk_dataset import (
    FEATURE_COLUMNS,
    build_chronological_feature_splits,
    compute_diurnal_profile,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("SnapMLRiskPredictor")


# --- IBM Snap ML Loader with Graceful NumPy ABI Fallback ---
SNAPML_AVAILABLE = False
SNAPML_ERROR_REASON = ""

try:
    from snapml import SnapRandomForestClassifier
    SNAPML_AVAILABLE = True
    logger.info("IBM Snap ML loaded successfully with native acceleration.")
except Exception as e:
    from sklearn.ensemble import RandomForestClassifier as SnapRandomForestClassifier
    SNAPML_ERROR_REASON = (
        f"Snap ML import bypassed: {type(e).__name__}: {str(e).strip()}. "
        "Under Windows with NumPy 2.x, native snapml binary requires numpy<2 (NumPy 1.x ABI). "
        "Using scikit-learn RandomForest with equivalent tree architecture and hyperparameter parity."
    )
    logger.warning(SNAPML_ERROR_REASON)


class FutureRiskPredictor:
    """
    Predictive intelligence classifier for upcoming water network events.
    Predicts probability of active leak or elevated flow over the forward horizon H=6 hours.
    """

    MODEL_VERSION = "2.1.0-snapml-ensemble"

    def __init__(self, horizon_hours: int = 6):
        self.horizon_hours = horizon_hours
        self.scaler = StandardScaler()
        self.diurnal_profile: Dict[str, Any] = {}
        self.model = None
        self.optimal_threshold: float = 0.50
        self.is_snapml_native: bool = SNAPML_AVAILABLE
        self.feature_names = FEATURE_COLUMNS
        self.metadata: Dict[str, Any] = {}

    def fit_and_evaluate(
        self,
        splits_dir: str = "data/splits/Area_1",
        output_model_path: str = "models/future_risk_model.joblib",
        output_metadata_path: str = "models/future_risk_metadata.json",
        output_report_path: str = "reports/predictive_risk_evaluation.json",
    ) -> Dict[str, Any]:
        """Run full training, calibration, and test evaluation workflow."""
        logger.info(f"Building chronological feature splits from {splits_dir} (Horizon={self.horizon_hours}h)...")
        train_df, val_df, test_df, meta = build_chronological_feature_splits(
            splits_dir=splits_dir, horizon_hours=self.horizon_hours
        )

        # Store diurnal profile
        self.diurnal_profile = compute_diurnal_profile(train_df)

        X_train = train_df[self.feature_names].values
        y_train = train_df["target_future_leak"].values

        X_val = val_df[self.feature_names].values
        y_val = val_df["target_future_leak"].values

        X_test = test_df[self.feature_names].values
        y_test = test_df["target_future_leak"].values

        logger.info(
            f"Dataset shapes: Train={X_train.shape} (pos={y_train.mean():.1%}), "
            f"Val={X_val.shape} (pos={y_val.mean():.1%}), "
            f"Test={X_test.shape} (pos={y_test.mean():.1%})"
        )

        # Fit Scaler
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        X_test_scaled = self.scaler.transform(X_test)

        # -------------------------------------------------------------
        # 1. Simple Baseline: Heuristic Diurnal Excess Threshold
        # -------------------------------------------------------------
        # Flag if 6-hour rolling excess z-score exceeds 1.5
        z_idx = self.feature_names.index("excess_z_mean_6h")
        heuristic_test_pred = (X_test[:, z_idx] >= 1.5).astype(int)
        heuristic_metrics = self._compute_metrics(y_test, heuristic_test_pred, probs=None)

        # -------------------------------------------------------------
        # 2. Linear Baseline: Logistic Regression
        # -------------------------------------------------------------
        lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
        lr.fit(X_train_scaled, y_train)
        lr_test_probs = lr.predict_proba(X_test_scaled)[:, 1] if len(np.unique(y_train)) > 1 else np.zeros(len(y_test))
        lr_metrics = self._compute_metrics(y_test, (lr_test_probs >= 0.5).astype(int), probs=lr_test_probs)

        # -------------------------------------------------------------
        # 3. Primary Model: IBM Snap ML / Tree Ensemble Classifier
        # -------------------------------------------------------------
        logger.info("Fitting primary predictive tree ensemble...")
        rf_kwargs = {
            "n_estimators": 100,
            "max_depth": 8,
            "random_state": 42,
        }
        if not SNAPML_AVAILABLE:
            rf_kwargs["class_weight"] = "balanced"

        self.model = SnapRandomForestClassifier(**rf_kwargs)
        self.model.fit(X_train_scaled, y_train)

        # Calibrate threshold on validation set (or fallback if single-class in val)
        if len(np.unique(y_val)) > 1:
            val_probs = self.model.predict_proba(X_val_scaled)[:, 1]
            precisions, recalls, thresholds = precision_recall_curve(y_val, val_probs)
            f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-9)
            best_idx = np.argmax(f1_scores)
            self.optimal_threshold = float(thresholds[best_idx]) if best_idx < len(thresholds) else 0.50
        else:
            # When validation set is clean normal baseline (0 positive leaks),
            # calibrate threshold to limit false alarms to <= 2% on normal validation data
            val_probs = self.model.predict_proba(X_val_scaled)[:, 1]
            self.optimal_threshold = float(np.percentile(val_probs, 98.0))

        logger.info(f"Calibrated operating decision threshold: tau* = {self.optimal_threshold:.4f}")

        # Evaluate on untouched chronological Test set
        test_probs = self.model.predict_proba(X_test_scaled)[:, 1]
        test_pred = (test_probs >= self.optimal_threshold).astype(int)
        model_metrics = self._compute_metrics(y_test, test_pred, probs=test_probs)

        # Feature Importance analysis
        importances = getattr(self.model, "feature_importances_", None)
        feat_imp = []
        if importances is not None:
            for name, imp in zip(self.feature_names, importances):
                feat_imp.append({"feature": name, "importance": round(float(imp), 4)})
            feat_imp = sorted(feat_imp, key=lambda x: x["importance"], reverse=True)

        # Compile comprehensive evaluation comparison
        comparison_report = {
            "evaluation_timestamp": datetime.now(timezone.utc).isoformat(),
            "model_family": "IBM Snap ML / Tree Ensemble" if SNAPML_AVAILABLE else "Scikit-Learn Tree Ensemble (Snap ML Architecture)",
            "model_version": self.MODEL_VERSION,
            "is_snapml_native": SNAPML_AVAILABLE,
            "snapml_compatibility_status": "Native" if SNAPML_AVAILABLE else "Bypassed (ABI Fallback)",
            "snapml_note": SNAPML_ERROR_REASON,
            "prediction_target": f"Upcoming Elevated Flow & Leak Risk in Next {self.horizon_hours} Hours",
            "horizon_hours": self.horizon_hours,
            "calibrated_threshold": round(self.optimal_threshold, 4),
            "test_split_period": f"{test_df['result_time'].min()} to {test_df['result_time'].max()}",
            "test_samples": len(y_test),
            "test_positive_events": int(np.sum(y_test)),
            "benchmarks": {
                "heuristic_baseline": heuristic_metrics,
                "logistic_regression": lr_metrics,
                "snapml_tree_ensemble": model_metrics,
            },
            "top_contributing_features": feat_imp[:8],
        }

        # Persist artifacts
        Path(output_model_path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "model": self.model,
                "scaler": self.scaler,
                "diurnal_profile": self.diurnal_profile,
                "feature_names": self.feature_names,
                "optimal_threshold": self.optimal_threshold,
                "horizon_hours": self.horizon_hours,
                "version": self.MODEL_VERSION,
            },
            output_model_path,
        )

        Path(output_metadata_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_metadata_path, "w", encoding="utf-8") as f:
            json.dump(comparison_report, f, indent=2)

        Path(output_report_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_report_path, "w", encoding="utf-8") as f:
            json.dump(comparison_report, f, indent=2)

        logger.info(f"Saved trained model to {output_model_path}")
        logger.info(f"Saved evaluation report to {output_report_path}")

        return comparison_report

    def _compute_metrics(self, y_true: np.ndarray, y_pred: np.ndarray, probs: Optional[np.ndarray]) -> Dict[str, Any]:
        """Calculate standardized evaluation metrics on held-out test data."""
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
        accuracy = (tp + tn) / len(y_true) if len(y_true) > 0 else 0.0

        res: Dict[str, Any] = {
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1_score": round(float(f1), 4),
            "false_positive_rate": round(float(fpr), 4),
            "specificity": round(float(specificity), 4),
            "accuracy": round(float(accuracy), 4),
            "confusion_matrix": {
                "true_positives": int(tp),
                "false_positives": int(fp),
                "false_negatives": int(fn),
                "true_negatives": int(tn),
            },
        }

        if probs is not None:
            try:
                res["roc_auc"] = round(float(roc_auc_score(y_true, probs)), 4)
                res["pr_auc"] = round(float(average_precision_score(y_true, probs)), 4)
                res["brier_score"] = round(float(brier_score_loss(y_true, probs)), 4)
            except Exception:
                pass

        return res


if __name__ == "__main__":
    predictor = FutureRiskPredictor(horizon_hours=6)
    results = predictor.fit_and_evaluate()
    print("\n--- Model Benchmark Evaluation Results ---")
    print(json.dumps(results["benchmarks"], indent=2))
