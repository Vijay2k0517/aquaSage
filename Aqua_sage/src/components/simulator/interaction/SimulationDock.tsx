'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import { ScenarioId } from '@/lib/simulator/telemetryTypes';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Send,
  Activity,
} from 'lucide-react';

const PROTOTYPE_SCENARIOS: { id: ScenarioId; label: string; icon: string }[] = [
  { id: 'normal', label: 'Normal Operation (18.0 L/m, Clean)', icon: '●' },
  { id: 'leak', label: 'Pipeline Leak (Flow 1 > Flow 2)', icon: '▲' },
  { id: 'elevated_tds', label: 'Contamination: Elevated TDS (850 ppm)', icon: '◆' },
  { id: 'elevated_turbidity', label: 'Contamination: Elevated Turbidity (22 NTU)', icon: '◆' },
  { id: 'combined_contamination', label: 'Severe Contamination (TDS + Turbidity)', icon: '✖' },
  { id: 'low_level', label: 'Low Reservoir Level (15% / 85cm Dist)', icon: '▼' },
];

export function SimulationDock() {
  const {
    state,
    operatingMode,
    togglePlayPause,
    step,
    reset,
    setScenario,
    setSpeedMultiplier,
    transmitTelemetryNow,
    isTransmitting,
  } = useSimulation();

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 max-w-[calc(100vw-32px)] pointer-events-none select-none">
      {/* COMPACT BOTTOM TOOLBAR */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl bg-[#090E17]/95 border border-slate-800 shadow-2xl backdrop-blur-xl text-xs font-mono">
        {/* 1. SCENARIO SELECTOR */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700/70 text-slate-300">
          <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-[10px] uppercase font-bold text-slate-400 hidden sm:inline">
            Scenario:
          </span>
          <select
            value={state.scenarioId}
            onChange={(e) => setScenario(e.target.value as ScenarioId)}
            disabled={operatingMode === 'hardware'}
            className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer pr-1 disabled:opacity-50"
          >
            {PROTOTYPE_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-slate-800" />

        {/* 2. PLAY / PAUSE / STEP / RESET */}
        <div className="flex items-center gap-1">
          <button
            onClick={togglePlayPause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              state.isRunning
                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300 shadow-sm'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300 shadow-sm'
            }`}
            title={state.isRunning ? 'Pause Simulation' : 'Resume Simulation'}
          >
            {state.isRunning ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{state.isRunning ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={() => step(1.0)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 transition-all active:scale-95"
            title="Step Forward +1s"
          >
            <StepForward className="w-3.5 h-3.5 text-cyan-400" />
            <span>+1s</span>
          </button>

          <button
            onClick={reset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-400 hover:text-white transition-all active:scale-95"
            title="Reset Scenario to Normal Baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-slate-800" />

        {/* 3. SIMULATION SPEED */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
          {[1, 2, 5].map((speed) => (
            <button
              key={speed}
              onClick={() => setSpeedMultiplier(speed)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                state.speedMultiplier === speed
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="hidden lg:block h-5 w-px bg-slate-800" />

        {/* 4. DISPATCH TELEMETRY NOW BUTTON */}
        <button
          onClick={transmitTelemetryNow}
          disabled={isTransmitting}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 transition-all font-semibold disabled:opacity-50"
          title="Transmit live sensor values to FastAPI backend immediately"
        >
          <Send className={`w-3 h-3 ${isTransmitting ? 'animate-pulse text-cyan-200' : ''}`} />
          <span>{isTransmitting ? 'Sending...' : 'Transmit Telemetry'}</span>
        </button>

        {/* Live Flow Rate KPI */}
        <div className="hidden xl:flex items-center gap-2 pl-1 text-[11px] text-slate-400 border-l border-slate-800">
          <span>Flow 1: <strong className="text-white">{(state.readings['sensor-fs01']?.value ?? 0).toFixed(1)} L/m</strong></span>
          <span>Flow 2: <strong className="text-white">{(state.readings['sensor-fs02']?.value ?? 0).toFixed(1)} L/m</strong></span>
          {state.leakSeverityLpm > 0.1 && (
            <span className="text-rose-400 font-bold">(Δ: -{state.leakSeverityLpm.toFixed(1)} L/m)</span>
          )}
        </div>
      </div>
    </div>
  );
}
