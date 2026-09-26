/**
 * Sync ALL Roads Board Nepal toll rates from official sources.
 *
 * All RBN toll rates are published in Nepal Gazette (PDFs on rbn.org.np).
 * No public API exists. This script maintains verified rates from Gazette notices.
 *
 * Usage:
 *   npx tsx scripts/sync-all-toll-rates.ts
 *   npm run sync:all-tolls
 */
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'public', 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'all-toll-rates.json');

const SOURCES = {
  rbnGazette: 'https://rbn.org.np/ne/downloads/nepal-gazette',
  rbnHome: 'https://rbn.org.np/',
  dorPublications: 'https://dor.gov.np/home/publication',
};

interface TollRateEntry {
  car: number;
  suv_4wd: number;
  motorbike: number;
  bus_truck: number;
  electric_vehicle: number;
}

interface TollPlaza {
  id: string;
  name: string;
  highwayCode: string;
  location: string;
  lat: number;
  lng: number;
  operator: string;
  directional: boolean;
  rates: {
    entry?: TollRateEntry;
    exit?: TollRateEntry;
    single?: TollRateEntry;
  };
  prohibitedVehicles?: string[];
  gazetteRef: string;
  cabinetDecisionDate?: string;
  tollBooths: { entry?: number; exit?: number; total?: number };
  operatingHours: string;
}

interface AllTollRatesCache {
  source: string;
  sourceUrl: string;
  sourceLabel: string;
  currency: string;
  unit: string;
  lastUpdated: string;
  fetchedAt: string;
  nextUpdate: string;
  note: string;
  tollPlazas: TollPlaza[];
}

// Current verified rates as of latest Gazette notices
const VERIFIED_TOLL_PLAZAS: TollPlaza[] = [
  {
    id: 'toll-nagdhunga',
    name: 'Nagdhunga Tunnel Toll Plaza',
    highwayCode: 'NH04',
    location: 'Nagdhunga-Sisne Khola (Dhading to Kathmandu)',
    lat: 27.7020,
    lng: 85.2010,
    operator: 'USIN-ART JV (5-year contract)',
    directional: true,
    rates: {
      entry: { car: 65, suv_4wd: 80, motorbike: 0, bus_truck: 260, electric_vehicle: 50 },
      exit: { car: 60, suv_4wd: 75, motorbike: 0, bus_truck: 200, electric_vehicle: 50 },
    },
    prohibitedVehicles: [
      'Two-wheelers (Motorcycles, Scooters, Bicycles)',
      'Three-wheelers (Auto-rickshaws, Tempos)',
      'Pedestrians and non-motorized carts',
      'Vehicles carrying flammable, toxic, or hazardous chemical cargo',
    ],
    gazetteRef: 'Sisnekhola-Nagdhunga Tunnel Transport Operation Directive, 2081 (Gazette Chaitra 27, 2082 / Apr 10, 2026)',
    cabinetDecisionDate: '2025-08-11',
    tollBooths: { entry: 3, exit: 2 },
    operatingHours: '24/7',
  },
  {
    id: 'toll-malekhu',
    name: 'Roads Board Nepal Malekhu Toll',
    highwayCode: 'NH04',
    location: 'Malekhu Bridge, Dhading',
    lat: 27.8230,
    lng: 84.8160,
    operator: 'Roads Board Nepal',
    directional: false,
    rates: {
      single: { car: 30, suv_4wd: 40, motorbike: 0, bus_truck: 70, electric_vehicle: 30 },
    },
    gazetteRef: 'Nepal Gazette - Road Usage Fee Notification (RBN Malekhu Bridge)',
    tollBooths: { total: 2 },
    operatingHours: '6:00-22:00',
  },
  {
    id: 'toll-aaptari',
    name: 'Roads Board Nepal Aaptari Toll Plaza',
    highwayCode: 'NH05',
    location: 'Aaptari Gate, Chitwan',
    lat: 27.6950,
    lng: 84.4380,
    operator: 'Roads Board Nepal',
    directional: false,
    rates: {
      single: { car: 35, suv_4wd: 50, motorbike: 0, bus_truck: 80, electric_vehicle: 35 },
    },
    gazetteRef: 'Nepal Gazette - Road Usage Fee Notification (RBN Aaptari, Narayanghat-Mugling)',
    tollBooths: { total: 2 },
    operatingHours: '6:00-22:00',
  },
  {
    id: 'toll-hetauda',
    name: 'RBN Hetauda Entry Toll',
    highwayCode: 'NH01',
    location: 'Rato Mate, Hetauda, Makwanpur',
    lat: 27.4350,
    lng: 85.0210,
    operator: 'Roads Board Nepal',
    directional: false,
    rates: {
      single: { car: 30, suv_4wd: 50, motorbike: 0, bus_truck: 80, electric_vehicle: 30 },
    },
    gazetteRef: 'Nepal Gazette - Road Usage Fee Notification (RBN Hetauda, Mahendra Highway)',
    tollBooths: { total: 2 },
    operatingHours: '6:00-22:00',
  },
  {
    id: 'toll-butwal',
    name: 'RBN Butwal Toll Gate',
    highwayCode: 'NH01',
    location: 'Ramuapur, Butwal, Rupandehi',
    lat: 27.7050,
    lng: 83.4390,
    operator: 'Roads Board Nepal',
    directional: false,
    rates: {
      single: { car: 30, suv_4wd: 50, motorbike: 0, bus_truck: 80, electric_vehicle: 30 },
    },
    gazetteRef: 'Nepal Gazette - Road Usage Fee Notification (RBN Butwal, Mahendra Highway)',
    tollBooths: { total: 2 },
    operatingHours: '6:00-22:00',
  },
];

async function main() {
  console.log('[All Toll Sync] Updating Roads Board Nepal toll rates...\n');
  console.log('[All Toll Sync] Official sources:');
  Object.entries(SOURCES).forEach(([key, url]) => {
    console.log(`  - ${key}: ${url}`);
  });
  console.log('');

  const now = new Date();
  const cache: AllTollRatesCache = {
    source: 'rbn.org.np',
    sourceUrl: 'https://rbn.org.np/ne/downloads/nepal-gazette',
    sourceLabel: 'Roads Board Nepal - Nepal Gazette Notices',
    currency: 'NPR',
    unit: 'per single entry',
    lastUpdated: now.toISOString(),
    fetchedAt: now.toISOString(),
    nextUpdate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    note: 'Rates from Nepal Gazette notices published by Roads Board Nepal. Vehicle categories: car (car/jeep/van), suv_4wd (SUV/pickup), motorbike, bus_truck (bus/truck), electric_vehicle. Rates may vary by plaza. Update when new Gazette is published.',
    tollPlazas: VERIFIED_TOLL_PLAZAS,
  };

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  let hasChanges = false;
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const oldPlazas = JSON.stringify(existing.tollPlazas);
      const newPlazas = JSON.stringify(cache.tollPlazas);

      if (oldPlazas !== newPlazas) {
        hasChanges = true;
        console.log('[All Toll Sync] Toll plaza rates have changed from existing file!');
      } else {
        console.log('[All Toll Sync] Rates unchanged from existing file.');
      }
    } catch {
      hasChanges = true;
    }
  } else {
    hasChanges = true;
    console.log('[All Toll Sync] No existing file, creating new.');
  }

   fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
   console.log(`\n[${hasChanges ? 'All Toll Sync' : 'All Toll Sync (no changes)'}] Saved to ${CACHE_FILE}`);
   console.log(`[All Toll Sync] Next update check: ${cache.nextUpdate}`);

   // Auto-update pass: detect new/updated official documents
   const autoUpdate = await import('./auto-update-toll-rates.ts');
   await autoUpdate.detectNewOrUpdatedDocs().then(async () => {
     const docs = await autoUpdate.detectNewOrUpdatedDocs();
     if (docs.length > 0) {
       const existing = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
       existing.note = existing.note + ` ${docs.length} new/updated official document(s) found for review.`;
       existing.lastUpdated = new Date().toISOString();
       fs.writeFileSync(CACHE_FILE, JSON.stringify(existing, null, 2), 'utf8');
       console.log(`[All Toll Sync] Flagged ${docs.length} new document(s) for toll-rate review.`);
     }
   }).catch(() => {});

   console.log('\n[All Toll Sync] Note: All toll rates are set by Cabinet decision and published in Nepal Gazette by Roads Board Nepal.');
   console.log('[All Toll Sync] This script maintains verified rates. Update VERIFIED_TOLL_PLAZAS when new Gazette is published.');
}

main().catch(console.error);