'use client';

import React from 'react';
import { Html } from '@react-three/drei';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import { useSelection } from './interaction/SelectionProvider';
import { InteractiveWrapper } from './interaction/InteractiveWrapper';
import { SensorPlaceholder } from './SensorPlaceholder';
import { Valve } from './Valve';
import { TopographicVillageTerrain } from './rendering/TopographicVillageTerrain';

/**
 * Enterprise 3D Village Distribution Infrastructure & Architectural GIS Twin
 * - Grounded on multi-tier Digital Elevation Model (DEM) topographic terrain
 * - Zone A: High-detail structural lattice trestle water tower, residential dwellings with solar roofs, and public tapstand
 * - Zone B: 1200L municipal civic reservoir with dome cap, market canopy, and 6-tap standpost array
 * - Zone C: Rural clinical health dispensary with emergency header tank, red cross medical emblem, and sanitary taps
 * - Pipe stanchion supports, ANSI flanged junction points, and status-reactive pipeline materials
 */
export function VillageNetwork() {
  const { state } = useSimulation();
  const { selectedComponentId, selectComponent } = useSelection();

  const pipeRadius = 0.024;
  const feederRadius = 0.016;

  const zones = state.network?.villageZones;
  const zoneA = zones?.['zone-a'];
  const zoneB = zones?.['zone-b'];
  const zoneC = zones?.['zone-c'];

  // Status-based pipe material colors
  const getPipeColor = (status?: string) => {
    switch (status) {
      case 'normal':
        return '#06B6D4'; // Vibrant clean cyan
      case 'reduced':
        return '#F59E0B'; // Amber deficit warning
      case 'contaminated_isolated':
        return '#EF4444'; // Red isolated
      case 'cut_off':
        return '#475569'; // Slate inactive
      default:
        return '#64748B';
    }
  };

  return (
    <group name="VillageInfrastructure">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 0. TOPOGRAPHIC DIGITAL ELEVATION MODEL (DEM) TERRAIN BASE    */}
      {/* ──────────────────────────────────────────────────────────── */}
      <TopographicVillageTerrain />

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. EXTENDED MAIN SUPPLY PIPELINE TO VILLAGES                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Pipe from Skid Manifold Exit (X = 0.96) to FS-02 (X = 2.60) */}
      <mesh position={[1.78, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 1.64, 20]} />
        <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Flange Pair at X = 1.78 mid-span weld */}
      <mesh position={[1.78, 0.65, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[pipeRadius * 1.5, pipeRadius * 1.5, 0.018, 20]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* DOWNSTREAM FLOW SENSOR FS-02 */}
      <SensorPlaceholder
        id="sensor-fs02"
        name="Flow FS-02"
        sensorType="flow"
        readinessTier="confirmed_hardware"
        unit="L/min"
        baselineValue="18.0"
        position={[2.60, 0.65, 0]}
        rotation={[0, 0, Math.PI / 2]}
        labelOffset={[0, 0.14, 0]}
      />

      {/* Pipe from FS-02 to Diversion Manifold (X = 2.60 to 3.40) */}
      <mesh position={[3.00, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.80, 20]} />
        <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Diversion Manifold Junction Tee at [3.40, 0.65, 0] */}
      <mesh position={[3.40, 0.65, 0]}>
        <sphereGeometry args={[pipeRadius * 1.35, 20, 20]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* AUTOMATED NORMAL DISTRIBUTION VALVE V-DIST at [3.80, 0.65, 0] */}
      <Valve
        id="valve-v-dist"
        name="V-DIST [Village Trunk]"
        position={[3.80, 0.65, 0]}
        rotation={[0, 0, Math.PI / 2]}
        isOpen={state.network.valves['valve-v-dist']?.actualState === 'OPEN'}
        pipeRadius={pipeRadius}
        handleColor="#10B981"
      />

      {/* Pipe from V-DIST to Distribution Header (X = 3.80 to 4.60) */}
      <mesh position={[4.20, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[pipeRadius, pipeRadius, 0.80, 20]} />
        <meshStandardMaterial
          color={getPipeColor(zoneB?.supplyStatus)}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* VILLAGE DISTRIBUTION HEADER JUNCTION at [4.60, 0.65, 0] */}
      <mesh position={[4.60, 0.65, 0]}>
        <cylinderGeometry args={[pipeRadius * 1.6, pipeRadius * 1.6, 0.14, 20]} />
        <meshStandardMaterial color="#1E293B" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. VILLAGE FEEDER BRANCH LINES                               */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Feeder to Zone A (North Ward): [4.60, 0.65, 0] -> [5.20, 0.75, 1.80] -> [6.20, 0.85, 1.80] */}
      <mesh position={[4.90, 0.70, 0.90]} rotation={[-Math.PI / 5, 0, Math.PI / 4]} castShadow>
        <cylinderGeometry args={[feederRadius, feederRadius, 1.85, 16]} />
        <meshStandardMaterial color={getPipeColor(zoneA?.supplyStatus)} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[5.70, 0.80, 1.80]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[feederRadius, feederRadius, 1.0, 16]} />
        <meshStandardMaterial color={getPipeColor(zoneA?.supplyStatus)} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Feeder to Zone B (East Ward): [4.60, 0.65, 0] -> [6.80, 0.70, 0] */}
      <mesh position={[5.70, 0.675, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[feederRadius, feederRadius, 2.20, 16]} />
        <meshStandardMaterial color={getPipeColor(zoneB?.supplyStatus)} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Feeder to Zone C (South Ward): [4.60, 0.65, 0] -> [5.20, 0.60, -1.80] -> [6.20, 0.60, -1.80] */}
      <mesh position={[4.90, 0.625, -0.90]} rotation={[Math.PI / 5, 0, Math.PI / 4]} castShadow>
        <cylinderGeometry args={[feederRadius, feederRadius, 1.85, 16]} />
        <meshStandardMaterial color={getPipeColor(zoneC?.supplyStatus)} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[5.70, 0.60, -1.80]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[feederRadius, feederRadius, 1.0, 16]} />
        <meshStandardMaterial color={getPipeColor(zoneC?.supplyStatus)} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. VILLAGE ZONE A: NORTH WARD (ELEVATED RIDGE WATER TOWER)   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <group position={[6.20, 0, 1.80]}>
        <InteractiveWrapper id="zone-a" position={[0, 0.85, 0]} indicatorRadius={0.55}>
          <group>
            {/* Structural Trestle Tower Legs (4 heavy steel angled columns) */}
            {[[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].map(([dx, dz], idx) => (
              <mesh key={`trestle-${idx}`} position={[dx, 0.44, dz]} castShadow>
                <cylinderGeometry args={[0.016, 0.018, 0.88, 12]} />
                <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
              </mesh>
            ))}

            {/* Cross-Bracing Horizontal Tie Rings */}
            {[0.28, 0.58].map((h, i) => (
              <group key={`bracing-ring-${i}`} position={[0, h, 0]}>
                <mesh>
                  <boxGeometry args={[0.44, 0.012, 0.012]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} />
                </mesh>
                <mesh>
                  <boxGeometry args={[0.012, 0.012, 0.44]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} />
                </mesh>
              </group>
            ))}

            {/* Elevated Structural Platform Deck */}
            <mesh position={[0, 0.88, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.60, 0.025, 0.60]} />
              <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.35} />
            </mesh>

            {/* Platform Perimeter Safety Railing */}
            <group position={[0, 0.94, 0]}>
              <mesh position={[0, 0.06, 0.29]}>
                <boxGeometry args={[0.58, 0.01, 0.01]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.85} />
              </mesh>
              <mesh position={[0, 0.06, -0.29]}>
                <boxGeometry args={[0.58, 0.01, 0.01]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.85} />
              </mesh>
              <mesh position={[0.29, 0.06, 0]}>
                <boxGeometry args={[0.01, 0.01, 0.58]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.85} />
              </mesh>
              <mesh position={[-0.29, 0.06, 0]}>
                <boxGeometry args={[0.01, 0.01, 0.58]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.85} />
              </mesh>
            </group>

            {/* 1000L Polyethylene Elevated Reservoir Tank */}
            <mesh position={[0, 1.25, 0]} castShadow>
              <cylinderGeometry args={[0.23, 0.23, 0.70, 32]} />
              <meshStandardMaterial
                color={selectedComponentId === 'zone-a' ? '#0284C7' : '#1E293B'}
                metalness={0.6}
                roughness={0.35}
              />
            </mesh>

            {/* Tank Reinforcement Compression Rings (3 steel hoops) */}
            {[1.05, 1.25, 1.45].map((yRing, rIdx) => (
              <mesh key={`hoop-${rIdx}`} position={[0, yRing, 0]}>
                <cylinderGeometry args={[0.234, 0.234, 0.01, 32]} />
                <meshStandardMaterial color="#64748B" metalness={0.9} roughness={0.2} />
              </mesh>
            ))}

            {/* Dynamic Water Level Fill Indicator Gauge */}
            <mesh position={[0, 1.25, 0.232]}>
              <boxGeometry args={[0.05, 0.55, 0.005]} />
              <meshStandardMaterial color="#0F172A" />
            </mesh>
            <mesh
              position={[
                0,
                0.98 + (0.55 * ((zoneA?.levelPercentage || 78) / 100)) / 2,
                0.234,
              ]}
            >
              <boxGeometry
                args={[0.035, 0.55 * ((zoneA?.levelPercentage || 78) / 100), 0.004]}
              />
              <meshStandardMaterial
                color="#38BDF8"
                emissive="#0284C7"
                emissiveIntensity={0.8}
              />
            </mesh>

            {/* ── ARCHITECTURAL RESIDENTIAL DWELLING CLUSTER ── */}
            {/* Modern Rural House A */}
            <group position={[-0.75, 0.14, 0.35]}>
              {/* Stone Plinth Masonry Foundation */}
              <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.48, 0.16, 0.42]} />
                <meshStandardMaterial color="#1E293B" roughness={0.9} />
              </mesh>
              {/* Timber Wall Envelope */}
              <mesh position={[0, 0.28, 0]} castShadow>
                <boxGeometry args={[0.45, 0.24, 0.38]} />
                <meshStandardMaterial color="#475569" roughness={0.7} />
              </mesh>
              {/* Pitched Gable Roof */}
              <mesh position={[0, 0.46, 0]} rotation={[0, 0, 0]} castShadow>
                <coneGeometry args={[0.34, 0.16, 4]} />
                <meshStandardMaterial color="#0F172A" roughness={0.5} metalness={0.4} />
              </mesh>
              {/* Illuminated Window */}
              <mesh position={[0, 0.28, 0.192]}>
                <planeGeometry args={[0.10, 0.10]} />
                <meshBasicMaterial color="#FDE68A" />
              </mesh>
              {/* Rooftop Solar PV Panel */}
              <mesh position={[0.08, 0.46, 0.12]} rotation={[-Math.PI / 4, 0, 0]}>
                <boxGeometry args={[0.16, 0.12, 0.008]} />
                <meshStandardMaterial color="#0284C7" metalness={0.9} roughness={0.15} />
              </mesh>
            </group>

            {/* Modern Rural House B */}
            <group position={[-0.85, 0.14, -0.45]}>
              <mesh position={[0, 0.06, 0]} castShadow>
                <boxGeometry args={[0.42, 0.12, 0.36]} />
                <meshStandardMaterial color="#1E293B" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.22, 0]} castShadow>
                <boxGeometry args={[0.39, 0.20, 0.33]} />
                <meshStandardMaterial color="#334155" roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.37, 0]} castShadow>
                <coneGeometry args={[0.29, 0.14, 4]} />
                <meshStandardMaterial color="#0F172A" roughness={0.5} metalness={0.4} />
              </mesh>
              <mesh position={[0, 0.22, 0.168]}>
                <planeGeometry args={[0.08, 0.08]} />
                <meshBasicMaterial color="#FDE68A" />
              </mesh>
            </group>

            {/* Community Standpost Tap Station with Drainage Apron */}
            <group position={[0.48, 0.14, 0]}>
              {/* Concrete Splash Pad Apron */}
              <mesh position={[0, 0.02, 0]} receiveShadow>
                <boxGeometry args={[0.28, 0.04, 0.32]} />
                <meshStandardMaterial color="#334155" roughness={0.8} />
              </mesh>
              {/* Sturdy Stainless Standpost Riser */}
              <mesh position={[0, 0.20, 0]} castShadow>
                <cylinderGeometry args={[0.018, 0.018, 0.36, 16]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.2} />
              </mesh>
              {/* Dual Faucets */}
              <mesh position={[0.03, 0.34, 0]}>
                <boxGeometry args={[0.06, 0.02, 0.04]} />
                <meshStandardMaterial color="#0284C7" metalness={0.8} />
              </mesh>
            </group>
          </group>
        </InteractiveWrapper>

        {/* Floating Zone A HUD Tag */}
        <Html position={[0, 1.85, 0]} center distanceFactor={6.5}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              selectComponent('zone-a');
            }}
            className="cursor-pointer px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950/90 backdrop-blur-md shadow-xl flex items-center gap-2 text-[10px] font-mono text-slate-200 hover:border-cyan-400 hover:scale-105 transition-all"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                zoneA?.supplyStatus === 'normal'
                  ? 'bg-emerald-400 animate-pulse'
                  : zoneA?.supplyStatus === 'reduced'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-bold text-white tracking-wide">Zone A [Ridge]</span>
            <span className="text-cyan-300 font-bold">{zoneA?.levelPercentage.toFixed(0)}%</span>
            <span className="text-slate-400">({zoneA?.currentSupplyLpm.toFixed(1)} L/m)</span>
          </div>
        </Html>
      </group>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. VILLAGE ZONE B: EAST WARD (CIVIC RESERVOIR & MARKET)      */}
      {/* ──────────────────────────────────────────────────────────── */}
      <group position={[6.80, 0, 0]}>
        <InteractiveWrapper id="zone-b" position={[0, 0.50, 0]} indicatorRadius={0.55}>
          <group>
            {/* Concrete Reservoir Foundation Plinth with Chamfer */}
            <mesh position={[0, 0.06, 0]} receiveShadow>
              <cylinderGeometry args={[0.40, 0.44, 0.12, 32]} />
              <meshStandardMaterial color="#334155" roughness={0.85} />
            </mesh>

            {/* Municipal Storage Reservoir Tank (1200L) */}
            <mesh position={[0, 0.50, 0]} castShadow>
              <cylinderGeometry args={[0.34, 0.34, 0.76, 32]} />
              <meshStandardMaterial
                color={selectedComponentId === 'zone-b' ? '#0284C7' : '#1E293B'}
                metalness={0.65}
                roughness={0.35}
              />
            </mesh>

            {/* Domed Roof Cap */}
            <mesh position={[0, 0.88, 0]} castShadow>
              <sphereGeometry args={[0.342, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3]} />
              <meshStandardMaterial color="#0F172A" metalness={0.7} roughness={0.3} />
            </mesh>

            {/* Ventilation Mushroom Cowl & Telemetry Antenna */}
            <group position={[0, 1.05, 0]}>
              <mesh position={[0, 0.04, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.08, 16]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.9} />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.003, 0.003, 0.16, 8]} />
                <meshStandardMaterial color="#38BDF8" emissive="#0284C7" emissiveIntensity={0.6} />
              </mesh>
            </group>

            {/* Level Sight Gauge */}
            <mesh position={[0, 0.50, 0.342]}>
              <boxGeometry args={[0.06, 0.60, 0.005]} />
              <meshStandardMaterial color="#0F172A" />
            </mesh>
            <mesh
              position={[
                0,
                0.20 + (0.60 * ((zoneB?.levelPercentage || 79) / 100)) / 2,
                0.344,
              ]}
            >
              <boxGeometry
                args={[0.04, 0.60 * ((zoneB?.levelPercentage || 79) / 100), 0.004]}
              />
              <meshStandardMaterial
                color="#38BDF8"
                emissive="#0284C7"
                emissiveIntensity={0.8}
              />
            </mesh>

            {/* Commercial Market Tensile Canopy Structure */}
            <group position={[-0.70, 0.10, 0]}>
              {/* Tensile Fabric Roof */}
              <mesh position={[0, 0.50, 0]} rotation={[0, 0, -0.05]} castShadow>
                <boxGeometry args={[0.70, 0.015, 0.70]} />
                <meshStandardMaterial color="#D97706" roughness={0.6} />
              </mesh>
              {/* 4 Steel Stanchion Columns */}
              {[[-0.30, -0.30], [0.30, -0.30], [-0.30, 0.30], [0.30, 0.30]].map(([dx, dz], idx) => (
                <mesh key={`canopy-col-${idx}`} position={[dx, 0.24, dz]} castShadow>
                  <cylinderGeometry args={[0.012, 0.012, 0.48, 12]} />
                  <meshStandardMaterial color="#475569" metalness={0.85} />
                </mesh>
              ))}
              {/* Internal Stall Counter */}
              <mesh position={[0, 0.18, 0]}>
                <boxGeometry args={[0.45, 0.22, 0.35]} />
                <meshStandardMaterial color="#334155" roughness={0.8} />
              </mesh>
            </group>

            {/* Community Standpost 6-Tap Manifold */}
            <group position={[0.62, 0.05, 0]}>
              <mesh position={[0, 0.20, 0]} castShadow>
                <boxGeometry args={[0.18, 0.38, 0.65]} />
                <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.4} />
              </mesh>
              {/* Spigot Rails */}
              <mesh position={[0.10, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.016, 0.016, 0.55, 12]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.9} />
              </mesh>
            </group>
          </group>
        </InteractiveWrapper>

        {/* Floating Zone B HUD Tag */}
        <Html position={[0, 1.35, 0]} center distanceFactor={6.5}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              selectComponent('zone-b');
            }}
            className="cursor-pointer px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950/90 backdrop-blur-md shadow-xl flex items-center gap-2 text-[10px] font-mono text-slate-200 hover:border-cyan-400 hover:scale-105 transition-all"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                zoneB?.supplyStatus === 'normal'
                  ? 'bg-emerald-400 animate-pulse'
                  : zoneB?.supplyStatus === 'reduced'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-bold text-white tracking-wide">Zone B [Market]</span>
            <span className="text-cyan-300 font-bold">{zoneB?.levelPercentage.toFixed(0)}%</span>
            <span className="text-slate-400">({zoneB?.currentSupplyLpm.toFixed(1)} L/m)</span>
          </div>
        </Html>
      </group>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 5. VILLAGE ZONE C: SOUTH WARD (CLINIC & SCHOOL TANK)         */}
      {/* ──────────────────────────────────────────────────────────── */}
      <group position={[6.20, 0, -1.80]}>
        <InteractiveWrapper id="zone-c" position={[0, 0.50, 0]} indicatorRadius={0.55}>
          <group>
            {/* Concrete Plinth Foundation */}
            <mesh position={[0, 0.08, 0]} receiveShadow>
              <cylinderGeometry args={[0.32, 0.35, 0.12, 32]} />
              <meshStandardMaterial color="#334155" roughness={0.85} />
            </mesh>

            {/* Storage Reservoir Tank (800L) */}
            <mesh position={[0, 0.46, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.26, 0.64, 32]} />
              <meshStandardMaterial
                color={selectedComponentId === 'zone-c' ? '#0284C7' : '#1E293B'}
                metalness={0.65}
                roughness={0.35}
              />
            </mesh>

            {/* Level Sight Gauge */}
            <mesh position={[0, 0.46, 0.262]}>
              <boxGeometry args={[0.06, 0.50, 0.005]} />
              <meshStandardMaterial color="#0F172A" />
            </mesh>
            <mesh
              position={[
                0,
                0.21 + (0.50 * ((zoneC?.levelPercentage || 80) / 100)) / 2,
                0.264,
              ]}
            >
              <boxGeometry
                args={[0.04, 0.50 * ((zoneC?.levelPercentage || 80) / 100), 0.004]}
              />
              <meshStandardMaterial
                color="#38BDF8"
                emissive="#0284C7"
                emissiveIntensity={0.8}
              />
            </mesh>

            {/* ── ARCHITECTURAL RURAL CLINIC / DISPENSARY BUILDING ── */}
            <group position={[-0.75, 0.10, 0]}>
              {/* Composite White Clinical Facade */}
              <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.65, 0.64, 0.52]} />
                <meshStandardMaterial color="#F8FAFC" roughness={0.4} metalness={0.1} />
              </mesh>
              {/* Parapet Roof Border */}
              <mesh position={[0, 0.65, 0]}>
                <boxGeometry args={[0.67, 0.03, 0.54]} />
                <meshStandardMaterial color="#334155" roughness={0.6} />
              </mesh>
              {/* Glazed Entry Vestibule Canopy */}
              <mesh position={[0.34, 0.45, 0]}>
                <boxGeometry args={[0.08, 0.015, 0.22]} />
                <meshStandardMaterial color="#0284C7" metalness={0.8} />
              </mesh>
              {/* Glowing Medical Red Cross Sign on Clinic Wall */}
              <group position={[0.328, 0.40, 0]}>
                <mesh>
                  <boxGeometry args={[0.005, 0.14, 0.045]} />
                  <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.9} />
                </mesh>
                <mesh>
                  <boxGeometry args={[0.005, 0.045, 0.14]} />
                  <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.9} />
                </mesh>
              </group>
              {/* Rooftop Solar Cold-Chain Medical Refrigerator Array */}
              <mesh position={[-0.10, 0.68, 0]} rotation={[-Math.PI / 6, 0, 0]}>
                <boxGeometry args={[0.28, 0.18, 0.01]} />
                <meshStandardMaterial color="#0284C7" metalness={0.95} roughness={0.15} />
              </mesh>
            </group>
          </group>
        </InteractiveWrapper>

        {/* Floating Zone C HUD Tag */}
        <Html position={[0, 1.25, 0]} center distanceFactor={6.5}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              selectComponent('zone-c');
            }}
            className="cursor-pointer px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950/90 backdrop-blur-md shadow-xl flex items-center gap-2 text-[10px] font-mono text-slate-200 hover:border-cyan-400 hover:scale-105 transition-all"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                zoneC?.supplyStatus === 'normal'
                  ? 'bg-emerald-400 animate-pulse'
                  : zoneC?.supplyStatus === 'reduced'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-bold text-white tracking-wide">Zone C [Clinic]</span>
            <span className="text-cyan-300 font-bold">{zoneC?.levelPercentage.toFixed(0)}%</span>
            <span className="text-slate-400">({zoneC?.currentSupplyLpm.toFixed(1)} L/m)</span>
          </div>
        </Html>
      </group>
    </group>
  );
}
