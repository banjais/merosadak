# City Data Architecture — Status Summary

## Objective
Investigate the city data architecture across 80 highways to maximize cities linked with DOR-verified distances, including small towns along highway routes.

## What Has Been Done So Far

### 1. Road Network Graph (`public/data/road-graph.json`)
- **Built by**: `scripts/build-road-graph.cjs`
- **Source**: DoR Highway Network GeoJSON (`public/data/highway/*.geojson`) — 80 highway files (NH01–NH80)
- **Structure**: 36,139 nodes, adjacency list, 79 highway codes, `citySnap` (1,633 entries), `citySnapByName`
- **Distance basis**: DoR official `link_len` (chainage) per survey link — government-surveyed, officially verified distances. Geometric distances are scaled to match DoR chainage.
- **Routing**: Dijkstra implementation in `src/utils/roadGraphRouter.ts` with binary min-heap
- **Coverage**: 79 highways (NH01–NH80; SNH reference covers 79 since NH07 merged per provenance)

### 2. SNH Reference (`public/data/snh-reference.json`)
- **Source**: Statistics of National Highway (SNH) 2022/23 PDF (322 pages, DoR HMIS-ICT Unit)
- **`published_distances`**: 89 entries (Table 4 NH01 corridor place-to-place + Table 5/6 district HQs)
- **`links`**: ~121 link records (Annex 2, NH01–NH38) with chainage `from_km`/`to_km` and `length_km`
- **`city_aliases`**: 44 alias mappings (e.g., "butwal" → ["Butwal (Mahendrachok)", "Butwal"])
- **`corrections`**: 4 data reconciliation entries (NH18 shifted labels, NH52-004 length discrepancy, NH13-001 missing geometry, blank link names)

### 3. Geojson Town Coordinates (`public/data/geojson-town-coords.json`)
- **661 highway corridor towns** extracted from DoR GeoJSON `link_name` + `geometry.coordinates` endpoints
- **Status**: Snapped into road graph (`citySnap` / `citySnapByName`) for Dijkstra routing — these cities ARE routable
- **Gap**: NOT loaded in `loadExpandedCities()` in `src/utils/cityDataLoader.ts` — these 661 towns are invisible in UI city search/dropdowns

### 4. City Data Loader (`src/utils/cityDataLoader.ts`)
- **`loadExpandedCities()`**: Loads 9 data sources at runtime via `fetch()`:
  - `cities.json`, `palika-coords.json`, `district-hqs.json`, `district-centroids.json`
  - `calculator-cities.json` (137 cities, infrastructure prefixed filtered out)
  - `airports.json`, `temples.json`, `tourist-places.json`, `bus-stations.json`
- **Base**: `CITIES_AND_JUNCTIONS` from `src/data/nepalHighwaysData.ts` (66 curated junctions)
- **Missing**: `/data/geojson-town-coords.json` is NOT in the sources array
- **Result**: ~1,155 unique cities loaded in UI (cached)

### 5. Distance Matrix (`public/data/distance-matrix.json`)
- **62-city matrix** (pre-computed distance matrix)
- Used by `src/components/DistanceMatrixReference.tsx` as a reference view
- Separate from `loadExpandedCities()`; not loaded into the runtime city list

### 6. Comprehensive Distance Service (`src/utils/comprehensiveDistance.ts`)
- **Priority chain**: 
  1. Road graph Dijkstra (`findRoadGraphRoute`) — DOR-verified distances
  2. SNH published distances (Table 4/5/6) — DOR-published distances
  3. Aerial (Haversine) distance as fallback
- Both async (`findUnifiedRoute`) and sync (`findUnifiedRouteSync`) variants

### 7. Route Optimizer (`src/utils/routeOptimizer.ts`)
- `findOptimizedRoute()` includes a `resolveRoutingId()` function that checks:
  1. Curated junction city (`CITIES_AND_JUNCTIONS`)
  2. Direct road graph snap by ID (`citySnap`)
  3. Name match in road graph (`citySnapByName`)
  4. Fallback: `snapToNearestRoutingCity()` to nearest curated junction
- `ROAD_NETWORK_EDGES` (hand-curated) are overridden by real road graph geometry when available

### 8. Provenance Tracking (`public/data/provenance.json`)
- Documents data tiers (A: DoR published, B: DoR reconciled, C: Derived, D: Not DoR)
- Records corrections, file hashes, methodology
- Notes: "Matrix computed at build time using Dijkstra shortest-path on road graph (36,122 nodes, 79 highways)"

### 9. Offline Sync (`src/utils/offlineSync.ts`)
- Caches 11 static data URLs for offline use
- Does NOT include `road-graph.json`, `snh-reference.json`, or `geojson-town-coords.json`

### 10. Component Usage
- **`DistanceCalculator.tsx`**: Uses `CITIES_AND_JUNCTIONS` (66 cities only) — "DoR highway graph only (verified nodes)"
- **`RoutePlanner.tsx`**: Uses `loadExpandedCities()` (1,155 cities) — includes all expanded sources
- **`InteractiveMap.tsx`**: Uses `loadExpandedCities()` (1,155 cities)
- **`worker/src/index.ts`**: Serves `road-graph.json` and `snh-reference.json` via `/api/calculate-route`

## Key Gaps Identified

| Gap | Impact | Files |
|-----|--------|-------|
| `loadExpandedCities()` doesn't load `geojson-town-coords.json` | 661 highway towns routable in graph but invisible in UI city search | `cityDataLoader.ts:275-285` |
| `offlineSync.ts` doesn't cache `road-graph.json` or `snh-reference.json` | Offline users can't use DOR-verified distances | `offlineSync.ts:188-200` |
| `DistanceCalculator.tsx` uses only 66 curated cities | Misses expanded city coverage | `DistanceCalculator.tsx:22-23` |
| `geojson-town-coords.json` missing from offline cache | 661 towns unavailable offline | `offlineSync.ts:188-200` |

## Relevant File Locations
- `scripts/build-road-graph.cjs` — Graph builder script (597 lines)
- `src/utils/cityDataLoader.ts` — Runtime city loader (345 lines)
- `src/utils/roadGraphRouter.ts` — Dijkstra routing on road graph (154 lines)
- `src/utils/comprehensiveDistance.ts` — Distance priority chain (275 lines)
- `src/utils/routeOptimizer.ts` — Route optimization with snapping (2192 lines)
- `src/utils/geoUtils.ts` — Highway enrichment, pavement, cities along route (435 lines)
- `src/utils/offlineSync.ts` — Offline cache management (698 lines)
- `src/components/DistanceCalculator.tsx` — Uses 66 curated cities only
- `src/components/RoutePlanner.tsx` — Uses expanded cities (1,155)
- `public/data/road-graph.json` — 2MB graph data
- `public/data/snh-reference.json` — 169KB SNH reference
- `public/data/geojson-town-coords.json` — 100KB, 661 highway towns
- `public/data/calculator-cities.json` — 35KB, 137 cities
- `public/data/distance-matrix.json` — 61KB, 62-city matrix
