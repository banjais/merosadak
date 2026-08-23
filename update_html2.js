const fs = require('fs');
const path = 'public/index.html';
const html = fs.readFileSync(path, 'utf8');

// Split HTML into parts
const parts = html.split('  <!-- ==========================================\n        3. Prominent "Where to?" Floating Panel');

if (parts.length !== 2) {
  console.error('Could not find floating panel marker');
  process.exit(1);
}

const beforeFloating = parts[0];
const afterFloating = parts[1].split('  <!-- ==========================================\n        4. Floating Map Toggles Toolbar (Right Side)');
const floatingContent = afterFloating[0];
const afterFloatingEnd = afterFloating[1];

// New sidebar HTML
const sidebarHtml = fs.readFileSync('sidebar_html.txt', 'utf8');

// Reassemble HTML
let newHtml = beforeFloating + sidebarHtml + '  <!-- ==========================================\n        4. Floating Map Toggles Toolbar (Right Side)' + afterFloatingEnd;

// Update bottom bar
newHtml = newHtml.replace(
  /<button class="bar-action-btn" onclick="shareApp\(\)">\s*<span class="bar-action-icon">📤<\/span>\s*<span class="bar-action-label">Share App<\/span>\s*<\/button>\s*/,
  ''
);
newHtml = newHtml.replace(
  /<button class="bar-action-btn" onclick="toggleDrawer\(\)">/,
  '<button class="bar-action-btn" onclick="triggerGeolocation()">'
);
newHtml = newHtml.replace(
  /<span class="bar-action-label">Menu<\/span>/,
  '<span class="bar-action-label">Locate Me</span>'
);

fs.writeFileSync(path, newHtml);
console.log('HTML updated');
