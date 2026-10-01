import React from 'react';
import { CityNode } from '../types';
import { getCityLink, HIGHWAY_TOUCH_KM } from '../utils/roadGraphRouter';

/**
 * One autocomplete row, shared by every place picker so the planner, the
 * distance calculator and any future surface render identical results.
 *
 * Deliberately narrow: name, settlement type, at most two highway codes and the
 * district. Elevation is omitted because it is 0 for geocoded places and reads
 * as "0m ASL" when the real figure is simply unknown.
 */

/** Cap the highway chip so a junction on four highways does not wrap the row. */
const MAX_HIGHWAY_CHIPS = 2;

export const formatCityHighwayCodes = (city: CityNode): string[] => {
  // Prefer the surveyed graph: it knows every highway within reach of the place,
  // where the curated list is a hand-written subset that can contradict it.
  const link = getCityLink(city);
  if (link && link.highways.length > 0) return link.highways;
  const codes = [...(city.connectedHighways ?? []), city.highwayCode].filter(
    (code): code is string => Boolean(code)
  );
  return [...new Set(codes)];
};

/**
 * How a place meets the highway network, as one of three states a driver can act
 * on. "on_highway" means the place sits on surveyed carriageway and routes
 * entirely over DoR geometry; "access" means a connector of a known length is
 * inferred to reach a highway; "off_corridor" means no highway is within reach,
 * so any route to it is mostly access road. "unknown" is reserved for a place
 * with no graph data at all, which must not be presented as either.
 */
export type HighwayTouchStatus = 'on_highway' | 'access' | 'off_corridor' | 'unknown';

export interface CityHighwayStatus {
  status: HighwayTouchStatus;
  /** Short badge text, e.g. "On highway" or "2.4 km access". */
  label: string;
  /** Tailwind classes for the badge. */
  className: string;
  accessKm: number | null;
}

const STATUS_STYLES: Record<HighwayTouchStatus, string> = {
  on_highway: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  access: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  off_corridor: 'bg-slate-800 text-slate-400 border-slate-700',
  unknown: 'bg-slate-800/60 text-slate-500 border-slate-800',
};

export function getCityHighwayStatus(city: CityNode): CityHighwayStatus {
  const link = getCityLink(city);

  if (!link) {
    return { status: 'unknown', label: 'No route data', className: STATUS_STYLES.unknown, accessKm: null };
  }
  if (link.onNetwork) {
    return { status: 'on_highway', label: 'On highway', className: STATUS_STYLES.on_highway, accessKm: 0 };
  }
  if (link.highways.length === 0) {
    return {
      status: 'off_corridor',
      label: link.accessKm != null ? `No highway within ${HIGHWAY_TOUCH_KM} km` : 'Not on a corridor',
      className: STATUS_STYLES.off_corridor,
      accessKm: link.accessKm,
    };
  }
  return {
    status: 'access',
    label: link.accessKm != null ? `${link.accessKm} km access` : 'Access road',
    className: STATUS_STYLES.access,
    accessKm: link.accessKm,
  };
}

/**
 * How the place reaches the highway network. Null when the graph has no link
 * data for it, so callers can fall back to plain display.
 */
export function getCityAccessNote(city: CityNode): string | null {
  const status = getCityHighwayStatus(city);
  if (status.status !== 'access' || status.accessKm == null) return null;
  return `${status.accessKm} km access to highway`;
}

interface CityResultRowProps {
  city: CityNode;
  onSelect: (city: CityNode) => void;
}

export const CityResultRow: React.FC<CityResultRowProps> = ({ city, onSelect }) => {
  const codes = formatCityHighwayCodes(city);
  const shownCodes = codes.slice(0, MAX_HIGHWAY_CHIPS);
  const hiddenCodeCount = codes.length - shownCodes.length;
  const locality = [city.district, city.province].filter(Boolean).join(' • ');
  const touch = getCityHighwayStatus(city);
  // The badge already carries the access figure, so the sub-line keeps locality
  // only and does not repeat "km access" twice.
  const secondLine = locality;

  return (
    <button
      type="button"
      onClick={() => onSelect(city)}
      title={`${city.name}: ${touch.label}`}
      className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 border border-transparent hover:border-slate-800 transition group"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">
          {city.name}
        </span>
        {city.cityType && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {city.cityType}
          </span>
        )}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${touch.className}`}>
          {touch.label}
        </span>
        {shownCodes.map((code) => (
          <span
            key={code}
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30"
          >
            {code}
          </span>
        ))}
        {hiddenCodeCount > 0 && (
          <span className="text-[9px] text-slate-500">+{hiddenCodeCount}</span>
        )}
      </div>
      {secondLine && <div className="text-[10px] text-slate-400 mt-0.5 truncate">{secondLine}</div>}
    </button>
  );
};

interface HighwayGroup {
  code: string;
  name: string;
  route: string;
  placeCount: number;
  places: CityNode[];
}

interface CitySuggestionDropdownProps {
  query: string;
  results: CityNode[];
  onSelect: (city: CityNode) => void;
  /** A geocode lookup for the typed query is in flight. */
  isSearchingMaps?: boolean;
  /**
   * Group results under a district heading and surface how many highways each
   * district's places join. A route is defined by the highways it connects, so
   * this answers "which of these can I actually leave from" faster than a flat
   * list of near-identical names.
   */
  groupByDistrict?: boolean;
  /**
   * Highways matching a code query, shown as a "places on this highway" block
   * above the district groups. Selecting a highway is what makes the long list
   * of small corridor towns reachable without typing a name.
   */
  highwayGroups?: HighwayGroup[];
  /** Called when a highway heading is picked, to load its corridor places. */
  onSelectHighway?: (code: string) => void;
  /** Total matches, so a capped list can report what is hidden. */
  totalMatches?: number;
  /**
   * One-line key for the touch badges. Without it the four states are guesswork,
   * which is the whole reason they are colour-coded.
   */
  showTouchLegend?: boolean;
}

interface DistrictGroup {
  label: string;
  places: CityNode[];
  /** Distinct highway codes across the group's places. */
  highwayCount: number;
  /** Places sitting directly on a highway, vs reached over access road. */
  onHighwayCount: number;
  accessCount: number;
}

/** Geocoded hits carry no real district; give them their own bucket. */
const MAP_MATCH_LABEL = 'Map match';

/** Orders buckets so real districts lead and the geocode fallback sinks. */
function districtRank(label: string): number {
  if (label === MAP_MATCH_LABEL) return 1;
  return 0;
}

/**
 * Within a district the places that join more highways come first: a
 * four-highway junction is a better route endpoint than a hamlet on one road.
 */
function byHighwayCountThenName(a: CityNode, b: CityNode): number {
  const diff = formatCityHighwayCodes(b).length - formatCityHighwayCodes(a).length;
  if (diff !== 0) return diff;
  return a.name.localeCompare(b.name);
}

export function groupResultsByDistrict(results: CityNode[]): DistrictGroup[] {
  const groups = new Map<string, DistrictGroup>();

  for (const city of results) {
    const raw = (city.district || '').trim();
    const label = !raw || raw === 'Geocoded' ? MAP_MATCH_LABEL : raw;
    let group = groups.get(label);
    if (!group) {
      group = { label, places: [], highwayCount: 0, onHighwayCount: 0, accessCount: 0 };
      groups.set(label, group);
    }
    group.places.push(city);
  }

  for (const group of groups.values()) {
    group.places.sort(byHighwayCountThenName);
    const codes = new Set<string>();
    for (const place of group.places) {
      for (const code of formatCityHighwayCodes(place)) codes.add(code);
      const touch = getCityHighwayStatus(place);
      if (touch.status === 'on_highway') group.onHighwayCount += 1;
      else if (touch.status === 'access') group.accessCount += 1;
    }
    group.highwayCount = codes.size;
  }

  return [...groups.values()].sort((a, b) => {
    const rank = districtRank(a.label) - districtRank(b.label);
    if (rank !== 0) return rank;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Dropdown body shared by every place picker, so a query that has not been
 * typed yet never flashes "no results" and a miss never looks like a bug.
 */
export const CitySuggestionDropdown: React.FC<CitySuggestionDropdownProps> = ({
  query,
  results,
  onSelect,
  isSearchingMaps = false,
  groupByDistrict = false,
  highwayGroups = [],
  onSelectHighway,
  totalMatches,
  showTouchLegend = false,
}) => {
  const groups = groupByDistrict ? groupResultsByDistrict(results) : [];
  const showHighwayBlock = highwayGroups.length > 0;
  const shownCount = results.length;
  const hiddenCount = totalMatches != null ? Math.max(0, totalMatches - shownCount) : 0;

  return (
    <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-[9999] max-h-72 overflow-y-auto space-y-1">
      {showTouchLegend && query.trim().length >= 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-1.5 pb-2 border-b border-slate-800/80 text-[9px] text-slate-500">
          <span className="uppercase tracking-[0.12em] font-bold">Highway</span>
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-sm border ${STATUS_STYLES.on_highway}`} />
            sits on a highway
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-sm border ${STATUS_STYLES.access}`} />
            access road to reach one
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-sm border ${STATUS_STYLES.off_corridor}`} />
            none within {HIGHWAY_TOUCH_KM} km
          </span>
        </div>
      )}
      {isSearchingMaps && !showHighwayBlock ? (
        <div className="px-4 py-6 text-center text-xs text-slate-400">Searching maps…</div>
      ) : results.length > 0 || showHighwayBlock ? (
        <>
          {showHighwayBlock && (
            <div className="mb-1">
              <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur px-3 pb-1 pt-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Places on this highway
                </span>
              </div>
              <div className="space-y-1">
                {highwayGroups.map((highway) => (
                  <div key={highway.code} className="rounded-xl border border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => onSelectHighway?.(highway.code)}
                      className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-900 transition"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          {highway.code}
                        </span>
                        <span className="text-xs font-bold text-white truncate">{highway.name}</span>
                        <span className="text-[9px] text-slate-500 shrink-0 ml-auto">
                          {highway.placeCount} places
                        </span>
                      </div>
                      {highway.route && (
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">{highway.route}</div>
                      )}
                    </button>
                    {highway.places.length > 0 && (
                      <div className="px-1 pb-1">
                        {highway.places.map((city) => (
                          <CityResultRow key={city.id} city={city} onSelect={onSelect} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {results.length > 0 &&
            (groupByDistrict ? (
            groups.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-slate-950/95 backdrop-blur px-3 pb-1 pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 truncate">
                    {group.label}
                  </span>
                  <span className="shrink-0 text-[9px] text-slate-500 flex items-center gap-2">
                    <span title="Places in this district that sit directly on a highway">
                      <span className="text-emerald-400 font-bold">{group.onHighwayCount}</span> on hwy
                    </span>
                    {group.accessCount > 0 && (
                      <span title="Places reached over an inferred access road">
                        <span className="text-sky-400 font-bold">{group.accessCount}</span> access
                      </span>
                    )}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.places.map((city) => (
                    <CityResultRow key={city.id} city={city} onSelect={onSelect} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            results.map((city) => <CityResultRow key={city.id} city={city} onSelect={onSelect} />)
            ))}
          {hiddenCount > 0 && (
            <div className="px-3 py-1.5 text-[10px] text-slate-500 text-center">
              {hiddenCount} more {hiddenCount === 1 ? 'match' : 'matches'} — keep typing to narrow
            </div>
          )}
        </>
      ) : query.trim().length < 1 ? (
        <div className="px-4 py-6 text-center text-xs text-slate-500">
          Start typing a place name, or a highway code like NH01
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-xs text-slate-500">
          No matching locations found
        </div>
      )}
    </div>
  );
};
