'use client';

import React from 'react';
import { useSimulation } from '@/lib/simulator/SimulationContext';
import { useSelection } from './SelectionProvider';
import { SCENARIO_LIST } from '@/lib/simulator/scenarios';
import { COMPONENT_REGISTRY } from '../componentRegistry';
import {
  Activity,
  Droplets,
  Gauge,
  Radio,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { ReadinessTier } from '@/lib/simulator/types';

interface SimulatorSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// Grouped equipment items mapped to COMPONENT_REGISTRY IDs
interface EquipmentGroup {
  groupName: string;
  icon: React.ReactNode;
  componentIds: string[];
}

const EQUIPMENT_GROUPS: EquipmentGroup[] = [
  {
    groupName: 'Water Tank',
    icon: <Droplets className="w-3.5 h-3.5 text-cyan-400" />,
    componentIds: ['tank'],
  },
  {
    groupName: 'Pump and Motor',
    icon: <Activity className="w-3.5 h-3.5 text-blue-400" />,
    componentIds: ['pump', 'motor'],
  },
  {
    groupName: 'Main and Bypass Pipes',
    icon: <Layers className="w-3.5 h-3.5 text-slate-400" />,
    componentIds: ['pipe-main', 'pipe-bypass'],
  },
  {
    groupName: 'Valves',
    icon: <Gauge className="w-3.5 h-3.5 text-amber-400" />,
    componentIds: ['valve-v1', 'valve-v2'],
  },
  {
    groupName: 'Level and Flow Sensors',
    icon: <Radio className="w-3.5 h-3.5 text-emerald-400" />,
    componentIds: ['sensor-us01', 'sensor-fs01'],
  },
  {
    groupName: 'Pressure Sensors',
    icon: <Gauge className="w-3.5 h-3.5 text-sky-400" />,
    componentIds: ['sensor-pt01', 'sensor-pt02'],
  },
  {
    groupName: 'TDS and Turbidity Sensors',
    icon: <Sliders className="w-3.5 h-3.5 text-teal-400" />,
    componentIds: ['sensor-tds01', 'sensor-turb01'],
  },
  {
    groupName: 'ESP32 Controller',
    icon: <Cpu className="w-3.5 h-3.5 text-purple-400" />,
    componentIds: ['controller-esp32'],
  },
  {
    groupName: 'Village Distribution Zones',
    icon: <Droplets className="w-3.5 h-3.5 text-cyan-400" />,
    componentIds: ['zone-a', 'zone-b', 'zone-c', 'sensor-fs02', 'valve-v-dist'],
  },
  {
    groupName: 'Automated Filtration Facility',
    icon: <Sliders className="w-3.5 h-3.5 text-teal-400" />,
    componentIds: [
      'valve-v-div',
      'flt-stage1',
      'flt-stage2',
      'sensor-fs-out',
      'sensor-tds-post',
      'sensor-turb-post',
      'valve-v-rec',
      'valve-v-rel',
    ],
  },
];

export function SimulatorSidebar({ isCollapsed, onToggleCollapse }: SimulatorSidebarProps) {
  const { state, setScenario } = useSimulation();
  const { selectedComponentId, selectComponent, setHoveredComponent } = useSelection();

  // Helper for hardware readiness badge
  const renderReadinessDot = (readiness: ReadinessTier) => {
    switch (readiness) {
      case 'confirmed_hardware':
        return (
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
            title="Confirmed Hardware"
          />
        );
      case 'planned_hardware':
        return (
          <span
            className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
            title="Planned Hardware"
          />
        );
      case 'virtual_only':
        return (
          <span
            className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 shrink-0"
            title="Virtual Model"
          />
        );
    }
  };

  // Helper to retrieve live telemetry reading for an equipment item
  const getLiveTelemetryString = (id: string): string | null => {
    if (id === 'tank') {
      return `${(state.tankWaterHeight * 100).toFixed(0)}cm / ${state.tankVolumeLitres.toFixed(0)}L`;
    }
    const reading = state.readings[id];
    if (reading) {
      if (reading.validity === 'valid') {
        return reading.formattedValue;
      }
      if (reading.validity === 'unavailable') {
        return 'UNAVAIL';
      }
      return 'FAULT';
    }
    return null;
  };

  // Helper for telemetry alarm severity
  const getAlarmSeverity = (id: string): 'normal' | 'warning' | 'critical' => {
    const reading = state.readings[id];
    if (reading) {
      return reading.severity === 'critical'
        ? 'critical'
        : reading.severity === 'warning'
        ? 'warning'
        : 'normal';
    }
    return 'normal';
  };

  if (isCollapsed) {
    return (
      <div className="relative z-10">
        <button
          onClick={onToggleCollapse}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#0F172A]/90 hover:bg-[#1E293B] border border-slate-800 text-slate-300 hover:text-white backdrop-blur-md shadow-xl text-xs font-mono transition-all group"
          title="Expand Scenarios & Equipment Sidebar"
          aria-label="Expand Sidebar"
        >
          <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline font-semibold">Sidebar</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      className="relative z-10 w-64 md:w-72 h-full flex flex-col bg-[#0F172A]/95 border-r border-slate-800/90 backdrop-blur-md shadow-2xl select-none overflow-hidden shrink-0 transition-all duration-200"
      aria-label="Scenarios and Equipment Explorer"
    >
      {/* ──────────────────────────────────────────────────────────── */}
      {/* SIDEBAR HEADER                                               */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="h-11 px-3.5 border-b border-slate-800/80 bg-[#162032]/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
            System Explorer
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          title="Collapse Sidebar"
          aria-label="Collapse Sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* SCROLLABLE SECTIONS                                          */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70 p-2 space-y-3">
        {/* 1. SCENARIOS SECTION */}
        <section className="pt-1">
          <div className="px-2 pb-1.5 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-cyan-400" />
              Scenarios
            </span>
            <span className="text-[10px] font-mono text-cyan-400 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50">
              7 Deterministic
            </span>
          </div>

          <div className="space-y-1 mt-1">
            {SCENARIO_LIST.map((scen) => {
              const isActive = scen.id === state.scenarioId;
              return (
                <button
                  key={scen.id}
                  onClick={() => setScenario(scen.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md transition-all flex items-center justify-between group text-xs font-sans ${
                    isActive
                      ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 shadow-sm'
                      : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                  }`}
                  title={scen.description}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        scen.isFaultScenario ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span
                      className={`truncate text-[11px] font-medium ${
                        isActive ? 'text-white font-semibold' : 'text-slate-300'
                      }`}
                    >
                      {scen.shortLabel}
                    </span>
                  </div>

                  {scen.isFaultScenario && (
                    <span className="text-[8px] font-mono uppercase tracking-wider px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 ml-1">
                      Fault
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. EQUIPMENT SECTION */}
        <section className="pt-2">
          <div className="px-2 pb-1.5 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-cyan-400" />
              Equipment
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Click to Inspect
            </span>
          </div>

          <div className="space-y-2 mt-1">
            {EQUIPMENT_GROUPS.map((group) => (
              <div key={group.groupName} className="space-y-0.5">
                <div className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1 font-semibold">
                  {group.icon}
                  <span>{group.groupName}</span>
                </div>

                {group.componentIds.map((cid) => {
                  const comp = COMPONENT_REGISTRY[cid];
                  if (!comp) return null;

                  const isSelected = selectedComponentId === cid;
                  const liveTelemetry = getLiveTelemetryString(cid);
                  const severity = getAlarmSeverity(cid);

                  return (
                    <button
                      key={cid}
                      onClick={() => selectComponent(cid)}
                      onMouseEnter={() => setHoveredComponent(cid)}
                      onMouseLeave={() => setHoveredComponent(null)}
                      className={`w-full text-left px-2 py-1.5 rounded-md transition-all flex items-center justify-between group text-xs ${
                        isSelected
                          ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 font-medium'
                          : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                      }`}
                      title={`${comp.name} (${comp.id}) — Click to focus camera & inspect`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        {renderReadinessDot(comp.readiness)}
                        <span
                          className={`truncate text-[11px] ${
                            isSelected ? 'text-white font-semibold' : 'text-slate-300'
                          }`}
                        >
                          {comp.shortName}
                        </span>
                      </div>

                      {/* Live Telemetry Value or Status Indicator */}
                      {liveTelemetry ? (
                        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                          {severity === 'critical' ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          ) : severity === 'warning' ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          ) : null}
                          <span
                            className={`tabular-nums ${
                              severity === 'critical'
                                ? 'text-rose-400 font-bold'
                                : severity === 'warning'
                                ? 'text-amber-300 font-semibold'
                                : isSelected
                                ? 'text-cyan-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {liveTelemetry}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-mono text-slate-400 uppercase">
                          {comp.category}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* SIDEBAR FOOTER: HARDWARE READINESS LEGEND                   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="p-2.5 border-t border-slate-800/80 bg-[#162032]/60 text-[10px] font-mono text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Planned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Virtual
          </span>
        </div>
      </div>
    </aside>
  );
}
