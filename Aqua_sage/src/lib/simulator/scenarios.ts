/**
 * AquaSage 3D IoT Digital Twin - Deterministic Simulation Scenarios
 * Defines reproducible initial states and explicit behavior rules for all supported scenarios.
 */

import { ScenarioDefinition, ScenarioId } from './telemetryTypes';

export const SCENARIO_DEFINITIONS: Record<ScenarioId, ScenarioDefinition> = {
  // ─────────────────────────────────────────────────────────────────────────
  // MODE 1: NORMAL OPERATION
  // ─────────────────────────────────────────────────────────────────────────
  normal: {
    id: 'normal',
    name: 'Normal Village Distribution Operation',
    shortLabel: 'Normal Operation',
    description:
      'Steady-state drinking water distribution. Clean water flows from the source reservoir through FS-01 and FS-02 directly to Zones A, B, and C. Normal distribution route V-DIST is open, diversion valve V-DIV is closed.',
    isFaultScenario: false,
    initialState: {
      tankWaterHeight: 0.75, // 0.75 m (75.0 cm, 187.5 L, 75%)
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 2.80,
      deliveryPressureBar: 2.40,
      tdsPpm: 180,
      turbidityNtu: 1.5,
      motorCurrentA: 4.2,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: false,
      valveVdistClosed: false,
      filtrationState: 'IDLE',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 2: PIPE LEAK BETWEEN FS-01 AND FS-02
  // ─────────────────────────────────────────────────────────────────────────
  leak: {
    id: 'leak',
    name: 'Simulated Pipe Rupture / Leak (Between FS-01 and FS-02)',
    shortLabel: 'Leak Simulation',
    description:
      'Simulated physical rupture on the distribution pipeline between FS-01 and FS-02. Escaping fluid creates a measurable discrepancy: Upstream FS-01 (18.0 L/min) - Downstream FS-02 (13.0 L/min) = 5.0 L/min leak loss.',
    faultDescription: 'Pipeline rupture between FS-01 and FS-02. Discrepancy of 5.0 L/min detected.',
    isFaultScenario: true,
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 10.5,
      dischargePressureBar: 2.80,
      deliveryPressureBar: 0.60,
      tdsPpm: 180,
      turbidityNtu: 1.5,
      motorCurrentA: 4.8,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: false,
      valveVdistClosed: false,
      filtrationState: 'IDLE',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 3A: ELEVATED TDS CONTAMINATION
  // ─────────────────────────────────────────────────────────────────────────
  elevated_tds: {
    id: 'elevated_tds',
    name: 'Elevated TDS Contamination (> 500 ppm)',
    shortLabel: 'Elevated TDS',
    description:
      'Injected dissolved solids spike at 850 ppm exceeding the secondary drinking water guideline of 500 ppm. Automated controller isolates village route V-DIST and commands diversion V-DIV open to filtration.',
    faultDescription: 'TDS at 850 ppm breaches 500 ppm aesthetic/mineral advisory threshold.',
    isFaultScenario: true,
    scientificAdvisory:
      'Elevated Total Dissolved Solids (> 500 ppm) indicates high dissolved ionic minerals (calcium, magnesium, chloride, or salinity). Non-conclusive of microbiological hazard alone.',
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 2.80,
      deliveryPressureBar: 2.35,
      tdsPpm: 850, // Breaches 500 ppm warning and 800 ppm critical observation threshold
      turbidityNtu: 1.5,
      motorCurrentA: 4.2,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: true,
      valveVdistClosed: true,
      filtrationState: 'DIVERTING',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 3B: ELEVATED TURBIDITY CONTAMINATION
  // ─────────────────────────────────────────────────────────────────────────
  elevated_turbidity: {
    id: 'elevated_turbidity',
    name: 'Elevated Turbidity Contamination (> 5.0 NTU)',
    shortLabel: 'Elevated Turbidity',
    description:
      'Injected optical particulate surge at 38.5 NTU exceeding the 5.0 NTU clarity threshold. Controller diverts flow into the dual-media filtration vessel to prevent particulate delivery to village taps.',
    faultDescription: 'Turbidity at 38.5 NTU breaches 5.0 NTU clarity threshold and 25.0 NTU critical flag.',
    isFaultScenario: true,
    scientificAdvisory:
      'Elevated Optical Turbidity (> 5.0 NTU) indicates suspended particulate matter (sediment, organic matter, or colloidal clays). Non-conclusive of microbial pathogen presence alone.',
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 2.80,
      deliveryPressureBar: 2.35,
      tdsPpm: 180,
      turbidityNtu: 38.5, // Breaches 5.0 NTU warning and 25.0 NTU critical flag
      motorCurrentA: 4.2,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: true,
      valveVdistClosed: true,
      filtrationState: 'DIVERTING',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 3C: COMBINED CONTAMINATION
  // ─────────────────────────────────────────────────────────────────────────
  combined_contamination: {
    id: 'combined_contamination',
    name: 'Combined Contamination (TDS 850 ppm & Turbidity 38.5 NTU)',
    shortLabel: 'Combined Contam.',
    description:
      'Simultaneous contamination spike in both dissolved minerals and suspended solids. Triggers complete village isolation, high-speed automated diversion V-DIV, and multi-stage treatment.',
    faultDescription: 'Simultaneous critical contamination: TDS 850 ppm and Turbidity 38.5 NTU.',
    isFaultScenario: true,
    scientificAdvisory:
      'Multiple water-quality parameters breached simultaneously. Village supply isolated immediately to protect consumers.',
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 2.80,
      deliveryPressureBar: 2.35,
      tdsPpm: 850,
      turbidityNtu: 38.5,
      motorCurrentA: 4.2,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: true,
      valveVdistClosed: true,
      filtrationState: 'DIVERTING',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 5: FILTRATION & WATER RETURN
  // ─────────────────────────────────────────────────────────────────────────
  filtration_return: {
    id: 'filtration_return',
    name: 'Automated Filtration & Treated Water Release',
    shortLabel: 'Filtration & Return',
    description:
      'Demonstrates the complete closed-loop treatment cycle: Contaminated water is diverted, passes Stage 1 & 2 filtration, post-treatment sensors verify TDS <= 500 and Turbidity <= 5.0, release valve V-REL opens, returning water to distribution.',
    isFaultScenario: false,
    scientificAdvisory:
      'Treated effluent verified: TDS 297.5 ppm and Turbidity 3.4 NTU meet all monitored release criteria. Safe return procedure executed.',
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 2.80,
      deliveryPressureBar: 2.35,
      tdsPpm: 850,
      turbidityNtu: 38.5,
      motorCurrentA: 4.2,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: true,
      valveVdistClosed: true,
      filtrationState: 'FILTERING',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 6: FILTER PASS LIMIT EXCEEDED
  // ─────────────────────────────────────────────────────────────────────────
  filter_limit: {
    id: 'filter_limit',
    name: 'Maximum Treatment Passes Exceeded (Strict Isolation)',
    shortLabel: 'Max Pass Exceeded',
    description:
      'Severe raw water contamination (TDS 1800 ppm) exceeds treatment capacity. After reaching the maximum allowed 3 filtration passes without satisfying release criteria, water is kept strictly isolated and a high-priority alarm is raised. Never released to villages.',
    faultDescription: 'CRITICAL ALARM: Maximum 3 treatment passes reached without satisfying release thresholds.',
    isFaultScenario: true,
    scientificAdvisory:
      'Water quality remains unacceptable after 3 treatment passes. Automated release valve V-REL is locked closed. Operator intervention required.',
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 2.80,
      deliveryPressureBar: 2.35,
      tdsPpm: 1800, // Extremely severe salinity / brine
      turbidityNtu: 45.0,
      motorCurrentA: 4.2,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: true,
      valveVdistClosed: true,
      filtrationState: 'FILTER_LIMIT_REACHED',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 7A: LOW TANK LEVEL
  // ─────────────────────────────────────────────────────────────────────────
  low_level: {
    id: 'low_level',
    name: 'Source Reservoir Depletion (Low Level)',
    shortLabel: 'Low Tank Level',
    description:
      'Deterministic reservoir depletion caused by an unreplenished supply deficit. Outflow exceeds Inflow, steadily decreasing water column height and volume toward warning (<25cm) and critical (<10cm) thresholds.',
    faultDescription: 'Reservoir level depleting toward warning and critical thresholds.',
    isFaultScenario: true,
    initialState: {
      tankWaterHeight: 0.32,
      inflowRateLpm: 6.0,
      outflowRateLpm: 21.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 2.50,
      deliveryPressureBar: 2.10,
      tdsPpm: 185,
      turbidityNtu: 1.8,
      motorCurrentA: 4.0,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: false,
      valveVdistClosed: false,
      filtrationState: 'IDLE',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 7B: RESTRICTED FLOW / BLOCKAGE
  // ─────────────────────────────────────────────────────────────────────────
  restricted_flow: {
    id: 'restricted_flow',
    name: 'Pipeline Throttle / Delivery Blockage',
    shortLabel: 'Restricted Flow',
    description:
      'Simulated downstream pipeline restriction (e.g. sediment clogging or partially closed delivery valve V2 throttled to 25%). Volumetric flow drops to 4.5 L/min and backpressure rises.',
    faultDescription: 'Restricted flow: Downstream throttle valve V2 throttled to 25%. Delivery flow restricted to 4.5 L/min.',
    isFaultScenario: true,
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 4.5,
      outflowRateLpm: 4.5,
      leakRateLpm: 0.0,
      dischargePressureBar: 3.80, // Elevated discharge backpressure
      deliveryPressureBar: 0.80, // Severely dropped delivery pressure
      tdsPpm: 180,
      turbidityNtu: 1.5,
      motorCurrentA: 3.2,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 25, // 25% throttled
      valveVdivOpen: false,
      valveVdistClosed: false,
      filtrationState: 'IDLE',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 7C: PUMP FAILURE
  // ─────────────────────────────────────────────────────────────────────────
  pump_failure: {
    id: 'pump_failure',
    name: 'Pumping Station Trip / Motor Failure',
    shortLabel: 'Pump Failure',
    description:
      'Centrifugal pump motor tripped or stalled. Motor current drops to 0.0 A, rotational speed drops to 0 RPM, delivery flow collapses to 0.0 L/min, and village supply halts.',
    faultDescription: 'CRITICAL ALARM: Primary pump motor electrical trip. Zero distribution flow.',
    isFaultScenario: true,
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 0.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 0.20,
      deliveryPressureBar: 0.00,
      tdsPpm: 180,
      turbidityNtu: 1.5,
      motorCurrentA: 0.0,
      motorSpeedRpm: 0,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: false,
      valveVdistClosed: false,
      pumpFaulted: true,
      filtrationState: 'IDLE',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 7D: LOW PRESSURE
  // ─────────────────────────────────────────────────────────────────────────
  low_pressure: {
    id: 'low_pressure',
    name: 'Low Distribution Pressure Alarm (< 1.5 bar)',
    shortLabel: 'Low Pressure',
    description:
      'Distribution network pressure drops to 1.10 bar breaching the 1.50 bar low-pressure warning threshold. Downstream village zones suffer inadequate delivery head.',
    faultDescription: 'Warning: Delivery line pressure 1.10 bar breaches low pressure threshold (1.50 bar).',
    isFaultScenario: true,
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 12.0,
      outflowRateLpm: 12.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 1.45,
      deliveryPressureBar: 1.10,
      tdsPpm: 180,
      turbidityNtu: 1.5,
      motorCurrentA: 3.5,
      motorSpeedRpm: 2400,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: false,
      valveVdistClosed: false,
      filtrationState: 'IDLE',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 7E: SENSOR FAULT / DISCONNECTION
  // ─────────────────────────────────────────────────────────────────────────
  sensor_fault: {
    id: 'sensor_fault',
    name: 'Sensor Signal Fault & Bus Disconnection',
    shortLabel: 'Sensor Fault',
    description:
      'Simulated hardware bus disconnect on flow sensor FS-01. Telemetry is classified as unavailable (null), preventing misleading zero readings and distinguishing physical disconnection from zero flow.',
    faultDescription: 'Flow Sensor FS-01 disconnected. Hardware pulse counter communication timeout.',
    isFaultScenario: true,
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 2.80,
      deliveryPressureBar: 2.40,
      tdsPpm: 180,
      turbidityNtu: 1.5,
      motorCurrentA: 4.2,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: false,
      valveVdistClosed: false,
      filtrationState: 'IDLE',
      flowSensorValidity: 'unavailable',
      flowSensorConnection: 'simulated_disconnected',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 7F: FILTER CLOGGING / DEGRADATION
  // ─────────────────────────────────────────────────────────────────────────
  filter_clogged: {
    id: 'filter_clogged',
    name: 'Filtration Media Fouling & Clogging',
    shortLabel: 'Filter Clogged',
    description:
      'Stage 1 dual-media particulate bed reaches 96% sediment loading. Differential pressure across filter increases, throughput drops by 75%, triggering automated backwash maintenance advisory.',
    faultDescription: 'Maintenance Warning: Filter vessel loading at 96%. Throughput severely restricted.',
    isFaultScenario: true,
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 3.40,
      deliveryPressureBar: 1.90,
      tdsPpm: 350,
      turbidityNtu: 12.0,
      motorCurrentA: 4.5,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: true,
      valveVdistClosed: true,
      filterClogged: true,
      filtrationState: 'FILTERING',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 7G: VALVE ACTUATOR FAILURE
  // ─────────────────────────────────────────────────────────────────────────
  valve_failure: {
    id: 'valve_failure',
    name: 'Diversion Valve V-DIV Actuator Jam / Failure',
    shortLabel: 'Valve Failure',
    description:
      'Automated contamination diversion valve V-DIV commanded OPEN following water quality alert, but mechanical actuator is jammed CLOSED. Alarm raised and emergency pump interlock triggered.',
    faultDescription: 'CRITICAL ALARM: Commanded valve V-DIV failed to open. Diverter actuator position feedback mismatch.',
    isFaultScenario: true,
    initialState: {
      tankWaterHeight: 0.75,
      inflowRateLpm: 18.0,
      outflowRateLpm: 18.0,
      leakRateLpm: 0.0,
      dischargePressureBar: 2.80,
      deliveryPressureBar: 2.40,
      tdsPpm: 850,
      turbidityNtu: 1.5,
      motorCurrentA: 4.2,
      motorSpeedRpm: 2850,
      valveV1OpenPercent: 100,
      valveV2OpenPercent: 100,
      valveVdivOpen: false, // Commanded open, but stuck closed
      valveVdistClosed: true,
      valveFaulted: true,
      filtrationState: 'DIVERTING',
      flowSensorValidity: 'valid',
      flowSensorConnection: 'simulated_online',
    },
  },
};

export const SCENARIO_LIST: ScenarioDefinition[] = Object.values(SCENARIO_DEFINITIONS);
