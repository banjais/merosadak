import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Database,
  ExternalLink,
  Fuel,
  Info,
  MapPin,
  Mountain,
  Printer,
  Route,
  Share2,
  ShieldCheck,
  Zap,
  CreditCard,
  Receipt,
  Download,
} from 'lucide-react';
import { RoutePlanResult, RouteSimulationControls } from '../types';
import { EvidenceLevel, SNHCitation, getSourceDescription, getSourceLabel } from '../utils/snhLookup';
import { getTollPlazasForHighway, isEnteringKathmandu } from '../utils/tollRates.client';
import { RouteElevationProfileChart } from './RouteElevationProfileChart';
import { SwipeableReelStack, ReelCardItem } from './SwipeableReelStack';
import { DorLetterhead } from './DorLetterhead';
import { ReportIdentity, formatReportTimestamp } from '../utils/reportBranding';

export type ReportEvidenceLevel = EvidenceLevel | 'route_graph';

export interface UnifiedRouteReportProps {
  route: RoutePlanResult;
  distanceKm: number;
  distanceSource: string;
  distanceSourceLabel?: string;
  distanceSourceUrl?: string;
  distanceSourceDescription?: string;
  distanceEvidence?: ReportEvidenceLevel;
  distanceCitation?: SNHCitation | null;
  distanceNote?: string | null;
  distanceHighways?: string[];
  sourceControl?: React.ReactNode;
  vehicleLabel?: string;
  preferenceLabel?: string;
  onPrint: () => void;
  onShare: () => void;
  /** Download the report as a PDF instead of sending it to the printer. */
  onDownloadReport?: () => void;
  onChangeLocation?: () => void;
  /** Signed-in user, printed on the letterhead when present. */
  userIdentity?: ReportIdentity;
  /**
   * Render flat, without the outer card chrome. Use when the report already
   * sits inside a planner card — avoids a card nested inside a card.
   */
  embedded?: boolean;
  /**
   * Distance calculator shows distance only — no fuel cost, no tolls.
   * Route planner keeps cost metrics for drivers. Defaults to true.
   */
  showCostMetrics?: boolean;
  showElevationProfile?: boolean;
  simulationControls?: RouteSimulationControls;
  onViewOnMap?: (target?: { lat: number; lng: number; title?: string; zoom?: number }) => void;
  calculatorCoverage?: { total: number; publishedDistanceCoverage: { totalPublishedCities: number; coveredCities: number }; highwayCoverage?: { totalCities: number; citiesOnHighway: number } } | null;
}

const evidenceLabels: Record<ReportEvidenceLevel, string> = {
  published: 'DoR-published (SNH)',
  link_sum: 'DoR archive link-sum (derived)',
  geodesic: 'DoR archive route (derived)',
  estimate: 'Unverified aerial estimate',
  route_graph: 'Route planner GIS',
};

const evidenceColors: Record<ReportEvidenceLevel, [number, number, number]> = {
  published: [16, 185, 129],
  link_sum: [59, 130, 246],
  geodesic: [99, 102, 242],
  estimate: [245, 152, 61],
  route_graph: [148, 163, 184],
};

const surfaceLabels: Record<string, string> = {
  asphalt_excellent: 'Excellent asphalt',
  blacktopped_fair: 'Blacktopped',
  gravel: 'Gravel',
  under_construction: 'Under construction',
  offroad_mud: 'Off-road / mud',
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
}

function formatNumber(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function EvidenceBadge({ level }: { level: ReportEvidenceLevel }) {
  const color = evidenceColors[level];
  return (
    <span
      className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: `rgba(${color.join(',')}, 0.14)`,
        borderColor: `rgba(${color.join(',')}, 0.32)`,
        color: `rgb(${color.join(',')})`,
      }}
    >
      {evidenceLabels[level]}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  detail,
  tone = 'slate',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  tone?: 'emerald' | 'cyan' | 'amber' | 'purple' | 'slate';
}) {
  const tones: Record<string, string> = {
    emerald: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.06]',
    cyan: 'text-cyan-400 border-cyan-500/25 bg-cyan-500/[0.06]',
    amber: 'text-amber-400 border-amber-500/25 bg-amber-500/[0.06]',
    purple: 'text-purple-400 border-purple-500/25 bg-purple-500/[0.06]',
    slate: 'text-slate-200 border-slate-700/50 bg-slate-900/70',
  };

  return (
    <div className={`rounded-xl border p-3 transition hover:border-slate-600 ${tones[tone]} card card-interactive`}>
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1 text-2xl font-black font-display">
        <span>{value}</span>
        {unit && <span className="text-sm font-normal text-slate-400">{unit}</span>}
      </div>
      {detail && <div className="mt-1 text-[10px] leading-snug text-slate-400">{detail}</div>}
    </div>
  );
}

function SourceLink({ label, href }: { label: string; href?: string }) {
  if (!href) return <span className="text-slate-400">{label}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function HighwayBreakdownList({ route }: { route: RoutePlanResult }) {
  const groups = useMemo(() => {
    const map = new Map<string, { code: string; name: string; totalKm: number; segments: { label: string; distanceKm: number }[] }>();

    route.steps.forEach((step) => {
      const code = step.highwayCode || 'Local road';
      const key = code;
      const existing = map.get(key) ?? {
        code,
        name: step.highwayName || code,
        totalKm: 0,
        segments: [],
      };

      existing.totalKm += step.distanceKm;
      existing.segments.push({
        label: step.instruction || `${step.highwayCode || 'Road'} section`,
        distanceKm: step.distanceKm,
      });
      map.set(key, existing);
    });

    return [...map.values()].sort((a, b) => b.totalKm - a.totalKm);
  }, [route.steps]);

  if (!groups.length) return null;

  const totalRouteKm = groups.reduce((sum, group) => sum + group.totalKm, 0);

  return (
    <div className="border-t border-slate-800 pt-3">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-200">
        <span>Highway breakdown</span>
        <span className="text-[10px] text-cyan-300">{formatNumber(totalRouteKm, 1)} km total</span>
      </div>

      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <div key={group.code} className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300">{group.code}</div>
                <div className="truncate text-[11px] text-slate-200">{group.name}</div>
              </div>
              <span className="text-[10px] font-bold text-emerald-300">{formatNumber(group.totalKm, 1)} km</span>
            </div>

            <div className="mt-2 space-y-1.5">
              {group.segments.map((segment, idx) => (
                <div key={`${group.code}-${idx}`} className="flex items-center justify-between gap-3 text-[10px] text-slate-300">
                  <span className="min-w-0 flex-1 truncate">{segment.label}</span>
                  <span className="shrink-0 text-slate-400">{formatNumber(segment.distanceKm, 1)} km</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UnifiedRouteReport({
  route,
  distanceKm,
  distanceSource,
  distanceSourceLabel,
  distanceSourceUrl,
  distanceSourceDescription,
  distanceEvidence = 'route_graph',
  distanceCitation,
  distanceNote,
  distanceHighways = [],
  sourceControl,
  vehicleLabel,
  preferenceLabel,
  onPrint,
  onShare,
  onDownloadReport,
  onChangeLocation,
  userIdentity,
  embedded = false,
  showCostMetrics = true,
  showElevationProfile,
  simulationControls,
  onViewOnMap,
  calculatorCoverage,
}: UnifiedRouteReportProps) {
  const [expanded, setExpanded] = useState(false);
  const [showElevation, setShowElevation] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);
  const [reportTimestamp, setReportTimestamp] = useState(() => formatReportTimestamp(new Date()));

  // Refresh the letterhead stamp right before printing or downloading so the
  // printed sheet always carries the moment it was produced.
  const stampNow = () => setReportTimestamp(formatReportTimestamp(new Date()));

  useEffect(() => {
    if (!printMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(event.target as Node)) {
        setPrintMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [printMenuOpen]);
  const routeDistance = route.totalDistanceKm;
  const aerialDistance = route.aerialDistanceKm || 0;
  const detourPercent = aerialDistance > 0
    ? Math.round(((routeDistance - aerialDistance) / aerialDistance) * 100)
    : 0;
  const fuelCost = route.fuelEstimate?.costNpr || 0;
  const fuelUnit = route.fuelEstimate?.avgMileageKmPerLiter ? 'L' : 'kWh';
  const fuelQuantity = route.evEstimate?.kwhRequired || (route.fuelEstimate
    ? routeDistance / route.fuelEstimate.avgMileageKmPerLiter
    : 0);
  const elevationDelta = route.destination.elevationM - route.origin.elevationM;
  const surfaces = [...new Set(route.steps.map((step) => step.surface))];
  const cautionKm = route.statusSummary.cautionKm;
  const obstructedKm = route.statusSummary.obstructedKm;
  const sourceLabel = distanceSourceLabel || getSourceLabel(distanceSource as 'dor_snh' | 'dor_geojson' | 'estimate_aerial');
  const sourceUrl = distanceSourceUrl || (distanceSource === 'snh_published' || distanceSource === 'dor_geojson_linksum' || distanceSource === 'dor_snh'
    ? 'https://dor.gov.np/home/page/statistics-of-national-highway--snh--2022-23'
    : distanceSource === 'dor_geojson'
      ? 'https://ssrn.dor.gov.np/road_network/getNationCategoryAndPavement'
      : distanceSource === 'estimate_aerial'
        ? undefined
        : undefined);
  const sourceDescription = distanceSourceDescription || getSourceDescription(distanceSource as 'dor_snh' | 'dor_geojson' | 'estimate_aerial');

  // The reported total includes synthetic access and network-join edges, so the
  // surveyed share is what can honestly be called mapped highway geometry.
  const distanceParts = useMemo(() => {
    const b = route.distanceBreakdown;
    if (!b) return null;
    const parts = [
      { label: 'Origin access', km: b.originAccessKm, tone: 'text-amber-300' },
      { label: 'Surveyed highway', km: b.surveyedKm, tone: 'text-emerald-400' },
      { label: 'Network join', km: b.networkJoinKm, tone: 'text-cyan-300' },
      { label: 'Destination access', km: b.destAccessKm, tone: 'text-amber-300' },
    ];
    const sum = parts.reduce((acc, p) => acc + p.km, 0);
    if (!(sum > 0)) return null;
    return parts;
  }, [route.distanceBreakdown]);
  const surveyedSharePercent = distanceParts
    ? Math.round((distanceParts[1].km / distanceParts.reduce((acc, p) => acc + p.km, 0)) * 100)
    : null;

  const citationText = useMemo(() => {
    if (!distanceCitation) return '';
    return [
      distanceCitation.document,
      distanceCitation.table,
      distanceCitation.row ? `row ${distanceCitation.row}` : '',
      distanceCitation.printedPage ? `p.${distanceCitation.printedPage}` : '',
      distanceCitation.pdfPage ? `PDF p.${distanceCitation.pdfPage}` : '',
    ].filter(Boolean).join(' · ');
  }, [distanceCitation]);

  const printLabel = distanceSource === 'snh_published' ? 'Print / PDF' : 'Print / PDF';

  return (
    <section
      id="route-report"
      className="space-y-4"
    >
      <DorLetterhead timestamp={reportTimestamp} identity={userIdentity} />

      <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-base font-black font-display text-white">
            <span className="truncate">{route.origin.name}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="truncate">{route.destination.name}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {[vehicleLabel, preferenceLabel].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sourceControl}
          <div className="relative" ref={printMenuRef}>
            <button
              type="button"
              onClick={() => setPrintMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={printMenuOpen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-700/60 bg-amber-950/40 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 transition hover:bg-amber-900/50"
            >
              <Printer className="h-3.5 w-3.5" />
              {printLabel}
              <ChevronDown className={`h-3 w-3 transition-transform ${printMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {printMenuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 z-50 min-w-[190px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setPrintMenuOpen(false); stampNow(); onPrint(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-slate-100 transition hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5 text-amber-400" />
                  <span>Print directly to printer</span>
                </button>
                {onDownloadReport && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setPrintMenuOpen(false); stampNow(); onDownloadReport(); }}
                    className="flex w-full items-center gap-2 border-t border-slate-800 px-3 py-2 text-left text-[11px] font-semibold text-slate-100 transition hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5 text-sky-400" />
                    <span>Download report (PDF)</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-900/50"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          {onChangeLocation && (
            <button
              type="button"
              onClick={onChangeLocation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
            >
              <MapPin className="h-3.5 w-3.5" />
              Change
            </button>
          )}
        </div>
      </header>

      <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${showCostMetrics ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <div className="card card-elevated card-interactive p-3.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            <span>Distance</span>
            <EvidenceBadge level={distanceEvidence} />
          </div>
          <div className="mt-3 flex items-end gap-1.5">
            <span className="text-3xl font-black text-emerald-400 font-display">{formatNumber(distanceKm, 1)}</span>
            <span className="pb-1 text-sm text-slate-400">km</span>
          </div>
        </div>

        <div className="card card-elevated card-interactive p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Travel time</div>
          <div className="mt-3 text-2xl font-black text-cyan-400 font-display">{formatDuration(route.estimatedTimeMinutes)}</div>
          <p className="mt-2 text-[11px] text-slate-400">Estimated driving time by selected route profile.</p>
        </div>

        {showCostMetrics && (
        <div className="card card-elevated card-interactive p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Cost</div>
          <div className="mt-3 text-2xl font-black text-amber-400 font-display">NPR {fuelCost.toLocaleString('en-US')}</div>
          <p className="mt-2 text-[11px] text-slate-400">~{formatNumber(fuelQuantity, 1)} {fuelUnit} • Tolls separate</p>
        </div>
        )}

        <div className="card card-elevated card-interactive p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Safety</div>
          <div className="mt-3 text-2xl font-black text-emerald-400 font-display">{route.roadConditionScore}<span className="text-base text-slate-500">/100</span></div>
          <p className="mt-2 text-[11px] text-slate-400">{route.statusSummary.clearKm} km corridor is in clear condition.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-4">
          <div className="card card-elevated p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Route overview</div>
              <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">
                {evidenceLabels[distanceEvidence] || distanceEvidence}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Total route</div>
                <div className="mt-2 text-xl font-black text-white font-display">{formatNumber(routeDistance, 1)} km</div>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Detour</div>
                <div className="mt-2 text-xl font-black text-cyan-300 font-display">+{detourPercent}%</div>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Peak elevation</div>
                <div className="mt-2 text-xl font-black text-purple-300 font-display">{route.maxElevationM} m</div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {route.steps.map((step, index) => (
                <div key={`${step.instruction}-${index}`} className="flex flex-wrap items-center gap-2 border-t border-slate-800 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black text-emerald-400">{index + 1}</span>
                  <span className="min-w-0 flex-1 text-[11px] text-slate-200">{step.instruction}</span>
                  <span className="text-[10px] text-slate-400">{formatNumber(step.distanceKm, 1)} km</span>
                  {step.certificationBadge && (
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${step.roadClassification === 'national_highway' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'}`}>
                      {step.certificationBadge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <HighwayBreakdownList route={route} />

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5 text-left text-xs font-bold text-slate-200 transition hover:border-slate-700"
            aria-expanded={expanded}
          >
            <span className="inline-flex items-center gap-2">
              {expanded ? <ChevronUp className="h-4 w-4 text-emerald-400" /> : <ChevronDown className="h-4 w-4 text-emerald-400" />}
              {expanded ? 'Hide technical appendix' : 'Technical appendix'}
            </span>
            <span className="text-[10px] font-medium text-slate-500">{route.steps.length} steps</span>
          </button>

          {expanded && (
            <div className="card card-elevated p-4 animate-fadeIn">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Method and evidence</div>

              <div className="space-y-3">
                {route.roadTierBreakdown && (
                  <div className="border-t border-slate-800 pt-3">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-200">
                      <span>Road classification</span>
                      <span className="text-emerald-400">{surveyedSharePercent ?? route.roadTierBreakdown.certifiedPercent}% mapped to DoR highway geometry</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${surveyedSharePercent ?? route.roadTierBreakdown.certifiedPercent}%` }} /></div>
                  </div>
                )}

                {distanceParts && (
                  <div className="border-t border-slate-800 pt-3">
                    <div className="text-xs font-semibold text-slate-200">Distance composition</div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {distanceParts.map((part) => (
                        <div key={part.label} className="flex items-baseline justify-between gap-2 text-[10px]">
                          <span className="text-slate-500">{part.label}</span>
                          <span className={`font-bold ${part.tone}`}>{formatNumber(part.km, 1)} km</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">
                      Only surveyed highway geometry is DoR chainage. Access and join segments are
                      straight-line connectors Mero Sadak adds to reach a place off the mapped network.
                    </p>
                  </div>
                )}

                <div className="border-t border-slate-800 pt-3">
                  <div className="text-xs font-semibold text-slate-200">Source and citation</div>
                  {citationText && <div className="mt-1 text-[10px] text-slate-500">{citationText}</div>}
                  {distanceHighways.length > 0 && <div className="mt-2 text-[10px] text-cyan-300">Route highways: {distanceHighways.join(' → ')}</div>}
                  {distanceNote && <div className="mt-2 text-[10px] text-amber-300/90"><Info className="inline-block h-3 w-3 align-[-2px] mr-1" />{distanceNote}</div>}
                </div>

                {showCostMetrics && route.totalTollCostNpr > 0 && (
                  <div className="border-t border-slate-800 pt-3">
                    <div className="text-xs font-semibold text-slate-200">Toll estimate</div>
                    <div className="mt-2 text-lg font-black text-cyan-300 font-display">NPR {route.totalTollCostNpr.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card card-elevated p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <Database className="h-3.5 w-3.5 text-cyan-500" />
              <span>Methodology</span>
            </div>
            <div className="mt-3 space-y-3 text-[11px] text-slate-300">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Primary source</div>
                <div className="mt-1 font-semibold text-white">{sourceLabel}</div>
                <div className="mt-1 text-slate-400">{sourceDescription}</div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Evidence</div>
                <div className="mt-1"><EvidenceBadge level={distanceEvidence} /></div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Pair verification</div>
                <div className="mt-1 text-slate-300">{distanceEvidence === 'published' ? 'This exact place pair has a DoR-published SNH citation.' : 'No DoR-published distance is available for this city pair; the app uses route geometry or aerial fallback.'}</div>
              </div>
            </div>
          </div>

          <div className="card card-elevated p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Road condition</div>
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Surface</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {surfaces.map((surface) => (
                    <span key={surface} className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300">{surfaceLabels[surface] || surface}</span>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Status</div>
                <div className="mt-2 space-y-2 text-[11px]">
                  <div className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> <span>{route.statusSummary.clearKm} km clear</span></div>
                  {cautionKm > 0 && <div className="flex items-center gap-2 text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> <span>{cautionKm} km caution</span></div>}
                  {obstructedKm > 0 && <div className="flex items-center gap-2 text-red-300"><AlertTriangle className="h-3.5 w-3.5" /> <span>{obstructedKm} km obstructed</span></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-4 border-t border-slate-800 pt-3">
        <div className="flex flex-col gap-2 border-t border-slate-800 pt-3 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-cyan-500/80" />
              <span className="font-semibold text-slate-300">DoR Nepal Highway GIS · {sourceLabel}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceLink label="DoR" href="https://dor.gov.np" />
            {(distanceSource === 'snh_published' || distanceSource === 'dor_snh') && <SourceLink label="SNH 2022/23" href="https://dor.gov.np/home/page/statistics-of-national-highway--snh--2022-23" />}
            {distanceSource === 'dor_geojson' && <SourceLink label="SSRN" href="https://ssrn.dor.gov.np/road_network/getNationCategoryAndPavement" />}
          </div>
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-slate-600">Route geometry, published distances, link-sums and estimates are shown as separate evidence layers. They are not silently merged; the report states the source used and the roughness/uncertainty of the result.</p>
      </footer>
    </section>
  );
}
