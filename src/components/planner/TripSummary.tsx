import React, { useState } from 'react';
import {
  ChevronDown,
  Clock,
  Compass,
  Fuel,
  MapPin,
  Mountain,
  Navigation,
  PhoneCall,
  Pencil,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
} from 'lucide-react';
import type { RoutePlanResult, RoutePreference, VehicleType } from '../../types';
import { PREFERENCE_CONFIGS, VEHICLE_CONFIGS } from '../../utils/vehicleConfigs';

export type TravelerMode = 'driver' | 'passenger';

interface TripSummaryProps {
  route: RoutePlanResult;
  costNpr: number;
  vehicle: VehicleType;
  preference: RoutePreference;
  mode: TravelerMode;
  tripStarted: boolean;
  onModeChange: (mode: TravelerMode) => void;
  onVehicleChange: (vehicle: VehicleType) => void;
  onPreferenceChange: (preference: RoutePreference) => void;
  onEdit: () => void;
  onStart: () => void;
  onShowOnMap?: () => void;
  onShare?: () => void;
  onOpenSos?: () => void;
}

const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const Kpi: React.FC<{ Icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone: string }> = ({
  Icon,
  label,
  value,
  tone,
}) => (
  <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      <Icon className={`h-3 w-3 ${tone}`} />
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-0.5 truncate font-mono text-sm font-bold text-white">{value}</div>
  </div>
);

/**
 * The one place a calculated route is summarised: endpoints, key numbers,
 * traveller mode, vehicle/route type and the primary action. Everything below
 * it (tabs) shows detail only, so nothing here is repeated.
 */
export const TripSummary: React.FC<TripSummaryProps> = ({
  route,
  costNpr,
  vehicle,
  preference,
  mode,
  tripStarted,
  onModeChange,
  onVehicleChange,
  onPreferenceChange,
  onEdit,
  onStart,
  onShowOnMap,
  onShare,
  onOpenSos,
}) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const vehicleCfg = VEHICLE_CONFIGS.find((v) => v.type === vehicle);
  const prefCfg = PREFERENCE_CONFIGS.find((p) => p.pref === preference);
  const driver = mode === 'driver';

  return (
    <section
      id="route-results-panel"
      aria-label="Trip summary"
      className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-3 backdrop-blur sm:p-4"
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-white">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-400" />
          <h2 className="min-w-0 truncate text-base font-bold leading-tight">
            {route.origin.name || route.origin.id}
            <span className="mx-1.5 text-slate-500">→</span>
            {route.destination.name || route.destination.id}
          </h2>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-slate-700"
        >
          <Pencil className="h-3 w-3" />
          <span>Change</span>
        </button>
      </div>

      <div className={`grid gap-2 ${driver ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <Kpi Icon={Compass} label="Distance" value={`${route.totalDistanceKm} km`} tone="text-emerald-400" />
        <Kpi Icon={Clock} label="Time" value={formatDuration(route.estimatedTimeMinutes)} tone="text-cyan-400" />
        {driver && <Kpi Icon={Fuel} label="Est. cost" value={`Rs ${costNpr.toLocaleString()}`} tone="text-amber-400" />}
        <Kpi Icon={ShieldCheck} label="Road score" value={`${route.roadConditionScore}`} tone="text-emerald-400" />
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <Mountain className="h-3 w-3 text-purple-400" />
        <span>Highest point {route.maxElevationM} m</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Travelling as" className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-0.5 text-[11px] font-bold">
          {([
            ['driver', 'Driving', User],
            ['passenger', 'Passenger', Users],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => onModeChange(id)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition ${
                mode === id ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-expanded={optionsOpen}
          onClick={() => setOptionsOpen((v) => !v)}
          className="flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-900"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span className="truncate">
            {vehicleCfg?.shortName} · {prefCfg?.label ?? preference}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${optionsOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {optionsOpen && (
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3 animate-fadeIn">
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Vehicle</div>
            <div className="grid grid-cols-5 gap-1">
              {VEHICLE_CONFIGS.map(({ type, shortName, icon: Icon, desc }) => (
                <button
                  key={type}
                  type="button"
                  title={`${shortName} - ${desc}`}
                  aria-pressed={vehicle === type}
                  onClick={() => onVehicleChange(type)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-0.5 py-2 text-center transition ${
                    vehicle === type
                      ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                      : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[9px] font-semibold leading-tight">{shortName}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Route type</div>
            <div className="flex flex-wrap gap-1.5">
              {PREFERENCE_CONFIGS.map(({ pref, icon, label, desc }) => (
                <button
                  key={pref}
                  type="button"
                  title={desc}
                  aria-pressed={preference === pref}
                  onClick={() => onPreferenceChange(pref)}
                  className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    preference === pref
                      ? 'border-cyan-500/60 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {tripStarted ? (
          <button
            id="btn-start-trip"
            type="button"
            onClick={onShowOnMap}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25"
          >
            <Navigation className="h-4 w-4" />
            Trip started · show on map
          </button>
        ) : (
          <button
            id="btn-start-trip"
            type="button"
            onClick={onStart}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
          >
            <Navigation className="h-4 w-4" />
            Start trip
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label="Share trip"
            className="rounded-2xl border border-slate-700 bg-slate-800 p-3 text-slate-200 transition hover:bg-slate-700"
          >
            <Share2 className="h-4 w-4" />
          </button>
        )}
        {onOpenSos && (
          <button
            type="button"
            onClick={onOpenSos}
            aria-label="Emergency SOS"
            className="rounded-2xl border border-red-500/50 bg-red-600/20 p-3 text-red-300 transition hover:bg-red-600/30"
          >
            <PhoneCall className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
};
