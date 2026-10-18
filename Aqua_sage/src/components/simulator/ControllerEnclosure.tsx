'use client';

import { Billboard, Text } from '@react-three/drei';
import { InteractiveWrapper } from './interaction/InteractiveWrapper';
import { useSelection } from './interaction/SelectionProvider';

/**
 * ESP32 Industrial IP65 Control Enclosure
 * - Mounted on front-right structural frame post at [0.82, 0.95, 0.38]
 * - Contains ESP32 DevKitC board, DIN rail, status LEDs, and conduit glands
 */
export function ControllerEnclosure() {
  const { selectedComponentId, hoveredComponentId, selectComponent } = useSelection();
  const id = 'controller-esp32';
  const isSelected = selectedComponentId === id;
  const isHovered = hoveredComponentId === id;

  const boxWidth = 0.20;
  const boxHeight = 0.26;
  const boxDepth = 0.10;

  return (
    <InteractiveWrapper id={id} position={[0.82, 0.95, 0.36]} indicatorRadius={0.16}>
      <group name="ESP32ControllerEnclosure">
        {/* Heavy Polycarbonate Back Enclosure Body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[boxWidth, boxHeight, boxDepth]} />
          <meshStandardMaterial
            color={isSelected ? '#1E293B' : '#334155'}
            roughness={0.4}
            metalness={0.2}
          />
        </mesh>

        {/* Mounting Flanges Bolted to Skid Column */}
        {[-boxHeight / 2 + 0.02, boxHeight / 2 - 0.02].map((yOffset, i) => (
          <mesh key={`mount-${i}`} position={[-boxWidth / 2 - 0.015, yOffset, 0]}>
            <boxGeometry args={[0.03, 0.02, 0.04]} />
            <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}

        {/* Smoked Transparent Acrylic Front Door */}
        <mesh position={[0, 0, boxDepth / 2 + 0.005]}>
          <boxGeometry args={[boxWidth - 0.01, boxHeight - 0.01, 0.01]} />
          <meshStandardMaterial
            color="#0F172A"
            transparent
            opacity={0.55}
            roughness={0.1}
            metalness={0.1}
          />
        </mesh>

        {/* Enclosure Door Latch / Hinges */}
        <mesh position={[boxWidth / 2 - 0.005, 0, boxDepth / 2 + 0.006]}>
          <boxGeometry args={[0.01, 0.04, 0.015]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* INTERNAL ELECTRONICS (Visible Through Transparent Door) */}
        <group position={[0, 0, 0.01]}>
          {/* Galvanized Steel DIN Rail */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[boxWidth - 0.04, 0.035, 0.008]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.2} />
          </mesh>

          {/* ESP32-WROOM-32 Dev Board (Mounted on DIN Rail carrier) */}
          <group position={[-0.02, 0.01, 0.015]}>
            {/* Green PCB Substrate */}
            <mesh>
              <boxGeometry args={[0.055, 0.085, 0.004]} />
              <meshStandardMaterial color="#065F46" roughness={0.5} />
            </mesh>

            {/* Silver RF Metal Shield Can (ESP32 SoC) */}
            <mesh position={[0, 0.01, 0.004]}>
              <boxGeometry args={[0.036, 0.038, 0.004]} />
              <meshStandardMaterial color="#E2E8F0" metalness={0.9} roughness={0.15} />
            </mesh>

            {/* PCB Antenna Copper Pattern Trace */}
            <mesh position={[0, 0.036, 0.003]}>
              <boxGeometry args={[0.034, 0.008, 0.001]} />
              <meshStandardMaterial color="#F59E0B" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* Dual Pin Header Rows (Black Plastic Sockets) */}
            <mesh position={[-0.023, 0, 0.005]}>
              <boxGeometry args={[0.006, 0.075, 0.006]} />
              <meshStandardMaterial color="#1E293B" roughness={0.8} />
            </mesh>
            <mesh position={[0.023, 0, 0.005]}>
              <boxGeometry args={[0.006, 0.075, 0.006]} />
              <meshStandardMaterial color="#1E293B" roughness={0.8} />
            </mesh>

            {/* Active Status Indicator Micro-LEDs */}
            {/* Power LED (Solid Green) */}
            <mesh position={[-0.018, -0.028, 0.004]}>
              <cylinderGeometry args={[0.002, 0.002, 0.002, 8]} />
              <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={1.2} />
            </mesh>
            {/* Wi-Fi LED (Pulsing Cyan) */}
            <mesh position={[0, -0.028, 0.004]}>
              <cylinderGeometry args={[0.002, 0.002, 0.002, 8]} />
              <meshStandardMaterial color="#06B6D4" emissive="#06B6D4" emissiveIntensity={1.0} />
            </mesh>
            {/* TX/RX Activity LED (Amber) */}
            <mesh position={[0.018, -0.028, 0.004]}>
              <cylinderGeometry args={[0.002, 0.002, 0.002, 8]} />
              <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.8} />
            </mesh>
          </group>

          {/* Industrial Screw Terminal Block Row */}
          <mesh position={[0, -0.08, 0.01]}>
            <boxGeometry args={[boxWidth - 0.05, 0.025, 0.015]} />
            <meshStandardMaterial color="#475569" roughness={0.6} />
          </mesh>
        </group>

        {/* External Bottom Cable Glands & Conduit Harness */}
        {[-0.05, 0, 0.05].map((xOffset, i) => (
          <group key={`gland-${i}`} position={[xOffset, -boxHeight / 2 - 0.015, 0]}>
            <mesh>
              <cylinderGeometry args={[0.012, 0.012, 0.025, 12]} />
              <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Flexible Black Conduit Tube Dropping Down */}
            <mesh position={[0, -0.04, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.06, 12]} />
              <meshStandardMaterial color="#020617" roughness={0.8} />
            </mesh>
          </group>
        ))}

        {/* High-Contrast Interactive Exterior 3D Billboard HUD Label (Zero DOM createRoot) */}
        <Billboard position={[0, boxHeight / 2 + 0.05, boxDepth / 2]} follow={true}>
          <group
            onClick={(e) => {
              e.stopPropagation();
              selectComponent(id);
            }}
          >
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[0.22, 0.038]} />
              <meshBasicMaterial
                color={isSelected ? '#065F46' : isHovered ? '#064E3B' : '#022C22'}
                transparent
                opacity={0.92}
              />
            </mesh>
            <mesh position={[-0.095, 0, 0.002]}>
              <circleGeometry args={[0.005, 16]} />
              <meshBasicMaterial color="#10B981" />
            </mesh>
            <Text
              position={[0.012, 0, 0.003]}
              fontSize={0.015}
              color="#FFFFFF"
              anchorX="center"
              anchorY="middle"
            >
              ESP32-WROOM-32 Gateway
            </Text>
          </group>
        </Billboard>
      </group>
    </InteractiveWrapper>
  );
}
