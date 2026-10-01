/**
 * Correctness harness for the surveyed road-graph router.
 *
 * Checks the invariant every consumer depends on: for each returned route the
 * reported distanceKm must equal the sum of the graph's own edge weights along
 * the returned node sequence, and every consecutive pair must be a real edge.
 *
 * Run: npx tsx scripts/verify-route-math.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GRAPH_PATH = resolve(process.cwd(), 'public/data/road-graph.json');

// The router fetches '/data/road-graph.json'; serve it from disk instead.
(globalThis as any).fetch = async (url: string) => {
  if (String(url).endsWith('/data/road-graph.json')) {
    return { ok: true, json: async () => JSON.parse(readFileSync(GRAPH_PATH, 'utf8')) } as any;
  }
  throw new Error(`unexpected fetch: ${url}`);
};

const mod = await import('../src/utils/roadGraphRouter');
const { preloadRoadGraph, findRoadGraphRoute, findRoadGraphAlternatives } = mod as any;

const graph: any = await preloadRoadGraph();
if (!graph) {
  console.error('FAIL: road graph failed to load');
  process.exit(1);
}

console.log(`graph loaded: ${graph.nodes.length} nodes, ${graph.highways.length} highway codes`);

const nodeCount = graph.nodes.length;

function edgeBetween(from: number, to: number): [number, number] | null {
  for (const [t, w, h] of graph.adjacency[from] || []) {
    if (t === to) return [w, h];
  }
  return null;
}

function nodeIdOf([lat, lng]: [number, number]): number {
  for (let i = 0; i < nodeCount; i++) {
    if (graph.nodes[i][0] === lat && graph.nodes[i][1] === lng) return i;
  }
  return -1;
}

function validate(pathNodes: number[], label: string): { ok: boolean; msg: string; km: number } {
  let sum = 0;
  for (let i = 0; i < pathNodes.length - 1; i++) {
    const e = edgeBetween(pathNodes[i], pathNodes[i + 1]);
    if (!e) return { ok: false, msg: `discontinuous at index ${i}: ${pathNodes[i]}->${pathNodes[i + 1]}`, km: sum };
    sum += e[0];
  }
  return { ok: true, msg: '', km: Math.round(sum * 10) / 10 };
}

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.log(`  FAIL  ${msg}`);
  }
}

// Pick origin/destination pairs that resolve to real graph nodes.
const snapIds = Object.keys(graph.citySnap);
const pairs: Array<[string, string]> = [];
for (let i = 0; i < snapIds.length && pairs.length < 40; i += Math.max(1, Math.floor(snapIds.length / 40))) {
  for (let j = snapIds.length - 1; j > i && pairs.length < 40; j -= Math.max(1, Math.floor(snapIds.length / 20))) {
    pairs.push([snapIds[i], snapIds[j]]);
  }
}

console.log(`\nchecking ${pairs.length} place pairs...\n`);

let withAlternatives = 0;
let longestMs = 0;
let slowestPair = '';
let checkedRoutes = 0;

for (const [a, b] of pairs) {
  const t0 = Date.now();
  let alts: any[];
  try {
    alts = findRoadGraphAlternatives(a, b, 3);
  } catch (err: any) {
    console.log(`  THREW ${a} -> ${b}: ${err.message}`);
    failures++;
    continue;
  }
  const ms = Date.now() - t0;
  if (ms > longestMs) { longestMs = ms; slowestPair = `${a} -> ${b}`; }

  if (alts.length === 0) continue;
  checkedRoutes += alts.length;

  const base = findRoadGraphRoute(a, b);
  if (base && alts[0].distanceKm !== base.distanceKm) {
    assert(false, `${a}->${b}: alternatives[0] ${alts[0].distanceKm} != shortest ${base.distanceKm}`);
  }

  const sigs = new Set<string>();
  let prevKm = -1;

  alts.forEach((r: any, idx: number) => {
    const nodes = r.pathCoordinates.map(nodeIdOf);
    if (nodes.includes(-1)) {
      assert(false, `${a}->${b}[${idx}]: coordinate not found in graph nodes`);
      return;
    }
    const v = validate(nodes, `${a}->${b}[${idx}]`);
    if (!v.ok) {
      assert(false, `${a}->${b}[${idx}]: ${v.msg}`);
      return;
    }
    if (Math.abs(v.km - r.distanceKm) > 0.15) {
      assert(false, `${a}->${b}[${idx}]: reported ${r.distanceKm} km but edges sum to ${v.km} km`);
    }
    // Loopless: no node may repeat within a path.
    if (new Set(nodes).size !== nodes.length) {
      assert(false, `${a}->${b}[${idx}]: path revisits a node (not loopless)`);
    }
    // k-shortest must be monotonically non-decreasing and never beat the shortest.
    if (r.distanceKm < prevKm - 0.05) {
      assert(false, `${a}->${b}[${idx}]: ${r.distanceKm} km is cheaper than the previous option ${prevKm} km`);
    }
    if (alts[0] && r.distanceKm < alts[0].distanceKm - 0.05) {
      assert(false, `${a}->${b}[${idx}]: alternative is shorter than the shortest route`);
    }
    prevKm = r.distanceKm;

    const sig = `${r.highwaysUsed.join('>')}:${nodes.length}`;
    if (sigs.has(sig)) assert(false, `${a}->${b}[${idx}]: duplicate corridor returned`);
    sigs.add(sig);

    if (r.inferredConnectorKm < 0) assert(false, `${a}->${b}[${idx}]: negative connector km`);

    // The four-part composition must account for the whole reported distance.
    const bd = r.distanceBreakdown;
    if (!bd) {
      assert(false, `${a}->${b}[${idx}]: route carries no distance composition`);
      return;
    }
    const parts = [bd.originAccessKm, bd.surveyedKm, bd.destAccessKm, bd.networkJoinKm];
    if (parts.some((p) => p < -1e-9)) {
      assert(false, `${a}->${b}[${idx}]: negative distance-composition leg ${JSON.stringify(bd)}`);
    }
    const composed = parts.reduce((x, y) => x + y, 0);
    if (Math.abs(composed - r.distanceKm) > 0.3) {
      assert(false, `${a}->${b}[${idx}]: composition sums to ${composed.toFixed(2)} km but route reports ${r.distanceKm} km`);
    }
    const synthetic = bd.originAccessKm + bd.destAccessKm + bd.networkJoinKm;
    if (Math.abs(synthetic - r.inferredConnectorKm) > 0.3) {
      assert(false, `${a}->${b}[${idx}]: connector legs ${synthetic.toFixed(2)} km disagree with inferredConnectorKm ${r.inferredConnectorKm} km`);
    }
    if (bd.surveyedKm > 0 && r.highwaysUsed.length === 0) {
      assert(false, `${a}->${b}[${idx}]: ${bd.surveyedKm} km surveyed but no highway reported`);
    }
  });

  if (alts.length > 1) withAlternatives++;
}

console.log(`routes validated : ${checkedRoutes}`);
console.log(`pairs with >1    : ${withAlternatives}`);
console.log(`slowest pair     : ${longestMs} ms (${slowestPair})`);

if (longestMs > 1500) {
  console.log(`  FAIL  slowest alternatives search ${longestMs} ms exceeds the 1500 ms main-thread budget`);
  failures++;
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);