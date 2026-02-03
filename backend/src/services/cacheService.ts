import { Redis } from "@upstash/redis";
import { UPSTASH } from "../config/index.js";
import {
  logInfo,
  logError,
  logCacheHit,
  logCacheMiss,
  logCacheUpdate
} from "../logs/logs.js";

// ────────────────────────────────
// LEVEL 1: In-Process Local RAM Cache
// ────────────────────────────────
const localCache = new Map<string, { value: any; expiry: number }>();

// ────────────────────────────────
// Circuit Breaker (Upstash protection)
// ────────────────────────────────
let isRedisDisabled = false;
let disableTime = 0;
const DISABLE_DURATION = 60 * 60 * 1000; // 1 hour

// ────────────────────────────────
// LEVEL 2: Upstash Redis
// ────────────────────────────────
export const redisClient = Redis.fromEnv();

/**
 * Hybrid Cache Wrapper
 * L1 → L2 → SOURCE
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  const now = Date.now();

  // Reset breaker if cooldown passed
  if (isRedisDisabled && now - disableTime > DISABLE_DURATION) {
    isRedisDisabled = false;
    logInfo("🔄 [Cache] Redis circuit breaker reset");
  }

  // L1: LOCAL RAM
  const local = localCache.get(key);
  if (local && local.expiry > now) {
    logCacheHit("L1", key);
    return local.value as T;
  }

  // L2: REDIS
  if (!isRedisDisabled) {
    try {
      const cached = await redisClient.get<T>(key);
      if (cached !== null) {
        logCacheHit("L2", key);
        localCache.set(key, { value: cached, expiry: now + ttlSeconds * 1000 });
        return cached;
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("limit")) {
        isRedisDisabled = true;
        disableTime = now;
        logError("⚠️ [Cache] Upstash limit hit → disabling Redis temporarily");
      } else {
        logError("❌ [Cache] Redis error", { error: err.message });
      }
    }
  }

  // L3: SOURCE
  logCacheMiss(key);
  const fresh = await fetcher();

  // Update L1
  localCache.set(key, { value: fresh, expiry: now + ttlSeconds * 1000 });

  // Update L2
  if (!isRedisDisabled) {
    try {
      await redisClient.set(key, fresh, { ex: ttlSeconds });
      logCacheUpdate(key);
    } catch (err: any) {
      logError("❌ [Cache] Failed to update Redis", { error: err.message });
    }
  }

  return fresh;
}

/**
 * Cache Health (Admin / Health APIs)
 */
export const getCacheStats = async () => {
  let l2Count = 0;

  if (!isRedisDisabled) {
    try {
      const [, keys] = await redisClient.scan(0, { match: "*", count: 100 });
      l2Count = keys.length;
    } catch {
      l2Count = -1;
    }
  }

  return {
    status: isRedisDisabled ? "DEGRADED (L1 ONLY)" : "HEALTHY (L1 + L2)",
    l1_items: localCache.size,
    l2_items: l2Count,
    circuit_breaker: {
      active: isRedisDisabled,
      cooldown_remaining: isRedisDisabled
        ? `${Math.ceil((DISABLE_DURATION - (Date.now() - disableTime)) / 60000)}m`
        : "0m"
    },
    timestamp: new Date().toISOString()
  };
};

// Alias for health endpoints
export const getCacheHealth = getCacheStats;

// ────────────────────────────────
// Upstash Usage (Admin)
// ────────────────────────────────
export const getUpstashUsage = async () => {
  try {
    if (!UPSTASH.ADMIN_KEY || !UPSTASH.DB_ID) return null;

    const auth = Buffer.from(`EMAIL:${UPSTASH.ADMIN_KEY}`).toString("base64");
    const res = await fetch(`https://api.upstash.com/v2/redis/stats/${UPSTASH.DB_ID}`, {
      headers: { Authorization: `Basic ${auth}` }
    });

    return await res.json();
  } catch (err: any) {
    logError("❌ [Admin] Failed to fetch Upstash stats", { error: err.message });
    return null;
  }
};

// ────────────────────────────────
// Cache Purge
// ────────────────────────────────
export const clearCache = async (key?: string) => {
  try {
    if (key) {
      localCache.delete(key);
      await redisClient.del(key);
      logInfo(`🧹 [Cache] Cleared key: ${key}`);
    } else {
      localCache.clear();
      await redisClient.flushdb();
      logInfo("🧹 [Cache] Global cache cleared");
    }
  } catch (err: any) {
    logError("❌ [Cache] Clear failed", { error: err.message });
  }
};

// Build-safe alias for other services
export const getCache = withCache;
