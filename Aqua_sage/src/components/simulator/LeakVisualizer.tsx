'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard, Text } from '@react-three/drei';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import { useSelection } from './interaction/SelectionProvider';
import { InteractiveWrapper } from './interaction/InteractiveWrapper';

interface LeakVisualizerProps {
  startPos?: [number, number, number];
  endPos?: [number, number, number];
}

/**
 * Enterprise 3D Dynamic Pipe Rupture & Pressurized Leak Visualizer
 * - Positioned dynamically along the main supply pipeline between FS-01 and FS-02
 * - High-velocity parabolic pressurized spray cone with gravity ballistic trajectory
 * - Expanding wet floor puddle with dynamic concentric impact ripple rings
 * - Emissive pulsating crimson fracture collar triggering the optical bloom pass
 * - Interactive 3D telemetry alert tag with live volumetric loss rate
 */
export function LeakVisualizer({
  startPos = [0.68, 0.65, 0],
  endPos = [0.84, 0.65, 0],
}: LeakVisualizerProps) {
  const { state } = useSimulation();
  const { selectComponent } = useSelection();

  const sprayPointsRef = useRef<THREE.Points>(null);
  const collarMeshRef = useRef<THREE.Mesh>(null);
  const rippleMeshRef = useRef<THREE.Mesh>(null);

  const leakSeverity = state.leakSeverityLpm || 0;
  const isLeaking = leakSeverity > 0.05;
  const norm = state.leakLocationNorm ?? 0.5;

  // Calculate physical 3D location along pipeline
  const leakX = startPos[0] + (endPos[0] - startPos[0]) * norm;
  const leakY = startPos[1] + (endPos[1] - startPos[1]) * norm;
  const leakZ = startPos[2] + (endPos[2] - startPos[2]) * norm;

  // 80 High-Velocity Pressurized Spray Particles
  const particleCount = 80;
  const particleState = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.02;
      pos[i * 3 + 1] = 0.035 + Math.random() * 0.01;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

      // Initial pressurized upward/outward spray cone
      vel[i * 3] = (Math.random() - 0.5) * 0.8;
      vel[i * 3 + 1] = 0.8 + Math.random() * 1.4;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }

    return { pos, vel };
  }, [particleCount]);

  useFrame((_, delta) => {
    // 1. Animate Pulsating Rupture Collar Alert
    if (collarMeshRef.current && isLeaking) {
      const time = performance.now() * 0.005;
      const pulse = 0.8 + Math.sin(time * 3.0) * 0.6;
      const mat = collarMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = pulse;
    }

    // 2. Animate Concentric Puddle Shockwave Ripples
    if (rippleMeshRef.current && isLeaking) {
      const time = performance.now() * 0.002;
      const rippleScale = 1.0 + (time % 1.0) * 0.8;
      rippleMeshRef.current.scale.set(rippleScale, rippleScale, 1);
      const rMat = rippleMeshRef.current.material as THREE.MeshBasicMaterial;
      rMat.opacity = Math.max(0, 0.5 * (1.0 - (time % 1.0)));
    }

    // 3. Animate Pressurized Parabolic Ballistic Droplets
    if (!sprayPointsRef.current || !isLeaking) return;
    const posArray = sprayPointsRef.current.geometry.attributes.position.array as Float32Array;
    const v = particleState.vel;
    const severityFactor = Math.min(2.5, Math.max(0.4, leakSeverity / 6.0));
    const gravity = -3.8;

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;

      // Update position with velocity
      posArray[idx] += v[idx] * delta * severityFactor;
      posArray[idx + 1] += v[idx + 1] * delta * severityFactor;
      posArray[idx + 2] += v[idx + 2] * delta * severityFactor;

      // Apply downward gravity acceleration
      v[idx + 1] += gravity * delta;

      // If droplet hits ground deck or moves too far, reset to aperture orifice
      if (posArray[idx + 1] < -leakY + 0.02) {
        posArray[idx] = (Math.random() - 0.5) * 0.02;
        posArray[idx + 1] = 0.035;
        posArray[idx + 2] = (Math.random() - 0.5) * 0.02;

        v[idx] = (Math.random() - 0.5) * 0.7;
        v[idx + 1] = 0.8 + Math.random() * 1.5;
        v[idx + 2] = (Math.random() - 0.5) * 0.7;
      }
    }

    sprayPointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  // Dynamic puddle radius based on leak severity
  const puddleRadius = Math.min(0.55, 0.16 + (leakSeverity / 12.0) * 0.22);

  return (
    <group position={[leakX, leakY, leakZ]}>
      <InteractiveWrapper id="pipe-leak" position={[0, 0, 0]} indicatorRadius={0.16}>
        <group name="PipeLeakVisualizer">
          {/* Rupture Sleeve Collar with Emissive Alarm Glow */}
          <mesh ref={collarMeshRef} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.036, 0.036, 0.10, 20]} />
            <meshStandardMaterial
              color={isLeaking ? '#EF4444' : '#475569'}
              metalness={0.85}
              roughness={0.25}
              emissive={isLeaking ? '#EF4444' : '#000000'}
              emissiveIntensity={isLeaking ? 1.0 : 0}
            />
          </mesh>

          {/* Precision Rupture Aperture Fissure */}
          {isLeaking && (
            <group position={[0, 0.037, 0]}>
              <mesh>
                <boxGeometry args={[0.05, 0.008, 0.024]} />
                <meshBasicMaterial color="#E0F2FE" />
              </mesh>
              {/* High-intensity aperture glow ring */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.015, 0.03, 16]} />
                <meshBasicMaterial color="#38BDF8" transparent opacity={0.85} />
              </mesh>
            </group>
          )}

          {/* High-Velocity Pressurized Spray Jet Plume */}
          {isLeaking && (
            <points ref={sprayPointsRef}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[particleState.pos, 3]}
                />
              </bufferGeometry>
              <pointsMaterial
                size={0.022 * Math.min(2.0, Math.max(0.8, leakSeverity / 5.0))}
                color="#7DD3FC"
                transparent
                opacity={0.88}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </points>
          )}

          {/* Expanding Wet Ground Puddle on Floor Plinth */}
          {isLeaking && (
            <group position={[0, -leakY + 0.004, 0]}>
              {/* Glossy Refractive Liquid Puddle Disc */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[puddleRadius, 32]} />
                <meshStandardMaterial
                  color="#0284C7"
                  transparent
                  opacity={0.72}
                  roughness={0.06}
                  metalness={0.85}
                />
              </mesh>

              {/* Outer Ground Moisture Stain Ring */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[puddleRadius, puddleRadius + 0.06, 32]} />
                <meshBasicMaterial color="#0C4A6E" transparent opacity={0.4} />
              </mesh>

              {/* Animated Expanding Impact Ripple Ring */}
              <mesh ref={rippleMeshRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[puddleRadius * 0.45, puddleRadius * 0.50, 32]} />
                <meshBasicMaterial color="#38BDF8" transparent opacity={0.5} />
              </mesh>
            </group>
          )}

          {/* 3D Diegetic HUD Failure Badge (Zero DOM createRoot) */}
          {isLeaking && (
            <Billboard position={[0, 0.28, 0]} follow={true}>
              <group
                onClick={(e) => {
                  e.stopPropagation();
                  selectComponent('pipe-leak-bay');
                }}
              >
                <mesh position={[0, 0, 0]}>
                  <planeGeometry args={[0.22, 0.04]} />
                  <meshBasicMaterial color="#991B1B" transparent opacity={0.92} />
                </mesh>
                <mesh position={[-0.095, 0, 0.002]}>
                  <circleGeometry args={[0.005, 16]} />
                  <meshBasicMaterial color="#EF4444" />
                </mesh>
                <Text
                  position={[0.012, 0, 0.003]}
                  fontSize={0.016}
                  color="#FFFFFF"
                  anchorX="center"
                  anchorY="middle"
                >
                  {`RUPTURE LEAK: -${leakSeverity.toFixed(1)} L/m`}
                </Text>
              </group>
            </Billboard>
          )}
        </group>
      </InteractiveWrapper>
    </group>
  );
}
