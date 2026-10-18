'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useSelection } from './SelectionProvider';

interface InteractiveWrapperProps {
  id: string;
  position?: [number, number, number];
  indicatorRadius?: number;
  indicatorHeight?: number;
  children: React.ReactNode;
}

/**
 * Enterprise 3D Interactive Wrapper with Animated Holographic Reticle & CAD Targeting Brackets
 * - Provides hover/selection pointer events
 * - Renders counter-rotating holographic dashed targeting rings
 * - Renders optical CAD corner fiducials and dynamic vertical elevation leader vector
 * - Integrates with optical bloom for authentic sci-fi digital twin interface
 */
export function InteractiveWrapper({
  id,
  position = [0, 0, 0],
  indicatorRadius = 0.12,
  children,
}: InteractiveWrapperProps) {
  const { selectedComponentId, hoveredComponentId, selectComponent, setHoveredComponent } =
    useSelection();

  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  const isSelected = selectedComponentId === id;
  const isHovered = hoveredComponentId === id;
  const isActive = isSelected || isHovered;

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    setHoveredComponent(id);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
    setHoveredComponent(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectComponent(id);
  };

  useFrame((_, delta) => {
    if (!isActive) return;

    // Counter-rotating holographic targeting reticles
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += delta * (isSelected ? 1.4 : 0.8);
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z -= delta * (isSelected ? 1.8 : 1.0);
    }

    // Radial expanding beacon wave when selected
    if (beaconRef.current && isSelected) {
      const time = performance.now() * 0.002;
      const wave = (time % 1.0);
      const scale = 0.8 + wave * 0.6;
      beaconRef.current.scale.set(scale, scale, 1);
      const bMat = beaconRef.current.material as THREE.MeshBasicMaterial;
      bMat.opacity = Math.max(0, 0.4 * (1.0 - wave));
    }
  });

  return (
    <group
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {children}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* HOLOGRAPHIC 3D TARGETING RETICLE & DIEGETIC GROUND ANCHOR    */}
      {/* ──────────────────────────────────────────────────────────── */}
      {isActive && (
        <group position={[0, -0.01, 0]}>
          {/* 1. Counter-Rotating Outer Segmented Dashed Ring */}
          <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[indicatorRadius * 0.98, indicatorRadius * 1.15, 32]} />
            <meshBasicMaterial
              color={isSelected ? '#38BDF8' : '#0284C7'}
              transparent
              opacity={isSelected ? 0.85 : 0.45}
              wireframe={true}
            />
          </mesh>

          {/* 2. Counter-Rotating Inner Reticle Ring */}
          <mesh ref={innerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[indicatorRadius * 0.82, indicatorRadius * 0.90, 24]} />
            <meshBasicMaterial
              color={isSelected ? '#06B6D4' : '#38BDF8'}
              transparent
              opacity={isSelected ? 0.70 : 0.35}
            />
          </mesh>

          {/* 3. Radial Expanding Beacon Disc (When Selected) */}
          {isSelected && (
            <mesh ref={beaconRef} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[indicatorRadius * 0.75, indicatorRadius * 1.30, 32]} />
              <meshBasicMaterial color="#38BDF8" transparent opacity={0.3} />
            </mesh>
          )}

          {/* 4. Optical CAD Corner Brackets (4 targeting fiducials) */}
          {[Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].map(
            (angle, i) => {
              const r = indicatorRadius * 1.25;
              const bx = Math.cos(angle) * r;
              const bz = Math.sin(angle) * r;
              return (
                <group key={`corner-${i}`} position={[bx, 0.002, bz]}>
                  <mesh rotation={[-Math.PI / 2, 0, angle]}>
                    <planeGeometry args={[0.024, 0.004]} />
                    <meshBasicMaterial
                      color={isSelected ? '#22D3EE' : '#38BDF8'}
                      transparent
                      opacity={isSelected ? 0.9 : 0.5}
                    />
                  </mesh>
                </group>
              );
            }
          )}

          {/* 5. Center Elevation Vector Pin (Anchors object in 3D coordinate space) */}
          {isSelected && (
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.002, 0.002, 0.16, 8]} />
              <meshBasicMaterial color="#38BDF8" transparent opacity={0.65} />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}
