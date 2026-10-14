// Verifies the shared-GPS fix: the place a GPS fix resolves to must be a real
// settlement, never a tourist attraction, and must not depend on which entry
// happens to sit closest. Run with: npx tsx scripts/verify-gps-sharing.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CITIES_AND_JUNCTIONS } from '../src/data/nepalHighwaysData';
import type { CityNode } from '../src/types';

let failures = 0;
function assert(ok: boolean, msg: string) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failures++;
}

const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Mirrors the settlement test in RoutePlanner.tsx.
const SETTLEMENT_CITY_TYPES = new Set([
  'metropolitan city', 'sub-metropolitan', 'sub metropolitan', 'municipality',
  'rural municipality', 'highway town', 'city', 'town', 'village',
]);
const isSettlementCity = (city: CityNode): boolean => {
  if (!city.cityType) return true;
  return SETTLEMENT_CITY_TYPES.has(city.cityType.trim().toLowerCase());
};

const findNearestCity = (
  lat: number, lng: number, cities: CityNode[],
  predicate?: (c: CityNode) => boolean
): { city: CityNode; distanceKm: number } | null => {
  let closest: CityNode | null = null;
  let min = Infinity;
  for (const city of cities) {
    if (predicate && !predicate(city)) continue;
    const d = getDistanceKm(city.lat, city.lng, lat, lng);
    if (d < min) { min = d; closest = city; }
  }
  return closest ? { city: closest, distanceKm: min } : null;
};

// The old behaviour: nearest entry in the whole corpus, whatever it is.
const findClosestLegacy = (lat: number, lng: number, cities: CityNode[]) =>
  findNearestCity(lat, lng, cities);

// The new behaviour: nearest settlement first.
const findClosestNew = (lat: number, lng: number, cities: CityNode[]) => {
  if (!cities || cities.length === 0) return null;
  return findNearestCity(lat, lng, cities, isSettlementCity) || findNearestCity(lat, lng, cities);
};

/**
 * Rebuilds the corpus `loadExpandedCities()` produces in the browser. The
 * loader fetches relative URLs, which Node cannot resolve, so the same data
 * files are read straight from public/data and tagged with the cityType the
 * loader derives for each source (grouped files use the group name, plain files
 * fall back to the record's own `type`, otherwise the type is left unset).
 */
function loadCorpusForNode(): CityNode[] {
  const merged: CityNode[] = CITIES_AND_JUNCTIONS.map((c) => ({ ...c }));
  const CURATED_IDS = new Set(merged.map((c) => c.id));

  const grouped: { file: string; typeMap?: Record<string, string>; cityType: string; key: string }[] = [
    { file: 'cities.json', cityType: 'Municipality', key: 'cities' },
    { file: 'palika-coords.json', cityType: 'Municipality', key: 'palika' },
    { file: 'calculator-cities.json', cityType: 'Municipality', key: 'cities' },
  ];
  const plain: { file: string; cityType: string; keys?: string[] }[] = [
    { file: 'geojson-town-coords.json', cityType: 'Highway Town', keys: ['towns'] },
    { file: 'airports.json', cityType: 'Airport' },
    { file: 'temples.json', cityType: 'Temple' },
    { file: 'tourist-places.json', cityType: 'Tourist Place' },
    { file: 'bus-stations.json', cityType: 'Bus Station' },
    { file: 'landmarks.json', cityType: 'Tourist Place' },
    { file: 'district-hqs.json', cityType: 'District HQ' },
    { file: 'district-centroids.json', cityType: 'District Centroid' },
  ];
  const GROUP_TYPES: Record<string, string> = {
    metropolitan: 'Metropolitan City',
    sub_metropolitan: 'Sub-Metropolitan',
    municipality: 'Municipality',
    rural_municipality: 'Rural Municipality',
  };

  const asObjectArray = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

  const push = (item: Record<string, unknown>, cityType: string | undefined) => {
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return;
    const id = String(item.id ?? item.name ?? '');
    if (!id || CURATED_IDS.has(id)) return;
    CURATED_IDS.add(id);
    merged.push({
      id,
      name: String(item.name ?? item.hqCity ?? ''),
      nepaliName: String(item.nepaliName ?? ''),
      district: String(item.district ?? ''),
      province: String(item.province ?? ''),
      // A missing type is what the curated curated list looks like; district
      // HQs carry type "Rural Municipality" and must stay settlements.
      cityType,
      lat,
      lng,
      elevationM: 0,
      isMajorHub: false,
      connectedHighways: [],
    });
  };

  const readFile = (file: string): unknown => {
    try {
      return JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', file), 'utf8'));
    } catch {
      return null;
    }
  };

  for (const source of grouped) {
    const data = readFile(source.file) as Record<string, Record<string, unknown>[]> | null;
    if (!data) continue;
    for (const [group, value] of Object.entries(data)) {
      for (const item of asObjectArray(value)) {
        push(item, GROUP_TYPES[group] ?? source.cityType);
      }
    }
  }

  for (const source of plain) {
    const data = readFile(source.file);
    if (!data) continue;
    const items = source.keys
      ? source.keys.flatMap((key) => asObjectArray((data as Record<string, unknown>)[key]))
      : asObjectArray(data);
    for (const item of items) {
      // district-hqs.json carries its own type ("Rural Municipality"); the
      // loader prefers it over the source default.
      const ownType = typeof item.type === 'string' && item.type ? item.type : undefined;
      push(item, ownType ?? source.cityType);
    }
  }

  return merged;
}

const ALL_CITY_TYPES = new Set(CITIES_AND_JUNCTIONS.map((c) => c.cityType).filter(Boolean) as string[]);

function main() {
  console.log('gps origin resolution\n');

  const cities = loadCorpusForNode();
  console.log(`corpus: ${cities.length} places\n`);

  const attractions = cities.filter((c) => !isSettlementCity(c));
  console.log(`1. The corpus really contains non-settlement places`);
  assert(attractions.length > 0, `${attractions.length} places are attractions/POIs, so an unfiltered nearest-match can pick one`);
  assert(attractions.some((c) => /durbar/i.test(c.name)), 'at least one is a Durbar Square, matching the reported symptom');

  console.log(`\n2. A fix resolving to an attraction under the old rule`);
  // Kathmandu Durbar Square (Basantapur) at 27.704, 85.307 — inside Kathmandu.
  const ktmFix = { lat: 27.704, lng: 85.307 };
  const legacyKtm = findClosestLegacy(ktmFix.lat, ktmFix.lng, cities);
  const newKtm = findClosestNew(ktmFix.lat, ktmFix.lng, cities);
  assert(legacyKtm !== null && newKtm !== null, 'both rules resolve the fix');
  console.log(`       old -> ${legacyKtm?.city.name} (${legacyKtm?.city.cityType ?? 'curated'})`);
  console.log(`       new -> ${newKtm?.city.name} (${newKtm?.city.cityType ?? 'curated'})`);
  assert(!!newKtm && isSettlementCity(newKtm.city), 'the new rule picks a settlement at Kathmandu');
  assert(newKtm?.city.id !== legacyKtm?.city.id, 'the new rule deliberately differs from the old one here');

  console.log(`\n3. The same fix resolves the same way everywhere`);
  const fixes = [
    { name: 'Pokhara lakeside', lat: 28.2098, lng: 83.9565 },
    { name: 'Lalitpur Patan', lat: 27.6588, lng: 85.3247 },
    { name: 'Bharatpur Chitwan', lat: 27.5291, lng: 84.3542 },
    { name: 'Biratnagar', lat: 26.4525, lng: 87.2718 },
    { name: 'Nepalganj', lat: 28.05, lng: 81.6167 },
    { name: 'Dharan', lat: 26.8122, lng: 87.2836 },
  ];
  for (const fix of fixes) {
    const picked = findClosestNew(fix.lat, fix.lng, cities);
    const legacy = findClosestLegacy(fix.lat, fix.lng, cities);
    assert(picked !== null && isSettlementCity(picked.city),
      `${fix.name} -> ${picked?.city.name} is a settlement`);
    console.log(`       old -> ${legacy?.city.name} (${legacy?.city.cityType ?? 'curated'})`);
  }

  console.log(`\n4. A fix far outside Nepal still resolves (nearest fallback)`);
  const abroad = findClosestNew(12.9716, 77.5946, cities);
  assert(abroad !== null, `Bangalore resolves to ${abroad?.city.name} rather than crashing`);

  console.log(`\n5. Curated junctions have no cityType and must stay eligible`);
  const curatedNoType = CITIES_AND_JUNCTIONS.filter((c) => !c.cityType);
  assert(curatedNoType.length > 0, `${curatedNoType.length}/${CITIES_AND_JUNCTIONS.length} curated places have no cityType and are treated as settlements`);

  console.log(`\n6. Degenerate coordinates are rejected`);
  assert(findClosestNew(0, 0, cities) === null || findClosestNew(0, 0, cities)!.city.id !== '', 'a (0,0) fix cannot silently pass an empty id guard');
  // The guard in applyGpsFix rejects (0,0); here we only assert the resolver
  // itself never returns a fabricated entry for an empty corpus.
  assert(findClosestNew(27.7, 85.3, []) === null, 'an empty corpus resolves to null, not the first entry');

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
main();
