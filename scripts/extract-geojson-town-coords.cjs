#!/usr/bin/env node
/**
 * Extracts town/city coordinates from DoR GeoJSON highway link endpoints.
 *
 * Each highway link feature in public/data/highway/*.geojson has:
 * - link_name: e.g. "Tikauli (Gondrang) - Central Bus Park Chowk"
 * - geometry.coordinates: LineString or MultiLineString
 *
 * The first and last coordinate of each line represents the physical location
 * of the named endpoints. By parsing link_name and pairing each side with the
 * matching geometry endpoint, we extract real surveyed coordinates for every
 * small town that lies on a national highway.
 *
 * DoR writes link_name inconsistently: some links use " - " ("Aslechaur - Kharbang")
 * and many others use a bare hyphen ("Ranke-Phidim"), so both separators are
 * handled by taking the first and last segment. Endpoints also carry survey
 * annotations - bridge numbers, boundary references, ring-road aliases - which
 * are stripped so one physical town does not appear as four different names.
 *
 * Output: public/data/geojson-town-coords.json
 *   {
 *     towns: [{ name, lat, lng, highways: ["NH01"], ... }],
 *     byHighway: { NH01: [townName, ...], ... },
 *     stats: {...}
 *   }
 */

const fs = require('fs');
const path = require('path');

const HIGHWAY_DIR = path.join(__dirname, '..', 'public', 'data', 'highway');
const OUT_FILE = path.join(__dirname, '..', 'public', 'data', 'geojson-town-coords.json');

/** Road classes that describe a stretch of highway, not a place name. */
const NON_PLACE_TOKENS = new Set([
  'bridge', 'bridges', 'culvert', 'causeway', 'tunnel',
  'boundary', 'municipality', 'metropolitan', 'sub', 'city',
]);

/** Survey annotations that are not part of the place name. */
const ANNOTATION_PATTERN =
  /\((?:[^)]*)\)/g; // (IB), (DB), (MRM), (NH 44), (KTM Ringroad), (Outer Ring Road) ...

function getLinkHighwayCode(properties, fileName) {
  const refno = properties?.road_refno || properties?.road_name;
  const code = String(refno || fileName).toUpperCase().replace(/\s+/g, '');
  const match = code.match(/NH\d+/);
  return match ? match[0] : path.basename(fileName, '.geojson').split('_')[0];
}

function extractEndpointCoord(coord) {
  if (!coord || !Array.isArray(coord)) return null;
  // GeoJSON coordinate: [lng, lat] or [lng, lat, elevation]
  if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
    return [coord[1], coord[0]]; // [lat, lng]
  }
  return null;
}

/**
 * Reduces a raw DoR endpoint label to the settlement a driver would call it:
 * "Gaur municipality boundary" -> "Gaur", "Bhatkepati(KTM Outer Ringroad)"
 * -> "Bhatkepati". Returns null when nothing usable is left, e.g. "IB".
 */
function cleanPlaceName(raw) {
  if (!raw) return null;
  // Parenthetical survey annotations go first and across the whole label: they
  // may themselves contain a hyphen ("Bangesimal (NH58-020)"), so stripping them
  // after splitting on hyphens would leave a broken "Bangesimal (NH58".
  let name = String(raw).replace(ANNOTATION_PATTERN, ' ');

  // Drop trailing survey words, e.g. "Punyamata bridge", "Martal Culvert".
  const words = name.split(/\s+/).filter(Boolean);
  while (words.length > 1 && NON_PLACE_TOKENS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  name = words.join(' ');

  // Strip dangling separators left by removed annotations, and repair the
  // unbalanced brackets DoR sometimes writes ("Koteswor KTM Ringroad)").
  name = name.replace(/[()[\]]/g, ' ');
  name = name.replace(/^[\s,;:-]+|[\s,;:-]+$/g, '').trim();
  if (!name) return null;
  // A single letter or pure punctuation is not a place.
  if (name.length < 2) return null;
  if (!/[A-Za-zऀ-ॿ]/.test(name)) return null;
  return name;
}

/**
 * Splits "A - B", "A-B" and "A-B-C" into its first and last segment, so a
 * three-stop label like "Manmat (MRM)-Kalaiya-Matiarwa (IB)" yields
 * ["Manmat", "Matiarwa"] rather than a bogus middle fragment.
 */
function parseLinkName(name) {
  if (!name) return null;
  const cleaned = cleanPlaceName(name);
  if (!cleaned) return null;

  // Split on hyphens only after the annotations are gone, so a hyphen inside
  // "(NH58-020)" can no longer act as a separator.
  const parts = cleaned
    .split(/\s+-\s+|\s*-\s*/)
    .map((part) => cleanPlaceName(part))
    .filter(Boolean);

  if (parts.length < 2) return { fromName: cleaned, toName: null };
  return { fromName: parts[0], toName: parts[parts.length - 1] };
}

/** Same town name can be labelled at slightly different points; merge within 400m. */
function coordsAreClose(a, b) {
  const dLat = (a.lat - b.lat) * 110.57;
  const dLng = (a.lng - b.lng) * 111.32 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng) < 0.4;
}

function main() {
  const files = fs.readdirSync(HIGHWAY_DIR).filter((f) => f.endsWith('.geojson'));
  /** name (lowercased) -> town record with merged highways */
  const townCoords = new Map();
  /** name (lowercased) -> first coords seen, for proximity de-duplication */
  const coordsByName = new Map();

  let featureCount = 0;
  let linkNameCount = 0;
  let skippedGeom = 0;
  let skippedName = 0;

  function record(name, coord, code) {
    if (!name || !coord) return;
    const key = name.toLowerCase();
    const existing = townCoords.get(key);
    if (existing) {
      if (!existing.highways.includes(code)) existing.highways.push(code);
      return;
    }
    // Same name elsewhere in Nepal (e.g. two "Gaur") must stay distinct, so key
    // the proximity map on name + position rather than name alone.
    for (const [otherKey, otherCoords] of coordsByName) {
      if (otherKey === key && coordsAreClose(coord, otherCoords)) {
        const near = townCoords.get(otherKey);
        if (near && !near.highways.includes(code)) near.highways.push(code);
        return;
      }
    }
    const record = {
      // Stable id: the loader keys places by id, so a resort of this file must
      // not renumber every town.
      id: `gtown-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      lat: Math.round(coord[0] * 1e6) / 1e6,
      lng: Math.round(coord[1] * 1e6) / 1e6,
      highways: [code],
      source: 'geojson_endpoint',
    };
    townCoords.set(key, record);
    coordsByName.set(key, { lat: record.lat, lng: record.lng });
  }

  for (const file of files) {
    const filePath = path.join(HIGHWAY_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.warn(`  skip ${file}: ${e.message}`);
      continue;
    }

    const code = getLinkHighwayCode(data.features?.[0]?.properties, file);
    const features = data.features || [];

    for (const feat of features) {
      featureCount++;
      const props = feat.properties || {};
      const name = props.link_name;

      if (!name) continue;
      linkNameCount++;

      const geom = feat.geometry;
      if (!geom || !geom.coordinates) {
        skippedGeom++;
        continue;
      }

      const coords = geom.coordinates;
      let firstCoord = null;
      let lastCoord = null;

      if (coords.length > 0) {
        if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
          const chain = coords[0];
          firstCoord = extractEndpointCoord(chain[0]);
          lastCoord = extractEndpointCoord(chain[chain.length - 1]);
        } else {
          firstCoord = extractEndpointCoord(coords);
          lastCoord = extractEndpointCoord(coords[coords.length - 1]);
        }
      }

      if (!firstCoord || !lastCoord) {
        skippedGeom++;
        continue;
      }

      const parsed = parseLinkName(name);
      if (!parsed) {
        skippedName++;
        continue;
      }

      record(parsed.fromName, firstCoord, code);
      if (parsed.toName) record(parsed.toName, lastCoord, code);
    }
  }

  const towns = Array.from(townCoords.values()).sort((a, b) => a.name.localeCompare(b.name));

  // One town can sit on several highways, so the corridor index lists it under
  // each of them.
  const byHighway = {};
  for (const town of towns) {
    for (const code of town.highways) {
      if (!byHighway[code]) byHighway[code] = [];
      byHighway[code].push(town.name);
    }
  }
  for (const code of Object.keys(byHighway)) byHighway[code].sort((a, b) => a.localeCompare(b));

  const highwaysWithNoTowns = [];
  const allCodes = new Set();
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(HIGHWAY_DIR, file), 'utf8'));
      allCodes.add(getLinkHighwayCode(data.features?.[0]?.properties, file));
    } catch {
      // already reported above
    }
  }
  for (const code of allCodes) if (!byHighway[code]) highwaysWithNoTowns.push(code);

  const out = {
    generatedAt: new Date().toISOString(),
    description: 'Town coordinates extracted from DoR GeoJSON highway link endpoints (link_name + geometry coordinates). These are real surveyed highway geometry endpoints for small towns and villages on national highway corridors.',
    source: 'DoR Highway Network GeoJSON (public/data/highway/*.geojson), link_name + geometry.coordinates',
    count: towns.length,
    highwayCount: Object.keys(byHighway).length,
    highwaysWithoutTowns: highwaysWithNoTowns,
    totalFeatures: featureCount,
    featuresWithLinkName: linkNameCount,
    featuresSkipped: skippedGeom,
    endpointsSkipped: skippedName,
    towns,
    byHighway,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');
  const sizeMb = (fs.statSync(OUT_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUT_FILE} (${sizeMb} MB)`);
  console.log(`Features: ${featureCount}`);
  console.log(`Features with link_name: ${linkNameCount}`);
  console.log(`Features skipped (no geometry): ${skippedGeom}`);
  console.log(`Endpoints skipped (unusable name): ${skippedName}`);
  console.log(`Unique towns extracted: ${towns.length}`);
  console.log(`Highways covered: ${Object.keys(byHighway).length} / ${allCodes.size}`);
  if (highwaysWithNoTowns.length) {
    console.log(`Highways without towns: ${highwaysWithNoTowns.join(', ')}`);
  }
}

main();
