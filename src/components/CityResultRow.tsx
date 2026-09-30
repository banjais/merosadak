import React from 'react';
import { CityNode } from '../types';

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
  const codes = [...(city.connectedHighways ?? []), city.highwayCode].filter(
    (code): code is string => Boolean(code)
  );
  return [...new Set(codes)];
};

interface CityResultRowProps {
  city: CityNode;
  onSelect: (city: CityNode) => void;
}

export const CityResultRow: React.FC<CityResultRowProps> = ({ city, onSelect }) => {
  const codes = formatCityHighwayCodes(city);
  const shownCodes = codes.slice(0, MAX_HIGHWAY_CHIPS);
  const hiddenCodeCount = codes.length - shownCodes.length;
  const locality = [city.district, city.province].filter(Boolean).join(' • ');

  return (
    <button
      type="button"
      onClick={() => onSelect(city)}
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
      {locality && <div className="text-[10px] text-slate-400 mt-0.5 truncate">{locality}</div>}
    </button>
  );
};

interface CitySuggestionDropdownProps {
  query: string;
  results: CityNode[];
  onSelect: (city: CityNode) => void;
  /** A geocode lookup for the typed query is in flight. */
  isSearchingMaps?: boolean;
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
}) => (
  <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-[9999] max-h-60 overflow-y-auto space-y-1">
    {isSearchingMaps ? (
      <div className="px-4 py-6 text-center text-xs text-slate-400">Searching maps…</div>
    ) : results.length > 0 ? (
      results.map((city) => <CityResultRow key={city.id} city={city} onSelect={onSelect} />)
    ) : query.trim().length < 2 ? (
      <div className="px-4 py-6 text-center text-xs text-slate-500">
        Type at least 2 characters to search Nepali places
      </div>
    ) : (
      <div className="px-4 py-6 text-center text-xs text-slate-500">
        No matching locations found
      </div>
    )}
  </div>
);
