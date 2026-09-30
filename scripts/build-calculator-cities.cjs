/**
 * Build calculator city coverage from bundled data + SNH reference.
 *
 * Outputs:
 * - public/data/calculator-cities.json
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'public', 'data', 'calculator-cities.json');

const bundledPath = path.join(root, 'src', 'data', 'nepalHighwaysData.ts');
const bundled = fs.readFileSync(bundledPath, 'utf8');

// Extract the CITIES_AND_JUNCTIONS section
const citySection = bundled.split(/export const CITIES_AND_JUNCTIONS/)[1]?.split(/export const/)[0] || '';

// Match individual city entries
const cityRegex = /\{ id: '([^']+)'[\s\S]*?name: '([^']+)'[\s\S]*?nepaliName: '[^']*'[\s\S]*?district: '([^']+)'[\s\S]*?province: '([^']+)'[\s\S]*?lat:\s*([\d.]+)[\s\S]*?lng:\s*([\d.]+)[\s\S]*?elevationM:\s*(\d+)[\s\S]*?isMajorHub:\s*(true|false)[\s\S]*?connectedHighways:\s*\[([^\]]*)\]/g;

const idAndName = [];
let match;
while ((match = cityRegex.exec(citySection)) !== null) {
  idAndName.push({
    id: match[1],
    name: match[2],
    district: match[3],
    province: match[4],
    lat: parseFloat(match[5]),
    lng: parseFloat(match[6]),
    elevationM: parseInt(match[7]),
    isMajorHub: match[8] === 'true',
    connectedHighways: match[9].replace(/'/g, '').split(',').map(s => s.trim()).filter(Boolean),
  });
}

const bundledNames = new Set(idAndName.map(c => c.name.toLowerCase()));
const bundledById = new Map(idAndName.map(c => [c.id.toLowerCase(), c.name]));
const nameToId = new Map(idAndName.map(c => [c.name.toLowerCase(), c.id]));

const bundledHighwayCityIds = new Set(
  idAndName.filter(c => c.connectedHighways.length > 0).map(c => c.id)
);

const ref = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'snh-reference.json'), 'utf8'));
const pubCities = new Set();
for (const key of Object.keys(ref.published_distances)) {
  key.split('|').forEach(c => pubCities.add(c));
}
const aliasTargets = new Set();
for (const aliases of Object.values(ref.city_aliases || {})) {
  aliases.forEach(a => aliasTargets.add(a));
}

const centroidsRaw = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'district-centroids.json'), 'utf8'));
const centroids = centroidsRaw.reduce((m, d) => { m[(d.name || '').toLowerCase()] = d; return m; }, {});

// Comprehensive district-to-province mapping for all 77 districts of Nepal
const DISTRICT_TO_PROVINCE = {
  // Province 1 (Koshi)
  'bhojpur': 'Koshi', 'dhankuta': 'Koshi', 'ilam': 'Koshi', 'jhapa': 'Koshi',
  'khotang': 'Koshi', 'okhaldhunga': 'Koshi', 'panchthar': 'Koshi',
  'sankhuwasabha': 'Koshi', 'solukhumbu': 'Koshi', 'sunsari': 'Koshi',
  'taplejung': 'Koshi', 'terhathum': 'Koshi', 'udayapur': 'Koshi', 'morang': 'Koshi',
  // Province 2 (Madhesh)
  'bara': 'Madhesh', 'dhanusha': 'Madhesh', 'mahottari': 'Madhesh',
  'parsa': 'Madhesh', 'rautahat': 'Madhesh', 'saptari': 'Madhesh',
  'sarlahi': 'Madhesh', 'siraha': 'Madhesh',
  // Province 3 (Bagmati)
  'bagmati': 'Bagmati', 'chitwan': 'Bagmati', 'chitawan': 'Bagmati', 'dhading': 'Bagmati',
  'dolakha': 'Bagmati', 'gorkha': 'Gandaki', 'kabhrepalanchok': 'Bagmati', 'kavrepalanchok': 'Bagmati',
  'kathmandu': 'Bagmati', 'lalitpur': 'Bagmati', 'makwanpur': 'Bagmati',
  'nuwakot': 'Bagmati', 'ramechhap': 'Bagmati', 'rasuwa': 'Bagmati',
  'sindhuli': 'Bagmati', 'sindhupalchok': 'Bagmati', 'nawalparasi east': 'Bagmati',
  // Province 4 (Gandaki)
  'baglung': 'Gandaki', 'kaski': 'Gandaki', 'lamjung': 'Gandaki', 'manang': 'Gandaki',
  'mustang': 'Gandaki', 'myagdi': 'Gandaki', 'syangja': 'Gandaki', 'tanahu': 'Gandaki',
  'tanahun': 'Gandaki', 'gulmi': 'Gandaki', 'palpa': 'Gandaki', 'salyan': 'Gandaki',
  'gorkha': 'Gandaki',
  // Province 5 (Lumbini)
  'arghakhanchi': 'Lumbini', 'banke': 'Lumbini', 'bardiya': 'Lumbini',
  'dang': 'Lumbini', 'kapilvastu': 'Lumbini', 'kapilbastu': 'Lumbini',
  'pyuthan': 'Lumbini', 'rupandehi': 'Lumbini', 'rolpa': 'Lumbini',
  'nawalparasi west': 'Lumbini',
  // Province 6 (Karnali)
  'dolpa': 'Karnali', 'humla': 'Karnali', 'jajarkot': 'Karnali', 'jumla': 'Karnali',
  'kalikot': 'Karnali', 'mugu': 'Karnali', 'rukum east': 'Karnali',
  'rukum west': 'Karnali', 'surkhet': 'Karnali', 'dailekh': 'Karnali',
  // Province 7 (Sudurpashchim)
  'achham': 'Sudurpashchim', 'baitadi': 'Sudurpashchim', 'bajhang': 'Sudurpashchim',
  'bajura': 'Sudurpashchim', 'dadeldhura': 'Sudurpashchim', 'darchula': 'Sudurpashchim',
  'doti': 'Sudurpashchim', 'kanchanpur': 'Sudurpashchim', 'kailali': 'Sudurpashchim',
};

// City-to-district mapping for cities whose names don't match their district
const CITY_TO_DISTRICT = {
  // Koshi
  'dhalkebar': 'Dhanusha',
  'siddhicharan': 'Okhaldhunga',
  'myanglung': 'Terhathum',
  'phidim': 'Panchthar',
  'inaruwa': 'Sunsari',
  'gaighat': 'Sunsari',
  'jaleshwor': 'Rupandehi',
  'tribhuwannager': 'Jhapa',
  'khalanga': 'Sankhuwasabha',
  'diktel': 'Dhankuta',
  'salleri': 'Solukhumbu',
  'khandbari': 'Khotang',
  // Madhesh
  // Madhesh
  'arungkhola': 'Rautahat',
  'malangawa': 'Sarlahi',
  'gaur': 'Nawalparasi East',
  'kalaiya': 'Bara',
  // Bagmati
  'narayangadh': 'Chitwan',
  'narayan ghad': 'Chitwan',
  'kohalpur': 'Chitwan',
  'attaria': 'Kailali',
  'dhunche': 'Rasuwa',
  'kamalamai': 'Sindhuli',
  'bhimeshwar': 'Rasuwa',
  'bhimeshwor': 'Rasuwa',
  'nilkantha': 'Chitwan',
  'nilakantha': 'Chitwan',
  'manthali': 'Ramechhap',
  'bharatpur': 'Chitwan',
  'kawasoti': 'Nawalparasi East',
  'byas': 'Tanahun',
  // Gandaki
  'jomsom': 'Mustang',
  'beni': 'Myagdi',
  'besishahar': 'Lamjung',
  'putalibazar': 'Kaski',
  'kusma': 'Syangja',
  'libang': 'Gulmi',
  'resunga': 'Gulmi',
  'resunga(via butwal)': 'Gulmi',
  'sandhikhark': 'Arghakhanchi',
  'tansen(via butwal)': 'Palpa',
  'gorkha': 'Gorkha',
  'salyan': 'Salyan',
  'manma': 'Salyan',
  'musikot': 'Rukum West',
  // Lumbini
  'butwal (mahendrachok)': 'Rupandehi',
  'gaddachowki': 'Kanchanpur',
  'gaddachauki': 'Kanchanpur',
  'siddharthanagar': 'Rupandehi',
  'kapilvastu': 'Kapilvastu',
  'kapilbastu': 'Kapilvastu',
  'ramgram': 'Nawalparasi West',
  'tansen': 'Palpa',
  'dipayal silgadhi': 'Doti',
  // Karnali
  'simikot': 'Humla',
  'rukumkot': 'Rukum West',
  'birendranagar': 'Surkhet',
  'chandannath': 'Jumla',
  'bajura': 'Bajura',
  // Sudurpashchim
  'gamgadhi': 'Bajura',
  'martadi': 'Baitadi',
  'jayaprithvi': 'Bajhang',
  'dasharathchand': 'Baitadi',
  'amargadhi': 'Bardiya',
  'dipayal': 'Doti',
  'mangalsen': 'Achham',
  'dhangadi': 'Kailali',
  'dhangadhi': 'Kailali',
  'bhimdatta': 'Kanchanpur',
  'narayan': 'Chitwan',
  'lazimpat': 'Kailali',
  'dharan': 'Sunsari',
};

// Build comprehensive coordinate lookup from multiple data sources
const coordLookup = new Map();

// 1. District centroids
for (const d of centroidsRaw) {
  if (d.name && d.lat && d.lng) {
    coordLookup.set(d.name.toLowerCase(), { lat: d.lat, lng: d.lng, district: d.name, source: 'district_centroid' });
  }
}

// 2. Palika coordinates
try {
  const palikaData = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'palika-coords.json'), 'utf8'));
  if (Array.isArray(palikaData)) {
    for (const p of palikaData) {
      if (p.Palika && p.lat && p.lng) {
        const key = p.Palika.toLowerCase();
        if (!coordLookup.has(key)) {
          coordLookup.set(key, { lat: p.lat, lng: p.lng, district: p.District, source: 'palika_coords' });
        }
      }
    }
  }
} catch (e) {
  console.warn('  palika-coords.json not available');
}

// 3. Cities.json (municipalities grouped by type)
try {
  const citiesData = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'cities.json'), 'utf8'));
  for (const group of Object.values(citiesData)) {
    if (Array.isArray(group)) {
      for (const c of group) {
        if (c.name && c.lat && c.lng) {
          const key = c.name.toLowerCase();
          if (!coordLookup.has(key)) {
            coordLookup.set(key, { lat: c.lat, lng: c.lng, district: c.district, source: 'cities_json' });
          }
        }
      }
    }
  }
} catch (e) {
  console.warn('  cities.json not available');
}

// 4. GeoJSON town coordinates (from highway link endpoints)
try {
  const geoTownData = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'geojson-town-coords.json'), 'utf8'));
  if (Array.isArray(geoTownData.towns)) {
    for (const t of geoTownData.towns) {
      if (t.name && t.lat && t.lng) {
        const key = t.name.toLowerCase();
        if (!coordLookup.has(key)) {
          coordLookup.set(key, { lat: t.lat, lng: t.lng, district: null, source: 'geojson_endpoint' });
        }
      }
    }
  }
} catch (e) {
  console.warn('  geojson-town-coords.json not available');
}

// 5. Road graph snapped node coordinates (best source for highway cities)
const roadGraph = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'road-graph.json'), 'utf8'));
const graphCitySnaps = new Set(Object.keys(roadGraph.citySnap || {}));
const graphCitySnapByName = roadGraph.citySnapByName || {};
const graphNodes = roadGraph.nodes || [];

// Build a map from citySnap id -> [lat, lng] using graph nodes
const graphCoordLookup = new Map();
for (const [cityId, nodeId] of Object.entries(roadGraph.citySnap || {})) {
  if (typeof nodeId === 'number' && graphNodes[nodeId]) {
    graphCoordLookup.set(cityId.toLowerCase(), { lat: graphNodes[nodeId][0], lng: graphNodes[nodeId][1], source: 'road_graph' });
  }
}


function districtFor(name) {
  const n = name.toLowerCase();
  for (const d of Object.keys(centroids)) {
    if (n.includes(d) || d.includes(n)) return centroids[d];
  }
  return null;
}

function resolveDistrictProvince(name) {
  const norm = normalizeLookupName(name);
  const lower = name.toLowerCase();
  let district = CITY_TO_DISTRICT[norm] || CITY_TO_DISTRICT[lower] || CITY_TO_DISTRICT[lower.replace(/\s*\(.*\)\s*/g, '').trim()];
  if (!district) {
    const d = districtFor(name);
    if (d) district = d.name;
  }
  if (!district) district = 'Unknown';
  const province = DISTRICT_TO_PROVINCE[district.toLowerCase()] || 'Unknown';
  return { district, province };
}

// Build lookup from bundled data for fast district/province access
const bundledInfo = new Map();
for (const c of idAndName) {
  bundledInfo.set(c.name.toLowerCase(), { district: c.district, province: c.province });
  const norm = normalizeLookupName(c.name);
  bundledInfo.set(norm, { district: c.district, province: c.province });
}

const SUSPICIOUS_NODE_COORDS = { lat: 27.50527, lng: 83.49345 };

// Hardcoded coordinates for cities not found in any data source (by normalized lowercase name)
const FALLBACK_COORDINATES = {
  'jaleshwor': { lat: 27.6135, lng: 83.1275 },
  'manma': { lat: 28.3217, lng: 81.3575 },
  'khalanga': { lat: 27.3028, lng: 86.8628 },
  'gaur': { lat: 27.652, lng: 83.2 },
  'lazimpat': { lat: 28.71, lng: 80.6 },
  'arungkhola': { lat: 26.707, lng: 85.492 },
};

// Synthetic/placeholder node IDs (361xx range) that were auto-generated with wrong coordinates
const SUSPICIOUS_NODE_IDS = new Set([36121, 36122, 36123, 36124, 36125, 36126, 36127, 36128, 36129, 36130, 36131, 36132, 36133, 36134, 36135, 36136, 36137, 36138]);

const CITY_ALIASES = {
  'dhangadi': 'dhangadhi',
  'nilkantha': 'nilakantha',
  'bhimeshwar': 'bhimeshwor',
  'gaddachowki': 'gaddachauki',
  'narayangadh': 'narayanghat',
  'narayan ghad': 'narayanghat',
  'tribhuwannager': 'jhapa',
  'dipayal silgadhi': 'dipayal',
  'butwal (mahendrachok)': 'butwal',
  'bharatpur (narayani)': 'bharatpur',
  'birgunj (parsa)': 'birgunj',
  'bhaktapur(suryabinayak)': 'bhaktapur',
  'byas': 'byas municipality boundary',
  'kusma': 'kushma',
  'kapilvastu': 'kapilbastu',
  'jayaprithvi': 'jayaprithivi',
  'dasharathchand': 'dasharathchanda',
  'libang': 'gulmi',
};

const coordLookupNorm = new Map();
for (const [key, val] of coordLookup) {
  const normKey = normalizeLookupName(key);
  if (!coordLookupNorm.has(normKey)) {
    coordLookupNorm.set(normKey, val);
  }
}

function normalizeLookupName(name) {
  return name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
}

function latLngFor(name, id) {
  const aliasName = CITY_ALIASES[name.toLowerCase()] || name;
  const normName = normalizeLookupName(name);
  const normAlias = normalizeLookupName(aliasName);

  // 0. Check hardcoded fallback coordinates first (authoritative for known bad snaps)
  if (FALLBACK_COORDINATES[normName] || FALLBACK_COORDINATES[aliasName.toLowerCase()]) {
    const fb = FALLBACK_COORDINATES[normName] || FALLBACK_COORDINATES[aliasName.toLowerCase()];
    return { lat: fb.lat, lng: fb.lng };
  }

  // 1. Check citySnapByName with normalized alias name first (most accurate for real cities)
  for (const lookupName of [normAlias, normName, aliasName.toLowerCase(), name.toLowerCase()]) {
    const nodeId = graphCitySnapByName[lookupName];
    if (typeof nodeId === 'number' && graphNodes[nodeId]) {
      const node = graphNodes[nodeId];
      const isSuspiciousCoord = node[0] === SUSPICIOUS_NODE_COORDS.lat && node[1] === SUSPICIOUS_NODE_COORDS.lng;
      const isSuspiciousId = SUSPICIOUS_NODE_IDS.has(nodeId);
      if (!isSuspiciousCoord && !isSuspiciousId) {
        return { lat: node[0], lng: node[1] };
      }
    }
  }

  // 2. Check comprehensive coordinate lookup with original, normalized, and alias names
  for (const lookupName of [name.toLowerCase(), normName, aliasName.toLowerCase(), normAlias]) {
    if (coordLookup.has(lookupName)) {
      const c = coordLookup.get(lookupName);
      return { lat: c.lat, lng: c.lng };
    }
    if (coordLookupNorm.has(lookupName)) {
      const c = coordLookupNorm.get(lookupName);
      return { lat: c.lat, lng: c.lng };
    }
  }

  // 3. Check road graph snapped coordinates by ID (skip suspicious generic node 8044)
  if (id && graphCoordLookup.has(id.toLowerCase())) {
    const g = graphCoordLookup.get(id.toLowerCase());
    const graphNodeId = roadGraph.citySnap[id.toLowerCase()];
    const isSuspiciousId = typeof graphNodeId === 'number' && SUSPICIOUS_NODE_IDS.has(graphNodeId);
    if (!isSuspiciousId && !(g.lat === SUSPICIOUS_NODE_COORDS.lat && g.lng === SUSPICIOUS_NODE_COORDS.lng)) {
      return { lat: g.lat, lng: g.lng };
    }
  }

  // 4. Try district centroid as last resort (instead of random!)
  const d = districtFor(name) || districtFor(aliasName) || districtFor(normAlias);
  if (d) return { lat: d.lat, lng: d.lng };

  // 5. Nepal center fallback (NOT random)
  console.warn(`  WARNING: no coordinate found for "${name}" (${id}), using Nepal center`);
  return { lat: 27.5, lng: 83.5 };
}

const cities = new Map();

function isOnHighway(name, id) {
  if (bundledHighwayCityIds.has(id)) return true;
  if (graphCitySnaps.has(id)) return true;
  const normalizedName = name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
  if (graphCitySnaps.has(normalizedName)) return true;
  if (graphCitySnapByName[normalizedName]) return true;
  // Try without parenthetical suffix
  const cleanName = normalizedName.replace(/\s*\(.*\)\s*/, '').trim();
  return !!graphCitySnapByName[cleanName];
}

function addCity(name, source, district, province, cityType) {
  const key = name.toLowerCase();
  if (cities.has(key)) return;

  const id = nameToId.get(key) || key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const coord = latLngFor(name, id);
  const onHighway = isOnHighway(name, id);
  const finalProvince = DISTRICT_TO_PROVINCE[district.toLowerCase()] || province || 'Unknown';
  cities.set(key, {
    id,
    name,
    district: district || 'Unknown',
    province: finalProvince,
    lat: coord.lat,
    lng: coord.lng,
    source,
    cityType,
    onHighway,
  });
}

idAndName.forEach(c => {
  const district = CITY_TO_DISTRICT[c.name.toLowerCase()] || c.district;
  const province = DISTRICT_TO_PROVINCE[district.toLowerCase()] || c.province;
  addCity(c.name, 'bundled', district, province, 'Highway Node');
});

pubCities.forEach(name => {
  const info = bundledInfo.get(name.toLowerCase()) || bundledInfo.get(normalizeLookupName(name)) || resolveDistrictProvince(name);
  addCity(name, 'snh_published', info.district, info.province, 'Published');
});

aliasTargets.forEach(name => {
  const info = bundledInfo.get(name.toLowerCase()) || bundledInfo.get(normalizeLookupName(name)) || resolveDistrictProvince(name);
  addCity(name, 'snh_published', info.district, info.province, 'Published Alias');
});

const list = Array.from(cities.values());

const cityTypeCounts = {};
list.forEach(c => {
  const type = c.cityType || 'Unknown';
  cityTypeCounts[type] = (cityTypeCounts[type] || 0) + 1;
});

const out = {
  cities: list,
  sourceBreakdown: {
    bundled: list.filter(c => c.source === 'bundled').length,
    snh_published: list.filter(c => c.source === 'snh_published').length,
  },
  provinceBreakdown: (() => {
    const b = {};
    list.forEach(c => { b[c.province] = (b[c.province] || 0) + 1; });
    return b;
  })(),
  cityTypeBreakdown: cityTypeCounts,
  total: list.length,
  highwayCoverage: {
    totalCities: list.length,
    citiesOnHighway: list.filter(c => c.onHighway).length,
    citiesNotOnHighway: list.filter(c => !c.onHighway).length,
  },
  publishedDistanceCoverage: {
    totalPublishedCities: pubCities.size,
    coveredCities: list.filter(c => pubCities.has(c.name)).length,
  }
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', outPath);
console.log('Total cities:', out.total);
console.log('Source breakdown:', out.sourceBreakdown);
console.log('City type breakdown:', out.cityTypeBreakdown);
console.log('Highway coverage:', out.highwayCoverage);
console.log('Published coverage:', out.publishedDistanceCoverage);
