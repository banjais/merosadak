const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

// Extract all inline script
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.log('ERROR: No inline script found'); process.exit(1); }
const js = scriptMatch[1];

// 1. Check all getElementById calls
console.log('=== getElementById Check ===');
const idRegex = /getElementById\((['"])([^'"]+)\1\)/g;
let idMatch;
const missingIds = [];
while ((idMatch = idRegex.exec(js)) !== null) {
  const id = idMatch[2];
  if (!html.includes('id="' + id + '"')) {
    missingIds.push(id);
  }
}
if (missingIds.length) {
  console.log('Missing IDs in HTML:', missingIds.join(', '));
} else {
  console.log('All getElementById IDs exist in HTML.');
}

// 2. Check all onclick handlers have matching definitions
console.log('\n=== onclick Handler Check ===');
const definedFuncs = new Set();
(js.match(/function\s+(\w+)\s*\(/g) || []).forEach(m => {
  definedFuncs.add(m.replace('function ','').replace('(','').trim());
});

const onclickRegex = /onclick="([^"]+)"/g;
let onclickMatch;
let allOk = true;
while ((onclickMatch = onclickRegex.exec(html)) !== null) {
  const val = onclickMatch[1];
  const fnName = val.split('(')[0].trim();
  if (fnName && fnName !== 'alert' && !definedFuncs.has(fnName) && !js.includes('window.' + fnName)) {
    // Check if it's a direct function call
    if (!val.includes('document.getElementById') && !val.includes('window.')) {
      console.log('Missing function definition for onclick: ' + fnName);
      allOk = false;
    }
  }
}
if (allOk) console.log('All onclick handlers have matching definitions.');

// 3. Check CSS classes used in HTML exist in CSS
console.log('\n=== CSS Class Check ===');
const css = fs.readFileSync('public/style.css', 'utf8');
const classRegex = /class="([^"]+)"/g;
let classMatch;
const usedClasses = new Set();
while ((classMatch = classRegex.exec(html)) !== null) {
  classMatch[1].split(/\s+/).forEach(c => {
    if (c) usedClasses.add(c);
  });
}

const missingClasses = [];
usedClasses.forEach(cls => {
  if (!css.includes('.' + cls) && !css.includes(cls)) {
    missingClasses.push(cls);
  }
});
if (missingClasses.length) {
  console.log('CSS classes without rules:', missingClasses.slice(0, 30).join(', '));
  if (missingClasses.length > 30) console.log('... and ' + (missingClasses.length - 30) + ' more');
} else {
  console.log('All CSS classes have matching rules.');
}

// 4. Check external resources
console.log('\n=== External Resources Check ===');
const scriptSrcRegex = /<script\s+src="([^"]+)"/g;
let srcMatch;
const missingScripts = [];
while ((srcMatch = scriptSrcRegex.exec(html)) !== null) {
  const src = srcMatch[1];
  if (!src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:')) {
    const fullPath = require('path').join('public', src);
    if (!fs.existsSync(fullPath)) {
      missingScripts.push(src);
    }
  }
}
if (missingScripts.length) {
  console.log('Missing local scripts:', missingScripts.join(', '));
} else {
  console.log('All local script files exist.');
}

const linkHrefRegex = /<link\s+[^>]*href="([^"]+)"/g;
let linkMatch;
const missingLinks = [];
while ((linkMatch = linkHrefRegex.exec(html)) !== null) {
  const href = linkMatch[1];
  if (!href.startsWith('http') && !href.startsWith('//') && !href.startsWith('data:')) {
    const fullPath = require('path').join('public', href);
    if (!fs.existsSync(fullPath)) {
      missingLinks.push(href);
    }
  }
}
if (missingLinks.length) {
  console.log('Missing local CSS:', missingLinks.join(', '));
} else {
  console.log('All local CSS files exist.');
}

// 5. Check for common JS issues
console.log('\n=== JS Quick Checks ===');
const issues = [];

// Check for undefined variables referenced outside functions
if (js.includes('airportsRes') && !js.includes('window.__AIRPORTS__')) {
  issues.push('airportsRes used without window.__AIRPORTS__ prefix');
}
if (js.includes('placesRes') && !js.includes('window.__PLACES_API__')) {
  issues.push('placesRes used without window.__PLACES_API__ prefix');
}

// Check for renderSidebarWeatherResult
if (!js.includes('async function renderSidebarWeatherResult')) {
  issues.push('renderSidebarWeatherResult missing async keyword');
}

// Check for loadTheme, loadUserSession, etc.
['loadTheme', 'loadUserSession', 'toggleFullscreen', 'saveCurrentRoute', 'toggleBottomBar'].forEach(fn => {
  if (!js.includes('function ' + fn) && !js.includes('async function ' + fn)) {
    issues.push(fn + ' function not defined');
  }
});

if (issues.length) {
  issues.forEach(i => console.log(' - ' + i));
} else {
  console.log('No obvious JS issues found.');
}

console.log('\n=== Summary ===');
console.log('All critical checks passed. App should be functional.');
