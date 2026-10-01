import React, { useMemo, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { CityNode } from '../types';
import { getHighwayCatalogue, getHighwayPlaces } from '../utils/highwayCatalogue';
import { CityResultRow } from './CityResultRow';

interface HighwayBrowserProps {
  /**
   * Every searchable place, used to resolve a corridor town back to the real
   * record. The catalogue holds coordinates and highway codes, not a CityNode
   * with an id the rest of the app can route on, so the pick has to hand back a
   * genuine place or downstream routing silently fails.
   */
  cities: CityNode[];
  onSelectPlace: (city: CityNode) => void;
  onClose: () => void;
}

/** How many corridor places a highway shows before it is truncated. */
const PLACES_PER_HIGHWAY = 60;

/**
 * Browse the national highway network by corridor instead of by place name.
 *
 * This exists because the origin/destination form asks for knowledge most
 * drivers do not have. A user planning a trip knows they must reach Biratnagar;
 * they do not know which highways serve it. Listing all 80 corridors turns that
 * unknown into something they can read: name, route, and how many places it
 * serves. Picking a highway then picking a place on it needs no geographic
 * knowledge at all.
 */
export const HighwayBrowser: React.FC<HighwayBrowserProps> = ({ cities, onSelectPlace, onClose }) => {
  const [query, setQuery] = useState('');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const catalogue = useMemo(() => getHighwayCatalogue(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalogue;
    return catalogue.filter(
      (entry) =>
        entry.code.toLowerCase().includes(q) ||
        entry.name.toLowerCase().includes(q) ||
        entry.route.toLowerCase().includes(q)
    );
  }, [catalogue, query]);

  /**
   * Resolves a corridor town to the place record the rest of the app routes on.
   * Name alone is ambiguous where names repeat, so a candidate that also lists
   * the corridor highway wins.
   */
  const resolvePlace = (code: string, name: string): CityNode | null => {
    const target = name.toLowerCase();
    const candidates = cities.filter((city) => city.name.toLowerCase() === target);
    if (candidates.length === 0) return null;
    return (
      candidates.find((city) =>
        [...(city.connectedHighways ?? []), city.highwayCode].some(
          (hwy) => typeof hwy === 'string' && hwy.toUpperCase() === code
        )
      ) ?? candidates[0]
    );
  };

  const placesFor = (code: string) =>
    getHighwayPlaces(code)
      .slice(0, PLACES_PER_HIGHWAY)
      .map((place) => resolvePlace(code, place.name))
      .filter((place): place is CityNode => place !== null);

  const totalPlaces = getHighwayPlaces(expandedCode ?? '').length;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-t-2xl border border-slate-800 bg-slate-950 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Browse national highways"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">Browse by highway</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Pick a corridor, then a place on it. No need to know which highways serve a town.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close highway browser"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-800 p-3">
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter highways, e.g. NH01, Mahendra, Pokhara"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            {filtered.length} of {catalogue.length} national highways
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">
              No highway matches “{query.trim()}”
            </div>
          ) : (
            filtered.map((highway) => {
              const isOpen = expandedCode === highway.code;
              const places = isOpen ? placesFor(highway.code) : [];
              return (
                <div key={highway.code} className="mb-1 rounded-xl border border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setExpandedCode(isOpen ? null : highway.code)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-900"
                  >
                    <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                      {highway.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white">{highway.name}</span>
                      {highway.route && (
                        <span className="block truncate text-[10px] text-slate-400">{highway.route}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[9px] text-slate-500">
                      {highway.placeCount} places
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-800/80 p-1">
                      {places.length === 0 ? (
                        <div className="px-3 py-3 text-[11px] text-slate-500">
                          No places from the local catalogue sit on this corridor yet.
                        </div>
                      ) : (
                        places.map((city) => (
                          <CityResultRow
                            key={`${highway.code}-${city.id}`}
                            city={city}
                            onSelect={onSelectPlace}
                          />
                        ))
                      )}
                      {totalPlaces > places.length && (
                        <div className="px-3 py-2 text-[10px] text-slate-500">
                          Showing {places.length} of {totalPlaces}. Keep typing a name in the
                          calculator to reach the rest.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-800 px-4 py-2.5 text-[10px] text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          Each row shows whether the place sits on the highway or needs an access road.
        </div>
      </div>
    </div>
  );
};
