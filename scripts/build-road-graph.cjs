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
const CITY_SNAP_MAX_KM = 0.05;      // only treat a point as on-network within 50m
const CITY_INJECT_MAX_KM = 25;      // farther points need an explicit inferred access connector or remain unsnapped
const ENDPOINT_JOIN_MAX_KM = 0.25;   // merge nearby polyline endpoints (~250m) across gaps
const COMPONENT_JOIN_MAX_KM = 2.0;   // bridge small components to nearest other component
const JOIN_HWY_IDX = -1;             // synthetic join edges (not a real NH code)

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

const CALCULATOR_CITIES_FILE = path.join(__dirname, '..', 'public', 'data', 'calculator-cities.json');
const CITIES_JSON_FILE = path.join(__dirname, '..', 'public', 'data', 'cities.json');
const PALIKA_COORDS_FILE = path.join(__dirname, '..', 'public', 'data', 'palika-coords.json');
const GEO_TOWN_COORDS_FILE = path.join(__dirname, '..', 'public', 'data', 'geojson-town-coords.json');
const DISTRICT_CENTROIDS_FILE = path.join(__dirname, '..', 'public', 'data', 'district-centroids.json');

// Maximum additional cities to load from external sources to avoid bloating the graph
const EXTRA_CITY_SNAP_MAX_KM = 25; // only near-snap (not inject) for external cities

function loadCityNodes() {
  const src = fs.readFileSync(CITY_DATA_FILE, 'utf8');
  const block = src.match(/CITIES_AND_JUNCTIONS[\s\S]*?=\s*\[([\s\S]*?)\n\];/);
  if (!block) throw new Error('Could not locate CITIES_AND_JUNCTIONS array');
  const body = block[1];
  const entries = [];
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?lat:\s*([\d.\-]+),\s*lng:\s*([\d.\-]+)[\s\S]*?connectedHighways:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(body))) {
    const id = m[1];
    const name = m[2];
    const lat = parseFloat(m[3]);
    const lng = parseFloat(m[4]);
    const highways = m[5]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);
    entries.push({ id, name, lat, lng, highways, source: 'curated' });
  }

  // Also load calculator cities (SNH-published district HQs + bundled cities)
  // Filter out infrastructure points (EV chargers, tolls, weather, POIs, traffic)
  const calcData = JSON.parse(fs.readFileSync(CALCULATOR_CITIES_FILE, 'utf8'));
  const infraPrefixes = ['NH', 'ev-', 'toll-', 'wx-', 'poi-', 'tr-', 'inc-'];
  for (const city of calcData.cities || []) {
    const isInfra = infraPrefixes.some(p => city.id.startsWith(p));
    if (isInfra) continue;
    if (entries.some(e => e.id === city.id)) continue;
    entries.push({ 
      id: city.id, 
      lat: city.lat, 
      lng: city.lng, 
      highways: [],
      source: city.source 
    });
  }

  // Load additional small towns from external data sources
  // These are small municipalities/towns not in the curated or SNH published lists
  // but that still lie on highway routes
  loadExtraCities(entries, CITIES_JSON_FILE, 'cities_json', (item) => {
    return {
      id: `city-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
    };
  });

  loadExtraCities(entries, PALIKA_COORDS_FILE, 'palika_coords', (item) => {
    return {
      id: `pal-${item.Palika ? item.Palika.toLowerCase().replace(/\s+/g, '-') : ''}-${item.District ? item.District.toLowerCase() : ''}`,
      name: item.Palika,
      lat: item.lat,
      lng: item.lng,
    };
  });

  loadExtraCities(entries, GEO_TOWN_COORDS_FILE, 'geojson_town', (item) => {
    return {
      id: `gtown-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
    };
  });

  loadExtraCities(entries, DISTRICT_CENTROIDS_FILE, 'district_centroid', (item) => {
    return {
      id: `dcentroid-${item.name ? item.name.toLowerCase().replace(/\s+/g, '-') : ''}`,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
    };
  });

  return entries;
}

function loadExtraCities(entries, filePath, sourceLabel, mapper) {
  if (!fs.existsSync(filePath)) {
    console.log(`  ${sourceLabel}: file not found, skipping`);
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    let items = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (data && typeof data === 'object') {
      // Handle grouped format (e.g. cities.json: { metropolitan: [...], municipality: [...] })
      // or wrapper format (e.g. geojson-town-coords.json: { towns: [...] })
      if (Array.isArray(data.towns)) items = data.towns;
      else if (Array.isArray(data.cities)) items = data.cities;
      else {
        for (const v of Object.values(data)) {
          if (Array.isArray(v)) items = items.concat(v);
        }
      }
    }

    const added = [];
    for (const item of items) {
      const city = mapper(item);
      if (!city || !city.name) continue;
      if (!city.lat || !city.lng) continue;
      if (isNaN(city.lat) || isNaN(city.lng)) continue;
      if (entries.some(e => e.lat === city.lat && e.lng === city.lng)) continue;
      if (entries.some(e => e.id === city.id)) continue;
      entries.push({ id: city.id, name: city.name, lat: city.lat, lng: city.lng, highways: [], source: sourceLabel });
      added.push(city.name);
    }
    if (added.length > 0) {
      console.log(`  ${sourceLabel}: ${added.length} extra cities loaded`);
    }
  } catch (e) {
    console.warn(`  ${sourceLabel}: error reading - ${e.message}`);
  }
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

  // ---- snap cities (or inject missing nodes onto nearest highway) ----
  const cities = loadCityNodes();
  const citySnap = {};
  const citySnapByName = {};
  /** Per-city link facts derived from the built graph, not from curated claims. */
  const cityMeta = {};
  let snappedNear = 0;
  let injected = 0;
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
      if (city.name) citySnapByName[city.name.toLowerCase()] = bestId;
      cityMeta[city.id] = { accessKm: 0, onNetwork: true };
      snappedNear++;
    } else if (bestId >= 0 && bestDist <= CITY_INJECT_MAX_KM) {
      const cityNodeId = snapper.nodes.length;
      snapper.nodes.push([city.lat, city.lng]);
      const accessKm = Math.round(bestDist * 1000) / 1000;
      addEdge(cityNodeId, bestId, accessKm, JOIN_HWY_IDX);
      citySnap[city.id] = cityNodeId;
      if (city.name) citySnapByName[city.name.toLowerCase()] = cityNodeId;
      // The city is not on a highway; it reaches one over inferred access.
      cityMeta[city.id] = { accessKm, onNetwork: false };
      injected++;
      console.log(`  city ${city.id} injected @ ${accessKm}km access → node ${bestId}`);
    } else {
      unsnapped++;
      console.warn(`  city ${city.id} unsnapped (nearest ${bestDist === Infinity ? 'n/a' : bestDist.toFixed(1)}km)`);
    }
  }
  console.log(`Cities: ${snappedNear} near-snap, ${injected} injected, ${unsnapped} still missing / ${cities.length}`);

  // ---- automatic endpoint joins (close geometry gaps between surveyed links) ----
  function nodeDegree(id) {
    return (adjMap.get(id) || []).length;
  }

  function collectEndpoints(maxDegree = 1) {
    const eps = [];
    for (let id = 0; id < snapper.nodes.length; id++) {
      if (nodeDegree(id) <= maxDegree) eps.push(id);
    }
    return eps;
  }

  function componentsMap() {
    const compOf = new Int32Array(snapper.nodes.length).fill(-1);
    let compCount = 0;
    for (let start = 0; start < snapper.nodes.length; start++) {
      if (compOf[start] !== -1) continue;
      const queue = [start];
      compOf[start] = compCount;
      while (queue.length) {
        const cur = queue.pop();
        for (const e of adjMap.get(cur) || []) {
          if (compOf[e.to] === -1) {
            compOf[e.to] = compCount;
            queue.push(e.to);
          }
        }
      }
      compCount++;
    }
    const sizes = new Array(compCount).fill(0);
    for (let id = 0; id < snapper.nodes.length; id++) sizes[compOf[id]]++;
    return { compOf, compCount, sizes };
  }

  // Pass 1: join nearby endpoints (degree <= 1) within ENDPOINT_JOIN_MAX_KM
  let endpointJoins = 0;
  {
    const eps = collectEndpoints(1);
    // spatial grid ~ endpoint join radius
    const cellKm = Math.max(ENDPOINT_JOIN_MAX_KM, 0.05);
    const grid = new Map();
    function cellKey(lat, lng) {
      return `${Math.round(lat / (cellKm / 110.57))}|${Math.round(lng / (cellKm / (111.32 * Math.cos((lat * Math.PI) / 180))))}`;
    }
    for (const id of eps) {
      const [lat, lng] = snapper.nodes[id];
      const key = cellKey(lat, lng);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(id);
    }
    const paired = new Set();
    for (const id of eps) {
      if (paired.has(id)) continue;
      const [lat, lng] = snapper.nodes[id];
      let bestJ = -1;
      let bestD = Infinity;
      const gx = Math.round(lat / (cellKm / 110.57));
      const gy = Math.round(lng / (cellKm / (111.32 * Math.cos((lat * Math.PI) / 180))));
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(`${gx + dx}|${gy + dy}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= id || paired.has(j)) continue;
            // already connected?
            if ((adjMap.get(id) || []).some((e) => e.to === j)) continue;
            const d = haversineKm(snapper.nodes[id], snapper.nodes[j]);
            if (d < bestD && d > 0 && d <= ENDPOINT_JOIN_MAX_KM) {
              bestD = d;
              bestJ = j;
            }
          }
        }
      }
      if (bestJ >= 0) {
        addEdge(id, bestJ, bestD, JOIN_HWY_IDX);
        paired.add(id);
        paired.add(bestJ);
        endpointJoins++;
      }
    }
  }
  console.log(`Endpoint joins (<= ${ENDPOINT_JOIN_MAX_KM} km): ${endpointJoins}`);

  // Pass 2: bridge small components to nearest foreign node (grid-accelerated)
  let componentBridges = 0;
  {
    const { compOf, compCount, sizes } = componentsMap();
    let giantComp = 0;
    for (let c = 1; c < compCount; c++) if (sizes[c] > sizes[giantComp]) giantComp = c;

    const nodesByComp = Array.from({ length: compCount }, () => []);
    for (let id = 0; id < snapper.nodes.length; id++) nodesByComp[compOf[id]].push(id);

    // Spatial grid of all nodes for neighbor queries
    const cellKm = Math.max(COMPONENT_JOIN_MAX_KM / 2, 0.25);
    const grid = new Map();
    function cellKey(lat, lng) {
      return `${Math.round(lat / (cellKm / 110.57))}|${Math.round(lng / (cellKm / (111.32 * Math.cos((lat * Math.PI) / 180))))}`;
    }
    for (let id = 0; id < snapper.nodes.length; id++) {
      const [lat, lng] = snapper.nodes[id];
      const key = cellKey(lat, lng);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(id);
    }
    const cellSpan = Math.ceil(COMPONENT_JOIN_MAX_KM / cellKm) + 1;

    for (let c = 0; c < compCount; c++) {
      if (c === giantComp) continue;
      if (sizes[c] < 2) continue;
      const local = nodesByComp[c].filter((id) => nodeDegree(id) <= 2);
      const seeds = local.length ? local : nodesByComp[c];
      let best = null;
      for (const id of seeds) {
        const [lat, lng] = snapper.nodes[id];
        const gx = Math.round(lat / (cellKm / 110.57));
        const gy = Math.round(lng / (cellKm / (111.32 * Math.cos((lat * Math.PI) / 180))));
        for (let dx = -cellSpan; dx <= cellSpan; dx++) {
          for (let dy = -cellSpan; dy <= cellSpan; dy++) {
            const bucket = grid.get(`${gx + dx}|${gy + dy}`);
            if (!bucket) continue;
            for (const j of bucket) {
              if (compOf[j] === c) continue;
              const d = haversineKm(snapper.nodes[id], snapper.nodes[j]);
              if (d > 0 && d <= COMPONENT_JOIN_MAX_KM && (!best || d < best.d)) {
                best = { from: id, to: j, d };
              }
            }
          }
        }
      }
      if (best) {
        addEdge(best.from, best.to, best.d, JOIN_HWY_IDX);
        componentBridges++;
      }
    }
  }
  console.log(`Component bridges (<= ${COMPONENT_JOIN_MAX_KM} km): ${componentBridges}`);

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

  // Highways actually incident on each node. A city connector stub carries only
// h = -1 edges, so walk past those to the highway node it reaches.
const nodeHighways = new Map();
for (let id = 0; id < adjacency2.length; id++) {
  const list = adjacency2[id];
  for (const [, , h] of list) {
    if (h === JOIN_HWY_IDX) continue;
    let set = nodeHighways.get(id);
    if (!set) { set = new Set(); nodeHighways.set(id, set); }
    set.add(highwayList[h]);
  }
}

// A connector stub is one hop from its highway node; resolve through it.
function highwaysForCity(nodeId, depth = 0) {
  const direct = nodeHighways.get(nodeId);
  if (direct && direct.size) return direct;
  if (depth > 2) return new Set();
  const out = new Set();
  for (const [to, , h] of adjacency2[nodeId] || []) {
    if (h === JOIN_HWY_IDX) {
      for (const code of highwaysForCity(to, depth + 1)) out.add(code);
    }
  }
  return out;
}

// Nearest-single-highway under-reports badly: a metro centroid sits ~1 km from
// whatever road happens to be closest, which hides the other corridors that
// actually serve it (Kathmandu reads as ring-road-only). What a driver means by
// "highways touching this city" is every highway within reach of it, so collect
// them all inside a touch radius instead of taking the minimum.
const HIGHWAY_TOUCH_KM = 5;
const CELL_DEG = HIGHWAY_TOUCH_KM / 111.32;
const touchGrid = new Map();
for (const [nodeId, codes] of nodeHighways) {
  if (!codes.size) continue;
  const [la, ln] = snapper.nodes[nodeId];
  const key = `${Math.floor(la / CELL_DEG)}:${Math.floor(ln / CELL_DEG)}`;
  let bucket = touchGrid.get(key);
  if (!bucket) { bucket = []; touchGrid.set(key, bucket); }
  bucket.push(nodeId);
}

function highwaysWithinRadius(la, ln, radiusKm) {
  const found = new Set();
  const latSpan = Math.ceil(radiusKm / 111.32 / CELL_DEG) + 1;
  const baseRow = Math.floor(la / CELL_DEG);
  const baseCol = Math.floor(ln / CELL_DEG);
  for (let r = -latSpan; r <= latSpan; r++) {
    for (let c = -latSpan; c <= latSpan; c++) {
      const bucket = touchGrid.get(`${baseRow + r}:${baseCol + c}`);
      if (!bucket) continue;
      for (const nodeId of bucket) {
        const n = snapper.nodes[nodeId];
        if (haversineKm([la, ln], n) <= radiusKm) {
          for (const code of nodeHighways.get(nodeId)) found.add(code);
        }
      }
    }
  }
  return found;
}

const cityLinks = {};
for (const city of cities) {
  const nodeId = citySnap[city.id];
  if (nodeId === undefined) continue;
  const meta = cityMeta[city.id] || { accessKm: null, onNetwork: false };
  const linked = [...highwaysWithinRadius(city.lat, city.lng, HIGHWAY_TOUCH_KM)].sort();
  const key = city.name ? city.name.toLowerCase() : city.id;
  cityLinks[key] = {
    highways: linked,
    accessKm: meta.accessKm,
    onNetwork: meta.onNetwork,
    // Where the curated dataset and the surveyed graph disagree, keep both so
    // the UI can show the graph as authoritative rather than silently trusting
    // a hand-written highway list.
    claimedHighways: (city.highways || []).slice().sort(),
  };
}

const out = {
    nodes: snapper.nodes.map((n) => [Math.round(n[0] * 100000) / 100000, Math.round(n[1] * 100000) / 100000]),
    adjacency: adjacency2,
    highways: highwayList,
    citySnap,
    citySnapByName,
    cityLinks,
    stats: {
      generatedAt: new Date().toISOString(),
      files: files.length,
      nodeCount: snapper.nodes.length,
      citiesSnapped: Object.keys(citySnap).length,
      citiesTotal: cities.length,
      citySnapByNameEntries: Object.keys(citySnapByName).length,
      cityLinksEntries: Object.keys(cityLinks).length,
      citiesOnHighway: Object.values(cityLinks).filter((l) => l.onNetwork).length,
      citiesNeedingAccess: Object.values(cityLinks).filter((l) => !l.onNetwork).length,
      citiesWithNoHighway: Object.values(cityLinks).filter((l) => l.highways.length === 0).length,
      connectedComponents: components,
      giantComponentPct: Math.round((giant / snapper.nodes.length) * 1000) / 10,
      distanceBasis: 'DoR link_len-scaled highway geometry; inferred access and component connectors are included and tagged as non-highway edges',
      totalOfficialChainageKm: Math.round(totalOfficialKm),
      inferredAccessLinks: injected,
      unsnappedPlaces: unsnapped,
      endpointJoins,
      componentBridges,
      endpointJoinMaxKm: ENDPOINT_JOIN_MAX_KM,
      componentJoinMaxKm: COMPONENT_JOIN_MAX_KM,
    },
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  const sizeMb = (fs.statSync(OUT_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUT_FILE} (${sizeMb} MB)`);
}

main();
