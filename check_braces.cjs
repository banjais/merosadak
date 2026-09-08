const fs = require('fs');
const s = fs.readFileSync('src/components/RoutePlanner.tsx', 'utf8');
const lines = s.split('\n');

function isInsideString(line, idx) {
  let inStr = false;
  let strChar = '';
  for (let k = 0; k < idx; k++) {
    const ch = line[k];
    if (!inStr && (ch === "'" || ch === '"')) {
      inStr = true;
      strChar = ch;
    } else if (inStr && ch === strChar) {
      inStr = false;
    }
  }
  return inStr;
}

for (let i = 990; i < 1035; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{' && !isInsideString(line, j)) {
      console.log('open brace at line ' + (i + 1) + ' col ' + j + ': ' + line.trim().substring(0, 60));
    }
  }
}
