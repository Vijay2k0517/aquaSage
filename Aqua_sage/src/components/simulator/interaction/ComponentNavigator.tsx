'use client';

import React, { useState } from 'react';
import { useSelection } from './SelectionProvider';
import { COMPONENT_LIST } from '../componentRegistry';
import {
  ListTree,
  ChevronDown,
  ChevronRight,
  Activity,
  Cpu,
  Droplets,
  Gauge,
  Radio,
  Search,
} from 'lucide-react';
import { ComponentCategory, ReadinessTier } from '@/lib/simulator/types';

export function ComponentNavigator() {
  const { selectedComponentId, selectComponent, setHoveredComponent } = useSelection();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const categories: { key: ComponentCategory; label: string; icon: React.ReactNode }[] = [
    { key: 'tank', label: 'Storage Reservoir', icon: <Droplets className="w-3.5 h-3.5 text-cyan-400" /> },
    { key: 'pump', label: 'Pumps & Motors', icon: <Activity className="w-3.5 h-3.5 text-blue-400" /> },
    { key: 'valve', label: 'Valves & Flow Controls', icon: <Gauge className="w-3.5 h-3.5 text-amber-400" /> },
    { key: 'sensor', label: 'Instrumentation & Sensors', icon: <Radio className="w-3.5 h-3.5 text-emerald-400" /> },
    { key: 'controller', label: 'Edge Controller', icon: <Cpu className="w-3.5 h-3.5 text-emerald-400" /> },
    { key: 'pipeline', label: 'Pipeline Segments', icon: <ListTree className="w-3.5 h-3.5 text-slate-400" /> },
  ];

  const filteredComponents = COMPONENT_LIST.filter((comp) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      comp.name.toLowerCase().includes(q) ||
      comp.id.toLowerCase().includes(q) ||
      comp.shortName.toLowerCase().includes(q)
    );
  });

  const getReadinessDot = (readiness: ReadinessTier) => {
    switch (readiness) {
      case 'confirmed_hardware':
        return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Confirmed Hardware" />;
      case 'planned_hardware':
        return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Planned Hardware" />;
      case 'virtual_only':
        return <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" title="Virtual Only" />;
    }
  };

  return (
    <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
      {/* Toggle Button in Top Ribbon */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono border transition-all ${
          isOpen
            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-950/30'
            : 'bg-slate-900/80 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:text-white'
        }`}
        title="Toggle Component Navigator"
        aria-expanded={isOpen}
      >
        <ListTree className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline font-semibold">Navigator</span>
        {isOpen ? <ChevronDown className="w-3 h-3 ml-0.5" /> : <ChevronRight className="w-3 h-3 ml-0.5" />}
      </button>

      {/* Floating Navigator Popover Drawer */}
      {isOpen && (
        <div className="absolute top-10 left-0 w-80 max-h-[75vh] flex flex-col rounded-xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Navigator Header & Search Bar */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-900/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                <ListTree className="w-3.5 h-3.5 text-cyan-400" />
                Component Explorer
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {filteredComponents.length} Assets
              </span>
            </div>

            {/* Quick Filter Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter components (e.g. flow, tank)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500/60"
              />
            </div>
          </div>

          {/* Grouped Component List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {categories.map((cat) => {
              const items = filteredComponents.filter((c) => c.category === cat.key);
              if (items.length === 0) return null;

              return (
                <div key={cat.key} className="space-y-1">
                  <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-b border-slate-900">
                    {cat.icon}
                    <span>{cat.label}</span>
                  </div>

                  <div className="space-y-0.5">
                    {items.map((comp) => {
                      const isSelected = selectedComponentId === comp.id;
                      return (
                        <button
                          key={comp.id}
                          onClick={() => {
                            selectComponent(comp.id);
                          }}
                          onMouseEnter={() => setHoveredComponent(comp.id)}
                          onMouseLeave={() => setHoveredComponent(null)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-mono transition-all ${
                            isSelected
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm font-semibold'
                              : 'text-slate-300 hover:bg-slate-900/80 hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            {getReadinessDot(comp.readiness)}
                            <span className="truncate">{comp.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                            {comp.unit ? comp.demoValue : comp.readiness === 'virtual_only' ? 'Sim' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigator Footer Legend */}
          <div className="p-2.5 border-t border-slate-800/80 bg-slate-900/50 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Confirmed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Planned
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Virtual
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
