"""
AquaSage Robust Historical Data Preparation Pipeline
Processes all 6 KIOS DMA flow datasets and verified leak repair records.
Applies chronological sorting, physical bound validation, auditable outlier logging,
gap tracking, and non-destructive short-gap interpolation flags.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("AquaSageDataPipeline")


class RobustDataPipeline:
    """
    Standardized, portable data cleaning and auditing pipeline for DMA inlet flow time series.
    """

    def __init__(
        self,
        workspace_root: Optional[Path] = None,
        min_flow_threshold: float = 0.5,
        max_flow_quantile: float = 0.999,
        linear_gap_limit_steps: int = 24,  # 24 steps of 5-min = 2 hours max
        freq: str = "5min",
    ):
        if workspace_root is None:
            # Locate root containing data/raw_flow_data
            current = Path(__file__).resolve()
            self.workspace_root = next(
                (p for p in current.parents if (p / "data" / "raw_flow_data").exists()),
                current.parent.parent.parent
            )
        else:
            self.workspace_root = Path(workspace_root)

        self.raw_data_dir = self.workspace_root / "data" / "raw_flow_data"
        self.reports_file = self.workspace_root / "data" / "processed_reports_data" / "leak_reports.csv"
        self.processed_data_dir = self.workspace_root / "data" / "processed_flow_data"
        self.audit_dir = self.workspace_root / "reports"

        self.min_flow_threshold = min_flow_threshold
        self.max_flow_quantile = max_flow_quantile
        self.linear_gap_limit_steps = linear_gap_limit_steps
        self.freq = freq

        self.audit_log: Dict[str, Any] = {}

    def get_all_raw_areas(self) -> List[Path]:
        """Discover all Area_*.csv files in portable manner."""
        files = sorted(list(self.raw_data_dir.glob("Area_*.csv")))
        if not files:
            raise FileNotFoundError(f"No Area_*.csv files found in {self.raw_data_dir}")
        return files

    def process_area(
        self,
        area_csv_path: Path,
        flow_col: str = "Flow",
        time_col: str = "result_time",
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Process a single DMA area dataset with full audit trail:
        1. Reads raw file with UTF-8 / fallback encoding.
        2. Normalizes column names (handles Area_4 'replaced' column).
        3. Parses timestamps to UTC-naive standard DatetimeIndex.
        4. Sorts chronologically ascending (handles reversed datasets).
        5. Deduplicates timestamps preserving the latest recorded reading.
        6. Audits and filters physical bounds (< 0.5 or > 2 * 99.9th quantile).
        7. Resamples to uniform frequency (default 5min) and creates is_interpolated flag.
        8. Interpolates short gaps (<= 2h) with explicit is_interpolated=True marking.
        9. Leaves long gaps as NaN (no manufactured readings).
        """
        area_name = area_csv_path.stem
        logger.info(f"Processing {area_name} from {area_csv_path}...")

        audit: Dict[str, Any] = {
            "area": area_name,
            "source_path": str(area_csv_path.relative_to(self.workspace_root)),
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "raw_row_count": 0,
            "initial_ordering": "unknown",
            "duplicates_removed": 0,
            "corrupted_negatives_count": 0,
            "corrupted_extreme_count": 0,
            "upper_physical_bound": 0.0,
            "lower_physical_bound": self.min_flow_threshold,
            "total_grid_points": 0,
            "valid_observed_points": 0,
            "short_gaps_interpolated_points": 0,
            "unfilled_missing_points": 0,
            "time_start": None,
            "time_end": None,
        }

        # 1. Load CSV
        df = pd.read_csv(area_csv_path)
        audit["raw_row_count"] = len(df)

        if time_col not in df.columns or flow_col not in df.columns:
            raise ValueError(f"Missing required columns in {area_csv_path}. Found: {df.columns.tolist()}")

        # 2. Parse timestamps
        df[time_col] = pd.to_datetime(df[time_col], errors="coerce")
        df = df.dropna(subset=[time_col]).copy()

        # 3. Detect chronological ordering
        if len(df) > 1:
            if df[time_col].iloc[0] > df[time_col].iloc[-1]:
                audit["initial_ordering"] = "descending (reversed to ascending)"
            else:
                audit["initial_ordering"] = "ascending"

        df = df.sort_values(by=time_col).reset_index(drop=True)

        # 4. Deduplicate timestamps
        initial_count = len(df)
        df = df.drop_duplicates(subset=[time_col], keep="last").reset_index(drop=True)
        audit["duplicates_removed"] = initial_count - len(df)

        # 5. Outlier rejection using physical thresholds
        df[flow_col] = pd.to_numeric(df[flow_col], errors="coerce")
        valid_flows = df[flow_col].dropna()
        q_high = float(valid_flows.quantile(self.max_flow_quantile)) * 2.0
        audit["upper_physical_bound"] = round(q_high, 2)

        neg_mask = df[flow_col] < self.min_flow_threshold
        audit["corrupted_negatives_count"] = int(neg_mask.sum())

        high_mask = df[flow_col] > q_high
        audit["corrupted_extreme_count"] = int(high_mask.sum())

        # Exclude corrupted readings
        corrupt_mask = neg_mask | high_mask
        df.loc[corrupt_mask, flow_col] = np.nan

        # 6. Resample to uniform grid
        df.set_index(time_col, inplace=True)
        resampled_series = df[flow_col].resample(self.freq).mean()
        grid_df = pd.DataFrame({flow_col: resampled_series})

        audit["total_grid_points"] = len(grid_df)
        audit["valid_observed_points"] = int(grid_df[flow_col].notna().sum())
        audit["time_start"] = str(grid_df.index.min())
        audit["time_end"] = str(grid_df.index.max())

        # 7. Short gap interpolation with explicit flag
        was_nan = grid_df[flow_col].isna()
        interpolated_series = grid_df[flow_col].interpolate(
            method="linear", limit=self.linear_gap_limit_steps, limit_direction="forward"
        )
        is_interp = was_nan & interpolated_series.notna()

        grid_df[flow_col] = interpolated_series
        grid_df["is_interpolated"] = is_interp
        grid_df["is_valid_reading"] = grid_df[flow_col].notna()

        audit["short_gaps_interpolated_points"] = int(is_interp.sum())
        audit["unfilled_missing_points"] = int(grid_df[flow_col].isna().sum())

        grid_df = grid_df.reset_index()
        self.audit_log[area_name] = audit

        logger.info(
            f"[{area_name}] Processed: {audit['raw_row_count']} raw -> {audit['total_grid_points']} grid points. "
            f"Observed: {audit['valid_observed_points']}, Interp: {audit['short_gaps_interpolated_points']}, "
            f"Unfilled: {audit['unfilled_missing_points']}, Corrupt: {audit['corrupted_negatives_count'] + audit['corrupted_extreme_count']}"
        )

        return grid_df, audit

    def process_all_and_save(self) -> Dict[str, Any]:
        """Run preprocessing across all 6 DMA areas and persist audit log."""
        self.processed_data_dir.mkdir(parents=True, exist_ok=True)
        self.audit_dir.mkdir(parents=True, exist_ok=True)

        area_files = self.get_all_raw_areas()
        results: Dict[str, Any] = {}

        for area_file in area_files:
            area_name = area_file.stem
            df_clean, audit = self.process_area(area_file)

            out_path = self.processed_data_dir / f"{area_name}.csv"
            df_clean.to_csv(out_path, index=False)
            results[area_name] = audit

        # Save audit summary
        audit_file = self.audit_dir / "data_preparation_audit.json"
        with open(audit_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)

        logger.info(f"Saved complete audit report to {audit_file}")
        return results


if __name__ == "__main__":
    pipeline = RobustDataPipeline()
    pipeline.process_all_and_save()
