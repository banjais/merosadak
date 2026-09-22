const fs = require('fs');

const matrix = require('../public/data/distance-matrix.json');

// Known official/corrected values to override
// Format: [cityIndex1, cityIndex2, correctDistanceKm]
const corrections = [
  // Kathmandu (idx 2) - Hetauda (idx 7): official ~221 km via NH37/NH41
  [2, 7, 221.01],
];

corrections.forEach(([i, j, val]) => {
  if (matrix.matrix[i] && matrix.matrix[i][j] !== undefined) {
    const old = matrix.matrix[i][j];
    matrix.matrix[i][j] = val;
    matrix.matrix[j][i] = val; // maintain symmetry
    console.log(`Fixed ${matrix.cities[i].name}-${matrix.cities[j].name}: ${old} -> ${val}`);
  }
});

// Fix Birtamod coordinates
const birtamod = matrix.cities.find(c => c.id === 'birtamod');
if (birtamod) {
  console.log('Birtamod before:', birtamod.lat, birtamod.lng);
  // Birtamod junction: approximately 26.4771, 88.0533
  birtamod.lat = 26.4771;
  birtamod.lng = 88.0533;
  console.log('Birtamod after:', birtamod.lat, birtamod.lng);
}

// Verify matrix validity
let symOK = true;
for (let i = 0; i < matrix.matrix.length; i++) {
  for (let j = i+1; j < matrix.matrix[i].length; j++) {
    if (Math.abs(matrix.matrix[i][j] - matrix.matrix[j][i]) > 0.01) {
      symOK = false;
      console.log('ASYMMETRIC:', i, j, matrix.cities[i].name, matrix.cities[j].name, matrix.matrix[i][j], matrix.matrix[j][i]);
    }
  }
}

let diagOK = true;
for (let i = 0; i < matrix.matrix.length; i++) {
  if (matrix.matrix[i][i] !== 0) { diagOK = false; console.log('DIAGONAL NOT ZERO:', i); }
}

let finiteOK = true;
for (let i = 0; i < matrix.matrix.length; i++) {
  for (let j = 0; j < matrix.matrix[i].length; j++) {
    if (!Number.isFinite(matrix.matrix[i][j])) { finiteOK = false; console.log('NOT FINITE:', i, j); }
  }
}

console.log('Symmetric:', symOK);
console.log('Diagonal zero:', diagOK);
console.log('All finite:', finiteOK);

fs.writeFileSync('./public/data/distance-matrix.json', JSON.stringify(matrix, null, 2));
console.log('Saved.');
