'use client';

import React from 'react';
import { Valve } from './Valve';
import { SensorPlaceholder } from './SensorPlaceholder';
import { InteractiveWrapper } from './interaction/InteractiveWrapper';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import { useSelection } from './interaction/SelectionProvider';
import { Billboard, Text } from '@react-three/drei';

export type DiagnosticMode = 'pbr' | 'pressure' | 'xray';

interface PipeNetworkProps {
  diagnosticMode?: DiagnosticMode;
}

/**
 * AquaSage Physical Prototype Pipeline Network
 *
 * Models the exact hydraulic flow loop of the physical prototype:
 * 1. Suction Line: Tank Base -> Valve V1 -> Pump Inlet
 * 2. Inlet Line: Pump Discharge Riser -> Flow Sensor 1 (YF-S201)
 * 3. Water-Quality Sensing Bay: Analog TDS Sensor & Analog Turbidity Sensor
 * 4. Pipeline Leak Bay: Dedicated selectable pipeline section for physical leak defect injection
 * 5. Diversion Tee: Branch to Compact Filtration Assembly controlled by valve V-DIV
 * 6. Outlet Line: Flow Sensor 2 (YF-S201)
 * 7. Recirculation Return: Overhead Return Line back into Reservoir
 */
export function PipeNetwork({ diagnosticMode = 'pbr' }: PipeNetworkProps) {
  const pipeRadius = 0.024; // 2-inch nominal pipe (~48mm outer diameter)
  const bypassRadius = 0.015; // 1-inch analytical bypass pipe

  const { state, injectLeak, clearLeak } = useSimulation();
  const { selectedComponentId, selectComponent } = useSelection();

  const isLeaking = (state.leakSeverityLpm || 0) > 0.1;
  const isPressure = diagnosticMode === 'pressure';
  const isXRay = diagnosticMode === 'xray';

  // Multi-spectral materials
  const suctionPipeProps = {
    color: isPressure ? '#0284C7' : isXRay ? '#0F172A' : '#64748B',
    metalness: isXRay ? 0.2 : 0.7,
    roughness: isXRay ? 0.1 : 0.35,
    transparent: isXRay,
    opacity: isXRay ? 0.45 : 1.0,
  };

  const dischargePipeProps = {
    color: isPressure ? '#059669' : isXRay ? '#0E7490' : '#475569',
    metalness: isXRay ? 0.3 : 0.75,
    roughness: isXRay ? 0.1 : 0.3,
    transparent: isXRay,
    opacity: isXRay ? 0.5 : 1.0,
  };

  const leakSectionPipeProps = {
    color: isLeaking
      ? '#EF4444'
      : isPressure
      ? '#D97706'
      : isXRay
      ? '#0E7490'
      : '#475569',
    metalness: 0.7,
    roughness: 0.3,
    emissive: isLeaking ? '#EF4444' : '#000000',
    emissiveIntensity: isLeaking ? 0.35 : 0,
  };

  const returnPipeProps = {
    color: isPressure ? '#0EA5E9' : isXRay ? '#0369A1' : '#64748B',
    metalness: isXRay ? 0.2 : 0.7,
    roughness: isXRay ? 0.1 : 0.35,
    transparent: isXRay,
    opacity: isXRay ? 0.45 : 1.0,
  };

  const bypassMaterialProps = {
    color: isPressure ? '#10B981' : isXRay ? '#06B6D4' : '#0284C7',
    metalness: isXRay ? 0.1 : 0.6,
    roughness: isXRay ? 0.1 : 0.2,
    transparent: isXRay,
    opacity: isXRay ? 0.6 : 1.0,
  };

  const flangeMaterialProps = {
    color: isXRay ? '#1E293B' : '#334155',
    metalness: isXRay ? 0.3 : 0.8,
    roughness: 0.3,
    transparent: isXRay,
    opacity: isXRay ? 0.5 : 1.0,
  };

  return (
    <group name="PipeNetwork">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. UPSTREAM SUCTION LINE (Tank Base -> Valve V1 -> Pump Inlet) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Drop from Tank Bottom Spigot (X = -0.45, Y from 0.35 down to 0.25) */}
      <mesh position={[-0.45, 0.29, 0]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.12, 16]} />
        <meshStandardMaterial {...suctionPipeProps} />
      </mesh>
      {/* Elbow Joint at [-0.45, 0.25, 0] */}
      <mesh position={[-0.45, 0.25, 0]}>
        <sphereGeometry args={[pipeRadius * 1.25, 16, 16]} />
        <meshStandardMaterial {...flangeMaterialProps} />
      </mesh>
      {/* Horizontal Run to Valve V1 (X from -0.45 to -0.22) */}
      <mesh position={[-0.33, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.22, 16]} />
        <meshStandardMaterial {...suctionPipeProps} />
      </mesh>

      {/* ISOLATION VALVE V1 (Suction Line) */}
      <Valve
        id="valve-v1"
        name="V1 [Suction]"
        position={[-0.20, 0.25, 0]}
        rotation={[0, 0, Math.PI / 2]}
        isOpen={true}
        pipeRadius={pipeRadius}
        handleColor="#EAB308"
      />

      {/* Horizontal Run from V1 to Pump Suction (X from -0.18 to 0.05) */}
      <mesh position={[-0.065, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.23, 16]} />
        <meshStandardMaterial {...suctionPipeProps} />
      </mesh>
      {/* Pump Suction Flange Connection */}
      <mesh position={[0.045, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius * 1.8, pipeRadius * 1.8, 0.015, 16]} />
        <meshStandardMaterial {...flangeMaterialProps} />
      </mesh>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. MIDSTREAM DISCHARGE RISER -> FLOW SENSOR 1 (YF-S201 INLET) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Vertical Riser from Pump Discharge (X = 0.07, Y from 0.28 up to 0.65) */}
      <mesh position={[0.07, 0.465, 0]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.37, 16]} />
        <meshStandardMaterial {...dischargePipeProps} />
      </mesh>
      {/* Elbow Joint at [0.07, 0.65, 0] */}
      <mesh position={[0.07, 0.65, 0]}>
        <sphereGeometry args={[pipeRadius * 1.25, 16, 16]} />
        <meshStandardMaterial {...flangeMaterialProps} />
      </mesh>

      {/* Horizontal Run from Riser to Flow Sensor 1 (X from 0.07 to 0.24) */}
      <mesh position={[0.155, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.17, 16]} />
        <meshStandardMaterial {...dischargePipeProps} />
      </mesh>

      {/* FLOW SENSOR 1: YF-S201 In-Line Hall-Effect Turbine at X = 0.26 */}
      <SensorPlaceholder
        id="sensor-fs01"
        name="Flow 1 [Inlet YF-S201]"
        sensorType="flow"
        readinessTier="confirmed_hardware"
        unit="L/min"
        baselineValue="18.0"
        position={[0.26, 0.65, 0]}
        rotation={[0, 0, Math.PI / 2]}
        labelOffset={[0, 0.14, 0]}
      />

      {/* Pipe Run from Flow Sensor 1 to Water-Quality Sensing Bay (X from 0.28 to 0.42) */}
      <mesh position={[0.35, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.14, 16]} />
        <meshStandardMaterial {...dischargePipeProps} />
      </mesh>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. WATER-QUALITY SENSING BAY: ANALOG TDS & TURBIDITY PROBES   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <InteractiveWrapper id="pipe-bypass" position={[0.54, 0.56, 0]} indicatorRadius={0.16}>
        <group>
          {/* Bypass Split T-Junction at [0.42, 0.65, 0] */}
          <mesh position={[-0.12, 0.09, 0]}>
            <sphereGeometry args={[pipeRadius * 1.2, 16, 16]} />
            <meshStandardMaterial {...flangeMaterialProps} />
          </mesh>
          {/* Bypass Drop Tube */}
          <mesh position={[-0.12, 0.005, 0]} castShadow>
            <cylinderGeometry args={[bypassRadius, bypassRadius, 0.17, 16]} />
            <meshStandardMaterial {...bypassMaterialProps} />
          </mesh>
          {/* Bypass Lower Left Elbow */}
          <mesh position={[-0.12, -0.08, 0]}>
            <sphereGeometry args={[bypassRadius * 1.25, 16, 16]} />
            <meshStandardMaterial {...flangeMaterialProps} />
          </mesh>

          {/* Bypass Horizontal Analytical Section (Y = 0.48) */}
          <mesh position={[0, -0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[bypassRadius, bypassRadius, 0.24, 16]} />
            <meshStandardMaterial {...bypassMaterialProps} />
          </mesh>

          {/* Bypass Lower Right Elbow */}
          <mesh position={[0.12, -0.08, 0]}>
            <sphereGeometry args={[bypassRadius * 1.25, 16, 16]} />
            <meshStandardMaterial {...flangeMaterialProps} />
          </mesh>
          {/* Bypass Return Riser */}
          <mesh position={[0.12, 0.005, 0]} castShadow>
            <cylinderGeometry args={[bypassRadius, bypassRadius, 0.17, 16]} />
            <meshStandardMaterial {...bypassMaterialProps} />
          </mesh>
          {/* Bypass Rejoin T-Junction at [0.66, 0.65, 0] */}
          <mesh position={[0.12, 0.09, 0]}>
            <sphereGeometry args={[pipeRadius * 1.2, 16, 16]} />
            <meshStandardMaterial {...flangeMaterialProps} />
          </mesh>
        </group>
      </InteractiveWrapper>

      {/* Main Pipe Section bridging across bypass (X from 0.42 to 0.66, Y = 0.65) */}
      <mesh position={[0.54, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.24, 16]} />
        <meshStandardMaterial {...dischargePipeProps} />
      </mesh>

      {/* ANALOG TDS PROBE at X = 0.48 */}
      <mesh position={[0.48, 0.48, 0]}>
        <cylinderGeometry args={[bypassRadius * 1.4, bypassRadius * 1.4, 0.04, 16]} />
        <meshStandardMaterial {...flangeMaterialProps} />
      </mesh>
      <SensorPlaceholder
        id="sensor-tds01"
        name="Analog TDS Probe"
        sensorType="tds"
        readinessTier="confirmed_hardware"
        unit="ppm"
        baselineValue="180"
        position={[0.48, 0.50, 0]}
        labelOffset={[0, 0.10, 0]}
      />

      {/* ANALOG TURBIDITY SENSOR at X = 0.60 */}
      <SensorPlaceholder
        id="sensor-turb01"
        name="Analog Turbidity Sensor"
        sensorType="turbidity"
        readinessTier="confirmed_hardware"
        unit="NTU"
        baselineValue="1.5"
        position={[0.60, 0.48, 0]}
        labelOffset={[0, 0.10, 0]}
      />

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. SELECTABLE PIPELINE LEAK SECTION (Interactive Defect Point) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <InteractiveWrapper id="pipe-leak-bay" position={[0.76, 0.65, 0]} indicatorRadius={0.12}>
        <group>
          {/* Main pipe segment where leak occurs */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[pipeRadius, pipeRadius, 0.20, 16]} />
            <meshStandardMaterial {...leakSectionPipeProps} />
          </mesh>

          {/* Invisible enlarged pick target for responsive click detection */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[pipeRadius * 3, pipeRadius * 3, 0.22, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Interactive Collar / Targeting Ring */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[pipeRadius * 1.25, pipeRadius * 1.25, 0.04, 16]} />
            <meshStandardMaterial
              color={isLeaking ? '#EF4444' : selectedComponentId === 'pipe-leak-bay' ? '#38BDF8' : '#64748B'}
              metalness={0.8}
              roughness={0.2}
              emissive={isLeaking ? '#EF4444' : '#000000'}
              emissiveIntensity={isLeaking ? 0.5 : 0}
            />
          </mesh>

          {/* 3D WebGL Billboard HUD Tag (Zero DOM createRoot) */}
          {selectedComponentId !== 'pipe-leak-bay' && (
            <Billboard position={[0, 0.08, 0]} follow={true}>
              <group
                onClick={(e) => {
                  e.stopPropagation();
                  selectComponent('pipe-leak-bay');
                  if (isLeaking) {
                    clearLeak();
                  } else {
                    injectLeak(5.5, 0.5);
                  }
                }}
              >
                <mesh position={[0, 0, 0]}>
                  <planeGeometry args={[isLeaking ? 0.22 : 0.16, 0.038]} />
                  <meshBasicMaterial
                    color={isLeaking ? '#991B1B' : '#0F172A'}
                    transparent
                    opacity={0.92}
                  />
                </mesh>
                <mesh position={[isLeaking ? -0.095 : -0.065, 0, 0.002]}>
                  <circleGeometry args={[0.005, 16]} />
                  <meshBasicMaterial color={isLeaking ? '#EF4444' : '#38BDF8'} />
                </mesh>
                <Text
                  position={[0.01, 0, 0.003]}
                  fontSize={0.016}
                  color="#FFFFFF"
                  anchorX="center"
                  anchorY="middle"
                >
                  {isLeaking
                    ? `LEAK: ${state.leakSeverityLpm?.toFixed(1)} L/m`
                    : 'LEAK BAY (Click to Test)'}
                </Text>
              </group>
            </Billboard>
          )}
        </group>
      </InteractiveWrapper>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 5. DIVERSION TEE & AUTOMATED VALVE V-DIV (To Filtration)      */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Tee Junction at [0.86, 0.65, 0] */}
      <mesh position={[0.86, 0.65, 0]}>
        <sphereGeometry args={[pipeRadius * 1.25, 16, 16]} />
        <meshStandardMaterial {...flangeMaterialProps} />
      </mesh>

      {/* Alternate Diversion Drop Pipe toward Filtration Unit (Y down to 0.40, Z to -0.25) */}
      <mesh position={[0.86, 0.525, -0.125]} rotation={[Math.PI / 4, 0, 0]} castShadow>
        <cylinderGeometry args={[bypassRadius, bypassRadius, 0.35, 16]} />
        <meshStandardMaterial
          color={state.filtrationState !== 'IDLE' ? '#06B6D4' : '#475569'}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Automated Diversion Valve V-DIV */}
      <Valve
        id="valve-v-div"
        name="V-DIV [Diversion]"
        position={[0.86, 0.65, -0.05]}
        rotation={[Math.PI / 2, 0, 0]}
        isOpen={state.network.valves['valve-v-div']?.actualState === 'OPEN'}
        pipeRadius={bypassRadius}
        handleColor="#EF4444"
      />

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 6. OUTLET PIPELINE -> FLOW SENSOR 2 (YF-S201 OUTLET)         */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Pipe connecting Diversion Tee to Flow Sensor 2 (X from 0.86 to 0.98) */}
      <mesh position={[0.92, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.12, 16]} />
        <meshStandardMaterial {...dischargePipeProps} />
      </mesh>

      {/* FLOW SENSOR 2: YF-S201 Outlet Meter at X = 0.98 */}
      <SensorPlaceholder
        id="sensor-fs02"
        name="Flow 2 [Outlet YF-S201]"
        sensorType="flow"
        readinessTier="confirmed_hardware"
        unit="L/min"
        baselineValue="18.0"
        position={[0.98, 0.65, 0]}
        rotation={[0, 0, Math.PI / 2]}
        labelOffset={[0, 0.14, 0]}
      />

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 7. RETURN RISER & OVERHEAD RECIRCULATION TO TANK             */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Pipe from FS-02 to Delivery Valve V2 */}
      <mesh position={[1.04, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.12, 16]} />
        <meshStandardMaterial {...dischargePipeProps} />
      </mesh>

      {/* Delivery Valve V2 */}
      <Valve
        id="valve-v2"
        name="V2 [Delivery]"
        position={[1.10, 0.65, 0]}
        rotation={[0, 0, Math.PI / 2]}
        isOpen={true}
        pipeRadius={pipeRadius}
        handleColor="#10B981"
      />

      {/* Right Corner Elbow at [1.16, 0.65, 0] */}
      <mesh position={[1.16, 0.65, 0]}>
        <sphereGeometry args={[pipeRadius * 1.25, 16, 16]} />
        <meshStandardMaterial {...flangeMaterialProps} />
      </mesh>

      {/* Vertical Return Riser along Right Frame (Y from 0.65 up to 1.45 at X = 1.16) */}
      <mesh position={[1.16, 1.05, 0]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.80, 16]} />
        <meshStandardMaterial {...returnPipeProps} />
      </mesh>

      {/* Top-Right Overhead Elbow at [1.16, 1.45, 0] */}
      <mesh position={[1.16, 1.45, 0]}>
        <sphereGeometry args={[pipeRadius * 1.25, 16, 16]} />
        <meshStandardMaterial {...flangeMaterialProps} />
      </mesh>

      {/* Overhead Recirculation Pipe (Y = 1.45, X from 1.16 leftward to -0.30) */}
      <mesh position={[0.43, 1.45, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 1.46, 16]} />
        <meshStandardMaterial {...returnPipeProps} />
      </mesh>

      {/* Overhead Elbow into Tank at [-0.30, 1.45, 0] */}
      <mesh position={[-0.30, 1.45, 0]}>
        <sphereGeometry args={[pipeRadius * 1.25, 16, 16]} />
        <meshStandardMaterial {...flangeMaterialProps} />
      </mesh>

      {/* Tank Inflow Spigot */}
      <mesh position={[-0.35, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.10, 16]} />
        <meshStandardMaterial {...flangeMaterialProps} />
      </mesh>
    </group>
  );
}
