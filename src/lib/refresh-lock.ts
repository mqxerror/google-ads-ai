/**
 * Production-Grade Refresh Lock Service
 *
 * Prevents duplicate background refreshes with:
 * - Unique owner tokens (only owner can release)
 * - TTL-based expiry (no deadlocks)
 * - Observability metrics
 * - Rate limit backoff tracking
 * - Multi-instance safe design (in-memory for now, Redis-ready interface)
 */

import crypto from 'crypto';

interface LockEntry {
  owner: string;      // Unique token - only owner can release
  expiresAt: number;
  startedAt: number;
  key: string;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  staleRefreshes: number;
  lockContentions: number;
  throttleEvents: number;
  backgroundRefreshes: number;
  backgroundRefreshErrors: number;
}

// In-memory stores (Redis-ready interface for future upgrade)
const locks = new Map<string, LockEntry>();
const backoffUntil = new Map<string, number>();

// Metrics counters
const metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  staleRefreshes: 0,
  lockContentions: 0,
  throttleEvents: 0,
  backgroundRefreshes: 0,
  backgroundRefreshErrors: 0,
};

// TTL Constants
const DEFAULT_LOCK_TTL = 2 * 60 * 1000;  // 2 minutes for lock
const GLOBAL_BACKOFF_KEY = '__GLOBAL_RATE_LIMIT__';

/**
 * Generate a unique owner token for lock ownership
 */
function generateOwnerToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash a string for compact cache key representation
 */
function hashString(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 8);
}

/**
 * Generate a comprehensive cache key including all relevant params
 */
export function createCacheKey(params: {
  customerId: string;
  entityType: string;
  entityId?: string;
  parentEntityId?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  filters?: Record<string, unknown>;
  columns?: string[];
}): string {
  const parts = [
    params.customerId,
    params.entityType,
  ];

  if (params.entityId) parts.push(`e:${params.entityId}`);
  if (params.parentEntityId) parts.push(`p:${params.parentEntityId}`);
  if (params.startDate && params.endDate) {
    parts.push(`d:${params.startDate}_${params.endDate}`);
  }
  if (params.timezone) parts.push(`tz:${params.timezone}`);
  if (params.filters && Object.keys(params.filters).length > 0) {
    parts.push(`f:${hashString(JSON.stringify(params.filters))}`);
  }
  if (params.columns && params.columns.length > 0) {
    parts.push(`c:${hashString(params.columns.sort().join(','))}`);
  }

  return parts.join(':');
}

/**
 * Simplified key generator for backward compatibility
 */
export function createRefreshKey(
  customerId: string,
  entityType: string,
  parentEntityId?: string,
  startDate?: string,
  endDate?: string
): string {
  return createCacheKey({
    customerId,
    entityType,
    parentEntityId,
    startDate,
    endDate,
  });
}

/**
 * Try to acquire a lock for background refresh
 * Returns owner token if acquired, null if already locked
 */
export function tryAcquireLock(key: string, ttlMs: number = DEFAULT_LOCK_TTL): string | null {
  // Clean up expired locks
  cleanupExpiredLocks();

  // Check global backoff (rate limit protection)
  const globalBackoff = backoffUntil.get(GLOBAL_BACKOFF_KEY);
  if (globalBackoff && Date.now() < globalBackoff) {
    console.log(`[Lock] Global rate limit backoff active until ${new Date(globalBackoff).toISOString()}`);
    metrics.throttleEvents++;
    return null;
  }

  // Check key-specific backoff
  const keyBackoff = backoffUntil.get(key);
  if (keyBackoff && Date.now() < keyBackoff) {
    console.log(`[Lock] Key ${key} in backoff until ${new Date(keyBackoff).toISOString()}`);
    return null;
  }

  // Check existing lock
  const existing = locks.get(key);
  if (existing && Date.now() < existing.expiresAt) {
    console.log(`[Lock] Refresh already in progress for ${key} (owner: ${existing.owner.slice(0, 8)}...)`);
    metrics.lockContentions++;
    return null;
  }

  // Acquire lock with unique owner token
  const owner = generateOwnerToken();
  locks.set(key, {
    owner,
    expiresAt: Date.now() + ttlMs,
    startedAt: Date.now(),
    key,
  });

  console.log(`[Lock] Acquired lock for ${key} (owner: ${owner.slice(0, 8)}...)`);
  metrics.backgroundRefreshes++;
  return owner;
}

/**
 * Release a lock - only if caller owns it
 */
export function releaseLock(key: string, owner: string): boolean {
  const lock = locks.get(key);

  if (!lock) {
    console.log(`[Lock] Attempted to release non-existent lock: ${key}`);
    return false;
  }

  if (lock.owner !== owner) {
    console.log(`[Lock] Attempted to release lock with wrong owner: ${key}`);
    return false;
  }

  locks.delete(key);
  console.log(`[Lock] Released lock for ${key}`);
  return true;
}

/**
 * Force release a lock (for cleanup/admin purposes only)
 */
export function forceReleaseLock(key: string): void {
  locks.delete(key);
  console.log(`[Lock] Force released lock for ${key}`);
}

/**
 * Set backoff for a key after rate limit error
 */
export function setBackoff(key: string, seconds: number, isGlobal: boolean = false): void {
  const until = Date.now() + (seconds * 1000);

  if (isGlobal) {
    backoffUntil.set(GLOBAL_BACKOFF_KEY, until);
    console.log(`[Lock] Set GLOBAL backoff until ${new Date(until).toISOString()}`);
    metrics.throttleEvents++;
  } else {
    backoffUntil.set(key, until);
    console.log(`[Lock] Set backoff for ${key} until ${new Date(until).toISOString()}`);
  }
}

/**
 * Check if a refresh is currently in progress for a key
 */
export function isRefreshing(key: string): boolean {
  const lock = locks.get(key);
  return lock !== undefined && Date.now() < lock.expiresAt;
}

/**
 * Get the age of the current refresh (if any)
 */
export function getRefreshAge(key: string): number | null {
  const lock = locks.get(key);
  if (!lock || Date.now() >= lock.expiresAt) return null;
  return Date.now() - lock.startedAt;
}

/**
 * Check if we're in backoff for a key or globally
 */
export function isInBackoff(key?: string): boolean {
  const now = Date.now();

  // Check global backoff
  const globalBackoff = backoffUntil.get(GLOBAL_BACKOFF_KEY);
  if (globalBackoff && now < globalBackoff) return true;

  // Check key-specific backoff
  if (key) {
    const keyBackoff = backoffUntil.get(key);
    if (keyBackoff && now < keyBackoff) return true;
  }

  return false;
}

/**
 * Clean up expired locks and backoffs
 */
function cleanupExpiredLocks(): void {
  const now = Date.now();
  for (const [key, lock] of locks.entries()) {
    if (now >= lock.expiresAt) {
      locks.delete(key);
      console.log(`[Lock] Auto-expired stale lock: ${key}`);
    }
  }
  for (const [key, until] of backoffUntil.entries()) {
    if (now >= until) {
      backoffUntil.delete(key);
    }
  }
}

// ============================================
// Observability / Metrics
// ============================================

/**
 * Record a cache hit
 */
export function recordCacheHit(): void {
  metrics.hits++;
}

/**
 * Record a cache miss
 */
export function recordCacheMiss(): void {
  metrics.misses++;
}

/**
 * Record a stale refresh trigger
 */
export function recordStaleRefresh(): void {
  metrics.staleRefreshes++;
}

/**
 * Record a background refresh error
 */
export function recordRefreshError(): void {
  metrics.backgroundRefreshErrors++;
}

/**
 * Get current metrics snapshot
 */
export function getMetrics(): CacheMetrics & { activeLocks: number; activeBackoffs: number } {
  cleanupExpiredLocks();
  return {
    ...metrics,
    activeLocks: locks.size,
    activeBackoffs: backoffUntil.size,
  };
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.staleRefreshes = 0;
  metrics.lockContentions = 0;
  metrics.throttleEvents = 0;
  metrics.backgroundRefreshes = 0;
  metrics.backgroundRefreshErrors = 0;
}

/**
 * Get detailed lock status for debugging
 */
export function getLockStatus(): {
  locks: Array<{ key: string; owner: string; age: number; expiresIn: number }>;
  backoffs: Array<{ key: string; expiresIn: number }>;
  metrics: CacheMetrics;
} {
  cleanupExpiredLocks();
  const now = Date.now();

  return {
    locks: Array.from(locks.values()).map(lock => ({
      key: lock.key,
      owner: lock.owner.slice(0, 8) + '...',
      age: now - lock.startedAt,
      expiresIn: lock.expiresAt - now,
    })),
    backoffs: Array.from(backoffUntil.entries()).map(([key, until]) => ({
      key,
      expiresIn: until - now,
    })),
    metrics,
  };
}

// ============================================
// TTL Constants Export (for route configuration)
// ============================================

export const CACHE_TTL = {
  FRESH: 5 * 60 * 1000,        // 5 minutes - super fresh, no refresh
  STALE: 24 * 60 * 60 * 1000,  // 24 hours - still usable, trigger background refresh
  EXPIRED: 7 * 24 * 60 * 60 * 1000, // 7 days - hard expiry, force refresh
};

// ============================================
// Blocking Fetch Protection
// ============================================

// Track blocking fetches to prevent traffic spikes from hammering quota
const blockingFetchLocks = new Map<string, number>();
const BLOCKING_FETCH_COOLDOWN = 60 * 1000; // 1 minute between blocking fetches per key
const BLOCKING_FETCH_TIMEOUT = 12000; // 12 second hard timeout

/**
 * Check if we can perform a blocking fetch for this key
 * Returns true if allowed, false if throttled
 */
export function canBlockingFetch(key: string): boolean {
  const lastFetch = blockingFetchLocks.get(key);
  if (!lastFetch) return true;

  const elapsed = Date.now() - lastFetch;
  if (elapsed >= BLOCKING_FETCH_COOLDOWN) {
    return true;
  }

  console.log(`[BlockingFetch] Throttled: ${key} (${Math.round((BLOCKING_FETCH_COOLDOWN - elapsed) / 1000)}s remaining)`);
  return false;
}

/**
 * Mark that a blocking fetch is starting for this key
 */
export function startBlockingFetch(key: string): void {
  blockingFetchLocks.set(key, Date.now());
}

/**
 * Get the blocking fetch timeout in milliseconds
 */
export function getBlockingFetchTimeout(): number {
  return BLOCKING_FETCH_TIMEOUT;
}

/**
 * Wrapper for blocking fetch with timeout protection
 * Returns the result or throws with a user-friendly error
 */
export async function withBlockingFetchTimeout<T>(
  key: string,
  fetchFn: () => Promise<T>,
  customTimeout?: number
): Promise<T> {
  const timeout = customTimeout || BLOCKING_FETCH_TIMEOUT;

  // Check throttle first
  if (!canBlockingFetch(key)) {
    throw new Error('THROTTLED: Too many requests. Please wait a moment and try again.');
  }

  // Mark fetch started
  startBlockingFetch(key);

  // Race against timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('TIMEOUT: Google Ads is responding slowly. Please try again in a moment.'));
    }, timeout);
  });

  try {
    return await Promise.race([fetchFn(), timeoutPromise]);
  } catch (error) {
    // Clear the lock on error so user can retry
    blockingFetchLocks.delete(key);
    throw error;
  }
}

/**
 * Get blocking fetch status for debugging
 */
export function getBlockingFetchStatus(): Array<{ key: string; cooldownRemaining: number }> {
  const now = Date.now();
  const result: Array<{ key: string; cooldownRemaining: number }> = [];

  for (const [key, timestamp] of blockingFetchLocks.entries()) {
    const remaining = BLOCKING_FETCH_COOLDOWN - (now - timestamp);
    if (remaining > 0) {
      result.push({ key, cooldownRemaining: remaining });
    } else {
      blockingFetchLocks.delete(key);
    }
  }

  return result;
}

// ============================================
// Cache Inspector Helpers
// ============================================

export interface CacheInspectorResult {
  key: string;
  exists: boolean;
  age: number | null;
  state: 'fresh' | 'stale' | 'expired' | 'missing';
  lastUpdatedAt: string | null;
  refreshRunning: boolean;
  refreshAge: number | null;
  inBackoff: boolean;
  backoffRemaining: number | null;
  blockingFetchThrottled: boolean;
  blockingFetchCooldown: number | null;
}

/**
 * Inspect cache state for a given key
 * Note: This requires the caller to pass in cache data from DB
 */
export function inspectCacheKey(
  key: string,
  cacheData?: { updatedAt: Date } | null
): CacheInspectorResult {
  const now = Date.now();

  // Calculate age and state from DB cache data
  let age: number | null = null;
  let state: 'fresh' | 'stale' | 'expired' | 'missing' = 'missing';
  let lastUpdatedAt: string | null = null;

  if (cacheData) {
    age = now - cacheData.updatedAt.getTime();
    lastUpdatedAt = cacheData.updatedAt.toISOString();

    if (age < CACHE_TTL.FRESH) {
      state = 'fresh';
    } else if (age < CACHE_TTL.STALE) {
      state = 'stale';
    } else {
      state = 'expired';
    }
  }

  // Check refresh status
  const refreshRunning = isRefreshing(key);
  const refreshAge = getRefreshAge(key);

  // Check backoff
  const inBackoff = isInBackoff(key);
  let backoffRemaining: number | null = null;
  const keyBackoff = backoffUntil.get(key);
  if (keyBackoff && now < keyBackoff) {
    backoffRemaining = keyBackoff - now;
  }

  // Check blocking fetch throttle
  const lastBlockingFetch = blockingFetchLocks.get(key);
  let blockingFetchThrottled = false;
  let blockingFetchCooldown: number | null = null;
  if (lastBlockingFetch) {
    const elapsed = now - lastBlockingFetch;
    if (elapsed < BLOCKING_FETCH_COOLDOWN) {
      blockingFetchThrottled = true;
      blockingFetchCooldown = BLOCKING_FETCH_COOLDOWN - elapsed;
    }
  }

  return {
    key,
    exists: cacheData !== null && cacheData !== undefined,
    age,
    state,
    lastUpdatedAt,
    refreshRunning,
    refreshAge,
    inBackoff,
    backoffRemaining,
    blockingFetchThrottled,
    blockingFetchCooldown,
  };
}
