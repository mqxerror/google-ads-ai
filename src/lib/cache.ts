/**
 * Caching Utility
 * Provides in-memory caching with TTL and optional Redis backend
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheConfig {
  defaultTTL: number;  // Default TTL in milliseconds
  maxSize: number;     // Maximum number of entries
}

// In-memory cache store
const cacheStore = new Map<string, CacheEntry<unknown>>();

// Default configuration
const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000,  // 5 minutes
  maxSize: 1000,
};

// Cache TTL presets (in milliseconds)
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,        // 1 minute - for frequently changing data
  MEDIUM: 5 * 60 * 1000,       // 5 minutes - for campaign data
  LONG: 15 * 60 * 1000,        // 15 minutes - for account structure
  HOUR: 60 * 60 * 1000,        // 1 hour - for static data
  DAY: 24 * 60 * 60 * 1000,    // 24 hours - for rarely changing data
} as const;

/**
 * Generate a cache key from components
 */
export function createCacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join(':');
}

/**
 * Get item from cache
 */
export function getFromCache<T>(key: string): T | null {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set item in cache
 */
export function setInCache<T>(
  key: string,
  data: T,
  ttl: number = DEFAULT_CONFIG.defaultTTL
): void {
  // Enforce max size by removing oldest entries
  if (cacheStore.size >= DEFAULT_CONFIG.maxSize) {
    const oldestKey = findOldestEntry();
    if (oldestKey) {
      cacheStore.delete(oldestKey);
    }
  }

  const now = Date.now();
  cacheStore.set(key, {
    data,
    expiresAt: now + ttl,
    createdAt: now,
  });
}

/**
 * Delete item from cache
 */
export function deleteFromCache(key: string): boolean {
  return cacheStore.delete(key);
}

/**
 * Delete all items matching a pattern (prefix)
 */
export function deleteByPattern(pattern: string): number {
  let deleted = 0;
  for (const key of cacheStore.keys()) {
    if (key.startsWith(pattern)) {
      cacheStore.delete(key);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Invalidate cache for a specific account
 */
export function invalidateAccountCache(accountId: string): number {
  return deleteByPattern(`campaigns:${accountId}`);
}

/**
 * Get or set pattern - fetch from cache or execute function and cache result
 */
export async function getOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_CONFIG.defaultTTL
): Promise<T> {
  // Try to get from cache first
  const cached = getFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Cache the result
  setInCache(key, data, ttl);

  return data;
}

/**
 * Find the oldest cache entry
 */
function findOldestEntry(): string | null {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of cacheStore.entries()) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestKey = key;
    }
  }

  return oldestKey;
}

/**
 * Cleanup expired entries
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of cacheStore.entries()) {
    if (now > entry.expiresAt) {
      cacheStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate?: number;
} {
  return {
    size: cacheStore.size,
    maxSize: DEFAULT_CONFIG.maxSize,
  };
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  cacheStore.clear();
}

// Schedule cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cleanupExpiredEntries(), 5 * 60 * 1000);
}

/**
 * Stale-while-revalidate pattern
 * Returns cached data immediately (even if stale) while refreshing in background
 */
export async function getStaleWhileRevalidate<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_CONFIG.defaultTTL,
  staleTime: number = ttl * 2 // How long stale data is acceptable
): Promise<T> {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (entry) {
    // Check if within stale window
    const staleUntil = entry.createdAt + staleTime;

    if (now < entry.expiresAt) {
      // Still fresh, return immediately
      return entry.data;
    } else if (now < staleUntil) {
      // Stale but acceptable - return stale data and refresh in background
      refreshInBackground(key, fetchFn, ttl);
      return entry.data;
    }
  }

  // No cache or too stale - fetch fresh
  const data = await fetchFn();
  setInCache(key, data, ttl);
  return data;
}

/**
 * Refresh cache in background (fire and forget)
 */
function refreshInBackground<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number
): void {
  // Mark as refreshing to prevent duplicate refreshes
  const refreshKey = `refreshing:${key}`;
  if (getFromCache<boolean>(refreshKey)) {
    return;
  }
  setInCache(refreshKey, true, 30000); // 30 second lock

  fetchFn()
    .then((data) => {
      setInCache(key, data, ttl);
    })
    .catch((error) => {
      console.error(`Background refresh failed for ${key}:`, error);
    })
    .finally(() => {
      deleteFromCache(refreshKey);
    });
}
