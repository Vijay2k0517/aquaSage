'use client';

import React from 'react';
import {
  EffectComposer,
  Bloom,
  N8AO,
  Vignette,
  ToneMapping,
} from '@react-three/postprocessing';

interface PostProcessingPipelineProps {
  enabled?: boolean;
  enableBloom?: boolean;
  enableAO?: boolean;
  enableVignette?: boolean;
  aoQuality?: 'performance' | 'low' | 'medium' | 'high' | 'ultra';
}

/**
 * Enterprise Post-Processing Pipeline
 * - N8AO: State-of-the-art Screen-Space Ambient Occlusion providing physical depth and crevice contact shadows
 * - Selective Bloom: Creates an authentic optical halo around glowing status LEDs, laser markers, and animated flow particles
 * - Vignette: Soft industrial perimeter framing to emphasize central machinery
 * - ToneMapping: Prevents high specular highlight blowouts and preserves color grading
 */
export function PostProcessingPipeline({
  enabled = true,
  enableBloom = true,
  enableAO = true,
  enableVignette = true,
  aoQuality = 'medium',
}: PostProcessingPipelineProps) {
  if (!enabled) return null;

  return (
    <EffectComposer enableNormalPass={false} multisampling={4}>
      {/* 1. Screen-Space Ambient Occlusion (N8AO) */}
      {enableAO && (
        <N8AO
          aoRadius={0.4}
          distanceFalloff={0.25}
          intensity={2.2}
          quality={aoQuality}
          color="#020617"
          halfRes
          screenSpaceRadius
        />
      )}

      {/* 2. Selective Optical Bloom */}
      {enableBloom && (
        <Bloom
          luminanceThreshold={0.72}
          luminanceSmoothing={0.3}
          intensity={1.05}
          mipmapBlur
        />
      )}

      {/* 3. Perimeter Vignette for Cinematic Framing */}
      {enableVignette && (
        <Vignette
          offset={0.12}
          darkness={0.75}
          eskil={false}
        />
      )}

      {/* 4. Film Tone Mapping */}
      <ToneMapping />
    </EffectComposer>
  );
}
