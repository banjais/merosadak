require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { execSync } = require('child_process');
execSync('npx wrangler deploy --config wrangler.toml', { stdio: 'inherit', cwd: require('path').join(__dirname, 'worker') });
