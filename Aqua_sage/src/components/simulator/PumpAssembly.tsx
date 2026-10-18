'use client';

import React from 'react';
import { InteractiveWrapper } from './interaction/InteractiveWrapper';

/**
 * Centrifugal Pump and Industrial Electric Motor Assembly
 * - Positioned on lower deck at X = 0.15m, Y = 0.12m
 * - Electric Motor: Three-phase industrial motor with cooling fins and terminal box
 * - Pump Volute: Centrifugal volute casing with axial suction and top discharge
 */
export function PumpAssembly() {
  const motorBlue = '#1D4ED8';
  const pumpSteel = '#334155';
  const chromeSilver = '#94A3B8';

  return (
    <group name="CentrifugalPumpAssembly" position={[0.15, 0.12, 0]}>
      {/* Vibration Damping Base Skid Plate */}
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.52, 0.03, 0.26]} />
        <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* 4 Vibration Isolation Bushings */}
      {[-0.22, 0.22].map((x) =>
        [-0.1, 0.1].map((z) => (
          <mesh key={`bushing-${x}-${z}`} position={[x, 0.035, z]}>
            <cylinderGeometry args={[0.02, 0.02, 0.015, 12]} />
            <meshStandardMaterial color="#020617" roughness={0.9} />
          </mesh>
        ))
      )}

      {/* ELECTRIC MOTOR ASSEMBLY (Mounted on Right side, X in [0.05, 0.35]) */}
      <InteractiveWrapper id="motor" position={[0.14, 0.15, 0]} indicatorRadius={0.14}>
        <group name="ElectricMotor">
          {/* Motor Main Cylindrical Stator Frame */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.24, 24]} />
            <meshStandardMaterial color={motorBlue} metalness={0.6} roughness={0.35} />
          </mesh>

          {/* Motor Cooling Fin Rings (5 concentric ribs) */}
          {[-0.08, -0.04, 0.0, 0.04, 0.08].map((xOffset, idx) => (
            <mesh key={`fin-${idx}`} position={[xOffset, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.102, 0.102, 0.008, 24]} />
              <meshStandardMaterial color="#1E3A8A" metalness={0.7} roughness={0.4} />
            </mesh>
          ))}

          {/* Motor Rear Cooling Fan Cowl & End Bell */}
          <mesh position={[0.13, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.088, 0.075, 0.04, 20]} />
            <meshStandardMaterial color="#172554" metalness={0.5} roughness={0.5} />
          </mesh>

          {/* Terminal / Junction Box on Top of Motor */}
          <mesh position={[0, 0.11, 0]} castShadow>
            <boxGeometry args={[0.09, 0.05, 0.07]} />
            <meshStandardMaterial color={motorBlue} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.138, 0]}>
            <boxGeometry args={[0.095, 0.008, 0.075]} />
            <meshStandardMaterial color="#2563EB" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Cable Gland on Terminal Box */}
          <mesh position={[0.03, 0.11, 0.042]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.02, 12]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      </InteractiveWrapper>

      {/* COUPLING HOUSING / BEARING BRACKET (Between Motor and Pump Volute) */}
      <mesh position={[-0.01, 0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.065, 0.075, 0.06, 20]} />
        <meshStandardMaterial color={pumpSteel} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* CENTRIFUGAL PUMP VOLUTE CASING (Spiral Volute Housing) */}
      <InteractiveWrapper id="pump" position={[-0.10, 0.15, 0]} indicatorRadius={0.15}>
        <group name="CentrifugalPump">
          {/* Main Volute Body */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.11, 0.09, 0.10, 24]} />
            <meshStandardMaterial color={pumpSteel} metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Front Volute Face Plate with Perimeter Bolts */}
          <mesh position={[-0.052, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.115, 0.115, 0.012, 24]} />
            <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
          </mesh>

          {/* Axial Suction Port & Flange (Facing Left toward tank) */}
          <group position={[-0.06, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.032, 0.032, 0.04, 16]} />
              <meshStandardMaterial color={chromeSilver} metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[-0.022, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.052, 0.052, 0.012, 16]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>

          {/* Tangential Vertical Discharge Spout & Flange */}
          <group position={[0.02, 0.12, 0]}>
            <mesh>
              <cylinderGeometry args={[0.028, 0.028, 0.06, 16]} />
              <meshStandardMaterial color={chromeSilver} metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.032, 0]}>
              <cylinderGeometry args={[0.048, 0.048, 0.012, 16]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        </group>
      </InteractiveWrapper>
    </group>
  );
}
