// Loads /data/road-graph.json (built from the real DoR highway link geometry
// by scripts/build-road-graph.cjs) and finds real, on-highway paths between
// any two known cities/junctions — instead of a straight line.

interface RoadGraph {
  nodes: [number, number][]; // [lat, lng], id = array index
  adjacency: [number, number, number][][]; // per node: [toNodeId, distKm, highwayIdx]
  highways: string[];
  citySnap: Record<string, number>;
  stats: Record<string, unknown>;
}

export interface RoadGraphRoute {
  distanceKm: number;
  pathCoordinates: [number, number][];
  highwaysUsed: string[];
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
 * Finds the real on-highway route between two cities using the pre-built
 * road graph. Returns null if the graph isn't loaded yet, either city
 * isn't snapped onto the network, or they're in disconnected components.
 */
export function findRoadGraphRoute(originCityId: string, destCityId: string): RoadGraphRoute | null {
  if (!graph) return null;
  const startNode = graph.citySnap[originCityId];
  const endNode = graph.citySnap[destCityId];
  if (startNode === undefined || endNode === undefined) return null;
  if (startNode === endNode) return null;

  const dist = new Float64Array(graph.nodes.length).fill(Infinity);
  const prevNode = new Int32Array(graph.nodes.length).fill(-1);
  const prevHwy = new Int32Array(graph.nodes.length).fill(-1);
  const visited = new Uint8Array(graph.nodes.length);

  dist[startNode] = 0;
  const heap = new MinHeap();
  heap.push([0, startNode]);

  while (heap.size > 0) {
    const [d, node] = heap.pop()!;
    if (visited[node]) continue;
    visited[node] = 1;
    if (node === endNode) break;
    if (d > dist[node]) continue;

    const neighbors = graph.adjacency[node] || [];
    for (const [to, w, hwyIdx] of neighbors) {
      if (visited[to]) continue;
      const nd = d + w;
      if (nd < dist[to]) {
        dist[to] = nd;
        prevNode[to] = node;
        prevHwy[to] = hwyIdx;
        heap.push([nd, to]);
      }
    }
  }

  if (dist[endNode] === Infinity) return null;

  // reconstruct path
  const pathNodeIds: number[] = [];
  const highwaysUsed: string[] = [];
  let cur = endNode;
  while (cur !== startNode) {
    pathNodeIds.push(cur);
    const hwyIdx = prevHwy[cur];
    if (hwyIdx >= 0) {
      const code = graph.highways[hwyIdx];
      if (highwaysUsed[highwaysUsed.length - 1] !== code) highwaysUsed.push(code);
    }
    cur = prevNode[cur];
    if (cur === -1) return null;
  }
  pathNodeIds.push(startNode);
  pathNodeIds.reverse();
  highwaysUsed.reverse();

  const pathCoordinates: [number, number][] = pathNodeIds.map((id) => graph!.nodes[id]);

  return {
    distanceKm: Math.round(dist[endNode] * 10) / 10,
    pathCoordinates,
    highwaysUsed,
  };
}
