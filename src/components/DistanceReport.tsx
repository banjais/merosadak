import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Clock,
  Info,
  MapPin,
  Printer,
  Share2,
  Download,
  Route as RouteIcon,
} from 'lucide-react';
import type { DistanceResult } from '../utils/distanceEngine';
import { methodologyLabel } from '../utils/distanceEngine';

function formatNumber(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
}

const SEGMENT_TONE: Record<string, string> = {
  surveyed: 'text-emerald-400',
  connection: 'text-amber-300',
  aerial: 'text-slate-300',
};

const METHODOLOGY_CHIP: Record<string, string> = {
  surveyed_highway: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  road_network: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  aerial_fallback: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

function QualityChip({ text, tone }: { text: string; tone: 'ok' | 'info' | 'warn' }) {
  const tones = {
    ok: 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300',
    info: 'border-cyan-500/25 bg-cyan-500/[0.07] text-cyan-300',
    warn: 'border-amber-500/25 bg-amber-500/[0.07] text-amber-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {tone === 'warn' && <AlertTriangle className="h-2.5 w-2.5" />}
      {text}
    </span>
  );
}

export interface DistanceReportProps {
  originName: string;
  destinationName: string;
  result: DistanceResult;
  /** Alternative routes (already surveyed paths) — shown only when >1. */
  alternatives?: { label: string; km: number; highways: string }[];
  selectedAltIndex?: number;
  onSelectAlternative?: (idx: number) => void;
  onShare: () => void;
  onPrint: () => void;
  onDownloadReport?: () => void;
  onChangeLocation?: () => void;
}

/**
 * Distance Calculator report — compact, single-screen, at-a-glance.
 *
 * Replaces the old stacked-cards report (repeated source names, duplicated
 * distance values, long methodology paragraphs) with: one headline number,
 * one breakdown table when components exist, one route line, one source line
 * with an info tooltip, and data-quality chips.
 */
export function DistanceReport({
  originName,
  destinationName,
  result,
  alternatives = [],
  selectedAltIndex = 0,
  onSelectAlternative,
  onShare,
  onPrint,
  onDownloadReport,
  onChangeLocation,
}: DistanceReportProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!infoOpen) return;
    const onDown = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [infoOpen]);

  const isAerial = result.methodology === 'aerial_fallback';
  const multiComponent = result.segments.length > 1;
  const breakdownSum = result.segments.reduce((acc, s) => acc + s.km, 0);

  const qualityChips: { text: string; tone: 'ok' | 'info' | 'warn' }[] = [];
  if (result.quality.surveyed && !isAerial) {
    qualityChips.push({ text: result.publishedKm ? 'Surveyed alignment' : 'Surveyed alignment', tone: 'ok' });
  }
  if (result.quality.connectorUsed) qualityChips.push({ text: 'Connector road used', tone: 'info' });
  if (result.publishedKm && result.methodology !== 'aerial_fallback') {
    qualityChips.push({ text: 'DoR-published pair', tone: 'ok' });
  }
  if (result.quality.aerialFallback) qualityChips.push({ text: 'Aerial fallback', tone: 'warn' });
  if (result.quality.partialCoverage && !result.quality.aerialFallback && !result.quality.connectorUsed && !result.publishedKm) {
    qualityChips.push({ text: 'Partial survey coverage', tone: 'warn' });
  }

  return (
    <section id="distance-report" className="card card-elevated p-4 sm:p-5 space-y-4" aria-label="Distance report">
      {/* A. Route + headline */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-black font-display text-white">
        <span className="truncate">{originName}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-emerald-400" />
        <span className="truncate">{destinationName}</span>
        <span className={`ml-auto rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${METHODOLOGY_CHIP[result.methodology]}`}>
          {methodologyLabel(result.methodology)}
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {isAerial ? 'Aerial estimate' : 'Road distance'}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-5xl font-black font-display ${isAerial ? 'text-slate-200' : 'text-emerald-400'}`}>
              {formatNumber(result.totalKm, 1)}
            </span>
            <span className="pb-1.5 text-base text-slate-400">km</span>
          </div>
          {!isAerial && result.aerialKm ? (
            <p className="mt-1 text-[10px] text-slate-500">
              Straight line would be {formatNumber(result.aerialKm, 1)} km — the road is{' '}
              {Math.round((result.totalKm / result.aerialKm) * 100) / 100}× longer.
            </p>
          ) : null}
        </div>

        {result.estimatedTimeMinutes != null && result.estimatedTimeMinutes > 0 && (
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <Clock className="h-3 w-3" /> Est. time
            </div>
            <div className="mt-1 text-2xl font-black text-cyan-400 font-display">
              {formatDuration(result.estimatedTimeMinutes)}
            </div>
          </div>
        )}
      </div>

      {/* B. Distance breakdown — only when multiple components exist */}
      {multiComponent && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Distance breakdown</div>
          <table className="mt-2 w-full text-[11px]">
            <tbody>
              {result.segments.map((seg) => (
                <tr key={seg.label} className="border-t border-slate-800/60 first:border-t-0">
                  <td className="py-1.5 text-slate-300">{seg.label}</td>
                  <td className="py-1.5 text-right font-bold">
                    <span className={SEGMENT_TONE[seg.kind]}>{formatNumber(seg.km, 1)}</span>{' '}
                    <span className="text-slate-500">km</span>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-700">
                <td className="py-1.5 font-bold text-white">Total</td>
                <td className="py-1.5 text-right font-black text-white">
                  {formatNumber(breakdownSum, 1)} <span className="text-slate-400">km</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* C. Route information */}
      {!isAerial && (result.highwaysUsed.length > 0 || result.pathSegments.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <RouteIcon className="h-3.5 w-3.5 text-cyan-400" />
            {result.highwaysUsed.length > 0 ? result.highwaysUsed.join(' → ') : 'Local road network'}
          </span>
          {result.pathSegments.some((s) => s.kind === 'connection') && (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <MapPin className="h-3 w-3" /> connector road to/from highway
            </span>
          )}
        </div>
      )}

      {/* Alternatives — only when meaningful (>1) */}
      {alternatives.length > 1 && onSelectAlternative && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Alternative routes</div>
          <div className="mt-2 space-y-1.5">
            {alternatives.map((alt, idx) => (
              <button
                key={`${idx}-${alt.label}`}
                type="button"
                onClick={() => onSelectAlternative(idx)}
                aria-pressed={idx === selectedAltIndex}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                  idx === selectedAltIndex
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-white'
                    : 'border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="min-w-0 truncate">{alt.label}</span>
                <span className="shrink-0 font-bold">{formatNumber(alt.km, 1)} km</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* D. Source + E. quality — one line each */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
        <div className="relative" ref={infoRef}>
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 transition hover:text-white"
            aria-expanded={infoOpen}
          >
            <Info className="h-3.5 w-3.5 text-cyan-400" />
            Source: {result.sourceLabel}
            <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${infoOpen ? 'rotate-180' : ''}`} />
          </button>
          {infoOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-slate-700 bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-300 shadow-2xl">
              {result.sourceDetail}
              {result.publishedKm && (
                <p className="mt-2 border-t border-slate-800 pt-2 text-slate-400">
                  DoR publishes <span className="font-bold text-emerald-300">{formatNumber(result.publishedKm, 1)} km</span> for
                  this exact pair (SNH{result.publishedCitation ? `, ${result.publishedCitation.table}` : ''}).
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {qualityChips.map((chip) => (
            <QualityChip key={chip.text} text={chip.text} tone={chip.tone} />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-900/50"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-700/60 bg-amber-950/40 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 transition hover:bg-amber-900/50"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        {onDownloadReport && (
          <button
            type="button"
            onClick={onDownloadReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-700/60 bg-sky-950/40 px-2.5 py-1.5 text-[10px] font-bold text-sky-300 transition hover:bg-sky-900/50"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
        )}
        {onChangeLocation && (
          <button
            type="button"
            onClick={onChangeLocation}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <MapPin className="h-3.5 w-3.5" /> Change
          </button>
        )}
      </div>
    </section>
  );
}

export default DistanceReport;
