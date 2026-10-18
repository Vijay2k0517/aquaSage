'use client';

import React from 'react';
import { Billboard, Text } from '@react-three/drei';
import { ReadinessTier } from '@/lib/simulator/types';
import { InteractiveWrapper } from './interaction/InteractiveWrapper';
import { useSelection } from './interaction/SelectionProvider';
import { useTelemetry } from '@/lib/simulator/SimulationContext';

interface SensorPlaceholderProps {
  id: string;
  name: string;
  sensorType: 'ultrasonic' | 'flow' | 'pressure' | 'tds' | 'turbidity';
  readinessTier: ReadinessTier;
  unit: string;
  baselineValue: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  labelOffset?: [number, number, number];
}

/**
 * Identifiable 3D Sensor Placeholder with Enhanced Interactive HUD Label
 */
export function SensorPlaceholder({
  id,
  name,
  sensorType,
  readinessTier,
  unit,
  baselineValue,
  position,
  rotation = [0, 0, 0],
  labelOffset = [0, 0.08, 0],
}: SensorPlaceholderProps) {
  const { selectedComponentId, hoveredComponentId, selectComponent } = useSelection();
  const telemetry = useTelemetry(id);
  const [isLocalHovered, setIsLocalHovered] = React.useState(false);

  const isSelected = selectedComponentId === id;
  const isHovered = hoveredComponentId === id;
  const isPlanned = readinessTier === 'planned_hardware';
  const isExpanded = isSelected || isHovered || isLocalHovered;

  const shortCode = (() => {
    switch (id) {
      case 'sensor-us01': return 'US-01';
      case 'sensor-fs01': return 'FS-01';
      case 'sensor-pt01': return 'P1';
      case 'sensor-pt02': return 'P2';
      case 'sensor-tds01': return 'TDS';
      case 'sensor-turb01': return 'TURB';
      default: return name.split(' ')[0] || id;
    }
  })();

  const isCritical = telemetry?.severity === 'critical' || telemetry?.validity === 'invalid';
  const isWarning = telemetry?.severity === 'warning';
  const isOffline = telemetry?.connectionState === 'simulated_disconnected' || telemetry?.validity === 'unavailable';

  return (
    <InteractiveWrapper id={id} position={position} indicatorRadius={0.065}>
      <group name={`Sensor-${id}`} rotation={rotation}>
        {/* 3D Physical Transducer Representation */}
        {sensorType === 'ultrasonic' && (
          <group>
            {/* Ultrasonic Barrel */}
            <mesh castShadow>
              <cylinderGeometry args={[0.024, 0.024, 0.045, 16]} />
              <meshStandardMaterial
                color={isSelected ? '#38BDF8' : '#0284C7'}
                metalness={0.7}
                roughness={0.3}
                emissive={isSelected ? '#0284C7' : '#000000'}
                emissiveIntensity={isSelected ? 0.4 : 0}
              />
            </mesh>
            {/* Threaded Mounting Flange */}
            <mesh position={[0, 0.015, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.01, 6]} />
              <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Transducer Acoustic Face */}
            <mesh position={[0, -0.023, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.004, 16]} />
              <meshStandardMaterial color="#0F172A" roughness={0.9} />
            </mesh>
            {/* Simulated Acoustic Pulse Cone */}
            <mesh position={[0, -0.16, 0]}>
              <coneGeometry args={[0.08, 0.28, 16, 1, true]} />
              <meshStandardMaterial
                color={isSelected ? '#22D3EE' : '#38BDF8'}
                transparent
                opacity={isSelected ? 0.35 : 0.15}
                wireframe
              />
            </mesh>
          </group>
        )}

        {sensorType === 'flow' && (
          <group>
            {/* Turbine Flow Housing */}
            <mesh castShadow>
              <cylinderGeometry args={[0.038, 0.038, 0.065, 20]} />
              <meshStandardMaterial
                color={isSelected ? '#0284C7' : '#0369A1'}
                metalness={0.6}
                roughness={0.3}
                emissive={isSelected ? '#0369A1' : '#000000'}
                emissiveIntensity={isSelected ? 0.5 : 0}
              />
            </mesh>
            {/* Transparent Inspection Window */}
            <mesh position={[0, 0, 0.02]}>
              <cylinderGeometry args={[0.024, 0.024, 0.03, 16]} />
              <meshStandardMaterial color="#E0F2FE" transparent opacity={0.4} roughness={0.1} />
            </mesh>
            {/* Internal Impeller Rotor (6 blades) */}
            <group position={[0, 0, 0.02]}>
              {[0, 60, 120].map((deg) => (
                <mesh key={`blade-${deg}`} rotation={[0, 0, (deg * Math.PI) / 180]}>
                  <boxGeometry args={[0.032, 0.004, 0.014]} />
                  <meshStandardMaterial color="#F59E0B" metalness={0.4} roughness={0.4} />
                </mesh>
              ))}
            </group>
            {/* Hall Effect Sensor Pick-up Cap */}
            <mesh position={[0, 0.038, 0]}>
              <boxGeometry args={[0.025, 0.016, 0.025]} />
              <meshStandardMaterial color="#0F172A" roughness={0.7} />
            </mesh>
          </group>
        )}

        {sensorType === 'pressure' && (
          <group>
            {/* Piezoresistive Hex-Head Transducer Tap */}
            <mesh castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.04, 6]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Analog Gauge Dial Face (Industrial Pressure Gauge) */}
            <group position={[0, 0.05, 0]} rotation={[0, 0, 0]}>
              {/* Gauge Case */}
              <mesh castShadow>
                <cylinderGeometry args={[0.035, 0.035, 0.015, 24]} />
                <meshStandardMaterial
                  color={isSelected ? '#0284C7' : '#334155'}
                  metalness={0.8}
                  roughness={0.3}
                />
              </mesh>
              {/* White Dial Face */}
              <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.03, 24]} />
                <meshStandardMaterial color="#F8FAFC" roughness={0.8} />
              </mesh>
              {/* Gauge Needle */}
              <mesh position={[0, 0.008, 0.009]} rotation={[0, 0, -Math.PI / 6]}>
                <boxGeometry args={[0.003, 0.022, 0.001]} />
                <meshStandardMaterial color="#EF4444" />
              </mesh>
            </group>
          </group>
        )}

        {sensorType === 'tds' && (
          <group>
            {/* TDS Probe Compression Nut */}
            <mesh>
              <cylinderGeometry args={[0.018, 0.018, 0.02, 6]} />
              <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Probe Body */}
            <mesh position={[0, 0.025, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.035, 16]} />
              <meshStandardMaterial
                color={isSelected ? '#0369A1' : '#1E293B'}
                roughness={0.6}
              />
            </mesh>
            {/* Dual Immersed Electrodes */}
            <mesh position={[-0.005, -0.025, 0]}>
              <cylinderGeometry args={[0.002, 0.002, 0.03, 8]} />
              <meshStandardMaterial color="#E2E8F0" metalness={0.95} roughness={0.1} />
            </mesh>
            <mesh position={[0.005, -0.025, 0]}>
              <cylinderGeometry args={[0.002, 0.002, 0.03, 8]} />
              <meshStandardMaterial color="#E2E8F0" metalness={0.95} roughness={0.1} />
            </mesh>
          </group>
        )}

        {sensorType === 'turbidity' && (
          <group>
            {/* Optical Nephelometric Chamber */}
            <mesh castShadow>
              <boxGeometry args={[0.038, 0.045, 0.038]} />
              <meshStandardMaterial
                color={isSelected ? '#0369A1' : '#1E293B'}
                roughness={0.5}
                metalness={0.3}
              />
            </mesh>
            {/* Emitter Optics Lens */}
            <mesh position={[-0.019, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.008, 0.008, 0.004, 12]} />
              <meshStandardMaterial color="#06B6D4" emissive="#06B6D4" emissiveIntensity={0.8} />
            </mesh>
            {/* Receiver Optics Lens */}
            <mesh position={[0, 0, 0.019]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.004, 12]} />
              <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.8} />
            </mesh>
          </group>
        )}

        {/* Diegetic 3D Leader Line from Sensor Orifice to HUD Tag */}
        {isExpanded && (
          <group name="SensorLeaderAnchor">
            {/* Base Hardware Anchor Dot */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.006, 12, 12]} />
              <meshBasicMaterial
                color={isSelected ? '#22D3EE' : isCritical ? '#EF4444' : '#38BDF8'}
              />
            </mesh>
            {/* Vertical Optical Leader Pin Line */}
            <mesh position={[labelOffset[0] / 2, labelOffset[1] / 2, labelOffset[2] / 2]}>
              <cylinderGeometry args={[0.0012, 0.0012, Math.max(0.01, labelOffset[1]), 8]} />
              <meshBasicMaterial
                color={isSelected ? '#22D3EE' : isCritical ? '#EF4444' : '#38BDF8'}
                transparent
                opacity={0.75}
              />
            </mesh>
          </group>
        )}

        {/* Diegetic 3D WebGL Billboard HUD Tag (Zero DOM createRoot, GPU Accelerated) */}
        <Billboard position={labelOffset} follow={true}>
          <group
            onClick={(e) => {
              e.stopPropagation();
              selectComponent(id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setIsLocalHovered(true);
            }}
            onPointerOut={() => setIsLocalHovered(false)}
          >
            {/* Background Pill */}
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[isExpanded ? 0.22 : 0.08, 0.038]} />
              <meshBasicMaterial
                color={
                  isSelected
                    ? '#0284C7'
                    : isCritical
                    ? '#991B1B'
                    : isWarning
                    ? '#92400E'
                    : isHovered || isLocalHovered
                    ? '#1E293B'
                    : '#0F172A'
                }
                transparent
                opacity={0.92}
              />
            </mesh>

            {/* Glowing Status Dot */}
            <mesh position={[isExpanded ? -0.095 : -0.026, 0, 0.002]}>
              <circleGeometry args={[0.005, 16]} />
              <meshBasicMaterial
                color={
                  isCritical
                    ? '#EF4444'
                    : isWarning
                    ? '#F59E0B'
                    : isOffline
                    ? '#64748B'
                    : isPlanned
                    ? '#F59E0B'
                    : '#10B981'
                }
              />
            </mesh>

            {/* Primary Text Label */}
            <Text
              position={[isExpanded ? 0.012 : 0.008, 0, 0.003]}
              fontSize={0.016}
              color="#FFFFFF"
              anchorX="center"
              anchorY="middle"
            >
              {isExpanded
                ? `${shortCode}: ${
                    telemetry
                      ? telemetry.validity === 'valid'
                        ? telemetry.formattedValue
                        : telemetry.validity === 'unavailable'
                        ? 'UNAVAIL'
                        : 'INVALID'
                      : `${baselineValue} ${unit}`
                  }`
                : shortCode}
            </Text>

            {/* Downward indicator tick to physical mount point */}
            <mesh position={[0, -0.024, 0]}>
              <planeGeometry args={[0.002, 0.01]} />
              <meshBasicMaterial color={isSelected ? '#38BDF8' : '#64748B'} />
            </mesh>
          </group>
        </Billboard>
      </group>
    </InteractiveWrapper>
  );
}
