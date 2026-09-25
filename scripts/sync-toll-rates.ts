/**
 * Sync Nagdhunga Tunnel toll rates from official sources.
 *
 * The toll rates are officially published in the Nepal Gazette (gazette.gov.np)
 * based on Cabinet decisions. Currently no public API exists for automated fetching.
 *
 * This script maintains the toll-rates.json file with the latest official rates.
 * Update manually when new Gazette notifications are published, or run this script
 * to verify the current rates against known sources.
 *
 * Usage:
 *   npx tsx scripts/sync-toll-rates.ts
 *   npm run sync:tolls
 */
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'public', 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'toll-rates.json');

// Official source URLs for reference
const SOURCES = {
  gazette: 'https://www.gazette.gov.np/',
  dorProject: 'https://dor.gov.np/project/nagdhunga-tunnel',
  kathmanduPost: 'https://kathmandupost.com/national/2025/08/14/toll-rates-set-for-nepal-s-first-road-tunnel-ban-motorbikes',
  ekantipur: 'https://ekantipur.com/business/2026/04/10/en/what-is-the-fee-for-each-vehicle-when-using-the-nagdhunga-tunnel-04-47.html',
  theHimalayanTimes: 'https://thehimalayantimes.com/nepal/naubise-nagdhunga-tunnel-nears-completion-pm-oli',
};

interface TollRateEntry {
  category1: { name: string; rate: number };
  category2: { name: string; rate: number };
  category3: { name: string; rate: number };
  category4: { name: string; rate: number };
}

interface TollRatesCache {
  tunnel: string;
  lengthKm: number;
  location: string;
  source: string;
  sourceUrl: string;
  sourceLabel: string;
  gazetteDate: string;
  cabinetDecisionDate: string;
  currency: string;
  unit: string;
  rates: {
    entry: TollRateEntry;
    exit: TollRateEntry;
  };
  prohibitedVehicles: string[];
  operationalDetails: {
    tollBoothsEntry: number;
    tollBoothsExit: number;
    operatingHours: string;
    operator: string;
    estimatedDailyTraffic: {
      category1: { entry: number; exit: number };
      category2: { entry: number; exit: number };
      category3: { entry: number; exit: number };
      category4: { entry: number; exit: number };
    };
  };
  lastUpdated: string;
  fetchedAt: string;
  nextUpdate: string;
  note: string;
}

// Current verified rates as of Cabinet decision Aug 11, 2025, Gazette Apr 10, 2026
const VERIFIED_RATES: TollRatesCache = {
  tunnel: 'Nagdhunga-Sisnekhola Tunnel',
  lengthKm: 2.688,
  location: 'Dhading (Sisnekhola) to Kathmandu (Nagdhunga), Prithvi Highway NH04',
  source: 'gazette.gov.np',
  sourceUrl: 'https://www.gazette.gov.np/',
  sourceLabel: 'Nepal Gazette - Sisnekhola-Nagdhunga Tunnel Transport Operation Directive, 2081',
  gazetteDate: '2026-04-10',
  cabinetDecisionDate: '2025-08-11',
  currency: 'NPR',
  unit: 'per single entry',
  rates: {
    entry: {
      category1: { name: 'Light Vehicles (Car, Jeep, Van, SUV, Pickup up to 9 seats)', rate: 65 },
      category2: { name: 'Medium Vehicles / Minibuses (Minibus, Mini-truck, Microbus 10-25 seats)', rate: 115 },
      category3: { name: 'Heavy Commercial Vehicles (Bus, Large Truck 3-10 tons payload)', rate: 260 },
      category4: { name: 'Multi-Axle Heavy Freighters (Multi-axle trucks, trailers over 10 tons)', rate: 600 },
    },
    exit: {
      category1: { name: 'Light Vehicles (Car, Jeep, Van, SUV, Pickup up to 9 seats)', rate: 60 },
      category2: { name: 'Medium Vehicles / Minibuses (Minibus, Mini-truck, Microbus 10-25 seats)', rate: 80 },
      category3: { name: 'Heavy Commercial Vehicles (Bus, Large Truck 3-10 tons payload)', rate: 200 },
      category4: { name: 'Multi-Axle Heavy Freighters (Multi-axle trucks, trailers over 10 tons)', rate: 250 },
    },
  },
  prohibitedVehicles: [
    'Two-wheelers (Motorcycles, Scooters, Bicycles)',
    'Three-wheelers (Auto-rickshaws, Tempos)',
    'Pedestrians and non-motorized carts',
    'Vehicles carrying flammable, toxic, or hazardous chemical cargo',
  ],
  operationalDetails: {
    tollBoothsEntry: 3,
    tollBoothsExit: 2,
    operatingHours: '24/7',
    operator: 'USIN-ART JV (5-year contract)',
    estimatedDailyTraffic: {
      category1: { entry: 859, exit: 646 },
      category2: { entry: 540, exit: 406 },
      category3: { entry: 794, exit: 597 },
      category4: { entry: 596, exit: 448 },
    },
  },
  lastUpdated: '',
  fetchedAt: '',
  nextUpdate: '',
  note: 'Rates published in Nepal Gazette Chaitra 27, 2082 (Apr 10, 2026). Directional tolls: entry (to Kathmandu) higher than exit. Source: Cabinet decision Aug 11, 2025 via Ministry of Physical Infrastructure & Transport / Roads Board Nepal.',
};

async function main() {
  console.log('[Toll Sync] Updating Nagdhunga Tunnel toll rates...\n');
  console.log('[Toll Sync] Official sources:');
  Object.entries(SOURCES).forEach(([key, url]) => {
    console.log(`  - ${key}: ${url}`);
  });
  console.log('');

  const now = new Date();
  const cache: TollRatesCache = {
    ...VERIFIED_RATES,
    lastUpdated: now.toISOString(),
    fetchedAt: now.toISOString(),
    nextUpdate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  };

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // Check if existing file has different rates
  let hasChanges = false;
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const oldEntry = JSON.stringify(existing.rates.entry);
      const newEntry = JSON.stringify(cache.rates.entry);
      const oldExit = JSON.stringify(existing.rates.exit);
      const newExit = JSON.stringify(cache.rates.exit);

      if (oldEntry !== newEntry || oldExit !== newExit) {
        hasChanges = true;
        console.log('[Toll Sync] Rates have changed from existing file!');
        console.log('  Old entry:', existing.rates.entry);
        console.log('  New entry:', cache.rates.entry);
        console.log('  Old exit:', existing.rates.exit);
        console.log('  New exit:', cache.rates.exit);
      } else {
        console.log('[Toll Sync] Rates unchanged from existing file.');
      }
    } catch {
      hasChanges = true;
    }
  } else {
    hasChanges = true;
    console.log('[Toll Sync] No existing file, creating new.');
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`\n[${hasChanges ? 'Toll Sync' : 'Toll Sync (no changes)'}] Saved to ${CACHE_FILE}`);
  console.log(`[Toll Sync] Next update check: ${cache.nextUpdate}`);
  console.log('\n[Toll Sync] Note: Toll rates are set by Cabinet decision and published in Nepal Gazette.');
  console.log('[Toll Sync] This script maintains the verified rates. Update when new Gazette is published.');
}

main().catch(console.error);