/**
 * Create a Cloudflare KV namespace for Mero Sadak data.
 *
 * Usage:
 *   node worker/setup-kv.js --token <CLOUDFLARE_API_TOKEN> --account <CLOUDFLARE_ACCOUNT_ID>
 *
 * The token needs "Account > Cloudflare Workers > Edit" permission.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function cfApi(token, accountId, method, pathSuffix, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${accountId}/storage/kv/namespaces${pathSuffix}`,
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

async function main() {
  const args = process.argv.slice(2);
  const tokenIdx = args.indexOf('--token');
  const accountIdx = args.indexOf('--account');
  const token = tokenIdx >= 0 ? args[tokenIdx + 1] : process.env.CLOUDFLARE_API_TOKEN;
  const accountId = accountIdx >= 0 ? args[accountIdx + 1] : process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!token || !accountId) {
    console.error('Usage: node worker/setup-kv.js --token <TOKEN> --account <ACCOUNT_ID>');
    console.error('   or: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node worker/setup-kv.js');
    process.exit(1);
  }

  const name = 'merosadak-data';
  console.log(`Creating KV namespace "${name}"...`);

  let ns;
  try {
    ns = await cfApi(token, accountId, 'POST', '', { title: name });
    console.log('Created:', ns);
  } catch (e) {
    console.error('Create failed:', e.message);
    process.exit(1);
  }

  if (!ns || !ns.id) {
    console.error('No namespace ID returned');
    process.exit(1);
  }

  const namespaceId = ns.id;
  console.log('\nKV namespace ID:', namespaceId);
  console.log('\nUpdate worker/wrangler.toml with:');
  console.log(`  [[kv_namespaces]]`);
  console.log(`  binding = "DATA"`);
  console.log(`  id = "${namespaceId}"`);
  console.log(`  preview_id = "${namespaceId}"`);

  const wranglerPath = path.join(__dirname, 'wrangler.toml');
  let content = fs.readFileSync(wranglerPath, 'utf8');
  content = content.replace('replace-with-kv-namespace-id', namespaceId);
  content = content.replace('replace-with-preview-kv-namespace-id', namespaceId);
  fs.writeFileSync(wranglerPath, content);
  console.log('\nUpdated worker/wrangler.toml automatically.');
  console.log('\nNext step: run "node worker/sync-data.js --token ' + token + ' --account ' + accountId + '" to upload data.');
}

main();
