'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { CameraPreset } from './types';

// Dynamically import IoTScene with SSR disabled to prevent server-side WebGL evaluation
const IoTScene = dynamic(() => import('./IoTScene'), {
  ssr: false,
  loading: () => <SceneLoadingFallback />,
});

function SceneLoadingFallback() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0B0F19] text-slate-300">
      <div className="relative flex items-center justify-center mb-6">
        {/* Animated Radar Pulse Rings */}
        <div className="w-20 h-20 rounded-full border border-cyan-500/20 animate-ping absolute" />
        <div className="w-14 h-14 rounded-full border border-cyan-400/40 animate-pulse absolute" />
        <div className="w-10 h-10 rounded-full bg-slate-900 border border-cyan-500/80 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
        </div>
      </div>
      <div className="text-center">
        <h3 className="font-mono text-sm tracking-widest text-cyan-400 uppercase font-semibold">
          AquaSage 3D Digital Twin
        </h3>
        <p className="text-xs text-slate-500 font-mono mt-1">Initializing WebGL 2.0 Physical Skid Geometry...</p>
      </div>
      <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-4">
        <div className="w-2/3 h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

import type { LightingMode } from './rendering/StudioLighting';
import type { DiagnosticMode } from './PipeNetwork';

interface SceneLoaderProps {
  activePreset: CameraPreset;
  resetTrigger: number;
  lightingMode?: LightingMode;
  enablePostProcessing?: boolean;
  diagnosticMode?: DiagnosticMode;
  tourTarget?: { position: [number, number, number]; target: [number, number, number] } | null;
  autoRotate?: boolean;
}

export function SceneLoader({
  activePreset,
  resetTrigger,
  lightingMode = 'studio',
  enablePostProcessing = true,
  diagnosticMode = 'pbr',
  tourTarget = null,
  autoRotate = false,
}: SceneLoaderProps) {
  return (
    <IoTScene
      activePreset={activePreset}
      resetTrigger={resetTrigger}
      lightingMode={lightingMode}
      enablePostProcessing={enablePostProcessing}
      diagnosticMode={diagnosticMode}
      tourTarget={tourTarget}
      autoRotate={autoRotate}
    />
  );
}
