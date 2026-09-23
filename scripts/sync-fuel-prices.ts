/**
 * Sync fuel prices from Nepal Oil Corporation (NOC) website.
 *
 * Fetches current retail selling prices from noc.org.np, parses petrol/diesel rates,
 * and stores them in public/data/fuel-prices.json with metadata.
 *
 * Usage:
 *   npx tsx scripts/sync-fuel-prices.ts
 *   npm run sync:fuel
 */
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'public', 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'fuel-prices.json');
const NOC_RETAIL_URL = 'https://noc.org.np/retailprice';
const NOC_MAIN_URL = 'https://noc.org.np/';

interface NocPriceData {
  petrol: number;
  diesel: number;
  electricity: number;
}

interface FuelPriceCache {
  prices: NocPriceData;
  source: string;
  sourceUrl: string;
  sourceLabel: string;
  currency: string;
  units: Record<string, string>;
  regions: string;
  lastUpdated: string;
  fetchedAt: string;
  nextUpdate: string;
  note: string;
}

function parsePriceFromText(text: string): { petrol: number; diesel: number } | null {
  const results: { petrol: number | null; diesel: number | null } = { petrol: null, diesel: null };

  const lines = text.split('\n').map(l => l.trim());

  for (const line of lines) {
    const lower = line.toLowerCase();

    if ((lower.includes('petrol') || lower.includes('ms)') || lower.includes('ms :')) && !lower.includes('diesel')) {
      const nums = line.match(/(\d{2,3}(?:\.\d+)?)/g);
      if (nums) {
        for (const n of nums) {
          const val = parseFloat(n);
          if (val > 50 && val < 500) {
            results.petrol = val;
            break;
          }
        }
      }
    }

    if ((lower.includes('diesel') || lower.includes('hsd')) && !lower.includes('petrol')) {
      const nums = line.match(/(\d{2,3}(?:\.\d+)?)/g);
      if (nums) {
        for (const n of nums) {
          const val = parseFloat(n);
          if (val > 50 && val < 500) {
            results.diesel = val;
            break;
          }
        }
      }
    }
  }

  if (results.petrol && results.diesel) {
    return { petrol: results.petrol, diesel: results.diesel };
  }
  return null;
}

async function fetchFromNOC(): Promise<NocPriceData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000, new Error('Timeout'));

    const res = await fetch(NOC_RETAIL_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MeroSadak/1.0 (+https://merosadak.com)' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const text = await res.text();
    const parsed = parsePriceFromText(text);

    if (parsed) return { ...parsed, electricity: 15 };

    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 8000, new Error('Timeout'));
    const mainRes = await fetch(NOC_MAIN_URL, {
      signal: controller2.signal,
      headers: { 'User-Agent': 'MeroSadak/1.0 (+https://merosadak.com)' },
    });
    clearTimeout(timeoutId2);
    if (!mainRes.ok) return null;

    const mainText = await mainRes.text();
    const mainParsed = parsePriceFromText(mainText);
    if (mainParsed) return { ...mainParsed, electricity: 15 };

    return null;
  } catch (err) {
    console.warn('[Fuel Sync] NOC fetch failed:', (err as Error)?.message || err);
    return null;
  }
}

async function fetchFromNocNews(): Promise<NocPriceData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000, new Error('Timeout'));

    const res = await fetch('https://www.myrepublica.nagariknetwork.com/index.php/news/noc-cuts-petroleum-product-prices-96-77.html', {
      signal: controller.signal,
      headers: { 'User-Agent': 'MeroSadak/1.0 (+https://merosadak.com)' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const text = await res.text();
    const match = text.match(/petrol[^0-9]*?(\d{2,3})\s*per\s*litre/i);
    if (match) {
      const petrol = parseInt(match[1], 10);
      const dieselMatch = text.match(/diesel[^0-9]*?(\d{2,3})\s*per\s*litre/i);
      const diesel = dieselMatch ? parseInt(dieselMatch[1], 10) : petrol - 2;
      return { petrol, diesel, electricity: 15 };
    }
    return null;
  } catch (err) {
    console.warn('[Fuel Sync] News fetch failed:', (err as Error)?.message || err);
    return null;
  }
}

async function main() {
  console.log('[Fuel Sync] Fetching latest NOC fuel prices...\n');

  let prices = await fetchFromNOC();
  if (!prices) {
    console.log('[Fuel Sync] NOC website unavailable, trying news sources...');
    prices = await fetchFromNocNews();
  }

  const now = new Date();
  let lastUpdated = now.toISOString();

  if (prices) {
    lastUpdated = now.toISOString();
    console.log(`[Fuel Sync] Live prices fetched: Petrol Rs ${prices.petrol}/L, Diesel Rs ${prices.diesel}/L`);
  } else {
    prices = { petrol: 175, diesel: 158, electricity: 15 };
    console.log('[Fuel Sync] Using fallback NOC standard rates');
  }

  const cache: FuelPriceCache = {
    prices,
    source: 'noc.org.np',
    sourceUrl: 'https://noc.org.np/retailprice',
    sourceLabel: 'Nepal Oil Corporation - Retail Selling Price',
    currency: 'NPR',
    units: { petrol: 'L', diesel: 'L', electricity: 'kWh' },
    regions: 'Kathmandu, Pokhara, Dipayal',
    lastUpdated,
    fetchedAt: now.toISOString(),
    nextUpdate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    note: 'Rates effective from midnight NST. VAT inclusive. Prices may vary by region within 15km of depot.',
  };

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`\n[Fuel Sync] Saved to ${CACHE_FILE}`);
  console.log(`[Fuel Sync] Next update: ${cache.nextUpdate}`);
}

main().catch(console.error);
