'use client';

import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { GlobalCameraPreset, GlobalCameraPresetConfig } from '@/lib/simulator/types';
import { useSelection } from './interaction/SelectionProvider';

export const CAMERA_PRESETS: Record<GlobalCameraPreset, GlobalCameraPresetConfig> = {
  isometric: {
    id: 'isometric',
    label: 'Overview',
    position: [2.2, 1.8, 2.2],
    target: [0.3, 0.7, 0],
  },
  front: {
    id: 'front',
    label: 'Front View',
    position: [0.3, 0.85, 2.4],
    target: [0.3, 0.75, 0],
  },
  tank: {
    id: 'tank',
    label: 'Tank & Ultrasonic',
    position: [-0.45, 1.45, 1.40],
    target: [-0.45, 0.95, 0],
  },
  flow1: {
    id: 'flow1',
    label: 'Flow 1 (Inlet)',
    position: [0.28, 0.85, 0.95],
    target: [0.28, 0.65, 0],
  },
  quality: {
    id: 'quality',
    label: 'TDS & Turbidity',
    position: [0.55, 0.80, 0.95],
    target: [0.55, 0.55, 0],
  },
  leak: {
    id: 'leak',
    label: 'Leak Bay',
    position: [0.75, 0.85, 0.95],
    target: [0.75, 0.65, 0],
  },
  filtration: {
    id: 'filtration',
    label: 'Filtration Unit',
    position: [0.90, 0.85, -0.75],
    target: [0.88, 0.45, -0.30],
  },
  flow2: {
    id: 'flow2',
    label: 'Flow 2 (Outlet)',
    position: [0.98, 0.85, 0.95],
    target: [0.98, 0.65, 0],
  },
  enclosure: {
    id: 'enclosure',
    label: 'ESP32 Gateway',
    position: [0.85, 1.05, 1.10],
    target: [0.82, 0.95, 0.36],
  },
};

interface CameraControlsProps {
  activePreset: GlobalCameraPreset;
  resetTrigger: number;
  tourTarget?: { position: [number, number, number]; target: [number, number, number] } | null;
  autoRotate?: boolean;
}

/**
 * Camera Controller with OrbitControls and Smooth Interpolation (Focus)
 * - Transitions smoothly between global presets, guided tour milestones, and selected component inspection targets
 * - Preserves free OrbitControls orbit/zoom after interpolation completes
 * - Supports showroom turntable auto-rotation
 */
export function CameraControls({
  activePreset,
  resetTrigger,
  tourTarget = null,
  autoRotate = false,
}: CameraControlsProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const { selectedComponent } = useSelection();

  // Animation interpolation state
  const isAnimating = useRef(false);
  const animProgress = useRef(0);
  const animDuration = 0.8; // 800ms smooth transition
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());

  // Function to initiate smooth camera glide
  const startTransition = React.useCallback(
    (targetPosition: [number, number, number], targetLookAt: [number, number, number]) => {
      if (!controlsRef.current) return;
      startPos.current.copy(camera.position);
      startTarget.current.copy(controlsRef.current.target);

      endPos.current.set(...targetPosition);
      endTarget.current.set(...targetLookAt);

      animProgress.current = 0;
      isAnimating.current = true;
    },
    [camera]
  );

  // Trigger camera focus when guided tour milestone changes
  useEffect(() => {
    if (tourTarget) {
      startTransition(tourTarget.position, tourTarget.target);
    }
  }, [tourTarget, startTransition]);

  // Trigger camera focus when a component is selected (if not on tour)
  useEffect(() => {
    if (selectedComponent && !tourTarget) {
      startTransition(selectedComponent.camera.position, selectedComponent.camera.target);
    }
  }, [selectedComponent, tourTarget, startTransition]);

  // Trigger camera transition when global presets or Reset View are pressed
  useEffect(() => {
    if (!tourTarget) {
      const config = CAMERA_PRESETS[activePreset] || CAMERA_PRESETS.isometric;
      startTransition(config.position, config.target);
    }
  }, [activePreset, resetTrigger, tourTarget, startTransition]);

  // Frame-by-frame smooth easing inside the Three.js render loop
  useFrame((_, delta) => {
    if (!isAnimating.current || !controlsRef.current) return;

    animProgress.current += delta / animDuration;
    const t = Math.min(1, animProgress.current);

    // Smoothstep interpolation (3t² - 2t³) for industrial deceleration
    const ease = t * t * (3 - 2 * t);

    camera.position.lerpVectors(startPos.current, endPos.current, ease);
    controlsRef.current.target.lerpVectors(startTarget.current, endTarget.current, ease);
    controlsRef.current.update();

    if (t >= 1) {
      isAnimating.current = false;
    }
  });

  return (
    <DreiOrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      minDistance={0.5}
      maxDistance={12.0}
      maxPolarAngle={Math.PI / 2 + 0.05} // Constrain camera above floor
      minPolarAngle={0.08}
      target={[0, 0.8, 0]}
      autoRotate={autoRotate}
      autoRotateSpeed={0.6}
    />
  );
}
