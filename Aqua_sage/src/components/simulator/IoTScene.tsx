'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { SkidFrame } from './SkidFrame';
import { WaterTank } from './WaterTank';
import { PumpAssembly } from './PumpAssembly';
import { PipeNetwork } from './PipeNetwork';
import { ControllerEnclosure } from './ControllerEnclosure';
import { SensorPlaceholder } from './SensorPlaceholder';
import { FiltrationFacility } from './FiltrationFacility';
import { LeakVisualizer } from './LeakVisualizer';
import { WaterFlowParticles } from './WaterFlowParticles';
import { CameraControls } from './CameraControls';
import { StudioLighting, LightingMode } from './rendering/StudioLighting';
import { ExhibitionStage } from './rendering/ExhibitionStage';
import { PostProcessingPipeline } from './rendering/PostProcessingPipeline';
import { GlobalCameraPreset } from '@/lib/simulator/types';
import { useSelection } from './interaction/SelectionProvider';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import type { DiagnosticMode } from './PipeNetwork';

interface IoTSceneProps {
  activePreset: GlobalCameraPreset;
  resetTrigger: number;
  lightingMode?: LightingMode;
  enablePostProcessing?: boolean;
  enableBloom?: boolean;
  enableAO?: boolean;
  diagnosticMode?: DiagnosticMode;
  tourTarget?: { position: [number, number, number]; target: [number, number, number] } | null;
  autoRotate?: boolean;
}

/**
 * Enterprise Three.js 3D Viewport Scene
 * - Houses the complete 1:1 metric AquaSage hydraulic prototype
 * - Real hardware transducers: HC-SR04, Flow 1 (YF-S201), TDS, Turbidity, Flow 2 (YF-S201)
 * - Interactive selectable pipe leak bay and contamination injection point
 * - Compact simulated filtration assembly with automated diversion
 */
export default function IoTScene({
  activePreset,
  resetTrigger,
  lightingMode = 'studio',
  enablePostProcessing = true,
  enableBloom = true,
  enableAO = true,
  diagnosticMode = 'pbr',
  tourTarget = null,
  autoRotate = false,
}: IoTSceneProps) {
  const { clearSelection } = useSelection();
  const { state } = useSimulation();

  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        shadows
        camera={{ position: [2.2, 1.8, 2.2], fov: 42 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        className="w-full h-full bg-[#070B14]"
        onPointerMissed={() => clearSelection()}
      >
        {/* Deep Slate Industrial Scene Background */}
        <color attach="background" args={['#070B14']} />

        {/* 1. ENTERPRISE STUDIO LIGHTING RIG & IBL REFLECTIONS */}
        <StudioLighting mode={lightingMode} />

        {/* 2. GROUND EXHIBITION STAGE & CONTACT SHADOWS */}
        <ExhibitionStage showMetricGrid={true} />

        {/* 3. PHYSICAL 1:1 METRIC SKID ASSEMBLY */}
        <group position={[0, 0, 0]}>
          {/* Structural Steel Frame */}
          <SkidFrame />

          {/* Water Storage Tank with Dynamic Simulated Water Height */}
          <WaterTank waterHeight={state.tankWaterHeight} />

          {/* Centrifugal Pump & Electric Motor */}
          <PumpAssembly />

          {/* Complete Hydraulic Pipework & Sensor Bay (with Multi-Spectral Diagnostic Materials) */}
          <PipeNetwork diagnosticMode={diagnosticMode} />

          {/* Ultrasonic Level Sensor (Crown Standoff Mount at Y = 1.60m) */}
          <SensorPlaceholder
            id="sensor-us01"
            name="Level US-01"
            sensorType="ultrasonic"
            readinessTier="confirmed_hardware"
            unit="cm"
            baselineValue="75.0"
            position={[-0.45, 1.60, 0]}
            labelOffset={[0, 0.12, 0]}
          />

          {/* ESP32 IP65 Controller Enclosure */}
          <ControllerEnclosure />
        </group>

        {/* 4. COMPACT PROTOTYPE FILTRATION ASSEMBLY */}
        <FiltrationFacility />

        {/* 5. DYNAMIC PIPE LEAK VISUALIZER */}
        <LeakVisualizer />

        {/* 6. DETERMINISTIC INSTANCED WATER FLOW PARTICLES */}
        <WaterFlowParticles />

        {/* 8. INTERACTIVE CAMERA CONTROLS WITH GUIDED TOUR & TURNTABLE EASING */}
        <CameraControls
          activePreset={activePreset}
          resetTrigger={resetTrigger}
          tourTarget={tourTarget}
          autoRotate={autoRotate}
        />

        {/* 9. CINEMATIC POST-PROCESSING PIPELINE (N8AO + Bloom + Vignette + ToneMapping) */}
        <PostProcessingPipeline
          enabled={enablePostProcessing}
          enableBloom={enableBloom}
          enableAO={enableAO}
          enableVignette={true}
          aoQuality="medium"
        />
      </Canvas>
    </div>
  );
}
