'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import { SimulationState } from '@/lib/simulator/telemetryTypes';

interface PathSegment {
  id: string;
  points: [number, number, number][];
  active: (state: SimulationState) => boolean;
  flowRate: (state: SimulationState) => number;
  isContaminated: (state: SimulationState) => boolean;
  particleCount: number;
}

/**
 * Enterprise Volumetric Water Flow Streamline Particles
 * - Deterministically visualizes liquid flow velocity along pipeline centerlines
 * - Replaces isotropic spheres with velocity-stretched streamline droplets oriented along curve tangents
 * - Emissive bloom-enabled materials dynamically shifting between Clean Azure, Contaminated Amber, and Treated Emerald
 * - Scales streamline length and velocity proportionally to live telemetry flow rates
 */
export function WaterFlowParticles() {
  const { state } = useSimulation();

  // Define the physical 3D polylines for each pipe segment
  const segments: PathSegment[] = useMemo(() => [
    // 1. Suction Line: Tank Outlet to Pump Inlet
    {
      id: 'pipe-suction',
      points: [
        [-0.45, 0.25, 0],
        [0.05, 0.25, 0],
      ],
      active: (s) => s.isRunning && s.tankWaterHeight > 0.05,
      flowRate: (s) => s.inflowRateLpm || 18,
      isContaminated: (s) => s.preTreatmentTds > 500 || s.preTreatmentTurbidity > 5.0,
      particleCount: 10,
    },
    // 2. Discharge Riser: Pump to Flow Sensor 1 (YF-S201)
    {
      id: 'pipe-discharge',
      points: [
        [0.07, 0.28, 0],
        [0.07, 0.65, 0],
        [0.26, 0.65, 0],
      ],
      active: (s) => s.isRunning,
      flowRate: (s) => s.inflowRateLpm || 18,
      isContaminated: (s) => s.preTreatmentTds > 500 || s.preTreatmentTurbidity > 5.0,
      particleCount: 14,
    },
    // 3. Analytical Quality Bay to Leak Section
    {
      id: 'pipe-quality-leak',
      points: [
        [0.26, 0.65, 0],
        [0.54, 0.65, 0],
        [0.86, 0.65, 0],
      ],
      active: (s) => s.isRunning,
      flowRate: (s) => s.inflowRateLpm || 18,
      isContaminated: (s) => s.preTreatmentTds > 500 || s.preTreatmentTurbidity > 5.0,
      particleCount: 16,
    },
    // 4. Diversion Tee to Flow Sensor 2 (YF-S201 Outlet) & Delivery Line
    {
      id: 'pipe-outlet-fs02',
      points: [
        [0.86, 0.65, 0],
        [0.98, 0.65, 0],
        [1.16, 0.65, 0],
      ],
      active: (s) => s.isRunning && s.outflowRateLpm > 0.1,
      flowRate: (s) => s.outflowRateLpm || 12.5,
      isContaminated: (s) => (s.preTreatmentTds > 500 || s.preTreatmentTurbidity > 5.0) && s.filtrationState === 'IDLE',
      particleCount: 14,
    },
    // 5. Overhead Recirculation Return to Tank
    {
      id: 'pipe-return-header',
      points: [
        [1.16, 0.65, 0],
        [1.16, 1.45, 0],
        [-0.35, 1.45, 0],
      ],
      active: (s) => s.isRunning && s.outflowRateLpm > 0.1,
      flowRate: (s) => s.outflowRateLpm || 12.5,
      isContaminated: (s) => (s.preTreatmentTds > 500 || s.preTreatmentTurbidity > 5.0) && s.filtrationState === 'IDLE',
      particleCount: 18,
    },
    // 6. Alternate Diversion Branch to Compact Filtration Assembly
    {
      id: 'pipe-diversion',
      points: [
        [0.86, 0.65, 0],
        [0.86, 0.40, -0.28],
        [1.04, 0.40, -0.28],
        [1.04, 1.45, 0],
      ],
      active: (s) => s.isRunning && (s.filtrationState !== 'IDLE' || s.network.valves['valve-v-div']?.actualState === 'OPEN'),
      flowRate: () => 15.0,
      isContaminated: () => true,
      particleCount: 14,
    },
  ], []);

  // Compute smooth 3D CatmullRom splines for each pipeline segment
  const curves = useMemo(() => {
    return segments.map((seg) => {
      const vPoints = seg.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      return new THREE.CatmullRomCurve3(vPoints, false, 'chordal', 0.2);
    });
  }, [segments]);

  // Total particles across all segments
  const totalParticles = useMemo(() => {
    return segments.reduce((acc, s) => acc + s.particleCount, 0);
  }, [segments]);

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  // Emissive bloom colors
  const colorClean = useMemo(() => new THREE.Color('#38BDF8'), []);
  const colorContaminated = useMemo(() => new THREE.Color('#F59E0B'), []);
  const colorTreated = useMemo(() => new THREE.Color('#10B981'), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    let instanceIdx = 0;
    const time = performance.now() * 0.001;

    segments.forEach((seg, sIdx) => {
      const isActive = seg.active(state);
      const flow = seg.flowRate(state);
      const isContam = seg.isContaminated(state);
      const isRelease = seg.id === 'pipe-flt-release';
      const curve = curves[sIdx];
      const count = seg.particleCount;

      const speed = isActive ? Math.max(0.12, Math.min(0.55, flow / 45.0)) : 0;
      const lengthScale = isActive ? Math.max(0.04, Math.min(0.12, speed * 0.35)) : 0.01;

      for (let i = 0; i < count; i++) {
        if (!isActive || flow <= 0.05) {
          dummy.position.set(0, -999, 0);
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(instanceIdx, dummy.matrix);
        } else {
          const offset = (i / count + (time * speed) % 1) % 1;
          const pos = curve.getPointAt(offset);
          const tangent = curve.getTangentAt(offset);

          dummy.position.copy(pos);
          // Orient droplet capsule along the tangent of the pipe curve
          dummy.quaternion.setFromUnitVectors(upVector, tangent);
          // Stretch length proportionally to flow velocity
          dummy.scale.set(0.013, lengthScale, 0.013);
          dummy.updateMatrix();
          mesh.setMatrixAt(instanceIdx, dummy.matrix);

          if (isRelease) {
            tempColor.copy(colorTreated);
          } else if (isContam) {
            tempColor.copy(colorContaminated);
          } else {
            tempColor.copy(colorClean);
          }
          mesh.setColorAt(instanceIdx, tempColor);
        }

        instanceIdx++;
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, totalParticles]}
      frustumCulled={false}
    >
      {/* Streamline Capsule / Cylinder (Length 1.0, stretched along flow tangent) */}
      <cylinderGeometry args={[0.009, 0.006, 1.0, 10]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.92} />
    </instancedMesh>
  );
}
