/**
 * AquaSage 3D IoT Digital Twin - Threshold & Operating Envelope Configuration
 *
 * IMPORTANT ENGINEERING NOTICE:
 * Sensor operating ranges represent physical transducer specifications.
 * Warning and critical alarm thresholds are provisional demonstration values
 * calibrated for virtual skid simulation and require field validation for production hardware.
 */

export interface ThresholdBoundary {
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
}

export interface SensorOperatingEnvelope {
  min: number;
  max: number;
  description: string;
}

export interface SensorConfigItem {
  id: string;
  name: string;
  unit: string;
  operatingRange: SensorOperatingEnvelope;
  alarmThresholds: ThresholdBoundary;
  isProvisional: boolean;
  notes: string;
}

/**
 * Geometric and Physical Constants for the AquaSage Storage Reservoir
 */
export const TANK_PHYSICAL_CONSTANTS = {
  INTERNAL_DIAMETER_M: 0.5642,
  RADIUS_M: 0.2821,
  SHELL_HEIGHT_M: 1.20,
  MAX_USABLE_HEIGHT_M: 1.00,
  USABLE_CAPACITY_LITRES: 250.0,
  CROSS_SECTIONAL_AREA_M2: 0.249987, // ~0.25 m²
  ULTRASONIC_MOUNT_STANDOFF_M: 1.25, // Standoff collar above tank base (125 cm)
  ULTRASONIC_DEADBAND_M: 0.25, // 25 cm minimum blind zone
};

/**
 * Threshold and Operating Range Registry for all Monitored Points
 */
export const SENSOR_CONFIG: Record<string, SensorConfigItem> = {
  'sensor-us01': {
    id: 'sensor-us01',
    name: 'Ultrasonic Level Sensor US-01',
    unit: 'cm',
    operatingRange: {
      min: 25.0,
      max: 450.0,
      description: 'Physical JSN-SR04T measuring envelope (Deadband < 25.0 cm)',
    },
    alarmThresholds: {
      criticalLow: 10.0,  // < 10 cm water height (overflow hazard/empty risk)
      warningLow: 25.0,   // < 25 cm water height (< 25% / 62.5 L)
      warningHigh: 90.0,  // > 90 cm water height (> 90% / 225 L)
      criticalHigh: 98.0, // > 98 cm water height (> 98% / 245 L, blind zone risk)
    },
    isProvisional: true,
    notes: 'Thresholds evaluated against water column height (cm). Ultrasonic distance d = 125cm - h.',
  },

  'sensor-fs01': {
    id: 'sensor-fs01',
    name: 'Primary In-Line Flow Sensor FS-01',
    unit: 'L/min',
    operatingRange: {
      min: 1.0,
      max: 30.0,
      description: 'YF-S201 linear rating envelope (1.0 to 30.0 L/min, F = 7.5 * Q)',
    },
    alarmThresholds: {
      criticalLow: 1.0,  // < 1.0 L/min: uncommanded stoppage / dry-run risk
      warningLow: 5.0,   // < 5.0 L/min: restricted or low circulation
      warningHigh: 25.0, // > 25.0 L/min: high flow warning (potential breach)
      criticalHigh: 30.0,// >= 30.0 L/min: reaches rated limit of sensor
    },
    isProvisional: true,
    notes: 'Provisional Demo Configuration. Rated linear envelope 1.0–30.0 L/min; readings outside this range are uncalibrated and untrustworthy.',
  },

  'sensor-pt01': {
    id: 'sensor-pt01',
    name: 'Pump Discharge Pressure Sensor PT-01',
    unit: 'bar',
    operatingRange: {
      min: 0.0,
      max: 10.0,
      description: '0 to 1.0 MPa piezoresistive transducer rating',
    },
    alarmThresholds: {
      criticalLow: 0.80, // < 0.80 bar: severe pump suction starvation or cavitation
      warningLow: 1.50,  // < 1.50 bar: below normal pump operating head
      warningHigh: 4.00, // > 4.00 bar: elevated backpressure
      criticalHigh: 5.00,// > 5.00 bar: overpressure surge / closed delivery valve
    },
    isProvisional: true,
    notes: 'Provisional limits; requires pressure relief valve sizing validation.',
  },

  'sensor-pt02': {
    id: 'sensor-pt02',
    name: 'Delivery Pressure Sensor PT-02',
    unit: 'bar',
    operatingRange: {
      min: 0.0,
      max: 10.0,
      description: '0 to 1.0 MPa piezoresistive transducer rating',
    },
    alarmThresholds: {
      criticalLow: 0.50, // < 0.50 bar: severe downstream rupture or loss of prime
      warningLow: 1.00,  // < 1.00 bar: low delivery pressure
      warningHigh: 4.00, // > 4.00 bar: elevated downstream pressure
      criticalHigh: 5.00,// > 5.00 bar: overpressure
    },
    isProvisional: true,
    notes: 'Baseline differential Delta-P (PT01 - PT02) is nominally ~0.40 bar across piping.',
  },

  'sensor-tds01': {
    id: 'sensor-tds01',
    name: 'Water Quality TDS Sensor TDS-01',
    unit: 'ppm',
    operatingRange: {
      min: 0,
      max: 1000,
      description: 'Analog electrolytic probe envelope (0 - 1000 ppm)',
    },
    alarmThresholds: {
      warningHigh: 500,  // > 500 ppm: EPA aesthetic secondary guideline
      criticalHigh: 800, // > 800 ppm: elevated dissolved solids observation
    },
    isProvisional: true,
    notes: 'Scientific advisory: TDS measures electrical conductivity, not potability or toxicity.',
  },

  'sensor-turb01': {
    id: 'sensor-turb01',
    name: 'Water Clarity Turbidity Sensor TURB-01',
    unit: 'NTU',
    operatingRange: {
      min: 0.0,
      max: 100.0,
      description: 'Analog optical nephelometer module (0.0 to 100.0 NTU)',
    },
    alarmThresholds: {
      warningHigh: 5.0,  // > 5.0 NTU: aesthetic clarity advisory
      criticalHigh: 25.0,// > 25.0 NTU: high suspended particulate observation
    },
    isProvisional: true,
    notes: 'Scientific advisory: Turbidity measures optical scattering (particles, silt, or microbubbles).',
  },

  'motor': {
    id: 'motor',
    name: 'Three-Phase Electric Motor',
    unit: 'A',
    operatingRange: {
      min: 0.0,
      max: 10.0,
      description: 'Motor current draw rating envelope (0 to 10.0 A)',
    },
    alarmThresholds: {
      warningLow: 1.5,  // < 1.5 A: motor unloaded / dry run
      warningHigh: 6.5, // > 6.5 A: high load
      criticalHigh: 7.5,// > 7.5 A: locked rotor or mechanical overload
    },
    isProvisional: true,
    notes: 'Virtual inferred motor model; Phase 3/4 software estimation.',
  },

  'sensor-fs02': {
    id: 'sensor-fs02',
    name: 'Downstream Distribution Flow Sensor FS-02',
    unit: 'L/min',
    operatingRange: {
      min: 1.0,
      max: 30.0,
      description: 'Downstream flow meter rating envelope (1.0 to 30.0 L/min)',
    },
    alarmThresholds: {
      criticalLow: 1.0,
      warningLow: 5.0,
      warningHigh: 25.0,
      criticalHigh: 30.0,
    },
    isProvisional: true,
    notes: 'Downstream flow measurement paired with FS-01 to compute pipeline mass-balance leak loss.',
  },

  'sensor-fs-out': {
    id: 'sensor-fs-out',
    name: 'Filtration Plant Outlet Flow Sensor FS-OUT',
    unit: 'L/min',
    operatingRange: {
      min: 0.0,
      max: 30.0,
      description: 'Filtration effluent flow rating (0 to 30.0 L/min)',
    },
    alarmThresholds: {
      criticalLow: 0.0,
      warningLow: 3.0,
      warningHigh: 25.0,
      criticalHigh: 30.0,
    },
    isProvisional: true,
    notes: 'Treated water effluent flow rate discharged from filtration train.',
  },

  'sensor-tds-post': {
    id: 'sensor-tds-post',
    name: 'Post-Treatment TDS Quality Sensor',
    unit: 'ppm',
    operatingRange: {
      min: 0,
      max: 1000,
      description: 'Electrolytic conductivity sensor at filtration outlet',
    },
    alarmThresholds: {
      warningHigh: 500,  // > 500 ppm prevents treated water release
      criticalHigh: 800,
    },
    isProvisional: true,
    notes: 'Release check gate: Must be <= 500 ppm for release valve V-REL to open.',
  },

  'sensor-turb-post': {
    id: 'sensor-turb-post',
    name: 'Post-Treatment Turbidity Clarity Sensor',
    unit: 'NTU',
    operatingRange: {
      min: 0.0,
      max: 100.0,
      description: 'Optical nephelometer at filtration outlet',
    },
    alarmThresholds: {
      warningHigh: 5.0,  // > 5.0 NTU prevents treated water release
      criticalHigh: 25.0,
    },
    isProvisional: true,
    notes: 'Release check gate: Must be <= 5.0 NTU for release valve V-REL to open.',
  },
};
