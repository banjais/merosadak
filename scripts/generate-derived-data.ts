/**
 * generate-derived-data.ts — single-source-of-truth generator for derived datasets.
 *
 * Merges duplicated hand-maintained data into generated snapshots:
 *   1. public/data/cities-and-junctions.json
 *        SOURCE: CITIES_AND_JUNCTIONS in src/data/nepalHighwaysData.ts (66 curated
 *        cities/junctions — the live dataset used by 10+ modules). The JSON was a
 *        stale 26-entry subset, short-changing offline bundles by 40 cities.
 *   2. public/data/highway/index.json
 *        SOURCE: public/data/all-highways-79.json (79 highways, full metadata).
 *        The index was a second hand-maintained catalog of the same 79 highways;
 *        now a derived 5-field projection consumed by highwayCatalogue.ts,
 *        scripts/verify-hints.ts and the Worker (KV key "highway/index.json").
 *
 * Run: npx tsx scripts/generate-derived-data.ts   (also wired as `npm run sync:derived`)
 * Do NOT hand-edit the two JSON outputs — edit the sources and re-run.
 */
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CITIES_AND_JUNCTIONS } from '../src/data/nepalHighwaysData';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 1) cities-and-junctions.json — full curated set from the TS source of truth
const citiesPath = join(root, 'public/data/cities-and-junctions.json');
writeFileSync(citiesPath, JSON.stringify(CITIES_AND_JUNCTIONS, null, 2) + '\n');
console.log(`cities-and-junctions.json: ${CITIES_AND_JUNCTIONS.length} entries written`);

// 2) highway/index.json — projection of the authoritative all-highways-79.json
const all79 = JSON.parse(
  readFileSync(join(root, 'public/data/all-highways-79.json'), 'utf8')
) as Array<{ code: string; name: string; route: string; districts: string[]; file: string }>;

if (!Array.isArray(all79) || all79.length === 0) {
  throw new Error('all-highways-79.json missing or empty — aborting');
}

const index = all79.map((h) => ({
  code: h.code,
  name: h.name,
  route: h.route,
  districts: h.districts,
  file: h.file,
}));
const indexPath = join(root, 'public/data/highway/index.json');
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`highway/index.json: ${index.length} entries projected from all-highways-79.json`);
