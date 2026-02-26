import IORedis from 'ioredis';
import { config } from '../config.js';

// ── Client setup ──────────────────────────────────────────────────────────────

/**
 * Shared IORedis client.
 *
 * - maxRetriesPerRequest: null disables the default retry limit so the client
 *   keeps trying (important for cron jobs that run long after startup).
 * - enableOfflineQueue: true means commands issued while Redis is down are
 *   queued and replayed once the connection is restored.
 * - lazyConnect: true prevents an immediate connection attempt on module load —
 *   the connection is established on the first command.
 */
export const redisClient = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,
});

redisClient.on('connect', () => console.info('[Redis] Connected'));
redisClient.on('error', (err: Error) =>
  console.error('[Redis] Error:', err.message),
);
redisClient.on('reconnecting', () => console.warn('[Redis] Reconnecting…'));

// ── Cache TTL ─────────────────────────────────────────────────────────────────

/**
 * Default cache TTL in seconds.
 * Sourced from config (env var CACHE_TTL, default 6 hours = 21600 s).
 */
export const CACHE_TTL: number = config.cacheTtl;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get a JSON-deserialized value from the cache.
 * Returns null if the key doesn't exist or if Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('[Redis] cacheGet error (non-fatal):', (err as Error).message);
    return null;
  }
}

/**
 * Store a JSON-serialized value in the cache with the default TTL.
 * Silently swallows Redis errors so the API stays up if Redis is down.
 */
export async function cacheSet(key: string, value: unknown, ttl = CACHE_TTL): Promise<void> {
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.warn('[Redis] cacheSet error (non-fatal):', (err as Error).message);
  }
}

/**
 * Delete one or more keys from the cache.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redisClient.del(keys);
  } catch (err) {
    console.warn('[Redis] cacheDel error (non-fatal):', (err as Error).message);
  }
}
