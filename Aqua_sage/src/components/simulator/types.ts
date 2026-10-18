/**
 * Re-exporting unified simulator types from lib
 */
export * from '@/lib/simulator/types';

// Backward compatibility alias for GlobalCameraPreset
export type CameraPreset = import('@/lib/simulator/types').GlobalCameraPreset;
export type CameraPresetConfig = import('@/lib/simulator/types').GlobalCameraPresetConfig;
