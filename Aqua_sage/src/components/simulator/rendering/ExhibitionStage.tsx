'use client';

import React from 'react';
import { ContactShadows } from '@react-three/drei';

interface ExhibitionStageProps {
  showMetricGrid?: boolean;
}

/**
 * Enterprise 3D Exhibition Stage & Grounding System
 * - Eliminates the "floating in void" syndrome
 * - Delivers realistic screen-space contact shadows directly underneath skid legs and pump mounts
 * - Provides technical metric radial markers, fiducial crosshairs, and glowing perimeter accents
 */
export function ExhibitionStage({ showMetricGrid = true }: ExhibitionStageProps) {
  return (
    <group name="ExhibitionStage" position={[0, 0, 0]}>
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. HIGH-PRECISION REALISTIC CONTACT SHADOWS                  */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Skid Base Contact Shadow */}
      <ContactShadows
        position={[0.35, 0.002, 0]}
        scale={[2.8, 1.8]}
        blur={2.0}
        opacity={0.88}
        far={2.5}
        resolution={1024}
        color="#020617"
      />

      {/* Filtration Unit Contact Shadow */}
      <ContactShadows
        position={[0.95, 0.002, -0.32]}
        scale={[1.2, 1.2]}
        blur={1.8}
        opacity={0.75}
        far={2.0}
        resolution={512}
        color="#020617"
      />

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. INDUSTRIAL PEDESTAL & GROUND STAGE                        */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Deep Slate Architectural Plinth Disc */}
      <mesh position={[0.35, -0.015, -0.10]} receiveShadow>
        <cylinderGeometry args={[2.5, 2.6, 0.03, 64]} />
        <meshStandardMaterial
          color="#070C16"
          roughness={0.85}
          metalness={0.25}
        />
      </mesh>

      {/* Outer Cyan Cybernetic Glow Boundary Ring */}
      <mesh position={[0.35, 0.001, -0.10]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.48, 2.52, 64]} />
        <meshBasicMaterial color="#06B6D4" transparent opacity={0.4} />
      </mesh>

      {/* Secondary Guidance Ring */}
      <mesh position={[0.35, 0.001, -0.10]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.60, 1.62, 64]} />
        <meshBasicMaterial color="#38BDF8" transparent opacity={0.2} />
      </mesh>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. TECHNICAL METRIC FLOOR CALIBRATION GRID                   */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showMetricGrid && (
        <group position={[0.35, 0.0015, -0.10]}>
          {/* Prototype Skid Direct Calibration Grid (20cm subdivision) */}
          <gridHelper
            args={[3.6, 18, '#0284C7', '#1E293B']}
            position={[0, 0, 0]}
          />

          {/* Precision Fiducial Crosshairs at Key Prototype Origin Points */}
          {[
            [0, 0], // Center
            [-0.80, 0.10], // Tank Centerline
            [-0.30, 0.10], // Pump Centerline
            [0.40, 0.10], // Leak Bay Centerline
            [0.55, -0.22], // Filtration Centerline
          ].map(([x, z], idx) => (
            <group key={`fiducial-${idx}`} position={[x, 0.002, z]}>
              {/* X-axis tick */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.08, 0.004]} />
                <meshBasicMaterial color="#38BDF8" transparent opacity={0.6} />
              </mesh>
              {/* Z-axis tick */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.004, 0.08]} />
                <meshBasicMaterial color="#38BDF8" transparent opacity={0.6} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
