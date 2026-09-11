const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'highway');
const OUTPUT_FILE = path.join(DATA_DIR, 'highway-lengths.json');

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.geojson') && !f.startsWith('highway-lengths'));

const highways = {};

for (const file of files) {
  const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
  const geojson = JSON.parse(raw);

  for (const feature of geojson.features) {
    const props = feature.properties;
    const code = props.road_refno;
    if (!code) continue;

    if (!highways[code]) {
      highways[code] = {
        name: props.road_name || '',
        totalLengthKm: 0,
        segmentCount: 0,
      };
    }

    const linkLen = props.link_len;
    if (typeof linkLen === 'number') {
      highways[code].totalLengthKm += linkLen;
    }
    highways[code].segmentCount += 1;
  }
}

const sorted = {};
Object.keys(highways).sort().forEach(code => {
  sorted[code] = highways[code];
});

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sorted, null, 2));
console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`Highways processed: ${Object.keys(sorted).length}`);
