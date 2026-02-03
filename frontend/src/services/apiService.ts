// 🔗 Updated relative import to point to your config file
import { APP_CONFIG } from "../config/config";

const CACHE_PREFIX = 'sadaksathi_v1_cache_';
const API_VERSION = '/api';
const DEFAULT_TTL = 1000 * 60 * 60 * 6; // 6 hours default for maps

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // 1. Normalize endpoint (ensure it starts with /)
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // 2. Add /api prefix if not already present
  const apiPath = cleanEndpoint.startsWith('/api') ? cleanEndpoint : `/api${cleanEndpoint}`;
  
  // 3. Construct final URL (prevent double /api if base_url also contains it)
  const baseUrl = APP_CONFIG.apiBaseUrl || "";
  const url = baseUrl.endsWith('/api') && apiPath.startsWith('/api')
    ? `${baseUrl}${apiPath.replace('/api', '')}`
    : `${baseUrl}${apiPath}`;
  const cacheKey = `${CACHE_PREFIX}${endpoint}`;

  const getCachedData = (): T | null => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      
      // If it's a "live" request and we are online, check TTL
      const isStale = Date.now() - entry.timestamp > (APP_CONFIG.map?.offline?.cacheMaxAge || DEFAULT_TTL);
      if (typeof navigator !== 'undefined' && navigator.onLine && isStale) {
        return null; // Return null to force a refresh if online and stale
      }
      return entry.data;
    } catch {
      return null;
    }
  };

  // 1. Try Cache First (if offline or just looking for quick load)
  const cached = getCachedData();
  if (cached && typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log(`[Cache] Serving offline data for ${endpoint}`);
    return cached;
  }

  try {
    // 2. Network Request with Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      ...options,
      headers: { 'Accept': 'application/json', ...options?.headers },
      mode: APP_CONFIG.apiBaseUrl.startsWith('http') ? 'cors' : 'same-origin',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    const data = result && typeof result === 'object' && 'data' in result ? result.data : result;
    
    // 2. Update Cache
    try {
      const entry: CacheEntry<T> = { timestamp: Date.now(), data };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (e) {
      console.warn("[Cache] Storage issue:", e);
    }

    return data;
  } catch (error: any) {
    // 3. Last resort fallback to ANY cache (even if stale) if network fails
    const lastResort = localStorage.getItem(cacheKey);
    if (lastResort) {
      console.warn(`[Cache] Network failed, using fallback for ${endpoint}`);
      return JSON.parse(lastResort).data;
    }
    throw error;
  }
}