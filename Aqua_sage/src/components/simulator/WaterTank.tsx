'use client';

import React, { useMemo } from 'react';
import { MeshTransmissionMaterial } from '@react-three/drei';
import { InteractiveWrapper } from './interaction/InteractiveWrapper';
import { FluidWaterSurface } from './rendering/FluidWaterShader';
import { TankMicroBubbles } from './rendering/TankMicroBubbles';
import { useSimulation } from '@/lib/simulator/SimulationContext';

interface WaterTankProps {
  waterHeight?: number; // In metres (baseline: 0.75m)
}

/**
 * Enterprise Photorealistic Industrial Water Storage Tank
 * - Physical Shell: Diameter 0.5642m (Radius 0.2821m), Height 1.20m, 250L Usable Capacity
 * - Optical Acrylic Cylindrical Shell with MeshTransmissionMaterial (refraction, chromatic dispersion)
 * - Volumetric Water Body with physical IOR 1.333, Beer-Lambert attenuation, and telemetry-reactive purity color
 * - Dynamic animated fluid surface meniscus with Gerstner wave ripples
 * - Aeration micro-bubbles drifting through the fluid column
 * - External borosilicate sight glass gauge column with buoyant float ball
 * - 316 Stainless steel reinforcement flanges with perimeter hex bolt array
 */
export function WaterTank({ waterHeight }: WaterTankProps) {
  const { state } = useSimulation();

  // Use simulation state if not explicitly overridden
  const effectiveWaterHeight = waterHeight ?? state.tankWaterHeight ?? 0.75;
  const isRunning = state.isRunning;
  const flowRate = (state.readings?.['sensor-fs01']?.value as number) || 18.0;
  const tdsValue = state.preTreatmentTds || 180;
  const turbidityValue = state.preTreatmentTurbidity || 1.2;

  // Physical parameters (1 unit = 1 metre)
  const radius = 0.2821;
  const shellHeight = 1.20;
  const baseY = 0.35; // base of tank elevated above floor
  const tankCenterY = baseY + shellHeight / 2; // 0.95m
  const waterRadius = radius - 0.005; // slight inward offset to prevent z-fighting with acrylic
  const currentWaterHeight = Math.max(0, Math.min(1.0, effectiveWaterHeight));
  const hasWater = currentWaterHeight > 0.01;
  const waterCenterY = baseY + currentWaterHeight / 2;
  const waterSurfaceY = baseY + currentWaterHeight;

  // Contamination status for fluid coloring
  const isContaminated = tdsValue > 500 || turbidityValue > 5.0;
  const isSevere = tdsValue > 1200 || turbidityValue > 15.0;

  // Water PBR physical material properties
  const waterPhysicalColor = useMemo(() => {
    if (isSevere) return '#92400E';
    if (isContaminated) return '#D97706';
    return '#06B6D4'; // Vibrant clean azure
  }, [isContaminated, isSevere]);

  const attenuationColor = useMemo(() => {
    if (isSevere) return '#78350F';
    if (isContaminated) return '#B45309';
    return '#0284C7';
  }, [isContaminated, isSevere]);

  // Stainless steel trim for flanges
  const flangeMaterialProps = {
    color: '#475569',
    metalness: 0.9,
    roughness: 0.24,
  };

  // Perimeter bolt positions (16 bolts per ring)
  const boltPositions = useMemo(() => {
    const bolts: [number, number][] = [];
    const count = 16;
    const boltRadius = radius + 0.022;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      bolts.push([Math.cos(angle) * boltRadius, Math.sin(angle) * boltRadius]);
    }
    return bolts;
  }, [radius]);

  return (
    <InteractiveWrapper id="tank" position={[-0.45, 0, 0]} indicatorRadius={radius + 0.08}>
      <group name="WaterStorageTank">
        {/* ──────────────────────────────────────────────────────────── */}
        {/* 1. STRUCTURAL HEAVY BASE & MOUNTING HARDWARE                 */}
        {/* ──────────────────────────────────────────────────────────── */}
        {/* Heavy Base Flange Ring */}
        <mesh position={[0, baseY + 0.01, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius + 0.04, radius + 0.04, 0.02, 48]} />
          <meshStandardMaterial {...flangeMaterialProps} />
        </mesh>
        <mesh position={[0, baseY + 0.025, 0]}>
          <cylinderGeometry args={[radius, radius, 0.01, 48]} />
          <meshStandardMaterial color="#1E293B" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* Base Perimeter Hex Bolts */}
        {boltPositions.map(([bx, bz], idx) => (
          <mesh key={`base-bolt-${idx}`} position={[bx, baseY + 0.024, bz]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.012, 6]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.95} roughness={0.15} />
          </mesh>
        ))}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 2. OPTICAL ACRYLIC TANK SHELL (MeshTransmissionMaterial)     */}
        {/* ──────────────────────────────────────────────────────────── */}
        <mesh position={[0, tankCenterY, 0]}>
          <cylinderGeometry args={[radius, radius, shellHeight, 48, 1, true]} />
          <MeshTransmissionMaterial
            backside
            samples={8}
            resolution={512}
            thickness={0.065}
            chromaticAberration={0.035}
            anisotropy={0.25}
            distortion={0.12}
            distortionScale={0.18}
            temporalDistortion={0.05}
            roughness={0.03}
            color="#E0F2FE"
          />
        </mesh>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 3. TOP REINFORCEMENT FLANGE & CROWN HARDWARE                 */}
        {/* ──────────────────────────────────────────────────────────── */}
        <mesh position={[0, baseY + shellHeight, 0]} castShadow>
          <cylinderGeometry args={[radius + 0.035, radius + 0.035, 0.025, 48]} />
          <meshStandardMaterial {...flangeMaterialProps} />
        </mesh>

        {/* Top Rim Hex Bolts */}
        {boltPositions.map(([bx, bz], idx) => (
          <mesh key={`top-bolt-${idx}`} position={[bx, baseY + shellHeight + 0.015, bz]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.012, 6]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.95} roughness={0.15} />
          </mesh>
        ))}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 4. VOLUMETRIC PHYSICAL WATER COLUMN                          */}
        {/* ──────────────────────────────────────────────────────────── */}
        {hasWater && (
          <group name="LiquidBody">
            {/* Volumetric Liquid Cylinder with PBR Attenuation & IOR */}
            <mesh position={[0, waterCenterY, 0]}>
              <cylinderGeometry args={[waterRadius, waterRadius, currentWaterHeight, 48]} />
              <meshPhysicalMaterial
                color={waterPhysicalColor}
                transparent
                opacity={0.80}
                roughness={0.06}
                metalness={0.04}
                transmission={0.65}
                ior={1.333}
                thickness={0.45}
                attenuationDistance={0.40}
                attenuationColor={attenuationColor}
                specularIntensity={1.0}
                specularColor="#E0F2FE"
                depthWrite={false}
              />
            </mesh>

            {/* Dynamic Animated Fluid Surface Meniscus with Gerstner Waves & Fresnel */}
            <FluidWaterSurface
              radius={waterRadius}
              height={waterSurfaceY}
              isRunning={isRunning}
              flowRate={flowRate}
              tdsValue={tdsValue}
              turbidityValue={turbidityValue}
            />

            {/* Aeration Micro-Bubbles Ascending through Fluid Column */}
            <TankMicroBubbles
              baseY={baseY + 0.02}
              waterHeight={currentWaterHeight}
              maxRadius={waterRadius - 0.03}
              isRunning={isRunning}
            />
          </group>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 5. METRIC GRADUATED LEVEL SCALE (Front Face)                 */}
        {/* ──────────────────────────────────────────────────────────── */}
        {[0.25, 0.50, 0.75, 1.00].map((h) => {
          const yPos = baseY + h;
          const isCurrent = Math.abs(h - currentWaterHeight) < 0.05;
          return (
            <group key={`level-mark-${h}`} position={[0, yPos, radius + 0.002]}>
              {/* Tick ribbon */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.08, 0.004, 0.002]} />
                <meshStandardMaterial
                  color={isCurrent ? '#38BDF8' : '#94A3B8'}
                  emissive={isCurrent ? '#06B6D4' : '#000000'}
                  emissiveIntensity={isCurrent ? 0.8 : 0}
                />
              </mesh>
            </group>
          );
        })}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 6. EXTERNAL BOROSILICATE SIGHT GAUGE GLASS COLUMN            */}
        {/* ──────────────────────────────────────────────────────────── */}
        <group position={[radius * 0.72, baseY + 0.55, radius * 0.72]}>
          {/* Top & Bottom Banjo Flange Mounts to Tank Wall */}
          {[0.52, -0.52].map((yOffset, i) => (
            <group key={`banjo-${i}`} position={[0, yOffset, 0]}>
              <mesh rotation={[0, Math.PI / 4, 0]}>
                <boxGeometry args={[0.035, 0.025, 0.04]} />
                <meshStandardMaterial {...flangeMaterialProps} />
              </mesh>
              <mesh position={[-0.015, 0, -0.015]} rotation={[0, Math.PI / 4, Math.PI / 2]}>
                <cylinderGeometry args={[0.01, 0.01, 0.04, 16]} />
                <meshStandardMaterial {...flangeMaterialProps} />
              </mesh>
            </group>
          ))}

          {/* Anodized Aluminum Scale Backing Plate */}
          <mesh position={[0.012, 0, 0.012]} rotation={[0, -Math.PI / 4, 0]}>
            <boxGeometry args={[0.024, 1.05, 0.004]} />
            <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Transparent Glass Sight Tube (Outer Borosilicate Sheath) */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.010, 0.010, 1.02, 20]} />
            <meshStandardMaterial
              color="#E0F2FE"
              transparent
              opacity={0.35}
              roughness={0.05}
              metalness={0.1}
            />
          </mesh>

          {/* Internal Fluid Column inside Sight Glass */}
          {hasWater && (
            <mesh position={[0, -0.51 + currentWaterHeight / 2, 0]}>
              <cylinderGeometry args={[0.0075, 0.0075, currentWaterHeight, 16]} />
              <meshStandardMaterial
                color={waterPhysicalColor}
                transparent
                opacity={0.85}
                roughness={0.1}
              />
            </mesh>
          )}

          {/* Buoyant Fluorescent Float Indicator Ball bobbing at current meniscus */}
          {hasWater && (
            <mesh position={[0, -0.51 + currentWaterHeight, 0]}>
              <sphereGeometry args={[0.0065, 16, 16]} />
              <meshStandardMaterial
                color="#F97316"
                emissive="#EA580C"
                emissiveIntensity={0.6}
                roughness={0.2}
              />
            </mesh>
          )}
        </group>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 7. INFLOW & DRAIN SPIGOTS                                    */}
        {/* ──────────────────────────────────────────────────────────── */}
        {/* Tank Inflow Return Spigot (Top Return Connection at Y = 1.45) */}
        <mesh position={[0.15, baseY + shellHeight - 0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.12, 20]} />
          <meshStandardMaterial {...flangeMaterialProps} />
        </mesh>
        <mesh position={[0.21, baseY + shellHeight - 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.038, 0.038, 0.015, 20]} />
          <meshStandardMaterial {...flangeMaterialProps} />
        </mesh>

        {/* Tank Bottom Drain/Suction Outlet (Bottom Center at Y = baseY - 0.04) */}
        <mesh position={[0, baseY - 0.03, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.08, 20]} />
          <meshStandardMaterial {...flangeMaterialProps} />
        </mesh>
        <mesh position={[0, baseY - 0.065, 0]}>
          <cylinderGeometry args={[0.048, 0.048, 0.015, 20]} />
          <meshStandardMaterial {...flangeMaterialProps} />
        </mesh>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 8. ULTRASONIC SENSOR STANDOFF BRACKET COLLAR                 */}
        {/* ──────────────────────────────────────────────────────────── */}
        <group position={[0, baseY + 1.25, 0]}>
          {/* Sturdy Structural Collar Bar */}
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.18, 0.018, 0.07]} />
            <meshStandardMaterial {...flangeMaterialProps} />
          </mesh>
          {/* Clamp Screws */}
          {[-0.07, 0.07].map((x, idx) => (
            <mesh key={`collar-screw-${idx}`} position={[x, 0.012, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.01, 12]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.95} />
            </mesh>
          ))}
        </group>
      </group>
    </InteractiveWrapper>
  );
}
