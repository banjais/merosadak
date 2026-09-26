import { RoadGraphRoute } from './roadGraphRouter';
import { findRoadGraphRoute } from './roadGraphRouter';

interface SNHDistance {
  distance_km: number;
  source: string;
  table?: string;
  via?: string;
}

interface UnifiedDistanceResult {
  distanceKm: number;
  source: 'dor_snh' | 'aerial';
  roadGraphRoute?: RoadGraphRoute;
  snhData?: SNHDistance;
  aerialDistanceKm?: number;
  pathCoordinates?: [number, number][];
  highwaysUsed?: string[];
  metadata?: {
    dorSource?: 'road_graph' | 'dor_snh';
    snhTable?: string;
    snhVia?: string;
  };
}

const SNH_REFERENCE = null;

async function loadSNHReference(): Promise<Record<string, SNHDistance>> {
  if (SNH_REFERENCE) return SNH_REFERENCE;
  const res = await fetch('/data/snh-reference.json');
  if (!res.ok) return {};
  const data = await res.json();
  return data.published_distances || {};
}

function getSNHKey(originId: string, destId: string): string {
  return `${originId}|${destId}`;
}

function calculateAerialDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function findUnifiedRoute(
  originId: string,
  destId: string,
  originCoords?: { lat: number; lng: number },
  destCoords?: { lat: number; lng: number }
): Promise<UnifiedDistanceResult | null> {
  // 1. Try DoR road graph (real highway network from geojson)
  const roadRoute = findRoadGraphRoute(originId, destId);
  if (roadRoute && roadRoute.distanceKm > 0) {
    return {
      distanceKm: roadRoute.distanceKm,
      source: 'dor_snh',
      roadGraphRoute: roadRoute,
      pathCoordinates: roadRoute.pathCoordinates,
      highwaysUsed: roadRoute.highwaysUsed,
      metadata: { dorSource: 'road_graph' },
    };
  }

  // 2. Try SNH published distances (official DoR 2022/23 data)
  const snhData = await loadSNHReference();
  const snhKey1 = getSNHKey(originId, destId);
  const snhKey2 = getSNHKey(destId, originId);
  const snhEntry = snhData[snhKey1] || snhData[snhKey2];
  if (snhEntry && snhEntry.distance_km > 0) {
    return {
      distanceKm: snhEntry.distance_km,
      source: 'dor_snh',
      snhData: snhEntry,
      metadata: { 
        dorSource: 'dor_snh',
        snhTable: snhEntry.table,
        snhVia: snhEntry.via,
      },
    };
  }

  // 3. Fallback to aerial distance (straight-line)
  if (originCoords && destCoords) {
    const aerialKm = calculateAerialDistanceKm(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng);
    return {
      distanceKm: aerialKm,
      source: 'aerial',
      aerialDistanceKm: aerialKm,
      pathCoordinates: [[originCoords.lat, originCoords.lng], [destCoords.lat, destCoords.lng]],
    };
  }

  return null;
}

export function findUnifiedRouteSync(
  originId: string,
  destId: string,
  originCoords: { lat: number; lng: number },
  destCoords: { lat: number; lng: number },
  roadGraph: any,
  snhDistances: Record<string, SNHDistance>
): UnifiedDistanceResult {
  // 1. Try DoR road graph (real highway network from geojson)
  const startNode = roadGraph?.citySnap?.[originId];
  const endNode = roadGraph?.citySnap?.[destId];
  if (startNode !== undefined && endNode !== undefined && startNode !== endNode) {
    const { distanceKm, pathCoordinates, highwaysUsed } = findRoadGraphRouteDijkstra(
      roadGraph, startNode, endNode
    );
    if (distanceKm > 0) {
      return {
        distanceKm,
        source: 'dor_snh',
        pathCoordinates,
        highwaysUsed,
        metadata: { dorSource: 'road_graph' },
      };
    }
  }

  // 2. Try SNH published distances (official DoR 2022/23)
  const snhKey1 = getSNHKey(originId, destId);
  const snhKey2 = getSNHKey(destId, originId);
  const snhEntry = snhDistances[snhKey1] || snhDistances[snhKey2];
  if (snhEntry && snhEntry.distance_km > 0) {
    return {
      distanceKm: snhEntry.distance_km,
      source: 'dor_snh',
      snhData: snhEntry,
      metadata: { 
        dorSource: 'dor_snh',
        snhTable: snhEntry.table,
        snhVia: snhEntry.via,
      },
    };
  }

  // 3. Aerial fallback (straight-line)
  const aerialKm = calculateAerialDistanceKm(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng);
  return {
    distanceKm: aerialKm,
    source: 'aerial',
    aerialDistanceKm: aerialKm,
    pathCoordinates: [[originCoords.lat, originCoords.lng], [destCoords.lat, destCoords.lng]],
  };
}

function findRoadGraphRouteDijkstra(graph: any, startNode: number, endNode: number): { distanceKm: number; pathCoordinates: [number, number][]; highwaysUsed: string[] } {
  const dist = new Float64Array(graph.nodes.length).fill(Infinity);
  const prevNode = new Int32Array(graph.nodes.length).fill(-1);
  const prevHwy = new Int32Array(graph.nodes.length).fill(-1);
  const visited = new Uint8Array(graph.nodes.length);

  dist[startNode] = 0;
  const heap: [number, number][] = [[0, startNode]];

  function heapPush(item: [number, number]) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }

  function heapPop(): [number, number] | undefined {
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      const n = heap.length;
      while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && heap[l][0] < heap[smallest][0]) smallest = l;
        if (r < n && heap[r][0] < heap[smallest][0]) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  while (heap.length > 0) {
    const [d, node] = heapPop()!;
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
        heapPush([nd, to]);
      }
    }
  }

  if (dist[endNode] === Infinity) {
    return { distanceKm: 0, pathCoordinates: [], highwaysUsed: [] };
  }

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
    if (cur === -1) break;
  }
  pathNodeIds.push(startNode);
  pathNodeIds.reverse();
  highwaysUsed.reverse();

  const pathCoordinates: [number, number][] = pathNodeIds.map((id) => graph.nodes[id]);

  return {
    distanceKm: Math.round(dist[endNode] * 10) / 10,
    pathCoordinates,
    highwaysUsed,
  };
}

export function buildUnifiedDistanceMatrix(
  cities: Array<{ id: string; name: string; lat: number; lng: number }>,
  roadGraph: any,
  snhDistances: Record<string, SNHDistance>
): { matrix: number[][]; cities: any[]; sources: ('dor_snh' | 'aerial' | 'same')[][]; metadata: any[][] } {
  const n = cities.length;
  const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  const sources: ('dor_snh' | 'aerial' | 'same')[][] = Array(n).fill(0).map(() => Array(n).fill(''));
  const metadata: any[][] = Array(n).fill(0).map(() => Array(n).fill({}));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
        sources[i][j] = 'same';
        metadata[i][j] = {};
        continue;
      }
      const result = findUnifiedRouteSync(
        cities[i].id, cities[j].id,
        { lat: cities[i].lat, lng: cities[i].lng },
        { lat: cities[j].lat, lng: cities[j].lng },
        roadGraph, snhDistances
      );
      matrix[i][j] = result.distanceKm;
      sources[i][j] = result.source;
      metadata[i][j] = result.metadata || {};
    }
  }

  return { matrix, cities, sources, metadata };
}