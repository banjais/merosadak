import { CityNode, RoutePlanResult, VehicleType, RoutePreference, RoadIncident, RouteStep, EVCharger, SegmentSafetyData, TerrainFilterOptions } from '../types';
import { CITIES_AND_JUNCTIONS, NEPAL_HIGHWAYS, LIVE_ROAD_INCIDENTS } from '../data/nepalHighwaysData';
import { calculateSegmentSafety, calculateRouteSafetyIndex } from './safetyIndexCalculator';

interface GraphEdge {
  fromId: string;
  toId: string;
  distanceKm: number;
  baseTimeMinutes: number;
  highwayCode: string;
  highwayName: string;
  surface: 'asphalt_excellent' | 'blacktopped_fair' | 'gravel' | 'under_construction' | 'offroad_mud';
  status: 'clear' | 'caution' | 'obstructed' | 'closed';
  elevationGain: number;
  intermediateCoords: [number, number][];
}

// Build comprehensive road network graph for Nepal
export const ROAD_NETWORK_EDGES: GraphEdge[] = [
  // KTM to Naubise (H02 / H04 entry)
  {
    fromId: 'ktm',
    toId: 'nbz',
    distanceKm: 26,
    baseTimeMinutes: 45,
    highwayCode: 'H02/H04',
    highwayName: 'Nagdhunga Corridor',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -480,
    intermediateCoords: [[27.7172, 85.3240], [27.7020, 85.2010], [27.7214, 85.1764]]
  },
  // Naubise to Mugling (H04 Prithvi Highway)
  {
    fromId: 'nbz',
    toId: 'mgl',
    distanceKm: 88,
    baseTimeMinutes: 135,
    highwayCode: 'H04',
    highwayName: 'Prithvi Highway',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: -645,
    intermediateCoords: [[27.7214, 85.1764], [27.8105, 84.9754], [27.8228, 84.8155], [27.8423, 84.7155], [27.8617, 84.5542]]
  },
  // Mugling to Damauli (H04)
  {
    fromId: 'mgl',
    toId: 'dml',
    distanceKm: 44,
    baseTimeMinutes: 75,
    highwayCode: 'H04',
    highwayName: 'Prithvi Highway (Tanahun)',
    surface: 'under_construction',
    status: 'caution',
    elevationGain: 175,
    intermediateCoords: [[27.8617, 84.5542], [27.9142, 84.4223], [27.9733, 84.2833]]
  },
  // Damauli to Pokhara (H04)
  {
    fromId: 'dml',
    toId: 'pkr',
    distanceKm: 42,
    baseTimeMinutes: 55,
    highwayCode: 'H04',
    highwayName: 'Prithvi Highway (Pokhara entry)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 372,
    intermediateCoords: [[27.9733, 84.2833], [28.0833, 84.1432], [28.2096, 83.9856]]
  },
  // Mugling to Narayanghat (H05)
  {
    fromId: 'mgl',
    toId: 'cht',
    distanceKm: 36,
    baseTimeMinutes: 50,
    highwayCode: 'H05',
    highwayName: 'Narayanghat-Mugling Road',
    surface: 'asphalt_excellent',
    status: 'caution',
    elevationGain: -67,
    intermediateCoords: [[27.8617, 84.5542], [27.8102, 84.5020], [27.7650, 84.4750], [27.6833, 84.4333]]
  },
  // Narayanghat to Hetauda (H01 Mahendra Highway)
  {
    fromId: 'cht',
    toId: 'htd',
    distanceKm: 76,
    baseTimeMinutes: 80,
    highwayCode: 'H01',
    highwayName: 'Mahendra Highway (Chitwan-Makwanpur)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 252,
    intermediateCoords: [[27.6833, 84.4333], [27.5700, 84.7500], [27.4285, 85.0331]]
  },
  // Hetauda to Birgunj (H02 Tribhuvan Highway)
  {
    fromId: 'htd',
    toId: 'brg',
    distanceKm: 54,
    baseTimeMinutes: 55,
    highwayCode: 'H02',
    highwayName: 'Tribhuvan Highway (Terai Section)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -370,
    intermediateCoords: [[27.4285, 85.0331], [27.1800, 84.9900], [27.0128, 84.8774]]
  },
  // Naubise to Hetauda via Daman (H02 Mountain Byroad)
  {
    fromId: 'nbz',
    toId: 'htd',
    distanceKm: 106,
    baseTimeMinutes: 200,
    highwayCode: 'H02',
    highwayName: 'Tribhuvan Highway (Daman Pass)',
    surface: 'blacktopped_fair',
    status: 'clear',
    elevationGain: 1402,
    intermediateCoords: [[27.7214, 85.1764], [27.6000, 85.0500], [27.4285, 85.0331]]
  },
  // Narayanghat to Butwal via Daunne Pass (H01)
  {
    fromId: 'cht',
    toId: 'btl',
    distanceKm: 114,
    baseTimeMinutes: 195,
    highwayCode: 'H01',
    highwayName: 'Mahendra Highway (Daunne Section)',
    surface: 'under_construction',
    status: 'caution',
    elevationGain: 12,
    intermediateCoords: [[27.6833, 84.4333], [27.5300, 83.8900], [27.7006, 83.4484]]
  },
  // Butwal to Bhairahawa / Sunauli (H10 Siddhartha Highway)
  {
    fromId: 'btl',
    toId: 'bhr',
    distanceKm: 22,
    baseTimeMinutes: 25,
    highwayCode: 'H10',
    highwayName: 'Siddhartha Highway (6-Lane Corridor)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -115,
    intermediateCoords: [[27.7006, 83.4484], [27.6000, 83.4500], [27.5045, 83.4503]]
  },
  // Butwal to Palpa Tansen (H10)
  {
    fromId: 'btl',
    toId: 'plp',
    distanceKm: 39,
    baseTimeMinutes: 60,
    highwayCode: 'H10',
    highwayName: 'Siddhartha Highway (Siddhababa section)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: 1130,
    intermediateCoords: [[27.7006, 83.4484], [27.7800, 83.4900], [27.8683, 83.5489]]
  },
  // Palpa Tansen to Pokhara (H10)
  {
    fromId: 'plp',
    toId: 'pkr',
    distanceKm: 120,
    baseTimeMinutes: 170,
    highwayCode: 'H10',
    highwayName: 'Siddhartha Highway (Syangja section)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -528,
    intermediateCoords: [[27.8683, 83.5489], [27.9800, 83.7700], [28.2096, 83.9856]]
  },
  // Pokhara to Baglung (H15 Mid-Hill Highway)
  {
    fromId: 'pkr',
    toId: 'bgl',
    distanceKm: 72,
    baseTimeMinutes: 95,
    highwayCode: 'H15',
    highwayName: 'Mid-Hill Highway (Pokhara-Baglung)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 198,
    intermediateCoords: [[28.2096, 83.9856], [28.2500, 83.7500], [28.2725, 83.6006]]
  },
  // KTM to Dhulikhel (H03 Araniko)
  {
    fromId: 'ktm',
    toId: 'dhk',
    distanceKm: 30,
    baseTimeMinutes: 40,
    highwayCode: 'H03',
    highwayName: 'Araniko 6-Lane Expressway',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 150,
    intermediateCoords: [[27.7172, 85.3240], [27.6710, 85.4298], [27.6221, 85.5428]]
  },
  // Dhulikhel to Tatopani / Kodari (H03)
  {
    fromId: 'dhk',
    toId: 'kdr',
    distanceKm: 83,
    baseTimeMinutes: 155,
    highwayCode: 'H03',
    highwayName: 'Araniko Highway (Bhotekoshi Gorge)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: 90,
    intermediateCoords: [[27.6221, 85.5428], [27.6333, 85.7000], [27.9497, 85.9452]]
  },
  // Dhulikhel to Sindhuli Gadhi (H13 BP Highway)
  {
    fromId: 'dhk',
    toId: 'sdh',
    distanceKm: 120,
    baseTimeMinutes: 190,
    highwayCode: 'H13',
    highwayName: 'B.P. Koirala Highway (Kavre-Sindhuli)',
    surface: 'asphalt_excellent',
    status: 'caution',
    elevationGain: -450,
    intermediateCoords: [[27.6221, 85.5428], [27.4200, 85.8700], [27.3333, 86.0167], [27.2486, 85.9186]]
  },
  // Sindhuli Gadhi to Bardibas (H13)
  {
    fromId: 'sdh',
    toId: 'brd',
    distanceKm: 40,
    baseTimeMinutes: 50,
    highwayCode: 'H13',
    highwayName: 'B.P. Koirala Highway (Sindhuli-Bardibas)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -950,
    intermediateCoords: [[27.2486, 85.9186], [27.1500, 85.9100], [26.9740, 85.9024]]
  },
  // Bardibas to Janakpur (H01 / Link)
  {
    fromId: 'brd',
    toId: 'jnk',
    distanceKm: 34,
    baseTimeMinutes: 40,
    highwayCode: 'H01/Link',
    highwayName: 'Bardibas-Janakpur Highway',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -76,
    intermediateCoords: [[26.9740, 85.9024], [26.8500, 85.9200], [26.7271, 85.9408]]
  },
  // Bardibas to Hetauda (H01)
  {
    fromId: 'brd',
    toId: 'htd',
    distanceKm: 130,
    baseTimeMinutes: 130,
    highwayCode: 'H01',
    highwayName: 'Mahendra Highway (Central Terai)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 310,
    intermediateCoords: [[26.9740, 85.9024], [27.0500, 85.3500], [27.4285, 85.0331]]
  },
  // Bardibas to Biratnagar / Dharan (H01)
  {
    fromId: 'brd',
    toId: 'brt',
    distanceKm: 175,
    baseTimeMinutes: 180,
    highwayCode: 'H01',
    highwayName: 'Mahendra Highway (East Section & Koshi Barrage)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -78,
    intermediateCoords: [[26.9740, 85.9024], [26.5210, 86.9320], [26.4525, 87.2718]]
  },
  // Biratnagar to Dharan (H01 / H08 link)
  {
    fromId: 'brt',
    toId: 'dhr',
    distanceKm: 42,
    baseTimeMinutes: 45,
    highwayCode: 'H08 Link',
    highwayName: '6-Lane Commercial Highway',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 277,
    intermediateCoords: [[26.4525, 87.2718], [26.6650, 87.2780], [26.8124, 87.2834]]
  },
  // Biratnagar to Kakarbhitta (H01)
  {
    fromId: 'brt',
    toId: 'kkr',
    distanceKm: 105,
    baseTimeMinutes: 105,
    highwayCode: 'H01',
    highwayName: 'Mahendra Highway (Jhapa-Morang 4-lane)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 73,
    intermediateCoords: [[26.4525, 87.2718], [26.6620, 87.8920], [26.6508, 88.1565]]
  },
  // Kakarbhitta to Ilam (H09 Mechi Highway)
  {
    fromId: 'kkr',
    toId: 'ilm',
    distanceKm: 82,
    baseTimeMinutes: 140,
    highwayCode: 'H09',
    highwayName: 'Mechi Highway (Tea Garden Hill Climb)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 1063,
    intermediateCoords: [[26.6508, 88.1565], [26.7800, 87.9800], [26.9117, 87.9275]]
  },
  // Butwal to Nepalgunj (H01)
  {
    fromId: 'btl',
    toId: 'npg',
    distanceKm: 240,
    baseTimeMinutes: 215,
    highwayCode: 'H01',
    highwayName: 'Mahendra Highway (Kapilvastu-Banke)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -70,
    intermediateCoords: [[27.7006, 83.4484], [27.7200, 82.8500], [28.0500, 81.6167]]
  },
  // Nepalgunj to Surkhet (H12 Ratna Highway)
  {
    fromId: 'npg',
    toId: 'srk',
    distanceKm: 113,
    baseTimeMinutes: 140,
    highwayCode: 'H12',
    highwayName: 'Ratna Highway (Kohalpur-Birendranagar)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 510,
    intermediateCoords: [[28.0500, 81.6167], [28.1900, 81.6900], [28.5997, 81.6334]]
  },
  // Surkhet to Jumla (H06 Karnali Highway)
  {
    fromId: 'srk',
    toId: 'jml',
    distanceKm: 232,
    baseTimeMinutes: 460,
    highwayCode: 'H06',
    highwayName: 'Karnali Highway (Mountain Gorge Road)',
    surface: 'blacktopped_fair',
    status: 'caution',
    elevationGain: 1854,
    intermediateCoords: [[28.5997, 81.6334], [29.1400, 81.6000], [29.2747, 82.1838]]
  },
  // Nepalgunj to Dhangadhi (H01)
  {
    fromId: 'npg',
    toId: 'dhg',
    distanceKm: 165,
    baseTimeMinutes: 145,
    highwayCode: 'H01',
    highwayName: 'Mahendra Highway (Chisapani Karnali Bridge)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: -41,
    intermediateCoords: [[28.0500, 81.6167], [28.6400, 81.2800], [28.6946, 80.5977]]
  },
  // Dhangadhi to Mahendranagar (H01)
  {
    fromId: 'dhg',
    toId: 'mhn',
    distanceKm: 52,
    baseTimeMinutes: 50,
    highwayCode: 'H01',
    highwayName: 'Mahendra Highway (Far Western Terminus)',
    surface: 'asphalt_excellent',
    status: 'clear',
    elevationGain: 89,
    intermediateCoords: [[28.6946, 80.5977], [28.8500, 80.3500], [28.9667, 80.1833]]
  }
];

// Helper to calculate cost and fuel
const VEHICLE_CONFIGS: Record<VehicleType, { mileageKmPerL: number; fuelCostPerL: number; speedMultiplier: number; label: string }> = {
  car: { mileageKmPerL: 14, fuelCostPerL: 172, speedMultiplier: 1.0, label: 'Car / Hatchback / Sedan' },
  suv_4wd: { mileageKmPerL: 10, fuelCostPerL: 160, speedMultiplier: 1.05, label: 'SUV / 4WD Jeep' },
  motorbike: { mileageKmPerL: 35, fuelCostPerL: 172, speedMultiplier: 1.12, label: 'Motorcycle' },
  bus_truck: { mileageKmPerL: 4.5, fuelCostPerL: 160, speedMultiplier: 0.75, label: 'Commercial Bus / Truck' },
  electric_vehicle: { mileageKmPerL: 6.5, fuelCostPerL: 0, speedMultiplier: 1.0, label: 'Electric Vehicle (EV)' } // 6.5 km/kWh
};

// Distance matrix calculator between any two cities
export function calculateDirectDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Helper to determine scenic rating (1 - 5) based on highway codes traversed
function calculateRouteScenicRating(highwayCodes: string[]): number {
  let score = 3.6;
  const codeStr = highwayCodes.join(' ');
  if (codeStr.includes('H13')) score = Math.max(score, 4.9); // BP Highway
  if (codeStr.includes('H09')) score = Math.max(score, 4.8); // Mechi Tea Gardens
  if (codeStr.includes('H02') && highwayCodes.some(c => c.includes('H02'))) score = Math.max(score, 4.7); // Daman pass
  if (codeStr.includes('H10')) score = Math.max(score, 4.7); // Siddhartha Hwy
  if (codeStr.includes('H15')) score = Math.max(score, 4.7); // Mid-Hill Hwy
  if (codeStr.includes('H06')) score = Math.max(score, 4.6); // Karnali
  if (codeStr.includes('H03')) score = Math.max(score, 4.5); // Araniko gorge
  if (codeStr.includes('H04')) score = Math.max(score, 4.2); // Prithvi Trishuli gorge
  return Math.round(score * 10) / 10;
}

// Single preference Dijkstra route finder with optional edge penalties and terrain filters
export function findRouteByPreference(
  originId: string,
  destinationId: string,
  preference: RoutePreference = 'fastest',
  vehicle: VehicleType = 'car',
  penalizedEdgeIds: Set<string> = new Set<string>(),
  overrideMetadata?: { name?: string; badge?: string; color?: string; viaHighlights?: string },
  terrainFilters: TerrainFilterOptions = {}
): RoutePlanResult | null {
  const origin = CITIES_AND_JUNCTIONS.find((c) => c.id === originId);
  const destination = CITIES_AND_JUNCTIONS.find((c) => c.id === destinationId);

  if (!origin || !destination) return null;
  if (originId === destinationId) return null;

  // Build undirected adjacency list
  interface Neighbor {
    nodeId: string;
    edge: GraphEdge;
    edgeKey: string;
  }
  const adjMap = new Map<string, Neighbor[]>();

  CITIES_AND_JUNCTIONS.forEach((city) => adjMap.set(city.id, []));

  ROAD_NETWORK_EDGES.forEach((edge) => {
    const keyForward = `${edge.fromId}-${edge.toId}`;
    const keyReverse = `${edge.toId}-${edge.fromId}`;
    adjMap.get(edge.fromId)?.push({ nodeId: edge.toId, edge, edgeKey: keyForward });
    adjMap.get(edge.toId)?.push({
      nodeId: edge.fromId,
      edge: {
        ...edge,
        fromId: edge.toId,
        toId: edge.fromId,
        elevationGain: -edge.elevationGain,
        intermediateCoords: [...edge.intermediateCoords].reverse()
      },
      edgeKey: keyReverse
    });
  });

  // Dijkstra search with customized cost function
  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edge: GraphEdge } | null>();
  const visited = new Set<string>();

  CITIES_AND_JUNCTIONS.forEach((city) => {
    distances.set(city.id, Infinity);
    previous.set(city.id, null);
  });

  distances.set(originId, 0);

  while (visited.size < CITIES_AND_JUNCTIONS.length) {
    let minNode: string | null = null;
    let minCost = Infinity;

    for (const [nodeId, cost] of distances.entries()) {
      if (!visited.has(nodeId) && cost < minCost) {
        minCost = cost;
        minNode = nodeId;
      }
    }

    if (!minNode || minCost === Infinity) break;
    if (minNode === destinationId) break;

    visited.add(minNode);

    const neighbors = adjMap.get(minNode) || [];
    for (const { nodeId: nextId, edge, edgeKey } of neighbors) {
      if (visited.has(nextId)) continue;

      let edgeWeight = edge.baseTimeMinutes;

      // Calculate terrain metrics for this edge
      const fromCityNode = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.fromId);
      const toCityNode = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.toId);
      const fromElev = fromCityNode?.elevationM ?? 400;
      const toElev = toCityNode?.elevationM ?? 400;
      const peakElevOnEdge = Math.max(fromElev, toElev, fromElev + Math.max(0, edge.elevationGain), toElev + Math.max(0, -edge.elevationGain));
      const slopeGradePct = edge.distanceKm > 0 ? (Math.abs(edge.elevationGain) / (edge.distanceKm * 1000)) * 100 : 0;
      const isPassCorridor = peakElevOnEdge >= 1450 || 
        edge.highwayName.toLowerCase().includes('pass') || 
        edge.highwayName.toLowerCase().includes('daman') || 
        edge.highwayName.toLowerCase().includes('ridge') ||
        (edge.highwayCode.includes('H02') && edge.distanceKm > 80);

      // When optimizing for shortest distance, weight primarily by km
      if (preference === 'shortest') {
        edgeWeight = edge.distanceKm * 1.5;
        if (edge.status === 'closed') edgeWeight *= 15.0;
      } else {
        // Real road condition penalties
        if (edge.status === 'caution') edgeWeight *= 1.35;
        if (edge.status === 'obstructed') edgeWeight *= 2.5;
        if (edge.status === 'closed') edgeWeight *= 10.0;

        // Road surface adjustments
        if (edge.surface === 'under_construction') edgeWeight *= 1.4;
        if (edge.surface === 'gravel' || edge.surface === 'offroad_mud') {
          edgeWeight *= vehicle === 'suv_4wd' ? 1.2 : 1.8;
        }

        // Preference adjustments
        if (preference === 'safest') {
          if (edge.status !== 'clear') edgeWeight *= 2.5;
          if (edge.surface === 'under_construction') edgeWeight *= 2.8;
          if (edge.surface === 'offroad_mud' || edge.surface === 'gravel') edgeWeight *= 3.0;
        } else if (preference === 'scenic') {
          if (['H13', 'H10', 'H02', 'H15', 'H09', 'H03'].some(c => edge.highwayCode.includes(c))) {
            edgeWeight *= 0.55;
          }
        } else if (preference === 'ev_optimized') {
          if (['H04', 'H05', 'H01', 'H10'].some(c => edge.highwayCode.includes(c))) {
            edgeWeight *= 0.8;
          }
        }
      }

      // ==========================================
      // TERRAIN-BASED FILTER ADJUSTMENTS
      // ==========================================

      // 1. Avoid High Mountain Passes (Avoid elevations > 1500m & high passes like Daman H02, Karnali, etc.)
      if (terrainFilters.avoidHighPasses) {
        if (peakElevOnEdge >= 1800 || (isPassCorridor && peakElevOnEdge >= 1400)) {
          edgeWeight *= 14.0 * (peakElevOnEdge / 1300);
        } else if (peakElevOnEdge >= 1400) {
          edgeWeight *= 6.0;
        } else if (peakElevOnEdge >= 1100 && isPassCorridor) {
          edgeWeight *= 3.0;
        }
      }

      // 2. Require Paved Roads (Strict penalty on gravel, unpaved offroad, or active mud/construction)
      if (terrainFilters.requirePavedOnly) {
        if (edge.surface === 'gravel' || edge.surface === 'offroad_mud') {
          edgeWeight *= 30.0;
        } else if (edge.surface === 'under_construction') {
          edgeWeight *= 8.5;
        } else if (edge.surface === 'asphalt_excellent') {
          edgeWeight *= 0.75; // Heavily incentivize smooth asphalt highways
        } else if (edge.surface === 'blacktopped_fair') {
          edgeWeight *= 0.9;
        }
      }

      // 3. Avoid Steep Incline / Mountain Hairpin Climbs (> 5.5% slope gradient)
      if (terrainFilters.avoidSteepGrades) {
        if (slopeGradePct >= 5.5) {
          edgeWeight *= 5.0 * (slopeGradePct / 4.0);
        } else if (slopeGradePct >= 3.8) {
          edgeWeight *= 2.2;
        }
      }

      // 4. Avoid Active Landslide Zones & Major Hazard Corridors
      if (terrainFilters.avoidActiveLandslideZones) {
        if (edge.status === 'caution') {
          edgeWeight *= 4.5;
        } else if (edge.status === 'obstructed') {
          edgeWeight *= 18.0;
        } else if (edge.status === 'closed') {
          edgeWeight *= 60.0;
        }
        const hasLiveIncident = LIVE_ROAD_INCIDENTS.some(inc => 
          (inc.highwayCode === edge.highwayCode || inc.locationName.toLowerCase().includes(edge.highwayName.toLowerCase())) &&
          (inc.type === 'landslide' || inc.type === 'fallen_rocks' || inc.type === 'flood' || inc.severity === 'severe')
        );
        if (hasLiveIncident) {
          edgeWeight *= 5.0;
        }
      }

      // 5. Maximum Altitude Ceiling Limit (if configured)
      if (terrainFilters.maxElevationM && peakElevOnEdge > terrainFilters.maxElevationM) {
        const excessM = peakElevOnEdge - terrainFilters.maxElevationM;
        edgeWeight *= (12.0 + (excessM / 100) * 3.0);
      }

      // Apply penalty if this edge is in the penalized set (for alternative generation)
      if (penalizedEdgeIds.has(edgeKey) || penalizedEdgeIds.has(`${edge.toId}-${edge.fromId}`)) {
        edgeWeight *= 5.0;
      }

      const totalNewCost = distances.get(minNode)! + edgeWeight;
      if (totalNewCost < distances.get(nextId)!) {
        distances.set(nextId, totalNewCost);
        previous.set(nextId, { nodeId: minNode, edge });
      }
    }
  }

  // Reconstruct path
  const edgesOnPath: GraphEdge[] = [];
  let curr = destinationId;

  while (curr !== originId) {
    const prev = previous.get(curr);
    if (!prev) return null; // Path unreachable
    edgesOnPath.unshift(prev.edge);
    curr = prev.nodeId;
  }

  if (edgesOnPath.length === 0) return null;

  // Compile path details
  let totalDistanceKm = 0;
  let totalMinutes = 0;
  let clearKm = 0;
  let cautionKm = 0;
  let obstructedKm = 0;
  let totalElevationGainM = 0;
  let pathCoordinates: [number, number][] = [];
  const steps: RouteStep[] = [];

  const vehicleConfig = VEHICLE_CONFIGS[vehicle] || VEHICLE_CONFIGS.car;

  const segmentsSafety: SegmentSafetyData[] = [];

  edgesOnPath.forEach((edge, idx) => {
    totalDistanceKm += edge.distanceKm;

    let segMinutes = edge.baseTimeMinutes / vehicleConfig.speedMultiplier;
    if (edge.status === 'caution') segMinutes *= 1.25;
    if (edge.status === 'obstructed') segMinutes *= 1.8;

    totalMinutes += Math.round(segMinutes);

    if (edge.status === 'clear') clearKm += edge.distanceKm;
    else if (edge.status === 'caution') cautionKm += edge.distanceKm;
    else obstructedKm += edge.distanceKm;

    if (edge.elevationGain > 0) totalElevationGainM += edge.elevationGain;

    if (idx === 0) {
      pathCoordinates.push(...edge.intermediateCoords);
    } else {
      pathCoordinates.push(...edge.intermediateCoords.slice(1));
    }

    const fromCity = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.fromId)?.name || edge.fromId;
    const toCity = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.toId)?.name || edge.toId;

    let warningText: string | undefined;
    if (edge.status === 'caution') {
      warningText = `Caution: Active road widening / single-lane section on ${edge.highwayName}.`;
    }

    const segSafety = calculateSegmentSafety({
      fromId: edge.fromId,
      toId: edge.toId,
      fromName: fromCity,
      toName: toCity,
      highwayCode: edge.highwayCode,
      highwayName: edge.highwayName,
      distanceKm: edge.distanceKm,
      surface: edge.surface,
      status: edge.status,
      elevationGainM: edge.elevationGain,
      coordinates: edge.intermediateCoords,
    });
    segmentsSafety.push(segSafety);

    steps.push({
      instruction: `Follow ${edge.highwayName} (${edge.highwayCode}) from ${fromCity} to ${toCity}`,
      highwayCode: edge.highwayCode,
      distanceKm: edge.distanceKm,
      durationMinutes: Math.round(segMinutes),
      roadStatus: edge.status,
      surface: edge.surface,
      warning: warningText,
      elevationChangeM: edge.elevationGain,
      safetyData: segSafety,
    });
  });

  // Calculate Highway Safety Index (0 - 100) & Road Quality Score
  const routeSafetyIndex = calculateRouteSafetyIndex(segmentsSafety, totalDistanceKm);
  const roadConditionScore = routeSafetyIndex.roadQualityAverage;

  // Fuel calculation
  const fuelLiters = Math.round((totalDistanceKm / vehicleConfig.mileageKmPerL) * 10) / 10;
  const fuelCostNpr = Math.round(fuelLiters * vehicleConfig.fuelCostPerL);

  // EV Calculations
  const evKwhRequired = Math.round((totalDistanceKm / 6.2) * 10) / 10;
  const recommendedChargers: EVCharger[] = [];

  const highwayCodesOnPath = Array.from(new Set(edgesOnPath.map((e) => e.highwayCode.split('/')[0])));
  NEPAL_HIGHWAYS.forEach((hw) => {
    if (highwayCodesOnPath.some(c => hw.code === c || hw.code.includes(c))) {
      recommendedChargers.push(...hw.evChargers);
    }
  });

  // Toll calculations
  let totalTollCost = 0;
  NEPAL_HIGHWAYS.forEach((hw) => {
    if (highwayCodesOnPath.some(c => hw.code === c || hw.code.includes(c))) {
      hw.tollPlazas.forEach((tp) => {
        totalTollCost += tp.costNpr[vehicle] || 0;
      });
    }
  });

  const incidentsOnRoute = LIVE_ROAD_INCIDENTS.filter((inc) => highwayCodesOnPath.includes(inc.highwayCode));

  const elevationsOnRoute = [origin.elevationM, destination.elevationM, ...edgesOnPath.map((e) => e.elevationGain + origin.elevationM)];
  const maxElevationM = Math.max(...elevationsOnRoute);

  const scenicRating = calculateRouteScenicRating(highwayCodesOnPath);

  // Via summary description
  const viaHighways = Array.from(new Set(edgesOnPath.map(e => `${e.highwayName} (${e.highwayCode})`))).join(' ➔ ');
  const viaShort = edgesOnPath.length <= 2 
    ? `via ${edgesOnPath.map(e => e.highwayName).join(' & ')}`
    : `via ${edgesOnPath[0].highwayName} & ${edgesOnPath[edgesOnPath.length - 1].highwayName}`;

  // Default naming and color by preference
  let defaultName = 'Express Highway Corridor';
  let defaultBadge = '🚀 Fastest';
  let defaultColor = '#38bdf8'; // sky-400

  if (preference === 'shortest') {
    defaultName = 'Direct Distance Path';
    defaultBadge = '📏 Shortest';
    defaultColor = '#10b981'; // emerald-500
  } else if (preference === 'scenic') {
    defaultName = 'Scenic Mountain & River Vistas';
    defaultBadge = '🏔️ Most Scenic';
    defaultColor = '#a855f7'; // purple-500
  } else if (preference === 'safest') {
    defaultName = 'Paved & Safety-Prioritized';
    defaultBadge = '🛡️ Safest Surface';
    defaultColor = '#f59e0b'; // amber-500
  } else if (preference === 'ev_optimized') {
    defaultName = 'EV Fast-Charging Corridor';
    defaultBadge = '⚡ EV Priority';
    defaultColor = '#06b6d4'; // cyan-500
  }

  // Check if terrain filters are actively applied and update badge/summary if relevant
  const hasActiveTerrainFilters = Boolean(
    terrainFilters.avoidHighPasses || 
    terrainFilters.requirePavedOnly || 
    terrainFilters.avoidSteepGrades || 
    terrainFilters.avoidActiveLandslideZones ||
    terrainFilters.maxElevationM
  );

  return {
    id: `plan-${originId}-${destinationId}-${preference}-${vehicle}-${edgesOnPath.map(e => e.fromId).join('-')}${hasActiveTerrainFilters ? '-filtered' : ''}`,
    origin,
    destination,
    preference,
    vehicle,
    routeName: overrideMetadata?.name || defaultName,
    routeBadge: overrideMetadata?.badge || defaultBadge,
    routeColor: overrideMetadata?.color || defaultColor,
    viaHighlights: overrideMetadata?.viaHighlights || viaShort,
    scenicRating,
    totalDistanceKm,
    estimatedTimeMinutes: totalMinutes,
    roadConditionScore,
    safetyIndex: routeSafetyIndex,
    statusSummary: {
      clearKm,
      cautionKm,
      obstructedKm
    },
    fuelEstimate: {
      liters: fuelLiters,
      costNpr: fuelCostNpr,
      avgMileageKmPerLiter: vehicleConfig.mileageKmPerL
    },
    evEstimate: {
      kwhRequired: evKwhRequired,
      recommendedChargingStops: recommendedChargers,
      batteryUsagePercent: Math.round((evKwhRequired / 50) * 100)
    },
    totalTollCostNpr: totalTollCost,
    elevationGainM: totalElevationGainM,
    maxElevationM,
    incidentsOnRoute,
    steps,
    pathCoordinates,
    appliedTerrainFilters: hasActiveTerrainFilters ? terrainFilters : undefined,
    alternateRouteSummary: {
      name: preference === 'fastest' ? 'Scenic Hill Pass Alternative' : 'Primary Express Corridor',
      distanceDiffKm: preference === 'fastest' ? 24 : -18,
      timeDiffMinutes: preference === 'fastest' ? 45 : -25,
      reason: viaHighways
    },
    aiAdvisory: {
      summary: `Travel route between ${origin.name} and ${destination.name} via ${viaShort} is currently ${roadConditionScore > 75 ? 'Optimal' : 'Moderate with caution zones'}. Total distance is ${totalDistanceKm} km with an estimated drive time of ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m.${hasActiveTerrainFilters ? ' (Terrain optimization filters active).' : ''}`,
      riskLevel: roadConditionScore > 75 ? 'Low' : roadConditionScore > 50 ? 'Moderate' : 'High',
      keyRecommendations: [
        terrainFilters.avoidHighPasses ? 'Route optimized to avoid high mountain passes (>1500m) and steep ridge summits.' : 'Maintain headlights on during river canyon curves and foggy morning mountain passes.',
        terrainFilters.requirePavedOnly ? 'Route strictly prioritized on blacktopped & asphalt highway surfaces.' : 'Use lower gear (Engine braking) on steep descents instead of riding foot brakes to prevent brake overheating.',
        vehicle === 'electric_vehicle' ? 'Top up battery at high-capacity DC fast charging hubs before ascending steep ghat passes.' : 'Ensure adequate fuel reserve before entering remote mountain segments.'
      ],
      monsoonOrWeatherWarning: 'Monitor DOR Live alerts for sudden rockfall clearances between 11 AM - 3 PM.',
      bestDepartureWindow: '5:30 AM - 7:00 AM (Recommended to beat heavy freight truck queues)',
      emergencyContacts: ['Nepal Traffic Police: 103', 'Emergency Police Hotline: 100', 'Armed Police Force Highway Rescue: 1114', 'Ambulance: 102']
    }
  };
}

// Generates multiple distinct route options (Fastest, Shortest, Scenic, Safest/Alternative) with terrain filters
export function findAllRouteOptions(
  originId: string,
  destinationId: string,
  vehicle: VehicleType = 'car',
  terrainFilters: TerrainFilterOptions = {}
): RoutePlanResult[] {
  const options: RoutePlanResult[] = [];
  const seenEdgeFingerprints = new Set<string>();

  // Helper to generate unique fingerprint of path
  const getFingerprint = (plan: RoutePlanResult) => {
    return plan.steps.map(s => `${s.highwayCode}-${s.distanceKm}`).join('|');
  };

  // 1. Calculate Fastest Route (Default baseline)
  const fastest = findRouteByPreference(originId, destinationId, 'fastest', vehicle, new Set(), {
    name: 'Express Corridor (Fastest)',
    badge: '🚀 Fastest',
    color: '#38bdf8'
  }, terrainFilters);
  if (fastest) {
    options.push(fastest);
    seenEdgeFingerprints.add(getFingerprint(fastest));
  }

  // 2. Calculate Shortest Route
  const shortest = findRouteByPreference(originId, destinationId, 'shortest', vehicle, new Set(), {
    name: 'Direct Distance (Shortest)',
    badge: '📏 Shortest',
    color: '#10b981'
  }, terrainFilters);
  if (shortest) {
    const fp = getFingerprint(shortest);
    if (!seenEdgeFingerprints.has(fp)) {
      options.push(shortest);
      seenEdgeFingerprints.add(fp);
    }
  }

  // 3. Calculate Most Scenic Route
  const scenic = findRouteByPreference(originId, destinationId, 'scenic', vehicle, new Set(), {
    name: 'Scenic Ridge & Passes',
    badge: '🏔️ Most Scenic',
    color: '#a855f7'
  }, terrainFilters);
  if (scenic) {
    const fp = getFingerprint(scenic);
    if (!seenEdgeFingerprints.has(fp)) {
      options.push(scenic);
      seenEdgeFingerprints.add(fp);
    }
  }

  // 4. Calculate Safest / Paved Surface Route
  const safest = findRouteByPreference(originId, destinationId, 'safest', vehicle, new Set(), {
    name: 'Paved & Safety-Prioritized',
    badge: '🛡️ Safest Surface',
    color: '#f59e0b'
  }, terrainFilters);
  if (safest) {
    const fp = getFingerprint(safest);
    if (!seenEdgeFingerprints.has(fp)) {
      options.push(safest);
      seenEdgeFingerprints.add(fp);
    }
  }

  // 5. If fewer than 2 distinct options were found (e.g. single corridor), compute a penalized alternative
  if (options.length < 2 && fastest) {
    // Penalize the first 2 edges of the fastest route to find an alternative corridor
    const primaryEdgeKeys = new Set<string>();
    fastest.steps.forEach(step => {
      // Find matching edge keys
      ROAD_NETWORK_EDGES.forEach(e => {
        if (step.highwayCode?.includes(e.highwayCode)) {
          primaryEdgeKeys.add(`${e.fromId}-${e.toId}`);
          primaryEdgeKeys.add(`${e.toId}-${e.fromId}`);
        }
      });
    });

    const alternative = findRouteByPreference(originId, destinationId, 'scenic', vehicle, primaryEdgeKeys, {
      name: 'Alternative Highway Bypass',
      badge: '🔄 Alternative',
      color: '#c084fc'
    }, terrainFilters);
    if (alternative) {
      const fp = getFingerprint(alternative);
      if (!seenEdgeFingerprints.has(fp)) {
        options.push(alternative);
        seenEdgeFingerprints.add(fp);
      }
    }
  }

  // If vehicle is EV, ensure EV-optimized route is also considered or labelled
  if (vehicle === 'electric_vehicle') {
    const evRoute = findRouteByPreference(originId, destinationId, 'ev_optimized', vehicle, new Set(), {
      name: 'EV Fast-Charging Network',
      badge: '⚡ EV Priority',
      color: '#06b6d4'
    }, terrainFilters);
    if (evRoute) {
      const fp = getFingerprint(evRoute);
      if (!seenEdgeFingerprints.has(fp)) {
        options.push(evRoute);
      }
    }
  }

  return options;
}

// Primary route search API with allRouteOptions bundled
export function findOptimizedRoute(
  originId: string,
  destinationId: string,
  preference: RoutePreference = 'fastest',
  vehicle: VehicleType = 'car',
  terrainFilters: TerrainFilterOptions = {}
): RoutePlanResult | null {
  const allOptions = findAllRouteOptions(originId, destinationId, vehicle, terrainFilters);
  if (allOptions.length === 0) return null;

  // Find matching option for current preference, or default to fastest
  let selected = allOptions.find(opt => opt.preference === preference);
  if (!selected) {
    selected = findRouteByPreference(originId, destinationId, preference, vehicle, new Set(), undefined, terrainFilters) || allOptions[0];
  }

  // Attach all available route options to the result for easy toggling
  return {
    ...selected,
    allRouteOptions: allOptions,
    appliedTerrainFilters: Object.keys(terrainFilters).some(k => (terrainFilters as any)[k]) ? terrainFilters : undefined
  };
}

