/**
 * Sync only changed public/data/*.json files to Cloudflare KV.
 *
 * Cloudflare's free KV tier caps writes at 1,000/day, and the CI workflow
 * writes ~19 keys on every push. That burns the quota in a couple of weeks and
 * starts failing the whole job with "free usage limit reached". This script
 * compares each file's SHA-256 against a digest stored under `<key>.sha256` and
 * skips unchanged files, so a push that only edits one small JSON writes one
 * key instead of 19. The worker is unaffected: it reads the plain keys it
 * always has, and never touches the `.sha256` keys.
 *
 * Usage:
 *   node worker/sync-data-changed.js --token <TOKEN> --account <ACCOUNT_ID> [--namespace <KV_ID>]
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node worker/sync-data-changed.js
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/** Keys we sync, in the order the old sync-data.js used. */
const FILES = [
  'airports.json',
  'bus-stations.json',
  'temples.json',
  'tourist-places.json',
  'landmarks.json',
  'district-hqs.json',
  'cities.json',
  'places.json',
  'palika-names.json',
  'highway/index.json',
  'nepal_boundary.geojson',
  'highway-info.json',
  'blackspots.json',
  'mountain-weather.json',
  'traffic-corridors.json',
  'travel-time.json',
  'incidents.json',
  'pois.json',
  'user-reports.json',
  'cities-and-junctions.json',
  'palika-coords.json',
  'highway-coords.json',
  'road-graph.json',
  'snh-reference.json',
  'calculator-cities.json',
  'fuel-prices.json',
  'toll-rates.json',
  'all-toll-rates.json',
];

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
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function putKey(token, accountId, namespaceId, key, value) {
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

  const token = getArg('--token') || process.env.CLOUDFLARE_API_TOKEN;
  const accountId = getArg('--account') || process.env.CLOUDFLARE_ACCOUNT_ID;
  let namespaceId = getArg('--namespace');

  if (!token || !accountId) {
    console.error('Usage: node worker/sync-data-changed.js --token <TOKEN> --account <ACCOUNT_ID> [--namespace <KV_ID>]');
    console.error('   or: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node worker/sync-data-changed.js');
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
  let wrote = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;

  console.log(`Checking ${FILES.length} data files for changes...\n`);

  for (const file of FILES) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP ${file} (not found)`);
      missing += 1;
      continue;
    }

    const content = fs.readFileSync(filePath).toString('utf8');
    const key = file.replace(/\\/g, '/');
    const digest = crypto.createHash('sha256').update(content).digest('hex');
    const digestKey = `${key}.sha256`;

    // Read the stored digest to decide whether the file actually changed.
    let storedDigest = null;
    try {
      storedDigest = await cfApi(token, accountId, namespaceId, 'GET', `/values/${encodeURIComponent(digestKey)}`);
      if (typeof storedDigest === 'string') storedDigest = storedDigest.trim();
    } catch (e) {
      // 404 / not found is fine — the digest has never been written.
      const msg = String(e.message || '');
      if (!/404|not found|not_found/i.test(msg)) {
        console.error(`  FAIL ${file}: read error:`, msg);
        failed += 1;
        continue;
      }
    }

    if (storedDigest && storedDigest === digest) {
      console.log(`  SKIP ${file} (unchanged)`);
      skipped += 1;
      continue;
    }

    try {
      // Write the content under the plain key the worker reads, and the digest
      // under a side key so the next run can skip it.
      await putKey(token, accountId, namespaceId, key, content);
      await putKey(token, accountId, namespaceId, digestKey, digest);
      console.log(`  OK   ${file} -> ${key}`);
      wrote += 1;
    } catch (e) {
      console.error(`  FAIL ${file}:`, e.message);
      failed += 1;
    }
  }

  console.log(`\nSync complete: wrote=${wrote} skipped=${skipped} missing=${missing} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main();