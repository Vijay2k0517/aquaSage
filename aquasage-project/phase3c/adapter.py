"""
Phase 3C: Input Adapter & Telemetry Pipeline Mapper.
Maps outputs from Phase 3A (LSTM leak evaluation) and Phase 3B (hydraulic tank
simulation & water-quality grab samples) to the Phase 3C Decision Engine schemas.

Guarantees:
1. Strict schema normalization without inventing or imputing missing measurements.
2. Chronological rolling persistence tracking for flow anomalies, with automatic
   reset when anomaly conditions break or data is missing.
3. Explicit preservation of source types (HISTORICAL_BATCH, SIMULATED_HYDRAULIC_MODEL,
   FIELD_GRAB_SAMPLE, LIVE_TELEMETRY).
4. Safe extraction of field remarks for uncollected water-quality grab samples.
"""

from typing import Dict, Any, Optional, List, Union
from datetime import datetime, timezone
import numpy as np
import pandas as pd

from phase3c.config import SourceType


class RollingPersistenceTracker:
    """
    Chronological rolling persistence tracker for anomaly scores.
    Maintains sequential duration in hours and resets immediately when the
    anomaly condition breaks or data is interrupted.
    """

    def __init__(self, threshold: float = 2.3765, anomaly_threshold: Optional[float] = None):
        self.threshold = float(anomaly_threshold if anomaly_threshold is not None else threshold)
        self.persistence_hours: int = 0
        self.last_timestamp: Optional[datetime] = None

    def update(
        self,
        anomaly_score: Optional[Union[float, datetime, str]] = None,
        timestamp: Optional[Union[str, datetime]] = None,
        score: Optional[float] = None
    ) -> int:
        """
        Update tracker with incoming score.
        If score is None/NaN or below threshold, persistence resets to 0.
        If score >= threshold, increments persistence.
        Supports positional or keyword args, including gap detection (>1.5 hr).
        """
        if isinstance(anomaly_score, (datetime, str)) and score is not None:
            current_dt = self._parse_iso(anomaly_score)
            val = float(score) if score is not None else None
        else:
            val = float(anomaly_score) if anomaly_score is not None else (float(score) if score is not None else None)
            current_dt = self._parse_iso(timestamp) if timestamp else None

        if val is None:
            self.persistence_hours = 0
            self.last_timestamp = current_dt
            return 0

        try:
            if np.isnan(val):
                self.persistence_hours = 0
                self.last_timestamp = current_dt
                return 0
        except (ValueError, TypeError):
            self.persistence_hours = 0
            self.last_timestamp = current_dt
            return 0

        # Gap detection (> 1.5 hours in hourly data breaks chronological continuity)
        if self.last_timestamp is not None and current_dt is not None:
            delta_sec = abs((current_dt - self.last_timestamp).total_seconds())
            if delta_sec > 5400:
                self.persistence_hours = 0

        if val >= self.threshold:
            self.persistence_hours += 1
        else:
            self.persistence_hours = 0

        self.last_timestamp = current_dt
        return self.persistence_hours

    def reset(self):
        """Manually reset persistence counter to 0."""
        self.persistence_hours = 0
        self.last_timestamp = None

    @staticmethod
    def _parse_iso(ts_val: Any) -> Optional[datetime]:
        if not ts_val:
            return None
        if isinstance(ts_val, datetime):
            return ts_val if ts_val.tzinfo else ts_val.replace(tzinfo=timezone.utc)
        try:
            dt = datetime.fromisoformat(str(ts_val).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None


class SubsystemAdapter:
    """
    Translates raw and processed outputs from Phase 3A and Phase 3B modules
    into standardized Phase 3C Decision Engine input dictionaries.
    """

    def __init__(
        self,
        default_flow_threshold: float = 2.3765,
        persistence_tracker: Optional[RollingPersistenceTracker] = None
    ):
        self.flow_threshold = default_flow_threshold
        self.tracker = persistence_tracker or RollingPersistenceTracker(threshold=default_flow_threshold)

    # -------------------------------------------------------------------------
    # 1. Flow & Leak Detection Adapter (Phase 3A)
    # -------------------------------------------------------------------------
    def adapt_flow_record(
        self,
        record: Union[Dict[str, Any], pd.Series],
        source_type: Optional[str] = None,
        tracker: Optional[RollingPersistenceTracker] = None
    ) -> Dict[str, Any]:
        """
        Maps a Phase 3A evaluation record or streaming inlet flow reading
        to the Phase 3C flow_data dictionary schema.
        """
        rec = dict(record)
        active_tracker = tracker or self.tracker

        # Timestamp mapping
        ts_val = rec.get('result_time') or rec.get('timestamp') or rec.get('date') or rec.get('datetime')
        iso_ts = None
        if ts_val is not None:
            if isinstance(ts_val, (pd.Timestamp, datetime)):
                iso_ts = ts_val.isoformat()
            else:
                iso_ts = str(ts_val).strip()

        # Flow measurements
        flow_raw = rec.get('Flow') if 'Flow' in rec else rec.get('flow_m3h')
        if flow_raw is None:
            flow_raw = rec.get('flow')
        flow_m3h = self._to_float(flow_raw)

        # Predictions
        pred_raw = rec.get('pred') if 'pred' in rec else rec.get('predicted_flow_m3h')
        if pred_raw is None:
            pred_raw = rec.get('predicted_flow') or rec.get('y_hat')
        pred_m3h = self._to_float(pred_raw)

        # Anomaly score & threshold
        score_raw = rec.get('test_scores') if 'test_scores' in rec else rec.get('anomaly_score')
        if score_raw is None:
            score_raw = rec.get('score') or rec.get('residual')
        score = self._to_float(score_raw)

        threshold = self._to_float(rec.get('threshold')) or self.flow_threshold

        # Compute or extract persistence
        if 'persistence_hours' in rec and rec['persistence_hours'] is not None:
            persistence = int(rec['persistence_hours'])
        else:
            persistence = active_tracker.update(score, iso_ts)

        inferred_source = source_type or rec.get('source_type', SourceType.LIVE_TELEMETRY.value)

        return {
            'timestamp': iso_ts,
            'source_type': inferred_source,
            'flow_m3h': flow_m3h,
            'predicted_flow_m3h': pred_m3h,
            'anomaly_score': score,
            'threshold': threshold,
            'persistence_hours': persistence
        }

    def adapt_flow_dataframe(
        self,
        df: pd.DataFrame,
        threshold: Optional[float] = None,
        source_type: str = SourceType.HISTORICAL_BATCH.value
    ) -> List[Dict[str, Any]]:
        """
        Chronologically transforms an entire Phase 3A DataFrame into a sequence of
        Phase 3C flow_data records with chronological persistence tracking.
        """
        th = threshold or self.flow_threshold
        batch_tracker = RollingPersistenceTracker(threshold=th)

        # Sort chronologically
        time_col = 'result_time' if 'result_time' in df.columns else 'timestamp'
        df_sorted = df.copy()
        if time_col in df_sorted.columns:
            df_sorted[time_col] = pd.to_datetime(df_sorted[time_col])
            df_sorted = df_sorted.sort_values(time_col).reset_index(drop=True)

        adapted_records = []
        for _, row in df_sorted.iterrows():
            rec = self.adapt_flow_record(row, source_type=source_type, tracker=batch_tracker)
            adapted_records.append(rec)

        return adapted_records

    # -------------------------------------------------------------------------
    # 2. Hydraulic Tank Telemetry Adapter (Phase 3B)
    # -------------------------------------------------------------------------
    def adapt_tank_record(
        self,
        record: Union[Dict[str, Any], pd.Series]
    ) -> Dict[str, Any]:
        """
        Maps a Phase 3B simulated tank forecast record to the Phase 3C tank_data schema.
        Strictly preserves SIMULATED_HYDRAULIC_MODEL source tag.
        """
        rec = dict(record)

        # Timestamp mapping
        ts_val = rec.get('timestamp') or rec.get('result_time') or rec.get('time')
        iso_ts = None
        if ts_val is not None:
            if isinstance(ts_val, (pd.Timestamp, datetime)):
                iso_ts = ts_val.isoformat()
            else:
                iso_ts = str(ts_val).strip()

        # Level mapping (checks Phase 3B simulated names)
        level_raw = rec.get('simulated_sensor_level_m')
        if level_raw is None:
            level_raw = rec.get('noisy_sensor_level_m') or rec.get('current_level_m') or rec.get('level_m')
        current_level_m = self._to_float(level_raw)

        # Forecasts
        f5 = self._to_float(rec.get('forecast_5m') or rec.get('pred_5min') or rec.get('h_5min'))
        f15 = self._to_float(rec.get('forecast_15m') or rec.get('pred_15min') or rec.get('h_15min'))
        f30 = self._to_float(rec.get('forecast_30m') or rec.get('pred_30min') or rec.get('h_30min'))

        # Inflow / Outflow
        inflow = self._to_float(rec.get('simulated_inflow_m3h') or rec.get('inflow_m3h') or rec.get('inflow')) or 0.0
        outflow = self._to_float(rec.get('simulated_outflow_m3h') or rec.get('outflow_m3h') or rec.get('outflow')) or 0.0

        return {
            'timestamp': iso_ts,
            'source_type': SourceType.SIMULATED_HYDRAULIC_MODEL.value,
            'current_level_m': current_level_m,
            'forecast_5m': f5,
            'forecast_15m': f15,
            'forecast_30m': f30,
            'inflow_m3h': inflow,
            'outflow_m3h': outflow,
            'is_simulated': True
        }

    # -------------------------------------------------------------------------
    # 3. Water Quality Screening Adapter (Phase 3B)
    # -------------------------------------------------------------------------
    def adapt_water_quality_record(
        self,
        record: Union[Dict[str, Any], pd.Series]
    ) -> Dict[str, Any]:
        """
        Maps a Phase 3B field grab sample record to the Phase 3C wq_data schema.
        Isolates uncollected remarks without fabricating measurements.
        """
        rec = dict(record)

        # Timestamp / Date
        date_val = rec.get('date') or rec.get('Date') or rec.get('timestamp')
        iso_ts = None
        if date_val is not None:
            if isinstance(date_val, (pd.Timestamp, datetime)):
                iso_ts = date_val.isoformat()
            else:
                iso_ts = str(date_val).strip()

        # Station ID
        station_id = str(rec.get('station') or rec.get('Station') or rec.get('station_id') or 'UNKNOWN').strip()

        # Check for uncollected remarks in remarks/notes/temperature
        uncollected_remark = rec.get('uncollected_remark') or rec.get('Remarks') or rec.get('remarks') or rec.get('Notes') or rec.get('notes')
        temp_val = str(rec.get('temperature_c', '')).strip()
        if not uncollected_remark and any(char.isalpha() for char in temp_val) and len(temp_val) > 4:
            uncollected_remark = temp_val

        # Core parameters
        ph = self._to_float(rec.get('ph') or rec.get('pH'))
        turb = self._to_float(rec.get('turbidity_ntu') or rec.get('Turbidity (NTU)') or rec.get('turbidity'))
        cond = self._to_float(rec.get('conductivity_us_cm') or rec.get('Conductivity (uS/cm)') or rec.get('Conductivity (µS/cm)'))
        do = self._to_float(rec.get('dissolved_oxygen_mg_l') or rec.get('Dissolved Oxygen (mg/L)') or rec.get('DO (mg/L)'))
        tds = self._to_float(rec.get('tds_mg_l') or rec.get('TDS (mg/L)'))

        res: Dict[str, Any] = {
            'timestamp': iso_ts,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': station_id,
            'ph': ph,
            'turbidity_ntu': turb,
            'conductivity_us_cm': cond,
            'dissolved_oxygen_mg_l': do,
            'tds_mg_l': tds
        }

        if uncollected_remark:
            res['uncollected_remark'] = str(uncollected_remark).strip()

        return res

    # Explicit Aliases for Phase 3A & Phase 3B pipelines
    adapt_phase3a_flow_record = adapt_flow_record
    adapt_phase3b_tank_record = adapt_tank_record
    adapt_phase3b_water_quality_record = adapt_water_quality_record

    # -------------------------------------------------------------------------
    # Helper
    # -------------------------------------------------------------------------
    @staticmethod
    def _to_float(val: Any) -> Optional[float]:
        if val is None:
            return None
        try:
            f = float(val)
            return None if np.isnan(f) else f
        except (ValueError, TypeError):
            return None
