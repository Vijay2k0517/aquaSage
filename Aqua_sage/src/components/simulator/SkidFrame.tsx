'use client';

import React from 'react';
import { RoundedBox } from '@react-three/drei';

/**
 * Enterprise Industrial Structural Skid Frame
 * - Dimensions: 1.8m width (X) x 1.6m height (Y) x 0.8m depth (Z)
 * - Material: Dark extruded structural steel (T-slot extrusion style with CNC edge bevels)
 * - Upgraded with RoundedBox bevels to catch specular lightformers and eliminate raw polygonal edges
 */
export function SkidFrame() {
  const beamThickness = 0.045; // 45mm extruded profile
  const width = 1.8;
  const height = 1.6;
  const depth = 0.8;

  const halfW = width / 2;
  const halfD = depth / 2;
  const halfH = height / 2;

  // Material properties for structural steel
  const steelMaterialProps = {
    color: '#334155',
    metalness: 0.85,
    roughness: 0.28,
  };

  const footplateMaterialProps = {
    color: '#1E293B',
    metalness: 0.9,
    roughness: 0.22,
  };

  return (
    <group name="SkidFrame">
      {/* 4 Vertical Corner Columns with CNC Fillet Chamfers */}
      <RoundedBox
        args={[beamThickness, height, beamThickness]}
        radius={0.0035}
        smoothness={4}
        position={[-halfW + beamThickness / 2, halfH, -halfD + beamThickness / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>
      <RoundedBox
        args={[beamThickness, height, beamThickness]}
        radius={0.0035}
        smoothness={4}
        position={[halfW - beamThickness / 2, halfH, -halfD + beamThickness / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>
      <RoundedBox
        args={[beamThickness, height, beamThickness]}
        radius={0.0035}
        smoothness={4}
        position={[-halfW + beamThickness / 2, halfH, halfD - beamThickness / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>
      <RoundedBox
        args={[beamThickness, height, beamThickness]}
        radius={0.0035}
        smoothness={4}
        position={[halfW - beamThickness / 2, halfH, halfD - beamThickness / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>

      {/* 4 Corner Footplates with leveling screws */}
      {[-halfW + beamThickness / 2, halfW - beamThickness / 2].map((x, i) =>
        [-halfD + beamThickness / 2, halfD - beamThickness / 2].map((z, j) => (
          <group key={`foot-${i}-${j}`} position={[x, 0.015, z]}>
            <RoundedBox
              args={[0.09, 0.02, 0.09]}
              radius={0.003}
              smoothness={4}
              receiveShadow
            >
              <meshStandardMaterial {...footplateMaterialProps} />
            </RoundedBox>
            <mesh position={[0, 0.02, 0]} castShadow>
              <cylinderGeometry args={[0.015, 0.015, 0.03, 16]} />
              <meshStandardMaterial color="#94A3B8" metalness={0.95} roughness={0.15} />
            </mesh>
          </group>
        ))
      )}

      {/* Lower Perimeter Beams (Bottom Shelf at Y = beamThickness / 2) */}
      {/* Front & Back */}
      <RoundedBox
        args={[width, beamThickness, beamThickness]}
        radius={0.003}
        smoothness={4}
        position={[0, beamThickness / 2 + 0.02, halfD - beamThickness / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>
      <RoundedBox
        args={[width, beamThickness, beamThickness]}
        radius={0.003}
        smoothness={4}
        position={[0, beamThickness / 2 + 0.02, -halfD + beamThickness / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>
      {/* Left & Right */}
      <RoundedBox
        args={[beamThickness, beamThickness, depth - beamThickness * 2]}
        radius={0.003}
        smoothness={4}
        position={[-halfW + beamThickness / 2, beamThickness / 2 + 0.02, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>
      <RoundedBox
        args={[beamThickness, beamThickness, depth - beamThickness * 2]}
        radius={0.003}
        smoothness={4}
        position={[halfW - beamThickness / 2, beamThickness / 2 + 0.02, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>

      {/* Top Perimeter Beams (Upper Crown at Y = height - beamThickness / 2) */}
      {/* Front & Back */}
      <RoundedBox
        args={[width, beamThickness, beamThickness]}
        radius={0.003}
        smoothness={4}
        position={[0, height - beamThickness / 2, halfD - beamThickness / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>
      <RoundedBox
        args={[width, beamThickness, beamThickness]}
        radius={0.003}
        smoothness={4}
        position={[0, height - beamThickness / 2, -halfD + beamThickness / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>
      {/* Left & Right */}
      <RoundedBox
        args={[beamThickness, beamThickness, depth - beamThickness * 2]}
        radius={0.003}
        smoothness={4}
        position={[-halfW + beamThickness / 2, height - beamThickness / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>
      <RoundedBox
        args={[beamThickness, beamThickness, depth - beamThickness * 2]}
        radius={0.003}
        smoothness={4}
        position={[halfW - beamThickness / 2, height - beamThickness / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...steelMaterialProps} />
      </RoundedBox>

      {/* Mid-Level Cross Beams Supporting the Water Storage Tank (Y = 0.35) */}
      <mesh position={[-0.45, 0.35 - beamThickness / 2, -0.22]} castShadow receiveShadow>
        <boxGeometry args={[0.7, beamThickness, beamThickness]} />
        <meshStandardMaterial {...steelMaterialProps} />
      </mesh>
      <mesh position={[-0.45, 0.35 - beamThickness / 2, 0.22]} castShadow receiveShadow>
        <boxGeometry args={[0.7, beamThickness, beamThickness]} />
        <meshStandardMaterial {...steelMaterialProps} />
      </mesh>
      <mesh position={[-0.72, 0.35 - beamThickness / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[beamThickness, beamThickness, depth - beamThickness * 2]} />
        <meshStandardMaterial {...steelMaterialProps} />
      </mesh>
      <mesh position={[-0.15, 0.35 - beamThickness / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[beamThickness, beamThickness, depth - beamThickness * 2]} />
        <meshStandardMaterial {...steelMaterialProps} />
      </mesh>

      {/* Intermediate Mid-Height Rear Stiffener Beam (Y = 0.85) */}
      <mesh position={[0, 0.85, -halfD + beamThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[width, beamThickness, beamThickness]} />
        <meshStandardMaterial {...steelMaterialProps} />
      </mesh>

      {/* Pump Mounting Base Plate Rails (X = 0.15, Y = 0.08) */}
      <mesh position={[0.15, 0.06, -0.15]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.03, 0.06]} />
        <meshStandardMaterial {...steelMaterialProps} />
      </mesh>
      <mesh position={[0.15, 0.06, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.03, 0.06]} />
        <meshStandardMaterial {...steelMaterialProps} />
      </mesh>

      {/* Skid Base Subfloor (Perforated Industrial Deck Plate at base of frame) */}
      <mesh position={[0.25, 0.035, 0]} receiveShadow>
        <boxGeometry args={[1.0, 0.01, depth - 0.08]} />
        <meshStandardMaterial color="#1E293B" metalness={0.75} roughness={0.4} />
      </mesh>
    </group>
  );
}
