'use client';

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface FluidWaterSurfaceProps {
  radius: number;
  height: number;
  isRunning?: boolean;
  flowRate?: number;
  tdsValue?: number;
  turbidityValue?: number;
}

/**
 * Enterprise Dynamic Fluid Surface Shader Material
 * - Simulates physical liquid surface tension and capillary meniscus
 * - Generates Gerstner-style harmonic wave ripples scaled by pump flow velocity
 * - Computes real-time Fresnel reflection (reflects studio softboxes at grazing angles)
 * - Transitions color from clean crystal azure to contaminated amber/silt based on telemetry
 */
export function FluidWaterSurface({
  radius,
  height,
  isRunning = true,
  flowRate = 18.0,
  tdsValue = 180,
  turbidityValue = 1.2,
}: FluidWaterSurfaceProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Compute color based on water purity (clean vs contaminated)
  const isContaminated = tdsValue > 500 || turbidityValue > 5.0;
  const isSevere = tdsValue > 1200 || turbidityValue > 15.0;

  const targetColors = useMemo(() => {
    if (isSevere) {
      return {
        deep: new THREE.Color('#78350F'), // Deep silt brown
        shallow: new THREE.Color('#92400E'),
      };
    }
    if (isContaminated) {
      return {
        deep: new THREE.Color('#B45309'), // Amber contaminated
        shallow: new THREE.Color('#D97706'),
      };
    }
    return {
      deep: new THREE.Color('#0284C7'), // Clean azure
      shallow: new THREE.Color('#22D3EE'), // Clean luminous cyan
    };
  }, [isContaminated, isSevere]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAgitation: { value: 1.0 },
      uRadius: { value: radius },
      uColorDeep: { value: targetColors.deep.clone() },
      uColorShallow: { value: targetColors.shallow.clone() },
      uOpacity: { value: 0.88 },
    }),
    [radius, targetColors]
  );

  const vertexShader = `
    uniform float uTime;
    uniform float uAgitation;
    uniform float uRadius;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Distance from center of disc
      float dist = length(pos.xy);
      // Dampen ripples near the acrylic wall boundary for surface tension
      float wallDamping = smoothstep(uRadius, uRadius * 0.75, dist);

      // Gerstner harmonic interference waves
      float wave = sin(dist * 26.0 - uTime * 3.8) * 0.0024 * uAgitation;
      wave += cos(pos.x * 32.0 + uTime * 2.6) * sin(pos.y * 32.0 + uTime * 2.2) * 0.0016 * uAgitation;
      pos.z += wave * wallDamping;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      vViewPosition = -mvPosition.xyz;
      vNormal = normalMatrix * normal;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform float uOpacity;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Fresnel reflectance equation: R = R0 + (1 - R0)*(1 - cos(theta))^5
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.2);

      // Radial depth absorption (deeper at center, luminous at perimeter meniscus)
      float radialFactor = smoothstep(0.0, 0.5, length(vUv - 0.5));
      vec3 waterColor = mix(uColorDeep, uColorShallow, radialFactor);

      // Key light specular highlight glint
      vec3 lightDir = normalize(vec3(0.5, 0.8, 0.6));
      vec3 halfVector = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfVector), 0.0), 36.0);

      // Sky reflection highlight on ripples
      vec3 skyHighlight = vec3(0.85, 0.95, 1.0) * fresnel * 0.55;

      vec3 finalColor = waterColor + skyHighlight + spec * 0.45;
      gl_FragColor = vec4(finalColor, uOpacity + fresnel * 0.12);
    }
  `;

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    const mat = materialRef.current;

    // Advance wave animation time
    mat.uniforms.uTime.value += delta;

    // Agitation level is higher when pump is actively circulating fluid
    const targetAgitation = isRunning ? Math.max(0.6, Math.min(2.5, flowRate / 10.0)) : 0.25;
    mat.uniforms.uAgitation.value = THREE.MathUtils.lerp(
      mat.uniforms.uAgitation.value,
      targetAgitation,
      delta * 3.0
    );

    // Smooth color interpolation for contamination transitions
    mat.uniforms.uColorDeep.value.lerp(targetColors.deep, delta * 2.0);
    mat.uniforms.uColorShallow.value.lerp(targetColors.shallow, delta * 2.0);
  });

  return (
    <group position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* 1. Animated Fluid Surface Mesh */}
      <mesh receiveShadow>
        <circleGeometry args={[radius, 48]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 2. Capillary Meniscus Contact Ring (Luminous line where water touches acrylic wall) */}
      <mesh position={[0, 0, 0.001]}>
        <ringGeometry args={[radius - 0.008, radius, 48]} />
        <meshBasicMaterial
          color={isContaminated ? '#F59E0B' : '#38BDF8'}
          transparent
          opacity={0.65}
        />
      </mesh>
    </group>
  );
}
