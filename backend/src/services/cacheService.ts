import { Redis } from "@upstash/redis";
import { UPSTASH } from "@/config/index.js";
import { logInfo, logError } from "@logs/logs.js";

// Initialize Upstash Redis client if configured
export const redisClient = UPSTASH.REST_URL && UPSTASH.REST_TOKEN
  ? new Redis({
    url: UPSTASH.REST_URL,
    token: UPSTASH.REST_TOKEN,
  })
  : null;

// In-memory fallback cache
const memoryCache = new Map<string, { data: any; expires: number }>();
const MAX_MEMORY_ITEMS = 150; // Prevent heap exhaustion

/**
 * Core caching function used by controllers and services.
 */
export async function getCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  const now = Date.now();

  // 1. Try Redis if available
  if (redisClient) {
    try {
      const cached = await redisClient.get<T>(key);
      if (cached) return cached;
    } catch (err: any) {
      logError(`[Cache] Redis get failed for ${key}`, err.message);
    }
  }

  // 2. Try Memory Cache
  const mem = memoryCache.get(key);
  if (mem && mem.expires > now) {
    return mem.data;
  }

  // 3. Fetch fresh data
  const freshData = await fetcher();

  // Memory Guard: Prune the oldest entry if the cache is too large 
  // before adding a new (potentially large) GeoJSON or dataset.
  if (memoryCache.size >= MAX_MEMORY_ITEMS) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }

  // 4. Store in Memory
  memoryCache.set(key, {
    data: freshData,
    expires: now + ttlSeconds * 1000,
  });

  // 5. Store in Redis (Background)
  if (redisClient && freshData) {
    redisClient.set(key, freshData, { ex: ttlSeconds }).catch((err) => {
      logError(`[Cache] Redis set failed for ${key}`, err.message);
    });
  }

  return freshData;
}

/**
 * Wrapper for easier service integration.
 */
export const withCache = getCache;

/**
 * Clear specific cache keys.
 */
export async function clearCache(key: string): Promise<void> {
  memoryCache.delete(key);
  if (redisClient) {
    await redisClient.del(key).catch(() => { });
  }
  logInfo(`[Cache] Cleared: ${key}`);
}

/**
 * Clears all keys matching a specific pattern (glob)
 */
export async function clearCacheByPattern(pattern: string): Promise<void> {
  if (redisClient) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logInfo(`[Cache] Pattern '${pattern}' cleared. ${keys.length} keys removed.`);
      }
    } catch (err: any) {
      logError(`[Cache] Pattern clear failed for ${pattern}`, err.message);
    }
  }
  // Memory cache doesn't easily support patterns without iteration, 
  // which is fine as it's a secondary fallback.
}

/**
 * Retrieves all keys currently in cache that match a specific prefix.
 * Useful for administrative tools and debugging.
 */
export async function getCacheKeysByPrefix(prefix: string): Promise<string[]> {
  const keys = new Set<string>();

  // 1. Check L1 Memory Cache
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) keys.add(key);
  }

  // 2. Check Redis
  if (redisClient) {
    try {
      const redisKeys = await redisClient.keys(`${prefix}*`);
      redisKeys.forEach(k => keys.add(k));
    } catch (err: any) {
      logError(`[Cache] Prefix search failed for ${prefix}`, err.message);
    }
  }

  return Array.from(keys);
}

/**
 * Health and usage statistics for the Diagnostics script.
 */
export async function getCacheStats() {
  return {
    memoryKeys: memoryCache.size,
    usingRedis: !!redisClient,
  };
}

export async function getCacheHealth() {
  const status = redisClient ? "Active" : "Degraded (Memory Fallback)";
  return {
    status,
    l1_items: memoryCache.size,
    redis_connected: !!redisClient
  };
}

export async function getUpstashUsage() {
  if (!redisClient) return null;
  // Placeholder for Upstash usage API if needed
  return {
    limit: "Standard",
    status: "Active",
    usage_pct: 12 // Mock usage for reporting
  };
}