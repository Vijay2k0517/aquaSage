"""
Configuration and enumeration types for the AquaSage Hardware Prototype Blockage-Screening Module.
Dedicated to dual-sensor straight-pipe (YF-S201) bench prototype testing.
"""

from dataclasses import dataclass
from enum import Enum


class PumpStatus(str, Enum):
    """Operating status of the flow-inducing pump."""
    PUMP_RUNNING = "PUMP_RUNNING"
    PUMP_OFF = "PUMP_OFF"
    UNKNOWN = "UNKNOWN"


class BlockageStatus(str, Enum):
    """Categorical screening outcome for dual-sensor straight-pipe flow."""
    NOMINAL = "NOMINAL"
    NOMINAL_IDLE = "NOMINAL_IDLE"
    SUSTAINED_LOW_FLOW = "SUSTAINED_LOW_FLOW"
    SENSOR_IMBALANCE = "SENSOR_IMBALANCE"
    UNCERTAIN_OPERATING_STATE = "UNCERTAIN_OPERATING_STATE"
    UNSTABLE_TELEMETRY = "UNSTABLE_TELEMETRY"
    STALE_TELEMETRY = "STALE_TELEMETRY"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    INVALID_READING = "INVALID_READING"


class FlowUnit(str, Enum):
    """Flow measurement engineering units."""
    L_PER_MIN = "L/min"
    M3_PER_H = "m3/h"


@dataclass
class BlockageScreeningConfig:
    """
    Configurable screening parameters for dual YF-S201 straight-pipe prototype.
    Nominal YF-S201 sensor range is 1.0 to 30.0 L/min (~0.06 to 1.8 m3/h).
    """
    # Operating baseline when pump is active
    baseline_flow_l_per_min: float = 12.0

    # Low-flow ratio threshold relative to operating baseline (e.g. < 50% baseline)
    low_flow_ratio_threshold: float = 0.50

    # Persistence cycles required to flag sustained low flow (e.g. 5 consecutive readings)
    low_flow_persistence_cycles: int = 5

    # Sensor difference threshold between upstream (S1) and downstream (S2) on unbranched straight pipe
    sensor_imbalance_abs_threshold_l_per_min: float = 1.50
    sensor_imbalance_ratio_threshold: float = 0.20
    sensor_imbalance_persistence_cycles: int = 3

    # High-frequency jitter / instability threshold (standard deviation over rolling window)
    jitter_window_size: int = 5
    jitter_std_threshold_l_per_min: float = 3.0

    # Staleness tolerance in seconds
    max_stale_seconds: float = 15.0

    # Physical plausibility boundaries for YF-S201 turbine sensors
    min_plausible_flow_l_per_min: float = 0.0
    max_plausible_flow_l_per_min: float = 35.0  # 30 L/min nominal rating + 15% surge headroom
