const fs = require('fs');
const path = 'public/index.html';
let html = fs.readFileSync(path, 'utf8');

const scriptStart = html.indexOf('<script>') + 8;
const scriptEnd = html.lastIndexOf('</script>');
const oldJs = html.substring(scriptStart, scriptEnd);

// Helper to build sidebar JS without nested template literal issues
function buildSidebarJs() {
  return '' +
    '    // ==========================================\n' +
    '    // 3. Sidebar Search & Mode Engine\n' +
    '    // ==========================================\n' +
    '    const MODE_CONFIG = {\n' +
    "      route: { icon: '📍', placeholder: 'Where to? (destination)' },\n" +
    "      weather: { icon: '⛅', placeholder: 'Check weather for...' },\n" +
    "      traffic: { icon: '🚦', placeholder: 'Check traffic on...' },\n" +
    "      pois: { icon: '⛽', placeholder: 'Find POIs near...' },\n" +
    "      sos: { icon: '🆘', placeholder: 'Emergency contacts for...' }\n" +
    '    };\n' +
    '\n' +
    '    const DEFAULT_SUGGESTIONS = [\n' +
    "      { label: 'Tribhuvan International Airport (TIA)', type: 'airport', lat: 27.6968, lng: 85.3591 },\n" +
    "      { label: 'Pokhara International Airport', type: 'airport', lat: 28.2006, lng: 83.9821 },\n" +
    "      { label: 'Gautam Buddha Airport, Bhairahawa', type: 'airport', lat: 27.5057, lng: 83.4163 },\n" +
    "      { label: 'Kathmandu Bus Park (Koteshwor)', type: 'bus_station', lat: 27.6786, lng: 85.3477 },\n" +
    "      { label: 'Pokhara Bus Park', type: 'bus_station', lat: 28.2096, lng: 83.9856 },\n" +
    "      { label: 'Butwal Bus Station', type: 'bus_station', lat: 27.7006, lng: 83.4484 },\n" +
    "      { label: 'Kathmandu', type: 'City Hub', lat: 27.7172, lng: 85.324 },\n" +
    "      { label: 'Pokhara', type: 'City Hub', lat: 28.2096, lng: 83.9856 },\n" +
    "      { label: 'Chitwan / Bharatpur', type: 'City Hub', lat: 27.6833, lng: 84.4333 },\n" +
    "      { label: 'Butwal', type: 'City Hub', lat: 27.7006, lng: 83.4484 },\n" +
    "      { label: 'Biratnagar', type: 'City Hub', lat: 26.4525, lng: 87.2718 },\n" +
    "      { label: 'Birgunj', type: 'City Hub', lat: 27.0, lng: 84.8667 },\n" +
    "      { label: 'Lumbini', type: 'City Hub', lat: 27.4833, lng: 83.2833 },\n" +
    "      { label: 'Dharan', type: 'City Hub', lat: 26.8146, lng: 87.2833 },\n" +
    "      { label: 'Nepalgunj', type: 'City Hub', lat: 28.1036, lng: 81.667 }\n" +
    '    ];\n' +
    '\n' +
    '    function setMode(mode) {\n' +
    '      currentMode = mode;\n' +
    "      document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));\n" +
    '      const config = MODE_CONFIG[mode];\n' +
    "      document.getElementById('searchModeIcon').textContent = config.icon;\n" +
    "      document.getElementById('sidebarSearch').placeholder = config.placeholder;\n" +
    "      document.getElementById('sidebarResults').innerHTML = '';\n" +
    "      document.getElementById('sidebarSearch').value = '';\n" +
    '      selectedDestination = null;\n' +
    '\n' +
    '      if (mode === \'route\') {\n' +
    '        showDefaultRouteSuggestions();\n' +
    '      } else if (mode === \'traffic\') {\n' +
    '        toggleLayer(\'traffic\');\n' +
    '      } else if (mode === \'pois\') {\n' +
    '        toggleLayer(\'pois\');\n' +
    '      }\n' +
    '    }\n' +
    '\n' +
    '    function showDefaultRouteSuggestions() {\n' +
    '      const container = document.getElementById(\'sidebarSuggest\');\n' +
    '      container.innerHTML = DEFAULT_SUGGESTIONS.map(s => \'<div class="autocomplete-item" onclick="selectSidebarItem({label:\' + s.label.replace(/'/g, "") + '\',type:\'' + s.type + '\',lat:' + s.lat + ',lng:' + s.lng + '})"><span>' + s.label + '</span> <span class="tag">' + s.type + '</span></div>\').join(\'\');\n' +
    "      container.style.display = 'block';\n" +
    '    }\n' +
    '\n' +
    '    function clearSidebarSearch() {\n' +
    "      document.getElementById('sidebarSearch').value = '';\n" +
    "      document.getElementById('sidebarSuggest').style.display = 'none';\n" +
    "      document.getElementById('sidebarResults').innerHTML = '';\n" +
    '      selectedDestination = null;\n' +
    '      if (currentMode === \'route\') showDefaultRouteSuggestions();\n' +
    '    }\n' +
    '\n' +
    '    function getSearchSuggestions(query) {\n' +
    '      const q = query.toLowerCase();\n' +
    '      return searchIndex.filter(item => item.label.toLowerCase().includes(q)).slice(0, 8);\n' +
    '    }\n' +
    '\n' +
    '    function selectSidebarItem(item) {\n' +
    "      document.getElementById('sidebarSuggest').style.display = 'none';\n" +
    "      document.getElementById('sidebarSearch').value = item.label;\n" +
    '      selectedDestination = item;\n' +
    '\n' +
    '      if (currentMode === \'route\') {\n' +
    '        renderSidebarRouteResult(item);\n' +
    '      } else if (currentMode === \'weather\') {\n' +
    '        renderSidebarWeatherResult(item);\n' +
    '      } else if (currentMode === \'traffic\') {\n' +
    '        renderSidebarTrafficResult(item);\n' +
    '      } else if (currentMode === \'pois\') {\n' +
    '        renderSidebarPoisResult(item);\n' +
    '      } else if (currentMode === \'sos\') {\n' +
    '        renderSidebarSosResult(item);\n' +
    '      }\n' +
    '    }\n' +
    '\n' +
    '    function renderSidebarRouteResult(dest) {\n' +
    '      const results = document.getElementById(\'sidebarResults\');\n' +
    '      const origin = userOrigin || { lat: 27.7172, lng: 85.324, label: \'Kathmandu (default)\' };\n' +
    '\n' +
    '      results.innerHTML = \'<div class="result-card" onclick="calculateSidebarRoute()">\' +\n' +
    '        \'<div class="result-card-title">🛣️ \' + dest.label + \'</div>\' +\n' +
    '        \'<div class="result-card-sub">\' +\n' +
    '          \'<span class="result-badge">ROUTE</span>\' +\n' +
    '          \'<span>From: \' + origin.label + \'</span>\' +\n' +
    '        \'</div>\' +\n' +
    '        \'<div style="margin-top:8px; display:flex; gap:6px;">\' +\n' +
    '          \'<button class="pref-pill active" onclick="setRoutePref(\\\'fastest\\\'); renderSidebarRouteResult(selectedDestination)">⚡ Fastest</button>\' +\n' +
    '          \'<button class="pref-pill" onclick="setRoutePref(\\\'shortest\\\'); renderSidebarRouteResult(selectedDestination)">📏 Shortest</button>\' +\n' +
    '          \'<button class="pref-pill" onclick="setRoutePref(\\\'scenic\\\'); renderSidebarRouteResult(selectedDestination)">🏔️ Scenic</button>\' +\n' +
    '        \'</div>\' +\n' +
    '        \'<div style="margin-top:8px;">\' +\n' +
    '          \'<select id="sidebarVehicle" onchange="activeVehicle=this.value; calculateSidebarRoute()" style="width:100%; padding:6px 10px; background:rgba(0,0,0,0.35); border:1px solid var(--surface-border); border-radius:var(--radius-sm); color:#fff; font-size:0.75rem; font-weight:600;">\' +\n' +
    '            \'<option value="car">🚗 Car / Sedan</option>\' +\n' +
    '            \'<option value="suv_4wd">🚙 4WD / Jeep</option>\' +\n' +
    '            \'<option value="motorbike">🏍️ Motorcycle</option>\' +\n' +
    '            \'<option value="bus_truck">🚌 Bus / Truck</option>\' +\n' +
    '            \'<option value="ev">⚡ EV (Electric)</option>\' +\n' +
    '          \'</select>\' +\n' +
    '        \'</div>\' +\n' +
    '      \'</div>\';\n' +
    '    }\n' +
    '\n' +
    '    async function calculateSidebarRoute() {\n' +
    '      if (!selectedDestination) return;\n' +
    '      const origin = userOrigin || { lat: 27.7172, lng: 85.324, label: \'Kathmandu\' };\n' +
    '      const dest = selectedDestination;\n' +
    '      const results = document.getElementById(\'sidebarResults\');\n' +
    '\n' +
    '      try {\n' +
    '        const url = \'https://router.project-osrm.org/route/v1/driving/\' + origin.lng + \',\' + origin.lat + \';\' + dest.lng + \',\' + dest.lat + \'?overview=full&geometries=geojson&alternatives=true\';\n' +
    '        const res = await fetch(url).then(r => r.json());\n' +
    '        if (res.code !== \'Ok\' || !res.routes.length) {\n' +
    '          results.innerHTML += \'<div class="result-card" style="border-color:rgba(217,4,41,0.5);"><div class="result-card-title" style="color:#ff4d6d;">No route found</div></div>\';\n' +
    '          return;\n' +
    '        }\n' +
    '\n' +
    '        const routes = res.routes;\n' +
    '        const chosen = activeRoutePreference === \'shortest\'\n' +
    '          ? routes.reduce((a, b) => (a.distance <= b.distance ? a : b))\n' +
    '          : routes.reduce((a, b) => (a.duration <= b.duration ? a : b));\n' +
    '\n' +
    '        const km = (chosen.distance / 1000).toFixed(1);\n' +
    '        const hrs = (chosen.duration / 3600).toFixed(1);\n' +
    '        const fuelLiters = (chosen.distance / 1000 / 12).toFixed(1);\n' +
    '        const fuelCost = Math.round(fuelLiters * 175);\n' +
    '\n' +
    '        if (routeLayerGroup) map.removeLayer(routeLayerGroup);\n' +
    '        const casing = L.geoJSON(chosen.geometry, { style: { color: \'#0b192c\', weight: 8, opacity: 0.9, lineCap: \'round\', lineJoin: \'round\' } });\n' +
    '        const core = L.geoJSON(chosen.geometry, { style: { color: \'#f59e0b\', weight: 5, opacity: 0.95, lineCap: \'round\', lineJoin: \'round\' } });\n' +
    '        routeLayerGroup = L.layerGroup([casing, core]).addTo(map);\n' +
    '\n' +
    '        map.flyToBounds(routeLayerGroup.getBounds(), { padding: [60, 60], duration: 1.5 });\n' +
    '\n' +
    '        const routeNames = chosen.geometry.coordinates ? \'Calculated Route\' : dest.label;\n' +
    '        results.innerHTML = \'<div class="result-card" style="border-color:rgba(245,158,11,0.4);">\' +\n' +
    '          \'<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">\' +\n' +
    '            \'<span class="result-badge">\' + activeRoutePreference.toUpperCase() + \' · \' + activeVehicle.toUpperCase() + \'</span>\' +\n' +
    '            \'<span style="font-size:0.72rem; color:var(--text-secondary);">\' + routeNames + \'</span>\' +\n' +
    '          \'</div>\' +\n' +
    '          \'<div class="metric-grid" style="margin-bottom:0;">\' +\n' +
    '            \'<div class="metric-box"><span class="metric-label">Distance</span><span class="metric-val highlight">\' + km + \' km</span></div>\' +\n' +
    '            \'<div class="metric-box"><span class="metric-label">Drive Time</span><span class="metric-val">\' + hrs + \' hrs</span></div>\' +\n' +
    '            \'<div class="metric-box"><span class="metric-label">Est. Fuel</span><span class="metric-val">NPR \' + fuelCost.toLocaleString() + \'</span></div>\' +\n' +
    '            \'<div class="metric-box"><span class="metric-label">Origin</span><span class="metric-val" style="font-size:0.75rem;">\' + origin.label + \'</span></div>\' +\n' +
    '          \'</div>\' +\n' +
    '        \'</div>\';\n' +
    '      } catch (err) {\n' +
    '        results.innerHTML += \'<div class="result-card" style="border-color:rgba(217,4,41,0.5);"><div class="result-card-title" style="color:#ff4d6d;">Route error</div></div>\';\n' +
    '      }\n' +
    '    }\n' +
    '\n' +
    '    async function renderSidebarWeatherResult(place) {\n' +
    '      const results = document.getElementById(\'sidebarResults\');\n' +
    '      results.innerHTML = \'<div class="weather-card"><div style="color:var(--text-secondary);">⏳ Loading weather for \' + place.label + \'...</div></div>\';\n' +
    '\n' +
    '      try {\n' +
    '        const res = await fetch(\'https://api.open-meteo.com/v1/forecast?latitude=\' + place.lat + \'&longitude=\' + place.lng + \'&current=temperature_2m,weather_code,wind_speed_10m\').then(r => r.json());\n' +
    '        if (res.current) {\n' +
    '          const temp = Math.round(res.current.temperature_2m);\n' +
    '          const wind = Math.round(res.current.wind_speed_10m || 0);\n' +
    "          const codes = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Depositing rime fog',51:'Light drizzle',53:'Moderate drizzle',55:'Dense drizzle',61:'Slight rain',63:'Moderate rain',65:'Heavy rain',71:'Slight snow',73:'Moderate snow',75:'Heavy snow',80:'Slight rain showers',81:'Moderate rain showers',82:'Violent rain showers',95:'Thunderstorm'};\n" +
    '          const desc = codes[res.current.weather_code] || \'Fair\';\n' +
    '          results.innerHTML = \'<div class="weather-card">\' +\n' +
    '            \'<div class="weather-main">\' +\n' +
    '              \'<span style="font-size:2.5rem;">\' + (res.current.weather_code <= 3 ? \'☀️\' : res.current.weather_code <= 48 ? \'🌫️\' : res.current.weather_code <= 65 ? \'🌧️\' : res.current.weather_code <= 82 ? \'🌦️\' : \'⛈️\') + \'</span>\' +\n' +
    '              \'<div>\' +\n' +
    '                \'<div class="weather-temp">\' + temp + \'°C</div>\' +\n' +
    '                \'<div class="weather-meta">\' + desc + \' · Wind \' + wind + \' km/h</div>\' +\n' +
    '              \'</div>\' +\n' +
    '            \'</div>\' +\n' +
    '            \'<div class="result-card-sub" style="margin-top:4px;">\' +\n' +
    '              \'<span>📍 \' + place.label + \'</span>\' +\n' +
    '            \'</div>\' +\n' +
    '          \'</div>\';\n' +
    '        } else {\n' +
    '          results.innerHTML = \'<div class="weather-card"><div class="result-card-title">Weather unavailable</div></div>\';\n' +
    '        }\n' +
    '      } catch (e) {\n' +
    '        results.innerHTML = \'<div class="weather-card"><div class="result-card-title" style="color:#ff4d6d;">Weather fetch failed</div></div>\';\n' +
    '      }\n' +
    '    }\n' +
    '\n' +
    '    function renderSidebarTrafficResult(place) {\n' +
    '      const results = document.getElementById(\'sidebarResults\');\n' +
    '      map.flyTo([place.lat, place.lng], 12, { duration: 1.2 });\n' +
    '      toggleLayer(\'traffic\');\n' +
    '      results.innerHTML = \'<div class="result-card" style="border-color:rgba(245,158,11,0.4);">\' +\n' +
    '        \'<div class="result-card-title">🚦 Traffic: \' + place.label + \'</div>\' +\n' +
    '        \'<div class="result-card-sub"><span>Live traffic layer activated</span></div>\' +\n' +
    '        \'<div style="margin-top:10px; padding:10px; background:rgba(245,158,11,0.1); border-radius:8px; font-size:0.78rem; color:#fbbf24;">\' +\n' +
    '          \'Traffic data refreshes every 5 minutes via Worker API. Use the right-side toggles to adjust layers.\' +\n' +
    '        \'</div></div>\';\n' +
    '    }\n' +
    '\n' +
    '    function renderSidebarPoisResult(place) {\n' +
    '      const results = document.getElementById(\'sidebarResults\');\n' +
    '      const pois = (window.NEPAL_DATA?.places || []).filter(p => p.type === \'fuel\' || p.type === \'ev\' || p.type === \'hospital\' || p.type === \'police\' || p.type === \'rest_area\');\n' +
    '      const nearby = pois.slice(0, 8);\n' +
    '\n' +
    '      if (!nearby.length) {\n' +
    '        results.innerHTML = \'<div class="result-card"><div class="result-card-title">No POIs found nearby</div></div>\';\n' +
    '        return;\n' +
    '      }\n' +
    '\n' +
    '      results.innerHTML = nearby.map(p => \'<div class="poi-list-item" onclick="focusMapLocation(\' + p.lat + \', \' + p.lng + \', \\\'\' + p.name.replace(/'/g, "") + \'\\\')">\' +\n' +
    '        \'<span class="poi-icon">\' + (p.type === \'fuel\' ? \'⛽\' : p.type === \'ev\' ? \'⚡\' : p.type === \'hospital\' ? \'🏥\' : p.type === \'police\' ? \'👮\' : \'🛣️\') + \'</span>\' +\n' +
    '        \'<div class="poi-info">\' +\n' +
    '          \'<div class="poi-name">\' + p.name + \'</div>\' +\n' +
    '          \'<div class="poi-loc">\' + p.location + \' · \' + p.highway + \'</div>\' +\n' +
    '        \'</div></div>\'\n' +
    '      ).join(\'\');\n' +
    '\n' +
    '      toggleLayer(\'pois\');\n' +
    '      map.flyTo([place.lat, place.lng], 13, { duration: 1.2 });\n' +
    '    }\n' +
    '\n' +
    '    function renderSidebarSosResult(place) {\n' +
    '      const results = document.getElementById(\'sidebarResults\');\n' +
    '      const district = place.label.split(\'(\').pop().replace(\')\', \'\').trim() || place.label;\n' +
    '      const contacts = (window.NEPAL_DATA?.emergencyContacts || []).slice(0, 6);\n' +
    '\n' +
    '      if (!contacts.length) {\n' +
    '        results.innerHTML = \'<div class="result-card"><div class="result-card-title">Emergency contacts unavailable</div></div>\';\n' +
    '        return;\n' +
    '      }\n' +
    '\n' +
    '      results.innerHTML = \'<div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;">📍 \' + place.label + \'</div>\' +\n' +
    '        contacts.map(c => \'<div class="sos-tile-sidebar">\' +\n' +
    '          \'<div><div style="font-size:0.75rem; color:var(--text-secondary);">\' + c.icon + \' \' + c.type + \'</div><div class="sos-num">\' + c.number + \'</div></div>\' +\n' +
    '          \'<a href="tel:\' + c.number + \'" class="btn-dial-small">📞 Call</a></div>\'\n' +
    '        ).join(\'\');\n' +
    '    }\n' +
    '\n';
}

let newJs = oldJs;

// Replace old search section with sidebar
newJs = newJs.replace(
  /    \/\/ ={40}\n    \/\/ 3\. Search & Autocomplete[\s\S]*?    \/\/ ={40}\n    \/\/ 4\. Voice Search \(Web Speech API\)/,
  buildSidebarJs() + '    // ==========================================\n    // 4. Map Pin Picker'
);

// Remove startVoice section
newJs = newJs.replace(
  /    \/\/ ={40}\n    \/\/ 4\. Voice Search \(Web Speech API\)[\s\S]*?    \/\/ ={40}\n    \/\/ 5\. Map Pin Picker/,
  '    // ==========================================\n    // 4. Map Pin Picker'
);

// Remove armPicker
newJs = newJs.replace(
  /    function armPicker\(which\) \{[^}]*\}\n\n/,
  ''
);

// Remove old routing section
newJs = newJs.replace(
  /    \/\/ ={40}\n    \/\/ 6\. Routing & OSRM Engine[\s\S]*?    \/\/ ={40}\n    \/\/ 7\. AI Trip & Mountain Road Advisor/,
  '    // ==========================================\n    // 5. AI Route Advisor'
);

// Remove old AI advisor
newJs = newJs.replace(
  /    \/\/ ={40}\n    \/\/ 7\. AI Trip & Mountain Road Advisor[\s\S]*?    \/\/ ={40}\n    \/\/ 8\. Map Toggles & Layers/,
  '    // ==========================================\n    // 6. Map Toggles & Layers'
);

// Update askAiRouteAdvisor
newJs = newJs.replace(
  /async function askAiRouteAdvisor\(\) \{[\s\S]*?\n    \}/,
  '    async function askAiRouteAdvisor() {\n' +
  '      const from = userOrigin ? userOrigin.label : \'Kathmandu\';\n' +
  '      const to = selectedDestination ? selectedDestination.label : \'Pokhara\';\n' +
  "      const km = document.getElementById('sidebarResults')?.querySelector('.metric-val.highlight')?.textContent || '200 km';\n" +
  '      const outBox = document.getElementById(\'aiAdvisorOutput\');\n' +
  '      if (outBox) {\n' +
  "        outBox.style.display = 'block';\n" +
  "        outBox.innerHTML = '✨ <em>Querying Gemini Mountain Transit Intelligence…</em>';\n" +
  '      }\n' +
  '\n' +
  '      try {\n' +
  "        const prompt = `Give a concise 3-4 sentence driving safety advisory for traveling from ${from} to ${to} in Nepal (${km}). Mention typical road conditions (e.g. Mugling/Nagdhunga/Daunne), vehicle safety, and monsoon/landslide precautions.`;\n" +
  '        const res = await fetch(`${WORKER_URL}/api/assistant`, {\n' +
  '          method: \'POST\',\n' +
  "          headers: { 'Content-Type': 'application/json' },\n" +
  '          body: JSON.stringify({ prompt })\n' +
  '        }).then(r => r.json());\n' +
  '\n' +
  '        const text = res.candidates?.[0]?.content?.parts?.[0]?.text;\n' +
  '        if (outBox) {\n' +
  "          outBox.innerHTML = `<strong>🤖 AI Route Insight:</strong><br>${text || 'Drive carefully, monitor road condition reports, and observe mountain overtaking discipline.'}`;\n" +
  '        }\n' +
  '      } catch (e) {\n' +
  '        if (outBox) {\n' +
  "          outBox.innerHTML = `<strong>🤖 AI Route Insight:</strong><br>For driving from ${from} to ${to}: Check Nagdhunga and Mugling landslide clearance before departure. Maintain lower gear descending steep hairpin bends and keep emergency number 103 handy.`;\n" +
  '        }\n' +
  '      }\n' +
  '    }\n'
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
  '    function saveCurrentRoute() {\n' +
  '      if (!selectedDestination) {\n' +
  "        alert('No active route to save. Search a destination first.');\n" +
  '        return;\n' +
  '      }\n' +
  '      const origin = userOrigin || { lat: 27.7172, lng: 85.324, label: \'Kathmandu\' };\n' +
  '      const routes = JSON.parse(localStorage.getItem(\'merosadak_saved_routes\') || \'[]\');\n' +
  '      routes.push({\n' +
  '        from: origin.label,\n' +
  '        to: selectedDestination.label,\n' +
  '        fromLat: origin.lat,\n' +
  '        fromLng: origin.lng,\n' +
  '        toLat: selectedDestination.lat,\n' +
  '        toLng: selectedDestination.lng,\n' +
  '        date: new Date().toISOString()\n' +
  '      });\n' +
  "      localStorage.setItem('merosadak_saved_routes', JSON.stringify(routes));\n" +
  "      alert('✅ Route saved! View it anytime from the bottom bar menu.');\n" +
  '    }\n'
);

// Update startup code
newJs = newJs.replace(
  /setupAutocomplete\('fromInput', 'fromSuggest'\);\n      setupAutocomplete\('toInput', 'toSuggest'\);/,
  "setupAutocomplete('sidebarSearch', 'sidebarSuggest');\n      setMode('route');"
);

// Add sidebar search autocomplete
newJs = newJs.replace(
  /setupAutocomplete\('sidebarSearch', 'sidebarSuggest'\);/,
  "setupAutocomplete('sidebarSearch', 'sidebarSuggest');\n      setMode('route');"
);

html = html.substring(0, scriptStart) + newJs + html.substring(scriptEnd);

fs.writeFileSync(path, html);
console.log('JS updated successfully');
