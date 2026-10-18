/**
 * AquaSage 3D IoT Digital Twin - System Types
 * Unified contract for component registration, selection, and hardware readiness
 */

export type ComponentCategory =
  | 'tank'
  | 'pump'
  | 'valve'
  | 'sensor'
  | 'controller'
  | 'pipeline'
  | 'filter';

export type ReadinessTier =
  | 'confirmed_hardware' // Target physical component wired to ESP32
  | 'planned_hardware'   // Defined in architecture; awaiting interface conditioning
  | 'virtual_only';       // Inferred/simulated mathematically in software

export type TelemetryUnit = 'L/min' | 'cm' | 'bar' | 'ppm' | 'NTU' | 'A' | 'RPM' | '%' | 'L';

export interface ComponentCameraPreset {
  position: [number, number, number];
  target: [number, number, number];
}

export interface TwinComponentDefinition {
  id: string;
  name: string;
  shortName: string;
  category: ComponentCategory;
  readiness: ReadinessTier;
  description: string;
  position: [number, number, number];
  camera: ComponentCameraPreset;
  parameter?: string;
  unit?: TelemetryUnit;
  demoValue?: string;
  demoRange?: string;
  installation: string;
  metadata?: Record<string, string>;
  observationNote?: string;
}

export type GlobalCameraPreset =
  | 'isometric'
  | 'front'
  | 'tank'
  | 'flow1'
  | 'quality'
  | 'leak'
  | 'filtration'
  | 'flow2'
  | 'enclosure';

export interface GlobalCameraPresetConfig {
  id: GlobalCameraPreset;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}
