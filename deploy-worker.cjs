require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Read KV namespace ID from wrangler.toml
function readTomlNamespaceId(tomlPath) {
  const content = fs.readFileSync(tomlPath, 'utf8');
  const match = content.match(/id\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

// KV REST API call
function cfApi(token, accountId, namespaceId, method, pathSuffix, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}${pathSuffix}`,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.success) return reject(new Error(JSON.stringify(json.errors)));
          resolve(json.result);
        } catch (e) {
          reject(new Error('Invalid JSON: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function putKey(token, accountId, namespaceId, key, value) {
  return cfApi(token, accountId, namespaceId, 'PUT', `/values/${encodeURIComponent(key)}`, value);
}

// Main async function
async function main() {
  // Upload data files to KV using REST API (works for large files)
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

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = readTomlNamespaceId(path.join(__dirname, 'worker', 'wrangler.toml'));

  if (token && accountId && namespaceId && !namespaceId.includes('replace-with')) {
    console.log('Uploading data files to KV via REST API...');
    for (const file of kvFiles) {
      const fullPath = path.join(dataDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        try {
          await putKey(token, accountId, namespaceId, file, content);
          console.log(`  ✓ ${file}`);
        } catch (e) {
          console.warn(`  ✗ ${file}: ${e.message}`);
        }
      } else {
        console.warn(`  ⊘ ${file} not found`);
      }
    }
  } else {
    console.log('KV credentials not configured, skipping KV upload (worker will use local fallbacks)');
  }

  console.log('Deploying worker...');
  execSync('npx wrangler deploy --config wrangler.toml', { stdio: 'inherit', cwd: path.join(__dirname, 'worker') });
}

main().catch(e => { console.error(e); process.exit(1); });
