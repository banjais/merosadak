// Corridor search over the surveyed road graph: which places a national
// highway actually serves, and how each of them sits on that corridor.
//
// The catalogue is built from DoR link endpoints, so it covers every one of the
// 80 national highways rather than only the junctions somebody hand-listed.

import { CityNode } from '../types';
import { getRoadGraph, CityLink, HIGHWAY_TOUCH_KM } from './roadGraphRouter';

export interface HighwayCatalogueEntry {
  code: string;
  name: string;
  route: string;
  placeCount: number;
}

export interface HighwayPlace {
  code: string;
  name: string;
  lat: number;
  lng: number;
  /** Highways this point joins, from the graph rather than the source label. */
  highways: string[];
  /** False when the place reaches the corridor over an inferred connector. */
  onNetwork: boolean;
  accessKm: number | null;
}

interface TownRecord {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  highways: string[];
}

interface TownCatalogue {
  towns: TownRecord[];
  byHighway: Record<string, string[]>;
}

interface HighwayIndexEntry {
  code: string;
  name: string;
  route: string;
}

let catalogue: TownCatalogue | null = null;
let cataloguePromise: Promise<TownCatalogue | null> | null = null;
let highwayIndex: HighwayIndexEntry[] | null = null;
let highwayIndexPromise: Promise<HighwayIndexEntry[] | null> | null = null;

function loadCatalogue(): Promise<TownCatalogue | null> {
  if (catalogue) return Promise.resolve(catalogue);
  if (cataloguePromise) return cataloguePromise;
  cataloguePromise = fetch('/data/geojson-town-coords.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data: TownCatalogue | null) => {
      if (data && Array.isArray(data.towns)) catalogue = data;
      return catalogue;
    })
    .catch(() => null);
  return cataloguePromise;
}

function loadHighwayIndex(): Promise<HighwayIndexEntry[] | null> {
  if (highwayIndex) return Promise.resolve(highwayIndex);
  if (highwayIndexPromise) return highwayIndexPromise;
  highwayIndexPromise = fetch('/data/highway/index.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data: HighwayIndexEntry[] | null) => {
      if (Array.isArray(data)) {
        highwayIndex = data.filter((entry) => entry && typeof entry.code === 'string');
      }
      return highwayIndex;
    })
    .catch(() => null);
  return highwayIndexPromise;
}

export function preloadHighwayCatalogue(): Promise<unknown> {
  return Promise.all([loadCatalogue(), loadHighwayIndex(), Promise.resolve(getRoadGraph())]);
}

/** Every national highway in the catalogue, with the place count it serves. */
export function getHighwayCatalogue(): HighwayCatalogueEntry[] {
  const byHighway = catalogue?.byHighway ?? {};
  const names = new Map(highwayIndex?.map((entry) => [entry.code, entry]) ?? []);
  const codes = new Set([...Object.keys(byHighway), ...names.keys()]);

  return [...codes]
    .map((code) => {
      const meta = names.get(code);
      return {
        code,
        name: meta?.name ?? code,
        route: meta?.route ?? '',
        placeCount: byHighway[code]?.length ?? 0,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Normalises "nh44", "NH 44", "nh-44" to "NH44". */
export function normalizeHighwayCode(query: string): string | null {
  const cleaned = query.trim().toUpperCase().replace(/[\s-]/g, '');
  return /^NH\d{1,2}$/.test(cleaned) ? cleaned : null;
}

export function isHighwayQuery(query: string): boolean {
  return normalizeHighwayCode(query) !== null;
}

function townsForHighway(code: string): TownRecord[] {
  const cat = catalogue;
  if (!cat) return [];
  const names = new Set(cat.byHighway[code] ?? []);
  return cat.towns.filter((town) => names.has(town.name));
}

/**
 * Places a highway passes through, in corridor order where the source provides
 * it. Access figures come from the road graph, so a town 6 km off the carriageway
 * is reported as an access leg rather than as being "on" the highway.
 */
export function getHighwayPlaces(code: string): HighwayPlace[] {
  const normalized = normalizeHighwayCode(code);
  if (!normalized) return [];
  const graph = getRoadGraph();
  const linksById = graph?.cityLinksById;
  const linksByName = graph?.cityLinks;

  return townsForHighway(normalized).map((town) => {
    const link: CityLink | undefined =
      (town.id ? linksById?.[town.id] : undefined) ??
      linksByName?.[town.name.toLowerCase()];
    return {
      code: normalized,
      name: town.name,
      lat: town.lat,
      lng: town.lng,
      highways: link?.highways ?? town.highways,
      onNetwork: link?.onNetwork ?? true,
      accessKm: link?.accessKm ?? 0,
    };
  });
}

/**
 * Ranks a highway-code query against the catalogue. An exact code wins; a
 * partial code ("NH4") still matches NH04..NH49 so a driver does not have to
 * remember the zero padding.
 */
export function searchHighways(query: string, limit = 8): HighwayCatalogueEntry[] {
  const cleaned = query.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!cleaned) return [];
  const digits = cleaned.replace(/^NH/, '');

  return getHighwayCatalogue()
    .filter((entry) => {
      const codeDigits = entry.code.replace(/^NH/, '');
      if (cleaned.startsWith('NH')) {
        return codeDigits.startsWith(digits) || entry.name.toUpperCase().includes(cleaned);
      }
      return entry.code.includes(cleaned) || entry.name.toUpperCase().includes(cleaned);
    })
    .sort((a, b) => {
      const exactA = a.code === cleaned ? 0 : 1;
      const exactB = b.code === cleaned ? 0 : 1;
      if (exactA !== exactB) return exactA - exactB;
      return b.placeCount - a.placeCount;
    })
    .slice(0, limit);
}

/** A place on a highway, shaped for the shared suggestion row. */
export function highwayPlaceToCityNode(place: HighwayPlace, index: number): CityNode {
  return {
    id: `corridor-${place.code.toLowerCase()}-${place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
    name: place.name,
    nepaliName: '',
    district: '',
    province: '',
    cityType: 'Highway Town',
    lat: place.lat,
    lng: place.lng,
    elevationM: 0,
    isMajorHub: false,
    connectedHighways: place.highways.length > 0 ? place.highways : [place.code],
    highwayCode: place.code,
  };
}

export const HIGHWAY_TOUCH_RADIUS_KM = HIGHWAY_TOUCH_KM;
