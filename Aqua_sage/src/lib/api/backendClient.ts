/**
 * AquaSage Frontend Backend Client
 *
 * Handles HTTP telemetry dispatch to POST /api/v1/sensor-data
 * Tracks backend connection health, latency, authoritative assessments, and alerts.
 */

import {
  HardwareTelemetryPayload,
  BackendAssessmentResponse,
} from '@/lib/simulator/hardwareContract';
import { SimulationState } from '@/lib/simulator/telemetryTypes';

export const DEFAULT_ENDPOINT = '/api/v1/sensor-data';

/**
 * Builds the exact physical hardware payload from current digital twin state
 */
export function buildHardwarePayloadFromSimulation(
  state: SimulationState
): HardwareTelemetryPayload {
  // HC-SR04: Standoff distance = 1.0m (100cm)
  const tankWaterHeight = Math.max(0, Math.min(1.0, state.tankWaterHeight));
  const waterLevelPercent = Number(((tankWaterHeight / 1.0) * 100).toFixed(1));
  const distanceCm = Number((Math.max(5.0, (1.0 - tankWaterHeight) * 100)).toFixed(1));

  // Upstream Flow 1 vs Downstream Flow 2
  // When a leak is active, Flow 1 measures full delivery (e.g. 18 L/min),
  // and Flow 2 measures delivered flow (e.g. 18 - leakSeverity = 12.5 L/min)
  const flow1Lpm = Number(state.inflowRateLpm.toFixed(1));
  const leakLpm = Number((state.leakSeverityLpm || 0).toFixed(1));
  const flow2Lpm = Number(Math.max(0, flow1Lpm - leakLpm).toFixed(1));

  // Cumulative total liters approximated from elapsed time
  const totalLiters1 = Number(((flow1Lpm / 60) * state.elapsedTimeSec + 45.2).toFixed(1));
  const totalLiters2 = Number(((flow2Lpm / 60) * state.elapsedTimeSec + 45.2).toFixed(1));

  // Pre-treatment TDS and Turbidity
  const tdsPpm = Math.round(state.preTreatmentTds || 180);
  const turbidityRaw = Number((state.preTreatmentTurbidity || 1.5).toFixed(1));

  // Pump status
  const pumpStatus: 'RUNNING' | 'STOPPED' =
    state.isRunning && (state.readings['pump']?.value ?? 0) > 0.2 ? 'RUNNING' : 'STOPPED';

  return {
    device_id: 'ESP32-AQUASAGE-01',
    tank_id: 'TANK-MAIN-01',
    tank: {
      distance_cm: distanceCm,
      water_level_percent: waterLevelPercent,
    },
    flow: {
      flow_1_lpm: flow1Lpm,
      flow_2_lpm: flow2Lpm,
      flow_1_total_liters: totalLiters1,
      flow_2_total_liters: totalLiters2,
    },
    water_quality: {
      tds_ppm: tdsPpm,
      turbidity_raw: turbidityRaw,
    },
    pump: {
      status: pumpStatus,
    },
    device: {
      wifi_rssi: -64,
      firmware_version: 'v1.2.4-esp32',
    },
  };
}

/**
 * Transmits sensor telemetry to POST /api/v1/sensor-data
 */
export async function sendSensorTelemetry(
  payload: HardwareTelemetryPayload,
  endpoint: string = DEFAULT_ENDPOINT
): Promise<{
  ok: boolean;
  status: number;
  data: BackendAssessmentResponse;
  latencyMs: number;
}> {
  const startTime = performance.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const latencyMs = Math.round(performance.now() - startTime);
    const data: BackendAssessmentResponse = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data,
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const message = err instanceof Error ? err.message : 'Unknown network failure';

    return {
      ok: false,
      status: 0,
      data: {
        status: 'error',
        error: 'NETWORK_FAILURE',
        message: `Failed to connect to backend endpoint at ${endpoint}: ${message}`,
      },
      latencyMs,
    };
  }
}

/**
 * Polls latest hardware reading from physical prototype (Hardware Mode)
 */
export async function fetchLatestHardwareTelemetry(
  endpoint: string = DEFAULT_ENDPOINT
): Promise<{
  ok: boolean;
  data?: Partial<HardwareTelemetryPayload>;
  error?: string;
}> {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}
