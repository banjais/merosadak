#!/usr/bin/env node
/**
 * Extracts town/city coordinates from DoR GeoJSON highway link endpoints.
 *
 * Each highway link feature in public/data/highway/*.geojson has:
 * - link_name: e.g. "Tikauli (Gondrang) - Central Bus Park Chowk"
 * - geometry.coordinates: LineString or MultiLineString
 *
 * The first and last coordinate of each line represents the physical location
 * of the named endpoints. By parsing link_name (split on " - ") and pairing
 * each side with the matching geometry endpoint, we extract real surveyed
 * coordinates for every small town that lies on a national highway.
 *
 * Output: public/data/geojson-town-coords.json
 */

const fs = require('fs');
const path = require('path');

const HIGHWAY_DIR = path.join(__dirname, '..', 'public', 'data', 'highway');
const OUT_FILE = path.join(__dirname, '..', 'public', 'data', 'geojson-town-coords.json');

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

function parseLinkName(name) {
  if (!name) return null;
  const parts = name.split(' - ').map(s => s.trim());
  if (parts.length < 2) return null;
  const fromRaw = parts[0];
  const toRaw = parts[parts.length - 1];
  const fromName = fromRaw.replace(/ \([^)]+\)$/, '').replace(/ \(DB\)$/, '').trim();
  const toName = toRaw.replace(/ \(DB\)$/, '').trim();
  return { fromName, toName };
}

function main() {
  const files = fs.readdirSync(HIGHWAY_DIR).filter(f => f.endsWith('.geojson'));
  const townCoords = new Map();

  let featureCount = 0;
  let linkNameCount = 0;
  let skippedGeom = 0;

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
      if (!parsed) continue;

      if (parsed.fromName && !townCoords.has(parsed.fromName)) {
        townCoords.set(parsed.fromName, {
          name: parsed.fromName,
          lat: firstCoord[0],
          lng: firstCoord[1],
          highway: code,
          source: 'geojson_endpoint'
        });
      }

      if (parsed.toName && !townCoords.has(parsed.toName)) {
        townCoords.set(parsed.toName, {
          name: parsed.toName,
          lat: lastCoord[0],
          lng: lastCoord[1],
          highway: code,
          source: 'geojson_endpoint'
        });
      }
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    description: 'Town coordinates extracted from DoR GeoJSON highway link endpoints (link_name + geometry coordinates). These are real surveyed highway geometry endpoints for small towns and villages on national highway corridors.',
    source: 'DoR Highway Network GeoJSON (public/data/highway/*.geojson), link_name + geometry.coordinates',
    count: townCoords.size,
    totalFeatures: featureCount,
    featuresWithLinkName: linkNameCount,
    featuresSkipped: skippedGeom,
    towns: Array.from(townCoords.values()).sort((a, b) => a.name.localeCompare(b.name))
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');
  const sizeMb = (fs.statSync(OUT_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUT_FILE} (${sizeMb} MB)`);
  console.log(`Features: ${featureCount}`);
  console.log(`Features with link_name: ${linkNameCount}`);
  console.log(`Features skipped: ${skippedGeom}`);
  console.log(`Unique towns extracted: ${townCoords.size}`);
}

main();
