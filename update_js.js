const fs = require('fs');
const path = 'public/index.html';
let html = fs.readFileSync(path, 'utf8');

// Find the script section boundaries
const scriptStart = html.indexOf('<script>') + 8;
const scriptEnd = html.lastIndexOf('</script>');

const oldJs = html.substring(scriptStart, scriptEnd);

// New JS sections to inject
const sidebarJs = `
    // ==========================================
    // 3. Sidebar Search & Mode Engine
    // ==========================================
    const MODE_CONFIG = {
      route: { icon: '📍', placeholder: 'Where to? (destination)' },
      weather: { icon: '⛅', placeholder: 'Check weather for...' },
      traffic: { icon: '🚦', placeholder: 'Check traffic on...' },
      pois: { icon: '⛽', placeholder: 'Find POIs near...' },
      sos: { icon: '🆘', placeholder: 'Emergency contacts for...' }
    };

    const DEFAULT_SUGGESTIONS = [
      { label: 'Tribhuvan International Airport (TIA)', type: 'airport', lat: 27.6968, lng: 85.3591 },
      { label: 'Pokhara International Airport', type: 'airport', lat: 28.2006, lng: 83.9821 },
      { label: 'Gautam Buddha Airport, Bhairahawa', type: 'airport', lat: 27.5057, lng: 83.4163 },
      { label: 'Kathmandu Bus Park (Koteshwor)', type: 'bus_station', lat: 27.6786, lng: 85.3477 },
      { label: 'Pokhara Bus Park', type: 'bus_station', lat: 28.2096, lng: 83.9856 },
      { label: 'Butwal Bus Station', type: 'bus_station', lat: 27.7006, lng: 83.4484 },
      { label: 'Kathmandu', type: 'City Hub', lat: 27.7172, lng: 85.324 },
      { label: 'Pokhara', type: 'City Hub', lat: 28.2096, lng: 83.9856 },
      { label: 'Chitwan / Bharatpur', type: 'City Hub', lat: 27.6833, lng: 84.4333 },
      { label: 'Butwal', type: 'City Hub', lat: 27.7006, lng: 83.4484 },
      { label: 'Biratnagar', type: 'City Hub', lat: 26.4525, lng: 87.2718 },
      { label: 'Birgunj', type: 'City Hub', lat: 27.0, lng: 84.8667 },
      { label: 'Lumbini', type: 'City Hub', lat: 27.4833, lng: 83.2833 },
      { label: 'Dharan', type: 'City Hub', lat: 26.8146, lng: 87.2833 },
      { label: 'Nepalgunj', type: 'City Hub', lat: 28.1036, lng: 81.667 }
    ];

    function setMode(mode) {
      currentMode = mode;
      document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
      const config = MODE_CONFIG[mode];
      document.getElementById('searchModeIcon').textContent = config.icon;
      document.getElementById('sidebarSearch').placeholder = config.placeholder;
      document.getElementById('sidebarResults').innerHTML = '';
      document.getElementById('sidebarSearch').value = '';
      selectedDestination = null;

      if (mode === 'route') {
        showDefaultRouteSuggestions();
      } else if (mode === 'traffic') {
        toggleLayer('traffic');
      } else if (mode === 'pois') {
        toggleLayer('pois');
      }
    }

    function showDefaultRouteSuggestions() {
      const container = document.getElementById('sidebarSuggest');
      container.innerHTML = DEFAULT_SUGGESTIONS.map(s => \`
        <div class="autocomplete-item" onclick="selectSidebarItem({label:'\${s.label.replace(/'/g, "")}',type:'\${s.type}',lat:\${s.lat},lng:\${s.lng}})">
          <span>\${s.label}</span> <span class="tag">\${s.type}</span>
        </div>
      \`).join('');
      container.style.display = 'block';
    }

    function clearSidebarSearch() {
      document.getElementById('sidebarSearch').value = '';
      document.getElementById('sidebarSuggest').style.display = 'none';
      document.getElementById('sidebarResults').innerHTML = '';
      selectedDestination = null;
      if (currentMode === 'route') showDefaultRouteSuggestions();
    }

    function getSearchSuggestions(query) {
      const q = query.toLowerCase();
      return searchIndex.filter(item => item.label.toLowerCase().includes(q)).slice(0, 8);
    }

    function selectSidebarItem(item) {
      document.getElementById('sidebarSuggest').style.display = 'none';
      document.getElementById('sidebarSearch').value = item.label;
      selectedDestination = item;

      if (currentMode === 'route') {
        renderSidebarRouteResult(item);
      } else if (currentMode === 'weather') {
        renderSidebarWeatherResult(item);
      } else if (currentMode === 'traffic') {
        renderSidebarTrafficResult(item);
      } else if (currentMode === 'pois') {
        renderSidebarPoisResult(item);
      } else if (currentMode === 'sos') {
        renderSidebarSosResult(item);
      }
    }

    function renderSidebarRouteResult(dest) {
      const results = document.getElementById('sidebarResults');
      const origin = userOrigin || { lat: 27.7172, lng: 85.324, label: 'Kathmandu (default)' };

      results.innerHTML = \`
        <div class="result-card" onclick="calculateSidebarRoute()">
          <div class="result-card-title">🛣️ \${dest.label}</div>
          <div class="result-card-sub">
            <span class="result-badge">ROUTE</span>
            <span>From: \${origin.label}</span>
          </div>
          <div style="margin-top:8px; display:flex; gap:6px;">
            <button class="pref-pill active" onclick="setRoutePref('fastest'); renderSidebarRouteResult(selectedDestination)">⚡ Fastest</button>
            <button class="pref-pill" onclick="setRoutePref('shortest'); renderSidebarRouteResult(selectedDestination)">📏 Shortest</button>
            <button class="pref-pill" onclick="setRoutePref('scenic'); renderSidebarRouteResult(selectedDestination)">🏔️ Scenic</button>
          </div>
          <div style="margin-top:8px;">
            <select id="sidebarVehicle" onchange="activeVehicle=this.value; calculateSidebarRoute()" style="width:100%; padding:6px 10px; background:rgba(0,0,0,0.35); border:1px solid var(--surface-border); border-radius:var(--radius-sm); color:#fff; font-size:0.75rem; font-weight:600;">
              <option value="car">🚗 Car / Sedan</option>
              <option value="suv_4wd">🚙 4WD / Jeep</option>
              <option value="motorbike">🏍️ Motorcycle</option>
              <option value="bus_truck">🚌 Bus / Truck</option>
              <option value="ev">⚡ EV (Electric)</option>
            </select>
          </div>
        </div>
      \`;
    }

    async function calculateSidebarRoute() {
      if (!selectedDestination) return;
      const origin = userOrigin || { lat: 27.7172, lng: 85.324, label: 'Kathmandu' };
      const dest = selectedDestination;
      const results = document.getElementById('sidebarResults');

      try {
        const url = \`https://router.project-osrm.org/route/v1/driving/\${origin.lng},\${origin.lat};\${dest.lng},\${dest.lat}?overview=full&geometries=geojson&alternatives=true\`;
        const res = await fetch(url).then(r => r.json());
        if (res.code !== 'Ok' || !res.routes.length) {
          results.innerHTML += \`<div class="result-card" style="border-color:rgba(217,4,41,0.5);"><div class="result-card-title" style="color:#ff4d6d;">No route found</div></div>\`;
          return;
        }

        const routes = res.routes;
        const chosen = activeRoutePreference === 'shortest'
          ? routes.reduce((a, b) => (a.distance <= b.distance ? a : b))
          : routes.reduce((a, b) => (a.duration <= b.duration ? a : b));

        const km = (chosen.distance / 1000).toFixed(1);
        const hrs = (chosen.duration / 3600).toFixed(1);
        const fuelLiters = (chosen.distance / 1000 / 12).toFixed(1);
        const fuelCost = Math.round(fuelLiters * 175);

        if (routeLayerGroup) map.removeLayer(routeLayerGroup);
        const casing = L.geoJSON(chosen.geometry, { style: { color: '#0b192c', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' } });
        const core = L.geoJSON(chosen.geometry, { style: { color: '#f59e0b', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' } });
        routeLayerGroup = L.layerGroup([casing, core]).addTo(map);

        map.flyToBounds(routeLayerGroup.getBounds(), { padding: [60, 60], duration: 1.5 });

        const routeNames = chosen.geometry.coordinates ? 'Calculated Route' : dest.label;
        results.innerHTML = \`
          <div class="result-card" style="border-color:rgba(245,158,11,0.4);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="result-badge">\${activeRoutePreference.toUpperCase()} · \${activeVehicle.toUpperCase()}</span>
              <span style="font-size:0.72rem; color:var(--text-secondary);">\${routeNames}</span>
            </div>
            <div class="metric-grid" style="margin-bottom:0;">
              <div class="metric-box">
                <span class="metric-label">Distance</span>
                <span class="metric-val highlight">\${km} km</span>
              </div>
              <div class="metric-box">
                <span class="metric-label">Drive Time</span>
                <span class="metric-val">\${hrs} hrs</span>
              </div>
              <div class="metric-box">
                <span class="metric-label">Est. Fuel</span>
                <span class="metric-val">NPR \${fuelCost.toLocaleString()}</span>
              </div>
              <div class="metric-box">
                <span class="metric-label">Origin</span>
                <span class="metric-val" style="font-size:0.75rem;">\${origin.label}</span>
              </div>
            </div>
          </div>
        \`;
      } catch (err) {
        results.innerHTML += \`<div class="result-card" style="border-color:rgba(217,4,41,0.5);"><div class="result-card-title" style="color:#ff4d6d;">Route error</div></div>\`;
      }
    }

    async function renderSidebarWeatherResult(place) {
      const results = document.getElementById('sidebarResults');
      results.innerHTML = \`<div class="weather-card"><div style="color:var(--text-secondary);">⏳ Loading weather for \${place.label}...</div></div>\`;

      try {
        const res = await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${place.lat}&longitude=\${place.lng}&current=temperature_2m,weather_code,wind_speed_10m\`).then(r => r.json());
        if (res.current) {
          const temp = Math.round(res.current.temperature_2m);
          const wind = Math.round(res.current.wind_speed_10m || 0);
          const codes = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Depositing rime fog',51:'Light drizzle',53:'Moderate drizzle',55:'Dense drizzle',61:'Slight rain',63:'Moderate rain',65:'Heavy rain',71:'Slight snow',73:'Moderate snow',75:'Heavy snow',80:'Slight rain showers',81:'Moderate rain showers',82:'Violent rain showers',95:'Thunderstorm'};
          const desc = codes[res.current.weather_code] || 'Fair';
          results.innerHTML = \`
            <div class="weather-card">
              <div class="weather-main">
                <span style="font-size:2.5rem;">\${res.current.weather_code <= 3 ? '☀️' : res.current.weather_code <= 48 ? '🌫️' : res.current.weather_code <= 65 ? '🌧️' : res.current.weather_code <= 82 ? '🌦️' : '⛈️'}</span>
                <div>
                  <div class="weather-temp">\${temp}°C</div>
                  <div class="weather-meta">\${desc} · Wind \${wind} km/h</div>
                </div>
              </div>
              <div class="result-card-sub" style="margin-top:4px;">
                <span>📍 \${place.label}</span>
              </div>
            </div>
          \`;
        } else {
          results.innerHTML = \`<div class="weather-card"><div class="result-card-title">Weather unavailable</div></div>\`;
        }
      } catch (e) {
        results.innerHTML = \`<div class="weather-card"><div class="result-card-title" style="color:#ff4d6d;">Weather fetch failed</div></div>\`;
      }
    }

    function renderSidebarTrafficResult(place) {
      const results = document.getElementById('sidebarResults');
      map.flyTo([place.lat, place.lng], 12, { duration: 1.2 });
      toggleLayer('traffic');
      results.innerHTML = \`
        <div class="result-card" style="border-color:rgba(245,158,11,0.4);">
          <div class="result-card-title">🚦 Traffic: \${place.label}</div>
          <div class="result-card-sub">
            <span>Live traffic layer activated</span>
          </div>
          <div style="margin-top:10px; padding:10px; background:rgba(245,158,11,0.1); border-radius:8px; font-size:0.78rem; color:#fbbf24;">
            Traffic data refreshes every 5 minutes via Worker API. Use the right-side toggles to adjust layers.
          </div>
        </div>
      \`;
    }

    function renderSidebarPoisResult(place) {
      const results = document.getElementById('sidebarResults');
      const pois = (window.NEPAL_DATA?.places || []).filter(p => p.type === 'fuel' || p.type === 'ev' || p.type === 'hospital' || p.type === 'police' || p.type === 'rest_area');
      const nearby = pois.slice(0, 8);

      if (!nearby.length) {
        results.innerHTML = \`<div class="result-card"><div class="result-card-title">No POIs found nearby</div></div>\`;
        return;
      }

      results.innerHTML = nearby.map(p => \`
        <div class="poi-list-item" onclick="focusMapLocation(\${p.lat}, \${p.lng}, '\${p.name.replace(/'/g, "")}')">
          <span class="poi-icon">\${p.type === 'fuel' ? '⛽' : p.type === 'ev' ? '⚡' : p.type === 'hospital' ? '🏥' : p.type === 'police' ? '👮' : '🛣️'}</span>
          <div class="poi-info">
            <div class="poi-name">\${p.name}</div>
            <div class="poi-loc">\${p.location} · \${p.highway}</div>
          </div>
        </div>
      \`).join('');

      toggleLayer('pois');
      map.flyTo([place.lat, place.lng], 13, { duration: 1.2 });
    }

    function renderSidebarSosResult(place) {
      const results = document.getElementById('sidebarResults');
      const district = place.label.split('(').pop().replace(')', '').trim() || place.label;
      const contacts = (window.NEPAL_DATA?.emergencyContacts || []).slice(0, 6);

      if (!contacts.length) {
        results.innerHTML = \`<div class="result-card"><div class="result-card-title">Emergency contacts unavailable</div></div>\`;
        return;
      }

      results.innerHTML = \`
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;">📍 \${place.label}</div>
        \${contacts.map(c => \`
          <div class="sos-tile-sidebar">
            <div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">\${c.icon} \${c.type}</div>
              <div class="sos-num">\${c.number}</div>
            </div>
            <a href="tel:\${c.number}" class="btn-dial-small">📞 Call</a>
          </div>
        \`).join('')}
      \`;
    }

`;

// Now replace old JS sections
// Remove old setupAutocomplete, selectSearchResult, swapOriginDest, startVoice, armPicker, setRoutePref, onVehicleChange, calculateRoute, fetchDestinationWeather, askAiRouteAdvisor, toggleSearchCollapse, shareApp

let newJs = oldJs;

// Remove sections by their comment headers and function bodies
const sectionsToRemove = [
  { start: '    // ==========================================\n    // 3. Search & Autocomplete', end: '    // ==========================================\n    // 4. Voice Search (Web Speech API)' },
  { start: '    // ==========================================\n    // 4. Voice Search (Web Speech API)', end: '    // ==========================================\n    // 5. Map Pin Picker' },
  { start: '    // ==========================================\n    // 5. Map Pin Picker', end: '    // ==========================================\n    // 6. Routing & OSRM Engine' },
  { start: '    // ==========================================\n    // 6. Routing & OSRM Engine', end: '    // ==========================================\n    // 7. AI Trip & Mountain Road Advisor' },
  { start: '    // ==========================================\n    // 7. AI Trip & Mountain Road Advisor', end: '    // ==========================================\n    // 8. Map Toggles & Layers' },
  { start: '    // ==========================================\n    // 9. Bottom App Bar', end: '    // ==========================================\n    // 10. Modals & Extended Features' },
  { start: '    function toggleSearchCollapse()', end: '    // ==========================================\n    // 10. Modals & Extended Features' },
  { start: '    function shareApp()', end: '    function toggleFullscreen()' },
];

// Actually, let's be more surgical. We'll replace specific function blocks.
newJs = newJs.replace(
  /    \/\/ ={40}\n    \/\/ 3\. Search & Autocomplete[\s\S]*?    \/\/ ={40}\n    \/\/ 4\. Voice Search \(Web Speech API\)/,
  sidebarJs + '    // ==========================================\n    // 4. Map Pin Picker'
);

// Remove startVoice
newJs = newJs.replace(
  /    \/\/ ={40}\n    \/\/ 4\. Voice Search \(Web Speech API\)[\s\S]*?    \/\/ ={40}\n    \/\/ 5\. Map Pin Picker/,
  '    // ==========================================\n    // 4. Map Pin Picker'
);

// Remove armPicker
newJs = newJs.replace(
  /    function armPicker\(which\) \{[^}]*\}\n\n/,
  ''
);

// Remove old setRoutePref and onVehicleChange and calculateRoute and fetchDestinationWeather
newJs = newJs.replace(
  /    \/\/ ={40}\n    \/\/ 6\. Routing & OSRM Engine[\s\S]*?    \/\/ ={40}\n    \/\/ 7\. AI Trip & Mountain Road Advisor/,
  '    // ==========================================\n    // 5. AI Route Advisor'
);

// Remove old askAiRouteAdvisor
newJs = newJs.replace(
  /    \/\/ ={40}\n    \/\/ 7\. AI Trip & Mountain Road Advisor[\s\S]*?    \/\/ ={40}\n    \/\/ 8\. Map Toggles & Layers/,
  '    // ==========================================\n    // 6. Map Toggles & Layers'
);

// Update askAiRouteAdvisor to use sidebar data
newJs = newJs.replace(
  /async function askAiRouteAdvisor\(\) \{[\s\S]*?\n    \}/,
  \`    async function askAiRouteAdvisor() {
      const from = userOrigin ? userOrigin.label : 'Kathmandu';
      const to = selectedDestination ? selectedDestination.label : 'Pokhara';
      const km = document.getElementById('sidebarResults')?.querySelector('.metric-val.highlight')?.textContent || '200 km';
      const outBox = document.getElementById('aiAdvisorOutput');
      if (outBox) {
        outBox.style.display = 'block';
        outBox.innerHTML = '✨ <em>Querying Gemini Mountain Transit Intelligence…</em>';
      }

      try {
        const prompt = \`Give a concise 3-4 sentence driving safety advisory for traveling from \${from} to \${to} in Nepal (\${km}). Mention typical road conditions (e.g. Mugling/Nagdhunga/Daunne), vehicle safety, and monsoon/landslide precautions.\`;
        const res = await fetch(\`\${WORKER_URL}/api/assistant\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        }).then(r => r.json());

        const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
        if (outBox) {
          outBox.innerHTML = \`<strong>🤖 AI Route Insight:</strong><br>\${text || 'Drive carefully, monitor road condition reports, and observe mountain overtaking discipline.'}\`;
        }
      } catch (e) {
        if (outBox) {
          outBox.innerHTML = \`<strong>🤖 AI Route Insight:</strong><br>For driving from \${from} to \${to}: Check Nagdhunga and Mugling landslide clearance before departure. Maintain lower gear descending steep hairpin bends and keep emergency number 103 handy.\`;
        }
      }
    }\`
);

// Remove toggleSearchCollapse
newJs = newJs.replace(
  /    function toggleSearchCollapse\(\) \{[^}]*\}\n\n/,
  ''
);

// Remove shareApp
newJs = newJs.replace(
  /    function shareApp\(\) \{[^}]*\}\n\n/,
  ''
);

// Update saveCurrentRoute
newJs = newJs.replace(
  /function saveCurrentRoute\(\) \{[^}]*\}/,
  \`    function saveCurrentRoute() {
      if (!selectedDestination) {
        alert('No active route to save. Search a destination first.');
        return;
      }
      const origin = userOrigin || { lat: 27.7172, lng: 85.324, label: 'Kathmandu' };
      const routes = JSON.parse(localStorage.getItem('merosadak_saved_routes') || '[]');
      routes.push({
        from: origin.label,
        to: selectedDestination.label,
        fromLat: origin.lat,
        fromLng: origin.lng,
        toLat: selectedDestination.lat,
        toLng: selectedDestination.lng,
        date: new Date().toISOString()
      });
      localStorage.setItem('merosadak_saved_routes', JSON.stringify(routes));
      alert('✅ Route saved! View it anytime from the bottom bar menu.');
    }\`
);

// Update startup code
newJs = newJs.replace(
  /setupAutocomplete\('fromInput', 'fromSuggest'\);\n      setupAutocomplete\('toInput', 'toSuggest'\);/,
  \`setupAutocomplete('sidebarSearch', 'sidebarSuggest');
      setMode('route');\`
);

html = html.substring(0, scriptStart) + newJs + html.substring(scriptEnd);

fs.writeFileSync(path, html);
console.log('JS updated successfully');
