/**
 * AquaSage 3D IoT Digital Twin - Telemetry and Simulation Models
 * Defines strongly typed contracts for deterministic sensor readings, alarms, and simulation states.
 */

import { TelemetryUnit } from './types';

/**
 * Origin of the telemetry stream
 */
export type TelemetrySource = 'simulated' | 'physical';

/**
 * Measurement technical validity
 * Separate from alarm severity and connection state
 */
export type MeasurementValidity = 'valid' | 'invalid' | 'unavailable';

/**
 * Operational threshold compliance alarm severity
 */
export type AlarmSeverity = 'normal' | 'warning' | 'critical' | 'unknown';

/**
 * Connection state of the sensor/bus
 * Strictly separated from measurement validity
 */
export type SimulatedConnectionState =
  | 'simulated_online'
  | 'simulated_disconnected'
  | 'offline';

/**
 * Fault origin indicator
 * Distinguishes injected scenario states from physical detections
 */
export type FaultOrigin = 'injected_simulation' | 'none' | 'physical_detected';

/**
 * Single Normalized Telemetry Reading
 */
export interface TelemetryReading {
  sensorId: string;
  displayName: string;
  value: number | null; // null if invalid or unavailable
  formattedValue: string; // e.g. "18.0", "---", "UNAVAILABLE"
  unit: TelemetryUnit;
  timestamp: number; // Simulation timestamp in milliseconds
  source: TelemetrySource;
  validity: MeasurementValidity;
  severity: AlarmSeverity;
  connectionState: SimulatedConnectionState;
  faultOrigin: FaultOrigin;
  isOutOfOperatingRange?: boolean;
  operatingRange?: {
    min: number;
    max: number;
  };
  alarmThresholds?: {
    warningLow?: number;
    warningHigh?: number;
    criticalLow?: number;
    criticalHigh?: number;
  };
  notes?: string;
}

/**
 * Supported Deterministic Simulation Scenarios
 */
import { NetworkTopology, FiltrationState } from './networkTopology';
import { SimulationEvent } from './eventLogger';

/**
 * Supported Deterministic Simulation Scenarios
 */
export type ScenarioId =
  | 'normal'
  | 'low_level'
  | 'leak'
  | 'restricted_flow'
  | 'elevated_tds'
  | 'elevated_turbidity'
  | 'combined_contamination'
  | 'filtration_return'
  | 'filter_limit'
  | 'pump_failure'
  | 'low_pressure'
  | 'sensor_fault'
  | 'filter_clogged'
  | 'valve_failure';

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  shortLabel: string;
  description: string;
  faultDescription?: string;
  isFaultScenario: boolean;
  scientificAdvisory?: string;
  initialState: {
    tankWaterHeight: number; // in metres (0.0 - 1.0)
    inflowRateLpm: number; // in L/min
    outflowRateLpm: number; // in L/min
    leakRateLpm: number; // in L/min
    dischargePressureBar: number;
    deliveryPressureBar: number;
    tdsPpm: number;
    turbidityNtu: number;
    motorCurrentA: number;
    motorSpeedRpm: number;
    valveV1OpenPercent: number;
    valveV2OpenPercent: number;
    flowSensorValidity?: MeasurementValidity;
    flowSensorConnection?: SimulatedConnectionState;
    tdsSensorValidity?: MeasurementValidity;
    turbiditySensorValidity?: MeasurementValidity;
    filtrationState?: FiltrationState;
    valveVdivOpen?: boolean;
    valveVdistClosed?: boolean;
    valveFaulted?: boolean;
    filterClogged?: boolean;
    pumpFaulted?: boolean;
  };
}

/**
 * Complete Shared Simulation Engine State
 */
export interface SimulationState {
  scenarioId: ScenarioId;
  isRunning: boolean;
  stepCount: number;
  elapsedTimeSec: number;
  timeStepSec: number; // Fixed timestep, default 1.0s
  speedMultiplier: number; // 1, 2, or 5

  // Hydraulic State
  tankWaterHeight: number; // in metres (e.g. 0.75m)
  tankVolumeLitres: number; // calculated in Litres (e.g. 187.5 L)
  tankLevelPercentage: number; // calculated 0 - 100%
  inflowRateLpm: number;
  outflowRateLpm: number;
  leakRateLpm: number;
  netFlowRateLpm: number; // inflow - outflow - leak

  // Readouts for all registered components
  readings: Record<string, TelemetryReading>;

  // Complete Village Network & Filtration Topology
  network: NetworkTopology;

  // Leak Section Parameters
  leakSeverityLpm: number;
  leakLocationNorm: number; // 0.0 (near FS-01) to 1.0 (near FS-02)
  estimatedLeakLossLpm: number;

  // Filtration & Return Logic
  filtrationState: FiltrationState;
  filtrationPassCount: number;
  preTreatmentTds: number;
  preTreatmentTurbidity: number;
  postTreatmentTds: number;
  postTreatmentTurbidity: number;
  postTreatmentReleaseReady: boolean;

  // Village Supply Summary
  affectedVillages: string[];
  totalVillageDemandLpm: number;
  totalVillageDeliveredLpm: number;

  // Scenario, Events & Advisory Information
  activeFaults: string[];
  scientificAdvisory?: string;
  events: SimulationEvent[];
}
