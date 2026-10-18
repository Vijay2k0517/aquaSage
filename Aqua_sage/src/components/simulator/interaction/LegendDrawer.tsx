'use client';

import React, { useState } from 'react';
import {
  Info,
  X,
  Layers,
  Cpu,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Droplets,
} from 'lucide-react';

export function LegendDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-30" onClick={(e) => e.stopPropagation()}>
      {/* Legend Toggle Button in Header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
          isOpen
            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-950/30'
            : 'bg-slate-900/80 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:text-white'
        }`}
        title="View System Hardware Legend and Physical Skid Specifications"
        aria-label="Toggle Legend"
        aria-expanded={isOpen}
      >
        <Info className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline font-semibold">Legend</span>
      </button>

      {/* Legend Modal Popover */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 max-h-[80vh] flex flex-col rounded-xl bg-[#0F172A]/95 border border-slate-800 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-200">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800/80 bg-[#162032]/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-xs font-bold tracking-wider text-white uppercase">
                System Legend & Specifications
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Legend"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
            {/* 1. Hardware Readiness Tiers */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Hardware Readiness Tiers</span>
              </div>
              <div className="space-y-2">
                <div className="p-2 rounded-lg bg-[#141C2E] border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-[11px] font-bold text-emerald-400 uppercase">
                      Confirmed Hardware
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Physical sensors integrated or bench-tested: JSN-SR04T (Level), YF-S201 (Flow), Analog TDS, Optical Turbidity, and ESP32 gateway.
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#141C2E] border border-slate-800 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-[11px] font-bold text-amber-400 uppercase">
                      Planned Hardware
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Piezoresistive pressure transducers (PT-01, PT-02) and manual isolation valves (V1, V2) specified for future hardware integration.
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#141C2E] border border-slate-800 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-[11px] font-bold text-cyan-400 uppercase">
                      Virtual Model
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Extrusion skid frame, acrylic water reservoir, stainless steel pipe network, and AC motor mathematical simulation.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Physical Skid Geometry */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>Skid Engineering Dimensions (1:1 Metric)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#141C2E] border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400 font-sans">Frame Footprint:</span>
                  <span>1.80m (L) × 0.80m (W) × 1.60m (H)</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400 font-sans">Water Reservoir:</span>
                  <span>Ø 0.5642m × 1.20m (250 L Capacity)</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400 font-sans">Calibration Constant:</span>
                  <span>2.50 L per cm water column height</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400 font-sans">Primary Pipeline:</span>
                  <span>2-inch Nominal (DN50 Schedule 80)</span>
                </div>
              </div>
            </div>

            {/* 3. Scientific Guidance Notice */}
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Scientific Observation Guidance</span>
              </div>
              <p className="text-[10px] leading-relaxed text-amber-200/90 font-sans">
                TDS (electrolytic conductivity) and turbidity (optical nephelometry) readings indicate dissolved ionic concentration and suspended solids. Neither reading alone proves or disproves microbiological water potability.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
