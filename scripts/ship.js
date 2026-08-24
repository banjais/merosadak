const { execSync } = require('child_process');

function run(name, cmd, opts = {}) {
  console.log(`\n[ship] ${name}...`);
  try {
    const env = { ...process.env };
    if (opts.stripCloudflareToken) {
      delete env.CLOUDFLARE_API_TOKEN;
    }
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd(), env });
  } catch (e) {
    console.error(`\n[ship] FAILED: ${name}`);
    process.exit(1);
  }
}

try {
  run('sync data', 'npm run sync:data');
  run('deploy worker', 'npm run worker:deploy', { stripCloudflareToken: true });
  run('git add', 'git add .');

  try {
    run('git commit', 'git commit -m "chore: ship - sync data + deploy worker + hosting"');
  } catch {
    console.log('[ship] nothing to commit, continuing...');
  }

  run('git push', 'git push origin main');
  run('firebase deploy', 'firebase deploy --only hosting');
  console.log('\n[ship] ✅ all steps completed');
} catch {
  console.error('\n[ship] ❌ ship aborted');
  process.exit(1);
}
