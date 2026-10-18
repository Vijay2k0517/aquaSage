'use client';

import React, { useEffect, useState } from 'react';
import { useSelection } from './SelectionProvider';
import { useSimulation, useTelemetry } from '@/lib/simulator/SimulationContext';
import {
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  Radio,
  Sliders,
  AlertTriangle,
  Send,
  Server,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { ReadinessTier } from '@/lib/simulator/types';

export function ComponentInspector() {
  const { selectedComponent, clearSelection } = useSelection();
  const {
    state,
    operatingMode,
    backendStatus,
    lastTransmittedAt,
    lastBackendResponse,
    backendLatencyMs,
    backendErrorMessage,
    injectLeak,
    clearLeak,
    injectContamination,
    setTankWaterLevel,
    transmitTelemetryNow,
    toggleValve,
    isTransmitting,
  } = useSimulation();

  const telemetry = useTelemetry(selectedComponent?.id || '');
  const [showRawJson, setShowRawJson] = useState(false);

  // Close inspector on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

  if (!selectedComponent) return null;

  const isLeakComponent =
    selectedComponent.id === 'pipe-leak-bay' ||
    selectedComponent.id === 'pipe-main' ||
    selectedComponent.id === 'sensor-fs01' ||
    selectedComponent.id === 'sensor-fs02';

  const isQualityComponent =
    selectedComponent.id === 'sensor-tds01' ||
    selectedComponent.id === 'sensor-turb01' ||
    selectedComponent.id === 'pipe-bypass';

  const isTankComponent =
    selectedComponent.id === 'tank' || selectedComponent.id === 'sensor-us01';

  const isFiltrationComponent =
    selectedComponent.id === 'flt-stage1' ||
    selectedComponent.id === 'valve-v-div' ||
    selectedComponent.id === 'flt-facility' ||
    selectedComponent.id === 'filtration-facility';

  const isLeaking = (state.leakSeverityLpm || 0) > 0.1;

  const renderReadinessBadge = (readiness: ReadinessTier) => {
    switch (readiness) {
      case 'confirmed_hardware':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-semibold">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>CONFIRMED HARDWARE</span>
          </div>
        );
      case 'planned_hardware':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-semibold">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>SIMULATED / PLANNED</span>
          </div>
        );
      case 'virtual_only':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[10px] font-semibold">
            <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>SIMULATED MODEL</span>
          </div>
        );
    }
  };

  return (
    <aside
      className="absolute top-16 right-4 bottom-24 w-88 sm:w-96 z-30 flex flex-col bg-[#090E17]/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden text-slate-100 animate-in slide-in-from-right-8 duration-200 select-none"
      onClick={(e) => e.stopPropagation()}
      aria-label="Component Inspector"
    >
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. INSPECTOR HEADER                                          */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="p-3.5 border-b border-slate-800/80 bg-[#0F172A]/90 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] tracking-widest text-cyan-400 uppercase font-bold">
              {selectedComponent.category}
            </span>
            <span className="text-slate-600 font-mono text-xs">•</span>
            <span className="font-mono text-[10px] text-slate-400">
              {selectedComponent.id}
            </span>
          </div>
          <h2 className="text-sm font-bold text-white tracking-tight truncate">
            {selectedComponent.name}
          </h2>
          <div className="mt-1.5">{renderReadinessBadge(selectedComponent.readiness)}</div>
        </div>

        <button
          onClick={clearSelection}
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700/60 shrink-0"
          title="Close Panel (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. SCROLLABLE INSPECTION BODY                                */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
        {/* TELEMETRY READINGS CARD */}
        {telemetry && (
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>Live Measurement</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-semibold ${
                  operatingMode === 'hardware'
                    ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                    : 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300'
                }`}
              >
                {operatingMode === 'hardware' ? 'Physical' : 'Simulated'}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-mono font-bold text-white tracking-tight">
                {telemetry.formattedValue}
              </span>
              <span className="text-xs font-mono text-slate-400">{telemetry.unit}</span>
            </div>

            {telemetry.notes && (
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/60">
                {telemetry.notes}
              </p>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 3. INTERACTIVE 3D PHYSICAL EVENT INPUT CONTROLS             */}
        {/* ──────────────────────────────────────────────────────────── */}
        {operatingMode === 'simulation' ? (
          <div className="p-3 rounded-xl bg-[#0C1322] border border-cyan-950/80 space-y-3">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>3D Event Simulation Controls</span>
            </div>

            {/* A. PIPE LEAK CONTROLS */}
            {isLeakComponent && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Differential Pipe Leak:</span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      isLeaking ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {isLeaking ? `${state.leakSeverityLpm?.toFixed(1)} L/min Deficit` : 'Intact (0.0 L/min)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => injectLeak(5.5, 0.5)}
                    className={`py-1.5 px-2.5 rounded-lg font-mono font-semibold text-xs border transition-all ${
                      isLeaking
                        ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 shadow-md shadow-rose-950/50'
                        : 'bg-rose-950/30 hover:bg-rose-900/50 border-rose-800 text-rose-300'
                    }`}
                  >
                    {isLeaking ? 'Leak Active' : 'Inject Leak (5.5 L/m)'}
                  </button>

                  <button
                    onClick={clearLeak}
                    disabled={!isLeaking}
                    className="py-1.5 px-2.5 rounded-lg font-mono font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition-all"
                  >
                    Clear Leak
                  </button>
                </div>

                {isLeaking && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Leak Loss Rate</span>
                      <span className="font-mono text-cyan-300">{state.leakSeverityLpm?.toFixed(1)} L/min</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="15.0"
                      step="0.5"
                      value={state.leakSeverityLpm || 5.5}
                      onChange={(e) => injectLeak(parseFloat(e.target.value), state.leakLocationNorm)}
                      className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}

            {/* B. WATER QUALITY CONTAMINATION CONTROLS */}
            {isQualityComponent && (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>TDS (Total Dissolved Solids)</span>
                    <span className="font-mono font-bold text-cyan-300">{state.preTreatmentTds} ppm</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1800"
                    step="50"
                    value={state.preTreatmentTds || 180}
                    onChange={(e) => injectContamination(parseInt(e.target.value), state.preTreatmentTurbidity)}
                    className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>Turbidity Optical Clarity</span>
                    <span className="font-mono font-bold text-amber-300">
                      {state.preTreatmentTurbidity.toFixed(1)} NTU
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="60.0"
                    step="0.5"
                    value={state.preTreatmentTurbidity || 1.5}
                    onChange={(e) => injectContamination(state.preTreatmentTds, parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* Preset injection buttons */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={() => injectContamination(180, 1.5)}
                    className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700"
                  >
                    Nominal (180 ppm, 1.5 NTU)
                  </button>
                  <button
                    onClick={() => injectContamination(850, 22.0)}
                    className="py-1 px-2 rounded bg-amber-950/50 hover:bg-amber-900/60 text-[10px] text-amber-300 border border-amber-800"
                  >
                    Contaminated (850 ppm, 22 NTU)
                  </button>
                </div>
              </div>
            )}

            {/* C. TANK WATER LEVEL CONTROLS */}
            {isTankComponent && (
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Tank Level & HC-SR04 Standoff</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {state.tankLevelPercentage.toFixed(0)}% (Dist: {(100 - state.tankLevelPercentage).toFixed(1)} cm)
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={state.tankLevelPercentage || 75}
                  onChange={(e) => setTankWaterLevel(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            )}

            {/* D. FILTRATION & DIVERSION CONTROLS */}
            {isFiltrationComponent && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Diversion Valve V-DIV:</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {state.network.valves['valve-v-div']?.actualState || 'CLOSED'}
                  </span>
                </div>
                <button
                  onClick={() => toggleValve('valve-v-div')}
                  className="w-full py-1.5 rounded-lg font-mono text-xs bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300"
                >
                  Toggle V-DIV Actuator
                </button>
              </div>
            )}

            {/* Manual Transmit Button */}
            <button
              onClick={transmitTelemetryNow}
              disabled={isTransmitting}
              className="w-full mt-2 py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-950/40 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTransmitting ? 'Transmitting to FastAPI...' : 'Send Telemetry Event Now'}</span>
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] font-bold uppercase">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hardware Mode Active</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Receiving live measurements from physical ESP32 prototype. Synthetic fault injection is locked to preserve live telemetry integrity.
            </p>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 4. AUTHORITATIVE FASTAPI BACKEND ASSESSMENT CARD             */}
        {/* ──────────────────────────────────────────────────────────── */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>FastAPI Backend Authority</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'connected'
                    ? 'bg-emerald-400'
                    : backendStatus === 'pending'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-rose-400'
                }`}
              />
              <span className="font-mono text-[10px] uppercase font-bold text-slate-400">
                {backendStatus === 'connected' ? 'HTTP 200' : backendStatus === 'pending' ? 'Pending' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Backend Status Description */}
          {backendStatus === 'connected' && lastBackendResponse ? (
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              {/* Returned computed results */}
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase">Leak Assessment</span>
                  <span
                    className={`font-bold ${
                      lastBackendResponse.assessment?.leak_detected ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {lastBackendResponse.assessment?.leak_detected ? 'LEAK DETECTED' : 'INTACT'}
                  </span>
                </div>

                <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase">Quality Status</span>
                  <span
                    className={`font-bold ${
                      lastBackendResponse.assessment?.water_quality === 'CONTAMINATED'
                        ? 'text-rose-400'
                        : lastBackendResponse.assessment?.water_quality === 'WARNING'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {lastBackendResponse.assessment?.water_quality || 'SAFE'}
                  </span>
                </div>
              </div>

              {lastBackendResponse.assessment?.explanation && (
                <p className="text-[11px] text-slate-300 bg-slate-950/50 p-2 rounded border border-slate-800/80 leading-relaxed font-sans">
                  {lastBackendResponse.assessment.explanation}
                </p>
              )}

              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>Latency: {backendLatencyMs}ms</span>
                <span>
                  {lastTransmittedAt ? `Updated ${new Date(lastTransmittedAt).toLocaleTimeString()}` : ''}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
              <div className="flex items-center gap-1 text-amber-400 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Backend Authority Pending</span>
              </div>
              <p className="leading-relaxed">
                {backendErrorMessage ||
                  'The FastAPI backend at http://localhost:8000/api/v1/sensor-data is currently unreachable. Start your Python FastAPI server to enable live backend-computed validation.'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Source of truth: Frontend does not hardcode false positives when backend is offline.
              </p>
            </div>
          )}

          {/* Raw JSON Payload Accordion */}
          <div className="pt-1">
            <button
              onClick={() => setShowRawJson((prev) => !prev)}
              className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 hover:text-cyan-300 py-1 transition-colors"
            >
              <span>Inspect Telemetry Payload (JSON)</span>
              {showRawJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showRawJson && (
              <pre className="mt-1 p-2 rounded bg-black/60 border border-slate-800 font-mono text-[9px] text-cyan-300 overflow-x-auto max-h-40 leading-relaxed select-text">
                {JSON.stringify(lastBackendResponse || { note: 'Awaiting backend response' }, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* 5. HARDWARE SPECIFICATION METADATA                          */}
        {/* ──────────────────────────────────────────────────────────── */}
        {selectedComponent.metadata && (
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Hardware Specification</span>
            </div>
            <div className="space-y-1.5">
              {Object.entries(selectedComponent.metadata).map(([key, val]) => (
                <div key={key} className="flex justify-between items-start gap-2 text-[11px]">
                  <span className="text-slate-400 shrink-0">{key}:</span>
                  <span className="text-slate-200 font-mono text-right">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
