'use client';

import React, { useState, useMemo } from 'react';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import {
  FileText,
  X,
  Search,
  AlertTriangle,
  AlertOctagon,
  Info,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { EventSeverity } from '@/lib/simulator/eventLogger';

export function EventLogDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | EventSeverity>('all');
  const { state } = useSimulation();

  // Filter events based on search query and severity
  const filteredEvents = useMemo(() => {
    return state.events.filter((ev) => {
      const matchesSearch =
        ev.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.componentId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSeverity = severityFilter === 'all' || ev.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [state.events, searchQuery, severityFilter]);

  // Icon mapping for event severity
  const getSeverityBadge = (severity: EventSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            CRITICAL
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            WARNING
          </span>
        );
      case 'info':
      default:
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Info className="w-3 h-3 text-cyan-400" />
            EVENT
          </span>
        );
    }
  };

  return (
    <>
      {/* Trigger Button in Header / Dock */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-all shadow-sm active:scale-95"
        title="Open Simulation Event Audit History"
        aria-label="Open Event Audit Log"
      >
        <FileText className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden md:inline">Audit Log</span>
        {state.events.length > 0 && (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-bold">
            {state.events.length}
          </span>
        )}
      </button>

      {/* Drawer Overlay & Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl h-full bg-[#0F172A] border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                  <FileText className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                    Deterministic Event Audit Trail
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-normal border border-slate-700">
                      {state.events.length} records
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Chronological audit log of state changes, valve actions, and hydraulic alerts
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close Audit Log"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scientific Notice Banner */}
            <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-[11px] text-amber-200 font-sans">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>SIMULATED AUDIT LOG:</strong> All events are generated by the deterministic engine. This does not represent physical hardware actuation on a live public water network.
              </span>
            </div>

            {/* Filter and Search Controls */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search events, components, valves..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-sans"
                />
              </div>

              <div className="flex items-center gap-1 text-xs font-mono">
                {(['all', 'info', 'warning', 'critical'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2 py-1 rounded-md text-[11px] capitalize transition-all ${
                      severityFilter === sev
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Event List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredEvents.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 font-sans text-xs">
                  <Clock className="w-8 h-8 text-slate-600 mb-2 stroke-1" />
                  <p>No telemetry events matching current filter.</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Trigger a scenario, fault, or step the simulation forward.
                  </p>
                </div>
              ) : (
                filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-lg bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all font-mono text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40 text-[11px]">
                          {ev.formattedTime}
                        </span>
                        {getSeverityBadge(ev.severity)}
                        <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                          {ev.category}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-400 bg-slate-800/70 px-1.5 py-0.5 rounded border border-slate-700/60">
                        {ev.componentId}
                      </span>
                    </div>

                    <p className="text-slate-200 font-sans text-xs leading-relaxed pl-0.5">
                      {ev.description}
                    </p>

                    <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Source: {ev.source}</span>
                      <span className="tabular-nums">Sim Clock: {ev.timestampSec.toFixed(1)}s</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Showing {filteredEvents.length} of {state.events.length} events</span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSeverityFilter('all');
                }}
                className="text-cyan-400 hover:text-cyan-300 hover:underline"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
