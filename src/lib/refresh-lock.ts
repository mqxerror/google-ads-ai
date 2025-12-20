/**
 * Refresh Lock Service
 *
 * Prevents duplicate background refreshes for the same cache key.
 * Uses in-memory locks with automatic expiry to handle crashes.
 */

interface LockEntry {
  expiresAt: number;
  startedAt: number;
}

// In-memory lock store (could be replaced with Redis for multi-instance)
const locks = new Map<string, LockEntry>();

// Default lock TTL: 2 minutes (enough for most API calls)
const DEFAULT_LOCK_TTL = 2 * 60 * 1000;

// Backoff tracking for rate limits
const backoffUntil = new Map<string, number>();

/**
 * Generate a cache key for refresh locking
 */
export function createRefreshKey(
  customerId: string,
  entityType: string,
  parentEntityId?: string,
  startDate?: string,
  endDate?: string
): string {
  const parts = [customerId, entityType];
  if (parentEntityId) parts.push(parentEntityId);
  if (startDate && endDate) parts.push(`${startDate}_${endDate}`);
  return parts.join(':');
}

/**
 * Try to acquire a lock for background refresh
 * Returns true if lock acquired, false if already locked
 */
export function tryAcquireLock(key: string, ttlMs: number = DEFAULT_LOCK_TTL): boolean {
  // Clean up expired locks
  cleanupExpiredLocks();

  // Check backoff
  const backoff = backoffUntil.get(key);
  if (backoff && Date.now() < backoff) {
    console.log(`[Lock] Skipping refresh for ${key} - in backoff until ${new Date(backoff).toISOString()}`);
    return false;
  }

  // Check existing lock
  const existing = locks.get(key);
  if (existing && Date.now() < existing.expiresAt) {
    console.log(`[Lock] Refresh already in progress for ${key}`);
    return false;
  }

  // Acquire lock
  locks.set(key, {
    expiresAt: Date.now() + ttlMs,
    startedAt: Date.now(),
  });

  console.log(`[Lock] Acquired refresh lock for ${key}`);
  return true;
}

/**
 * Release a lock after refresh completes
 */
export function releaseLock(key: string): void {
  locks.delete(key);
  console.log(`[Lock] Released refresh lock for ${key}`);
}

/**
 * Set backoff for a key after rate limit error
 */
export function setBackoff(key: string, seconds: number): void {
  const until = Date.now() + (seconds * 1000);
  backoffUntil.set(key, until);
  console.log(`[Lock] Set backoff for ${key} until ${new Date(until).toISOString()}`);
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
 * Clean up expired locks
 */
function cleanupExpiredLocks(): void {
  const now = Date.now();
  for (const [key, lock] of locks.entries()) {
    if (now >= lock.expiresAt) {
      locks.delete(key);
    }
  }
  for (const [key, until] of backoffUntil.entries()) {
    if (now >= until) {
      backoffUntil.delete(key);
    }
  }
}

/**
 * Get lock status for debugging
 */
export function getLockStatus(): { locks: number; backoffs: number } {
  cleanupExpiredLocks();
  return {
    locks: locks.size,
    backoffs: backoffUntil.size,
  };
}
