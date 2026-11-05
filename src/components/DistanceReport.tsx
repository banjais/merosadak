import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Download,
  MapPin,
  Printer,
  Share2,
  Route as RouteIcon,
  ShieldCheck,
  Database,
  Gauge,
} from 'lucide-react';
import type { DistanceResult } from '../utils/distanceEngine';
import { methodologyLabel } from '../utils/distanceEngine';
import { PlannerDeck, type DeckItem } from './PlannerDeck';
import { ReelCard } from './planner/ReelCard';

function formatNumber(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return hours + 'h ' + remainingMinutes + 'm';
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
    <span className={'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ' + tones[tone]}>
      {tone === 'warn' && <AlertTriangle className="h-2.5 w-2.5" />}
      {text}
    </span>
  );
}

export interface DistanceReportProps {
  originName: string;
  destinationName: string;
  result: DistanceResult;
  alternatives?: { label: string; km: number; highways: string }[];
  selectedAltIndex?: number;
  onSelectAlternative?: (idx: number) => void;
  onShare: () => void;
  onPrint: () => void;
  onDownloadReport?: () => void;
  onChangeLocation?: () => void;
}

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
  const [activeSector, setActiveSector] = useState('distance-overview');
  const isAerial = result.methodology === 'aerial_fallback';
  const multiComponent = result.segments.length > 1;
  const breakdownSum = result.segments.reduce((acc, segment) => acc + segment.km, 0);

  const qualityChips: { text: string; tone: 'ok' | 'info' | 'warn' }[] = [];
  if (result.quality.surveyed && !isAerial) {
    qualityChips.push({ text: 'Surveyed alignment', tone: 'ok' });
  }
  if (result.quality.connectorUsed) {
    qualityChips.push({ text: 'Connector road used', tone: 'info' });
  }
  if (result.publishedKm && !isAerial) {
    qualityChips.push({ text: 'DoR-published pair', tone: 'ok' });
  }
  if (result.quality.aerialFallback) {
    qualityChips.push({ text: 'Aerial fallback', tone: 'warn' });
  }
  if (result.quality.partialCoverage && !result.quality.aerialFallback && !result.quality.connectorUsed && !result.publishedKm) {
    qualityChips.push({ text: 'Partial survey coverage', tone: 'warn' });
  }

  const items: DeckItem[] = [
    { id: 'distance-overview', label: 'Journey overview', hint: 'Distance · estimated time' },
    { id: 'distance-route', label: 'Road breakdown', hint: 'Highways · route options' },
    { id: 'distance-evidence', label: 'Data & accuracy', hint: 'Sources · measurement quality' },
  ];

  const overview = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Selected journey</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-black font-display text-white sm:text-lg">
            <span className="max-w-full truncate">{originName}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="max-w-full truncate">{destinationName}</span>
          </div>
        </div>
        <span className={'rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ' + METHODOLOGY_CHIP[result.methodology]}>
          {methodologyLabel(result.methodology)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.12] via-slate-900/80 to-slate-950 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
            <RouteIcon className="h-3.5 w-3.5 text-emerald-400" />
            {isAerial ? 'Straight-line estimate' : 'Calculated road distance'}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={'text-5xl font-black font-display tracking-tight ' + (isAerial ? 'text-amber-200' : 'text-emerald-300')}>
              {formatNumber(result.totalKm, 1)}
            </span>
            <span className="text-base font-semibold text-slate-400">km</span>
          </div>
          {!isAerial && result.aerialKm > 0 && (
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
              {formatNumber(result.aerialKm, 1)} km straight-line reference
            </p>
          )}
          {isAerial && (
            <p className="mt-2 text-[10px] leading-relaxed text-amber-200/80">
              This is not a road-distance result. Actual travel distance may be longer.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              Estimated travel time
            </div>
            <div className="mt-3 text-2xl font-black font-display text-cyan-300">
              {result.estimatedTimeMinutes != null && result.estimatedTimeMinutes > 0
                ? formatDuration(result.estimatedTimeMinutes)
                : 'Not available'}
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Planning estimate, not a live traffic guarantee</p>
          </div>

        </div>
      </div>
    </div>
  );

  const routeDetails = (
    <div className="space-y-4">
      {multiComponent ? (
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Distance composition</div>
              <p className="mt-1 text-[10px] text-slate-500">Contribution of each measured road section</p>
            </div>

          </div>
          <div className="mt-3 space-y-2">
            {result.segments.map((segment, index) => {
              const share = breakdownSum > 0 ? Math.max(0, (segment.km / breakdownSum) * 100) : 0;
              return (
                <div key={segment.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="min-w-0 truncate text-slate-300">{segment.label}</span>
                    <span className={'shrink-0 font-bold ' + SEGMENT_TONE[segment.kind]}>
                      {formatNumber(segment.km, 1)} km
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-current"
                      style={{ width: share + '%', color: segment.kind === 'surveyed' ? '#34d399' : segment.kind === 'connection' ? '#fbbf24' : '#94a3b8' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Road corridor</div>
          <p className="mt-2 break-words text-sm font-semibold leading-relaxed text-slate-100">
            {result.highwaysUsed.length > 0 ? result.highwaysUsed.join('  →  ') : 'Local road network'}
          </p>
        </div>
      )}

      {!isAerial && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3 sm:p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            <RouteIcon className="h-3.5 w-3.5 text-cyan-400" />
            Road corridor
          </div>
          <p className="mt-2 break-words text-sm font-semibold leading-relaxed text-slate-100">
            {result.highwaysUsed.length > 0 ? result.highwaysUsed.join('  →  ') : 'Local road network'}
          </p>
          {result.pathSegments.some((segment) => segment.kind === 'connection') && (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-300">
              <MapPin className="h-3 w-3" /> Includes connector road access to or from a highway
            </p>
          )}
        </div>
      )}

      {alternatives.length > 1 && onSelectAlternative && (
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-3 sm:p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Available route alternatives</div>
          <div className="mt-3 grid gap-2">
            {alternatives.map((alt, index) => (
              <button
                key={index + '-' + alt.label}
                type="button"
                onClick={() => onSelectAlternative(index)}
                aria-pressed={index === selectedAltIndex}
                className={'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ' + (
                  index === selectedAltIndex
                    ? 'border-cyan-400/60 bg-cyan-500/10 text-white shadow-[0_0_0_1px_rgba(34,211,238,.08)]'
                    : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-600'
                )}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{alt.label}</span>
                  {alt.highways && <span className="mt-1 block truncate text-[10px] text-slate-500">{alt.highways}</span>}
                </span>
                <span className="shrink-0 text-sm font-black text-cyan-300">{formatNumber(alt.km, 1)} km</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const evidence = (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
          <Database className="h-3.5 w-3.5 text-cyan-400" />
          Data source
        </div>
        <div className="mt-2 text-sm font-bold text-slate-100">{result.sourceLabel}</div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{result.sourceDetail}</p>
        {result.publishedKm && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-[11px] text-slate-300">
            DoR published distance for this pair:
            <span className="ml-1 font-black text-emerald-300">{formatNumber(result.publishedKm, 1)} km</span>
            {result.publishedCitation && <span className="mt-1 block text-[10px] text-slate-500">{result.publishedCitation.table}</span>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          Data quality indicators
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {qualityChips.length > 0
            ? qualityChips.map((chip) => <QualityChip key={chip.text} text={chip.text} tone={chip.tone} />)
            : <QualityChip text="No additional quality flags" tone="info" />}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          These indicators describe the available source and route coverage. They do not certify current road conditions or guarantee travel time.
        </p>
      </div>
    </div>
  );

  const renderSector = (activeId: string) => {
    if (activeId === 'distance-overview') {
      return <ReelCard id="distance-overview" title="Journey overview" Icon={RouteIcon} hint="Your origin, destination and key figures">{overview}</ReelCard>;
    }
    if (activeId === 'distance-route') {
      return <ReelCard id="distance-route" title="Road breakdown" Icon={Gauge} hint="Route composition and available alternatives">{routeDetails}</ReelCard>;
    }
    return <ReelCard id="distance-evidence" title="Data & accuracy" Icon={ShieldCheck} hint="Sources, evidence and limitations">{evidence}</ReelCard>;
  };

  return (
    <section id="distance-report" className="space-y-3" aria-label="Distance report">
      <div className="distance-report-deck">
        <PlannerDeck
          items={items}
          activeId={activeSector}
          onChange={setActiveSector}
        >
          {renderSector}
        </PlannerDeck>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 shadow-lg">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-900/50"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-[10px] font-bold text-amber-300 transition hover:bg-amber-900/50"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        {onDownloadReport && (
          <button
            type="button"
            onClick={onDownloadReport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-700/60 bg-sky-950/40 px-3 py-2 text-[10px] font-bold text-sky-300 transition hover:bg-sky-900/50"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
        )}
        {onChangeLocation && (
          <button
            type="button"
            onClick={onChangeLocation}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-bold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <MapPin className="h-3.5 w-3.5" /> Change route
          </button>
        )}
      </div>

      <div className="distance-report-print">
        <div className="mb-4 border-b border-slate-300 pb-3">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-600">MeroSadak · Distance report</div>
          <div className="mt-2 text-lg font-bold text-slate-900">{originName} → {destinationName}</div>
          <div className="mt-1 text-3xl font-black text-slate-900">{formatNumber(result.totalKm, 1)} km</div>
          <div className="mt-1 text-xs text-slate-600">{methodologyLabel(result.methodology)} · {result.sourceLabel}</div>
        </div>
        <h3 className="mb-2 text-sm font-bold text-slate-900">Distance composition</h3>
        {result.segments.length > 0 && (
          <table className="mb-4 w-full border-collapse text-xs">
            <tbody>
              {result.segments.map((segment) => (
                <tr key={segment.label} className="border-b border-slate-200">
                  <td className="py-2 text-slate-700">{segment.label}</td>
                  <td className="py-2 text-right font-bold text-slate-900">{formatNumber(segment.km, 1)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h3 className="mb-2 text-sm font-bold text-slate-900">Road corridor</h3>
        <p className="mb-4 text-xs text-slate-700">{result.highwaysUsed.join(' → ') || 'Local road network / no surveyed corridor'}</p>
        <h3 className="mb-2 text-sm font-bold text-slate-900">Data source and quality</h3>
        <p className="text-xs text-slate-700">{result.sourceDetail}</p>
        <p className="mt-2 text-xs text-slate-700">{qualityChips.map((chip) => chip.text).join(' · ') || 'No additional quality flags'}</p>
      </div>
    </section>
  );
}

export default DistanceReport;
