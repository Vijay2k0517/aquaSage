/**
 * AquaSage Hardware-Driven Digital Twin — Telemetry & Backend Contract
 *
 * Defines the exact JSON payload transmitted to the FastAPI backend at:
 * POST /api/v1/sensor-data
 *
 * And the authoritative assessment structure returned by the backend.
 */

/**
 * Exact payload schema matching physical ESP32 DevKit V1 prototype
 */
export interface HardwareTelemetryPayload {
  device_id: string; // e.g. "ESP32-AQUASAGE-01"
  tank_id: string; // e.g. "TANK-MAIN-01"
  tank: {
    distance_cm: number; // HC-SR04 ultrasonic distance to water surface (e.g. 25.0 cm)
    water_level_percent: number; // Computed reservoir capacity (0.0 - 100.0%)
  };
  flow: {
    flow_1_lpm: number; // Inlet Flow Sensor 1 (YF-S201) in L/min
    flow_2_lpm: number; // Outlet Flow Sensor 2 (YF-S201) in L/min
    flow_1_total_liters: number; // Cumulative liters recorded by Flow 1
    flow_2_total_liters: number; // Cumulative liters recorded by Flow 2
  };
  water_quality: {
    tds_ppm: number; // Analog TDS Sensor reading in ppm
    turbidity_raw: number; // Analog Turbidity reading in NTU / raw ADC
  };
  pump: {
    status: 'RUNNING' | 'STOPPED';
  };
  device: {
    wifi_rssi: number; // Wi-Fi signal strength (e.g. -65 dBm)
    firmware_version: string; // e.g. "v1.2.4-esp32"
  };
}

/**
 * Backend Authoritative Alert
 */
export interface BackendAlert {
  id: string;
  code: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
  component: string;
  message: string;
  timestamp?: string;
}

/**
 * Authoritative Backend Assessment Response
 * Returned by POST /api/v1/sensor-data
 */
export interface BackendAssessmentResponse {
  status: 'success' | 'error' | 'warning';
  processed_at?: string;
  device_id?: string;
  assessment?: {
    water_quality?: 'SAFE' | 'CONTAMINATED' | 'WARNING';
    leak_detected?: boolean;
    leak_severity?: 'NONE' | 'MINOR' | 'CRITICAL';
    leak_flow_delta_lpm?: number;
    diversion_required?: boolean;
    valve_divert_state?: 'OPEN' | 'CLOSED';
    alerts?: BackendAlert[];
    explanation?: string;
  };
  message?: string;
  raw_message?: string;
  error?: string;
  target_url?: string;
}

/**
 * Operating Mode
 */
export type SystemOperatingMode = 'simulation' | 'hardware';

/**
 * Backend Connection Status
 */
export type BackendConnectionStatus = 'connected' | 'offline' | 'pending' | 'error';
