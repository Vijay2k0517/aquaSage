'use client';

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { TourMilestone, TOUR_MILESTONES } from './tourMilestones';

interface GuidedTourBarProps {
  currentStepIndex: number;
  isPlaying: boolean;
  onStepChange: (index: number) => void;
  onTogglePlay: () => void;
  onCloseTour: () => void;
}

/**
 * Enterprise Cinematic Guided Tour HUD Presentation Bar
 * - Glides the user through key technical milestones with camera choreography
 * - Displays step indicators, executive summaries, technical specifications, and auto-play timer
 */
export function GuidedTourBar({
  currentStepIndex,
  isPlaying,
  onStepChange,
  onTogglePlay,
  onCloseTour,
}: GuidedTourBarProps) {
  const milestone: TourMilestone = TOUR_MILESTONES[currentStepIndex] || TOUR_MILESTONES[0];
  const [progress, setProgress] = useState(0);

  // Auto-advance timer logic
  useEffect(() => {
    if (!isPlaying) return;

    setProgress(0);
    const durationMs = milestone.durationSeconds * 1000;
    const intervalMs = 100;
    const stepIncrement = (intervalMs / durationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Advance to next milestone
          const nextIndex = (currentStepIndex + 1) % TOUR_MILESTONES.length;
          onStepChange(nextIndex);
          return 0;
        }
        return prev + stepIncrement;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [currentStepIndex, isPlaying, milestone.durationSeconds, onStepChange]);

  const handlePrev = () => {
    const prevIndex =
      currentStepIndex === 0 ? TOUR_MILESTONES.length - 1 : currentStepIndex - 1;
    onStepChange(prevIndex);
  };

  const handleNext = () => {
    const nextIndex = (currentStepIndex + 1) % TOUR_MILESTONES.length;
    onStepChange(nextIndex);
  };

  return (
    <div
      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-4xl bg-[#090E17]/95 border border-cyan-500/40 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Animated Progress Bar at Top Border */}
      <div className="w-full h-1 bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Step Badge & Narrative Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            {/* Step Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono text-[11px] font-bold tracking-wider">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                MILESTONE {milestone.stepNumber} / {milestone.totalSteps}
              </span>
            </div>

            {/* Subtitle */}
            <span className="text-xs text-slate-400 font-sans hidden sm:inline">
              {milestone.subtitle}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>{milestone.title}</span>
          </h2>

          {/* Narrative Summary */}
          <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
            {milestone.description}
          </p>

          {/* Technical Specs Metric Chips */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {Object.entries(milestone.technicalSpecs).map(([key, val]) => (
              <div
                key={key}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono"
              >
                <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                <span className="text-slate-400">{key}:</span>
                <span className="text-white font-semibold">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Choreography Playback Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {/* Previous Step */}
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-white transition-all active:scale-95"
            title="Previous Milestone"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Play / Pause Toggle */}
          <button
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white font-mono text-xs font-bold border border-cyan-400/40 shadow-lg shadow-cyan-950/60 transition-all active:scale-95"
            title={isPlaying ? 'Pause Auto-Advance' : 'Play Auto-Advance'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span className="hidden sm:inline">Resume</span>
              </>
            )}
          </button>

          {/* Next Step */}
          <button
            onClick={handleNext}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-white transition-all active:scale-95"
            title="Next Milestone"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Exit Tour */}
          <button
            onClick={onCloseTour}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition-all active:scale-95 ml-1"
            title="Exit Guided Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
