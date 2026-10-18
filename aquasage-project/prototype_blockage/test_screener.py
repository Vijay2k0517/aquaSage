"""
Comprehensive Unit Test Suite for AquaSage Prototype Blockage-Screening Module.
Verifies all 6 core defect modes and edge cases:
1. Normal operating flow with pump active.
2. Nominal idle condition with pump off.
3. Sustained low flow with pump running (candidate blockage).
4. Transient low-flow recovery (persistence counter reset).
5. Sustained sensor imbalance on straight pipe (instrument calibration discrepancy without asserting leak/blockage).
6. Unavailable / unknown pump status (uncertain advisory rather than asserting blockage).
7. Missing telemetry (both sensors null vs single sensor null).
8. Physically invalid and out-of-spec readings (negative flow, over-capacity flow).
9. High-frequency pulse jitter / unstable readings.
10. Stale telemetry latency.
11. Explicit simulation tagging and decision-support safety metadata.
"""

import unittest
from datetime import datetime, timezone, timedelta

from prototype_blockage.config import (
    BlockageScreeningConfig,
    BlockageStatus,
    PumpStatus,
    FlowUnit
)
from prototype_blockage.screener import PrototypeBlockageScreener


class TestPrototypeBlockageScreener(unittest.TestCase):

    def setUp(self):
        self.config = BlockageScreeningConfig(
            baseline_flow_l_per_min=12.0,
            low_flow_ratio_threshold=0.50,          # threshold = 6.0 L/min
            low_flow_persistence_cycles=5,
            sensor_imbalance_abs_threshold_l_per_min=1.50,
            sensor_imbalance_ratio_threshold=0.20,
            sensor_imbalance_persistence_cycles=3,
            jitter_window_size=5,
            jitter_std_threshold_l_per_min=3.0,
            max_stale_seconds=15.0,
            min_plausible_flow_l_per_min=0.0,
            max_plausible_flow_l_per_min=35.0
        )
        self.screener = PrototypeBlockageScreener(self.config)
        self.now_utc = datetime(2026, 10, 17, 12, 0, 0, tzinfo=timezone.utc)
        self.now_iso = self.now_utc.isoformat()

    # -------------------------------------------------------------------------
    # 1. Normal Flow Condition (Pump Running)
    # -------------------------------------------------------------------------
    def test_normal_flow_pump_running(self):
        """Test nominal flow matching baseline with active pump."""
        res = self.screener.screen(
            sensor_1_flow=12.1,
            sensor_2_flow=11.9,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=self.now_iso,
            reference_time=self.now_iso
        )

        self.assertEqual(res['status'], BlockageStatus.NOMINAL.value)
        self.assertEqual(res['severity'], "INFO")
        self.assertIn("conforms to operating baseline", res['reason'])
        self.assertTrue(res['is_simulated'])
        self.assertEqual(res['recommended_human_action']['category'], "ROUTINE_MONITORING")
        self.assertFalse(res['recommended_human_action']['safety_critical'])
        self.assertEqual(res['recommended_human_action']['execution_mode'], "DECISION_SUPPORT_ONLY")

    # -------------------------------------------------------------------------
    # 2. Nominal Idle Condition (Pump Off)
    # -------------------------------------------------------------------------
    def test_normal_idle_pump_off(self):
        """Test expected zero/trace flow when pump is powered off."""
        res = self.screener.screen(
            sensor_1_flow=0.0,
            sensor_2_flow=0.0,
            pump_status=PumpStatus.PUMP_OFF,
            timestamp=self.now_iso,
            reference_time=self.now_iso
        )

        self.assertEqual(res['status'], BlockageStatus.NOMINAL_IDLE.value)
        self.assertEqual(res['severity'], "INFO")
        self.assertIn("idle", res['reason'].lower())
        self.assertEqual(res['recommended_human_action']['category'], "ROUTINE_STANDBY")

    # -------------------------------------------------------------------------
    # 3. Sustained Low Flow with Pump Running (Candidate Blockage)
    # -------------------------------------------------------------------------
    def test_sustained_low_flow_pump_running(self):
        """Test sustained low flow (< 6.0 L/min) for 5 cycles with active pump."""
        for cycle in range(1, 5):
            res_transient = self.screener.screen(
                sensor_1_flow=3.5,
                sensor_2_flow=3.4,
                pump_status=PumpStatus.PUMP_RUNNING,
                timestamp=self.now_iso,
                reference_time=self.now_iso
            )
            # Before 5 cycles, low flow has not yet reached required persistence
            self.assertEqual(res_transient['status'], BlockageStatus.NOMINAL.value)
            self.assertEqual(res_transient['evidence']['low_flow_persistence_cycles'], cycle)

        # 5th consecutive cycle triggers SUSTAINED_LOW_FLOW alert
        res_sustained = self.screener.screen(
            sensor_1_flow=3.5,
            sensor_2_flow=3.4,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=self.now_iso,
            reference_time=self.now_iso
        )

        self.assertEqual(res_sustained['status'], BlockageStatus.SUSTAINED_LOW_FLOW.value)
        self.assertEqual(res_sustained['severity'], "WARNING")
        self.assertTrue(res_sustained['evidence']['sustained_low_flow_detected'])
        self.assertEqual(res_sustained['recommended_human_action']['category'], "MANUAL_PIPE_INSPECTION")
        self.assertIn("suction strainer", res_sustained['recommended_human_action']['action'].lower())
        self.assertTrue(res_sustained['recommended_human_action']['requires_human_confirmation'])

    # -------------------------------------------------------------------------
    # 4. Transient Low-Flow Recovery
    # -------------------------------------------------------------------------
    def test_transient_low_flow_resets_persistence(self):
        """Test that low flow for 3 cycles followed by normal flow resets counter."""
        for _ in range(3):
            self.screener.screen(
                sensor_1_flow=4.0,
                sensor_2_flow=4.1,
                pump_status=PumpStatus.PUMP_RUNNING,
                timestamp=self.now_iso,
                reference_time=self.now_iso
            )
        self.assertEqual(self.screener.low_flow_persistence_count, 3)

        # Flow recovers to nominal (12.0 L/min)
        res_recovered = self.screener.screen(
            sensor_1_flow=12.0,
            sensor_2_flow=11.8,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=self.now_iso,
            reference_time=self.now_iso
        )

        self.assertEqual(res_recovered['status'], BlockageStatus.NOMINAL.value)
        self.assertEqual(self.screener.low_flow_persistence_count, 0)
        self.assertFalse(res_recovered['evidence']['sustained_low_flow_detected'])

    # -------------------------------------------------------------------------
    # 5. Sustained Sensor Imbalance on Straight Pipe
    # -------------------------------------------------------------------------
    def test_sensor_imbalance_sustained(self):
        """
        Test that sustained discrepancy between S1 and S2 on straight pipe
        flags SENSOR_IMBALANCE and does NOT claim a leak or blockage.
        """
        # S1 = 12.0 L/min, S2 = 8.0 L/min -> diff = 4.0 L/min (> 1.5 L/min, 33.3% > 20%)
        for cycle in range(1, 3):
            res_c = self.screener.screen(
                sensor_1_flow=12.0,
                sensor_2_flow=8.0,
                pump_status=PumpStatus.PUMP_RUNNING,
                timestamp=self.now_iso,
                reference_time=self.now_iso
            )
            # Before 3 cycles, not yet sustained
            self.assertEqual(res_c['evidence']['imbalance_persistence_cycles'], cycle)

        # 3rd consecutive cycle flags SENSOR_IMBALANCE
        res_imbalance = self.screener.screen(
            sensor_1_flow=12.0,
            sensor_2_flow=8.0,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=self.now_iso,
            reference_time=self.now_iso
        )

        self.assertEqual(res_imbalance['status'], BlockageStatus.SENSOR_IMBALANCE.value)
        self.assertEqual(res_imbalance['severity'], "ADVISORY")
        self.assertTrue(res_imbalance['evidence']['sensor_imbalance_detected'])
        self.assertFalse(res_imbalance['evidence']['sustained_low_flow_detected'])

        # Explicitly verify it does NOT claim a leak or blockage
        self.assertIn("does not confirm hydraulic blockage or pipe rupture", res_imbalance['reason'].lower())
        self.assertEqual(res_imbalance['recommended_human_action']['category'], "SENSOR_CALIBRATION_CHECK")
        self.assertIn("cross-calibrate", res_imbalance['recommended_human_action']['action'].lower())

    # -------------------------------------------------------------------------
    # 6. Unavailable / Unknown Pump Status
    # -------------------------------------------------------------------------
    def test_unavailable_pump_status_returns_uncertain(self):
        """
        Test that low flow with UNKNOWN pump status returns UNCERTAIN_OPERATING_STATE
        rather than prematurely asserting a confirmed blockage.
        """
        for _ in range(5):
            res = self.screener.screen(
                sensor_1_flow=2.5,
                sensor_2_flow=2.6,
                pump_status=PumpStatus.UNKNOWN,
                timestamp=self.now_iso,
                reference_time=self.now_iso
            )

        self.assertEqual(res['status'], BlockageStatus.UNCERTAIN_OPERATING_STATE.value)
        self.assertEqual(res['severity'], "ADVISORY")
        self.assertIn("pump operating status is unknown", res['reason'].lower())
        self.assertIn("cannot distinguish", res['reason'].lower())
        self.assertEqual(res['recommended_human_action']['category'], "PUMP_STATUS_VERIFICATION")
        self.assertIn("power supply status", res['recommended_human_action']['action'].lower())

    # -------------------------------------------------------------------------
    # 7. Missing Telemetry Handling
    # -------------------------------------------------------------------------
    def test_missing_telemetry_handling(self):
        """Test handling of both sensors missing vs single sensor missing."""
        # 7A: Both sensors missing
        res_both_null = self.screener.screen(
            sensor_1_flow=None,
            sensor_2_flow=None,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=self.now_iso,
            reference_time=self.now_iso
        )
        self.assertEqual(res_both_null['status'], BlockageStatus.INSUFFICIENT_DATA.value)
        self.assertEqual(res_both_null['severity'], "WARNING")
        self.assertEqual(res_both_null['recommended_human_action']['category'], "TELEMETRY_DIAGNOSTIC")

        # 7B: S1 present, S2 missing -> Evaluates S1 flow, skips imbalance safely
        self.screener.reset()
        res_single = self.screener.screen(
            sensor_1_flow=11.5,
            sensor_2_flow=None,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=self.now_iso,
            reference_time=self.now_iso
        )
        self.assertEqual(res_single['status'], BlockageStatus.NOMINAL.value)
        self.assertIsNone(res_single['input_readings']['flow_difference_l_per_min'])

    # -------------------------------------------------------------------------
    # 8. Invalid and Out-of-Spec Readings
    # -------------------------------------------------------------------------
    def test_invalid_and_out_of_spec_readings(self):
        """Test rejection of negative flow or flow exceeding turbine physical capacity."""
        # Negative flow
        res_neg = self.screener.screen(
            sensor_1_flow=-2.5,
            sensor_2_flow=10.0,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=self.now_iso,
            reference_time=self.now_iso
        )
        self.assertEqual(res_neg['status'], BlockageStatus.INVALID_READING.value)
        self.assertEqual(res_neg['severity'], "WARNING")
        self.assertIn("negative", res_neg['reason'].lower())
        self.assertEqual(res_neg['recommended_human_action']['category'], "INSTRUMENT_DIAGNOSTIC")

        # Extreme impossible flow (> 35.0 L/min for YF-S201)
        res_high = self.screener.screen(
            sensor_1_flow=45.0,
            sensor_2_flow=10.0,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=self.now_iso,
            reference_time=self.now_iso
        )
        self.assertEqual(res_high['status'], BlockageStatus.INVALID_READING.value)
        self.assertIn("turbine capacity", res_high['reason'].lower())

    # -------------------------------------------------------------------------
    # 9. High-Frequency Pulse Jitter / Unstable Readings
    # -------------------------------------------------------------------------
    def test_unstable_jitter_telemetry(self):
        """Test detection of high variance/jitter across 5-sample sliding window."""
        # Feed erratic oscillating pulse frequencies (std > 3.0 L/min)
        erratic_sequence = [12.0, 3.0, 15.0, 2.0, 14.0]
        for val in erratic_sequence:
            res = self.screener.screen(
                sensor_1_flow=val,
                sensor_2_flow=12.0,
                pump_status=PumpStatus.PUMP_RUNNING,
                timestamp=self.now_iso,
                reference_time=self.now_iso
            )

        self.assertEqual(res['status'], BlockageStatus.UNSTABLE_TELEMETRY.value)
        self.assertEqual(res['severity'], "ADVISORY")
        self.assertIn("jitter", res['reason'].lower())
        self.assertEqual(res['recommended_human_action']['category'], "SIGNAL_STABILIZATION")

    # -------------------------------------------------------------------------
    # 10. Stale Telemetry Latency
    # -------------------------------------------------------------------------
    def test_stale_telemetry(self):
        """Test rejection of stale readings (> 15 seconds old)."""
        stale_time = (self.now_utc - timedelta(seconds=25)).isoformat()
        res_stale = self.screener.screen(
            sensor_1_flow=12.0,
            sensor_2_flow=12.0,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=stale_time,
            reference_time=self.now_iso
        )

        self.assertEqual(res_stale['status'], BlockageStatus.STALE_TELEMETRY.value)
        self.assertEqual(res_stale['severity'], "ADVISORY")
        self.assertIn("latency", res_stale['reason'].lower())
        self.assertEqual(res_stale['recommended_human_action']['category'], "COMMUNICATION_WATCH")

    # -------------------------------------------------------------------------
    # 11. Simulation Tagging & Decision Support Governance
    # -------------------------------------------------------------------------
    def test_simulated_labeling_and_safety_metadata(self):
        """Verify explicit simulated tagging and machine-readable decision-support metadata."""
        res = self.screener.screen(
            sensor_1_flow=12.0,
            sensor_2_flow=12.0,
            pump_status=PumpStatus.PUMP_RUNNING,
            timestamp=self.now_iso,
            reference_time=self.now_iso,
            is_simulated=True
        )

        self.assertTrue(res['is_simulated'])
        self.assertIn("simulated telemetry", res['simulation_disclaimer'].lower())
        self.assertIn("not validated against live physical municipal blockage events", res['simulation_disclaimer'].lower())

        action = res['recommended_human_action']
        self.assertIn('safety_critical', action)
        self.assertFalse(action['safety_critical'])
        self.assertIn('requires_human_confirmation', action)
        self.assertTrue(action['requires_human_confirmation'])
        self.assertEqual(action.get('execution_mode'), "DECISION_SUPPORT_ONLY")


if __name__ == '__main__':
    unittest.main(verbosity=2)
