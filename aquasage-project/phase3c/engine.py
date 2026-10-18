"""
Phase 3C: AquaSage Unified Decision & Recommendation Engine.
Synthesizes telemetry and inferences from:
1. Flow Leak Anomaly Detector (Phase 3A)
2. Simulated Hydraulic Tank Level Forecaster (Phase 3B)
3. Exploratory Water Quality Analysis (Phase 3B)

Applies explainable, rule-based reasoning, data-quality auditing,
multi-system compounded risk escalation, and generates concrete operator actions.
"""

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple

from phase3c.config import (
    EngineConfig,
    SeverityLevel,
    SourceType,
    DataQualityStatus
)


class AquaSageDecisionEngine:
    """
    Modular, Explainable Rule-Based Water Management Decision Engine.
    Evaluates subsystem inputs independently, assesses data quality,
    identifies cross-system compounding risks, and produces prioritized operator directives.
    """

    def __init__(self, config: Optional[EngineConfig] = None):
        self.config = config or EngineConfig()

    def evaluate(
        self,
        flow_data: Optional[Dict[str, Any]] = None,
        tank_data: Optional[Dict[str, Any]] = None,
        wq_data: Optional[Dict[str, Any]] = None,
        reference_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main decision evaluation entrypoint.
        Consumes telemetry payloads, evaluates rules, and returns structured decision payload.
        """
        ref_dt = self._parse_iso(reference_time) if reference_time else datetime.now(timezone.utc)
        if reference_time:
            # Deterministic ID based on inputs for reproducibility
            id_seed = f"{reference_time}:{flow_data}:{tank_data}:{wq_data}"
            decision_id = f"DEC-{hashlib.sha256(id_seed.encode('utf-8')).hexdigest()[:8].upper()}"
        else:
            decision_id = f"DEC-{uuid.uuid4().hex[:8].upper()}"


        # 1. Subsystem Independent Evaluations
        flow_eval = self._evaluate_flow(flow_data, ref_dt)
        tank_eval = self._evaluate_tank(tank_data, ref_dt)
        wq_eval = self._evaluate_wq(wq_data, ref_dt)

        # 2. Multi-System Compounded Risk Escalation
        escalation, escalated_severity, escalation_reasons = self._evaluate_compounding_risks(
            flow_eval, tank_eval, wq_eval
        )

        # 3. Determine Overall Severity
        sub_severities = [
            flow_eval.get('severity', SeverityLevel.INFO),
            tank_eval.get('severity', SeverityLevel.INFO),
            wq_eval.get('severity', SeverityLevel.INFO)
        ]
        if escalated_severity:
            sub_severities.append(escalated_severity)

        overall_severity = self._max_severity(sub_severities)

        # 4. Synthesize Prioritized Operator Directives
        actions = self._prioritize_actions(
            flow_eval, tank_eval, wq_eval, escalation, escalation_reasons, overall_severity
        )

        # 5. Compile Evidence Summary
        consolidated_evidence = self._compile_evidence(
            flow_eval, tank_eval, wq_eval, escalation_reasons
        )

        # 6. Overall System State
        system_status = self._derive_system_status(overall_severity, flow_eval, tank_eval, wq_eval)

        return {
            'decision_id': decision_id,
            'timestamp': ref_dt.isoformat(),
            'overall_severity': overall_severity.value,
            'system_status': system_status,
            'compounded_escalation_active': escalation,
            'escalation_reasons': escalation_reasons,
            'subsystems': {
                'flow_leak_detection': flow_eval,
                'tank_level_forecasting': tank_eval,
                'water_quality_assessment': wq_eval
            },
            'consolidated_evidence': consolidated_evidence,
            'prioritized_operator_actions': actions
        }

    # -------------------------------------------------------------------------
    # Subsystem 1: Flow Anomaly / Leak Evaluation
    # -------------------------------------------------------------------------
    def _evaluate_flow(self, data: Optional[Dict[str, Any]], ref_dt: datetime) -> Dict[str, Any]:
        if not data:
            return {
                'status': DataQualityStatus.INSUFFICIENT_DATA.value,
                'severity': SeverityLevel.INFO.value,
                'source_type': None,
                'message': 'No flow telemetry provided for evaluation.'
            }

        # Check source type
        source_type = data.get('source_type', SourceType.LIVE_TELEMETRY.value)

        # Timestamp & Staleness check
        ts_str = data.get('timestamp')
        data_dt = self._parse_iso(ts_str) if ts_str else None
        if not data_dt:
            return {
                'status': DataQualityStatus.INSUFFICIENT_DATA.value,
                'severity': SeverityLevel.WARNING.value,
                'source_type': source_type,
                'message': 'Flow telemetry missing timestamp.'
            }

        age_minutes = abs((ref_dt - data_dt).total_seconds()) / 60.0
        if age_minutes > self.config.flow.max_stale_minutes:
            return {
                'status': DataQualityStatus.STALE.value,
                'severity': SeverityLevel.ADVISORY.value,
                'source_type': source_type,
                'age_minutes': round(age_minutes, 1),
                'message': f"Flow telemetry is stale ({round(age_minutes, 1)} min old, limit {self.config.flow.max_stale_minutes} min)."
            }

        flow = data.get('flow_m3h')
        pred_flow = data.get('predicted_flow_m3h')
        score = data.get('anomaly_score')
        threshold = data.get('threshold', self.config.flow.calibrated_threshold)
        persistence = data.get('persistence_hours', 0)

        if flow is None or score is None:
            return {
                'status': DataQualityStatus.INSUFFICIENT_DATA.value,
                'severity': SeverityLevel.WARNING.value,
                'source_type': source_type,
                'message': 'Flow or anomaly score is missing from telemetry payload.'
            }

        # Physical plausibility / conflicting telemetry check
        if (
            flow < self.config.flow.min_plausible_flow_m3h or
            flow > self.config.flow.max_plausible_flow_m3h or
            score < 0.0
        ):
            return {
                'status': DataQualityStatus.CONFLICTING.value,
                'severity': SeverityLevel.WARNING.value,
                'source_type': source_type,
                'message': f"Conflicting flow telemetry: physically implausible reading (flow={flow} m³/h, score={score}). Instrument diagnostic or zero-calibration required."
            }

        excess_flow = max(0.0, flow - (pred_flow if pred_flow is not None else flow))
        is_elevated = score >= threshold

        evidence = {
            'current_flow_m3h': flow,
            'predicted_normal_m3h': pred_flow,
            'excess_flow_m3h': round(excess_flow, 2),
            'anomaly_score': round(score, 3),
            'calibrated_threshold': round(threshold, 3),
            'persistence_hours': persistence,
            'source_type': source_type,
            'leak_evidence_note': 'Score represents statistical residual deviation; not guaranteed leak probability.'
        }

        if not is_elevated:
            return {
                'status': DataQualityStatus.VALID.value,
                'severity': SeverityLevel.INFO.value,
                'leak_suspected': False,
                'source_type': source_type,
                'evidence': evidence,
                'message': 'Flow patterns conform to normal diurnal model.'
            }

        # Elevated anomaly score logic
        if persistence >= self.config.flow.critical_hours or excess_flow >= self.config.flow.excess_flow_critical_m3h:
            severity = SeverityLevel.CRITICAL
            msg = f"Critical flow anomaly: persistent excess flow (+{round(excess_flow, 1)} m³/h) over {persistence} hrs."
            leak_suspected = True
        elif persistence >= self.config.flow.warning_hours:
            severity = SeverityLevel.WARNING
            msg = f"Warning: sustained flow deviation (+{round(excess_flow, 1)} m³/h) over {persistence} hrs."
            leak_suspected = True
        elif persistence >= self.config.flow.advisory_hours:
            severity = SeverityLevel.ADVISORY
            msg = f"Advisory: flow deviation detected (score {round(score, 2)} >= {round(threshold, 2)}) for {persistence} hrs."
            leak_suspected = True
        else:
            severity = SeverityLevel.INFO
            msg = f"Transient flow elevation (score {round(score, 2)} >= {round(threshold, 2)}) below advisory persistence limit ({self.config.flow.advisory_hours} hr)."
            leak_suspected = False

        return {
            'status': DataQualityStatus.VALID.value,
            'severity': severity.value,
            'leak_suspected': leak_suspected,
            'source_type': source_type,
            'evidence': evidence,
            'message': msg
        }


    # -------------------------------------------------------------------------
    # Subsystem 2: Tank Level Forecasting Evaluation
    # -------------------------------------------------------------------------
    def _evaluate_tank(self, data: Optional[Dict[str, Any]], ref_dt: datetime) -> Dict[str, Any]:
        if not data:
            return {
                'status': DataQualityStatus.INSUFFICIENT_DATA.value,
                'severity': SeverityLevel.INFO.value,
                'source_type': None,
                'message': 'No tank telemetry provided for evaluation.'
            }

        # CRITICAL VERIFICATION: Must explicitly flag simulated data
        source_type = data.get('source_type', SourceType.SIMULATED_HYDRAULIC_MODEL.value)
        is_simulated = (source_type == SourceType.SIMULATED_HYDRAULIC_MODEL.value) or data.get('is_simulated', True)

        ts_str = data.get('timestamp')
        data_dt = self._parse_iso(ts_str) if ts_str else None
        if not data_dt:
            return {
                'status': DataQualityStatus.INSUFFICIENT_DATA.value,
                'severity': SeverityLevel.WARNING.value,
                'source_type': source_type,
                'message': 'Tank telemetry missing timestamp.'
            }

        age_minutes = abs((ref_dt - data_dt).total_seconds()) / 60.0
        if age_minutes > self.config.tank.max_stale_minutes:
            return {
                'status': DataQualityStatus.STALE.value,
                'severity': SeverityLevel.ADVISORY.value,
                'source_type': source_type,
                'age_minutes': round(age_minutes, 1),
                'message': f"Tank readings are stale ({round(age_minutes, 1)} min old)."
            }

        level = data.get('current_level_m')
        f5 = data.get('forecast_5m')
        f15 = data.get('forecast_15m')
        f30 = data.get('forecast_30m')
        inflow = data.get('inflow_m3h', 0.0)
        outflow = data.get('outflow_m3h', 0.0)

        if level is None:
            return {
                'status': DataQualityStatus.INSUFFICIENT_DATA.value,
                'severity': SeverityLevel.WARNING.value,
                'source_type': source_type,
                'message': 'Current tank level is missing from payload.'
            }

        # Physical plausibility / conflicting telemetry check
        forecasts = [f for f in [f5, f15, f30] if f is not None]
        all_levels = [level] + forecasts
        if any(lvl < self.config.tank.min_plausible_level_m or lvl > self.config.tank.max_plausible_level_m for lvl in all_levels):
            return {
                'status': DataQualityStatus.CONFLICTING.value,
                'severity': SeverityLevel.WARNING.value,
                'source_type': source_type,
                'message': f"Conflicting tank telemetry: level reading outside structural physical bounds ([0, {self.config.tank.max_plausible_level_m}]m). Level sensor failure suspected."
            }

        evidence = {
            'current_level_m': round(level, 2),
            'forecast_5m_level_m': round(f5, 2) if f5 is not None else None,
            'forecast_15m_level_m': round(f15, 2) if f15 is not None else None,
            'forecast_30m_level_m': round(f30, 2) if f30 is not None else None,
            'inflow_rate_m3h': inflow,
            'outflow_demand_m3h': outflow,
            'net_flow_m3h': round(inflow - outflow, 2),
            'is_simulated_model': is_simulated,
            'source_type': source_type,
            'simulation_disclaimer': 'Tank levels and forecasts are derived from mass-balance hydraulic simulation, NOT physical level sensors.'
        }

        min_projected = min(forecasts) if forecasts else level
        max_projected = max(forecasts) if forecasts else level

        # 1. Critical Low / Cavitation hazard
        if level <= self.config.tank.critical_low_m or min_projected <= self.config.tank.critical_low_m:
            return {
                'status': DataQualityStatus.VALID.value,
                'severity': SeverityLevel.CRITICAL.value,
                'hazard_type': 'CRITICAL_DEPLETION',
                'source_type': source_type,
                'evidence': evidence,
                'message': f"Critical Tank Depletion [SIMULATED]: Projected level drops to {round(min_projected, 2)}m (<= {self.config.tank.critical_low_m}m limit) within 30 min."
            }

        # 2. Critical High / Overflow hazard
        if level >= self.config.tank.critical_high_m or max_projected >= self.config.tank.critical_high_m:
            return {
                'status': DataQualityStatus.VALID.value,
                'severity': SeverityLevel.CRITICAL.value,
                'hazard_type': 'CRITICAL_OVERFLOW',
                'source_type': source_type,
                'evidence': evidence,
                'message': f"Critical Tank Overflow Hazard [SIMULATED]: Projected level reaches {round(max_projected, 2)}m (>= {self.config.tank.critical_high_m}m limit)."
            }

        # 3. Advisory Low
        if min_projected <= self.config.tank.advisory_low_m:
            return {
                'status': DataQualityStatus.VALID.value,
                'severity': SeverityLevel.WARNING.value,
                'hazard_type': 'STORAGE_DEPLETION_WARNING',
                'source_type': source_type,
                'evidence': evidence,
                'message': f"Storage Depletion Warning [SIMULATED]: Level declining toward {round(min_projected, 2)}m (<= {self.config.tank.advisory_low_m}m advisory limit)."
            }

        # 4. Advisory High
        if max_projected >= self.config.tank.advisory_high_m:
            return {
                'status': DataQualityStatus.VALID.value,
                'severity': SeverityLevel.ADVISORY.value,
                'hazard_type': 'HIGH_STORAGE_ADVISORY',
                'source_type': source_type,
                'evidence': evidence,
                'message': f"High Storage Advisory [SIMULATED]: Projected level reaches {round(max_projected, 2)}m."
            }

        return {
            'status': DataQualityStatus.VALID.value,
            'severity': SeverityLevel.INFO.value,
            'hazard_type': 'NOMINAL',
            'source_type': source_type,
            'evidence': evidence,
            'message': f"Tank storage nominal [SIMULATED]: Level steady at {round(level, 2)}m."
        }

    # -------------------------------------------------------------------------
    # Subsystem 3: Water Quality Assessment
    # -------------------------------------------------------------------------
    def _evaluate_wq(self, data: Optional[Dict[str, Any]], ref_dt: datetime) -> Dict[str, Any]:
        if not data:
            return {
                'status': DataQualityStatus.INSUFFICIENT_DATA.value,
                'severity': SeverityLevel.INFO.value,
                'source_type': None,
                'message': 'No water quality sampling data provided.'
            }

        source_type = data.get('source_type', SourceType.FIELD_GRAB_SAMPLE.value)

        # Handle uncollected remarks (e.g. low water level)
        uncollected_remark = data.get('uncollected_remark')
        if uncollected_remark:
            return {
                'status': DataQualityStatus.UNCOLLECTED_SAMPLE.value,
                'severity': SeverityLevel.WARNING.value,
                'source_type': source_type,
                'station_id': data.get('station_id', 'UNKNOWN'),
                'uncollected_reason': uncollected_remark,
                'message': f"Field sample uncollected at {data.get('station_id')}: '{uncollected_remark}'. Intake inspection required."
            }

        ts_str = data.get('timestamp')
        data_dt = self._parse_iso(ts_str) if ts_str else None
        if not data_dt:
            return {
                'status': DataQualityStatus.INSUFFICIENT_DATA.value,
                'severity': SeverityLevel.ADVISORY.value,
                'source_type': source_type,
                'message': 'Water quality record missing date/timestamp.'
            }

        age_days = abs((ref_dt - data_dt).total_seconds()) / 86400.0
        is_stale = age_days > self.config.wq.max_sample_age_days

        # Prevent stale historical grab samples from triggering active critical emergencies
        if is_stale:
            return {
                'status': DataQualityStatus.STALE.value,
                'severity': SeverityLevel.ADVISORY.value,
                'source_type': source_type,
                'station_id': data.get('station_id', 'UNKNOWN'),
                'evidence': {
                    'station_id': data.get('station_id', 'UNKNOWN'),
                    'sample_age_days': round(age_days, 1),
                    'max_sample_age_days': self.config.wq.max_sample_age_days,
                    'source_type': source_type,
                    'note': 'Historical water quality sample is expired. Cannot evaluate active water safety from stale readings. Fresh grab sample required.',
                    'stale_disclaimer': 'Historical water quality sample is expired. Cannot confirm active emergency from stale grab sample; fresh grab sample required.'
                },
                'message': f"Water quality grab sample is stale ({round(age_days, 1)} days old, validity window {self.config.wq.max_sample_age_days} days). Dispatch field technician for fresh sampling."
            }

        ph = data.get('ph')
        turb = data.get('turbidity_ntu')
        cond = data.get('conductivity_us_cm')
        do = data.get('dissolved_oxygen_mg_l')
        tds = data.get('tds_mg_l')

        # Check core parameter availability
        if ph is None and turb is None and cond is None and do is None:
            return {
                'status': DataQualityStatus.INSUFFICIENT_DATA.value,
                'severity': SeverityLevel.WARNING.value,
                'source_type': source_type,
                'message': 'All core physicochemical water quality parameters are missing.'
            }

        # Physical / chemical plausibility checks
        conflicting_params = []
        if ph is not None and (ph < self.config.wq.ph_plausible_min or ph > self.config.wq.ph_plausible_max):
            conflicting_params.append(f"pH={ph} (physically impossible; valid range 0-14)")
        if do is not None and (do < 0.0 or do > self.config.wq.do_plausible_max):
            conflicting_params.append(f"DO={do} mg/L (physically impossible; valid range 0-25)")
        if turb is not None and turb < 0.0:
            conflicting_params.append(f"Turbidity={turb} NTU (cannot be negative)")
        if cond is not None and cond < 0.0:
            conflicting_params.append(f"Conductivity={cond} µS/cm (cannot be negative)")
        if tds is not None and (tds < 0.0 or tds > self.config.wq.tds_plausible_max):
            conflicting_params.append(f"TDS={tds} mg/L (physically implausible; valid range 0-{self.config.wq.tds_plausible_max})")

        if conflicting_params:
            return {
                'status': DataQualityStatus.CONFLICTING.value,
                'severity': SeverityLevel.WARNING.value,
                'source_type': source_type,
                'station_id': data.get('station_id', 'UNKNOWN'),
                'message': f"Conflicting water quality telemetry: physically impossible parameters ({'; '.join(conflicting_params)}). Probe recalibration required."
            }

        violations = []
        is_critical = False

        if ph is not None:
            if ph < self.config.wq.ph_min or ph > self.config.wq.ph_max:
                if ph > self.config.wq.ph_critical_high:
                    violations.append(f"CRITICAL: Severe Alkaline/Caustic pH {ph:.2f} (> {self.config.wq.ph_critical_high})")
                    is_critical = True
                elif ph < self.config.wq.ph_critical_low:
                    violations.append(f"CRITICAL: Severe Acidic/Corrosive pH {ph:.2f} (< {self.config.wq.ph_critical_low})")
                    is_critical = True
                else:
                    violations.append(f"pH out of guideline range ({ph:.2f}, limit {self.config.wq.ph_min}-{self.config.wq.ph_max})")

        if turb is not None:
            if turb > self.config.wq.turbidity_max_ntu:
                violations.append(f"Turbidity elevated ({turb:.1f} NTU, WHO limit {self.config.wq.turbidity_max_ntu} NTU)")
            if turb >= self.config.wq.turbidity_critical_ntu:
                is_critical = True  # Severe particulate loading shielding pathogens

        if do is not None:
            if do < self.config.wq.do_min_mg_l:
                violations.append(f"Dissolved oxygen depressed ({do:.2f} mg/L, min target {self.config.wq.do_min_mg_l} mg/L)")
            if do <= self.config.wq.do_hypoxia_mg_l:
                is_critical = True  # Severe stagnation / hypoxia

        if cond is not None:
            if cond > self.config.wq.conductivity_max_us_cm:
                violations.append(f"Conductivity elevated ({cond:.1f} µS/cm, limit {self.config.wq.conductivity_max_us_cm} µS/cm)")
            if cond >= self.config.wq.conductivity_critical_us_cm:
                is_critical = True  # Contaminant / saline intrusion

        if tds is not None:
            if tds >= self.config.wq.tds_critical_mg_l:
                violations.append(f"CRITICAL: TDS {tds:.1f} mg/L exceeds Critical Palatability/Salinity Limit ({self.config.wq.tds_critical_mg_l:.0f} mg/L)")
                is_critical = True  # Extreme mineralization / unpalatable threshold
            elif tds > self.config.wq.tds_max_mg_l:
                violations.append(f"TDS {tds:.1f} mg/L exceeds EPA Secondary Aesthetic / WHO Recommended Limit ({self.config.wq.tds_max_mg_l:.0f} mg/L)")

        evidence = {
            'station_id': data.get('station_id', 'UNKNOWN'),
            'ph': ph,
            'turbidity_ntu': turb,
            'conductivity_us_cm': cond,
            'dissolved_oxygen_mg_l': do,
            'tds_mg_l': tds,
            'violations_count': len(violations),
            'violations': violations,
            'violation_details': violations,
            'sample_age_days': round(age_days, 1),
            'source_type': source_type,
            'disclaimer': 'Exploratory field grab sample screening (N=29 baseline). Does NOT certify microbiological potable safety.'
        }

        if is_critical or len(violations) >= 3:
            severity = SeverityLevel.CRITICAL
            msg = f"Critical water quality contamination alert: {len(violations)} guideline exceedances ({'; '.join(violations[:2])})."
        elif len(violations) >= 2:
            severity = SeverityLevel.WARNING
            msg = f"Water quality warning: multiple parameter deviations ({'; '.join(violations)})."
        elif len(violations) == 1:
            severity = SeverityLevel.ADVISORY
            msg = f"Water quality advisory: {violations[0]}."
        else:
            severity = SeverityLevel.INFO
            msg = "Water quality parameters conform to WHO/EPA potable guidelines and aesthetic standards."

        return {
            'status': DataQualityStatus.VALID.value,
            'severity': severity.value,
            'source_type': source_type,
            'evidence': evidence,
            'message': msg
        }


    # -------------------------------------------------------------------------
    # Compounding Risks & System Escalation
    # -------------------------------------------------------------------------
    def _evaluate_compounding_risks(
        self,
        flow_eval: Dict[str, Any],
        tank_eval: Dict[str, Any],
        wq_eval: Dict[str, Any]
    ) -> Tuple[bool, Optional[SeverityLevel], List[str]]:
        """
        Detects compound interactions across subsystems where separate minor warnings
        combine into high-priority operational emergencies.
        """
        reasons = []
        is_escalated = False

        leak_active = flow_eval.get('leak_suspected', False)
        tank_hazard = tank_eval.get('hazard_type', '')
        tank_low = tank_hazard in ['CRITICAL_DEPLETION', 'STORAGE_DEPLETION_WARNING'] or (
            tank_eval.get('evidence', {}).get('forecast_30m_level_m') is not None and
            tank_eval['evidence']['forecast_30m_level_m'] <= self.config.tank.advisory_low_m
        )
        wq_critical = wq_eval.get('severity') == SeverityLevel.CRITICAL.value

        # Compound Case A: Active Leak + Depleting Reservoir Tank
        # A network leak while storage is depleting leads to catastrophic de-pressurization
        if leak_active and tank_low:
            is_escalated = True
            reasons.append(
                "COMPOUND CRITICAL HAZARD: Active distribution leak coincides with reservoir storage depletion. "
                "Risk of complete distribution de-pressurization and back-siphonage."
            )

        # Compound Case B: Depleting Tank + Low DO / Water Quality Hazard
        # Drawing the bottom of a stagnant reservoir distributes contaminated sludge into mains
        if tank_low and wq_critical:
            is_escalated = True
            reasons.append(
                "COMPOUND WATER QUALITY HAZARD: Reservoir operating near minimum buffer while water quality is compromised. "
                "High risk of distributing sediment and hypoxic water into municipal mains."
            )

        escalated_severity = SeverityLevel.CRITICAL if is_escalated else None
        return is_escalated, escalated_severity, reasons

    # -------------------------------------------------------------------------
    # Action Prioritization
    # -------------------------------------------------------------------------
    @staticmethod
    def _create_action(
        priority: int,
        category: str,
        action: str,
        rationale: str,
        safety_critical: bool = False,
        requires_human_confirmation: bool = False
    ) -> Dict[str, Any]:
        return {
            'priority': priority,
            'category': category,
            'action': action,
            'rationale': rationale,
            'safety_critical': safety_critical,
            'requires_human_confirmation': requires_human_confirmation,
            'execution_mode': 'DECISION_SUPPORT_ONLY'
        }

    def _prioritize_actions(
        self,
        flow_eval: Dict[str, Any],
        tank_eval: Dict[str, Any],
        wq_eval: Dict[str, Any],
        escalation: bool,
        escalation_reasons: List[str],
        overall_severity: SeverityLevel
    ) -> List[Dict[str, Any]]:
        actions = []
        priority = 1

        # 1. Compounded priority directives (SAFETY CRITICAL)
        if escalation:
            for r in escalation_reasons:
                actions.append(self._create_action(
                    priority=priority,
                    category='COMPOUNDED_SYSTEM_EMERGENCY',
                    action='Activate emergency supply protocol: Override pump station to maximum refill, isolate DMA rupture sector immediately, and alert municipal operations coordinator.',
                    rationale=r,
                    safety_critical=True,
                    requires_human_confirmation=True
                ))
                priority += 1

        # 2. Data Quality & Instrument Diagnostics
        for sub_name, sub_eval in [
            ('flow_leak_detection', flow_eval),
            ('tank_level_forecasting', tank_eval),
            ('water_quality_assessment', wq_eval)
        ]:
            if sub_eval.get('status') == DataQualityStatus.CONFLICTING.value:
                actions.append(self._create_action(
                    priority=priority,
                    category='INSTRUMENT_DIAGNOSTIC',
                    action=f"Flag {sub_name} channel for immediate probe diagnostic and recalibration; telemetry reading violates physical domain constraints.",
                    rationale=sub_eval.get('message', 'Conflicting telemetry values detected.'),
                    safety_critical=False,
                    requires_human_confirmation=False
                ))
                priority += 1
            elif sub_eval.get('status') == DataQualityStatus.STALE.value:
                if sub_name == 'water_quality_assessment':
                    station = sub_eval.get('station_id') or sub_eval.get('evidence', {}).get('station_id', 'station')
                    age_d = sub_eval.get('evidence', {}).get('sample_age_days', 'N/A')
                    actions.append(self._create_action(
                        priority=priority,
                        category='WATER_QUALITY_RESAMPLING',
                        action=f"Dispatch field technician to collect fresh grab sample at {station}; existing record is expired ({age_d} days old).",
                        rationale=sub_eval.get('message', 'Water quality sample is stale.'),
                        safety_critical=False,
                        requires_human_confirmation=False
                    ))
                else:
                    actions.append(self._create_action(
                        priority=priority,
                        category='COMMUNICATION_WATCH',
                        action=f"Inspect telemetry gateway transmission health for {sub_name}; readings exceed staleness tolerance.",
                        rationale=sub_eval.get('message', 'Telemetry latency high.'),
                        safety_critical=False,
                        requires_human_confirmation=False
                    ))
                priority += 1
            elif sub_eval.get('status') == DataQualityStatus.INSUFFICIENT_DATA.value and sub_eval.get('severity') == SeverityLevel.WARNING.value:
                actions.append(self._create_action(
                    priority=priority,
                    category='TELEMETRY_RECOVERY',
                    action=f"Verify RTU telemetry uplink and parameter schema for {sub_name}; essential fields missing.",
                    rationale=sub_eval.get('message', 'Telemetry data missing.'),
                    safety_critical=False,
                    requires_human_confirmation=False
                ))
                priority += 1

        # 3. Tank Directives (SAFETY CRITICAL for overrides / spillways)
        tank_sev = tank_eval.get('severity')
        tank_hazard = tank_eval.get('hazard_type', '')
        if tank_sev == SeverityLevel.CRITICAL.value:
            if tank_hazard == 'CRITICAL_OVERFLOW':
                actions.append(self._create_action(
                    priority=priority,
                    category='STORAGE_CONTROL',
                    action='Throttle or shut down supply inflow pumps immediately; open emergency spillway / bypass valve to prevent reservoir overflow.',
                    rationale=tank_eval.get('message', 'Overflow hazard imminent.'),
                    safety_critical=True,
                    requires_human_confirmation=True
                ))
                priority += 1
            else:
                f30 = tank_eval.get('evidence', {}).get('forecast_30m_level_m')
                actions.append(self._create_action(
                    priority=priority,
                    category='STORAGE_CONTROL',
                    action='Override pump station refill rate to maximum (52 m³/h); throttle pressure reducing valves on outflow mains.',
                    rationale=f"Tank level projected at {f30}m within 30 min (<= {self.config.tank.critical_low_m}m limit).",
                    safety_critical=True,
                    requires_human_confirmation=True
                ))
                priority += 1
        elif tank_sev == SeverityLevel.WARNING.value:
            actions.append(self._create_action(
                priority=priority,
                category='STORAGE_CONTROL',
                action='Schedule pump station activation within 15 minutes to replenish storage buffer above 4.5m.',
                rationale=tank_eval.get('message', 'Storage depletion trend detected.'),
                safety_critical=True,
                requires_human_confirmation=True
            ))
            priority += 1

        # 4. Leak Directives (SAFETY CRITICAL for main isolation)
        if flow_eval.get('leak_suspected', False):
            flow_sev = flow_eval.get('severity')
            if flow_sev in [SeverityLevel.CRITICAL.value, SeverityLevel.WARNING.value]:
                actions.append(self._create_action(
                    priority=priority,
                    category='LEAKAGE_REPAIR',
                    action='Dispatch acoustic ground-microphone leak inspection crew to Area 1 sector; isolate zone boundary valve V-102.',
                    rationale=flow_eval.get('message', 'Persistent flow excess detected.'),
                    safety_critical=True,
                    requires_human_confirmation=True
                ))
                priority += 1
            else:
                actions.append(self._create_action(
                    priority=priority,
                    category='LEAKAGE_MONITORING',
                    action='Log DMA inlet night-flow over next 03:00-05:00 window to confirm leak persistence.',
                    rationale='Flow score elevated above baseline threshold; monitoring required.',
                    safety_critical=False,
                    requires_human_confirmation=False
                ))
                priority += 1

        # 5. Water Quality Directives (SAFETY CRITICAL for boil-water notices)
        wq_sev = wq_eval.get('severity')
        if wq_eval.get('status') == DataQualityStatus.UNCOLLECTED_SAMPLE.value:
            actions.append(self._create_action(
                priority=priority,
                category='INTAKE_INSPECTION',
                action='Inspect sampling well intake level and depth sensor; rectify low water intake restriction.',
                rationale=wq_eval.get('message', 'Sample could not be collected.'),
                safety_critical=False,
                requires_human_confirmation=False
            ))
            priority += 1
        elif wq_sev == SeverityLevel.CRITICAL.value:
            wq_evidence = wq_eval.get('evidence', {})
            station = wq_evidence.get('station_id', 'network')
            ph_val = wq_evidence.get('ph')
            tds_val = wq_evidence.get('tds_mg_l')

            if ph_val is not None and ph_val > self.config.wq.ph_critical_high:
                actions.append(self._create_action(
                    priority=priority,
                    category='CHEMICAL_FEED_ADJUSTMENT',
                    action='Caustic overfeed hazard: Halt chemical alkalization feed pumps immediately; inspect lime/caustic soda dosing system and adjust acid neutralization dosing.',
                    rationale=wq_eval.get('message', 'Severe alkaline/caustic pH detected.'),
                    safety_critical=True,
                    requires_human_confirmation=True
                ))
                priority += 1
            elif tds_val is not None and tds_val >= self.config.wq.tds_critical_mg_l:
                actions.append(self._create_action(
                    priority=priority,
                    category='SOURCE_WATER_MANAGEMENT',
                    action='Severe mineralization / salinity: Divert high-TDS intake flow to secondary equalization or reverse-osmosis stage; isolate intake from main treated supply.',
                    rationale=wq_eval.get('message', 'Critical TDS salinity/mineralization threshold exceeded.'),
                    safety_critical=True,
                    requires_human_confirmation=True
                ))
                priority += 1
            else:
                actions.append(self._create_action(
                    priority=priority,
                    category='PUBLIC_HEALTH_ADVISORY',
                    action=f"Issue boil-water / non-potable drinking advisory for sector served by Station {station}; isolate sampling node and flush distribution line.",
                    rationale=wq_eval.get('message', 'Critical contamination detected.'),
                    safety_critical=True,
                    requires_human_confirmation=True
                ))
                priority += 1
        elif wq_sev == SeverityLevel.WARNING.value:
            actions.append(self._create_action(
                priority=priority,
                category='WATER_QUALITY_INSPECTION',
                action='Collect follow-up confirmatory grab sample within 24 hours; test for coliform bacteria and free chlorine residual.',
                rationale=wq_eval.get('message', 'Multiple parameter deviations.'),
                safety_critical=False,
                requires_human_confirmation=False
            ))
            priority += 1
        elif wq_sev == SeverityLevel.ADVISORY.value and wq_eval.get('status') == DataQualityStatus.VALID.value:
            wq_evidence = wq_eval.get('evidence', {})
            tds_val = wq_evidence.get('tds_mg_l')
            if tds_val is not None and tds_val > self.config.wq.tds_max_mg_l:
                actions.append(self._create_action(
                    priority=priority,
                    category='AESTHETIC_WATER_QUALITY',
                    action='TDS exceeds EPA Secondary Aesthetic guideline (500 mg/L); monitor distribution blending and customer taste/odor complaints.',
                    rationale=wq_eval.get('message', 'Aesthetic guideline exceedance.'),
                    safety_critical=False,
                    requires_human_confirmation=False
                ))
                priority += 1

        if not actions:
            actions.append(self._create_action(
                priority=1,
                category='ROUTINE_MONITORING',
                action='Maintain standard supervisory telemetry polling; all subsystem parameters operating within nominal specifications.',
                rationale='Zero anomalies or regulatory exceedances detected across flow, storage, and water quality.',
                safety_critical=False,
                requires_human_confirmation=False
            ))

        return actions

    # -------------------------------------------------------------------------
    # Evidence Compilation & Helpers
    # -------------------------------------------------------------------------
    def _compile_evidence(
        self,
        flow_eval: Dict[str, Any],
        tank_eval: Dict[str, Any],
        wq_eval: Dict[str, Any],
        escalation_reasons: List[str]
    ) -> List[str]:
        items = []
        if escalation_reasons:
            items.extend(escalation_reasons)
        if flow_eval.get('message'):
            items.append(f"FLOW: {flow_eval['message']}")
        if tank_eval.get('message'):
            items.append(f"TANK: {tank_eval['message']}")
        if wq_eval.get('message'):
            items.append(f"WATER_QUALITY: {wq_eval['message']}")
        return items

    def _derive_system_status(
        self,
        overall_severity: SeverityLevel,
        flow_eval: Dict[str, Any],
        tank_eval: Dict[str, Any],
        wq_eval: Dict[str, Any]
    ) -> str:
        has_degraded_telemetry = any(
            ev.get('status') in [
                DataQualityStatus.INSUFFICIENT_DATA.value,
                DataQualityStatus.STALE.value,
                DataQualityStatus.CONFLICTING.value,
                DataQualityStatus.UNCOLLECTED_SAMPLE.value
            ]
            for ev in [flow_eval, tank_eval, wq_eval]
        )

        if overall_severity == SeverityLevel.CRITICAL:
            return "SYSTEM_CRITICAL_EMERGENCY"
        if overall_severity == SeverityLevel.WARNING:
            has_physical_emergency = (
                flow_eval.get('leak_suspected', False) or
                tank_eval.get('hazard_type') in [
                    'CRITICAL_DEPLETION', 'CRITICAL_OVERFLOW',
                    'STORAGE_DEPLETION_WARNING', 'STORAGE_OVERFLOW_WARNING'
                ] or
                (wq_eval.get('status') == DataQualityStatus.VALID.value and
                 wq_eval.get('severity') in [SeverityLevel.WARNING.value, SeverityLevel.CRITICAL.value])
            )
            if has_degraded_telemetry and not has_physical_emergency:
                return "DEGRADED_TELEMETRY"
            return "OPERATIONAL_WARNING"
        if overall_severity == SeverityLevel.ADVISORY:
            if has_degraded_telemetry and not flow_eval.get('leak_suspected', False):
                return "DEGRADED_TELEMETRY"
            return "ATTENTION_REQUIRED"
        if has_degraded_telemetry:
            return "DEGRADED_TELEMETRY"
        return "ALL_SYSTEMS_NOMINAL"



    @staticmethod
    def _max_severity(severities: List[Any]) -> SeverityLevel:
        order = {
            SeverityLevel.INFO: 0,
            SeverityLevel.ADVISORY: 1,
            SeverityLevel.WARNING: 2,
            SeverityLevel.CRITICAL: 3,
            SeverityLevel.INFO.value: 0,
            SeverityLevel.ADVISORY.value: 1,
            SeverityLevel.WARNING.value: 2,
            SeverityLevel.CRITICAL.value: 3
        }
        valid = [s for s in severities if s in order]
        if not valid:
            return SeverityLevel.INFO
        highest = max(valid, key=lambda x: order[x])
        return SeverityLevel(highest if isinstance(highest, str) else highest.value)

    @staticmethod
    def _parse_iso(ts_str: Any) -> Optional[datetime]:
        if not ts_str:
            return None
        if isinstance(ts_str, datetime):
            return ts_str if ts_str.tzinfo else ts_str.replace(tzinfo=timezone.utc)
        try:
            # Handle standard ISO strings or pandas strings
            dt = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None
