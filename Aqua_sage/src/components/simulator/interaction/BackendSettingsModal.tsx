'use client';

import React, { useState } from 'react';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import { X, Server, RefreshCw } from 'lucide-react';
import { DEFAULT_ENDPOINT } from '@/lib/api/backendClient';

interface BackendSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackendSettingsModal({ isOpen, onClose }: BackendSettingsModalProps) {
  const {
    backendUrl,
    setBackendUrl,
    backendStatus,
    backendLatencyMs,
    autoTransmit,
    setAutoTransmit,
    transmitTelemetryNow,
    isTransmitting,
  } = useSimulation();

  const [inputUrl, setInputUrl] = useState(backendUrl);

  if (!isOpen) return null;

  const handleSave = () => {
    setBackendUrl(inputUrl.trim() || DEFAULT_ENDPOINT);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0F172A] border border-slate-700 rounded-2xl shadow-2xl p-5 text-slate-100 space-y-4 select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <h2 className="font-bold text-sm text-white">Advanced Simulator Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">FastAPI Backend Endpoint URL</label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="e.g. /api/v1/sensor-data or http://localhost:8000"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Default: <code className="text-cyan-300">{DEFAULT_ENDPOINT}</code> (proxies to http://localhost:8000)
            </span>
          </div>

          {/* Connection Test & Health */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  backendStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              <span className="font-mono text-[11px] font-semibold text-slate-200">
                {backendStatus === 'connected'
                  ? `Connected (${backendLatencyMs}ms)`
                  : 'Backend Offline'}
              </span>
            </div>

            <button
              onClick={transmitTelemetryNow}
              disabled={isTransmitting}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono text-[10px] flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isTransmitting ? 'animate-spin' : ''}`} />
              <span>Test Ping</span>
            </button>
          </div>

          {/* Auto-Transmit Checkbox */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/80">
            <div>
              <span className="font-semibold text-slate-200 block">Periodic Telemetry Transmission</span>
              <span className="text-[10px] text-slate-400">Transmits sensor readings to backend every 3 seconds</span>
            </div>
            <input
              type="checkbox"
              checked={autoTransmit}
              onChange={(e) => setAutoTransmit(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold shadow-md shadow-cyan-950/50"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
}
