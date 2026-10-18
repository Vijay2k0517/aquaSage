'use client';

import React from 'react';
import { InteractiveWrapper } from './interaction/InteractiveWrapper';

interface ValveProps {
  id: string;
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  isOpen?: boolean;
  pipeRadius?: number;
  handleColor?: string;
}

/**
 * Industrial Flanged Quarter-Turn Ball Valve Placeholder
 * - Reusable for V1 (Suction Isolation) and V2 (Delivery / Fault Valve)
 * - Distinct mechanical housing, flange rings, and safety lever with interactive selection
 */
export function Valve({
  id,
  name,
  position,
  rotation = [0, 0, 0],
  isOpen = true,
  pipeRadius = 0.025,
  handleColor = '#EAB308', // Industrial Safety Yellow
}: ValveProps) {
  const valveBodyRadius = pipeRadius * 1.55;
  const valveLength = 0.09;
  const flangeRadius = pipeRadius * 1.95;

  return (
    <InteractiveWrapper id={id} position={position} indicatorRadius={0.07}>
      <group name={`Valve-${id}-${name}`} rotation={rotation}>
        {/* Central Spherical / Cylindrical Valve Body */}
        <mesh castShadow>
          <cylinderGeometry args={[valveBodyRadius, valveBodyRadius, valveLength, 20]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Upstream Flange Ring */}
        <mesh position={[0, -valveLength / 2, 0]} castShadow>
          <cylinderGeometry args={[flangeRadius, flangeRadius, 0.012, 20]} />
          <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* Downstream Flange Ring */}
        <mesh position={[0, valveLength / 2, 0]} castShadow>
          <cylinderGeometry args={[flangeRadius, flangeRadius, 0.012, 20]} />
          <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* Valve Stem Neck (Projecting Radially Outward on X/Z axis) */}
        <group position={[valveBodyRadius + 0.015, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.014, 0.035, 12]} />
            <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.25} />
          </mesh>

          {/* Stem Packing Nut */}
          <mesh position={[0, 0.018, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.01, 6]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.2} />
          </mesh>

          {/* Quarter-Turn Lever Handle (Rotates 90 deg when closed) */}
          <group position={[0, 0.024, 0]} rotation={[0, isOpen ? 0 : Math.PI / 2, 0]}>
            {/* Handle Boss */}
            <mesh>
              <cylinderGeometry args={[0.015, 0.015, 0.008, 16]} />
              <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Lever Arm (Extends along pipe when open) */}
            <mesh position={[0, 0, 0.055]}>
              <boxGeometry args={[0.016, 0.006, 0.11]} />
              <meshStandardMaterial color={handleColor} metalness={0.4} roughness={0.4} />
            </mesh>
            {/* Ergonomic Vinyl Handle Grip */}
            <mesh position={[0, 0, 0.09]}>
              <boxGeometry args={[0.02, 0.01, 0.045]} />
              <meshStandardMaterial color="#CA8A04" roughness={0.6} />
            </mesh>
          </group>
        </group>
      </group>
    </InteractiveWrapper>
  );
}
