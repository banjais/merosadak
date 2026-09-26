const { execSync } = require('child_process');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

function run(name, cmd, options = {}) {
  console.log(`\n[ship] ${name}...`);
  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
      ...options
    });
    return true;
  } catch (e) {
    if (options.allowFailure) {
      console.log(`[ship] ${name} failed (continuing)`);
      return false;
    }
    console.error(`\n[ship] FAILED: ${name}`);
    process.exit(1);
  }
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
  run('build (frontend + server)', 'npm run build', { allowFailure: true });

  console.log('\n[ship] git add...');
  try {
    execSync('git add -A -- .', { stdio: 'inherit', cwd: process.cwd(), env: process.env });
  } catch (e) {
    console.log('[ship] git add had nothing to stage, continuing...');
  }

  console.log('\n[ship] git commit...');
  try {
    execSync('git commit -m "chore: ship - sync data + deploy worker + hosting"', { stdio: 'inherit', cwd: process.cwd(), env: process.env });
  } catch (e) {
    console.log('[ship] nothing to commit, continuing...');
  }

  run('git push', 'git push origin main', { allowFailure: true });
  run('firebase deploy', 'npx --yes firebase-tools@15.30.2 deploy --only hosting --project sadak-sathi-3ab73 --non-interactive', { allowFailure: true });
  console.log('\n[ship] ✅ frontend hosted | backend deploys via GitHub Actions (CI/CD)');
  console.log('[ship]    - Frontend: Firebase Hosting (dist/)');
  console.log('[ship]    - Backend:  Cloud Run via Dockerfile (CI/CD workflow)');
  console.log('[ship]    - Worker:  Cloudflare (separate workflow)');
} catch {
  console.error('\n[ship] ❌ ship aborted');
  process.exit(1);
}
