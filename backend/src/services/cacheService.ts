// backend/src/services/cacheService.ts
import { Redis } from "@upstash/redis";
import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import { UPSTASH } from "../config/index.js";
import {
  logInfo,
  logError,
  logCacheHit,
  logCacheMiss,
  logCacheUpdate,
} from "../logs/logs.js";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ────────────────────────────────
// LEVEL 1: Local RAM cache
// ────────────────────────────────
const localCache = new Map<string, { value: any; expiry: number }>();

// ────────────────────────────────
// Circuit breaker for Redis
// ────────────────────────────────
let isRedisDisabled = false;
let disableTime = 0;
const DISABLE_DURATION = 60 * 60 * 1000; // 1 hour

// ────────────────────────────────
// Size limit for Redis
// ⚠️ Upstash free tier HARD LIMIT: 10MB PER REQUEST
// Values exceeding this will return errors even if total storage is available
// Use compression for larger values
// ────────────────────────────────
const REDIS_MAX_SIZE_BYTES = 9.5 * 1024 * 1024; // 9.5MB (safe buffer under 10MB limit)
const REDIS_COMPRESSION_THRESHOLD = 1 * 1024 * 1024; // 1MB - compress values larger than this

// ────────────────────────────────
// Max age cap for disk cache (prevent stale data)
// Even if TTL says 1h, disk cache won't serve data older than this
// ────────────────────────────────
const DISK_CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

// ────────────────────────────────
// LEVEL 2: Upstash Redis
// ────────────────────────────────
let _redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!_redisClient) {
    // Use the exported config values which are already loaded
    const url = UPSTASH.REST_URL;
    const token = UPSTASH.REST_TOKEN;

    if (!url || !token) {
      logInfo(`[Cache] Redis not configured - using L1 (RAM) + Disk cache only`);
      return null;
    }

    try {
      _redisClient = new Redis({
        url,
        token,
      });
    } catch (err: any) {
      logError(`[Cache] Failed to initialize Redis client: ${err.message}`);
      return null;
    }
  }
  return _redisClient;
}

export const redisClient = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedisClient();
    if (!client) {
      return async () => null;
    }
    return (client as any)[prop];
  }
});

// ────────────────────────────────
// LEVEL 3: Disk Cache
// ────────────────────────────────
async function readDiskCache<T>(filePath: string, now: number): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const entry = JSON.parse(raw) as { value: T; expireAt: number; createdAt?: number };

    // Check if expired by original TTL
    if (entry.expireAt <= now) return null;

    // Check max-age cap (prevent stale data from lingering on disk)
    // For old caches without createdAt, use expireAt - ttl as proxy
    const cacheAge = now - (entry.createdAt ?? (entry.expireAt - 3600 * 1000)); // assume 1h TTL fallback
    if (cacheAge > DISK_CACHE_MAX_AGE_MS) {
      logInfo(`[Cache] Disk cache exceeded max-age cap (${(cacheAge / 3600000).toFixed(1)}h), treating as expired: ${path.basename(filePath)}`);
      return null;
    }

    return entry.value;
  } catch { }
  return null;
}

async function writeDiskCache<T>(filePath: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    const entry = {
      value,
      expireAt: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now()
    };
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
    logInfo(`[Cache] Disk saved: ${path.basename(filePath)}`);
  } catch (err: any) {
    logError(`[Cache] Failed to save disk cache: ${path.basename(filePath)}`, err.message);
  }
}

// ────────────────────────────────
// Hybrid Cache Wrapper
// ────────────────────────────────
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 3600,
  diskPath?: string
): Promise<T> {
  const now = Date.now();

  if (isRedisDisabled && now - disableTime > DISABLE_DURATION) {
    isRedisDisabled = false;
    logInfo("🔄 [Cache] Redis circuit breaker reset");
  }

  // L1: Local
  const local = localCache.get(key);
  if (local && local.expiry > now) {
    logCacheHit("L1", key);
    return local.value as T;
  }

  // L2: Redis
  if (!isRedisDisabled) {
    try {
      const cached = await redisClient.get<string | Buffer>(key);
      if (cached !== null) {
        logCacheHit("L2", key);
        
        let value: T;
        if (typeof cached === 'string' && cached.startsWith('gzip:')) {
          // Decompress gzipped value
          const compressed = Buffer.from(cached.slice(5), 'base64');
          const decompressed = await gunzip(compressed);
          value = JSON.parse(decompressed.toString('utf8'));
        } else {
          value = cached as T;
        }
        
        localCache.set(key, { value, expiry: now + ttlSeconds * 1000 });
        return value;
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

  // L3: Disk
  if (diskPath) {
    const diskValue = await readDiskCache<T>(diskPath, now);
    if (diskValue !== null) {
      logCacheHit("Disk", key);
      localCache.set(key, { value: diskValue, expiry: now + ttlSeconds * 1000 });
      return diskValue;
    }
  }

  // L4: Source
  logCacheMiss(key);
  const fresh = await fetcher();

  localCache.set(key, { value: fresh, expiry: now + ttlSeconds * 1000 });

  // Store in Redis only if data is small enough
  if (!isRedisDisabled) {
    try {
      const serialized = JSON.stringify(fresh);
      let dataToStore: string | T = fresh;
      let sizeBytes = Buffer.byteLength(serialized, "utf8");
      
      // Compress if above threshold
      if (sizeBytes > REDIS_COMPRESSION_THRESHOLD) {
        const compressed = await gzip(serialized, { level: 6 });
        dataToStore = `gzip:${compressed.toString('base64')}`;
        sizeBytes = Buffer.byteLength(dataToStore as string, "utf8");
        logInfo(`[Cache] Compressed ${key}: ${(Buffer.byteLength(serialized) / 1024 / 1024).toFixed(2)}MB → ${(sizeBytes / 1024 / 1024).toFixed(2)}MB (${Math.round((1 - sizeBytes / Buffer.byteLength(serialized)) * 100)}% reduction)`);
      }
      
      if (sizeBytes > REDIS_MAX_SIZE_BYTES) {
        logInfo(`⚠️ [Cache] Skipping Redis for large key: ${key} (${(sizeBytes / 1024 / 1024).toFixed(2)}MB exceeds 9.5MB Upstash limit)`);
      } else {
        await redisClient.set(key, dataToStore, { ex: ttlSeconds });
        logCacheUpdate(key);
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("limit") || err.message?.toLowerCase().includes("size")) {
        logError("⚠️ [Cache] Redis size limit hit - large data will use L1 + Disk only", { key, error: err.message });
      } else {
        logError("❌ [Cache] Failed to update Redis", { error: err.message });
      }
    }
  }

  if (diskPath) await writeDiskCache(diskPath, fresh, ttlSeconds);

  return fresh;
}

// Cache stats
export const getCacheStats = () => ({
  status: isRedisDisabled ? "DEGRADED (L1 + Disk)" : "HEALTHY (L1 + L2 + Disk)",
  l1_items: localCache.size,
  l2_items: isRedisDisabled ? 0 : "available (async)",
  circuit_breaker: isRedisDisabled,
  timestamp: new Date().toISOString(),
});

export const getCacheHealth = getCacheStats;

export const getUpstashUsage = async (): Promise<null> => {
  // Upstash admin API not configured - only REST URL and token are used
  return null;
};

export const clearCache = async (key?: string | string[], diskPath?: string) => {
  try {
    if (key) {
      const keyStr = Array.isArray(key) ? key[0] : key;
      localCache.delete(keyStr);
      if (!isRedisDisabled) await redisClient.del(keyStr);
      if (diskPath) await fs.unlink(diskPath).catch(() => { });
      logInfo(`🧹 [Cache] Cleared key: ${keyStr}`);
    } else {
      localCache.clear();
      if (!isRedisDisabled) await redisClient.flushdb();
      logInfo("🧹 [Cache] Global cache cleared");
      if (diskPath) await fs.unlink(diskPath).catch(() => { });
    }
  } catch (err: any) {
    logError("❌ [Cache] Clear failed", { error: err.message });
  }
};

// Alias
export const getCache = withCache;
