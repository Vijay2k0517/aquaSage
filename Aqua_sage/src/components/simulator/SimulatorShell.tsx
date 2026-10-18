'use client';

import React, { useState, useEffect } from 'react';
import { SceneLoader } from './SceneLoader';
import { GlobalCameraPreset } from '@/lib/simulator/types';
import { SelectionProvider, useSelection } from './interaction/SelectionProvider';
import { SimulationProvider, useSimulation } from '@/lib/simulator/SimulationContext';
import { SimulationDock } from './interaction/SimulationDock';
import { ComponentInspector } from './interaction/ComponentInspector';
import { BackendAlertsDrawer } from './interaction/BackendAlertsDrawer';
import { BackendSettingsModal } from './interaction/BackendSettingsModal';
import {
  RotateCcw,
  Activity,
  AlertTriangle,
  Sliders,
  Cpu,
  Sparkles,
  Camera,
} from 'lucide-react';

function SimulatorShellContent() {
  const [activePreset, setActivePreset] = useState<GlobalCameraPreset>('isometric');
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { clearSelection } = useSelection();
  const {
    state,
    operatingMode,
    setOperatingMode,
    backendStatus,
    backendAlerts,
    backendLatencyMs,
  } = useSimulation();

  // Close modals or deselect on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAlertsOpen) setIsAlertsOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAlertsOpen, isSettingsOpen, clearSelection]);

  const handleResetCamera = () => {
    clearSelection();
    setActivePreset('isometric');
    setResetTrigger((prev) => prev + 1);
  };

  const handleSelectPreset = (presetKey: GlobalCameraPreset) => {
    clearSelection();
    setActivePreset(presetKey);
    setResetTrigger((prev) => prev + 1);
  };

  const getScenarioLabel = () => {
    switch (state.scenarioId) {
      case 'leak':
        return 'Pipeline Leakage Event';
      case 'elevated_tds':
        return 'Contamination (Elevated TDS)';
      case 'elevated_turbidity':
        return 'Contamination (Elevated Turbidity)';
      case 'combined_contamination':
        return 'Contamination & Diversion';
      case 'low_level':
        return 'Low Tank Depletion';
      case 'normal':
      default:
        return 'Normal Baseline Stream';
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070B14] text-slate-100 font-sans select-none">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* TOP STATUS BAR: Mode, Backend Authority, Scenario & Controls  */}
      {/* ──────────────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-slate-800/80 bg-[#0A0F1D]/95 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0">
        {/* Left: Brand Identity & Hardware Rig Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-950 border border-cyan-400/40 shadow-md shadow-cyan-950/50">
            <Activity className="w-4 h-4 text-cyan-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-wider text-white">
                AQUASAGE
              </span>
              <span className="text-slate-600 font-mono text-xs">/</span>
              <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest font-semibold">
                Hardware Digital Twin
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
              ESP32 DevKit V1 · 2× YF-S201 Flow · HC-SR04 · TDS · Turbidity
            </p>
          </div>
        </div>

        {/* Center: Mode Switcher & Backend Authority Pill */}
        <div className="flex items-center gap-2.5">
          {/* Operating Mode Toggle (Simulation vs Hardware) */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 shadow-inner">
            <button
              onClick={() => setOperatingMode('simulation')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                operatingMode === 'simulation'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Simulation Mode: Generate synthetic faults and telemetry"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simulated Mode</span>
            </button>
            <button
              onClick={() => setOperatingMode('hardware')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                operatingMode === 'hardware'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Hardware Mode: Live stream from physical ESP32 gateway"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>Hardware Mode</span>
            </button>
          </div>

          {/* Backend Authority Connection Pill (Click opens settings modal) */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border transition-all ${
              backendStatus === 'connected'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40'
                : backendStatus === 'offline'
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 hover:bg-rose-900/40'
                : 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/40'
            }`}
            title="Click to view backend authority configuration & ping status"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus === 'connected'
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                  : backendStatus === 'offline'
                  ? 'bg-rose-500 animate-pulse'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="font-semibold">
              {backendStatus === 'connected'
                ? `FastAPI Authority (${backendLatencyMs ?? 0}ms)`
                : backendStatus === 'offline'
                ? 'Backend Authority Pending'
                : 'FastAPI Connecting...'}
            </span>
          </button>

          {/* Current Active Scenario Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-800 text-slate-300 text-xs font-mono">
            <span className="text-slate-500 font-semibold uppercase text-[10px]">Scenario:</span>
            <span
              className={`font-semibold ${
                state.scenarioId === 'leak'
                  ? 'text-rose-400'
                  : state.scenarioId === 'elevated_tds' ||
                    state.scenarioId === 'elevated_turbidity' ||
                    state.scenarioId === 'combined_contamination'
                  ? 'text-amber-400'
                  : state.scenarioId === 'low_level'
                  ? 'text-orange-400'
                  : 'text-cyan-400'
              }`}
            >
              {getScenarioLabel()}
            </span>
          </div>
        </div>

        {/* Right: Camera Presets, Alerts Drawer & Settings Button */}
        <div className="flex items-center gap-2">
          {/* Camera View Presets Quick Selector */}
          <div className="hidden xl:flex items-center gap-1 p-1 rounded-lg bg-slate-900/70 border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-1 px-1.5 text-slate-400 text-[10px] font-semibold uppercase">
              <Camera className="w-3 h-3 text-cyan-400" />
              <span>View:</span>
            </div>
            {(
              [
                { id: 'isometric', label: 'Overview' },
                { id: 'tank', label: 'Tank' },
                { id: 'flow1', label: 'Flow 1' },
                { id: 'quality', label: 'TDS/Turb' },
                { id: 'leak', label: 'Leak Bay' },
                { id: 'filtration', label: 'Filter' },
                { id: 'flow2', label: 'Flow 2' },
                { id: 'enclosure', label: 'ESP32' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectPreset(item.id as GlobalCameraPreset)}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  activePreset === item.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={`Target camera to ${item.label}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Reset Camera View Button */}
          <button
            onClick={handleResetCamera}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-all shadow-sm active:scale-95"
            title="Reset Camera to Overview"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Authoritative Backend Alerts Drawer Button */}
          <button
            onClick={() => setIsAlertsOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all active:scale-95 ${
              backendAlerts.length > 0
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse shadow-md shadow-rose-950/40 font-bold'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
            }`}
            title="View backend-authoritative alarms & detections"
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                backendAlerts.length > 0 ? 'text-rose-400' : 'text-slate-400'
              }`}
            />
            <span>Alerts</span>
            {backendAlerts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {backendAlerts.length}
              </span>
            )}
          </button>

          {/* Settings & Backend Endpoint Configuration Modal */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-all shadow-sm active:scale-95"
            title="Simulator & Backend Settings"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3D VIEWPORT: Hardware Prototype Rig (100% Full Width)         */}
      {/* ──────────────────────────────────────────────────────────── */}
      <main className="relative flex-1 w-full h-[calc(100vh-56px)] overflow-hidden bg-[#070B14]">
        {/* Three.js 3D Scene */}
        <SceneLoader
          activePreset={activePreset}
          resetTrigger={resetTrigger}
          lightingMode="studio"
          enablePostProcessing={true}
          diagnosticMode="pbr"
        />

        {/* Contextual Side Panel: Appears only when user clicks/selects a component */}
        <ComponentInspector />

        {/* Compact Bottom Toolbar (Play/Pause, Scenario, Speed, Transmit) */}
        <SimulationDock />

        {/* Authoritative Backend Alerts Drawer */}
        <BackendAlertsDrawer isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} />

        {/* Backend Authority & Settings Modal */}
        <BackendSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </main>
    </div>
  );
}

export function SimulatorShell() {
  return (
    <SimulationProvider>
      <SelectionProvider>
        <SimulatorShellContent />
      </SelectionProvider>
    </SimulationProvider>
  );
}
