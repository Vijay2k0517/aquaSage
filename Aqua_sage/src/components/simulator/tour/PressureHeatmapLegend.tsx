'use client';

import React from 'react';
import { Gauge } from 'lucide-react';
import { useSimulation } from '@/lib/simulator/SimulationContext';

/**
 * Enterprise Floating Pressure Heatmap Legend
 * - Displays calibrated false-color scale bar (0.0 to 6.0 bar)
 * - Renders real-time live needle tracking current pump discharge pressure
 */
export function PressureHeatmapLegend() {
  const { state } = useSimulation();
  const dischargePressure = (state.readings['sensor-pt01']?.value as number) || 2.8;

  // Normalized position on 0 - 6 bar scale (0% to 100%)
  const needlePercent = Math.max(0, Math.min(100, (dischargePressure / 6.0) * 100));

  return (
    <div
      className="absolute top-18 left-4 z-20 px-3.5 py-2.5 rounded-xl bg-[#090E17]/90 border border-slate-700/80 shadow-2xl backdrop-blur-md font-mono text-xs text-slate-200 select-none animate-in fade-in slide-in-from-top-4 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px] tracking-wide">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span>HYDRAULIC PRESSURE HEATMAP</span>
        </div>
        <span className="text-[10px] text-cyan-300 font-bold">
          {dischargePressure.toFixed(2)} bar
        </span>
      </div>

      {/* Color Ramp Gradient Bar */}
      <div className="relative w-48 sm:w-56 h-3 rounded-full overflow-visible my-1.5 border border-slate-700">
        <div className="w-full h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 via-emerald-400 via-amber-400 to-rose-600" />

        {/* Live Pressure Needle Marker */}
        <div
          className="absolute -top-1 w-2 h-5 bg-white border border-slate-900 rounded-sm shadow-md transition-all duration-150"
          style={{ left: `calc(${needlePercent}% - 4px)` }}
          title={`Current P1 Discharge: ${dischargePressure.toFixed(2)} bar`}
        />
      </div>

      {/* Scale Axis Labels */}
      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
        <span>0.0 bar (Suction)</span>
        <span>2.8 bar (Nominal)</span>
        <span>6.0 bar (Surge)</span>
      </div>
    </div>
  );
}
