'use client';

import React from 'react';
import { Environment, Lightformer } from '@react-three/drei';

export type LightingMode = 'studio' | 'cyberpunk' | 'daylight';

interface StudioLightingProps {
  mode?: LightingMode;
}

/**
 * Enterprise Studio Lighting & Image-Based Lighting (IBL) Rig
 * - Provides realistic reflections for metallic surfaces (stainless steel, brass, anodized aluminum)
 * - Configures soft directional key light with high-resolution shadow maps
 * - Rim lightformers define equipment contours and silhouettes
 */
export function StudioLighting({ mode = 'studio' }: StudioLightingProps) {
  if (mode === 'cyberpunk') {
    return (
      <group name="CyberpunkLighting">
        {/* Deep ambient fill */}
        <ambientLight intensity={0.15} color="#0A1128" />

        {/* High-intensity Cyan Key Rim */}
        <directionalLight
          position={[-6, 8, -4]}
          intensity={2.2}
          color="#06B6D4"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
        />

        {/* Hot Magenta / Purple Lateral Accent */}
        <directionalLight position={[6, 5, 5]} intensity={1.8} color="#A855F7" />

        {/* Pump & Sensor Highlighting */}
        <pointLight position={[0.2, 0.9, 0.8]} intensity={1.2} color="#38BDF8" distance={4} />

        {/* Procedural Environment for Sharp Specular Sheen */}
        <Environment resolution={512}>
          <Lightformer form="rect" intensity={3.0} position={[-5, 5, -5]} scale={[8, 4, 1]} color="#06B6D4" />
          <Lightformer form="rect" intensity={2.5} position={[5, 4, 5]} scale={[8, 4, 1]} color="#A855F7" />
          <Lightformer form="ring" intensity={1.5} position={[0, 8, 0]} scale={6} color="#38BDF8" />
        </Environment>
      </group>
    );
  }

  if (mode === 'daylight') {
    return (
      <group name="DaylightLighting">
        <ambientLight intensity={0.4} color="#F1F5F9" />
        <directionalLight
          position={[8, 12, 6]}
          intensity={2.2}
          color="#FFFBEB"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
        />
        <directionalLight position={[-5, 4, -5]} intensity={0.6} color="#93C5FD" />
        <Environment preset="city" environmentIntensity={0.8} />
      </group>
    );
  }

  // Default: Enterprise Clean Precision Studio Lighting
  return (
    <group name="PrecisionStudioLighting">
      {/* Soft Omnidirectional Ambience */}
      <ambientLight intensity={0.25} color="#E2E8F0" />

      {/* Primary Key Directional Sun with Precision Shadow Frustum */}
      <directionalLight
        position={[6.5, 10.5, 6.0]}
        intensity={1.65}
        color="#F8FAFC"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={26}
        shadow-camera-left={-3.5}
        shadow-camera-right={9.5}
        shadow-camera-top={5.5}
        shadow-camera-bottom={-5.5}
      />

      {/* Crisp Cool Cyan Rim Light (Grazes pipe contours and structural extrusions) */}
      <directionalLight position={[-5.0, 4.5, -4.5]} intensity={0.85} color="#38BDF8" />

      {/* Warm Fill Light (Subtly softens shadow side with golden tungsten warmth) */}
      <directionalLight position={[4.0, 2.5, -3.0]} intensity={0.35} color="#FDE68A" />

      {/* Analytical Sensor Bay Accent Spot */}
      <spotLight
        position={[0.5, 2.2, 0.8]}
        target-position={[0.5, 0.6, 0.0]}
        intensity={0.85}
        angle={0.65}
        penumbra={0.7}
        color="#E0F2FE"
        distance={4.5}
      />

      {/* Filtration & Diversion Facility Spot */}
      <spotLight
        position={[2.8, 4.2, -1.2]}
        target-position={[2.8, 0.5, -1.2]}
        intensity={0.75}
        angle={0.75}
        penumbra={0.6}
        color="#38BDF8"
        distance={6.0}
      />

      {/* Centrifugal Pump Engine Bay Fill */}
      <pointLight position={[0.15, 0.45, 0.4]} intensity={0.4} color="#F1F5F9" distance={2.5} />

      {/* Precision IBL Environment with Custom Procedural Studio Softbox Lightformers */}
      <Environment resolution={512} environmentIntensity={0.65}>
        {/* Overhead diffused daylight softbox ceiling */}
        <Lightformer form="rect" intensity={1.8} position={[0, 9, 0]} scale={[12, 10, 1]} color="#F8FAFC" />

        {/* Rear-left cyan edge-defining strip */}
        <Lightformer form="rect" intensity={2.6} position={[-6, 3.5, -4]} scale={[10, 2, 1]} color="#06B6D4" />

        {/* Front-right warm tungsten fill card */}
        <Lightformer form="rect" intensity={1.2} position={[6, 2.5, 4]} scale={[8, 3, 1]} color="#FDE68A" />

        {/* Horizon circular ambient disc */}
        <Lightformer form="ring" intensity={1.0} position={[0, -2, 0]} scale={8} color="#0F172A" />
      </Environment>
    </group>
  );
}
