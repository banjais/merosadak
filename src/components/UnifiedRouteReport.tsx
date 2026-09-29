import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Info,
  MapPin,
  Printer,
  Share2,
  Download,
} from 'lucide-react';
import { RoutePlanResult, RouteSimulationControls } from '../types';
import { EvidenceLevel, SNHCitation, getSourceDescription, getSourceLabel } from '../utils/snhLookup';
import { summarizeRouteHighways } from '../utils/routeHighwaySummary';
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
  distanceCalculatorMode?: boolean;
  /**
   * Render flat, without the outer card chrome. Use when the report already
   * sits inside a planner card — avoids a card nested inside a card.
   */
  embedded?: boolean;
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
  distanceCalculatorMode = false,
  embedded = false,
  showElevationProfile,
  simulationControls,
  onViewOnMap,
  calculatorCoverage,
}: UnifiedRouteReportProps) {
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
  const hasDistinctRouteDistance = formatNumber(routeDistance, 1) !== formatNumber(distanceKm, 1);
  const fuelCost = route.fuelEstimate?.costNpr || 0;
  const fuelUnit = route.evEstimate ? 'kWh' : 'L';
  const fuelQuantity = route.evEstimate?.kwhRequired ?? route.fuelEstimate.liters;
  const surfaces = [...new Set(route.steps.map((step) => step.surface))];
  const highwaySegments = useMemo(() => summarizeRouteHighways(route.steps), [route.steps]);
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
  const distanceLabel = distanceEvidence === 'estimate'
    ? 'Aerial estimate'
    : distanceEvidence === 'published'
      ? 'Published distance'
      : 'Derived distance';

  return (
    <section
      id="route-report"
      className="space-y-4"
    >
      <DorLetterhead timestamp={reportTimestamp} identity={userIdentity} />

      <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex items-center gap-3">
          <img src="/logo.svg" alt="Mero Sadak logo" className="h-12 w-12 rounded-2xl border border-slate-700 bg-slate-950/70 p-1.5 shadow-lg shadow-slate-950/30" />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-base font-black font-display text-white">
              <span className="truncate">{route.origin.name}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="truncate">{route.destination.name}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {[vehicleLabel, preferenceLabel].filter(Boolean).join(' · ')}
            </p>
          </div>
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
              {distanceCalculatorMode ? <Share2 className="h-3.5 w-3.5" /> : <Printer className="h-3.5 w-3.5" />}
              {distanceCalculatorMode ? 'Share / Export' : 'Print / PDF'}
              <ChevronDown className={`h-3 w-3 transition-transform ${printMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {printMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 z-50 min-w-[190px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl"
              >
                {distanceCalculatorMode && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setPrintMenuOpen(false); onShare(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-slate-100 transition hover:bg-slate-800"
                  >
                    <Share2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Share distance and route</span>
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setPrintMenuOpen(false); stampNow(); onPrint(); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-slate-100 transition hover:bg-slate-800 ${distanceCalculatorMode ? 'border-t border-slate-800' : ''}`}
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
          {!distanceCalculatorMode && (
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-900/50"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          )}
          {onChangeLocation && (
            <button
              type="button"
              onClick={onChangeLocation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <MapPin className="h-3.5 w-3.5" />
              Change
            </button>
          )}
        </div>
      </header>

      <div className="card card-elevated mt-4 p-4 sm:p-5">
        {distanceCalculatorMode ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{distanceLabel}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-black text-emerald-300 font-display">
                  {formatNumber(distanceKm, 1)} km
                </div>
              </div>
              {hasDistinctRouteDistance && (
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">GIS route length</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{formatNumber(routeDistance, 1)} km</div>
                </div>
              )}
            </div>

            {highwaySegments.length > 0 && (
              <div className="border-b border-slate-800 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Route highways</div>
                <div className="mt-2 space-y-2">
                  {highwaySegments.map((segment, index) => (
                    <div key={`${segment.highwayCode}-${segment.highwayName}-${segment.surface}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-slate-800 pt-2 first:border-t-0 first:pt-0">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold text-slate-100">{segment.highwayName}</span>
                        <span className="ml-2 font-mono text-[10px] text-cyan-300">{segment.highwayCode}</span>
                        <span className="ml-2 text-[10px] capitalize text-slate-400">{segment.roadClass}</span>
                      </div>
                      <div className="text-[10px] text-slate-300">
                        {surfaceLabels[segment.surface] || segment.surface.replaceAll('_', ' ')} · {formatNumber(segment.distanceKm, 1)} km
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Source & method</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-200">
                <SourceLink label={sourceLabel} href={sourceUrl} />
                <EvidenceBadge level={distanceEvidence} />
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{sourceDescription}</p>
              {highwaySegments.length > 0 && (
                <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                  Highway details are from the route planner GIS path. They are not a segment-by-segment verification or breakdown of the distance above.
                </p>
              )}
              {citationText && <p className="mt-2 text-[10px] text-slate-500">{citationText}</p>}
              {distanceHighways.length > 0 && highwaySegments.length === 0 && <p className="mt-2 text-[10px] text-cyan-300">Route: {distanceHighways.join(' → ')}</p>}
              {distanceNote && <p className="mt-2 text-[10px] text-amber-300/90"><Info className="mr-1 inline-block h-3 w-3 align-[-2px]" />{distanceNote}</p>}
            </div>
          </>
        ) : (
          <>
        <div className={`grid gap-x-6 gap-y-4 border-b border-slate-800 pb-4 sm:grid-cols-2 ${hasDistinctRouteDistance ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Distance</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-lg font-black text-emerald-300 font-display">
              {formatNumber(distanceKm, 1)} km
              <EvidenceBadge level={distanceEvidence} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Estimated drive</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{formatDuration(route.estimatedTimeMinutes)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Fuel estimate</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">
              NPR {fuelCost.toLocaleString('en-US')} · {formatNumber(fuelQuantity, 1)} {fuelUnit}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Peak elevation</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{route.maxElevationM} m</div>
          </div>
          {hasDistinctRouteDistance && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">GIS route distance</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{formatNumber(routeDistance, 1)} km</div>
            </div>
          )}
        </div>

        <div className="grid gap-6 py-4 lg:grid-cols-[1.5fr_1fr]">
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Route directions</h2>
            <div className="mt-2">
              {route.steps.map((step, index) => (
                <div key={`${step.instruction}-${index}`} className="flex flex-wrap items-center gap-2 border-t border-slate-800 py-2.5 first:border-t-0">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black text-emerald-400">{index + 1}</span>
                  <span className="min-w-0 flex-1 text-[11px] text-slate-200">{step.instruction}</span>
                  <span className="text-[10px] text-slate-400">{formatNumber(step.distanceKm, 1)} km</span>
                  {step.certificationBadge && (
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${step.roadClassification === 'national_highway' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : step.roadClassification === 'provincial_feeder' ? 'border-blue-500/25 bg-blue-500/10 text-blue-400' : 'border-amber-500/25 bg-amber-500/10 text-amber-400'}`}>
                      {step.certificationBadge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-5">
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Road condition</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {surfaces.map((surface) => (
                  <span key={surface} className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300">{surfaceLabels[surface] || surface}</span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />{route.statusSummary.clearKm} km clear</span>
                {cautionKm > 0 && <span className="flex items-center gap-1.5 text-amber-300"><AlertTriangle className="h-3.5 w-3.5" />{cautionKm} km caution</span>}
                {obstructedKm > 0 && <span className="flex items-center gap-1.5 text-red-300"><AlertTriangle className="h-3.5 w-3.5" />{obstructedKm} km obstructed</span>}
              </div>
            </section>

            <section className="border-t border-slate-800 pt-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Distance source</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-200">
                <SourceLink label={sourceLabel} href={sourceUrl} />
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{sourceDescription}</p>
              <p className="mt-2 text-[10px] text-slate-300">
                {distanceEvidence === 'published'
                  ? 'This exact place pair has a DoR-published SNH citation.'
                  : 'No DoR-published distance is available for this pair; the distance uses the evidence shown above.'}
              </p>
              {citationText && <p className="mt-2 text-[10px] text-slate-500">{citationText}</p>}
              {distanceHighways.length > 0 && <p className="mt-2 text-[10px] text-cyan-300">Route highways: {distanceHighways.join(' → ')}</p>}
              {distanceNote && <p className="mt-2 text-[10px] text-amber-300/90"><Info className="mr-1 inline-block h-3 w-3 align-[-2px]" />{distanceNote}</p>}
            </section>

            {route.roadTierBreakdown && (
              <section className="border-t border-slate-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <h2 className="font-semibold text-slate-200">DoR highway geometry coverage</h2>
                  <span className="text-emerald-400">{route.roadTierBreakdown.certifiedPercent}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${route.roadTierBreakdown.certifiedPercent}%` }} />
                </div>
              </section>
            )}

            {route.totalTollCostNpr > 0 && (
              <section className="border-t border-slate-800 pt-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Toll estimate</h2>
                <p className="mt-1 text-sm font-semibold text-slate-100">NPR {route.totalTollCostNpr.toLocaleString('en-US')}</p>
              </section>
            )}
          </div>
        </div>
          </>
        )}
      </div>
    </section>
  );
}
