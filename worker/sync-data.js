/**
 * Sync local public/data/*.json files to Cloudflare KV.
 *
 * Usage:
 *   node worker/sync-data.js --token <CF_API_TOKEN> --account <CF_ACCOUNT_ID> --namespace <KV_NAMESPACE_ID>
 *
 * Or after running setup-kv.js, it reads namespace ID from wrangler.toml automatically.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

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
          if (!json.success) {
            return reject(new Error(JSON.stringify(json.errors)));
          }
          resolve(json.result);
        } catch (e) {
          reject(new Error('Invalid JSON: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function putKey(token, accountId, namespaceId, key, value) {
  return cfApi(token, accountId, namespaceId, 'PUT', `/values/${encodeURIComponent(key)}`, value);
}

function readTomlNamespaceId(tomlPath) {
  const content = fs.readFileSync(tomlPath, 'utf8');
  const match = content.match(/id\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : null;
  };

  const token = getArg('--token') || process.env.CF_API_TOKEN;
  const accountId = getArg('--account') || process.env.CF_ACCOUNT_ID;
  let namespaceId = getArg('--namespace');

  if (!token || !accountId) {
    console.error('Usage: node worker/sync-data.js --token <TOKEN> --account <ACCOUNT_ID> [--namespace <KV_ID>]');
    console.error('   or: CF_API_TOKEN=... CF_ACCOUNT_ID=... node worker/sync-data.js');
    process.exit(1);
  }

  if (!namespaceId) {
    namespaceId = readTomlNamespaceId(path.join(__dirname, 'wrangler.toml'));
    if (!namespaceId || namespaceId.includes('replace-with')) {
      console.error('No KV namespace ID found. Run setup-kv.js first or pass --namespace.');
      process.exit(1);
    }
    console.log('Using KV namespace from wrangler.toml:', namespaceId);
  }

  const dataDir = path.join(__dirname, '..', 'public', 'data');
  const files = [
    'airports.json',
    'district-hqs.json',
    'cities.json',
    'places.json',
    'palika-names.json',
    'highway/index.json',
    'nepal_boundary.geojson',
    'distance-matrix.json',
    'highway-info.json',
    'blackspots.json',
    'mountain-weather.json',
    'traffic-corridors.json',
    'travel-time.json',
    'incidents.json',
    'pois.json',
    'user-reports.json',
    'cities-and-junctions.json',
  ];

  console.log(`Syncing ${files.length} data files to KV...\n`);

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP ${file} (not found)`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const key = file.replace(/\\/g, '/');

    try {
      await putKey(token, accountId, namespaceId, key, content);
      console.log(`  OK   ${file} -> ${key}`);
    } catch (e) {
      console.error(`  FAIL ${file}:`, e.message);
    }
  }

  console.log('\nSync complete. The Worker now serves these files at:');
  console.log(`  https://merosadak.banjais.workers.dev/api/data/<filename>`);
}

main();
