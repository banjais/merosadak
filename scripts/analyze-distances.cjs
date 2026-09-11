const fs = require('fs');
const path = require('path');

// Load the built data from dist
const highwayInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data', 'highway-info.json'), 'utf8'));
const cities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dist', 'data', 'cities-and-junctions.json'), 'utf8'));

// Build city lookup by id
const cityById = new Map();
cities.forEach(city => {
  cityById.set(city.id, city);
});

// Current ROAD_NETWORK_EDGES from routeOptimizer.ts
const ROAD_NETWORK_EDGES = [
  { fromId: 'ktm', toId: 'nbz', distanceKm: 26, highwayCode: 'H02/H04', highwayName: 'Nagdhunga Corridor' },
  { fromId: 'nbz', toId: 'mgl', distanceKm: 88, highwayCode: 'H04', highwayName: 'Prithvi Highway' },
  { fromId: 'mgl', toId: 'dml', distanceKm: 44, highwayCode: 'H04', highwayName: 'Prithvi Highway (Tanahun)' },
  { fromId: 'dml', toId: 'pkr', distanceKm: 42, highwayCode: 'H04', highwayName: 'Prithvi Highway (Pokhara entry)' },
  { fromId: 'mgl', toId: 'cht', distanceKm: 36, highwayCode: 'H05', highwayName: 'Narayanghat-Mugling Road' },
  { fromId: 'cht', toId: 'htd', distanceKm: 76, highwayCode: 'H01', highwayName: 'Mahendra Highway (Chitwan-Makwanpur)' },
  { fromId: 'htd', toId: 'brg', distanceKm: 54, highwayCode: 'H02', highwayName: 'Tribhuvan Highway (Terai Section)' },
  { fromId: 'nbz', toId: 'htd', distanceKm: 106, highwayCode: 'H02', highwayName: 'Tribhuvan Highway (Daman Pass)' },
  { fromId: 'cht', toId: 'btl', distanceKm: 114, highwayCode: 'H01', highwayName: 'Mahendra Highway (Daunne Section)' },
  { fromId: 'btl', toId: 'bhr', distanceKm: 22, highwayCode: 'H10', highwayName: 'Siddhartha Highway (6-Lane Corridor)' },
  { fromId: 'btl', toId: 'plp', distanceKm: 39, highwayCode: 'H10', highwayName: 'Siddhartha Highway (Siddhababa section)' },
  { fromId: 'plp', toId: 'pkr', distanceKm: 120, highwayCode: 'H10', highwayName: 'Siddhartha Highway (Syangja section)' },
  { fromId: 'pkr', toId: 'bgl', distanceKm: 72, highwayCode: 'H15', highwayName: 'Mid-Hill Highway (Pokhara-Baglung)' },
  { fromId: 'ktm', toId: 'dhk', distanceKm: 30, highwayCode: 'H03', highwayName: 'Araniko 6-Lane Expressway' },
  { fromId: 'dhk', toId: 'kdr', distanceKm: 83, highwayCode: 'H03', highwayName: 'Araniko Highway (Bhotekoshi Gorge)' },
  { fromId: 'dhk', toId: 'sdh', distanceKm: 120, highwayCode: 'H13', highwayName: 'B.P. Koirala Highway (Kavre-Sindhuli)' },
  { fromId: 'sdh', toId: 'brd', distanceKm: 40, highwayCode: 'H13', highwayName: 'B.P. Koirala Highway (Sindhuli-Bardibas)' },
  { fromId: 'brd', toId: 'jnk', distanceKm: 34, highwayCode: 'H01/Link', highwayName: 'Bardibas-Janakpur Highway' },
  { fromId: 'brd', toId: 'htd', distanceKm: 130, highwayCode: 'H01', highwayName: 'Mahendra Highway (Central Terai)' },
  { fromId: 'brd', toId: 'brt', distanceKm: 175, highwayCode: 'H01', highwayName: 'Mahendra Highway (East Section & Koshi Barrage)' },
  { fromId: 'brt', toId: 'dhr', distanceKm: 42, highwayCode: 'H08 Link', highwayName: '6-Lane Commercial Highway' },
  { fromId: 'brt', toId: 'kkr', distanceKm: 105, highwayCode: 'H01', highwayName: 'Mahendra Highway (Jhapa-Morang 4-lane)' },
  { fromId: 'kkr', toId: 'ilm', distanceKm: 82, highwayCode: 'H09', highwayName: 'Mechi Highway (Tea Garden Hill Climb)' },
  { fromId: 'btl', toId: 'npg', distanceKm: 240, highwayCode: 'H01', highwayName: 'Mahendra Highway (Kapilvastu-Banke)' },
  { fromId: 'npg', toId: 'srk', distanceKm: 113, highwayCode: 'H12', highwayName: 'Ratna Highway (Kohalpur-Birendranagar)' },
  { fromId: 'srk', toId: 'jml', distanceKm: 232, highwayCode: 'H06', highwayName: 'Karnali Highway (Mountain Gorge Road)' },
  { fromId: 'npg', toId: 'dhg', distanceKm: 165, highwayCode: 'H01', highwayName: 'Mahendra Highway (Chisapani Karnali Bridge)' },
  { fromId: 'dhg', toId: 'mhn', distanceKm: 52, highwayCode: 'H01', highwayName: 'Mahendra Highway (Far Western Terminus)' }
];

// Highway name matching keywords
const HIGHWAY_NAME_MAP = {
  'Mahendra Highway': ['h01'],
  'Tribhuvan Highway': ['h41', 'h02'],
  'Araniko Highway': ['h34', 'h03'],
  'Prithvi Highway': ['h17', 'h04'],
  'Narayanghat-Mugling': ['h05'],
  'Karnali Highway': ['h06'],
  'Koshi Highway': ['h08'],
  'Mechi Highway': ['h02', 'h09'],
  'Siddhartha Highway': ['h47', 'h10'],
  'Ratna Highway': ['h58', 'h12'],
  'BP Highway': ['h13'],
  'Mid-Hill Highway': ['h03', 'h15']
};

function findMatchingHighway(edge) {
  const nameLower = edge.highwayName.toLowerCase();
  for (const [keyword, codes] of Object.entries(HIGHWAY_NAME_MAP)) {
    if (nameLower.includes(keyword.toLowerCase())) {
      for (const code of codes) {
        const hw = highwayInfo.find(h => h.code === code.toUpperCase());
        if (hw) return hw;
      }
    }
  }
  return null;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function computeAccurateDistance(edge) {
  const hw = findMatchingHighway(edge);
  if (!hw || !hw.segments || hw.segments.length === 0) return edge.distanceKm;
  
  const fromCity = cityById.get(edge.fromId);
  const toCity = cityById.get(edge.toId);
  if (!fromCity || !toCity) return edge.distanceKm;
  
  // Find segments between from and to cities
  let matchedDistance = 0;
  let foundStart = false;
  let foundEnd = false;
  
  for (const seg of hw.segments) {
    const segFrom = seg.from.toLowerCase();
    const segTo = seg.to.toLowerCase();
    const fromName = fromCity.name.toLowerCase();
    const toName = toCity.name.toLowerCase();
    
    // Check if segment matches from city
    if (!foundStart) {
      const fromWords = fromName.split(/[\s\/]+/);
      const segFromWords = segFrom.split(/[\s\-]+/);
      const matchesFrom = fromWords.some(fw => fw.length > 2 && segFromWords.some(sw => sw.includes(fw) || fw.includes(sw)));
      
      if (matchesFrom) {
        foundStart = true;
      } else if (seg.coordinates && seg.coordinates.length > 0) {
        const midCoord = seg.coordinates[Math.floor(seg.coordinates.length / 2)];
        const dist = haversine(fromCity.lat, fromCity.lng, midCoord[1], midCoord[0]);
        if (dist < 20) foundStart = true;
      }
    }
    
    if (foundStart && !foundEnd) {
      matchedDistance += seg.distanceKm;
    }
    
    // Check if segment matches to city
    if (!foundEnd) {
      const toWords = toName.split(/[\s\/]+/);
      const segToWords = segTo.split(/[\s\-]+/);
      const matchesTo = toWords.some(tw => tw.length > 2 && segToWords.some(sw => sw.includes(tw) || tw.includes(sw)));
      
      if (matchesTo) {
        foundEnd = true;
      } else if (seg.coordinates && seg.coordinates.length > 0) {
        const midCoord = seg.coordinates[Math.floor(seg.coordinates.length / 2)];
        const dist = haversine(toCity.lat, toCity.lng, midCoord[1], midCoord[0]);
        if (dist < 20) foundEnd = true;
      }
    }
  }
  
  if (foundStart && foundEnd && matchedDistance > 0) {
    return Math.round(matchedDistance);
  }
  
  // Fallback: use current distance
  return edge.distanceKm;
}

console.log('Edge distance analysis:');
console.log('Code       | From  | To    | Current | Accurate | Highway Name');
console.log('-----------|-------|-------|---------|----------|------------');

let changes = [];
ROAD_NETWORK_EDGES.forEach(edge => {
  const accurate = computeAccurateDistance(edge);
  const diff = accurate - edge.distanceKm;
  const marker = Math.abs(diff) > 2 ? ' <<<' : '';
  console.log(`${edge.highwayCode.padEnd(10)} | ${edge.fromId.padEnd(5)} | ${edge.toId.padEnd(5)} | ${String(edge.distanceKm).padStart(7)} | ${String(accurate).padStart(8)} | ${edge.highwayName}${marker}`);
  
  if (Math.abs(diff) > 2) {
    changes.push({ ...edge, newDistanceKm: accurate });
  }
});

console.log('\nChanges needed (>2km diff):');
changes.forEach(c => {
  console.log(`  ${c.fromId}->${c.toId}: ${c.distanceKm} -> ${c.newDistanceKm} (${c.highwayCode} | ${c.highwayName})`);
});
