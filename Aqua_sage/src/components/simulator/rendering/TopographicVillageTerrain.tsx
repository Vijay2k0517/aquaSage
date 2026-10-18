'use client';

import React from 'react';

/**
 * Enterprise Digital Elevation Model (DEM) Topographic Base for Village Infrastructure
 * - Replaces floating voids with an architectural stepped relief landscape
 * - Topographically establishes Zone A on an elevated ridge (+0.14m), Zone B in a valley basin (+0.04m), and Zone C on a terraced slope (+0.08m)
 * - Renders glowing GIS elevation contour isolines and civil infrastructure utility corridors
 * - Provides structural concrete support stanchions anchoring the main distribution pipelines
 */
export function TopographicVillageTerrain() {
  const concreteColor = '#1E293B';
  const contourGlowColor = '#06B6D4';

  return (
    <group name="TopographicDEM_Base">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. PIPELINE GROUND SUPPORT STANCHIONS (Skid to Distribution) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {[1.78, 2.60, 3.40, 4.20].map((xPos) => (
        <group key={`stanchion-${xPos}`} position={[xPos, 0, 0]}>
          {/* Concrete Footing Pier */}
          <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.08, 0.24, 0.10]} />
            <meshStandardMaterial color={concreteColor} roughness={0.8} />
          </mesh>
          {/* Galvanized Steel Pipe Saddle Cradle */}
          <mesh position={[0, 0.24 + 0.18, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.36, 12]} />
            <meshStandardMaterial color="#64748B" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* U-Bolt Pipe Clamp Ring */}
          <mesh position={[0, 0.65, 0]}>
            <torusGeometry args={[0.026, 0.004, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. MULTI-TIERED STEPPED TOPOGRAPHIC TERRAIN                  */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* BASE REGIONAL PLINTH (Encompasses all 3 zones from X=3.8 to 7.8) */}
      <mesh position={[5.80, 0.01, 0]} receiveShadow>
        <boxGeometry args={[4.20, 0.02, 4.60]} />
        <meshStandardMaterial color="#0A0F1D" roughness={0.9} metalness={0.2} />
      </mesh>

      {/* Cybernetic Perimeter Boundary Guideline */}
      <mesh position={[5.80, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.16, 4.56]} />
        <meshBasicMaterial color="#0F172A" />
      </mesh>

      {/* ── ZONE A: NORTH RIDGE ELEVATED PLATEAU (+0.14m) ── */}
      <group position={[6.20, 0, 1.80]}>
        {/* Ridge Base Escarpment Tier 1 */}
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[1.70, 0.06, 1.60]} />
          <meshStandardMaterial color="#111827" roughness={0.85} />
        </mesh>
        {/* Ridge Crest Tier 2 */}
        <mesh position={[0, 0.09, 0]} receiveShadow>
          <boxGeometry args={[1.40, 0.06, 1.30]} />
          <meshStandardMaterial color="#162032" roughness={0.8} />
        </mesh>
        {/* Glowing Topographic Contour Isoline (Elev. +140m relative) */}
        <mesh position={[0, 0.121, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.38, 1.28]} />
          <meshBasicMaterial color={contourGlowColor} transparent opacity={0.12} />
        </mesh>
        {/* Perimeter Contour Line */}
        <mesh position={[0, 0.122, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.68, 0.69, 32]} />
          <meshBasicMaterial color={contourGlowColor} transparent opacity={0.45} />
        </mesh>
      </group>

      {/* ── ZONE B: CENTRAL MARKET BASIN (+0.04m) ── */}
      <group position={[6.80, 0, 0]}>
        {/* Basin Civic Plinth */}
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <cylinderGeometry args={[1.10, 1.15, 0.04, 32]} />
          <meshStandardMaterial color="#111827" roughness={0.8} />
        </mesh>
        {/* Civic Paver Ring */}
        <mesh position={[0, 0.051, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.95, 1.05, 32]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* ── ZONE C: SOUTH TERRACED SLOPE (+0.08m) ── */}
      <group position={[6.20, 0, -1.80]}>
        {/* Terrace Step Tier 1 */}
        <mesh position={[0, 0.035, 0]} receiveShadow>
          <boxGeometry args={[1.60, 0.05, 1.50]} />
          <meshStandardMaterial color="#111827" roughness={0.85} />
        </mesh>
        {/* Terrace Step Tier 2 (Clinic Footprint) */}
        <mesh position={[0, 0.07, 0]} receiveShadow>
          <boxGeometry args={[1.30, 0.04, 1.20]} />
          <meshStandardMaterial color="#162032" roughness={0.8} />
        </mesh>
        {/* Medical Zone Guideline */}
        <mesh position={[0, 0.091, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.26, 1.16]} />
          <meshBasicMaterial color="#10B981" transparent opacity={0.10} />
        </mesh>
      </group>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. CIVIL UTILITY ROADWAYS & PIPELINE TRENCH CORRIDORS        */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Main Spine Utility Trench (From Trunk Header X=4.6 to Zones) */}
      <mesh position={[5.40, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.40, 0.16]} />
        <meshBasicMaterial color="#1E293B" />
      </mesh>

      {/* Branch Trench to Zone A */}
      <mesh position={[5.40, 0.023, 0.90]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[1.80, 0.12]} />
        <meshBasicMaterial color="#1E293B" />
      </mesh>

      {/* Branch Trench to Zone C */}
      <mesh position={[5.40, 0.023, -0.90]} rotation={[-Math.PI / 2, 0, -Math.PI / 4]}>
        <planeGeometry args={[1.80, 0.12]} />
        <meshBasicMaterial color="#1E293B" />
      </mesh>
    </group>
  );
}
