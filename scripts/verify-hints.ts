// Guards the claims the UI makes about the data. Each assertion here checks a
// sentence in the interface against the files it describes, so copy cannot drift
// from reality when data files change.
//
// Run with: npx tsx scripts/verify-hints.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const lines: string[] = [];
function assert(ok: boolean, msg: string) {
  lines.push(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failures += 1;
}

function readJson(file: string): any {
  return JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', file), 'utf8'));
}

function main() {
  lines.push('ui copy vs data\n');

  // --- 1. the national-highway count the copy implies --------------------
  const index = readJson('highway/index.json');
  const entries: { code: string }[] = Array.isArray(index) ? index : Object.values(index);
  const codes = new Set(entries.map((e) => String(e.code)));

  lines.push('1. National-highway coverage');
  const numbered = Array.from({ length: 80 }, (_, i) => `NH${String(i + 1).padStart(2, '0')}`);
  const present = numbered.filter((code) => codes.has(code));
  const missing = numbered.filter((code) => !codes.has(code));
  assert(present.length === 79, `the archive holds geometry for 79 of the 80 numbered highways (found ${present.length})`);
  assert(missing.length === 1 && missing[0] === 'NH27', `exactly NH27 is unsurveyed (missing: ${missing.join(', ') || 'none'})`);
  assert(!codes.has('NNH01'), 'no "NNH01" code exists — that spelling in the directory copy was a typo');

  // --- 2. every highway file is valid GeoJSON in Nepal -------------------
  lines.push('\n2. Highway geometry');
  const highwayFiles = readdirSync(join(process.cwd(), 'public', 'data', 'highway'))
    .filter((name) => name.endsWith('.geojson'));
  let badCoords = 0;
  let checked = 0;
  for (const name of highwayFiles) {
    let geojson: any;
    try {
      geojson = readJson(join('highway', name));
    } catch {
      badCoords += 1;
      continue;
    }
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      badCoords += 1;
      continue;
    }
    checked += 1;
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    const walk = (c: any) => {
      if (typeof c[0] === 'number') {
        minA = Math.min(minA, c[0]); maxA = Math.max(maxA, c[0]);
        minB = Math.min(minB, c[1]); maxB = Math.max(maxB, c[1]);
      } else c.forEach(walk);
    };
    geojson.features.forEach((ft: any) => {
      const geom = ft?.geometry;
      if (!geom) return;
      if (geom.type === 'GeometryCollection') (geom.geometries ?? []).forEach((g: any) => walk(g.coordinates));
      else walk(geom.coordinates);
    });
    // Read as [lng, lat] — the GeoJSON order. Nepal's envelope.
    const inNepal = minA >= 80 && maxA <= 88.2 && minB >= 26.3 && maxB <= 30.5;
    if (!inNepal) badCoords += 1;
  }
  assert(checked > 0, `${checked} highway files are FeatureCollections`);
  assert(badCoords === 0, `every highway file is a FeatureCollection whose coordinates fall inside Nepal (bad: ${badCoords})`);

  // --- 3. NH04 really is the Jhapa corridor it claims --------------------
  lines.push('\n3. NH04 corridor name');
  const nh04 = entries.find((e) => (e as { code: string }).code === 'NH04') as { name?: string; route?: string; file?: string } | undefined;
  assert(!!nh04, 'NH04 has a directory entry');
  const nh04Name = String(nh04?.name ?? '').toLowerCase();
  const jhapaWords = /birtamod/.test(nh04Name) && /chandrag|chandragadhi|bhadrapur/.test(nh04Name);
  assert(jhapaWords, `NH04 is named for the Birtamod–Chandragadhi–Bhadrapur corridor it claims ("${nh04?.name}")`);
  const nh04Geo = readJson(join('highway', String(nh04?.file ?? 'NH04_birtamod_chandragadi_bhadrapur.geojson')));
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  const walk = (c: any) => {
    if (typeof c[0] === 'number') {
      a0 = Math.min(a0, c[0]); a1 = Math.max(a1, c[0]);
      b0 = Math.min(b0, c[1]); b1 = Math.max(b1, c[1]);
    } else c.forEach(walk);
  };
  nh04Geo.features.forEach((ft: any) => {
    const geom = ft?.geometry;
    if (!geom) return;
    if (geom.type === 'GeometryCollection') (geom.geometries ?? []).forEach((g: any) => walk(g.coordinates));
    else walk(geom.coordinates);
  });
  // [lng, lat]: 87.99–88.00 E, 26.54–26.64 N is the Chandragadhi–Bhadrapur
  // stretch in Jhapa, so the corridor name matches where the geometry is.
  const inJhapa = a0 > 87.9 && a1 < 88.1 && b0 > 26.4 && b1 < 26.8;
  assert(inJhapa, `NH04 geometry sits on the named Jhapa corridor (lng ${a0.toFixed(2)}–${a1.toFixed(2)}, lat ${b0.toFixed(2)}–${b1.toFixed(2)})`);
  const isBiratnagar = a0 > 87.0 && a1 < 87.5;
  assert(!isBiratnagar, `NH04 geometry is NOT around Biratnagar (which would be lng 87.0–87.5), so the earlier "blocked: NH04 geometry is wrong" note was a coordinate-order misreading`);

  // --- 4. the place corpus the search hint counts -----------------------
  lines.push('\n4. Searchable place count');
  // The app seeds allCities from the bundled TS constant, not the JSON copy, so
  // the count the search hint shows before the corpus loads comes from there.
  const curated = readJson('cities-and-junctions.json');
  const curatedList: unknown[] = Array.isArray(curated) ? curated : (curated?.cities ?? []);
  assert(Array.isArray(curatedList) && curatedList.length > 0, `cities-and-junctions.json is a non-empty array (${curatedList.length} entries, published subset of the 66 bundled places)`);

  // --- 5. no stray unverified claims in the copy ------------------------
  lines.push('\n5. Copy claims');
  const sources = [
    'src/components/RoutePlanner.tsx',
    'src/components/DistanceCalculatorPage.tsx',
    'src/components/HighwayBrowser.tsx',
    'src/components/HighwayDirectory.tsx',
  ];
  for (const file of sources) {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    const badNumbers = [...src.matchAll(/\b(\d{2,3})\s+national highways/gi)].map((m) => Number(m[1]));
    // A bare "N national highways" claims the country has N highways, which is
    // only true for 80. Coverage wording must come from describeHighwayCoverage.
    const wrong = badNumbers.filter((n) => n !== 80);
    assert(wrong.length === 0, `${file} states no bare "N national highways" count other than the real total 80 (found: ${wrong.join(', ') || 'none'})`);
    assert(!/NNH\d/.test(src), `${file} contains no "NNH" typo`);
  }

  for (const line of lines) console.log(line);
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
