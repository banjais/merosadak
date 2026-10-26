const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const iconsDir = path.join(publicDir, 'assets', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Master brand SVG: squircle badge matching app header
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#0b1324"/>
      <stop offset="100%" stop-color="#060b16"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#334155" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#1e293b" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="45%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <filter id="emeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#10b981" flood-opacity="0.38"/>
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#059669" flood-opacity="0.5"/>
    </filter>
    <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.55"/>
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#10b981" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Squircle Base with drop shadow -->
  <rect x="36" y="36" width="440" height="440" rx="108" ry="108" 
        fill="url(#bgGrad)" 
        stroke="url(#borderGrad)" 
        stroke-width="10" 
        filter="url(#badgeShadow)"/>

  <!-- Inner subtle border ring -->
  <rect x="42" y="42" width="428" height="428" rx="102" ry="102" 
        fill="none" 
        stroke="rgba(255, 255, 255, 0.06)" 
        stroke-width="2"/>

  <!-- Navigation Arrow Logo (scaled from 24x24 path M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z) -->
  <g transform="translate(88, 95) scale(14)" filter="url(#emeraldGlow)">
    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="url(#arrowGrad)"/>
  </g>
</svg>`;

// Maskable SVG: full bleed background (#070f1e) with the badge within the 80% safe zone
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="fullBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#09101f"/>
      <stop offset="50%" stop-color="#070f1e"/>
      <stop offset="100%" stop-color="#040914"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#0b1324"/>
      <stop offset="100%" stop-color="#060b16"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#334155" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#1e293b" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="45%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <filter id="emeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="#10b981" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Full bleed background for maskable safe zone -->
  <rect width="512" height="512" fill="url(#fullBgGrad)"/>

  <!-- Center Badge inside 80% safe zone circle (center 256,256, radius 204) -->
  <rect x="76" y="76" width="360" height="360" rx="86" ry="86" 
        fill="url(#bgGrad)" 
        stroke="url(#borderGrad)" 
        stroke-width="8"/>

  <!-- Inner subtle border ring -->
  <rect x="82" y="82" width="348" height="348" rx="80" ry="80" 
        fill="none" 
        stroke="rgba(255, 255, 255, 0.07)" 
        stroke-width="2"/>

  <!-- Navigation Arrow Logo scaled inside the badge -->
  <g transform="translate(118, 124) scale(11.5)" filter="url(#emeraldGlow)">
    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="url(#arrowGrad)"/>
  </g>
</svg>`;

async function generateAll() {
  console.log('Writing public/logo.svg and public/icon.svg...');
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), logoSvg, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), logoSvg, 'utf8');

  const svgBuffer = Buffer.from(logoSvg);
  const maskableBuffer = Buffer.from(maskableSvg);

  console.log('Generating PNG icons...');
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('  -> public/assets/icons/icon-512.png (512x512)');

  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png'));
  console.log('  -> public/assets/icons/icon-192.png (192x192)');

  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('  -> public/assets/icons/apple-touch-icon.png (180x180)');

  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'logo.png'));
  console.log('  -> public/logo.png (512x512)');

  await sharp(maskableBuffer).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-maskable-512.png'));
  console.log('  -> public/assets/icons/icon-maskable-512.png (512x512)');

  await sharp(maskableBuffer).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-maskable-192.png'));
  console.log('  -> public/assets/icons/icon-maskable-192.png (192x192)');

  // Also write 32x32 favicon.ico (PNG format in .ico container or sharp png 32x32)
  await sharp(svgBuffer).resize(48, 48).png().toFile(path.join(publicDir, 'favicon.ico'));
  console.log('  -> public/favicon.ico (48x48)');

  console.log('All brand icons generated successfully!');
}

generateAll().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
