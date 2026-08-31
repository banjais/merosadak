const { execSync } = require('child_process');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

function run(name, cmd) {
  console.log(`\n[ship] ${name}...`);
  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: '--no-deprecation' }
    });
  } catch (e) {
    console.error(`\n[ship] FAILED: ${name}`);
    process.exit(1);
  }
}

try {
  run('sync data', 'npm run sync:data');
  run('deploy worker', 'npm run worker:deploy');
  
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

  run('git push', 'git push origin main');
  run('firebase deploy', 'npx firebase deploy --only hosting');
  console.log('\n[ship] ✅ all steps completed');
} catch {
  console.error('\n[ship] ❌ ship aborted');
  process.exit(1);
}
