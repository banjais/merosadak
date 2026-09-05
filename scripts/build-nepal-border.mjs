import fs from 'node:fs';

const j = JSON.parse(fs.readFileSync('public/data/nepal_boundary.geojson', 'utf8'));

function roundCoord(coord, digits = 4) {
  return [Math.round(coord[0] * 10 ** digits), Math.round(coord[1] * 10 ** digits)];
}

function unroundCoord(coord, digits = 4) {
  return [coord[0] / 10 ** digits, coord[1] / 10 ** digits];
}

// Extract all directed edges from all district polygons
const allEdges = [];
j.features.forEach(f => {
  if (!f.geometry) return;
  const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
  polys.forEach(poly => {
    const ring = poly[0];
    for (let i = 0; i < ring.length - 1; i++) {
      const a = roundCoord(ring[i]);
      const b = roundCoord(ring[i + 1]);
      allEdges.push({ a, b, district: f.properties.DIST_EN, province: f.properties.ADM1_EN });
    }
  });
});

console.log('total edges:', allEdges.length);

// Count edges (treating a->b same as b->a)
const edgeCount = new Map();
const edgeData = new Map();
allEdges.forEach(({ a, b, district, province }) => {
  const ka = a.join(',') + '->' + b.join(',');
  const kb = b.join(',') + '->' + a.join(',');
  edgeCount.set(ka, (edgeCount.get(ka) || 0) + 1);
  edgeCount.set(kb, (edgeCount.get(kb) || 0) + 1);
  if (!edgeData.has(ka)) edgeData.set(ka, []);
  edgeData.get(ka).push({ a, b, district, province });
});

// Find edges that appear only once = international border
const borderEdges = [];
edgeCount.forEach((count, k) => {
  if (count === 1) {
    const data = edgeData.get(k) || edgeData.get(k.split('->').reverse().join('->'));
    if (data && data[0]) {
      borderEdges.push({ a: data[0].a, b: data[0].b, province: data[0].province });
    }
  }
});

console.log('border edges:', borderEdges.length);

// Build adjacency map for border
const borderAdj = new Map();
borderEdges.forEach(({ a, b }) => {
  const ak = a.join(',');
  const bk = b.join(',');
  if (!borderAdj.has(ak)) borderAdj.set(ak, []);
  if (!borderAdj.has(bk)) borderAdj.set(bk, []);
  borderAdj.get(ak).push(b);
  borderAdj.get(bk).push(a);
});

console.log('border nodes:', borderAdj.size);

// Walk the border as a single polygon
const startNode = borderEdges[0].a;
const borderPath = [startNode];
let cur = startNode;
let prev = null;
let safety = 0;

while (safety++ < 1000000) {
  const neighbors = (borderAdj.get(cur.join(',')) || []).filter(n => !prev || n.join(',') !== prev.join(','));
  if (!neighbors.length) break;
  const next = neighbors[0];
  if (next.join(',') === startNode.join(',')) {
    borderPath.push(next);
    break;
  }
  borderPath.push(next);
  prev = cur;
  cur = next;
}

console.log('border path length:', borderPath.length);
console.log('closed:', borderPath.length > 1 && borderPath[0].join(',') === borderPath[borderPath.length - 1].join(','));

// Save Nepal international border
const borderGeojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Nepal International Border', source: 'derived from 77 district boundaries' },
      geometry: {
        type: 'Polygon',
        coordinates: [borderPath.map(p => unroundCoord(p))]
      }
    }
  ]
};

fs.writeFileSync('public/data/nepal-international-border.geojson', JSON.stringify(borderGeojson));
console.log('saved border to public/data/nepal-international-border.geojson');

// Now derive province boundaries
// For each province, keep edges that are on the border OR between different provinces
const provinceEdges = new Map();

borderEdges.forEach(({ a, b, province }) => {
  const key = a.join(',') + '->' + b.join(',');
  if (!provinceEdges.has(province)) provinceEdges.set(province, []);
  provinceEdges.get(province).push({ a, b });
});

// Find inter-province edges (edges between districts of different provinces)
const interProvinceEdges = new Map();
allEdges.forEach(({ a, b, province }) => {
  const ka = a.join(',') + '->' + b.join(',');
  const kb = b.join(',') + '->' + a.join(',');
  const otherEntry = edgeData.get(kb)?.find(e => e.province !== province);
  if (otherEntry) {
    // This edge is between two provinces
    const pairKey = [province, otherEntry.province].sort().join('-');
    if (!interProvinceEdges.has(pairKey)) interProvinceEdges.set(pairKey, []);
    interProvinceEdges.get(pairKey).push({ a, b, p1: province, p2: otherEntry.province });
  }
});

console.log('inter-province edge pairs:', interProvinceEdges.size);

// Add inter-province edges to both provinces
for (const [pairKey, edges] of interProvinceEdges) {
  const [p1, p2] = pairKey.split('-');
  edges.forEach(({ a, b }) => {
    if (!provinceEdges.has(p1)) provinceEdges.set(p1, []);
    if (!provinceEdges.has(p2)) provinceEdges.set(p2, []);
    provinceEdges.get(p1).push({ a, b });
    provinceEdges.get(p2).push({ a, b });
  });
}

// Build province boundaries by walking each province's edge graph
const provinceGeojsonFeatures = [];

for (const [provinceCode, edges] of provinceEdges) {
  // Build adjacency map
  const adj = new Map();
  edges.forEach(({ a, b }) => {
    const ak = a.join(',');
    const bk = b.join(',');
    if (!adj.has(ak)) adj.set(ak, []);
    if (!adj.has(bk)) adj.set(bk, []);
    adj.get(ak).push(b);
    adj.get(bk).push(a);
  });

  // Walk boundary as polygon(s)
  const visited = new Set();
  const polygons = [];

  for (const [start] of adj) {
    if (visited.has(start)) continue;
    const path = [];
    let cur = start.split(',').map(Number);
    let prev = null;
    let safety = 0;

    while (safety++ < 100000) {
      visited.add(cur.join(','));
      path.push(unroundCoord(cur));

      const neighbors = (adj.get(cur.join(',')) || []).filter(n => !prev || n.join(',') !== prev.join(','));
      if (!neighbors.length) break;

      const next = neighbors[0];
      if (next.join(',') === start) {
        path.push(unroundCoord(next));
        break;
      }
      prev = cur;
      cur = next;
    }

    if (path.length > 2) {
      polygons.push(path);
    }
  }

  if (polygons.length > 0) {
    const feature = {
      type: 'Feature',
      properties: {
        ADM1_EN: provinceCode,
        name: `Province ${provinceCode}`,
        source: 'derived from 77 district boundaries'
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: polygons.map(p => [p])
      }
    };
    provinceGeojsonFeatures.push(feature);
    console.log(`Province ${provinceCode}: ${polygons.length} polygon(s), ${polygons.reduce((sum, p) => sum + p.length, 0)} points`);
  }
}

// Save province boundaries
const provinceGeojson = {
  type: 'FeatureCollection',
  features: provinceGeojsonFeatures
};

fs.writeFileSync('public/data/nepal-provinces.geojson', JSON.stringify(provinceGeojson));
console.log('saved provinces to public/data/nepal-provinces.geojson');
console.log('total province features:', provinceGeojsonFeatures.length);
