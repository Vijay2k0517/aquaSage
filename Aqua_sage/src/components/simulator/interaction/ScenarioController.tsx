'use client';

import React, { useState } from 'react';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import { SCENARIO_LIST } from '@/lib/simulator/scenarios';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Activity,
  AlertTriangle,
  Clock,
  Layers,
  ChevronDown,
  Info,
  Droplets,
} from 'lucide-react';

export function ScenarioController() {
  const { state, setScenario, togglePlayPause, step, reset } = useSimulation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const activeScenario = SCENARIO_LIST.find((s) => s.id === state.scenarioId) || SCENARIO_LIST[0];

  return (
    <div
      className="relative z-10 select-none"
      onClick={(e) => e.stopPropagation()}
      aria-label="Simulation Scenario Controller"
    >
      {/* Floating Industrial Scenario Controller Ribbon */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-slate-950/90 border border-slate-800 shadow-2xl backdrop-blur-md text-xs font-mono">
        {/* Scenario Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
              activeScenario.isFaultScenario
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/50'
                : 'bg-slate-900/90 border-slate-700/70 text-slate-200 hover:bg-slate-800'
            }`}
            title="Select Deterministic Simulation Scenario"
            aria-expanded={isDropdownOpen}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">
                Scenario
              </span>
              <span className="font-semibold text-xs tracking-tight text-white flex items-center gap-1.5">
                {activeScenario.shortLabel}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </span>
            </div>
          </button>

          {/* Scenario Menu Popover */}
          {isDropdownOpen && (
            <div className="absolute top-12 left-0 w-80 max-h-96 overflow-y-auto rounded-xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-md p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-900">
                Deterministic Scenarios
              </div>

              {SCENARIO_LIST.map((scen) => {
                const isSelected = scen.id === state.scenarioId;
                return (
                  <button
                    key={scen.id}
                    onClick={() => {
                      setScenario(scen.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition-all flex flex-col gap-0.5 ${
                      isSelected
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-200'
                        : 'hover:bg-slate-900 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            scen.isFaultScenario ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                        />
                        {scen.shortLabel}
                      </span>
                      {scen.isFaultScenario && (
                        <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                          Injected Fault
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                      {scen.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-slate-800 mx-0.5 hidden sm:block" />

        {/* Playback Controls (Play/Pause, Step, Reset) */}
        <div className="flex items-center gap-1">
          <button
            onClick={togglePlayPause}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              state.isRunning
                ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
            }`}
            title={state.isRunning ? 'Pause Simulation' : 'Resume Simulation'}
          >
            {state.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{state.isRunning ? 'Pause' : 'Resume'}</span>
          </button>

          <button
            onClick={() => step(1.0)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all"
            title="Step Forward Exactly 1.0 Second"
          >
            <StepForward className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">+1s</span>
          </button>

          <button
            onClick={reset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all"
            title="Reset Scenario to Fixed Initial Baseline"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-slate-800 mx-0.5 hidden md:block" />

        {/* Real-Time Mathematical Telemetry Badges */}
        <div className="hidden lg:flex items-center gap-3 px-2 py-0.5 text-[11px] text-slate-300">
          {/* Simulation Time / Step */}
          <div className="flex items-center gap-1.5" title="Elapsed simulation time">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400">T:</span>
            <span className="font-bold text-white tabular-nums">{state.elapsedTimeSec.toFixed(0)}s</span>
            <span className="text-slate-400 text-[10px]">({state.stepCount} steps)</span>
          </div>

          {/* Calculated Reservoir Height & Volume */}
          <div className="flex items-center gap-1.5" title="Calibrated Reservoir Liquid Height and Volume">
            <Droplets className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400">Tank:</span>
            <span className="font-bold text-cyan-300 tabular-nums">
              {(state.tankWaterHeight * 100).toFixed(1)} cm
            </span>
            <span className="text-slate-400 text-[10px] tabular-nums">
              ({state.tankVolumeLitres.toFixed(1)} L / {state.tankLevelPercentage}%)
            </span>
          </div>

          {/* Mass Balance Flow Deficit */}
          <div className="flex items-center gap-1.5" title="Net Mass Balance Flow Rate">
            <Layers className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400">Net Flow:</span>
            <span
              className={`font-bold tabular-nums ${
                state.netFlowRateLpm < 0
                  ? 'text-amber-400'
                  : state.netFlowRateLpm > 0
                  ? 'text-cyan-300'
                  : 'text-emerald-400'
              }`}
            >
              {state.netFlowRateLpm > 0 ? `+${state.netFlowRateLpm}` : state.netFlowRateLpm} L/min
            </span>
          </div>
        </div>
      </div>

      {/* Advisory & Injected Fault Notification Banner */}
      {(state.activeFaults.length > 0 || state.scientificAdvisory) && (
        <div className="mt-2 max-w-xl p-2 rounded-lg bg-amber-950/80 border border-amber-500/40 backdrop-blur-md text-amber-200 text-xs shadow-xl space-y-1">
          {state.activeFaults.map((fault, i) => (
            <div key={i} className="flex items-center gap-1.5 font-bold font-mono text-[11px] text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>SIMULATED FAULT: {fault}</span>
            </div>
          ))}
          {state.scientificAdvisory && (
            <div className="flex items-start gap-1.5 text-[10px] text-amber-200/90 font-sans leading-relaxed pt-0.5 border-t border-amber-500/20">
              <Info className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <p>{state.scientificAdvisory}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
