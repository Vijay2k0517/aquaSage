"""
AquaSage Prototype Blockage-Screening Module: Example Payload Generator.
Executes PrototypeBlockageScreener on 10 canonical benchtop scenarios
and serializes formatted input/output JSON payloads into prototype_blockage/examples/.
"""

import os
import sys
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath('.'))

from prototype_blockage.config import (
    BlockageScreeningConfig,
    BlockageStatus,
    PumpStatus,
    FlowUnit
)
from prototype_blockage.screener import PrototypeBlockageScreener


def generate_all_examples(output_dir: str = "prototype_blockage/examples"):
    os.makedirs(output_dir, exist_ok=True)
    screener = PrototypeBlockageScreener()

    ref_time = datetime(2026, 10, 18, 12, 0, 0, tzinfo=timezone.utc)
    ref_iso = ref_time.isoformat()

    scenarios = [
        # Scenario 1: Nominal Operating Flow (Pump Active)
        {
            "id": "01_nominal_flow_pump_running",
            "description": "Nominal flow conforming to baseline (12.0 L/min) with pump running.",
            "steps": [
                {
                    "sensor_1_flow": 12.1,
                    "sensor_2_flow": 11.9,
                    "pump_status": PumpStatus.PUMP_RUNNING.value,
                    "timestamp": ref_iso,
                    "reference_time": ref_iso,
                    "is_simulated": True
                }
            ]
        },

        # Scenario 2: Nominal Idle Condition (Pump Off)
        {
            "id": "02_nominal_idle_pump_off",
            "description": "Expected zero/trace flow when the pump relay is turned off.",
            "steps": [
                {
                    "sensor_1_flow": 0.0,
                    "sensor_2_flow": 0.0,
                    "pump_status": PumpStatus.PUMP_OFF.value,
                    "timestamp": ref_iso,
                    "reference_time": ref_iso,
                    "is_simulated": True
                }
            ]
        },

        # Scenario 3: Sustained Low Flow / Blockage Candidate (Pump Running)
        {
            "id": "03_sustained_low_flow_blockage",
            "description": "Low flow (< 6.0 L/min) persisting for 5 consecutive cycles with active pump.",
            "steps": [
                {
                    "sensor_1_flow": 3.5,
                    "sensor_2_flow": 3.4,
                    "pump_status": PumpStatus.PUMP_RUNNING.value,
                    "timestamp": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "reference_time": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "is_simulated": True
                }
                for i in range(5)
            ]
        },

        # Scenario 4: Transient Low Flow Recovery (Persistence Reset)
        {
            "id": "04_transient_low_flow_recovery",
            "description": "Transient flow dip for 3 cycles followed by complete recovery to nominal flow.",
            "steps": [
                {
                    "sensor_1_flow": 4.0,
                    "sensor_2_flow": 4.1,
                    "pump_status": PumpStatus.PUMP_RUNNING.value,
                    "timestamp": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "reference_time": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "is_simulated": True
                }
                for i in range(3)
            ] + [
                {
                    "sensor_1_flow": 12.0,
                    "sensor_2_flow": 11.8,
                    "pump_status": PumpStatus.PUMP_RUNNING.value,
                    "timestamp": (ref_time + timedelta(seconds=8)).isoformat(),
                    "reference_time": (ref_time + timedelta(seconds=8)).isoformat(),
                    "is_simulated": True
                }
            ]
        },

        # Scenario 5: Sustained Sensor Imbalance on Straight Pipe (Decoupled Fault)
        {
            "id": "05_sustained_sensor_imbalance",
            "description": "Sustained difference between S1 (12.0 L/min) and S2 (8.0 L/min) without asserting leak or blockage.",
            "steps": [
                {
                    "sensor_1_flow": 12.0,
                    "sensor_2_flow": 8.0,
                    "pump_status": PumpStatus.PUMP_RUNNING.value,
                    "timestamp": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "reference_time": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "is_simulated": True
                }
                for i in range(3)
            ]
        },

        # Scenario 6: Uncertain Operating State (Low Flow with Pump Status Unknown)
        {
            "id": "06_uncertain_operating_state",
            "description": "Sustained low flow observed while pump status is unknown; returns uncertain state rather than asserting blockage.",
            "steps": [
                {
                    "sensor_1_flow": 2.5,
                    "sensor_2_flow": 2.6,
                    "pump_status": PumpStatus.UNKNOWN.value,
                    "timestamp": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "reference_time": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "is_simulated": True
                }
                for i in range(5)
            ]
        },

        # Scenario 7: Missing Telemetry Handling (Both Sensors Missing)
        {
            "id": "07_missing_telemetry",
            "description": "Both upstream and downstream sensor readings missing; triggers diagnostic directive.",
            "steps": [
                {
                    "sensor_1_flow": None,
                    "sensor_2_flow": None,
                    "pump_status": PumpStatus.PUMP_RUNNING.value,
                    "timestamp": ref_iso,
                    "reference_time": ref_iso,
                    "is_simulated": True
                }
            ]
        },

        # Scenario 8: Physical Sensor Glitch / Invalid Negative Reading
        {
            "id": "08_invalid_negative_flow",
            "description": "Physically impossible negative flow reading rejected as instrument glitch.",
            "steps": [
                {
                    "sensor_1_flow": -2.5,
                    "sensor_2_flow": 10.0,
                    "pump_status": PumpStatus.PUMP_RUNNING.value,
                    "timestamp": ref_iso,
                    "reference_time": ref_iso,
                    "is_simulated": True
                }
            ]
        },

        # Scenario 9: Unstable Telemetry / High-Frequency Jitter
        {
            "id": "09_unstable_jitter_telemetry",
            "description": "Erratic pulse jitter exceeding rolling standard deviation stability limit.",
            "steps": [
                {
                    "sensor_1_flow": val,
                    "sensor_2_flow": 12.0,
                    "pump_status": PumpStatus.PUMP_RUNNING.value,
                    "timestamp": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "reference_time": (ref_time + timedelta(seconds=i * 2)).isoformat(),
                    "is_simulated": True
                }
                for i, val in enumerate([12.0, 3.0, 15.0, 2.0, 14.0])
            ]
        },

        # Scenario 10: Stale Telemetry Latency
        {
            "id": "10_stale_telemetry_latency",
            "description": "Incoming telemetry latency (25s) exceeds maximum freshness threshold (15s).",
            "steps": [
                {
                    "sensor_1_flow": 12.0,
                    "sensor_2_flow": 12.0,
                    "pump_status": PumpStatus.PUMP_RUNNING.value,
                    "timestamp": (ref_time - timedelta(seconds=25)).isoformat(),
                    "reference_time": ref_iso,
                    "is_simulated": True
                }
            ]
        }
    ]

    generated_manifest = []

    for item in scenarios:
        scen_id = item["id"]
        screener.reset()

        last_output = None
        for step in item["steps"]:
            last_output = screener.screen(
                sensor_1_flow=step["sensor_1_flow"],
                sensor_2_flow=step["sensor_2_flow"],
                pump_status=step["pump_status"],
                timestamp=step["timestamp"],
                reference_time=step["reference_time"],
                is_simulated=step["is_simulated"]
            )

        # Save primary input definition
        input_payload = {
            "scenario_id": scen_id,
            "description": item["description"],
            "total_cycles_simulated": len(item["steps"]),
            "final_cycle_input": item["steps"][-1],
            "all_cycle_inputs": item["steps"]
        }

        input_path = os.path.join(output_dir, f"{scen_id}_input.json")
        output_path = os.path.join(output_dir, f"{scen_id}_output.json")

        with open(input_path, "w", encoding="utf-8") as f:
            json.dump(input_payload, f, indent=2)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(last_output, f, indent=2)

        generated_manifest.append({
            "scenario": scen_id,
            "status": last_output["status"],
            "severity": last_output["severity"],
            "action_category": last_output["recommended_human_action"]["category"]
        })

        print(f"Generated {input_path} -> {output_path} (Status: {last_output['status']}, Severity: {last_output['severity']})")

    manifest_path = os.path.join(output_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(generated_manifest, f, indent=2)

    print(f"\nAll {len(scenarios)} prototype blockage examples generated successfully in {output_dir}")
    return generated_manifest


if __name__ == "__main__":
    generate_all_examples()
