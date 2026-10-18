'use client';

import React, { useState } from 'react';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import {
  Sliders,
  Droplet,
  Flame,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function SimulationControlsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    state,
    setLeakSeverity,
    setLeakLocation,
    setContamination,
    setSpeedMultiplier,
    toggleFilterClogged,
    toggleValve,
  } = useSimulation();

  return (
    <div className="pointer-events-auto">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all shadow-sm active:scale-95 ${
          isOpen
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 font-bold'
            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/80'
        }`}
        title="Interactive Fault Injection & Hydraulic Scenario Controls"
        aria-label="Simulation Controls"
      >
        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
        <span>Live Parameters</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {/* Floating Panel Popup */}
      {isOpen && (
        <div className="absolute bottom-16 right-4 w-96 max-h-[80vh] overflow-y-auto p-4 rounded-xl bg-[#0F172A]/95 border border-slate-800 shadow-2xl backdrop-blur-md text-xs font-mono z-40 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                Live Scenario Controls
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              Interactive
            </span>
          </div>

          <div className="mt-3 space-y-4">
            {/* 1. Simulation Speed Selection */}
            <div>
              <div className="flex items-center justify-between text-slate-300 mb-1.5">
                <span className="text-[11px] font-semibold text-slate-400">SIMULATION CLOCK SPEED:</span>
                <span className="text-cyan-400 font-bold">{state.speedMultiplier}x</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 5] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSpeedMultiplier(spd)}
                    className={`py-1 rounded border text-xs font-bold transition-all ${
                      state.speedMultiplier === spd
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x Realtime
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Pipe Leak Injector (FS-01 to FS-02) */}
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Droplet className="w-3.5 h-3.5" />
                  Pipe Leak (FS-01 – FS-02)
                </span>
                <span className="text-[10px] text-slate-400">
                  {state.leakSeverityLpm > 0 ? 'INJECTED' : 'OFF'}
                </span>
              </div>

              {/* Severity Slider */}
              <div className="space-y-1 mb-2.5">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Leak Severity:</span>
                  <span className="text-amber-300 font-bold">
                    {state.leakSeverityLpm.toFixed(1)} L/min
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={state.leakSeverityLpm}
                  onChange={(e) => setLeakSeverity(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Position Slider */}
              <div className="space-y-1 mb-2.5">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Aperture Location:</span>
                  <span className="text-cyan-300 font-bold">
                    {(state.leakLocationNorm * 100).toFixed(0)}% from FS-01
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={state.leakLocationNorm}
                  onChange={(e) => setLeakLocation(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Mass-Balance Calculation Readout */}
              <div className="pt-2 border-t border-slate-800/80 text-[10px] space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>FS-01 Upstream:</span>
                  <span className="text-white font-bold">
                    {(state.readings['sensor-fs01']?.value ?? 0).toFixed(1)} L/min
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>FS-02 Downstream:</span>
                  <span className="text-white font-bold">
                    {(state.readings['sensor-fs02']?.value ?? 0).toFixed(1)} L/min
                  </span>
                </div>
                <div className="flex justify-between text-amber-300 font-bold">
                  <span>Calculated Leak Loss:</span>
                  <span>{state.estimatedLeakLossLpm.toFixed(1)} L/min</span>
                </div>
              </div>
            </div>

            {/* 3. Water Quality Contamination Injection */}
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-teal-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  Water Quality Injection
                </span>
                <span className="text-[10px] text-slate-400">
                  {state.preTreatmentTds > 500 || state.preTreatmentTurbidity > 5.0 ? 'CONTAMINATED' : 'NOMINAL'}
                </span>
              </div>

              {/* TDS Slider */}
              <div className="space-y-1 mb-2.5">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>TDS Concentration:</span>
                  <span className={state.preTreatmentTds > 500 ? 'text-amber-400 font-bold' : 'text-cyan-300'}>
                    {state.preTreatmentTds.toFixed(0)} ppm
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1200"
                  step="25"
                  value={state.preTreatmentTds}
                  onChange={(e) => setContamination(parseFloat(e.target.value), state.preTreatmentTurbidity)}
                  className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Turbidity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Turbidity Loading:</span>
                  <span className={state.preTreatmentTurbidity > 5.0 ? 'text-amber-400 font-bold' : 'text-cyan-300'}>
                    {state.preTreatmentTurbidity.toFixed(1)} NTU
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={state.preTreatmentTurbidity}
                  onChange={(e) => setContamination(state.preTreatmentTds, parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* 4. Filtration Health & Manual Valve Toggles */}
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sky-400 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  Filtration System
                </span>
                <button
                  onClick={toggleFilterClogged}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                    state.network.filtrationConfig.filterClogged
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {state.network.filtrationConfig.filterClogged ? 'Clogged Filter' : 'Clean Filter'}
                </button>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1 mb-3">
                <div className="flex justify-between">
                  <span>Filtration State:</span>
                  <span className="text-cyan-300 font-bold">{state.filtrationState}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed Passes:</span>
                  <span className="text-white font-bold">{state.filtrationPassCount} / 3</span>
                </div>
                <div className="flex justify-between">
                  <span>Post-TDS / Post-Turbidity:</span>
                  <span className="text-white font-bold">
                    {state.postTreatmentTds.toFixed(0)} ppm / {state.postTreatmentTurbidity.toFixed(1)} NTU
                  </span>
                </div>
              </div>

              {/* Manual Valve Overrides */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-semibold block mb-1.5">
                  MANUAL VALVE OVERRIDE:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <button
                    onClick={() => toggleValve('valve-v-dist')}
                    className={`py-1 px-2 rounded border font-bold transition-all ${
                      state.network.valves['valve-v-dist']?.actualState === 'OPEN'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    V-DIST: {state.network.valves['valve-v-dist']?.actualState ?? 'CLOSED'}
                  </button>
                  <button
                    onClick={() => toggleValve('valve-v-div')}
                    className={`py-1 px-2 rounded border font-bold transition-all ${
                      state.network.valves['valve-v-div']?.actualState === 'OPEN'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    V-DIV: {state.network.valves['valve-v-div']?.actualState ?? 'CLOSED'}
                  </button>
                  <button
                    onClick={() => toggleValve('valve-v-rec')}
                    className={`py-1 px-2 rounded border font-bold transition-all ${
                      state.network.valves['valve-v-rec']?.actualState === 'OPEN'
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    V-REC: {state.network.valves['valve-v-rec']?.actualState ?? 'CLOSED'}
                  </button>
                  <button
                    onClick={() => toggleValve('valve-v-rel')}
                    className={`py-1 px-2 rounded border font-bold transition-all ${
                      state.network.valves['valve-v-rel']?.actualState === 'OPEN'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    V-REL: {state.network.valves['valve-v-rel']?.actualState ?? 'CLOSED'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
