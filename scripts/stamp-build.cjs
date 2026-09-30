const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const distDirectory = path.resolve(__dirname, '..', 'dist');
const releasedAt = new Date();
let build;

try {
  const revision = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  build = `${revision}-${releasedAt.getTime().toString(36)}`;
} catch {
  build = `local-${releasedAt.getTime().toString(36)}`;
}

const filesToStamp = ['index.html', 'manifest.json', 'sw.js'];

for (const filename of filesToStamp) {
  const filePath = path.join(distDirectory, filename);
  const original = fs.readFileSync(filePath, 'utf8');
  if (!original.includes('__APP_BUILD__')) {
    throw new Error(`Build marker is missing from dist/${filename}`);
  }
  fs.writeFileSync(filePath, original.replaceAll('__APP_BUILD__', build));
}

const versionPath = path.join(distDirectory, 'version.json');
const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
version.build = build;
version.releasedAt = releasedAt.toISOString();
fs.writeFileSync(versionPath, `${JSON.stringify(version, null, 2)}\n`);

console.log(`Stamped MEROSADAK build ${build}`);
