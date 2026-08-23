const fs = require('fs');
const path = 'public/index.html';
let html = fs.readFileSync(path, 'utf8');

// 1. Replace floating search panel with sidebar
const floatingStart = html.indexOf('  <!-- ==========================================\n        3. Prominent "Where to?" Floating Panel');
const floatingEnd = html.indexOf('  <!-- ==========================================\n        4. Floating Map Toggles Toolbar (Right Side)');

const sidebarHtml = `  <!-- ==========================================
        3. Left Sidebar — Unified Search & Actions
        ========================================== -->
  <aside class="app-sidebar" id="appSidebar">
    <div class="sidebar-scroll">
      <div class="sidebar-mode-tabs">
        <button class="mode-tab active" data-mode="route" onclick="setMode('route')">Route/ETA</button>
        <button class="mode-tab" data-mode="weather" onclick="setMode('weather')">Weather</button>
        <button class="mode-tab" data-mode="traffic" onclick="setMode('traffic')">Traffic</button>
        <button class="mode-tab" data-mode="pois" onclick="setMode('pois')">POIS/EV</button>
        <button class="mode-tab" data-mode="sos" onclick="setMode('sos')">SOS</button>
      </div>
      <div class="sidebar-search-wrap">
        <span class="search-mode-icon" id="searchModeIcon">📍</span>
        <input type="text" id="sidebarSearch" placeholder="Where to?" autocomplete="off">
        <button class="icon-btn search-clear-btn" onclick="clearSidebarSearch()" title="Clear">✕</button>
        <div class="autocomplete-dropdown" id="sidebarSuggest"></div>
      </div>
      <div class="sidebar-results" id="sidebarResults"></div>
    </div>
  </aside>

`;

html = html.substring(0, floatingStart) + sidebarHtml + html.substring(floatingEnd);

// 2. Update bottom bar - remove Share App, change Menu to Locate Me
html = html.replace(
  /<button class="bar-action-btn" onclick="shareApp\(\)">[\s\S]*?<\/button>/,
  ''
);
html = html.replace(
  /<button class="bar-action-btn" onclick="toggleDrawer\(\)">/,
  '<button class="bar-action-btn" onclick="triggerGeolocation()">'
);
html = html.replace(
  /<span class="bar-action-label">Menu<\/span>/,
  '<span class="bar-action-label">Locate Me</span>'
);

fs.writeFileSync(path, html);
console.log('HTML updated successfully');
