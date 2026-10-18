"""
Phase 3C: Unified Decision Engine Configuration & Rule Definitions.
Defines configurable operating thresholds, severity levels, regulatory guidelines,
staleness bounds, and standard operator action templates.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Tuple


class SeverityLevel(str, Enum):
    INFO = "INFO"
    ADVISORY = "ADVISORY"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class SourceType(str, Enum):
    LIVE_TELEMETRY = "LIVE_TELEMETRY"
    HISTORICAL_BATCH = "HISTORICAL_BATCH"
    SIMULATED_HYDRAULIC_MODEL = "SIMULATED_HYDRAULIC_MODEL"
    FIELD_GRAB_SAMPLE = "FIELD_GRAB_SAMPLE"


class DataQualityStatus(str, Enum):
    VALID = "VALID"
    STALE = "STALE"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    UNCOLLECTED_SAMPLE = "UNCOLLECTED_SAMPLE"
    CONFLICTING = "CONFLICTING"


@dataclass
class FlowLeakConfig:
    """Configurable flow anomaly detection parameters."""
    calibrated_threshold: float = 2.3765   # Calibrated on Area 1 validation split (99th percentile)
    advisory_hours: int = 1                # Hours of persistent elevation for Advisory (confirmed non-transient)
    warning_hours: int = 6                 # Hours of persistent elevation for Warning
    critical_hours: int = 12               # Hours of persistent elevation for Critical
    excess_flow_critical_m3h: float = 15.0 # High volumetric rupture threshold (immediate critical burst)
    max_stale_minutes: int = 30            # Flow telemetry older than 30 min is considered stale
    min_plausible_flow_m3h: float = 0.0    # Backflow / negative flow impossible on DMA inlet meter
    max_plausible_flow_m3h: float = 500.0  # Physical pipe capacity upper bound


@dataclass
class TankLevelConfig:
    """
    Configurable hydraulic tank operating thresholds.
    Source: AWWA (American Water Works Association) Distribution Reservoir Operating Standards.
    Tank Height: 10.0m, Capacity: 500 m³.
    """
    critical_low_m: float = 2.0    # Danger of suction cavitation & pipe back-siphonage
    advisory_low_m: float = 3.5    # Buffer depletion; trigger pump refill
    advisory_high_m: float = 8.0   # Storage limit; throttle supply pump
    critical_high_m: float = 9.5   # Overflow imminent (tank capacity 10.0m)
    tank_height_max_m: float = 10.0 # Physical structural height
    rapid_decline_rate_m_per_h: float = 1.0 # Abnormal drain velocity
    max_stale_minutes: int = 15    # Tank telemetry older than 15 min is considered stale
    min_plausible_level_m: float = 0.0 # Cannot have negative water level
    max_plausible_level_m: float = 12.0 # Structural wall overflow limit


@dataclass
class WaterQualityConfig:
    """
    Configurable drinking water quality guidelines and screening standards.
    Sources:
    - Primary Disinfection & Health: WHO Guidelines (4th ed.) and US EPA National Primary Drinking Water Regulations (Turbidity).
    - Secondary Aesthetic & Corrosivity Guidelines: US EPA National Secondary Drinking Water Regulations (pH, TDS).
    - Distribution Stagnation & Ecological Reference: US EPA Aquatic Life Criteria (Dissolved Oxygen minimums).
    """
    ph_min: float = 6.5
    ph_max: float = 8.5
    ph_critical_low: float = 5.5        # Severe pipe-corrosive acidity
    ph_critical_high: float = 9.5       # Caustic / alkaline scale hazard
    turbidity_max_ntu: float = 5.0      # WHO aesthetic and disinfection limit (< 1 NTU ideal)
    turbidity_critical_ntu: float = 25.0 # Extreme particulate suspension shielding pathogens
    do_min_mg_l: float = 5.0            # Healthy oxygenation target (stagnation screening)
    do_hypoxia_mg_l: float = 2.0        # Severe hypoxia / anaerobic decay limit
    conductivity_max_us_cm: float = 1000.0 # Standard mineral/potable screening limit
    conductivity_critical_us_cm: float = 1500.0 # Contaminant / saline intrusion indicator
    tds_max_mg_l: float = 500.0         # EPA secondary aesthetic limit
    tds_critical_mg_l: float = 1000.0   # Extreme mineralization / unpalatable threshold
    max_sample_age_days: int = 14       # Grab sample validity window
    # Physical/Chemical plausibility limits
    ph_plausible_min: float = 0.0
    ph_plausible_max: float = 14.0
    do_plausible_max: float = 25.0      # Maximum physical dissolved oxygen saturation
    tds_plausible_max: float = 10000.0


@dataclass
class EngineConfig:
    """Master engine configuration."""
    flow: FlowLeakConfig = field(default_factory=FlowLeakConfig)
    tank: TankLevelConfig = field(default_factory=TankLevelConfig)
    wq: WaterQualityConfig = field(default_factory=WaterQualityConfig)


