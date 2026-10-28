import React, { useState } from 'react';
import { ChevronDown, PhoneCall, Share2, SlidersHorizontal } from 'lucide-react';
import type { RoutePreference, VehicleType } from '../../types';
import { PREFERENCE_CONFIGS, VEHICLE_CONFIGS } from '../../utils/vehicleConfigs';

interface TripOptionsProps {
  vehicle: VehicleType;
  preference: RoutePreference;
  onVehicleChange: (vehicle: VehicleType) => void;
  onPreferenceChange: (preference: RoutePreference) => void;
  onShare?: () => void;
  onOpenSos?: () => void;
}

/**
 * Vehicle, route type, share and SOS in one slim bar under the trip header.
 * The header owns the route, KPIs and the start button, so none of that is
 * repeated here.
 */
export const TripOptions: React.FC<TripOptionsProps> = ({
  vehicle,
  preference,
  onVehicleChange,
  onPreferenceChange,
  onShare,
  onOpenSos,
}) => {
  const [open, setOpen] = useState(false);
  const vehicleCfg = VEHICLE_CONFIGS.find((v) => v.type === vehicle);
  const prefCfg = PREFERENCE_CONFIGS.find((p) => p.pref === preference);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-left text-xs font-semibold text-slate-300 transition hover:bg-slate-900"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="truncate">
            {vehicleCfg?.shortName} · {prefCfg?.label ?? preference}
          </span>
          <ChevronDown className={`ml-auto h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label="Share trip"
            className="rounded-2xl border border-slate-700 bg-slate-800 p-2.5 text-slate-200 transition hover:bg-slate-700"
          >
            <Share2 className="h-4 w-4" />
          </button>
        )}
        {onOpenSos && (
          <button
            type="button"
            onClick={onOpenSos}
            aria-label="Emergency SOS"
            className="rounded-2xl border border-red-500/50 bg-red-600/20 p-2.5 text-red-300 transition hover:bg-red-600/30"
          >
            <PhoneCall className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
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
    </div>
  );
};
