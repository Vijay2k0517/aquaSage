"""
AquaSage Prototype Blockage-Screening Module.
Screens dual YF-S201 flow sensors mounted on an unbranched, straight pipe bench prototype.

Key Principles:
1. Low-flow screening is decoupled from sensor imbalance screening.
2. Sensor discrepancy alone is never reported as a confirmed leak or blockage.
3. If pump telemetry is unavailable, low flow returns UNCERTAIN_OPERATING_STATE rather than asserting a blockage.
4. Robust rejection and diagnostic reporting for missing, invalid, stale, and jittery readings.
5. All test and bench scenarios are explicitly labeled as simulated.
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Union
import numpy as np

from prototype_blockage.config import (
    BlockageScreeningConfig,
    BlockageStatus,
    PumpStatus,
    FlowUnit
)


class PrototypeBlockageScreener:
    """
    Lightweight, explainable blockage and sensor health screener for dual-sensor straight pipes.
    """

    def __init__(self, config: Optional[BlockageScreeningConfig] = None):
        self.config = config or BlockageScreeningConfig()
        self.low_flow_persistence_count: int = 0
        self.imbalance_persistence_count: int = 0
        self.s1_history: List[float] = []
        self.s2_history: List[float] = []
        self.last_timestamp: Optional[datetime] = None

    def reset(self):
        """Resets all rolling persistence counters and sensor history."""
        self.low_flow_persistence_count = 0
        self.imbalance_persistence_count = 0
        self.s1_history.clear()
        self.s2_history.clear()
        self.last_timestamp = None

    def screen(
        self,
        sensor_1_flow: Optional[float],
        sensor_2_flow: Optional[float],
        pump_status: Union[PumpStatus, str] = PumpStatus.UNKNOWN,
        timestamp: Optional[Union[str, datetime]] = None,
        reference_time: Optional[Union[str, datetime]] = None,
        is_simulated: bool = True
    ) -> Dict[str, Any]:
        """
        Evaluates a single measurement cycle from dual YF-S201 flow sensors.
        """
        # Normalize pump status (accepts PumpStatus enum, str, or bool)
        if isinstance(pump_status, bool):
            pump_stat = PumpStatus.PUMP_RUNNING if pump_status else PumpStatus.PUMP_OFF
        elif isinstance(pump_status, str):
            try:
                pump_stat = PumpStatus(pump_status)
            except ValueError:
                pump_stat = PumpStatus.UNKNOWN
        elif isinstance(pump_status, PumpStatus):
            pump_stat = pump_status
        else:
            pump_stat = PumpStatus.UNKNOWN

        # -------------------------------------------------------------
        # 1. Missing Telemetry Check
        # -------------------------------------------------------------
        if sensor_1_flow is None and sensor_2_flow is None:
            self.low_flow_persistence_count = 0
            self.imbalance_persistence_count = 0
            return self._build_result(
                status=BlockageStatus.INSUFFICIENT_DATA,
                severity="WARNING",
                reason="Both upstream (S1) and downstream (S2) sensor readings are missing.",
                sensor_1=None,
                sensor_2=None,
                pump_status=pump_stat,
                timestamp=timestamp,
                is_simulated=is_simulated,
                action_category="TELEMETRY_DIAGNOSTIC",
                action_text="Verify wiring, 5V power supply, and pulse interrupt pin assignment for both YF-S201 sensors.",
                action_rationale="No flow pulse data received from either sensor."
            )

        # -------------------------------------------------------------
        # 2. Physical Plausibility & Sanity Check
        # -------------------------------------------------------------
        invalid_reasons = []
        for name, val in [("S1", sensor_1_flow), ("S2", sensor_2_flow)]:
            if val is not None:
                if val < self.config.min_plausible_flow_l_per_min:
                    invalid_reasons.append(f"{name} reading ({val} L/min) is negative (physically impossible)")
                elif val > self.config.max_plausible_flow_l_per_min:
                    invalid_reasons.append(f"{name} reading ({val} L/min) exceeds physical turbine capacity ({self.config.max_plausible_flow_l_per_min} L/min)")

        if invalid_reasons:
            self.low_flow_persistence_count = 0
            self.imbalance_persistence_count = 0
            return self._build_result(
                status=BlockageStatus.INVALID_READING,
                severity="WARNING",
                reason=f"Invalid physical reading detected: {'; '.join(invalid_reasons)}.",
                sensor_1=sensor_1_flow,
                sensor_2=sensor_2_flow,
                pump_status=pump_stat,
                timestamp=timestamp,
                is_simulated=is_simulated,
                action_category="INSTRUMENT_DIAGNOSTIC",
                action_text="Inspect YF-S201 sensor pinwheel for foreign body lockup; check pull-up resistor and ADC/pulse counter calibration.",
                action_rationale="Reported pulse frequencies violate physical sensor operating boundaries."
            )

        # -------------------------------------------------------------
        # 3. Staleness Check
        # -------------------------------------------------------------
        dt_reading = self._parse_iso(timestamp)
        dt_ref = self._parse_iso(reference_time) if reference_time else datetime.now(timezone.utc)
        if dt_reading and dt_ref:
            age_sec = abs((dt_ref - dt_reading).total_seconds())
            if age_sec > self.config.max_stale_seconds:
                return self._build_result(
                    status=BlockageStatus.STALE_TELEMETRY,
                    severity="ADVISORY",
                    reason=f"Telemetry latency ({round(age_sec, 1)}s) exceeds max freshness tolerance ({self.config.max_stale_seconds}s).",
                    sensor_1=sensor_1_flow,
                    sensor_2=sensor_2_flow,
                    pump_status=pump_stat,
                    timestamp=timestamp,
                    is_simulated=is_simulated,
                    action_category="COMMUNICATION_WATCH",
                    action_text="Verify microcontroller serial/MQTT transmission cycle rate and Wi-Fi/UART buffer latency.",
                    action_rationale="Flow data is stale; active hydraulic conditions cannot be reliably assessed from delayed readings."
                )

        # -------------------------------------------------------------
        # 4. Telemetry Stability & Jitter Check
        # -------------------------------------------------------------
        if sensor_1_flow is not None:
            self.s1_history.append(sensor_1_flow)
            if len(self.s1_history) > self.config.jitter_window_size:
                self.s1_history.pop(0)
        if sensor_2_flow is not None:
            self.s2_history.append(sensor_2_flow)
            if len(self.s2_history) > self.config.jitter_window_size:
                self.s2_history.pop(0)

        unstable_detected = False
        jitter_detail = []
        if len(self.s1_history) >= self.config.jitter_window_size:
            std_s1 = float(np.std(self.s1_history))
            if std_s1 > self.config.jitter_std_threshold_l_per_min:
                unstable_detected = True
                jitter_detail.append(f"S1 standard deviation={std_s1:.2f} L/min")
        if len(self.s2_history) >= self.config.jitter_window_size:
            std_s2 = float(np.std(self.s2_history))
            if std_s2 > self.config.jitter_std_threshold_l_per_min:
                unstable_detected = True
                jitter_detail.append(f"S2 standard deviation={std_s2:.2f} L/min")

        if unstable_detected:
            return self._build_result(
                status=BlockageStatus.UNSTABLE_TELEMETRY,
                severity="ADVISORY",
                reason=f"High-frequency pulse jitter or hydraulic surging detected ({'; '.join(jitter_detail)}).",
                sensor_1=sensor_1_flow,
                sensor_2=sensor_2_flow,
                pump_status=pump_stat,
                timestamp=timestamp,
                is_simulated=is_simulated,
                action_category="SIGNAL_STABILIZATION",
                action_text="Inspect pump suction for air entrapment/cavitation; check sensor grounding to eliminate electrical EMI.",
                action_rationale="Flow readings exhibit erratic variance exceeding stability tolerance."
            )

        # -------------------------------------------------------------
        # 5. Dual-Sensor Imbalance Screening (Decoupled from Blockage)
        # -------------------------------------------------------------
        flow_diff: Optional[float] = None
        rel_imbalance_pct: Optional[float] = None
        imbalance_flag = False

        if sensor_1_flow is not None and sensor_2_flow is not None:
            flow_diff = abs(sensor_1_flow - sensor_2_flow)
            denom = max(sensor_1_flow, sensor_2_flow, 0.1)
            rel_imbalance_pct = (flow_diff / denom) * 100.0

            if (flow_diff >= self.config.sensor_imbalance_abs_threshold_l_per_min and
                    rel_imbalance_pct >= (self.config.sensor_imbalance_ratio_threshold * 100.0)):
                self.imbalance_persistence_count += 1
                if self.imbalance_persistence_count >= self.config.sensor_imbalance_persistence_cycles:
                    imbalance_flag = True
            else:
                self.imbalance_persistence_count = 0
        else:
            self.imbalance_persistence_count = 0

        # If sustained imbalance is confirmed on straight pipe, report instrument fault
        if imbalance_flag:
            return self._build_result(
                status=BlockageStatus.SENSOR_IMBALANCE,
                severity="ADVISORY",
                reason=(
                    f"Sustained discrepancy between upstream S1 ({sensor_1_flow:.2f} L/min) "
                    f"and downstream S2 ({sensor_2_flow:.2f} L/min) on unbranched straight pipe "
                    f"(diff={flow_diff:.2f} L/min, {rel_imbalance_pct:.1f}%). "
                    "Indicates pinwheel friction, debris fouling, or calibration drift; "
                    "does NOT confirm hydraulic blockage or pipe rupture."
                ),
                sensor_1=sensor_1_flow,
                sensor_2=sensor_2_flow,
                pump_status=pump_stat,
                timestamp=timestamp,
                is_simulated=is_simulated,
                flow_difference=flow_diff,
                relative_imbalance_pct=rel_imbalance_pct,
                action_category="SENSOR_CALIBRATION_CHECK",
                action_text="Inspect pinwheels on both YF-S201 sensors for mechanical binding or scale; cross-calibrate pulse factors against timed volumetric bucket test.",
                action_rationale="Conservation of mass requires identical flow on an unbranched pipe; discrepancy indicates measurement error rather than validated obstruction."
            )

        # -------------------------------------------------------------
        # 6. Representative Flow & Low-Flow Screening
        # -------------------------------------------------------------
        if sensor_1_flow is not None and sensor_2_flow is not None:
            rep_flow = (sensor_1_flow + sensor_2_flow) / 2.0
        elif sensor_1_flow is not None:
            rep_flow = sensor_1_flow
        else:
            rep_flow = sensor_2_flow

        low_flow_threshold = self.config.baseline_flow_l_per_min * self.config.low_flow_ratio_threshold

        if pump_stat == PumpStatus.PUMP_OFF:
            self.low_flow_persistence_count = 0
        elif rep_flow < low_flow_threshold:
            self.low_flow_persistence_count += 1
        else:
            self.low_flow_persistence_count = 0

        # -------------------------------------------------------------
        # 7. Operational Condition & Pump Contextualization
        # -------------------------------------------------------------
        # Case A: Sustained Low Flow with Pump Running -> Candidate Blockage
        if self.low_flow_persistence_count >= self.config.low_flow_persistence_cycles:
            if pump_stat == PumpStatus.PUMP_RUNNING:
                return self._build_result(
                    status=BlockageStatus.SUSTAINED_LOW_FLOW,
                    severity="WARNING",
                    reason=(
                        f"Pump active but flow rate ({rep_flow:.2f} L/min) is sustained below 50% "
                        f"of operating baseline ({self.config.baseline_flow_l_per_min} L/min) "
                        f"for {self.low_flow_persistence_count} consecutive cycles. "
                        "Potential hydraulic constriction, closed manual valve, or pipe blockage."
                    ),
                    sensor_1=sensor_1_flow,
                    sensor_2=sensor_2_flow,
                    pump_status=pump_stat,
                    timestamp=timestamp,
                    is_simulated=is_simulated,
                    flow_difference=flow_diff,
                    relative_imbalance_pct=rel_imbalance_pct,
                    rep_flow=rep_flow,
                    action_category="MANUAL_PIPE_INSPECTION",
                    action_text="Check upstream pump suction strainer for debris clogging; inspect inline manual ball valves and check for partial pipe obstruction.",
                    action_rationale="Flow rate is substantially below pump rating under sustained energized operation."
                )

            # Case B: Pump Status Unavailable -> Uncertain Advisory
            elif pump_stat == PumpStatus.UNKNOWN:
                return self._build_result(
                    status=BlockageStatus.UNCERTAIN_OPERATING_STATE,
                    severity="ADVISORY",
                    reason=(
                        f"Sustained low flow ({rep_flow:.2f} L/min) observed, but pump operating status is UNKNOWN. "
                        "Cannot distinguish between unpowered pump idle state and active-duty hydraulic blockage."
                    ),
                    sensor_1=sensor_1_flow,
                    sensor_2=sensor_2_flow,
                    pump_status=pump_stat,
                    timestamp=timestamp,
                    is_simulated=is_simulated,
                    flow_difference=flow_diff,
                    relative_imbalance_pct=rel_imbalance_pct,
                    rep_flow=rep_flow,
                    action_category="PUMP_STATUS_VERIFICATION",
                    action_text="Verify pump electrical relay / power supply status before dispatching physical pipe inspection.",
                    action_rationale="Low flow is expected when pump is powered off; pump running state must be confirmed before claiming blockage."
                )

            # Case C: Pump Off -> Nominal Idle
            elif pump_stat == PumpStatus.PUMP_OFF:
                return self._build_result(
                    status=BlockageStatus.NOMINAL_IDLE,
                    severity="INFO",
                    reason=f"Pump is switched off; low/zero flow ({rep_flow:.2f} L/min) represents expected nominal idle state.",
                    sensor_1=sensor_1_flow,
                    sensor_2=sensor_2_flow,
                    pump_status=pump_stat,
                    timestamp=timestamp,
                    is_simulated=is_simulated,
                    flow_difference=flow_diff,
                    relative_imbalance_pct=rel_imbalance_pct,
                    rep_flow=rep_flow,
                    action_category="ROUTINE_STANDBY",
                    action_text="Maintain standard bench standby monitoring; pump is currently inactive.",
                    action_rationale="Zero or trace flow conforms to powered-down pump state."
                )

        # Case D: Nominal Operating Flow or Idle
        if pump_stat == PumpStatus.PUMP_OFF and rep_flow < 1.0:
            status = BlockageStatus.NOMINAL_IDLE
            msg = f"System idle: pump inactive, flow is {rep_flow:.2f} L/min."
            action_cat = "ROUTINE_STANDBY"
            action_desc = "Maintain standard bench standby monitoring; pump is currently inactive."
            action_why = "Zero or trace flow conforms to powered-down pump state."
        elif rep_flow < low_flow_threshold:
            status = BlockageStatus.NOMINAL
            msg = (
                f"Transient low flow: average flow ({rep_flow:.2f} L/min) is below threshold "
                f"({low_flow_threshold:.2f} L/min) for {self.low_flow_persistence_count}/"
                f"{self.config.low_flow_persistence_cycles} cycles; persistence threshold not yet reached."
            )
            action_cat = "ROUTINE_MONITORING"
            action_desc = "Maintain standard bench supervisory telemetry polling; straight-pipe prototype is operating nominally."
            action_why = "Low flow observed but has not yet met the persistence threshold for sustained alert."
        else:
            status = BlockageStatus.NOMINAL
            msg = f"Nominal flow: average flow ({rep_flow:.2f} L/min) conforms to operating baseline ({self.config.baseline_flow_l_per_min} L/min)."
            action_cat = "ROUTINE_MONITORING"
            action_desc = "Maintain standard bench supervisory telemetry polling; straight-pipe prototype is operating nominally."
            action_why = "Sensors agree within tolerance and flow is consistent with operating mode."

        return self._build_result(
            status=status,
            severity="INFO",
            reason=msg,
            sensor_1=sensor_1_flow,
            sensor_2=sensor_2_flow,
            pump_status=pump_stat,
            timestamp=timestamp,
            is_simulated=is_simulated,
            flow_difference=flow_diff,
            relative_imbalance_pct=rel_imbalance_pct,
            rep_flow=rep_flow,
            action_category=action_cat,
            action_text=action_desc,
            action_rationale=action_why
        )

    def _build_result(
        self,
        status: BlockageStatus,
        severity: str,
        reason: str,
        sensor_1: Optional[float],
        sensor_2: Optional[float],
        pump_status: PumpStatus,
        timestamp: Optional[Union[str, datetime]],
        is_simulated: bool,
        action_category: str,
        action_text: str,
        action_rationale: str,
        flow_difference: Optional[float] = None,
        relative_imbalance_pct: Optional[float] = None,
        rep_flow: Optional[float] = None
    ) -> Dict[str, Any]:
        """Constructs standardized, explainable response payload."""
        iso_ts = timestamp.isoformat() if isinstance(timestamp, datetime) else str(timestamp or datetime.now(timezone.utc).isoformat())

        return {
            "status": status.value,
            "severity": severity,
            "reason": reason,
            "is_simulated": is_simulated,
            "simulation_disclaimer": (
                "Hardware prototype simulated telemetry (YF-S201 bench circuit). "
                "Not validated against live physical municipal blockage events."
                if is_simulated else "Live bench prototype telemetry."
            ),
            "input_readings": {
                "timestamp": iso_ts,
                "sensor_1_flow": sensor_1,
                "sensor_2_flow": sensor_2,
                "flow_unit": FlowUnit.L_PER_MIN.value,
                "pump_status": pump_status.value,
                "flow_difference_l_per_min": round(flow_difference, 3) if flow_difference is not None else None,
                "relative_imbalance_pct": round(relative_imbalance_pct, 1) if relative_imbalance_pct is not None else None,
                "representative_flow_l_per_min": round(rep_flow, 3) if rep_flow is not None else None
            },
            "evidence": {
                "baseline_flow_l_per_min": self.config.baseline_flow_l_per_min,
                "low_flow_threshold_l_per_min": self.config.baseline_flow_l_per_min * self.config.low_flow_ratio_threshold,
                "low_flow_persistence_cycles": self.low_flow_persistence_count,
                "required_persistence_cycles": self.config.low_flow_persistence_cycles,
                "imbalance_persistence_cycles": self.imbalance_persistence_count,
                "sensor_imbalance_detected": (status == BlockageStatus.SENSOR_IMBALANCE),
                "sustained_low_flow_detected": (status == BlockageStatus.SUSTAINED_LOW_FLOW)
            },
            "recommended_human_action": {
                "priority": 1 if severity == "WARNING" else (2 if severity == "ADVISORY" else 3),
                "category": action_category,
                "action": action_text,
                "rationale": action_rationale,
                "safety_critical": False,
                "requires_human_confirmation": True,
                "execution_mode": "DECISION_SUPPORT_ONLY"
            }
        }

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
