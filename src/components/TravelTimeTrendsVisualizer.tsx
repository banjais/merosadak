import React, { useState, useMemo } from 'react';
import { TrafficCorridor, DayProfileType, HourlyTrafficTrend, CorridorTrendData } from '../types';
import { HISTORICAL_CORRIDOR_TRENDS } from '../data/travelTimeTrendsData';
import {
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Gauge,
  Navigation,
  Info,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Sun,
  Moon,
  Zap,
  Activity,
  Sliders,
  Compass,
  Car
} from 'lucide-react';

interface TravelTimeTrendsVisualizerProps {
  selectedCorridor: TrafficCorridor;
  allCorridors: TrafficCorridor[];
  onSelectCorridor: (corridor: TrafficCorridor) => void;
}

export const TravelTimeTrendsVisualizer: React.FC<TravelTimeTrendsVisualizerProps> = ({
  selectedCorridor,
  allCorridors,
  onSelectCorridor,
}) => {
  const [dayType, setDayType] = useState<DayProfileType>('weekday');
  const [selectedHour, setSelectedHour] = useState<number>(() => {
    const currentH = new Date().getHours();
    return currentH >= 0 && currentH < 24 ? currentH : 10;
  });
  const [showAllBottlenecks, setShowAllBottlenecks] = useState<boolean>(false);

  // Retrieve trend profile for selected corridor (or fallback to daunne)
  const trendData: CorridorTrendData = useMemo(() => {
    return (
      selectedCorridor.trends ||
      HISTORICAL_CORRIDOR_TRENDS[selectedCorridor.id] ||
      HISTORICAL_CORRIDOR_TRENDS['tr-daunne']
    );
  }, [selectedCorridor]);

  // Hourly data for the selected day profile
  const hourlyData: HourlyTrafficTrend[] = useMemo(() => {
    return trendData.hourlyProfiles[dayType] || trendData.hourlyProfiles.weekday;
  }, [trendData, dayType]);

  // Maximum travel time across the 24h for scaling the chart
  const maxTravelTime = useMemo(() => {
    const maxVal = Math.max(...hourlyData.map((h) => h.travelTimeMinutes));
    return Math.max(maxVal * 1.15, trendData.freeFlowTimeMinutes * 2);
  }, [hourlyData, trendData]);

  // Find lowest transit time (best hour) in current profile
  const bestHourData = useMemo(() => {
    return [...hourlyData].sort((a, b) => a.travelTimeMinutes - b.travelTimeMinutes)[0];
  }, [hourlyData]);

  // Active selected hour details
  const activeHourTrend = hourlyData.find((h) => h.hour === selectedHour) || hourlyData[10];

  // Delay comparison vs best hour
  const timeDifferenceFromBest = activeHourTrend.travelTimeMinutes - bestHourData.travelTimeMinutes;

  // Helpers for bar color
  const getBarColor = (trend: HourlyTrafficTrend) => {
    if (trend.level === 'standstill') return { bg: '#f43f5e', border: '#fda4af', glow: 'rgba(244,63,94,0.4)' };
    if (trend.level === 'heavy') return { bg: '#f97316', border: '#fdba74', glow: 'rgba(249,115,22,0.35)' };
    if (trend.level === 'moderate') return { bg: '#eab308', border: '#fde047', glow: 'rgba(234,179,8,0.3)' };
    return { bg: '#10b981', border: '#6ee7b7', glow: 'rgba(16,185,129,0.25)' };
  };

  const currentHourOfDay = new Date().getHours();

  return (
    <div className="space-y-4" id="travel-time-trends-root">
      {/* Icon-Based Corridor Selector */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Highway Corridors:</span>
          </span>
          <span className="text-[10px] text-cyan-400 font-mono font-medium">
            {allCorridors.length} Indexed
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {allCorridors.map((c) => {
            const isCurrent = c.id === selectedCorridor.id;
            return (
              <button
                key={c.id}
                onClick={() => onSelectCorridor(c)}
                title={`${c.name} (${c.section})`}
                className={`px-3 py-1.5 rounded-lg transition border text-xs flex items-center space-x-2 ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow font-bold'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border-slate-800'
                }`}
              >
                <Navigation className={`w-3.5 h-3.5 ${isCurrent ? 'text-slate-950' : 'text-amber-400'}`} />
                <span className="font-mono font-bold text-[11px]">{c.highwayCode}</span>
                <span className={`text-[11px] truncate max-w-[120px] ${isCurrent ? 'text-slate-950 font-semibold' : 'text-slate-300'}`}>
                  {c.name.split('(')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Corridor Profile Header & Key Statistics */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 p-4 rounded-xl shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {trendData.highwayCode} Corridor
              </span>
              <span className="text-xs text-slate-400 font-medium">{trendData.distanceKm} km segment</span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">{trendData.corridorName}</h3>
            <p className="text-xs text-slate-400">{trendData.section}</p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-right">
              <div className="text-[10px] text-slate-400 font-medium">Free-Flow Transit</div>
              <div className="text-sm font-bold text-emerald-400">{trendData.freeFlowTimeMinutes} mins</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-right">
              <div className="text-[10px] text-slate-400 font-medium">Historical Peak</div>
              <div className="text-sm font-bold text-rose-400">{trendData.peakTimeMinutes} mins</div>
            </div>
          </div>
        </div>

        {/* Best vs Worst Departure Windows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-lg flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Recommended Departure Window
              </div>
              <div className="text-xs font-bold text-white mt-0.5">{trendData.bestDepartureWindow}</div>
            </div>
          </div>

          <div className="bg-rose-950/30 border border-rose-500/30 p-2.5 rounded-lg flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                Worst Congestion Window
              </div>
              <div className="text-xs font-bold text-white mt-0.5">{trendData.worstDepartureWindow}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Day Profile Switcher Tabs */}
      <div className="flex items-center space-x-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
        <button
          onClick={() => setDayType('weekday')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            dayType === 'weekday'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Weekday (Sun–Thu)</span>
        </button>

        <button
          onClick={() => setDayType('friday')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            dayType === 'friday'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Friday (Weekend Eve)</span>
        </button>

        <button
          onClick={() => setDayType('saturday')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            dayType === 'saturday'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Saturday (Holiday)</span>
        </button>

        <button
          onClick={() => setDayType('festival')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            dayType === 'festival'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Festival (Dashain)</span>
        </button>
      </div>

      {/* 24-Hour Travel Time Histogram / Interactive Trend Chart */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-white flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>24-Hour Historical Congestion & Travel Time Trend</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Click any hour column below to simulate departure time and examine delay breakdown.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-[10px] text-slate-400">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
              <span>Smooth (&lt;20m)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
              <span>Moderate</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-500"></span>
              <span>Heavy</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
              <span>Chokepoint</span>
            </span>
          </div>
        </div>

        {/* Visual Chart Container */}
        <div className="relative pt-6 pb-2 px-1">
          {/* Free Flow Baseline Reference Line */}
          <div
            className="absolute left-0 right-0 border-b border-dashed border-emerald-500/40 z-0 pointer-events-none"
            style={{
              bottom: `${(trendData.freeFlowTimeMinutes / maxTravelTime) * 140 + 24}px`,
            }}
          >
            <span className="absolute -top-4 right-2 text-[9px] font-mono text-emerald-400 font-semibold bg-slate-950/80 px-1 rounded">
              Free Flow: {trendData.freeFlowTimeMinutes}m
            </span>
          </div>

          {/* 24 Bar Columns */}
          <div
            className="items-end h-[160px] border-b border-slate-800 relative z-10 gap-1"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
            }}
          >
            {hourlyData.map((hTrend) => {
              const isSelected = hTrend.hour === selectedHour;
              const isCurrentHour = hTrend.hour === currentHourOfDay;
              const barHeightPct = Math.min(100, Math.max(12, (hTrend.travelTimeMinutes / maxTravelTime) * 100));
              const colors = getBarColor(hTrend);

              return (
                <div
                  key={hTrend.hour}
                  onClick={() => setSelectedHour(hTrend.hour)}
                  className="relative flex flex-col items-center h-full justify-end group cursor-pointer"
                  title={`${hTrend.label}: ${hTrend.travelTimeMinutes} mins (Speed: ${hTrend.avgSpeedKmh} km/h)`}
                >
                  {/* Current Hour Indicator Tag */}
                  {isCurrentHour && (
                    <div className="absolute -top-6 px-1 py-0.2 bg-cyan-500 text-[8px] font-bold text-slate-950 rounded shadow whitespace-nowrap animate-bounce pointer-events-none">
                      NOW
                    </div>
                  )}

                  {/* Selected Hour Arrow Marker */}
                  {isSelected && !isCurrentHour && (
                    <div className="absolute -top-4 text-amber-400 text-xs pointer-events-none">▼</div>
                  )}

                  {/* The Bar */}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-200 ${
                      isSelected
                        ? 'ring-2 ring-white scale-y-105'
                        : 'group-hover:opacity-90 group-hover:scale-y-102'
                    }`}
                    style={{
                      height: `${barHeightPct}%`,
                      backgroundColor: colors.bg,
                      boxShadow: isSelected ? `0 0 12px ${colors.glow}` : undefined,
                    }}
                  />

                  {/* X-axis Hour Label (Every 3 hours or on hover) */}
                  <div className="text-[9px] text-slate-400 mt-1 font-mono select-none">
                    {hTrend.hour % 3 === 0 ? hTrend.label.replace(' ', '') : '·'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Hour Deep-Dive Inspector Card */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-inner"
                style={{
                  backgroundColor: `${getBarColor(activeHourTrend).bg}20`,
                  color: getBarColor(activeHourTrend).bg,
                  border: `1.5px solid ${getBarColor(activeHourTrend).bg}`,
                }}
              >
                {activeHourTrend.label.split(' ')[0]}
                <span className="text-[9px]">{activeHourTrend.label.split(' ')[1]}</span>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-bold text-white">
                    Departure at {activeHourTrend.label}
                  </h4>
                  <span
                    className="px-2 py-0.2 rounded text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor: `${getBarColor(activeHourTrend).bg}15`,
                      color: getBarColor(activeHourTrend).bg,
                    }}
                  >
                    {activeHourTrend.level}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{activeHourTrend.advisoryNote}</p>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="flex items-center space-x-4 bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800/70 shrink-0">
              <div>
                <div className="text-[9px] text-slate-400 uppercase font-semibold">Travel Time</div>
                <div className="text-sm font-extrabold text-white">
                  {activeHourTrend.travelTimeMinutes} <span className="text-[10px] text-slate-400 font-normal">min</span>
                </div>
              </div>

              <div className="border-l border-slate-800 pl-3">
                <div className="text-[9px] text-slate-400 uppercase font-semibold">Delay Delta</div>
                <div
                  className={`text-sm font-extrabold ${
                    activeHourTrend.delayMinutes > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {activeHourTrend.delayMinutes > 0 ? `+${activeHourTrend.delayMinutes}m` : '0m (Free)'}
                </div>
              </div>

              <div className="border-l border-slate-800 pl-3">
                <div className="text-[9px] text-slate-400 uppercase font-semibold">Avg Speed</div>
                <div className="text-sm font-extrabold text-cyan-400">
                  {activeHourTrend.avgSpeedKmh} <span className="text-[10px] text-slate-400 font-normal">km/h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Time Savings Tip */}
          {timeDifferenceFromBest > 10 && (
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  <strong>Tip:</strong> Leaving during optimal window (<strong>{bestHourData.label}</strong>) saves approximately{' '}
                  <strong>{timeDifferenceFromBest} minutes</strong> on this corridor!
                </span>
              </span>
              <button
                onClick={() => setSelectedHour(bestHourData.hour)}
                className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded text-[10px] transition shrink-0 ml-2"
              >
                Switch to {bestHourData.label}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Departure Time Simulator Slider */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white">Interactive Departure Time Slider</h4>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            {activeHourTrend.label}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="23"
          step="1"
          value={selectedHour}
          onChange={(e) => setSelectedHour(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />

        <div className="flex justify-between text-[9px] font-mono text-slate-500">
          <span>12 AM (Midnight)</span>
          <span>6 AM (Morning)</span>
          <span>12 PM (Noon)</span>
          <span>6 PM (Evening)</span>
          <span>11 PM (Night)</span>
        </div>
      </div>

      {/* Historical Bottlenecks & Pro-Driver Tips */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            <h4 className="text-xs font-bold text-white">Historical Bottleneck Causes & Driving Tips</h4>
          </div>
          <button
            onClick={() => setShowAllBottlenecks(!showAllBottlenecks)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            {showAllBottlenecks ? 'Show Less' : 'View All'}
          </button>
        </div>

        {/* Primary Bottlenecks */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400">Primary Congestion Factors:</div>
          {trendData.primaryBottlenecks.slice(0, showAllBottlenecks ? undefined : 2).map((b, i) => (
            <div key={i} className="text-xs text-slate-300 flex items-start space-x-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800/40">
              <span className="text-orange-400 font-bold">•</span>
              <span>{b}</span>
            </div>
          ))}
        </div>

        {/* Driver Tips */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
          <div className="text-[11px] font-bold text-slate-400">Local Highway Police & Pro-Driver Advice:</div>
          {trendData.historicalTips.slice(0, showAllBottlenecks ? undefined : 2).map((tip, i) => (
            <div key={i} className="text-xs text-slate-300 flex items-start space-x-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
