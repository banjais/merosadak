#!/usr/bin/env node
/**
 * stitch-edge-geometry.cjs
 * ------------------------
 * Produces public/data/edge-geometry-patch.json — baked ON-HIGHWAY geometry
 * for curated ROAD_NETWORK_EDGES whose real road-graph route is missing or
 * implausible (survey coverage gaps force absurd detours), so the drawn trip
 * line lies on the actual DoR highway instead of a hand-estimated 3-point
 * chord.
 *
 * Method per edge (mirrors routeOptimizer's runtime rules exactly):
 *   1. Replicate findRoadGraphRoute() over public/data/road-graph.json.
 *      If a plausible path exists (km <= 2.5 x curated), runtime already uses
 *      it — no patch needed.
 *   2. Otherwise STITCH from the raw DoR survey GeoJSON:
 *        - union survey vertices into nodes (45m grid, same idea as the
 *          road-graph builder), consecutive points along each LineString are
 *          connected, cross-link points within tolerance are merged;
 *        - keep only the corridor around the origin->destination line
 *          (radius = max(3km, 1.3 x worst curated intermediate deviation));
 *        - Dijkstra origin-node -> destination-node;
 *        - accept if km <= 2.5 x curated (same plausibility rule).
 *   3. Emit patch entries keyed "fromId|toId": { km, coords: [[lat,lng]...] }.
 *
 * Offline tool — run with `node scripts/stitch-edge-geometry.cjs`.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const HW_DIR = path.join(ROOT, 'public', 'data', 'highway');
const GRAPH_FILE = path.join(ROOT, 'public', 'data', 'road-graph.json');
const OUT_FILE = path.join(ROOT, 'public', 'data', 'edge-geometry-patch.json');
const ROUTER_TS = path.join(ROOT, 'src', 'utils', 'routeOptimizer.ts');

// ---------------- geo helpers ----------------
const havKm = (a1, o1, a2, o2) => {
  const R = 6371, p = Math.PI / 180;
  const dA = (a2 - a1) * p, dO = (o2 - o1) * p;
  const x = Math.sin(dA / 2) ** 2 + Math.cos(a1 * p) * Math.cos(a2 * p) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const pathLenKm = (coords) => {
  let km = 0;
  for (let i = 1; i < coords.length; i++) km += havKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  return km;
};
/** min distance (km) from point to great-circle segment sampled every ~500m */
function distToSegmentKm(p, a, b) {
  const n = Math.max(1, Math.ceil(havKm(a[0], a[1], b[0], b[1]) * 2));
  let best = Infinity;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const la = a[0] + (b[0] - a[0]) * t, lo = a[1] + (b[1] - a[1]) * t;
    const d = havKm(p[0], p[1], la, lo);
    if (d < best) best = d;
  }
  return best;
}

// ---------------- graph (mirror of roadGraphRouter.ts) ----------------
const G = JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf8'));
class MinHeap {
  constructor() { this.h = []; }
  push(it) {
    this.h.push(it);
    let i = this.h.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.h[p][0] <= this.h[i][0]) break; [this.h[p], this.h[i]] = [this.h[i], this.h[p]]; i = p; }
  }
  pop() {
    const top = this.h[0], last = this.h.pop();
    if (this.h.length) {
      this.h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let s = i;
        if (l < this.h.length && this.h[l][0] < this.h[s][0]) s = l;
        if (r < this.h.length && this.h[r][0] < this.h[s][0]) s = r;
        if (s === i) break;
        [this.h[s], this.h[i]] = [this.h[i], this.h[s]]; i = s;
      }
    }
    return top;
  }
  get size() { return this.h.length; }
}
function graphRoute(fromId, toId) {
  const s = G.citySnap[fromId] ?? G.citySnapByName[fromId?.toLowerCase()];
  const e = G.citySnap[toId] ?? G.citySnapByName[toId?.toLowerCase()];
  if (s === undefined || e === undefined || s === e) return null;
  const n = G.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  dist[s] = 0;
  const heap = new MinHeap(); heap.push([0, s]);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (seen[u]) continue;
    seen[u] = 1;
    if (u === e) break;
    const nbrs = G.adjacency[u] || [];
    for (let i = 0; i < nbrs.length; i++) {
      const [v, w] = nbrs[i];
      if (seen[v]) continue;
      const nd = d + w;
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; heap.push([nd, v]); }
    }
  }
  if (dist[e] === Infinity) return null;
  const nodes = [];
  let cur = e;
  while (cur !== s) { nodes.push(G.nodes[cur]); cur = prev[cur]; if (cur === -1) return null; }
  nodes.push(G.nodes[s]);
  nodes.reverse();
  return { km: Math.round(dist[e] * 10) / 10, coords: nodes };
}

// ---------------- curated edges (extract from TS) ----------------
function extractEdges() {
  const ts = fs.readFileSync(ROUTER_TS, 'utf8');
  const start = ts.indexOf('export const ROAD_NETWORK_EDGES: GraphEdge[] = [');
  if (start < 0) throw new Error('ROAD_NETWORK_EDGES not found');
  const arrStart = ts.indexOf('= [', start) + 1; // the array literal, not the GraphEdge[] type
  // end points at the '\n' BEFORE the array's closing "];" — slice up to it
  // (exclusive) and re-add the closing bracket.
  const end = ts.indexOf('\n];', arrStart);
  let body = ts.slice(arrStart, end) + ']';
  body = body.replace(/^\s*\/\/.*$/gm, ''); // strip line comments
  // Plain JS array literal (single quotes, unquoted keys) — evaluate as JS.
  return new Function(`return (${body});`)();
}
const EDGES = extractEdges();
console.log(`curated edges: ${EDGES.length}`);

// ---------------- raw survey network ----------------
// Union survey vertices into nodes; connect consecutive LineString points;
// merge cross-link vertices within MERGE_KM (junctions / duplicate surveys).
const MERGE_KM = 0.045;
const CELL = 0.0006; // ~66m grid for merge lookup
const grid = new Map();
const netNodes = [];      // [lat, lng]
const netAdj = [];        // array of [nodeIdx, km]
const key = (la, lo) => `${Math.round(la / CELL)}:${Math.round(lo / CELL)}`;
function getNode(la, lo) {
  const cx = Math.round(la / CELL), cy = Math.round(lo / CELL);
  let best = -1, bestD = Infinity;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const arr = grid.get(`${cx + dx}:${cy + dy}`);
    if (!arr) continue;
    for (const idx of arr) {
      const d = havKm(la, lo, netNodes[idx][0], netNodes[idx][1]);
      if (d < bestD) { bestD = d; best = idx; }
    }
  }
  if (best >= 0 && bestD <= MERGE_KM) return best;
  const idx = netNodes.length;
  netNodes.push([la, lo]);
  netAdj.push([]);
  const k = key(la, lo);
  let arr = grid.get(k);
  if (!arr) { arr = []; grid.set(k, arr); }
  arr.push(idx);
  return idx;
}
function link(a, b) {
  if (a === b) return;
  const km = havKm(netNodes[a][0], netNodes[a][1], netNodes[b][0], netNodes[b][1]);
  netAdj[a].push([b, km]);
  netAdj[b].push([a, km]);
}
let rawLinks = 0;
const files = fs.readdirSync(HW_DIR).filter((f) => f.endsWith('.geojson'));
for (const f of files) {
  const gj = JSON.parse(fs.readFileSync(path.join(HW_DIR, f), 'utf8'));
  const lines = [];
  const collect = (g) => {
    if (!g) return;
    if (Array.isArray(g)) { g.forEach(collect); return; }
    if (g.type === 'FeatureCollection') { g.features.forEach(collect); return; }
    if (g.type === 'Feature') { collect(g.geometry); return; }
    if (g.type === 'LineString') lines.push(g.coordinates);
    else if (g.type === 'MultiLineString') g.coordinates.forEach((ln) => lines.push(ln));
  };
  collect(gj);
  for (const ln of lines) {
    rawLinks++;
    let prev = -1;
    for (const [lo, la] of ln) { // GeoJSON [lng, lat]
      const idx = getNode(la, lo);
      if (prev >= 0) link(prev, idx);
      prev = idx;
    }
  }
}
console.log(`raw network: ${netNodes.length} union nodes from ${rawLinks} survey links`);

// de-dup adjacency (union step creates parallel edges)
for (let i = 0; i < netAdj.length; i++) {
  const seen = new Set();
  netAdj[i] = netAdj[i].filter(([v]) => (seen.has(v) ? false : (seen.add(v), true)));
}

// ---------------- stitching ----------------
function nearestNetNode(coord) {
  // coarse grid then refine
  let best = -1, bestD = Infinity;
  const cx = Math.round(coord[0] / CELL), cy = Math.round(coord[1] / CELL);
  for (let dx = -40; dx <= 40; dx += 1) for (let dy = -40; dy <= 40; dy += 1) {
    const arr = grid.get(`${cx + dx}:${cy + dy}`);
    if (!arr) continue;
    for (const idx of arr) {
      const d = havKm(coord[0], coord[1], netNodes[idx][0], netNodes[idx][1]);
      if (d < bestD) { bestD = d; best = idx; }
    }
  }
  return bestD <= 3 ? best : -1; // endpoints must lie within 3km of a survey point
}

function dijkstraLocal(s, e, allowed) {
  const dist = new Map([[s, 0]]);
  const prev = new Map();
  const heap = new MinHeap(); heap.push([0, s]);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (u === e) break;
    if (d > (dist.get(u) ?? Infinity)) continue;
    for (const [v, w] of netAdj[u]) {
      if (allowed && !allowed.has(v)) continue;
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); heap.push([nd, v]); }
    }
  }
  if (!dist.has(e)) return null;
  const nodes = [];
  let cur = e;
  while (cur !== s) { nodes.push(cur); cur = prev.get(cur); if (cur === undefined) return null; }
  nodes.push(s);
  nodes.reverse();
  return { km: dist.get(e), nodes };
}

const patch = {};
let realOk = 0, stitched = 0, keptCurated = 0;
for (const edge of EDGES) {
  const keyStr = `${edge.fromId}|${edge.toId}`;
  const real = graphRoute(edge.fromId, edge.toId);
  if (real && real.coords.length >= 2 && !(edge.distanceKm > 0 && real.km > edge.distanceKm * 2.5)) {
    realOk++;
    continue; // runtime already uses real graph geometry
  }

  // Endpoint anchors: the rebuilt graph places EVERY citySnap node (near-
  // snapped and injected alike) on the surveyed corridor, so anchor to those.
  const fromCoord = (G.citySnap[edge.fromId] !== undefined && G.nodes[G.citySnap[edge.fromId]]) || null;
  const toCoord = (G.citySnap[edge.toId] !== undefined && G.nodes[G.citySnap[edge.toId]]) || null;
  if (!fromCoord || !toCoord) { keptCurated++; console.log(`  ${keyStr}: endpoint city not on network — kept curated`); continue; }

  const A = nearestNetNode(fromCoord);
  const B = nearestNetNode(toCoord);
  if (A < 0 || B < 0) { keptCurated++; console.log(`  ${keyStr}: endpoint >3km from any survey point — kept curated`); continue; }

  // corridor around A->B (sample the from->to city line every 500m)
  const segSamples = [];
  const segN = Math.max(1, Math.ceil(havKm(fromCoord[0], fromCoord[1], toCoord[0], toCoord[1]) * 2));
  for (let i = 0; i <= segN; i++) {
    const t = i / segN;
    segSamples.push([fromCoord[0] + (toCoord[0] - fromCoord[0]) * t, fromCoord[1] + (toCoord[1] - fromCoord[1]) * t]);
  }
  let worstDev = 0;
  for (const c of edge.intermediateCoords || []) {
    let best = Infinity;
    for (const s of segSamples) { const d = havKm(c[0], c[1], s[0], s[1]); if (d < best) best = d; }
    if (best > worstDev) worstDev = best;
  }
  const baseCorridor = Math.max(3, worstDev * 1.3);

  // Multi-pass: the curated chord can UNDER-estimate how far the real road
  // swings from the straight line (corridor too tight -> disconnected) or
  // OVER-estimate it (corridor too wide -> wild detour through other valleys).
  const passes = [
    baseCorridor,
    Math.max(1.5, baseCorridor * 0.55),
    Math.min(18, baseCorridor * 1.8),
  ];
  let accepted = null;
  for (const corridorKm of passes) {
    const allowed = new Set();
    for (let i = 0; i < netNodes.length; i++) {
      const [la, lo] = netNodes[i];
      let best = Infinity;
      for (const s of segSamples) {
        if (Math.abs(la - s[0]) > corridorKm / 111 || Math.abs(lo - s[1]) > corridorKm / 105) continue;
        const d = havKm(la, lo, s[0], s[1]);
        if (d < best) best = d;
      }
      if (best <= corridorKm) allowed.add(i);
    }
    if (!allowed.has(A)) allowed.add(A);
    if (!allowed.has(B)) allowed.add(B);

    const res = dijkstraLocal(A, B, allowed);
    const km = res ? Math.round(res.km * 10) / 10 : null;
    // Stitch acceptance is STRICTER than the runtime's 2.5x detour-rejection
    // rule: a stitched path much longer than the curated km means the corridor
    // grabbed the wrong road, and the runtime would draw that wrong road.
    if (res && km <= edge.distanceKm * 1.35 && km >= edge.distanceKm * 0.6 && res.nodes.length >= 2) {
      accepted = { km, coords: res.nodes.map((i) => netNodes[i]), corridorKm };
      break;
    }
  }

  // Final fallback: OSRM (OSM road network) routed through the curated
  // waypoints. OSM covers roads the DoR survey data misses, and the drawn
  // line still lies on a real road instead of a straight chord.
  if (!accepted) {
    const waypts = [fromCoord, ...(edge.intermediateCoords || []), toCoord];
    const url =
      'https://router.project-osrm.org/route/v1/driving/' +
      waypts.map((c) => `${c[1].toFixed(5)},${c[0].toFixed(5)}`).join(';') +
      '?overview=full&geometries=geojson';
    try {
      const raw = cp.execSync(`curl -s --max-time 30 "${url}"`, { maxBuffer: 64 * 1024 * 1024 });
      const osrm = JSON.parse(raw.toString());
      const rt = osrm && osrm.routes && osrm.routes[0];
      if (rt && rt.geometry && rt.geometry.coordinates) {
        const km = Math.round((rt.distance / 1000) * 10) / 10;
        if (km <= edge.distanceKm * 1.6 && km >= edge.distanceKm * 0.5) {
          // decimate to <= 600 pts to keep the patch bundle lean
          let coords = rt.geometry.coordinates.map(([lo, la]) => [la, lo]);
          const stride = Math.max(1, Math.ceil(coords.length / 600));
          if (stride > 1) coords = coords.filter((_, i) => i % stride === 0 || i === coords.length - 1);
          patch[keyStr] = { km, coords };
          stitched++;
          console.log(`  ${keyStr}: OSRM-baked ${km} km (curated ${edge.distanceKm} km, ${coords.length} pts)`);
          continue;
        }
        // Up to 2.2x the curated km the OSRM shape is still recognisably "the
        // road between these towns" — bake it as GEOMETRY-ONLY (km: 0 sentinel:
        // runtime draws these coords but keeps the curated km/time).
        if (km <= edge.distanceKm * 2.2 && km >= edge.distanceKm * 0.5) {
          let coords = rt.geometry.coordinates.map(([lo, la]) => [la, lo]);
          const stride = Math.max(1, Math.ceil(coords.length / 600));
          if (stride > 1) coords = coords.filter((_, i) => i % stride === 0 || i === coords.length - 1);
          patch[keyStr] = { km: 0, coords };
          stitched++;
          console.log(`  ${keyStr}: OSRM geometry-only ${km} km (curated km kept: ${edge.distanceKm} km, ${coords.length} pts)`);
          continue;
        }
        console.log(`  ${keyStr}: OSRM gave ${km} km vs curated ${edge.distanceKm} km — rejected`);
      }
    } catch (e) {
      console.log(`  ${keyStr}: OSRM fetch failed (${e.message.split('\n')[0]})`);
    }
  }

  if (accepted) {
    patch[keyStr] = { km: accepted.km, coords: accepted.coords };
    stitched++;
    console.log(`  ${keyStr}: stitched ${accepted.km} km (curated ${edge.distanceKm} km, ${accepted.coords.length} pts, corridor ${accepted.corridorKm.toFixed(1)} km)`);
  } else {
    keptCurated++;
    console.log(`  ${keyStr}: all stitch passes failed (curated ${edge.distanceKm} km) — kept curated`);
  }
}

console.log(`\nresult: ${realOk} real-graph ok (no patch needed), ${stitched} stitched, ${keptCurated} kept curated`);
fs.writeFileSync(OUT_FILE, JSON.stringify(patch));
console.log(`wrote ${OUT_FILE} (${Object.keys(patch).length} entries)`);
