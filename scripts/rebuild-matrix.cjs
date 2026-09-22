const fs = require('fs');

const rg = require('../public/data/road-graph.json');
const cm = require('../public/data/distance-matrix.json');

// Manual mapping: matrix city id -> citySnap key
const matrixToSnap = {
  kathmandu: 'ktm', pokhara: 'pkr', bharatpur: 'cht', bhaktapur: 'ktm',
  lalitpur: 'ktm', biratnagar: 'brt', birgunj: 'brg', itahari: 'dhr',
  dharan: 'dhr', hetuda: 'htd', kohalpur: 'npg', nepalgunj: 'npg',
  gulariya: 'npg', butwal: 'btl', tansen: 'plp', kalaiya: 'bhr',
  janakpur: 'jnk', bardibas: 'brd', dhangadhi: 'dhg', tikapur: 'tst',
  bhimdatta: 'dhg', dhulikhel: 'dhk', namobuddha: 'sdh', ilam: 'ilm',
  damak: 'dmk', phidim: 'ptl', bhadrapur: 'bkb', narayanghat: 'cht',
  mugling: 'mgl', kawasoti: 'npt', besisahar: 'bsl', chame: 'chm',
  beni: 'sdk', kushma: 'ghr', baglung: 'bgl', bhojpur: 'jjk',
  dhankuta: 'gly', chainpur: 'ilm', sandhikharka: 'bsl', rajapur: 'bhr',
  ramgram: 'npt', devdaha: 'dml', gaur: 'gch', malangwa: 'mlk',
};

const snapToNode = {};
for (const [k, v] of Object.entries(rg.citySnap)) {
  snapToNode[k] = Number(v);
}

function dijkstraEarlyStop(adj, sourceId, targetSet, numNodes) {
  const dist = new Map();
  dist.set(sourceId, 0);
  const visited = new Set();
  // Binary heap: [dist, nodeId]
  const heap = [[0, sourceId]];
  
  function heapPush(item) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }
  
  function heapPop() {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const l = 2*i+1, r = 2*i+2;
        let smallest = i;
        if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l;
        if (r < heap.length && heap[r][0] < heap[smallest][0]) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  }
  
  const results = new Map();
  
  while (heap.length > 0 && results.size < targetSet.size) {
    const [d, u] = heapPop();
    if (visited.has(u)) continue;
    visited.add(u);
    
    if (targetSet.has(u)) {
      results.set(u, d);
    }
    
    const neighbors = adj[u];
    if (!neighbors) continue;
    
    for (const edge of neighbors) {
      const v = edge[0];
      const w = edge[1];
      if (!visited.has(v)) {
        const newDist = d + w;
        if (!dist.has(v) || newDist < dist.get(v)) {
          dist.set(v, newDist);
          heapPush([newDist, v]);
        }
      }
    }
  }
  
  return results;
}

// Build mapping: matrix city id -> snap key
const cityToSnap = {};
const neededSnaps = new Set();
cm.cities.forEach(city => {
  const snapKey = matrixToSnap[city.id];
  if (snapKey && snapToNode[snapKey] !== undefined) {
    cityToSnap[city.id] = snapKey;
    neededSnaps.add(snapKey);
  }
});
console.log('Matched cities:', Object.keys(cityToSnap).length, 'of', cm.cities.length);

// Group targets by source
const sourceToTargets = {};
for (const [cityId, snapKey] of Object.entries(cityToSnap)) {
  const sourceNode = snapToNode[snapKey];
  if (!sourceToTargets[snapKey]) {
    sourceToTargets[snapKey] = { sourceNode, targets: new Set() };
  }
  // Add all target nodes for this source
  for (const [targetCityId, targetSnap] of Object.entries(cityToSnap)) {
    const targetNode = snapToNode[targetSnap];
    sourceToTargets[snapKey].targets.add(targetNode);
  }
}

console.log('Running', Object.keys(sourceToTargets).length, 'Dijkstra iterations...');

// Pre-compute shortest paths from each source
const sourceResults = {};
let done = 0;
for (const [snapKey, { sourceNode, targets }] of Object.entries(sourceToTargets)) {
  const results = dijkstraEarlyStop(rg.adjacency, sourceNode, targets, rg.nodes.length);
  sourceResults[snapKey] = results;
  done++;
  if (done % 10 === 0) console.log('  Progress:', done, '/', Object.keys(sourceToTargets).length);
}

// Build new matrix
console.log('Building matrix...');
const newMatrix = [];
let graphCount = 0;
let fallbackCount = 0;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

for (let i = 0; i < cm.cities.length; i++) {
  const row = new Array(cm.cities.length).fill(0);
  const cityI = cm.cities[i];
  const snapI = cityToSnap[cityI.id];
  
  for (let j = 0; j < cm.cities.length; j++) {
    if (i === j) { row[j] = 0; continue; }
    
    const cityJ = cm.cities[j];
    let dist = null;
    
    if (snapI && cityToSnap[cityJ.id]) {
      const nodeI = snapToNode[snapI];
      const nodeJ = snapToNode[cityToSnap[cityJ.id]];
      const d1 = sourceResults[snapI]?.get(nodeJ);
      const d2 = sourceResults[cityToSnap[cityJ.id]]?.get(nodeI);
      const candidates = [];
      if (Number.isFinite(d1) && d1 > 0) candidates.push(d1);
      if (Number.isFinite(d2) && d2 > 0) candidates.push(d2);
      if (candidates.length > 0) {
        dist = Math.round(Math.min(...candidates) * 100) / 100;
        graphCount++;
      }
    }
    
    if (dist === null) {
      dist = Math.round(haversine(cityI.lat, cityI.lng, cityJ.lat, cityJ.lng) * 100) / 100;
      fallbackCount++;
    }
    
    row[j] = dist;
  }
  
  newMatrix.push(row);
}

// Verify
let symOK = true;
for (let i = 0; i < newMatrix.length; i++) {
  for (let j = i+1; j < newMatrix[i].length; j++) {
    if (Math.abs(newMatrix[i][j] - newMatrix[j][i]) > 0.01) {
      symOK = false;
      console.log('ASYMMETRIC:', i, j, cm.cities[i].name, cm.cities[j].name, newMatrix[i][j], newMatrix[j][i]);
    }
  }
}

let diagOK = true;
for (let i = 0; i < newMatrix.length; i++) {
  if (newMatrix[i][i] !== 0) { diagOK = false; }
}

let finiteOK = true;
for (let i = 0; i < newMatrix.length; i++) {
  for (let j = 0; j < newMatrix[i].length; j++) {
    if (!Number.isFinite(newMatrix[i][j])) { finiteOK = false; console.log('NOT FINITE:', i, j); }
  }
}

console.log('Symmetric:', symOK);
console.log('Diagonal zero:', diagOK);
console.log('All finite:', finiteOK);
console.log('From graph:', graphCount, '| Haversine fallback:', fallbackCount);

const ktm = cm.cities.findIndex(c => c.id === 'kathmandu');
const pkr = cm.cities.findIndex(c => c.id === 'pokhara');
const bhar = cm.cities.findIndex(c => c.id === 'bharatpur');
const het = cm.cities.findIndex(c => c.id === 'hetauda');
console.log('KTM-PKR:', newMatrix[ktm][pkr], '(was 142, should be ~198.55)');
console.log('KTM-BHR:', newMatrix[ktm][bhar], '(was 88, should be ~144.24)');
console.log('KTM-HET:', newMatrix[ktm][het], '(was 43, should be ~221)');

const output = { ...cm, matrix: newMatrix };
fs.writeFileSync('./public/data/distance-matrix.json', JSON.stringify(output, null, 2));
console.log('Written.');
