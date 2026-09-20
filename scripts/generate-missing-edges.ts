import { CITIES_AND_JUNCTIONS, NEPAL_HIGHWAYS } from '../src/data/nepalHighwaysData';

interface HighwaySegment {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  avgSpeedKmh: number;
  surface: string;
  status: string;
  coordinates: [number, number][];
  elevationStartM: number;
  elevationEndM: number;
}

interface Highway {
  id: string;
  code: string;
  name: string;
  segments: HighwaySegment[];
}

interface CityNode {
  id: string;
  name: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
  elevationM: number;
  isMajorHub: boolean;
  connectedHighways: string[];
}

// Build a mapping of city name variations to city IDs
const cityNameToId: Map<string, string> = new Map();
const cityIdToName: Map<string, string> = new Map();

for (const city of CITIES_AND_JUNCTIONS) {
  cityNameToId.set(city.name.toLowerCase(), city.id);
  cityIdToName.set(city.id, city.name);
  
  // Also map partial names (first word)
  const firstWord = city.name.split(' ')[0].toLowerCase();
  if (!cityNameToId.has(firstWord)) {
    cityNameToId.set(firstWord, city.id);
  }
  
  // Map nepali names if they exist
  if (city.nepaliName) {
    cityNameToId.set(city.nepaliName.toLowerCase(), city.id);
  }
}

// Known name mappings for highway segment endpoints to city IDs
const nameMappings: Record<string, string> = {
  'kathmandu': 'ktm',
  'pokhara': 'pkr',
  'narayanghat': 'cht',
  'narayanghat / bharatpur': 'cht',
  'mugling': 'mgl',
  'butwal': 'btl',
  'bhairahawa / sunauli': 'bhr',
  'sunauli/bhairahawa': 'bhr',
  'hetauda': 'htd',
  'birgunj': 'brg',
  'janakpurdham': 'jnk',
  'janakpur': 'jnk',
  'bardibas': 'brd',
  'biratnagar': 'brt',
  'dharan': 'dhr',
  'kakarbhitta': 'kkr',
  'nepalgunj': 'npg',
  'surkhet (birendranagar)': 'srk',
  'surkhet': 'srk',
  'dhangadhi': 'dhg',
  'mahendranagar / gaddachauki': 'mhn',
  'mahendranagar': 'mhn',
  'dhulikhel': 'dhk',
  'sindhuli gadhi': 'sdh',
  'sindhuli gadi': 'sdh',
  'damauli': 'dml',
  'tansen (palpa)': 'plp',
  'tansen': 'plp',
  'palpa': 'plp',
  'ilam': 'ilm',
  'baglung': 'bgl',
  'jumla': 'jml',
  'naubise / khanikhola': 'nbz',
  'naubise': 'nbz',
  'tatopani / kodari (china border)': 'kdr',
  'tatopani / kodari': 'kdr',
  'tatopani': 'kdr',
  'kodari': 'kdr',
  'dolalghat': 'dht', // Dhankuta is different - dolalghat is a junction on NH03
  'birtamod': 'btm',
  'bhadrapur': 'bhp',
  'damak': 'dmk',
  'itahari': 'ith',
  'lahan': 'lhn',
  'pathlaiya': 'ptl',
  'amlekhgunj': 'amg',
  'tistung': 'tst',
  'daman': 'dmn',
  'jalbire': 'jlb',
  'aaptari': 'apt',
  'aaptari narayanghat': 'apt',
  'gorkha': 'bsl', // Besisahar is near Gorkha
  'besisahar': 'bsl',
  'waling': 'bsl', // No direct city, use nearest
  'syangja bazar': 'bsl',
  'khurkot': 'khk',
  'sindhuli madi': 'smd',
  'nepalthok': 'npt',
  'bhakundebesi': 'bkb',
  'galchhi': 'gch',
  'malekhu': 'mlk',
  'nagdhunga': 'ngd',
  'kalikot (manma)': 'jjk', // Jajarkot is different, but closest
  'kalikot': 'jjk',
  'jajarkot': 'jjk',
  'dunai': 'dun',
  'ghorahi': 'ghr',
  'sandhikharka': 'sdk',
  'pyuthan': 'pyt',
  'chame': 'chm',
  'bidur': 'bid',
  'chautara': 'ctr',
  'rajbiraj': 'rbj',
  'gulariya': 'gly',
  'lamki': 'lmk',
  'lodeghat': 'lgt',
  'dipayal': 'dpl',
  'khunuwa': 'khn',
  'arungkhola': 'ark',
  'attariya': 'atr',
  'kohalpur (nepalgunj link)': 'npg',
  'kohalpur': 'npg',
  'gorusinghe': 'btl',
  'daunne hill pass': 'btl',
  'daunne': 'btl',
  'siddhababa': 'plp',
  'tansen': 'plp',
  'ramdi bridge': 'plp',
  'galyang': 'plp',
  'kande pass': 'pkr',
  'chiwabhanjyang': 'ilm',
  'terhathum': 'dht',
  'bhojpur': 'dht',
  'ghurmi': 'khk',
  'pati bhanjyang': 'khk',
  'burtibang': 'bgl',
  'rukumkot': 'jjk',
  'dailekh': 'jjk',
  'sanfebagar': 'dpl',
  'jhulaghat': 'dpl',
};

// Function to find city ID from a name
function findCityId(name: string): string | null {
  const normalized = name.toLowerCase().trim();
  
  // Direct mapping
  if (nameMappings[normalized]) return nameMappings[normalized];
  
  // Try exact match
  if (cityNameToId.has(normalized)) return cityNameToId.get(normalized)!;
  
  // Try partial match
  for (const [key, id] of cityNameToId) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return id;
    }
  }
  
  return null;
}

// Collect all highway segments
const allSegments: (HighwaySegment & { highwayCode: string; highwayName: string })[] = [];

for (const highway of NEPAL_HIGHWAYS) {
  for (const segment of highway.segments) {
    allSegments.push({
      ...segment,
      highwayCode: highway.code,
      highwayName: highway.name,
    });
  }
}

// Build adjacency list of segments
const segmentMap: Map<string, typeof allSegments> = new Map();

for (const segment of allSegments) {
  const fromKey = segment.from.toLowerCase().trim();
  const toKey = segment.to.toLowerCase().trim();
  
  if (!segmentMap.has(fromKey)) segmentMap.set(fromKey, []);
  if (!segmentMap.has(toKey)) segmentMap.set(toKey, []);
  
  segmentMap.get(fromKey)!.push(segment);
  segmentMap.get(toKey)!.push(segment);
}

// Now build route edges by chaining segments
const generatedEdges: {
  fromId: string;
  toId: string;
  distanceKm: number;
  baseTimeMinutes: number;
  highwayCode: string;
  highwayName: string;
  surface: string;
  status: string;
  elevationGain: number;
  intermediateCoords: [number, number][];
}[] = [];

const processedSegmentIds = new Set<string>();

function buildChain(startKey: string, visited: Set<string> = new Set()): {
  cities: string[];
  totalDistance: number;
  totalTime: number;
  highwayCode: string;
  highwayName: string;
  surface: string;
  status: string;
  elevationGain: number;
  coords: [number, number][];
} | null {
  const segments = segmentMap.get(startKey.toLowerCase().trim());
  if (!segments || segments.length === 0) return null;
  
  // Find the segment that goes forward (not backward)
  let bestSegment = segments[0];
  let bestFromId = findCityId(bestSegment.from);
  let bestToId = findCityId(bestSegment.to);
  
  // If we can't identify both ends, skip
  if (!bestFromId || !bestToId) return null;
  
  // Build chain forward
  const chainCities = [bestFromId, bestToId];
  let totalDistance = bestSegment.distanceKm;
  let totalTime = Math.round((bestSegment.distanceKm / bestSegment.avgSpeedKmh) * 60);
  let elevationGain = bestSegment.elevationEndM - bestSegment.elevationStartM;
  const coords = [...bestSegment.coordinates];
  let currentKey = bestSegment.to;
  let currentSegment = bestSegment;
  
  processedSegmentIds.add(currentSegment.id);
  
  // Continue chaining
  for (let i = 0; i < 10; i++) { // Prevent infinite loop
    const nextSegments = segmentMap.get(currentKey.toLowerCase().trim());
    if (!nextSegments || nextSegments.length === 0) break;
    
    // Find next segment that hasn't been processed and continues forward
    let nextSegment = null;
    for (const seg of nextSegments) {
      if (processedSegmentIds.has(seg.id)) continue;
      const fromId = findCityId(seg.from);
      const toId = findCityId(seg.to);
      if (fromId === bestToId && toId) {
        nextSegment = seg;
        break;
      }
    }
    
    if (!nextSegment) break;
    
    const toId = findCityId(nextSegment.to);
    if (!toId) break;
    
    chainCities.push(toId);
    totalDistance += nextSegment.distanceKm;
    totalTime += Math.round((nextSegment.distanceKm / nextSegment.avgSpeedKmh) * 60);
    elevationGain += nextSegment.elevationEndM - nextSegment.elevationStartM;
    coords.push(...nextSegment.coordinates.slice(1));
    
    processedSegmentIds.add(nextSegment.id);
    currentKey = nextSegment.to;
    currentSegment = nextSegment;
    bestToId = toId;
  }
  
  // Create edges between consecutive cities in chain
  const edges = [];
  for (let i = 0; i < chainCities.length - 1; i++) {
    // Calculate sub-distance from coordinates
    const subCoords = coords.slice(
      Math.floor(i * coords.length / (chainCities.length - 1)),
      Math.floor((i + 2) * coords.length / (chainCities.length - 1))
    );
    
    // Sum segment distances for this sub-section
    let subDistance = 0;
    // We'll just use the proportional distance
    subDistance = totalDistance / (chainCities.length - 1);
    
    edges.push({
      fromId: chainCities[i],
      toId: chainCities[i + 1],
      distanceKm: Math.round(subDistance),
      baseTimeMinutes: Math.round(totalTime / (chainCities.length - 1)),
      highwayCode: currentSegment.highwayCode,
      highwayName: currentSegment.highwayName,
      surface: currentSegment.surface,
      status: currentSegment.status,
      elevationGain: Math.round(elevationGain / (chainCities.length - 1)),
      intermediateCoords: subCoords.length >= 2 ? subCoords : coords.slice(0, 3),
    });
  }
  
  return { cities: chainCities, totalDistance, totalTime, highwayCode: currentSegment.highwayCode, highwayName: currentSegment.highwayName, surface: currentSegment.surface, status: currentSegment.status, elevationGain, coords };
}

// Start from major hubs
const startPoints = ['ktm', 'pkr', 'cht', 'mgl', 'btl', 'bhr', 'htd', 'brg', 'jnk', 'brd', 'brt', 'dhr', 'kkr', 'npg', 'srk', 'dhg', 'mhn', 'dml', 'plp', 'ilm', 'bgl', 'jml', 'nbz', 'kdr', 'dhk', 'sdh'];

for (const startId of startPoints) {
  const cityName = cityIdToName.get(startId);
  if (!cityName) continue;
  
  const startKey = cityName.toLowerCase().trim();
  const chain = buildChain(startKey);
  if (chain) {
    // Add edges
    for (let i = 0; i < chain.cities.length - 1; i++) {
      // Find the segment that corresponds to this city pair
      const fromCity = chain.cities[i];
      const toCity = chain.cities[i + 1];
      
      // Check if edge already exists
      const existing = generatedEdges.find(e => 
        (e.fromId === fromCity && e.toId === toCity) || (e.fromId === toCity && e.toId === fromCity)
      );
      if (!existing) {
        // Need to find the specific segment for this city pair
        const fromName = cityIdToName.get(fromCity)?.toLowerCase() || '';
        const toName = cityIdToName.get(toCity)?.toLowerCase() || '';
        
        // Find segment matching these cities
        const segment = allSegments.find(s => 
          s.from.toLowerCase().includes(fromName) && s.to.toLowerCase().includes(toName) ||
          s.from.toLowerCase().includes(toName) && s.to.toLowerCase().includes(fromName)
        );
        
        if (segment) {
          generatedEdges.push({
            fromId: fromCity,
            toId: toCity,
            distanceKm: segment.distanceKm,
            baseTimeMinutes: Math.round((segment.distanceKm / segment.avgSpeedKmh) * 60),
            highwayCode: segment.highwayCode,
            highwayName: segment.highwayName,
            surface: segment.surface,
            status: segment.status,
            elevationGain: segment.elevationEndM - segment.elevationStartM,
            intermediateCoords: segment.coordinates,
          });
        }
      }
    }
  }
}

// Also add bidirectional edges
const allEdges = [...generatedEdges];
for (const edge of generatedEdges) {
  const reverse = allEdges.find(e => e.fromId === edge.toId && e.toId === edge.fromId);
  if (!reverse) {
    allEdges.push({
      ...edge,
      fromId: edge.toId,
      toId: edge.fromId,
      elevationGain: -edge.elevationGain,
    });
  }
}

// Output TypeScript code
console.log('// Auto-generated edges from highway segments');
console.log('// Add these to ROAD_NETWORK_EDGES in routeOptimizer.ts');
console.log('');
for (const edge of allEdges) {
  console.log(`  {`);
  console.log(`    fromId: '${edge.fromId}',`);
  console.log(`    toId: '${edge.toId}',`);
  console.log(`    distanceKm: ${edge.distanceKm},`);
  console.log(`    baseTimeMinutes: ${edge.baseTimeMinutes},`);
  console.log(`    highwayCode: '${edge.highwayCode}',`);
  console.log(`    highwayName: '${edge.highwayName}',`);
  console.log(`    surface: '${edge.surface}',`);
  console.log(`    status: '${edge.status}',`);
  console.log(`    elevationGain: ${edge.elevationGain},`);
  console.log(`    intermediateCoords: ${JSON.stringify(edge.intermediateCoords)}`);
  console.log(`  },`);
}