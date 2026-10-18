/**
 * AquaSage 3D IoT Digital Twin - Simulation Event & Audit Logger
 *
 * Centralized deterministic audit trail recording all physical, control,
 * sensor threshold, and automated state machine events.
 */

export type EventCategory =
  | 'SCENARIO'
  | 'LEAK'
  | 'QUALITY'
  | 'DIVERSION'
  | 'FILTRATION'
  | 'VALVE'
  | 'ALARM'
  | 'RECOVERY';

export type EventSeverity = 'info' | 'warning' | 'critical' | 'success';

export interface SimulationEvent {
  id: string;
  step: number;
  timestampSec: number;
  formattedTime: string; // e.g. "T+00:14"
  category: EventCategory;
  severity: EventSeverity;
  componentId: string;
  componentName?: string;
  zoneId?: string;
  source: 'simulated_controller' | 'simulated_sensor' | 'injected_scenario';
  description: string;
}

export function formatSimulationTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `T+${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function createSimulationEvent(
  step: number,
  timestampSec: number,
  category: EventCategory,
  severity: EventSeverity,
  componentId: string,
  description: string,
  source: 'simulated_controller' | 'simulated_sensor' | 'injected_scenario' = 'simulated_controller',
  zoneId?: string
): SimulationEvent {
  return {
    id: `evt-${step}-${category}-${componentId}-${Math.round(timestampSec * 10)}`,
    step,
    timestampSec,
    formattedTime: formatSimulationTime(timestampSec),
    category,
    severity,
    componentId,
    zoneId,
    source,
    description,
  };
}
