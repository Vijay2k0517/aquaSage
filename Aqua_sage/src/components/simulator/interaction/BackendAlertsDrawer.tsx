'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import { useSelection } from './SelectionProvider';
import {
  X,
  AlertTriangle,
  AlertOctagon,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { BackendAlert } from '@/lib/simulator/hardwareContract';

interface BackendAlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Backend Authoritative Alerts Drawer
 * - Displays active alarms returned by the FastAPI backend
 * - Clicking an alert focuses camera on the affected component and selects it
 */
export function BackendAlertsDrawer({ isOpen, onClose }: BackendAlertsDrawerProps) {
  const { backendAlerts, backendStatus } = useSimulation();
  const { selectComponent } = useSelection();

  if (!isOpen) return null;

  const handleSelectAlert = (alert: BackendAlert) => {
    // Map backend component code to 3D component ID
    let targetId = alert.component;
    if (alert.code.includes('LEAK')) targetId = 'pipe-leak-bay';
    else if (alert.code.includes('TDS')) targetId = 'sensor-tds01';
    else if (alert.code.includes('TURB')) targetId = 'sensor-turb01';
    else if (alert.code.includes('LEVEL') || alert.code.includes('TANK')) targetId = 'tank';
    else if (alert.code.includes('FLOW_1')) targetId = 'sensor-fs01';
    else if (alert.code.includes('FLOW_2')) targetId = 'sensor-fs02';

    selectComponent(targetId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-[#0A0F1D] border-l border-slate-800 shadow-2xl flex flex-col text-slate-100 animate-in slide-in-from-right duration-300 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-[#0F172A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white tracking-wide">
                Backend Authority Alerts
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {backendAlerts.length} active event{backendAlerts.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {backendStatus !== 'connected' && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Backend Offline</span>
                <span className="text-[11px] text-amber-400/90 leading-relaxed block mt-0.5">
                  The FastAPI backend is not connected. Alerts displayed here are authoritatively computed and returned by the backend.
                </span>
              </div>
            </div>
          )}

          {backendAlerts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mb-3" />
              <p className="font-mono text-xs text-slate-300 font-semibold">ALL PARAMETERS NOMINAL</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                No active threshold infractions or differential flow deficits reported by backend.
              </p>
            </div>
          ) : (
            backendAlerts.map((alert, idx) => (
              <div
                key={alert.id || idx}
                onClick={() => handleSelectAlert(alert)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] flex flex-col gap-2 ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-rose-950/30 hover:bg-rose-950/50 border-rose-800/70 text-rose-200'
                    : alert.severity === 'WARNING'
                    ? 'bg-amber-950/30 hover:bg-amber-950/50 border-amber-800/70 text-amber-200'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-700 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase">
                    {alert.severity === 'CRITICAL' ? (
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{alert.code}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-slate-700/60 text-slate-300">
                    {alert.component}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-300 font-sans">
                  {alert.message}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-cyan-400 font-mono">
                  <span>Click to Focus in 3D</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
