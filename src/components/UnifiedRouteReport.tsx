import React, { useMemo, useState } from 'react';
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
  FileText,
  Fuel,
  Info,
  MapPin,
  Mountain,
  Printer,
  Route,
  Share2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { RoutePlanResult, RouteSimulationControls } from '../types';
import { EvidenceLevel, SNHCitation } from '../utils/snhLookup';
import { RouteElevationProfileChart } from './RouteElevationProfileChart';

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
  sourceControl?: React.ReactNode;
  vehicleLabel?: string;
  preferenceLabel?: string;
  onPrint: () => void;
  onShare: () => void;
  onChangeLocation?: () => void;
  showElevationProfile?: boolean;
  simulationControls?: RouteSimulationControls;
  onViewOnMap?: (target?: { lat: number; lng: number; title?: string; zoom?: number }) => void;
}

const evidenceLabels: Record<ReportEvidenceLevel, string> = {
  published: 'DoR Published',
  link_sum: 'Link-Sum',
  estimate: 'Estimate',
  route_graph: 'GIS Route',
};

const evidenceColors: Record<ReportEvidenceLevel, [number, number, number]> = {
  published: [16, 185, 129],
  link_sum: [59, 130, 246],
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
  icon: React.ElementType;
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
    <div className={`rounded-xl border p-3 transition hover:border-slate-600 ${tones[tone]} card-3d-elevated hover-lift-3d`}>
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
  sourceControl,
  vehicleLabel,
  preferenceLabel,
  onPrint,
  onShare,
  onChangeLocation,
  showElevationProfile,
  simulationControls,
  onViewOnMap,
}: UnifiedRouteReportProps) {
  const [expanded, setExpanded] = useState(false);
  const [showElevation, setShowElevation] = useState(false);
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
  const sourceLabel = distanceSourceLabel || distanceSource;
  const sourceUrl = distanceSourceUrl || (distanceSource === 'snh_published'
    ? 'https://dor.gov.np/home/page/statistics-of-national-highway--snh--2022-23'
    : distanceSource === 'dor_geojson_linksum'
      ? 'https://ssrn.dor.gov.np/road_network/getNationCategoryAndPavement'
      : undefined);
  const sourceDescription = distanceSourceDescription || (distanceSource === 'snh_published'
    ? 'Official Department of Roads published distance from Statistics of National Highway 2022/23.'
    : distanceSource === 'dor_geojson_linksum'
      ? 'DoR Archives survey geometry summed from per-link chainage.'
      : distanceSource === 'estimate_aerial'
        ? 'Aerial line-of-sight estimate; road distance will normally be longer.'
        : 'DoR Nepal highway GIS route geometry and certified road network.');

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

  const printLabel = distanceSource === 'snh_published' ? 'Proof Sheet / PDF' : 'Print / PDF';

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 shadow-xl shadow-black/20 sm:p-5 card-3d-heavy">
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
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-900/50"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-700/60 bg-amber-950/40 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 transition hover:bg-amber-900/50"
          >
            <Printer className="h-3.5 w-3.5" />
            {printLabel}
          </button>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 gap-cards">
        <MetricCard
          icon={Compass}
          label="Road distance"
          value={formatNumber(distanceKm, 2)}
          unit="km"
          detail={`${formatNumber(routeDistance, 2)} km route`}
          tone="emerald"
        />
        <MetricCard
          icon={Clock}
          label="Travel time"
          value={formatDuration(route.estimatedTimeMinutes)}
          detail="estimated"
          tone="cyan"
        />
        <MetricCard
          icon={route.fuelEstimate && route.fuelEstimate.avgMileageKmPerLiter ? Fuel : Zap}
          label={route.fuelEstimate && route.fuelEstimate.avgMileageKmPerLiter ? 'Fuel cost' : 'Energy cost'}
          value={`NPR ${fuelCost.toLocaleString('en-US')}`}
          detail={`${formatNumber(fuelQuantity, 1)} ${fuelUnit} estimated`}
          tone="amber"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Safety score"
          value={`${route.roadConditionScore}/100`}
          detail={`${route.statusSummary.clearKm} km clear`}
          tone="emerald"
        />
        <MetricCard
          icon={Mountain}
          label="Peak elev."
          value={`${route.maxElevationM} m`}
          detail={`+${route.elevationGainM} m climb`}
          tone="purple"
        />
        <MetricCard
          icon={Route}
          label="Detour"
          value={`+${detourPercent}%`}
          detail={`${formatNumber(aerialDistance, 1)} km vs direct`}
          tone="slate"
        />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5 text-left text-xs font-bold text-slate-200 transition hover:border-slate-600 hover:bg-slate-900 hover-lift-3d card-3d-flat"
        aria-expanded={expanded}
      >
        <span className="inline-flex items-center gap-2">
          {expanded ? <ChevronUp className="h-4 w-4 text-emerald-400" /> : <ChevronDown className="h-4 w-4 text-emerald-400" />}
          {expanded ? 'Hide detailed route report' : 'Expand detailed route report'}
        </span>
        <span className="text-[10px] font-medium text-slate-500">
          {route.steps.length} corridor steps · {route.incidentsOnRoute.length} advisories
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 animate-fadeIn gap-cards">
          {route.roadTierBreakdown && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 card-3d-elevated">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-emerald-400" />
                  Road classification & provenance
                </span>
                <span className="text-emerald-400">
                  {route.roadTierBreakdown.certifiedPercent}% DoR federal highway
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${route.roadTierBreakdown.certifiedPercent}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                <span>Federal highway: <strong className="text-slate-200">{formatNumber(route.roadTierBreakdown.highwayKm, 1)} km</strong></span>
                <span>Provincial / local: <strong className="text-slate-200">{formatNumber(route.roadTierBreakdown.provincialKm + route.roadTierBreakdown.localKm, 1)} km</strong></span>
                {route.roadTierBreakdown.communityKm > 0 && (
                  <span>Unpaved track: <strong className="text-slate-200">{formatNumber(route.roadTierBreakdown.communityKm, 1)} km</strong></span>
                )}
              </div>
</div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 card-3d-elevated">
            <div className="mb-2.5 text-xs font-semibold text-slate-300">Corridors traversed</div>
            <div className="space-y-2">
              {route.steps.map((step, index) => (
                <div key={`${step.instruction}-${index}`} className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-emerald-400">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] text-slate-200">{step.instruction}</span>
                  <span className="text-[10px] font-semibold text-slate-400">{formatNumber(step.distanceKm, 2)} km</span>
                  {step.certificationBadge && (
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${step.roadClassification === 'national_highway' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : step.roadClassification === 'provincial_feeder' ? 'border-blue-500/25 bg-blue-500/10 text-blue-400' : 'border-amber-500/25 bg-amber-500/10 text-amber-400'}`}>
                      {step.certificationBadge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 gap-cards">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 card-3d-elevated">
              <div className="mb-2 text-xs font-semibold text-slate-300">Surface</div>
              <div className="flex flex-wrap gap-1.5">
                {surfaces.map((surface) => (
                  <span key={surface} className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300">
                    {surfaceLabels[surface] || surface}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 card-3d-elevated">
              <div className="mb-2 text-xs font-semibold text-slate-300">Road status</div>
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /><span>{route.statusSummary.clearKm} km clear</span></div>
                {cautionKm > 0 && <div className="flex items-center gap-2 text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /><span>{cautionKm} km caution</span></div>}
                {obstructedKm > 0 && <div className="flex items-center gap-2 text-red-300"><AlertTriangle className="h-3.5 w-3.5" /><span>{obstructedKm} km obstructed</span></div>}
                {route.incidentsOnRoute.length > 0 && <div className="text-slate-400">{route.incidentsOnRoute.length} active advisory / advisories on this corridor.</div>}
              </div>
            </div>
          </div>

          {showElevationProfile && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 card-3d-elevated">
              <button
                type="button"
                onClick={() => setShowElevation((value) => !value)}
                className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 text-left hover-lift-3d card-3d-flat"
              >
                <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider">
                  <Mountain className="w-3.5 h-3.5 text-amber-400" />
                  <span>Elevation profile</span>
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                  <span>+{route.elevationGainM}m climb • Peak {route.maxElevationM}m</span>
                  {showElevation ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
              </button>
              {showElevation && simulationControls && (
                <div className="px-3.5 pb-3.5 animate-fadeIn">
                  <RouteElevationProfileChart
                    activeRoute={route}
                    routePlan={route}
                    vehicle={route.vehicle}
                    simulationControls={simulationControls}
                    onViewOnMap={onViewOnMap}
                    disableVehicleSwitch
                  />
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 card-3d-elevated">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-300">Distance evidence</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <strong className="text-slate-200">{sourceLabel}</strong>
                  <EvidenceBadge level={distanceEvidence} />
                </div>
                {citationText && <div className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{citationText}</div>}
                {distanceNote && <div className="mt-1.5 text-[10px] leading-relaxed text-amber-300/90"><Info className="inline-block h-3 w-3 align-[-2px]" /> {distanceNote}</div>}
              </div>
              <SourceLink label="Open source" href={sourceUrl} />
            </div>
            <div className="mt-2 text-[10px] leading-relaxed text-slate-500">{sourceDescription}</div>
          </div>
        </div>
      )}

      <footer className="mt-4 border-t border-slate-800 pt-3">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between card-3d-flat">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-cyan-500/80" />
              Route geometry: <span className="font-semibold text-slate-300">DoR Nepal Highway GIS</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-emerald-500/80" />
              Distance: <span className="font-semibold text-slate-300">{sourceLabel}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceLink label="DoR" href="https://dor.gov.np" />
            {distanceSource === 'snh_published' && <SourceLink label="SNH 2022/23" href="https://dor.gov.np/home/page/statistics-of-national-highway--snh--2022-23" />}
            {distanceSource === 'dor_geojson_linksum' && <SourceLink label="DoR SSRN" href="https://ssrn.dor.gov.np/road_network/getNationCategoryAndPavement" />}
          </div>
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
          Route geometry, published distances, link-sums and estimates are shown as separate evidence layers. They are not silently merged into one certified value.
        </p>
      </footer>
    </section>
  );
}
