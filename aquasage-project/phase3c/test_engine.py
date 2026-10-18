"""
Phase 3C: Comprehensive Test Suite for AquaSage Unified Decision & Recommendation Engine.
Tests all 7 required scenarios, data quality edge cases, compounding escalation,
action prioritization, and physical sanity boundaries.
"""

import unittest
from datetime import datetime, timezone, timedelta

from phase3c.config import (
    EngineConfig,
    SeverityLevel,
    SourceType,
    DataQualityStatus,
    FlowLeakConfig,
    TankLevelConfig,
    WaterQualityConfig
)
from phase3c.engine import AquaSageDecisionEngine
from phase3c.adapter import SubsystemAdapter, RollingPersistenceTracker



class TestAquaSageDecisionEngine(unittest.TestCase):

    def setUp(self):
        self.config = EngineConfig()
        self.engine = AquaSageDecisionEngine(self.config)
        self.now_utc = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        self.now_iso = self.now_utc.isoformat()

    # -------------------------------------------------------------------------
    # Scenario 1: Normal Conditions
    # -------------------------------------------------------------------------
    def test_scenario_1_normal_conditions(self):
        """Test nominal operation across all three subsystems."""
        flow_data = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 32.5,
            'predicted_flow_m3h': 32.0,
            'anomaly_score': 0.5,
            'persistence_hours': 0
        }
        tank_data = {
            'timestamp': self.now_iso,
            'source_type': SourceType.SIMULATED_HYDRAULIC_MODEL.value,
            'current_level_m': 6.2,
            'forecast_5m': 6.18,
            'forecast_15m': 6.15,
            'forecast_30m': 6.10,
            'inflow_m3h': 35.0,
            'outflow_m3h': 35.0,
            'is_simulated': True
        }
        wq_data = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_01',
            'ph': 7.4,
            'turbidity_ntu': 1.2,
            'dissolved_oxygen_mg_l': 8.2,
            'conductivity_us_cm': 450.0,
            'tds_mg_l': 220.0
        }

        res = self.engine.evaluate(flow_data, tank_data, wq_data, reference_time=self.now_iso)

        self.assertEqual(res['overall_severity'], SeverityLevel.INFO.value)
        self.assertEqual(res['system_status'], 'ALL_SYSTEMS_NOMINAL')
        self.assertFalse(res['compounded_escalation_active'])
        self.assertEqual(len(res['escalation_reasons']), 0)

        # Flow subsystem checks
        flow_sub = res['subsystems']['flow_leak_detection']
        self.assertEqual(flow_sub['status'], DataQualityStatus.VALID.value)
        self.assertEqual(flow_sub['severity'], SeverityLevel.INFO.value)
        self.assertFalse(flow_sub['leak_suspected'])

        # Tank subsystem checks
        tank_sub = res['subsystems']['tank_level_forecasting']
        self.assertEqual(tank_sub['status'], DataQualityStatus.VALID.value)
        self.assertEqual(tank_sub['severity'], SeverityLevel.INFO.value)
        self.assertTrue(tank_sub['evidence']['is_simulated_model'])
        self.assertIn('mass-balance hydraulic simulation', tank_sub['evidence']['simulation_disclaimer'])

        # Water quality subsystem checks
        wq_sub = res['subsystems']['water_quality_assessment']
        self.assertEqual(wq_sub['status'], DataQualityStatus.VALID.value)
        self.assertEqual(wq_sub['severity'], SeverityLevel.INFO.value)
        self.assertEqual(wq_sub['evidence']['violations_count'], 0)

        # Routine supervisory action
        self.assertEqual(len(res['prioritized_operator_actions']), 1)
        self.assertEqual(res['prioritized_operator_actions'][0]['category'], 'ROUTINE_MONITORING')

    # -------------------------------------------------------------------------
    # Scenario 2: Suspected Distribution Leak
    # -------------------------------------------------------------------------
    def test_scenario_2_suspected_leak_levels(self):
        """Test leak detection scoring across advisory, warning, and critical tiers."""
        # 2A: Advisory (score elevated for 2 hours)
        flow_adv = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 42.0,
            'predicted_flow_m3h': 32.0,
            'anomaly_score': 2.8,
            'persistence_hours': 2
        }
        res_adv = self.engine.evaluate(flow_data=flow_adv, reference_time=self.now_iso)
        flow_sub = res_adv['subsystems']['flow_leak_detection']
        self.assertEqual(flow_sub['severity'], SeverityLevel.ADVISORY.value)
        self.assertTrue(flow_sub['leak_suspected'])
        self.assertIn('LEAKAGE_MONITORING', [a['category'] for a in res_adv['prioritized_operator_actions']])

        # 2B: Warning (score elevated for 8 hours)
        flow_warn = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 43.0,
            'predicted_flow_m3h': 33.0,
            'anomaly_score': 3.45,
            'persistence_hours': 8
        }
        res_warn = self.engine.evaluate(flow_data=flow_warn, reference_time=self.now_iso)
        flow_sub_w = res_warn['subsystems']['flow_leak_detection']
        self.assertEqual(flow_sub_w['severity'], SeverityLevel.WARNING.value)
        self.assertTrue(flow_sub_w['leak_suspected'])
        self.assertIn('LEAKAGE_REPAIR', [a['category'] for a in res_warn['prioritized_operator_actions']])

        # 2C: Critical (large burst excess flow >= 15 m³/h or >= 12 hours)
        flow_crit = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 55.0,
            'predicted_flow_m3h': 32.0,
            'anomaly_score': 5.2,
            'persistence_hours': 14
        }
        res_crit = self.engine.evaluate(flow_data=flow_crit, reference_time=self.now_iso)
        self.assertEqual(res_crit['subsystems']['flow_leak_detection']['severity'], SeverityLevel.CRITICAL.value)

        # Check probabilistic disclaimer
        self.assertIn('statistical residual deviation', flow_sub_w['evidence']['leak_evidence_note'])

    # -------------------------------------------------------------------------
    # Scenario 3: Tank Storage Hazards (Depletion & Overflow)
    # -------------------------------------------------------------------------
    def test_scenario_3_low_and_high_predicted_tank(self):
        """Test multi-horizon simulated tank level hazards."""
        # 3A: Critical low predicted level (drops to 1.85m <= 2.0m within 30 min)
        tank_low = {
            'timestamp': self.now_iso,
            'source_type': SourceType.SIMULATED_HYDRAULIC_MODEL.value,
            'current_level_m': 2.8,
            'forecast_5m': 2.4,
            'forecast_15m': 2.1,
            'forecast_30m': 1.85,
            'inflow_m3h': 20.0,
            'outflow_m3h': 45.0,
            'is_simulated': True
        }
        res_low = self.engine.evaluate(tank_data=tank_low, reference_time=self.now_iso)
        tank_sub = res_low['subsystems']['tank_level_forecasting']
        self.assertEqual(tank_sub['severity'], SeverityLevel.CRITICAL.value)
        self.assertEqual(tank_sub['hazard_type'], 'CRITICAL_DEPLETION')
        self.assertEqual(res_low['overall_severity'], SeverityLevel.CRITICAL.value)

        # Check action contains pump override to 52 m³/h
        tank_actions = [a for a in res_low['prioritized_operator_actions'] if a['category'] == 'STORAGE_CONTROL']
        self.assertTrue(len(tank_actions) > 0)
        self.assertIn('52 m³/h', tank_actions[0]['action'])

        # 3B: Critical overflow hazard (reaches 9.7m >= 9.5m)
        tank_high = {
            'timestamp': self.now_iso,
            'source_type': SourceType.SIMULATED_HYDRAULIC_MODEL.value,
            'current_level_m': 8.8,
            'forecast_5m': 9.1,
            'forecast_15m': 9.4,
            'forecast_30m': 9.7,
            'inflow_m3h': 52.0,
            'outflow_m3h': 15.0,
            'is_simulated': True
        }
        res_high = self.engine.evaluate(tank_data=tank_high, reference_time=self.now_iso)
        tank_sub_h = res_high['subsystems']['tank_level_forecasting']
        self.assertEqual(tank_sub_h['severity'], SeverityLevel.CRITICAL.value)
        self.assertEqual(tank_sub_h['hazard_type'], 'CRITICAL_OVERFLOW')
        actions_h = [a for a in res_high['prioritized_operator_actions'] if a['category'] == 'STORAGE_CONTROL']
        self.assertIn('spillway', actions_h[0]['action'].lower())

    # -------------------------------------------------------------------------
    # Scenario 4: Water Quality Anomalies
    # -------------------------------------------------------------------------
    def test_scenario_4_water_quality_anomalies(self):
        """Test water quality evaluation against WHO/EPA regulatory limits."""
        # Critical contamination: acidic pH (5.2), turbidity (28.5 NTU), hypoxia (1.8 mg/L)
        wq_crit = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_04',
            'ph': 5.2,
            'turbidity_ntu': 28.5,
            'dissolved_oxygen_mg_l': 1.8,
            'conductivity_us_cm': 1600.0,
            'tds_mg_l': 480.0
        }
        res = self.engine.evaluate(wq_data=wq_crit, reference_time=self.now_iso)
        wq_sub = res['subsystems']['water_quality_assessment']

        self.assertEqual(wq_sub['severity'], SeverityLevel.CRITICAL.value)
        self.assertEqual(wq_sub['evidence']['violations_count'], 4)
        self.assertEqual(res['overall_severity'], SeverityLevel.CRITICAL.value)

        # Check public health directive
        wq_actions = [a for a in res['prioritized_operator_actions'] if a['category'] == 'PUBLIC_HEALTH_ADVISORY']
        self.assertTrue(len(wq_actions) > 0)
        self.assertIn('boil-water', wq_actions[0]['action'].lower())
        self.assertIn('Exploratory field grab sample screening', wq_sub['evidence']['disclaimer'])

    # -------------------------------------------------------------------------
    # Scenario 5: Missing, Stale, and Conflicting Telemetry
    # -------------------------------------------------------------------------
    def test_scenario_5_missing_stale_and_conflicting(self):
        """Test robust handling of missing fields, stale data, and conflicting readings."""
        # 5A: Missing data
        res_missing = self.engine.evaluate(
            flow_data={'timestamp': self.now_iso},  # missing flow_m3h and anomaly_score
            tank_data=None,                         # completely missing tank
            wq_data=None,
            reference_time=self.now_iso
        )
        self.assertEqual(res_missing['subsystems']['flow_leak_detection']['status'], DataQualityStatus.INSUFFICIENT_DATA.value)
        self.assertEqual(res_missing['subsystems']['tank_level_forecasting']['status'], DataQualityStatus.INSUFFICIENT_DATA.value)

        # 5B: Stale flow data (> 30 min old)
        stale_time = (self.now_utc - timedelta(minutes=45)).isoformat()
        flow_stale = {
            'timestamp': stale_time,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 35.0,
            'anomaly_score': 0.8
        }
        res_stale = self.engine.evaluate(flow_data=flow_stale, reference_time=self.now_iso)
        self.assertEqual(res_stale['subsystems']['flow_leak_detection']['status'], DataQualityStatus.STALE.value)
        self.assertEqual(res_stale['subsystems']['flow_leak_detection']['severity'], SeverityLevel.ADVISORY.value)

        # 5C: Conflicting flow reading (negative flow on inlet meter)
        flow_conflict = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': -18.5,
            'predicted_flow_m3h': 32.0,
            'anomaly_score': 1.0
        }
        res_flow_conflict = self.engine.evaluate(flow_data=flow_conflict, reference_time=self.now_iso)
        self.assertEqual(res_flow_conflict['subsystems']['flow_leak_detection']['status'], DataQualityStatus.CONFLICTING.value)
        self.assertIn('INSTRUMENT_DIAGNOSTIC', [a['category'] for a in res_flow_conflict['prioritized_operator_actions']])

        # 5D: Conflicting tank reading (negative water level)
        tank_conflict = {
            'timestamp': self.now_iso,
            'source_type': SourceType.SIMULATED_HYDRAULIC_MODEL.value,
            'current_level_m': -1.5,
            'is_simulated': True
        }
        res_tank_conflict = self.engine.evaluate(tank_data=tank_conflict, reference_time=self.now_iso)
        self.assertEqual(res_tank_conflict['subsystems']['tank_level_forecasting']['status'], DataQualityStatus.CONFLICTING.value)

        # 5E: Conflicting water quality (chemically impossible pH 17.5)
        wq_conflict = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'ph': 17.5,
            'dissolved_oxygen_mg_l': 38.0  # impossible DO
        }
        res_wq_conflict = self.engine.evaluate(wq_data=wq_conflict, reference_time=self.now_iso)
        self.assertEqual(res_wq_conflict['subsystems']['water_quality_assessment']['status'], DataQualityStatus.CONFLICTING.value)

    # -------------------------------------------------------------------------
    # Scenario 6: Simultaneous Compounded Alerts
    # -------------------------------------------------------------------------
    def test_scenario_6_simultaneous_compounded_alerts(self):
        """Test compounding risk escalation when active leak coincides with reservoir storage depletion."""
        flow_leak = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 49.0,
            'predicted_flow_m3h': 34.0,
            'anomaly_score': 3.8,
            'persistence_hours': 7
        }
        tank_low = {
            'timestamp': self.now_iso,
            'source_type': SourceType.SIMULATED_HYDRAULIC_MODEL.value,
            'current_level_m': 3.1,
            'forecast_5m': 2.7,
            'forecast_15m': 2.3,
            'forecast_30m': 1.9,
            'inflow_m3h': 15.0,
            'outflow_demand_m3h': 45.0,
            'is_simulated': True
        }
        wq_data = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_02',
            'ph': 7.1,
            'turbidity_ntu': 6.2, # slight elevation
            'dissolved_oxygen_mg_l': 7.5,
            'conductivity_us_cm': 500.0
        }

        res = self.engine.evaluate(flow_leak, tank_low, wq_data, reference_time=self.now_iso)

        self.assertTrue(res['compounded_escalation_active'])
        self.assertEqual(res['overall_severity'], SeverityLevel.CRITICAL.value)
        self.assertEqual(res['system_status'], 'SYSTEM_CRITICAL_EMERGENCY')
        self.assertTrue(len(res['escalation_reasons']) > 0)
        self.assertIn('COMPOUND CRITICAL HAZARD', res['escalation_reasons'][0])

        # Priority 1 action must be compounded emergency directive
        p1_action = res['prioritized_operator_actions'][0]
        self.assertEqual(p1_action['priority'], 1)
        self.assertEqual(p1_action['category'], 'COMPOUNDED_SYSTEM_EMERGENCY')

    # -------------------------------------------------------------------------
    # Scenario 7: Uncollected Water Quality Field Sample
    # -------------------------------------------------------------------------
    def test_scenario_7_uncollected_sample(self):
        """Test explicit handling of uncollected sample remarks without fabricating values."""
        wq_uncollected = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_07',
            'uncollected_remark': 'Water level is too low to collect sample'
        }

        res = self.engine.evaluate(wq_data=wq_uncollected, reference_time=self.now_iso)
        wq_sub = res['subsystems']['water_quality_assessment']

        self.assertEqual(wq_sub['status'], DataQualityStatus.UNCOLLECTED_SAMPLE.value)
        self.assertEqual(wq_sub['severity'], SeverityLevel.WARNING.value)
        self.assertEqual(wq_sub['station_id'], 'STATION_07')

        # Intake inspection action generated
        intake_actions = [a for a in res['prioritized_operator_actions'] if a['category'] == 'INTAKE_INSPECTION']
        self.assertTrue(len(intake_actions) > 0)

    # -------------------------------------------------------------------------
    # Scenario 8: Compound Depleting Tank + Water Quality Hypoxia
    # -------------------------------------------------------------------------
    def test_compounding_tank_depletion_and_water_quality_hazard(self):
        """Test compound risk when tank is depleting while water quality is critically hypoxic."""
        tank_depleting = {
            'timestamp': self.now_iso,
            'source_type': SourceType.SIMULATED_HYDRAULIC_MODEL.value,
            'current_level_m': 2.5,
            'forecast_30m': 2.1,
            'is_simulated': True
        }
        wq_hypoxic = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_03',
            'ph': 7.0,
            'turbidity_ntu': 4.0,
            'dissolved_oxygen_mg_l': 1.5, # Critical hypoxia <= 2.0 mg/L
            'conductivity_us_cm': 600.0
        }
        res = self.engine.evaluate(tank_data=tank_depleting, wq_data=wq_hypoxic, reference_time=self.now_iso)

        self.assertTrue(res['compounded_escalation_active'])
        self.assertEqual(res['overall_severity'], SeverityLevel.CRITICAL.value)
        self.assertIn('COMPOUND WATER QUALITY HAZARD', res['escalation_reasons'][0])

    # -------------------------------------------------------------------------
    # Scenario 9: Historical Batch Telemetry Verification
    # -------------------------------------------------------------------------
    def test_historical_batch_source_type_integrity(self):
        """Verify that historical batch records preserve source tagging without simulated confusion."""
        flow_hist = {
            'timestamp': '2024-04-10T14:00:00Z',
            'source_type': SourceType.HISTORICAL_BATCH.value,
            'flow_m3h': 34.0,
            'predicted_flow_m3h': 33.5,
            'anomaly_score': 0.3
        }
        res = self.engine.evaluate(flow_data=flow_hist, reference_time='2024-04-10T14:05:00Z')
        sub = res['subsystems']['flow_leak_detection']
        self.assertEqual(sub['source_type'], SourceType.HISTORICAL_BATCH.value)
        self.assertEqual(sub['status'], DataQualityStatus.VALID.value)


class TestPhase3CAuditFixes(unittest.TestCase):
    """
    Regression tests covering all approved audit fixes:
    - Stale abnormal water-quality samples do not trigger critical emergencies
    - TDS threshold evaluations (secondary aesthetic warning vs critical)
    - Alkaline/caustic critical pH condition (> 9.5)
    - Action payload safety governance metadata (safety_critical, requires_human_confirmation, execution_mode)
    - Advisory persistence unified rule (advisory_hours = 1)
    - Deterministic decision ID generation
    """

    def setUp(self):
        self.config = EngineConfig()
        self.engine = AquaSageDecisionEngine(self.config)
        self.now_utc = datetime(2026, 10, 16, 12, 0, 0, tzinfo=timezone.utc)
        self.now_iso = self.now_utc.isoformat()

    def test_regression_stale_abnormal_water_quality_does_not_escalate_to_critical(self):
        """
        Verify that an abnormal water-quality grab sample from 30 days ago
        does NOT trigger an active critical boil-water notice emergency.
        It must be marked STALE, capped at ADVISORY, and recommend fresh field resampling.
        """
        stale_sample_time = (self.now_utc - timedelta(days=30)).isoformat()
        stale_wq = {
            'timestamp': stale_sample_time,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_05',
            'ph': 5.2,                   # severely acidic
            'turbidity_ntu': 28.5,        # severely turbid
            'dissolved_oxygen_mg_l': 1.8  # hypoxic
        }

        res = self.engine.evaluate(wq_data=stale_wq, reference_time=self.now_iso)
        wq_sub = res['subsystems']['water_quality_assessment']

        # Must be marked STALE
        self.assertEqual(wq_sub['status'], DataQualityStatus.STALE.value)
        # Severity must be capped at ADVISORY (never CRITICAL)
        self.assertEqual(wq_sub['severity'], SeverityLevel.ADVISORY.value)
        self.assertEqual(res['overall_severity'], SeverityLevel.ADVISORY.value)
        self.assertNotEqual(res['system_status'], 'SYSTEM_CRITICAL_EMERGENCY')

        # Disclaimer must state historical grab sample cannot confirm active emergency
        self.assertIn('fresh grab sample', wq_sub['evidence']['stale_disclaimer'].lower())

        # Actions must recommend resampling, NOT an active boil-water notice
        action_categories = [a['category'] for a in res['prioritized_operator_actions']]
        self.assertIn('WATER_QUALITY_RESAMPLING', action_categories)
        self.assertNotIn('PUBLIC_HEALTH_ADVISORY', action_categories)
        for a in res['prioritized_operator_actions']:
            self.assertNotIn('boil-water', a['action'].lower())

    def test_regression_tds_secondary_aesthetic_warning(self):
        """
        Verify TDS evaluation between 500 mg/L and 1000 mg/L generates
        a WARNING and cites EPA Secondary Aesthetic Standard / WHO guideline.
        """
        wq_elevated_tds = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_02',
            'ph': 7.4,
            'turbidity_ntu': 1.2,
            'dissolved_oxygen_mg_l': 8.0,
            'conductivity_us_cm': 950.0,
            'tds_mg_l': 650.0  # > 500 mg/L, < 1000 mg/L
        }

        res = self.engine.evaluate(wq_data=wq_elevated_tds, reference_time=self.now_iso)
        wq_sub = res['subsystems']['water_quality_assessment']

        self.assertEqual(wq_sub['severity'], SeverityLevel.ADVISORY.value)
        self.assertTrue(any('TDS 650.0 mg/L' in v for v in wq_sub['evidence']['violations']))
        self.assertTrue(any(a['category'] == 'AESTHETIC_WATER_QUALITY' for a in res['prioritized_operator_actions']))

    def test_regression_tds_critical_threshold(self):
        """
        Verify TDS >= 1000 mg/L generates a CRITICAL severity alert and source isolation action.
        """
        wq_critical_tds = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_02',
            'ph': 7.4,
            'turbidity_ntu': 1.2,
            'dissolved_oxygen_mg_l': 8.0,
            'conductivity_us_cm': 1800.0,
            'tds_mg_l': 1250.0  # >= 1000 mg/L critical
        }

        res = self.engine.evaluate(wq_data=wq_critical_tds, reference_time=self.now_iso)
        wq_sub = res['subsystems']['water_quality_assessment']

        self.assertEqual(wq_sub['severity'], SeverityLevel.CRITICAL.value)
        self.assertTrue(any('CRITICAL: TDS 1250.0 mg/L' in v for v in wq_sub['evidence']['violations']))
        self.assertTrue(any(a['category'] == 'SOURCE_WATER_MANAGEMENT' for a in res['prioritized_operator_actions']))

    def test_regression_tds_plausibility_conflicting(self):
        """
        Verify physically impossible TDS (> 10,000 mg/L) is flagged as CONFLICTING data.
        """
        wq_impossible_tds = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_02',
            'ph': 7.4,
            'tds_mg_l': 15000.0  # chemically implausible for freshwater drinking intake
        }

        res = self.engine.evaluate(wq_data=wq_impossible_tds, reference_time=self.now_iso)
        wq_sub = res['subsystems']['water_quality_assessment']

        self.assertEqual(wq_sub['status'], DataQualityStatus.CONFLICTING.value)
        self.assertTrue(any(a['category'] == 'INSTRUMENT_DIAGNOSTIC' for a in res['prioritized_operator_actions']))

    def test_regression_alkaline_caustic_ph_critical(self):
        """
        Verify alkaline/caustic pH > 9.5 generates CRITICAL alert and chemical feed adjustment.
        """
        wq_alkaline = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_01',
            'ph': 9.85,  # > 9.5 critical caustic
            'turbidity_ntu': 1.0,
            'dissolved_oxygen_mg_l': 7.5
        }

        res = self.engine.evaluate(wq_data=wq_alkaline, reference_time=self.now_iso)
        wq_sub = res['subsystems']['water_quality_assessment']

        self.assertEqual(wq_sub['severity'], SeverityLevel.CRITICAL.value)
        self.assertTrue(any('Severe Alkaline/Caustic pH 9.85' in v for v in wq_sub['evidence']['violations']))
        self.assertTrue(any(a['category'] == 'CHEMICAL_FEED_ADJUSTMENT' for a in res['prioritized_operator_actions']))

    def test_regression_safety_critical_action_payload_metadata(self):
        """
        Verify that all action payloads contain safety_critical, requires_human_confirmation,
        and execution_mode="DECISION_SUPPORT_ONLY".
        """
        flow_leak = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 55.0,
            'predicted_flow_m3h': 32.0,
            'anomaly_score': 5.0,
            'persistence_hours': 14
        }
        tank_low = {
            'timestamp': self.now_iso,
            'source_type': SourceType.SIMULATED_HYDRAULIC_MODEL.value,
            'current_level_m': 2.0,
            'forecast_30m': 1.6,
            'is_simulated': True
        }
        wq_crit = {
            'timestamp': self.now_iso,
            'source_type': SourceType.FIELD_GRAB_SAMPLE.value,
            'station_id': 'STATION_01',
            'ph': 5.0,
            'turbidity_ntu': 30.0,
            'dissolved_oxygen_mg_l': 1.5
        }

        res = self.engine.evaluate(flow_data=flow_leak, tank_data=tank_low, wq_data=wq_crit, reference_time=self.now_iso)

        self.assertTrue(len(res['prioritized_operator_actions']) > 0)
        for action in res['prioritized_operator_actions']:
            self.assertIn('safety_critical', action)
            self.assertIsInstance(action['safety_critical'], bool)
            self.assertIn('requires_human_confirmation', action)
            self.assertIsInstance(action['requires_human_confirmation'], bool)
            self.assertEqual(action.get('execution_mode'), 'DECISION_SUPPORT_ONLY')

        # Critical actions like pump overrides, spillway discharges, or boil-water notices must require confirmation
        high_risk_actions = [a for a in res['prioritized_operator_actions'] if a['priority'] <= 2]
        for a in high_risk_actions:
            self.assertTrue(a['safety_critical'])
            self.assertTrue(a['requires_human_confirmation'])

    def test_regression_advisory_persistence_unified_rule(self):
        """
        Verify that advisory persistence rule is unified:
        anomaly_score >= 2.0 requires persistence_hours >= 1 (advisory_hours) to trigger ADVISORY.
        """
        # persistence_hours = 0 -> INFO
        flow_0 = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 40.0,
            'predicted_flow_m3h': 32.0,
            'anomaly_score': 2.5,
            'persistence_hours': 0
        }
        res_0 = self.engine.evaluate(flow_data=flow_0, reference_time=self.now_iso)
        self.assertEqual(res_0['subsystems']['flow_leak_detection']['severity'], SeverityLevel.INFO.value)
        self.assertFalse(res_0['subsystems']['flow_leak_detection']['leak_suspected'])

        # persistence_hours = 1 -> ADVISORY
        flow_1 = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 40.0,
            'predicted_flow_m3h': 32.0,
            'anomaly_score': 2.5,
            'persistence_hours': 1
        }
        res_1 = self.engine.evaluate(flow_data=flow_1, reference_time=self.now_iso)
        self.assertEqual(res_1['subsystems']['flow_leak_detection']['severity'], SeverityLevel.ADVISORY.value)
        self.assertTrue(res_1['subsystems']['flow_leak_detection']['leak_suspected'])

    def test_regression_deterministic_decision_id(self):
        """
        Verify that decision_id is deterministic when reference_time and inputs are identical.
        """
        flow = {
            'timestamp': self.now_iso,
            'source_type': SourceType.LIVE_TELEMETRY.value,
            'flow_m3h': 32.0,
            'anomaly_score': 0.5
        }
        res1 = self.engine.evaluate(flow_data=flow, reference_time=self.now_iso)
        res2 = self.engine.evaluate(flow_data=flow, reference_time=self.now_iso)
        self.assertEqual(res1['decision_id'], res2['decision_id'])


class TestSubsystemAdapter(unittest.TestCase):
    """
    Tests for phase3c/adapter.py:
    - Chronological rolling persistence tracking with reset on anomaly break
    - Phase 3A flow record adaptation
    - Phase 3B simulated tank forecast adaptation
    - Phase 3B water-quality grab sample adaptation
    """

    def setUp(self):
        self.tracker = RollingPersistenceTracker(anomaly_threshold=2.0)
        self.adapter = SubsystemAdapter(persistence_tracker=self.tracker)

    def test_chronological_rolling_persistence_and_reset(self):
        """
        Test that rolling persistence increments sequentially each hour of anomaly,
        and immediately resets to 0 when the anomaly condition breaks or a gap occurs.
        """
        t0 = datetime(2026, 10, 16, 10, 0, 0, tzinfo=timezone.utc)

        # Step 1: Normal score (0.8) -> persistence = 0
        p1 = self.tracker.update(t0, score=0.8)
        self.assertEqual(p1, 0)

        # Step 2: Anomaly (+1 hr, score 2.5) -> persistence = 1
        t1 = t0 + timedelta(hours=1)
        p2 = self.tracker.update(t1, score=2.5)
        self.assertEqual(p2, 1)

        # Step 3: Sustained anomaly (+1 hr, score 3.2) -> persistence = 2
        t2 = t1 + timedelta(hours=1)
        p3 = self.tracker.update(t2, score=3.2)
        self.assertEqual(p3, 2)

        # Step 4: Sustained anomaly (+1 hr, score 3.5) -> persistence = 3
        t3 = t2 + timedelta(hours=1)
        p4 = self.tracker.update(t3, score=3.5)
        self.assertEqual(p4, 3)

        # Step 5: BREAK IN ANOMALY (+1 hr, score drops to 1.1) -> persistence resets to 0
        t4 = t3 + timedelta(hours=1)
        p5 = self.tracker.update(t4, score=1.1)
        self.assertEqual(p5, 0)

        # Step 6: Anomaly returns (+1 hr, score 2.7) -> persistence restarts at 1
        t5 = t4 + timedelta(hours=1)
        p6 = self.tracker.update(t5, score=2.7)
        self.assertEqual(p6, 1)

        # Step 7: GAP (> 1.5 hr later, score 2.8) -> persistence resets to 1 (new episode)
        t6 = t5 + timedelta(hours=4)
        p7 = self.tracker.update(t6, score=2.8)
        self.assertEqual(p7, 1)

    def test_adapt_phase3a_flow_record(self):
        """Test adapting Phase 3A raw flow prediction output to Phase 3C schema."""
        raw_rec = {
            'result_time': '2026-10-16T14:00:00Z',
            'Flow': 42.5,
            'predicted_flow': 34.0,
            'anomaly_score': 3.1
        }
        adapted = self.adapter.adapt_phase3a_flow_record(raw_rec)

        self.assertEqual(adapted['timestamp'], '2026-10-16T14:00:00Z')
        self.assertEqual(adapted['flow_m3h'], 42.5)
        self.assertEqual(adapted['predicted_flow_m3h'], 34.0)
        self.assertEqual(adapted['anomaly_score'], 3.1)
        self.assertEqual(adapted['persistence_hours'], 1)
        self.assertEqual(adapted['source_type'], SourceType.LIVE_TELEMETRY.value)

    def test_adapt_phase3a_missing_data_does_not_invent(self):
        """Test that missing flow measurements are not fabricated."""
        raw_rec = {
            'result_time': '2026-10-16T14:00:00Z',
            'Flow': None
        }
        adapted = self.adapter.adapt_phase3a_flow_record(raw_rec)
        self.assertIsNone(adapted.get('flow_m3h'))
        self.assertIsNone(adapted.get('anomaly_score'))

    def test_adapt_phase3b_tank_record(self):
        """Test adapting Phase 3B simulated tank forecast record to Phase 3C schema."""
        raw_tank = {
            'timestamp': '2026-10-16T14:00:00Z',
            'simulated_sensor_level_m': 6.4,
            'forecast_5m': 6.35,
            'forecast_15m': 6.25,
            'forecast_30m': 6.10,
            'inflow_m3h': 35.0,
            'outflow_m3h': 38.0
        }
        adapted = self.adapter.adapt_phase3b_tank_record(raw_tank)

        self.assertEqual(adapted['current_level_m'], 6.4)
        self.assertEqual(adapted['forecast_30m'], 6.10)
        self.assertTrue(adapted['is_simulated'])
        self.assertEqual(adapted['source_type'], SourceType.SIMULATED_HYDRAULIC_MODEL.value)

    def test_adapt_phase3b_water_quality_record_and_remarks(self):
        """Test adapting Phase 3B water-quality grab sample including uncollected remarks."""
        # Case A: Valid numeric sample
        raw_wq = {
            'Date': '2026-03-15T09:30:00Z',
            'Station': 'STATION_04',
            'pH': 7.6,
            'Turbidity (NTU)': 2.1,
            'Dissolved Oxygen (mg/L)': 7.9,
            'Conductivity (uS/cm)': 480.0,
            'TDS (mg/L)': 240.0
        }
        adapted_a = self.adapter.adapt_phase3b_water_quality_record(raw_wq)

        self.assertEqual(adapted_a['timestamp'], '2026-03-15T09:30:00Z')
        self.assertEqual(adapted_a['station_id'], 'STATION_04')
        self.assertEqual(adapted_a['ph'], 7.6)
        self.assertEqual(adapted_a['tds_mg_l'], 240.0)
        self.assertEqual(adapted_a['source_type'], SourceType.FIELD_GRAB_SAMPLE.value)

        # Case B: Uncollected sample with qualitative remark
        raw_uncollected = {
            'Date': '2026-03-15T09:30:00Z',
            'Station': 'STATION_07',
            'Remarks': 'Water level is too low to collect sample'
        }
        adapted_b = self.adapter.adapt_phase3b_water_quality_record(raw_uncollected)

        self.assertEqual(adapted_b['uncollected_remark'], 'Water level is too low to collect sample')
        self.assertIsNone(adapted_b['ph'])
        self.assertIsNone(adapted_b['turbidity_ntu'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
