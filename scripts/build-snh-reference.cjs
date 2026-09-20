#!/usr/bin/env node
/**
 * Builds a compact SNH reference lookup file from the raw table JSON files.
 * Output: public/data/snh-reference.json
 *
 * Run: node scripts/build-snh-reference.cjs
 */
const fs = require('fs');
const path = require('path');

var dataDir = path.join(process.cwd(), 'public', 'data', 'SNH-2022-23-tables-csv-json');

var links = JSON.parse(fs.readFileSync(path.join(dataDir, 'annex2_links.json'), 'utf-8'));
var table4 = JSON.parse(fs.readFileSync(path.join(dataDir, 'table4_nh01_distances.json'), 'utf-8'));
var table5 = JSON.parse(fs.readFileSync(path.join(dataDir, 'table5_mugling_narayanghat.json'), 'utf-8'));
var table6 = JSON.parse(fs.readFileSync(path.join(dataDir, 'table6_kathmandu_district_hq.json'), 'utf-8'));

var publishedDistances = {};

function addDistance(origin, dest, distance, table, row, printedPage, pdfPage, via) {
  var key = (origin || '').toLowerCase().trim() + '|' + (dest || '').toLowerCase().trim();
  if (!(key in publishedDistances)) {
    publishedDistances[key] = {
      distance_km: distance,
      source: 'SNH 2022/23',
      table: table,
      row: row,
      printed_page: printedPage,
      pdf_page: pdfPage,
      via: via || null
    };
  }
  var reverseKey = (dest || '').toLowerCase().trim() + '|' + (origin || '').toLowerCase().trim();
  if (!(reverseKey in publishedDistances)) {
    publishedDistances[reverseKey] = Object.assign({}, publishedDistances[key]);
  }
}

var t4PlaceList = [];
table4.forEach(function(row) {
  if (row.distance_km !== null && row.distance_km !== undefined && row.distance_km > 0) {
    addDistance(row.from_place, row.to_place, row.distance_km, 'Table 4', null, 11, 21, row.via_tansen_palpa ? 'via Tansen Palpa' : null);
    if (t4PlaceList.indexOf(row.from_place) === -1) t4PlaceList.push(row.from_place);
  }
});

var t6Names = {};
table6.forEach(function(row) {
  var name = row.district_headquarter;
  var dist = row.distance_km;
  addDistance('Kathmandu', name, dist, 'Table 6', row.sn, 12, 22, row.via_mugling ? 'via NH17 Prithvi Highway (via Mugling)' : 'via NH17 Prithvi Highway');
  t6Names[name.toLowerCase()] = true;
});

table5.forEach(function(row) {
  var name = row.district_headquarter;
  if (!(name.toLowerCase() in t6Names)) {
    addDistance('Kathmandu', name, row.distance_km, 'Table 5', row.sn, 11, 21, row.via_mugling ? 'via Mugling' : 'direct');
  }
});

var t6NameList = table6.map(function(r) { return r.district_headquarter; });

var cityAliases = {
  'kathmandu': ['Kathmandu'],
  'kathmandu valley': ['Kathmandu'],
  'pokhara': ['Pokhara'],
  'gulariya': ['Gulariya'],
  'kohalpur': ['Kohalpur'],
  'biratnagar': ['Biratnagar'],
  'birgunj': ['Birgunj', 'Birgunj (Parsa)'],
  'hetauda': ['Hetauda'],
  'bharatpur': ['Bharatpur', 'Bharatpur (Narayani)'],
  'nepalgunj': ['Nepalgunj'],
  'butwal': ['Butwal (Mahendrachok)', 'Butwal'],
  'dharan': ['Dharan'],
  'itahari': ['Itahari'],
  'dhalkebar': ['Dhalkebar'],
  'narayangadh': ['Narayangadh', 'Narayan Ghad'],
  'mugling': ['Mugling'],
  'attaria': ['Attaria'],
  'gaddachowki': ['Gaddachowki'],
  'dhangadhi': ['Dhangadhi'],
  'rajbiraj': ['Rajbiraj'],
  'lazimpat': ['Lazimpat'],
  'janakpur': ['Janakpur'],
  'bardia': ['Gulariya'],
};

var compactLinks = links.map(function(l) {
  return {
    code: l.link_code,
    name: l.link_name,
    length_km: l.length_km,
    pavement_type: l.pavement_type,
    from_km: l.from_km,
    to_km: l.to_km,
    highway: l.link_code.split('-')[0]
  };
});

var referenceData = {
  document: 'Statistics of National Highway (SNH) 2022/23',
  publisher: 'Department of Roads (DoR), Nepal - HMIS-ICT Unit',
  publication_date: '2024-06',
  pdf_pages: 322,
  description: 'Compiled from the SNH 2022/23 PDF (322 pages, text-layer extracted). Table 4 = NH01 corridor place-to-place distances. Table 5/6 = District HQ distances from Kathmandu via NH17 Prithvi Highway. Annex 2 = link records (NH01-NH38).',
  tables: {
    table_4: {
      title: 'NH01 Corridor Place-to-Place Road Distances',
      printed_page: 11,
      pdf_page: 21,
      places: t4PlaceList
    },
    table_5: {
      title: 'Road Distance from Mugling-Narayanghat to District Headquarters',
      printed_page: 11,
      pdf_page: 21,
      entry_count: table5.length
    },
    table_6: {
      title: 'Road Distance of District Headquarters from Kathmandu via NH17 Prithvi Highway',
      printed_page: 12,
      pdf_page: 22,
      entry_count: table6.length
    }
  },
  published_distances: publishedDistances,
  links: compactLinks,
  city_aliases: cityAliases,
  corrections: [
    {
      item: 'NH18',
      issue: 'PDF link codes are shifted by one row in the original PDF',
      resolution: 'Used repo GeoJSON geometry; total length 108.02 km agrees with PDF',
      corrected_km: 108.02
    },
    {
      item: 'NH52-004',
      issue: 'PDF states 5.5 km but chainage gap and geometry both give 8.5 km',
      resolution: 'Used 8.5 km from chainage gap',
      corrected_km: 8.5
    },
    {
      item: 'NH13-001',
      issue: 'Exists in PDF Annex 2 but has no geometry in repo GeoJSON',
      resolution: 'Added as explicit 12.5 km Bardibas-Rato River link',
      corrected_km: 12.5
    },
    {
      item: 'Blank link names',
      issue: 'Five link names blank in PDF text extraction due to line wrapping',
      resolution: 'Filled from repo GeoJSON',
      corrected_km: null
    }
  ]
};

var outPath = path.join(process.cwd(), 'public', 'data', 'snh-reference.json');
fs.writeFileSync(outPath, JSON.stringify(referenceData, null, 2), 'utf-8');
console.log('Wrote', outPath);
console.log('Published distance pairs:', Object.keys(publishedDistances).length / 2, 'unique pairs');
console.log('Links:', compactLinks.length);
console.log('Table 4 places:', t4PlaceList.length);
console.log('Table 6 entries:', table6.length);
