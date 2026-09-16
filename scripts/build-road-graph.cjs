#!/usr/bin/env node
/**
 * Builds a routable road-network graph from the real DoR highway link
 * geometry in public/data/highway/*.geojson, and snaps every named
 * city/junction in src/data/nepalHighwaysData.ts onto that network.
 *
 * Output: public/data/road-graph.json
 *   {
 *     nodes: [[lat, lng], ...],                 // node id = array index
 *     adjacency: [[[toNodeId, distKm, hwyIdx], ...], ...],  // per node id
 *     highways: ["NH01", "NH02", ...],          // hwyIdx -> code
 *     citySnap: { cityId: nodeId, ... },
 *     stats: {...}
 *   }
 *
 * Run: node scripts/build-road-graph.cjs
 */
const fs = require('fs');
const path = require('path');

const HIGHWAY_DIR = path.join(__dirname, '..', 'public', 'data', 'highway');
const CITY_DATA_FILE = path.join(__dirname, '..', 'src', 'data', 'nepalHighwaysData.ts');
const OUT_FILE = path.join(__dirname, '..', 'public', 'data', 'road-graph.json');

// ---- tunables ----
const SIMPLIFY_TOLERANCE_KM = 0.05; // ~50m — Douglas-Peucker tolerance for rendering
const SNAP_GRID_KM = 0.06;          // ~60m — grid cell used to merge nearby vertices into shared graph nodes
const CITY_SNAP_MAX_KM = 8;         // don't snap a city onto a highway more than this far away

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Perpendicular distance (km, approx via equirectangular projection) from point p to line a-b
function perpDistKm(p, a, b) {
  const kx = 111.32 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  const ky = 110.57;
  const ax = a[1] * kx, ay = a[0] * ky;
  const bx = b[1] * kx, by = b[0] * ky;
  const px = p[1] * kx, py = p[0] * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Douglas-Peucker that returns the *indices* (into the original array) that survive
function simplifyIndices(points, toleranceKm) {
  const n = points.length;
  if (n < 3) return points.map((_, i) => i);
  const keep = new Array(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    if (end <= start + 1) continue;
    let maxDist = -1;
    let maxIdx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpDistKm(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist > toleranceKm) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

// ---- grid-based node snapping (union nearby vertices from different links/highways) ----
function makeSnapper(cellKm) {
  const cellDeg = cellKm / 111.0; // rough, fine at Nepal's latitudes
  const grid = new Map(); // "cellX,cellY" -> nodeId
  const nodes = []; // nodeId -> [lat,lng] (running centroid-ish: first-seen wins, good enough)

  function cellKey(lat, lng) {
    const cx = Math.round(lat / cellDeg);
    const cy = Math.round(lng / cellDeg);
    return `${cx},${cy}`;
  }

  function getOrCreate(lat, lng) {
    const key = cellKey(lat, lng);
    if (grid.has(key)) return grid.get(key);
    const id = nodes.length;
    nodes.push([lat, lng]);
    grid.set(key, id);
    return id;
  }

  return { getOrCreate, nodes };
}

function loadCityNodes() {
  const src = fs.readFileSync(CITY_DATA_FILE, 'utf8');
  const block = src.match(/CITIES_AND_JUNCTIONS[\s\S]*?=\s*\[([\s\S]*?)\n\];/);
  if (!block) throw new Error('Could not locate CITIES_AND_JUNCTIONS array');
  const body = block[1];
  const entries = [];
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)[\s\S]*?connectedHighways:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(body))) {
    const id = m[1];
    const lat = parseFloat(m[2]);
    const lng = parseFloat(m[3]);
    const highways = m[4]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);
    entries.push({ id, lat, lng, highways });
  }
  return entries;
}

function main() {
  const files = fs.readdirSync(HIGHWAY_DIR).filter((f) => f.endsWith('.geojson'));
  console.log(`Found ${files.length} highway files`);

  const snapper = makeSnapper(SNAP_GRID_KM);
  const highwayList = [];
  const highwayIndex = new Map();
  const adjacency = []; // parallel to snapper.nodes, filled after nodes known -> use array of arrays keyed by nodeId, grow lazily
  const adjMap = new Map(); // nodeId -> [{to, distKm, hwyIdx}]

  function addEdge(fromId, toId, distKm, hwyIdx) {
    if (fromId === toId || distKm <= 0) return;
    if (!adjMap.has(fromId)) adjMap.set(fromId, []);
    if (!adjMap.has(toId)) adjMap.set(toId, []);
    adjMap.get(fromId).push({ to: toId, d: Math.round(distKm * 1000) / 1000, h: hwyIdx });
    adjMap.get(toId).push({ to: fromId, d: Math.round(distKm * 1000) / 1000, h: hwyIdx });
  }

  let totalRawPoints = 0;
  let totalSimplifiedPoints = 0;
  let totalFeatures = 0;
  let totalChainKm = 0;
  let totalOfficialKm = 0;

  for (const file of files) {
    const full = path.join(HIGHWAY_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      console.warn(`  skip ${file}: ${e.message}`);
      continue;
    }
    const features = data.features || [];
    for (const feat of features) {
      totalFeatures++;
      const geom = feat.geometry;
      if (!geom) continue;
      const refno = (feat.properties && (feat.properties.road_refno || feat.properties.road_name)) || path.basename(file, '.geojson').split('_')[0];
      const code = String(refno).toUpperCase().replace(/\s+/g, '');
      if (!highwayIndex.has(code)) {
        highwayIndex.set(code, highwayList.length);
        highwayList.push(code);
      }
      const hwyIdx = highwayIndex.get(code);
      const officialLinkLenKm = typeof feat.properties?.link_len === 'number' && feat.properties.link_len > 0
        ? feat.properties.link_len
        : null;

      let chains = [];
      if (geom.type === 'LineString') chains = [geom.coordinates];
      else if (geom.type === 'MultiLineString') chains = geom.coordinates;
      else continue;

      // Convert once, and get this feature's total *geometric* length across
      // all its chains, so we can scale to DoR's official chainage length
      // (link_len) — the government-surveyed distance for this exact link —
      // while keeping the real coordinate shape for rendering untouched.
      const chainPtsList = chains
        .filter((c) => c && c.length >= 2)
        .map((chain) => chain.map((c) => [c[1], c[0]])); // [lng,lat] -> [lat,lng]

      let featureGeomKm = 0;
      for (const pts of chainPtsList) {
        for (let i = 0; i < pts.length - 1; i++) featureGeomKm += haversineKm(pts[i], pts[i + 1]);
      }
      const officialScale = officialLinkLenKm && featureGeomKm > 0 ? officialLinkLenKm / featureGeomKm : 1;
      totalOfficialKm += officialLinkLenKm ?? featureGeomKm;

      for (const pts of chainPtsList) {
        totalRawPoints += pts.length;

        const keepIdx = simplifyIndices(pts, SIMPLIFY_TOLERANCE_KM);
        totalSimplifiedPoints += keepIdx.length;

        // snap each *kept* point to a graph node
        const nodeIds = keepIdx.map((i) => snapper.getOrCreate(pts[i][0], pts[i][1]));

        for (let k = 0; k < keepIdx.length - 1; k++) {
          const segStart = keepIdx[k];
          const segEnd = keepIdx[k + 1];
          // geometric distance from the ORIGINAL points in this sub-range,
          // then rescaled so the link's total matches DoR's official
          // chainage length (link_len) rather than just our own GIS math —
          // that's what makes the number traceable back to DoR's own record.
          let d = 0;
          for (let i = segStart; i < segEnd; i++) d += haversineKm(pts[i], pts[i + 1]);
          d *= officialScale;
          totalChainKm += d;
          addEdge(nodeIds[k], nodeIds[k + 1], d, hwyIdx);
        }
      }
    }
  }

  console.log(`Features: ${totalFeatures}`);
  console.log(`Raw points: ${totalRawPoints} -> simplified: ${totalSimplifiedPoints}`);
  console.log(`Graph nodes (post-snap): ${snapper.nodes.length}`);
  console.log(`Total network length — DoR official chainage (link_len) basis: ${totalOfficialKm.toFixed(0)} km`);
  console.log(`Total network length — as stored in graph edges (should match, scaled): ${totalChainKm.toFixed(0)} km`);

  // ---- snap cities ----
  const cities = loadCityNodes();
  const citySnap = {};
  let unsnapped = 0;
  for (const city of cities) {
    let bestId = -1;
    let bestDist = Infinity;
    for (let id = 0; id < snapper.nodes.length; id++) {
      const d = haversineKm([city.lat, city.lng], snapper.nodes[id]);
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }
    if (bestId >= 0 && bestDist <= CITY_SNAP_MAX_KM) {
      citySnap[city.id] = bestId;
    } else {
      unsnapped++;
      console.warn(`  city ${city.id} unsnapped (nearest ${bestDist.toFixed(1)}km)`);
    }
  }
  console.log(`Cities snapped: ${cities.length - unsnapped}/${cities.length}`);

  // ---- connectivity check (BFS from node 0's component sizes not needed; check how many cities share the giant component) ----
  const visited = new Uint8Array(snapper.nodes.length);
  function bfsSize(start) {
    if (visited[start]) return 0;
    let count = 0;
    const queue = [start];
    visited[start] = 1;
    while (queue.length) {
      const cur = queue.pop();
      count++;
      const neighbors = adjMap.get(cur) || [];
      for (const e of neighbors) {
        if (!visited[e.to]) {
          visited[e.to] = 1;
          queue.push(e.to);
        }
      }
    }
    return count;
  }
  let giant = 0;
  let components = 0;
  for (let id = 0; id < snapper.nodes.length; id++) {
    if (!visited[id]) {
      const size = bfsSize(id);
      components++;
      if (size > giant) giant = size;
    }
  }
  console.log(`Connected components: ${components}, largest: ${giant} nodes (${((giant / snapper.nodes.length) * 100).toFixed(1)}%)`);

  // build final adjacency array (index = nodeId)
  const adjacency2 = snapper.nodes.map((_, id) => {
    const list = adjMap.get(id) || [];
    // dedupe identical (to,h) pairs, keep shortest
    const seen = new Map();
    for (const e of list) {
      const key = `${e.to}-${e.h}`;
      if (!seen.has(key) || seen.get(key).d > e.d) seen.set(key, e);
    }
    return Array.from(seen.values()).map((e) => [e.to, e.d, e.h]);
  });

  const out = {
    nodes: snapper.nodes.map((n) => [Math.round(n[0] * 100000) / 100000, Math.round(n[1] * 100000) / 100000]),
    adjacency: adjacency2,
    highways: highwayList,
    citySnap,
    stats: {
      generatedAt: new Date().toISOString(),
      files: files.length,
      nodeCount: snapper.nodes.length,
      citiesSnapped: cities.length - unsnapped,
      citiesTotal: cities.length,
      connectedComponents: components,
      giantComponentPct: Math.round((giant / snapper.nodes.length) * 1000) / 10,
      distanceBasis: 'DoR official chainage (link_len) per survey link, Department of Roads, Government of Nepal',
      totalOfficialChainageKm: Math.round(totalOfficialKm),
    },
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  const sizeMb = (fs.statSync(OUT_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUT_FILE} (${sizeMb} MB)`);
}

main();
