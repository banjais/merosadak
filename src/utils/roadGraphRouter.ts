// Loads /data/road-graph.json (built from the real DoR highway link geometry
// by scripts/build-road-graph.cjs) and finds real, on-highway paths between
// any two known cities/junctions — instead of a straight line.

interface RoadGraph {
  nodes: [number, number][]; // [lat, lng], id = array index
  adjacency: [number, number, number][][]; // per node: [toNodeId, distKm, highwayIdx]
  highways: string[];
  citySnap: Record<string, number>;
  citySnapByName: Record<string, number>;
  /** Keyed by normalized place name; first writer wins when names collide. */
  cityLinks?: Record<string, CityLink>;
  /** Keyed by place id, so two places sharing a name stay distinct. */
  cityLinksById?: Record<string, CityLink>;
  stats: Record<string, unknown>;
}

/**
 * A place's link to the highway network, derived from the surveyed graph rather
 * than from a hand-written highway list. `highways` is every national highway
 * within HIGHWAY_TOUCH_KM of the place; `accessKm` is the inferred access
 * connector length when the place does not sit on a highway itself.
 */
export interface CityLink {
  highways: string[];
  accessKm: number | null;
  onNetwork: boolean;
  claimedHighways?: string[];
}

/** Radius used by the graph builder when deciding which highways touch a place. */
export const HIGHWAY_TOUCH_KM = 5;

/**
 * Looks up a place's highway link, preferring the id so that two places sharing
 * a name (Gaur, Birtamod) do not report each other's highways.
 */
export function getCityLink(nameOrCity: string | { id?: string; name: string }): CityLink | null {
  if (!graph) return null;
  const byId = graph.cityLinksById;
  if (byId && typeof nameOrCity === 'object' && nameOrCity.id) {
    const hit = byId[nameOrCity.id];
    if (hit) return hit;
  }
  const name = typeof nameOrCity === 'string' ? nameOrCity : nameOrCity.name;
  const key = name.trim().toLowerCase();
  return graph.cityLinks?.[key] ?? null;
}

/**
 * Every place the graph knows about on a given highway, ordered as in the
 * source. Used by corridor search: typing "NH44" should list the settlements
 * that highway actually serves, not just the junctions with curated codes.
 */
export function getHighwayPlaceCount(): number {
  return Object.keys(graph?.cityLinksById ?? graph?.cityLinks ?? {}).length;
}

/**
 * How a path's total distance splits into the four things it is actually made of.
 * The graph tags every non-surveyed edge the same way, so the split is derived
 * from position on the path: the leading connector run leaves the origin, the
 * trailing run enters the destination, and anything left over is a join the
 * builder inserted between two surveyed links.
 */
export interface RouteDistanceBreakdown {
  originAccessKm: number;
  surveyedKm: number;
  destAccessKm: number;
  networkJoinKm: number;
}

export interface RoadGraphRoute {
  distanceKm: number;
  pathCoordinates: [number, number][];
  highwaysUsed: string[];
  inferredConnectorKm: number;
  distanceBreakdown: RouteDistanceBreakdown;
}

let graph: RoadGraph | null = null;
let loadingPromise: Promise<RoadGraph | null> | null = null;

export function preloadRoadGraph(): Promise<RoadGraph | null> {
  if (graph) return Promise.resolve(graph);
  if (loadingPromise) return loadingPromise;
  loadingPromise = fetch('/data/road-graph.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data: RoadGraph | null) => {
      graph = data;
      return data;
    })
    .catch(() => null);
  return loadingPromise;
}

export function isRoadGraphReady(): boolean {
  return graph !== null;
}

export function getRoadGraph(): RoadGraph | null {
  return graph;
}

// Small binary min-heap keyed by distance, for Dijkstra
class MinHeap {
  private heap: [number, number][] = []; // [dist, nodeId]

  push(item: [number, number]) {
    this.heap.push(item);
    let i = this.heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent][0] <= this.heap[i][0]) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  pop(): [number, number] | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let i = 0;
      const n = this.heap.length;
      while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.heap[l][0] < this.heap[smallest][0]) smallest = l;
        if (r < n && this.heap[r][0] < this.heap[smallest][0]) smallest = r;
        if (smallest === i) break;
        [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  get size() {
    return this.heap.length;
  }
}

/**
 * Reusable Dijkstra workspace. Yen's algorithm runs one search per spur node;
 * allocating fresh typed arrays each call re-zeroes ~660 KB per search and
 * stalls the main thread for seconds on the 37k-node graph.
 */
interface DijkstraScratch {
  dist: Float64Array;
  prevNode: Int32Array;
  prevHwy: Int32Array;
  prevEdgeKm: Float64Array;
  visited: Uint8Array;
}

function createScratch(): DijkstraScratch {
  const n = graph!.nodes.length;
  return {
    dist: new Float64Array(n),
    prevNode: new Int32Array(n),
    prevHwy: new Int32Array(n),
    prevEdgeKm: new Float64Array(n),
    visited: new Uint8Array(n),
  };
}

/**
 * Single-source Dijkstra over the surveyed graph.
 * bannedNodes / bannedEdges let Yen's algorithm carve out partial paths.
 */
function runDijkstra(
  startNode: number,
  endNode: number,
  bannedNodes: Set<number>,
  bannedEdges: Set<number>,
  scratch?: DijkstraScratch
): { dist: Float64Array; prevNode: Int32Array; prevHwy: Int32Array; prevEdgeKm: Float64Array } | null {
  const g = graph!;
  const n = g.nodes.length;

  let dist: Float64Array;
  let prevNode: Int32Array;
  let prevHwy: Int32Array;
  let prevEdgeKm: Float64Array;
  let visited: Uint8Array;

  if (scratch) {
    ({ dist, prevNode, prevHwy, prevEdgeKm, visited } = scratch);
    // prevEdgeKm is only read where prevHwy >= 0, and every such entry is
    // written before it is read, so it needs no clear.
    dist.fill(Infinity, 0, n);
    prevNode.fill(-1, 0, n);
    prevHwy.fill(-1, 0, n);
    visited.fill(0, 0, n);
  } else {
    dist = new Float64Array(n).fill(Infinity);
    prevNode = new Int32Array(n).fill(-1);
    prevHwy = new Int32Array(n).fill(-1);
    prevEdgeKm = new Float64Array(n);
    visited = new Uint8Array(n);
  }

  // Skip the Set lookups entirely on the unconstrained single-route search.
  const checkNodes = bannedNodes.size > 0;
  const checkEdges = bannedEdges.size > 0;

  dist[startNode] = 0;
  const heap = new MinHeap();
  heap.push([0, startNode]);

  while (heap.size > 0) {
    const [d, node] = heap.pop()!;
    if (visited[node]) continue;
    visited[node] = 1;
    if (node === endNode) break;
    if (d > dist[node]) continue;

    const neighbors = g.adjacency[node] || [];
    for (const [to, w, hwyIdx] of neighbors) {
      if (visited[to]) continue;
      if (checkNodes && bannedNodes.has(to)) continue;
      if (checkEdges && bannedEdges.has(node * n + to)) continue;
      const nd = d + w;
      if (nd < dist[to]) {
        dist[to] = nd;
        prevNode[to] = node;
        prevHwy[to] = hwyIdx;
        prevEdgeKm[to] = w;
        heap.push([nd, to]);
      }
    }
  }

  if (dist[endNode] === Infinity) return null;
  return { dist, prevNode, prevHwy, prevEdgeKm };
}

/** Walk the predecessor chain back from `endNode`, returning node ids in forward order. */
function reconstructPath(
  res: { prevNode: Int32Array; prevHwy: Int32Array; prevEdgeKm: Float64Array },
  startNode: number,
  endNode: number
): { pathNodeIds: number[]; highwaysUsed: string[]; inferredConnectorKm: number } | null {
  const g = graph!;
  const pathNodeIds: number[] = [];
  const highwaysUsed: string[] = [];
  let inferredConnectorKm = 0;
  let cur = endNode;
  while (cur !== startNode) {
    pathNodeIds.push(cur);
    const hwyIdx = res.prevHwy[cur];
    if (hwyIdx < 0) inferredConnectorKm += res.prevEdgeKm[cur];
    else {
      const code = g.highways[hwyIdx];
      if (highwaysUsed[highwaysUsed.length - 1] !== code) highwaysUsed.push(code);
    }
    cur = res.prevNode[cur];
    if (cur === -1) return null;
  }
  pathNodeIds.push(startNode);
  pathNodeIds.reverse();
  highwaysUsed.reverse();
  return { pathNodeIds, highwaysUsed, inferredConnectorKm };
}

/** One decimal, matching the rounding applied to every other reported distance. */
function roundBreakdown(b: RouteDistanceBreakdown): RouteDistanceBreakdown {
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    originAccessKm: r(b.originAccessKm),
    surveyedKm: r(b.surveyedKm),
    destAccessKm: r(b.destAccessKm),
    networkJoinKm: r(b.networkJoinKm),
  };
}

/**
 * Finds the real on-highway route between two cities using the pre-built
 * road graph. Returns null if the graph isn't loaded yet, either city
 * isn't snapped onto the network, or they're in disconnected components.
 */
export function findRoadGraphRoute(originCityId: string, destCityId: string): RoadGraphRoute | null {
  if (!graph) return null;
  const startNode = graph.citySnap[originCityId] ?? graph.citySnapByName[originCityId?.toLowerCase()];
  const endNode = graph.citySnap[destCityId] ?? graph.citySnapByName[destCityId?.toLowerCase()];
  if (startNode === undefined || endNode === undefined) return null;
  if (startNode === endNode) return null;

  const res = runDijkstra(startNode, endNode, new Set(), new Set());
  if (!res) return null;

  const built = reconstructPath(res, startNode, endNode);
  if (!built) return null;

  return {
    distanceKm: Math.round(res.dist[endNode] * 10) / 10,
    pathCoordinates: built.pathNodeIds.map((id) => graph!.nodes[id]),
    highwaysUsed: built.highwaysUsed,
    inferredConnectorKm: Math.round(built.inferredConnectorKm * 10) / 10,
    distanceBreakdown: roundBreakdown(classifyDistance(built.pathNodeIds)),
  };
}

/** How many spur nodes Yen's algorithm samples per round. Bounds runtime on long routes. */
const MAX_SPUR_NODES = 24;

function pathSignature(path: RoadGraphRoute): string {
  return `${path.highwaysUsed.join('>')}:${path.pathCoordinates.length}`;
}

/**
 * One forward pass over a node path giving prefix distance, prefix connector
 * distance, and the highway chain. Replaces the O(n) per-spur rescan that
 * recomputed the root cost from scratch for every candidate.
 */
function summarizePath(pathNodeIds: number[]): {
  prefixKm: number[];
  highwaysUsed: string[];
  connectorKm: number;
} | null {
  const g = graph!;
  const n = pathNodeIds.length;
  const prefixKm: number[] = new Array(n).fill(0);
  const highwaysUsed: string[] = [];
  let connectorKm = 0;

  for (let i = 0; i < n - 1; i++) {
    const neighbors = g.adjacency[pathNodeIds[i]] || [];
    const edge = neighbors.find(([to]) => to === pathNodeIds[i + 1]);
    if (!edge) return null;
    prefixKm[i + 1] = prefixKm[i] + edge[1];
    if (edge[2] < 0) {
      connectorKm += edge[1];
    } else {
      const code = g.highways[edge[2]];
      if (code !== undefined && highwaysUsed[highwaysUsed.length - 1] !== code) highwaysUsed.push(code);
    }
  }
  return { prefixKm, highwaysUsed, connectorKm };
}

/**
 * Splits a node path into surveyed highway and the three kinds of synthetic
 * edge the builder can insert. The graph tags all synthetic edges identically
 * (highway index -1), so the split is positional: the leading run of
 * connectors leaves the origin, the trailing run enters the destination, and a
 * connector anywhere between two surveyed edges is a network join.
 */
function classifyDistance(pathNodeIds: number[]): RouteDistanceBreakdown {
  const g = graph!;
  const n = pathNodeIds.length;
  const zero = { originAccessKm: 0, surveyedKm: 0, destAccessKm: 0, networkJoinKm: 0 };
  if (n < 2) return zero;

  const edgeKm: number[] = new Array(n - 1).fill(0);
  const isJoin: boolean[] = new Array(n - 1).fill(false);
  for (let i = 0; i < n - 1; i++) {
    const edge = (g.adjacency[pathNodeIds[i]] || []).find(([to]) => to === pathNodeIds[i + 1]);
    if (!edge) continue;
    edgeKm[i] = edge[1];
    isJoin[i] = edge[2] < 0;
  }

  // Reserve the final edge for the destination so a path that is connectors
  // only (both endpoints off-network) still splits into two access legs.
  const lastEdge = n - 2;
  let lead = 0;
  while (lead < lastEdge && isJoin[lead]) lead++;
  let tail = 0;
  while (tail < n - 1 - lead && isJoin[n - 2 - tail]) tail++;

  const breakdown = { ...zero };
  for (let i = 0; i < n - 1; i++) {
    if (!isJoin[i]) breakdown.surveyedKm += edgeKm[i];
    else if (i < lead) breakdown.originAccessKm += edgeKm[i];
    else if (i > n - 2 - tail) breakdown.destAccessKm += edgeKm[i];
    else breakdown.networkJoinKm += edgeKm[i];
  }
  return breakdown;
}

/** Build a full route record from a node-id path. */
function buildRoute(pathNodeIds: number[]): RoadGraphRoute | null {
  const g = graph!;
  const sum = summarizePath(pathNodeIds);
  if (!sum) return null;
  return {
    distanceKm: Math.round(sum.prefixKm[pathNodeIds.length - 1] * 10) / 10,
    pathCoordinates: pathNodeIds.map((id) => g.nodes[id]),
    highwaysUsed: sum.highwaysUsed,
    inferredConnectorKm: Math.round(sum.connectorKm * 10) / 10,
    distanceBreakdown: roundBreakdown(classifyDistance(pathNodeIds)),
  };
}

/**
 * Real alternative routes via Yen's k-shortest loopless paths on the surveyed
 * road graph — not preference re-weightings. Results are deduplicated by
 * highway corridor so a route that merely doubles back is not offered.
 *
 * Returns fewer than `maxPaths` (or just the best route) when the surveyed
 * network has a single corridor between the pair.
 */
export function findRoadGraphAlternatives(
  originCityId: string,
  destCityId: string,
  maxPaths = 3
): RoadGraphRoute[] {
  if (!graph) return [];
  const startNode = graph.citySnap[originCityId] ?? graph.citySnapByName[originCityId?.toLowerCase()];
  const endNode = graph.citySnap[destCityId] ?? graph.citySnapByName[destCityId?.toLowerCase()];
  if (startNode === undefined || endNode === undefined || startNode === endNode) return [];

  const g = graph;
  const nodeCount = g.nodes.length;

  const firstRes = runDijkstra(startNode, endNode, new Set(), new Set());
  if (!firstRes) return [];
  const firstBuilt = reconstructPath(firstRes, startNode, endNode);
  if (!firstBuilt) return [];
  const firstSummary = summarizePath(firstBuilt.pathNodeIds);
  if (!firstSummary) return [];

  const accepted: RoadGraphRoute[] = [
    {
      distanceKm: Math.round(firstRes.dist[endNode] * 10) / 10,
      pathCoordinates: firstBuilt.pathNodeIds.map((id) => g.nodes[id]),
      highwaysUsed: firstBuilt.highwaysUsed,
      inferredConnectorKm: Math.round(firstBuilt.inferredConnectorKm * 10) / 10,
      distanceBreakdown: roundBreakdown(classifyDistance(firstBuilt.pathNodeIds)),
    },
  ];
  const acceptedNodes: number[][] = [firstBuilt.pathNodeIds];
  const acceptedPrefixKm: number[][] = [firstSummary.prefixKm];
  const seen = new Set<string>([pathSignature(accepted[0])]);

  const scratch = createScratch();
  const k = Math.max(1, maxPaths);

  for (let iter = 1; iter < k; iter++) {
    const prevIdx = acceptedNodes.length - 1;
    const prevPath = acceptedNodes[prevIdx];
    const prevPrefixKm = acceptedPrefixKm[prevIdx];
    if (prevPath.length < 3) break;

    // Evenly sample spur nodes so long routes stay tractable.
    const interior = prevPath.length - 2;
    const spurCount = Math.min(interior, MAX_SPUR_NODES);
    if (spurCount <= 0) break;
    const step = interior / spurCount;

    const candidates: number[][] = [];

    for (let s = 0; s < spurCount; s++) {
      const spurIndex = Math.min(interior - 1, Math.floor(s * step));
      const spurNode = prevPath[spurIndex];

      // Ban every edge an accepted path uses at or after this spur, so the new
      // candidate must diverge from all of them here.
      const bannedEdges = new Set<number>();
      for (const path of acceptedNodes) {
        if (path[spurIndex] !== spurNode) continue;
        for (let i = spurIndex; i < path.length - 1; i++) {
          bannedEdges.add(path[i] * nodeCount + path[i + 1]);
        }
      }
      if (bannedEdges.size === 0) continue;

      // Loopless: the root prefix may not be revisited.
      const bannedNodes = new Set<number>(prevPath.slice(0, spurIndex));

      const res = runDijkstra(spurNode, endNode, bannedNodes, bannedEdges, scratch);
      if (!res) continue;
      const tail = reconstructPath(res, spurNode, endNode);
      if (!tail) continue;

      // tail.pathNodeIds[0] === spurNode, so dropping it and appending the rest
      // keeps the spliced path continuous at the junction.
      candidates.push([...prevPath.slice(0, spurIndex + 1), ...tail.pathNodeIds.slice(1)]);
    }

    if (candidates.length === 0) break;

    // Order by real cost, then take the cheapest that is not already accepted.
    const ordered = candidates
      .map((nodes) => ({ nodes, route: buildRoute(nodes) }))
      .filter((c): c is { nodes: number[]; route: RoadGraphRoute } => c.route !== null)
      .sort((a, b) => a.route.distanceKm - b.route.distanceKm);

    const picked = ordered.find((c) => !seen.has(pathSignature(c.route)));
    if (!picked) break;

    const summary = summarizePath(picked.nodes);
    if (!summary) break;

    seen.add(pathSignature(picked.route));
    accepted.push(picked.route);
    acceptedNodes.push(picked.nodes);
    acceptedPrefixKm.push(summary.prefixKm);
  }

  return accepted;
}
