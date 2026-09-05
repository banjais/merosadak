import React, { useState } from 'react';
import { RouteSafetyIndex, SegmentSafetyData, KnownBlackspot } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
  Info,
  Gauge,
  HelpCircle,
  Compass,
  Zap,
  MapPin,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { SAFETY_TIER_COLORS, SAFETY_TIER_BG_CLASSES } from '../utils/safetyIndexCalculator';

interface HighwaySafetyIndexCardProps {
  safetyIndex: RouteSafetyIndex;
  onFocusBlackspot?: (blackspot: KnownBlackspot) => void;
  onFocusSegment?: (segment: SegmentSafetyData) => void;
  colorMode?: 'safety' | 'preference';
  onToggleColorMode?: (mode: 'safety' | 'preference') => void;
}

export const HighwaySafetyIndexCard: React.FC<HighwaySafetyIndexCardProps> = ({
  safetyIndex,
  onFocusBlackspot,
  onFocusSegment,
  colorMode = 'safety',
  onToggleColorMode = (_mode: 'safety' | 'preference') => {},
}) => {
  const [showBlackspotDetails, setShowBlackspotDetails] = useState(true);
  const [showSegmentTable, setShowSegmentTable] = useState(false);
  const [selectedBlackspotId, setSelectedBlackspotId] = useState<string | null>(null);

  const {
    overallScore,
    safetyTier,
    tierLabel,
    color,
    roadQualityAverage,
    accidentRiskSummary,
    totalHistoricalAnnualAccidents,
    activeBlackspots,
    segmentBreakdown,
    keySafetyDirectives,
  } = safetyIndex;

  const totalKm =
    accidentRiskSummary.safeKm +
    accidentRiskSummary.moderateKm +
    accidentRiskSummary.elevatedRiskKm +
    accidentRiskSummary.highHazardKm;

  return (
    <div
      id="highway-safety-index-panel"
      className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-5 relative overflow-hidden"
    >
      {/* Subtle top indicator bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5 transition-all duration-500"
        style={{ backgroundColor: color }}
      />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition shadow-lg"
            style={{
              backgroundColor: `${color}20`,
              borderColor: `${color}50`,
              color: color,
            }}
          >
            {overallScore >= 80 ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white tracking-tight font-display">
                Highway Safety Index (HSI)
              </h3>
              <span
                className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: `${color}25`,
                  borderColor: `${color}60`,
                  color: color,
                }}
              >
                {safetyTier.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Corridor risk assessment based on DoR road condition and Nepal Police accident telemetry
            </p>
          </div>
        </div>

        {/* Map Color-Coding Mode Switch */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => onToggleColorMode('safety')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              colorMode === 'safety'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Color-code route segments on map by safety score (Green/Amber/Orange/Red)"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Map Safety Colors</span>
          </button>

          <button
            onClick={() => onToggleColorMode('preference')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              colorMode === 'preference'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Display standard single theme color"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Standard Route</span>
          </button>
        </div>
      </div>

      {/* Main Score & 4-Pillar Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Overall Safety Gauge Card */}
        <div className="md:col-span-4 bg-slate-950/80 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Overall Corridor Score</span>
            <span className="font-mono text-[11px] text-slate-500">Scale: 0-100</span>
          </div>

          <div className="my-3 flex items-baseline space-x-2">
            <span
              className="text-4xl sm:text-5xl font-black font-display tracking-tight"
              style={{ color }}
            >
              {overallScore}
            </span>
            <span className="text-slate-500 font-semibold text-sm">/ 100</span>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-200 mb-1">{tierLabel}</div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
              <div
                className="h-full transition-all duration-700 rounded-full"
                style={{ width: `${overallScore}%`, backgroundColor: color }}
              />
            </div>
          </div>
        </div>

        {/* 3 Pillar Summary Cards */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Road Quality Average */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
            <div className="text-xs text-slate-400 font-medium flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Road Quality Score</span>
            </div>
            <div className="text-2xl font-black text-white font-display">
              {roadQualityAverage} <span className="text-xs font-normal text-slate-400">/ 100</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Pavement & lane maintenance index
            </div>
          </div>

          {/* Historical Accident Frequency */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
            <div className="text-xs text-slate-400 font-medium flex items-center space-x-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Corridor Crash Rate</span>
            </div>
            <div className="text-2xl font-black text-amber-400 font-display">
              ~{totalHistoricalAnnualAccidents}{' '}
              <span className="text-xs font-normal text-slate-400">incidents/yr</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Annual verified police crash logs
            </div>
          </div>

          {/* Active Blackspots Detected */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
            <div className="text-xs text-slate-400 font-medium flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Active Blackspots</span>
            </div>
            <div className="text-2xl font-black text-rose-400 font-display">
              {activeBlackspots.length}{' '}
              <span className="text-xs font-normal text-slate-400">hotspots</span>
            </div>
            <div className="text-[11px] text-slate-500">
              High-frequency hazard zones on path
            </div>
          </div>
        </div>
      </div>

      {/* Safety Distance Proportional Bar */}
      <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-semibold">Route Safety Distance Breakdown</span>
          <span className="text-slate-400 font-mono text-[11px]">Total: {totalKm} km</span>
        </div>

        {/* Multi-tier colored progress bar */}
        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
          {accidentRiskSummary.safeKm > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(accidentRiskSummary.safeKm / totalKm) * 100}%` }}
              title={`Safe: ${accidentRiskSummary.safeKm} km (${Math.round((accidentRiskSummary.safeKm / totalKm) * 100)}%)`}
            />
          )}
          {accidentRiskSummary.moderateKm > 0 && (
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${(accidentRiskSummary.moderateKm / totalKm) * 100}%` }}
              title={`Moderate Caution: ${accidentRiskSummary.moderateKm} km (${Math.round((accidentRiskSummary.moderateKm / totalKm) * 100)}%)`}
            />
          )}
          {accidentRiskSummary.elevatedRiskKm > 0 && (
            <div
              className="h-full bg-orange-500 transition-all"
              style={{ width: `${(accidentRiskSummary.elevatedRiskKm / totalKm) * 100}%` }}
              title={`Elevated Risk: ${accidentRiskSummary.elevatedRiskKm} km (${Math.round((accidentRiskSummary.elevatedRiskKm / totalKm) * 100)}%)`}
            />
          )}
          {accidentRiskSummary.highHazardKm > 0 && (
            <div
              className="h-full bg-rose-500 transition-all"
              style={{ width: `${(accidentRiskSummary.highHazardKm / totalKm) * 100}%` }}
              title={`High Hazard: ${accidentRiskSummary.highHazardKm} km (${Math.round((accidentRiskSummary.highHazardKm / totalKm) * 100)}%)`}
            />
          )}
        </div>

        {/* Legend pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-semibold text-emerald-400">{accidentRiskSummary.safeKm} km</span>
            <span className="text-slate-500">(High Safety)</span>
          </div>

          <div className="flex items-center space-x-1.5 text-[11px] text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-semibold text-amber-400">{accidentRiskSummary.moderateKm} km</span>
            <span className="text-slate-500">(Moderate)</span>
          </div>

          <div className="flex items-center space-x-1.5 text-[11px] text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
            <span className="font-semibold text-orange-400">{accidentRiskSummary.elevatedRiskKm} km</span>
            <span className="text-slate-500">(Elevated)</span>
          </div>

          <div className="flex items-center space-x-1.5 text-[11px] text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="font-semibold text-rose-400">{accidentRiskSummary.highHazardKm} km</span>
            <span className="text-slate-500">(High Hazard)</span>
          </div>
        </div>
      </div>

      {/* Identified Known Blackspots on This Route */}
      {activeBlackspots.length > 0 && (
        <div className="border border-rose-900/50 bg-rose-950/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                Critical Accident Blackspots On Selected Corridor ({activeBlackspots.length})
              </span>
            </div>
            <button
              onClick={() => setShowBlackspotDetails(!showBlackspotDetails)}
              className="text-[11px] text-rose-400 hover:text-rose-200 flex items-center space-x-1 font-semibold"
            >
              <span>{showBlackspotDetails ? 'Hide Details' : 'Show Details'}</span>
              {showBlackspotDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showBlackspotDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {activeBlackspots.map((bs) => (
                <div
                  key={bs.id}
                  className="bg-slate-900/90 border border-rose-800/40 rounded-xl p-3 text-xs space-y-2 relative hover:border-rose-500/60 transition cursor-pointer"
                  onClick={() => {
                    setSelectedBlackspotId(bs.id);
                    if (onFocusBlackspot) onFocusBlackspot(bs);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center space-x-1.5">
                        <span>{bs.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{bs.chainageOrLocation}</span>
                    </div>
                    <span
                      className={`text-[9px] uppercase font-black px-2 py-0.5 rounded border ${
                        bs.riskLevel === 'critical'
                          ? 'bg-rose-950 border-rose-700 text-rose-300'
                          : 'bg-amber-950 border-amber-700 text-amber-300'
                      }`}
                    >
                      {bs.riskLevel} Risk
                    </span>
                  </div>

                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    <strong className="text-slate-200">Cause: </strong> {bs.primaryCause}
                  </div>

                  <div className="flex items-center justify-between text-[11px] bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                    <span className="text-rose-400 font-semibold">{bs.annualAccidentStats}</span>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Locate on Map</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/30 p-2 rounded-lg">
                    <strong>Safe Driving Directive: </strong> {bs.safeDrivingAdvice}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actionable Precaution Directives */}
      {keySafetyDirectives.length > 0 && (
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-2 text-xs">
          <div className="font-bold text-slate-300 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Essential Route Safety Guidelines:</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
            {keySafetyDirectives.map((directive, idx) => (
              <li key={idx} className="flex items-start space-x-1.5">
                <span className="text-emerald-400 font-bold shrink-0">•</span>
                <span className="text-slate-300">{directive}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Segment-by-Segment Safety Explorer Dropdown Toggle */}
      <div>
        <button
          onClick={() => setShowSegmentTable(!showSegmentTable)}
          className="w-full py-2.5 px-3.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center justify-between transition"
        >
          <div className="flex items-center space-x-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span>Segment-by-Segment Highway Safety Breakdown ({segmentBreakdown.length} Segments)</span>
          </div>
          <div className="flex items-center space-x-1 text-slate-400">
            <span className="text-[11px]">{showSegmentTable ? 'Collapse Table' : 'Expand Table'}</span>
            {showSegmentTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showSegmentTable && (
          <div className="mt-3 overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-3">Highway Segment</th>
                  <th className="p-3">Distance</th>
                  <th className="p-3">Safety Score</th>
                  <th className="p-3">Road Quality</th>
                  <th className="p-3">Accident Risk</th>
                  <th className="p-3">Safe Speed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {segmentBreakdown.map((seg, idx) => (
                  <tr
                    key={seg.segmentId || idx}
                    className="hover:bg-slate-800/50 transition cursor-pointer"
                    onClick={() => {
                      if (onFocusSegment) onFocusSegment(seg);
                    }}
                  >
                    <td className="p-3 font-semibold text-white">
                      <div>
                        {seg.fromName} ➔ {seg.toName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {seg.highwayName} ({seg.highwayCode})
                      </div>
                      {seg.blackspotName && (
                        <div className="text-[10px] text-rose-400 font-bold mt-0.5 flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Blackspot: {seg.blackspotName}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-slate-300 font-mono">{seg.distanceKm} km</td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <span
                          className="font-bold text-sm font-display"
                          style={{ color: seg.color }}
                        >
                          {seg.safetyScore}
                        </span>
                        <span
                          className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded border"
                          style={{
                            backgroundColor: `${seg.color}20`,
                            borderColor: `${seg.color}50`,
                            color: seg.color,
                          }}
                        >
                          {seg.safetyTier.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-300">{seg.roadQualityScore} / 100</td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          seg.accidentRiskLevel === 'critical'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                            : seg.accidentRiskLevel === 'high'
                            ? 'bg-orange-950/80 text-orange-300 border border-orange-800'
                            : seg.accidentRiskLevel === 'moderate'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {seg.accidentRiskLevel} ({seg.annualAccidentIncidents}/yr)
                      </span>
                    </td>
                    <td className="p-3 text-cyan-400 font-bold font-mono">
                      {seg.recommendedSpeedKmh} km/h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
