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

const idAndName = [...bundled.matchAll(/id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'/g)].map(m => ({
  id: m[1],
  name: m[2],
}));

const bundledNames = new Set(idAndName.map(c => c.name.toLowerCase()));
const bundledById = new Map(idAndName.map(c => [c.id.toLowerCase(), c.name]));
const nameToId = new Map(idAndName.map(c => [c.name.toLowerCase(), c.id]));

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

function districtFor(name) {
  const n = name.toLowerCase();
  for (const d of Object.keys(centroids)) {
    if (n.includes(d) || d.includes(n)) return centroids[d];
  }
  return null;
}

function latLngFor(name) {
  const n = name.toLowerCase();
  const d = districtFor(n);
  if (d) return { lat: d.lat, lng: d.lng };
  return { lat: 27.5 + Math.random() * 4, lng: 83.5 + Math.random() * 5 };
}

const cities = new Map();

function addCity(name, source, district) {
  const key = name.toLowerCase();
  if (cities.has(key)) return;

  const coord = latLngFor(name);
  const id = nameToId.get(key) || key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  cities.set(key, {
    id,
    name,
    district: district || 'Unknown',
    lat: coord.lat,
    lng: coord.lng,
    source,
  });
}

// Add all bundled cities
idAndName.forEach(c => {
  const name = c.name;
  const district = districtFor(name)?.name;
  addCity(name, 'bundled', district);
});

// Add SNH published cities
pubCities.forEach(name => {
  const district = districtFor(name)?.name;
  addCity(name, 'snh_published', district);
});

// Add alias targets
aliasTargets.forEach(name => {
  const district = districtFor(name)?.name;
  addCity(name, 'snh_published', district);
});

const list = Array.from(cities.values());

const out = {
  cities: list,
  sourceBreakdown: {
    bundled: list.filter(c => c.source === 'bundled').length,
    snh_published: list.filter(c => c.source === 'snh_published').length,
  },
  total: list.length,
  publishedDistanceCoverage: {
    totalPublishedCities: pubCities.size,
    coveredCities: list.filter(c => pubCities.has(c.name)).length,
  }
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', outPath);
console.log('Total cities:', out.total);
console.log('Source breakdown:', out.sourceBreakdown);
console.log('Published coverage:', out.publishedDistanceCoverage);
