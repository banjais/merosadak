// util.js – shared utility functions for Merosadak app

// Mode handling
function setMode(mode) {
  const modeTabs = document.querySelectorAll('.mode-tab');
  modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  // Additional mode-specific UI updates can be added here
}

// Sidebar search utilities
function showDefaultRouteSuggestions() {
  // Placeholder: implement UI for default suggestions when search is empty
}

function clearSidebarSearch() {
  const input = document.getElementById('sidebarSearch');
  if (input) input.value = '';
  const suggestions = document.getElementById('sidebarSuggest');
  if (suggestions) suggestions.style.display = 'none';
}

function getSearchSuggestions(query) {
  if (!window.searchIndex || !Array.isArray(window.searchIndex)) return [];
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];

  function getBaseName(label) {
    if (!label) return '';
    return label.replace(/\s*\([^)]*\)/g, '').replace(/^[A-Z0-9]{3,4}\s*[—–-]\s*/i, '').trim();
  }

  const typePriority = { 'City Hub': 10, 'District HQ': 9, 'Airport': 8, 'Highway': 7, 'Bus Station': 6, 'Weather Node': 5, 'Local Unit': 4, 'POI': 3, 'Map Place': 2 };

  const scoredItems = [];
  window.searchIndex.forEach(item => {
    const label = (item.label || '').toLowerCase();
    const baseName = getBaseName(item.label).toLowerCase();
    const code = (item.code || '').toLowerCase();
    const district = (item.district || '').toLowerCase();

    let score = -1;
    if (baseName === q || code === q || label === q) score = 100;
    else if (baseName.startsWith(q) || code.startsWith(q) || label.startsWith(q)) score = 80;
    else if (baseName.includes(q) || label.includes(q)) score = 40;
    else if (district === q || district.startsWith(q)) score = 30;

    if (score > 0) scoredItems.push({ item, score });
  });

  scoredItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (typePriority[b.item.type] || 0) - (typePriority[a.item.type] || 0);
  });

  const results = [];
  const seenKeys = new Set();
  scoredItems.forEach(({ item }) => {
    const baseName = getBaseName(item.label).toLowerCase();
    const dist = (item.district || '').toLowerCase();
    const dedupKey = item.type === 'Highway' ? ('hwy_' + (item.code || baseName)) :
                     item.type === 'Airport' ? ('air_' + (item.code || baseName)) :
                     (baseName + (dist ? ('_' + dist) : ''));
    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey);
      results.push({ ...item, label: getBaseName(item.label) });
    }
  });

  return results.slice(0, 8);
}

function selectSidebarItem(item) {
  // Example: navigate to the selected item or update UI
  console.log('Sidebar item selected:', item);
  // Implement actual navigation or map centering as needed
}

// Updated renderSidebarRouteResult to show plain text, Change From button, and Get Info button
function renderSidebarRouteResult(dest) {
  const container = document.getElementById('sidebarResults');
  if (!container) return;
  // Clear previous content
  container.innerHTML = '';
  // Route header with From location and change button
  const header = document.createElement('div');
  header.className = 'route-header';
  header.innerHTML = `
    <span id="routeFromLabel"><strong>My Location</strong></span>
    <button class="btn-action-primary" style="margin-left:8px;" onclick="changeFromLocation()">Change</button>
  `;
  container.appendChild(header);

  // Destination line (plain text, no icon)
  const destDiv = document.createElement('div');
  destDiv.className = 'route-destination';
  destDiv.textContent = `Destination: ${dest.label}`;
  container.appendChild(destDiv);

  // Get Info button
  const infoBtn = document.createElement('button');
  infoBtn.className = 'btn-action-primary';
  infoBtn.textContent = 'Get Info';
  infoBtn.onclick = () => showInfoCard(dest);
  container.appendChild(infoBtn);
}

// Placeholder for changing the "From" location
function changeFromLocation() {
  // In a full implementation this would open a location picker.
  // For now show a simple prompt.
  const newFrom = prompt('Enter new start location (e.g., address or coordinates):', 'My Location');
  if (newFrom !== null) {
    const fromLabel = document.getElementById('routeFromLabel');
    if (fromLabel) fromLabel.innerHTML = `<strong>${newFrom}</strong>`;
  }
}

// Simple info card display for the selected destination
function showInfoCard(dest) {
  // Remove existing card if any
  const existing = document.getElementById('infoCard');
  if (existing) existing.remove();
  const card = document.createElement('div');
  card.id = 'infoCard';
  card.className = 'info-card';
  card.style = 'margin-top:12px; padding:12px; border:1px solid var(--surface-border); border-radius:var(--radius-sm); background:rgba(0,0,0,0.2);';
  // Placeholder content – could be expanded with real route metrics
  card.innerHTML = `
    <h3 style="margin-top:0;">Info for ${dest.label}</h3>
    <p>Coordinates: ${dest.lat?.toFixed(3)}, ${dest.lng?.toFixed(3)}</p>
    <p>Distance, time, and vehicle recommendations will appear here.</p>
  `;
  const container = document.getElementById('sidebarResults');
  if (container) container.appendChild(card);
}

// Export functions if needed elsewhere
window.renderSidebarRouteResult = renderSidebarRouteResult;
window.changeFromLocation = changeFromLocation;
window.showInfoCard = showInfoCard;

async function calculateSidebarRoute() {
  // Placeholder: perform route calculation using selected points and preferences
  console.log('Calculating route...');
  // Implement actual API call or logic here
}

async function renderSidebarWeatherResult(place) {
  // Placeholder: fetch and display weather data for the place
  console.log('Weather for', place);
}

function renderSidebarTrafficResult(place) {
  // Placeholder: display traffic info for the place
  console.log('Traffic for', place);
}

function renderSidebarPoisResult(place) {
  // Placeholder: show POI information
  console.log('POI for', place);
}

function renderSidebarSosResult(place) {
  // Placeholder: SOS related UI update
  console.log('SOS info for', place);
}

function toggleSearchCollapse() {
  const searchWrap = document.querySelector('.sidebar-search-wrap');
  if (searchWrap) searchWrap.classList.toggle('collapsed');
}

function shareApp() {
  // Simple share using Web Share API if available
  if (navigator.share) {
    navigator.share({
      title: 'Mero Sadak',
      url: location.href
    }).catch(e => console.warn('Share failed', e));
  } else {
    alert('Sharing not supported on this browser');
  }
}

function saveCurrentRoute() {
  // Placeholder: serialize current route and offer download or storage
  console.log('Saving current route...');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.error(err));
  } else {
    document.exitFullscreen();
  }
}

// Export functions for potential module usage (if needed)
export {
  setMode,
  showDefaultRouteSuggestions,
  clearSidebarSearch,
  getSearchSuggestions,
  selectSidebarItem,
  renderSidebarRouteResult,
  calculateSidebarRoute,
  renderSidebarWeatherResult,
  renderSidebarTrafficResult,
  renderSidebarPoisResult,
  renderSidebarSosResult,
  toggleSearchCollapse,
  shareApp,
  saveCurrentRoute,
  toggleFullscreen
};
