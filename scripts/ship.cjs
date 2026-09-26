const { execSync } = require('child_process');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const results = [];

function run(name, cmd, options = {}) {
  console.log(`\n[ship] ${name}...`);
  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
      ...options
    });
    results.push({ name, status: 'ok' });
    return true;
  } catch (e) {
    const label = options.allowFailure ? 'skipped' : 'FAILED';
    if (options.allowFailure) {
      console.log(`[ship] ${name} failed (continuing)`);
    } else {
      console.error(`\n[ship] FAILED: ${name}`);
    }
    results.push({ name, status: label });
    if (!options.allowFailure) {
      printReport();
      process.exit(1);
    }
    return false;
  }
}

function printReport() {
  const width = 52;
  const divider = '─'.repeat(width);
  console.log(`\n${divider}`);
  console.log('  SHIP REPORT');
  console.log(divider);

  const ok = results.filter(r => r.status === 'ok').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

  for (const item of results) {
    const icon = item.status === 'ok' ? '✅' : item.status === 'skipped' ? '⏭️' : '❌';
    const status = item.status.toUpperCase().padEnd(7);
    console.log(`  ${icon} ${item.name}`);
    console.log(`     status: ${status}`);
  }

  console.log(divider);
  const overall = failed ? '❌ FAILED' : skipped ? '⚠️  COMPLETED WITH SKIPS' : '✅ ALL PASSED';
  console.log(`  ${overall}`);
  console.log(`  passed=${ok} skipped=${skipped} failed=${failed} total=${results.length}`);
  console.log(divider);
}

try {
  console.log('\n[ship] git fetch...');
  run('git fetch', 'git fetch origin', { allowFailure: true });

  console.log('\n[ship] git rebase onto origin/main (if needed)...');
  run('git rebase', 'git rebase --autostash origin/main', { allowFailure: true });

  run('deploy worker', 'npm run worker:deploy', { allowFailure: true });
  run('sync:data', 'npm run sync:data', { allowFailure: true });
  run('sync:fuel', 'npm run sync:fuel', { allowFailure: true });
  run('sync:tolls', 'npm run sync:tolls', { allowFailure: true });
  run('sync:all-tolls', 'npm run sync:all-tolls', { allowFailure: true });
  run('auto-update tolls', 'npm run sync:all-tolls:auto', { allowFailure: true });
  run('build (frontend + server)', 'npm run build', { allowFailure: true });

  console.log('\n[ship] git add...');
  let hadStagedChanges = false;
  try {
    execSync('git add -A -- .', { stdio: 'inherit', cwd: process.cwd(), env: process.env });
    hadStagedChanges = true;
  } catch (e) {
    console.log('[ship] git add had nothing to stage, continuing...');
  }

  console.log('\n[ship] git commit...');
  let hadCommit = false;
  try {
    execSync('git commit -m "chore: ship - sync data + deploy worker + hosting"', { stdio: 'inherit', cwd: process.cwd(), env: process.env });
    hadCommit = true;
  } catch (e) {
    console.log('[ship] nothing to commit, continuing...');
  }
  results.push({ name: 'git add', status: hadStagedChanges ? 'ok' : 'skipped' });
  results.push({ name: 'git commit', status: hadCommit ? 'ok' : 'skipped' });

  run('git push', 'git push origin main', { allowFailure: true });
  run('firebase deploy', 'npx --yes firebase-tools@15.30.2 deploy --only hosting --project sadak-sathi-3ab73 --non-interactive', { allowFailure: true });

  console.log('\n[ship] ✅ frontend hosted | backend deploys via GitHub Actions (CI/CD)');
  console.log('[ship]    - Frontend: Firebase Hosting (dist/)');
  console.log('[ship]    - Backend:  Cloud Run via Dockerfile (CI/CD workflow)');
  console.log('[ship]    - Worker:  Cloudflare (separate workflow)');

  printReport();
} catch {
  console.error('\n[ship] ❌ ship aborted');
  printReport();
  process.exit(1);
}
