'use client';

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface TankMicroBubblesProps {
  baseY: number;
  waterHeight: number;
  maxRadius?: number;
  isRunning?: boolean;
}

/**
 * Aeration Micro-Bubbles inside the Water Tank
 * - Instanced micro-bubbles ascending through the fluid column
 * - Adds dynamic kinetic realism to the water volume during pump circulation
 */
export function TankMicroBubbles({
  baseY,
  waterHeight,
  maxRadius = 0.22,
  isRunning = true,
}: TankMicroBubblesProps) {
  const count = 16;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Internal bubble state data (x, y, z, speed, wobblePhase, scale)
  const bubbleData = useMemo(() => {
    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * maxRadius;
      return {
        x: Math.cos(angle) * r,
        y: baseY + Math.random() * Math.max(0.1, waterHeight),
        z: Math.sin(angle) * r,
        speed: 0.08 + Math.random() * 0.14,
        wobbleSpeed: 2.0 + Math.random() * 3.0,
        wobbleOffset: Math.random() * Math.PI * 2,
        scale: 0.0035 + Math.random() * 0.004,
      };
    });
  }, [count, baseY, waterHeight, maxRadius]);

  useFrame((_, delta) => {
    if (!meshRef.current || !isRunning || waterHeight < 0.08) return;
    const mesh = meshRef.current;
    const topY = baseY + waterHeight - 0.01;
    const time = performance.now() * 0.001;

    bubbleData.forEach((b, i) => {
      // Ascend upwards with fluid buoyancy
      b.y += delta * b.speed;

      // Reset to bottom if bubble breaches the surface meniscus
      if (b.y > topY) {
        b.y = baseY + 0.02 + Math.random() * 0.04;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * maxRadius;
        b.x = Math.cos(angle) * r;
        b.z = Math.sin(angle) * r;
      }

      // Gentle lateral hydrodynamic wobble
      const wobbleX = Math.sin(time * b.wobbleSpeed + b.wobbleOffset) * 0.004;
      const wobbleZ = Math.cos(time * b.wobbleSpeed + b.wobbleOffset) * 0.004;

      dummy.position.set(b.x + wobbleX, b.y, b.z + wobbleZ);
      dummy.scale.setScalar(b.scale);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (waterHeight < 0.05) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        color="#E0F2FE"
        emissive="#38BDF8"
        emissiveIntensity={0.4}
        roughness={0.1}
        metalness={0.2}
        transparent
        opacity={0.65}
      />
    </instancedMesh>
  );
}
