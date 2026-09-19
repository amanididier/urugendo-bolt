/**
 * In-memory client cache with TTL support for repeated read lookups
 * (e.g. branches catalog, agency metadata) to optimize navigation speed.
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Get cached item if it exists and has not expired.
 */
export function getCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Set cached item with TTL in milliseconds (default 30 seconds).
 */
export function setCache<T>(key: string, data: T, ttlMs: number = 30000): void {
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlMs,
  });
}

/**
 * Clear cached item by key or clear entire cache.
 */
export function clearCache(key?: string): void {
  if (key) {
    memoryCache.delete(key);
  } else {
    memoryCache.clear();
  }
}
