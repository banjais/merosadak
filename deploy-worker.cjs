require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Upload data files to KV before deploying
const dataDir = path.join(__dirname, 'public', 'data');
const kvFiles = [
  'road-graph.json',
  'snh-reference.json',
  'fuel-prices.json',
  'toll-rates.json',
  'all-toll-rates.json',
  'highway/index.json',
  'cities-and-junctions.json',
  'incidents.json',
  'pois.json',
  'traffic-corridors.json',
  'calculator-cities.json',
  'mountain-weather.json',
  'distance-matrix.json',
];

console.log('Uploading data files to KV...');
for (const file of kvFiles) {
  const fullPath = path.join(dataDir, file);
  if (fs.existsSync(fullPath)) {
    // Use bulk upload via temp file
    const tempFile = path.join(__dirname, 'temp-kv-upload.json');
    const content = fs.readFileSync(fullPath, 'utf8');
    fs.writeFileSync(tempFile, JSON.stringify([{ key: file, value: content }]));
    try {
      execSync(`npx wrangler kv:bulk put --binding=DATA "${tempFile}"`, { 
        stdio: 'inherit', 
        cwd: path.join(__dirname, 'worker') 
      });
      console.log(`  ✓ ${file}`);
    } catch (e) {
      console.warn(`  ✗ ${file}: ${e.message}`);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  } else {
    console.warn(`  ⊘ ${file} not found`);
  }
}

console.log('Deploying worker...');
execSync('npx wrangler deploy --config wrangler.toml', { stdio: 'inherit', cwd: path.join(__dirname, 'worker') });
