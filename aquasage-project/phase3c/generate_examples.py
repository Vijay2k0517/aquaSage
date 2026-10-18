"""
Script to generate official example input and output JSON payloads for Phase 3C.
Runs the AquaSageDecisionEngine on 7 representative scenarios and saves formatted JSONs.
"""

import os
import sys
sys.path.insert(0, os.path.abspath('.'))
import json
from datetime import datetime, timezone
from phase3c.config import SourceType, EngineConfig
from phase3c.engine import AquaSageDecisionEngine

def generate_all_examples(output_dir: str = "phase3c/examples"):
    os.makedirs(output_dir, exist_ok=True)
    engine = AquaSageDecisionEngine()
    ref_time = "2026-10-16T12:00:00+00:00"

    scenarios = [
        # Scenario 1: Normal Conditions
        (
            "01_normal_conditions",
            {
                "reference_time": ref_time,
                "flow_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.LIVE_TELEMETRY.value,
                    "flow_m3h": 32.5,
                    "predicted_flow_m3h": 32.0,
                    "anomaly_score": 0.5,
                    "persistence_hours": 0
                },
                "tank_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.SIMULATED_HYDRAULIC_MODEL.value,
                    "current_level_m": 6.2,
                    "forecast_5m": 6.18,
                    "forecast_15m": 6.15,
                    "forecast_30m": 6.10,
                    "inflow_m3h": 35.0,
                    "outflow_m3h": 35.0,
                    "is_simulated": True
                },
                "wq_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.FIELD_GRAB_SAMPLE.value,
                    "station_id": "STATION_01",
                    "ph": 7.4,
                    "turbidity_ntu": 1.2,
                    "dissolved_oxygen_mg_l": 8.2,
                    "conductivity_us_cm": 450.0,
                    "tds_mg_l": 220.0
                }
            }
        ),

        # Scenario 2: Suspected Distribution Leak
        (
            "02_suspected_leak",
            {
                "reference_time": ref_time,
                "flow_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.LIVE_TELEMETRY.value,
                    "flow_m3h": 44.0,
                    "predicted_flow_m3h": 33.0,
                    "anomaly_score": 3.45,
                    "threshold": 2.3765,
                    "persistence_hours": 8
                },
                "tank_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.SIMULATED_HYDRAULIC_MODEL.value,
                    "current_level_m": 5.8,
                    "forecast_5m": 5.75,
                    "forecast_15m": 5.7,
                    "forecast_30m": 5.65,
                    "inflow_m3h": 35.0,
                    "outflow_m3h": 37.0,
                    "is_simulated": True
                },
                "wq_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.FIELD_GRAB_SAMPLE.value,
                    "station_id": "STATION_01",
                    "ph": 7.2,
                    "turbidity_ntu": 1.8,
                    "dissolved_oxygen_mg_l": 7.8,
                    "conductivity_us_cm": 480.0
                }
            }
        ),

        # Scenario 3: Low Predicted Tank Level
        (
            "03_low_tank_level",
            {
                "reference_time": ref_time,
                "flow_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.LIVE_TELEMETRY.value,
                    "flow_m3h": 33.0,
                    "predicted_flow_m3h": 32.5,
                    "anomaly_score": 0.4,
                    "persistence_hours": 0
                },
                "tank_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.SIMULATED_HYDRAULIC_MODEL.value,
                    "current_level_m": 2.7,
                    "forecast_5m": 2.35,
                    "forecast_15m": 2.05,
                    "forecast_30m": 1.82,
                    "inflow_m3h": 20.0,
                    "outflow_m3h": 45.0,
                    "is_simulated": True
                },
                "wq_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.FIELD_GRAB_SAMPLE.value,
                    "station_id": "STATION_02",
                    "ph": 7.3,
                    "turbidity_ntu": 1.5,
                    "dissolved_oxygen_mg_l": 8.0,
                    "conductivity_us_cm": 460.0
                }
            }
        ),

        # Scenario 4: Water Quality Anomaly
        (
            "04_water_quality_anomaly",
            {
                "reference_time": ref_time,
                "flow_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.LIVE_TELEMETRY.value,
                    "flow_m3h": 31.0,
                    "predicted_flow_m3h": 31.5,
                    "anomaly_score": 0.3,
                    "persistence_hours": 0
                },
                "tank_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.SIMULATED_HYDRAULIC_MODEL.value,
                    "current_level_m": 6.5,
                    "forecast_5m": 6.5,
                    "forecast_15m": 6.5,
                    "forecast_30m": 6.5,
                    "inflow_m3h": 30.0,
                    "outflow_m3h": 30.0,
                    "is_simulated": True
                },
                "wq_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.FIELD_GRAB_SAMPLE.value,
                    "station_id": "STATION_04",
                    "ph": 5.2,
                    "turbidity_ntu": 28.5,
                    "dissolved_oxygen_mg_l": 1.8,
                    "conductivity_us_cm": 1600.0,
                    "tds_mg_l": 490.0
                }
            }
        ),

        # Scenario 5: Missing and Stale Data
        (
            "05_missing_stale_data",
            {
                "reference_time": ref_time,
                "flow_data": {
                    "timestamp": "2026-10-16T11:15:00+00:00", # 45 minutes stale (> 30 min)
                    "source_type": SourceType.LIVE_TELEMETRY.value,
                    "flow_m3h": 34.0,
                    "predicted_flow_m3h": 33.0,
                    "anomaly_score": 0.6
                },
                "tank_data": None, # Missing tank telemetry
                "wq_data": {
                    "timestamp": "2026-09-20T10:00:00+00:00", # Stale grab sample (> 14 days old)
                    "source_type": SourceType.FIELD_GRAB_SAMPLE.value,
                    "station_id": "STATION_05",
                    "ph": 7.4,
                    "turbidity_ntu": 1.9,
                    "dissolved_oxygen_mg_l": 7.5,
                    "conductivity_us_cm": 480.0
                }
            }
        ),

        # Scenario 6: Simultaneous Compounded Alerts
        (
            "06_simultaneous_alerts",
            {
                "reference_time": ref_time,
                "flow_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.LIVE_TELEMETRY.value,
                    "flow_m3h": 49.0,
                    "predicted_flow_m3h": 34.0,
                    "anomaly_score": 3.8,
                    "persistence_hours": 7
                },
                "tank_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.SIMULATED_HYDRAULIC_MODEL.value,
                    "current_level_m": 3.1,
                    "forecast_5m": 2.7,
                    "forecast_15m": 2.3,
                    "forecast_30m": 1.9,
                    "inflow_m3h": 15.0,
                    "outflow_m3h": 45.0,
                    "is_simulated": True
                },
                "wq_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.FIELD_GRAB_SAMPLE.value,
                    "station_id": "STATION_02",
                    "ph": 7.1,
                    "turbidity_ntu": 6.2,
                    "dissolved_oxygen_mg_l": 7.5,
                    "conductivity_us_cm": 500.0
                }
            }
        ),

        # Scenario 7: Uncollected Water Quality Sample
        (
            "07_uncollected_sample",
            {
                "reference_time": ref_time,
                "flow_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.LIVE_TELEMETRY.value,
                    "flow_m3h": 33.0,
                    "predicted_flow_m3h": 32.8,
                    "anomaly_score": 0.4,
                    "persistence_hours": 0
                },
                "tank_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.SIMULATED_HYDRAULIC_MODEL.value,
                    "current_level_m": 5.5,
                    "forecast_5m": 5.48,
                    "forecast_15m": 5.45,
                    "forecast_30m": 5.40,
                    "inflow_m3h": 32.0,
                    "outflow_m3h": 33.0,
                    "is_simulated": True
                },
                "wq_data": {
                    "timestamp": ref_time,
                    "source_type": SourceType.FIELD_GRAB_SAMPLE.value,
                    "station_id": "STATION_07",
                    "uncollected_remark": "Water level is too low to collect sample"
                }
            }
        )
    ]

    for prefix, payload in scenarios:
        # Save input JSON
        in_path = os.path.join(output_dir, f"{prefix}_input.json")
        with open(in_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        # Run engine
        output = engine.evaluate(
            flow_data=payload.get("flow_data"),
            tank_data=payload.get("tank_data"),
            wq_data=payload.get("wq_data"),
            reference_time=payload.get("reference_time")
        )

        # Save output JSON
        out_path = os.path.join(output_dir, f"{prefix}_output.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)

        print(f"Generated {in_path} -> {out_path} (Severity: {output['overall_severity']}, Status: {output['system_status']})")

if __name__ == "__main__":
    generate_all_examples()
