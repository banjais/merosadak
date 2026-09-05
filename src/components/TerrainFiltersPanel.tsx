import React, { useState } from 'react';
import { TerrainFilterOptions } from '../types';
import {
  Mountain,
  Layers,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Check,
  TrendingDown,
  Compass,
  Sparkles,
  Info,
} from 'lucide-react';

interface TerrainFiltersPanelProps {
  filters: TerrainFilterOptions;
  onChange: (filters: TerrainFilterOptions) => void;
  className?: string;
}

export const TerrainFiltersPanel: React.FC<TerrainFiltersPanelProps> = ({
  filters,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const activeFilterCount = [
    filters.avoidHighPasses,
    filters.requirePavedOnly,
    filters.avoidSteepGrades,
    filters.avoidActiveLandslideZones,
    Boolean(filters.maxElevationM),
  ].filter(Boolean).length;

  const toggleFilter = (key: keyof Omit<TerrainFilterOptions, 'maxElevationM'>) => {
    onChange({
      ...filters,
      [key]: !filters[key],
    });
  };

  const setMaxElevation = (elevation: number | undefined) => {
    onChange({
      ...filters,
      maxElevationM: elevation,
    });
  };

  const handleReset = () => {
    onChange({
      avoidHighPasses: false,
      requirePavedOnly: false,
      avoidSteepGrades: false,
      avoidActiveLandslideZones: false,
      maxElevationM: undefined,
    });
  };

  const applyPreset = (preset: 'lowland' | 'cargo' | 'monsoon') => {
    if (preset === 'lowland') {
      onChange({
        avoidHighPasses: true,
        requirePavedOnly: true,
        avoidSteepGrades: true,
        avoidActiveLandslideZones: false,
        maxElevationM: 1400,
      });
    } else if (preset === 'cargo') {
      onChange({
        avoidHighPasses: true,
        requirePavedOnly: true,
        avoidSteepGrades: true,
        avoidActiveLandslideZones: true,
        maxElevationM: undefined,
      });
    } else if (preset === 'monsoon') {
      onChange({
        avoidHighPasses: false,
        requirePavedOnly: true,
        avoidSteepGrades: true,
        avoidActiveLandslideZones: true,
        maxElevationM: undefined,
      });
    }
  };

  return (
    <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5 transition ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Terrain & Road Surface Constraints
              </h3>
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 animate-pulse">
                  {activeFilterCount} Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Customize mountain pass avoidance, surface paving requirements & hazard filters
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeFilterCount > 0 && (
            <button
              onClick={handleReset}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded-lg hover:bg-slate-800/80 transition flex items-center space-x-1"
              title="Reset all terrain constraints"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title={isOpen ? 'Collapse panel' : 'Expand panel'}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="space-y-3 pt-1 border-t border-slate-800/80">
          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mr-1 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-teal-400" />
              <span>Presets:</span>
            </span>
            <button
              onClick={() => applyPreset('lowland')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-teal-500/40 transition"
            >
              🌿 Lowland Bypass (&lt;1,400m)
            </button>
            <button
              onClick={() => applyPreset('cargo')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-teal-500/40 transition"
            >
              🚚 Heavy Bus / Cargo Safe
            </button>
            <button
              onClick={() => applyPreset('monsoon')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-teal-500/40 transition"
            >
              🛡️ Monsoon Hazard Reroute
            </button>
          </div>

          {/* Filter Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* 1. Avoid High Mountain Passes */}
            <div
              onClick={() => toggleFilter('avoidHighPasses')}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-start space-x-3 select-none ${
                filters.avoidHighPasses
                  ? 'bg-teal-950/30 border-teal-500/60 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center transition shrink-0 ${
                  filters.avoidHighPasses
                    ? 'bg-teal-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900'
                }`}
              >
                {filters.avoidHighPasses && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Mountain className={`w-3.5 h-3.5 ${filters.avoidHighPasses ? 'text-teal-400' : 'text-slate-400'}`} />
                    <span className={`text-xs font-bold ${filters.avoidHighPasses ? 'text-teal-200' : 'text-slate-200'}`}>
                      Avoid High Mountain Passes
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    &gt; 1,400m
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Bypasses high altitude passes (e.g. Daman H02 ~2,400m & Daunne) in favor of river valley corridors.
                </p>
              </div>
            </div>

            {/* 2. Require Paved Roads Only */}
            <div
              onClick={() => toggleFilter('requirePavedOnly')}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-start space-x-3 select-none ${
                filters.requirePavedOnly
                  ? 'bg-emerald-950/30 border-emerald-500/60 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center transition shrink-0 ${
                  filters.requirePavedOnly
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900'
                }`}
              >
                {filters.requirePavedOnly && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Layers className={`w-3.5 h-3.5 ${filters.requirePavedOnly ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className={`text-xs font-bold ${filters.requirePavedOnly ? 'text-emerald-200' : 'text-slate-200'}`}>
                      Require Paved Roads Only
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    Asphalt Only
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Restricts routing to smooth asphalt/blacktopped highways; penalizes loose gravel, dirt, and mud tracks.
                </p>
              </div>
            </div>

            {/* 3. Avoid Steep Incline Grades */}
            <div
              onClick={() => toggleFilter('avoidSteepGrades')}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-start space-x-3 select-none ${
                filters.avoidSteepGrades
                  ? 'bg-cyan-950/30 border-cyan-500/60 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center transition shrink-0 ${
                  filters.avoidSteepGrades
                    ? 'bg-cyan-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900'
                }`}
              >
                {filters.avoidSteepGrades && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <TrendingDown className={`w-3.5 h-3.5 ${filters.avoidSteepGrades ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className={`text-xs font-bold ${filters.avoidSteepGrades ? 'text-cyan-200' : 'text-slate-200'}`}>
                      Avoid Steep Incline / Hairpins
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    &lt; 5.5% Grade
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Bypasses extreme mountain hairpin gradients to protect engines, brakes, and heavy cargo vehicles.
                </p>
              </div>
            </div>

            {/* 4. Avoid Active Landslide Zones */}
            <div
              onClick={() => toggleFilter('avoidActiveLandslideZones')}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-start space-x-3 select-none ${
                filters.avoidActiveLandslideZones
                  ? 'bg-amber-950/30 border-amber-500/60 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center transition shrink-0 ${
                  filters.avoidActiveLandslideZones
                    ? 'bg-amber-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900'
                }`}
              >
                {filters.avoidActiveLandslideZones && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <AlertTriangle className={`w-3.5 h-3.5 ${filters.avoidActiveLandslideZones ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className={`text-xs font-bold ${filters.avoidActiveLandslideZones ? 'text-amber-200' : 'text-slate-200'}`}>
                      Avoid Active Landslide Zones
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-amber-500/30">
                    DoR Alerts
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Reroutes around active DoR landslide clearances, rockfall corridors, and single-lane hazard segments.
                </p>
              </div>
            </div>
          </div>

          {/* 5. Max Elevation Ceiling Pill Selector */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-teal-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-200">Altitude Ceiling Cap</span>
                <p className="text-[10px] text-slate-400">Limit max elevation reached along the entire route</p>
              </div>
            </div>

            <div className="flex items-center space-x-1 overflow-x-auto">
              {[
                { label: 'No Limit', value: undefined },
                { label: 'Max 1,400m', value: 1400 },
                { label: 'Max 1,800m', value: 1800 },
                { label: 'Max 2,200m', value: 2200 },
              ].map(({ label, value }) => {
                const isSelected = filters.maxElevationM === value;
                return (
                  <button
                    key={label}
                    onClick={() => setMaxElevation(value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      isSelected
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/60 shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
