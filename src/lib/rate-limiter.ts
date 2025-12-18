/**
 * Rate Limiter Utility
 * Implements token bucket algorithm for API rate limiting
 */

interface RateLimitConfig {
  maxRequests: number;      // Maximum requests allowed
  windowMs: number;         // Time window in milliseconds
  blockDuration?: number;   // Block duration after limit exceeded (ms)
}

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  blocked?: number;         // Timestamp when block started
}

// In-memory store for rate limiting
// In production, use Redis or similar distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Presets for different API types
export const RATE_LIMIT_PRESETS = {
  // General API endpoints
  default: {
    maxRequests: 100,
    windowMs: 60 * 1000,    // 100 requests per minute
  },
  // Authentication endpoints
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000,    // 5 requests per minute
    blockDuration: 5 * 60 * 1000, // 5 minute block
  },
  // Google Ads API (more restrictive)
  googleAds: {
    maxRequests: 15,
    windowMs: 60 * 1000,    // 15 requests per minute
  },
  // AI/LLM endpoints
  ai: {
    maxRequests: 10,
    windowMs: 60 * 1000,    // 10 requests per minute
  },
  // Bulk operations
  bulk: {
    maxRequests: 5,
    windowMs: 60 * 1000,    // 5 requests per minute
  },
  // Report generation
  reports: {
    maxRequests: 10,
    windowMs: 5 * 60 * 1000, // 10 requests per 5 minutes
  },
} as const;

/**
 * Check if a request is rate limited
 * Returns remaining tokens or -1 if limited
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.default
): { allowed: boolean; remaining: number; resetIn: number; blocked?: boolean } {
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  // Initialize entry if doesn't exist
  if (!entry) {
    entry = {
      tokens: config.maxRequests - 1, // Consume one token
      lastRefill: now,
    };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: entry.tokens,
      resetIn: config.windowMs,
    };
  }

  // Check if blocked
  if (entry.blocked && config.blockDuration) {
    const blockRemaining = entry.blocked + config.blockDuration - now;
    if (blockRemaining > 0) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: blockRemaining,
        blocked: true,
      };
    }
    // Block expired, reset entry
    entry.blocked = undefined;
    entry.tokens = config.maxRequests;
    entry.lastRefill = now;
  }

  // Calculate token refill
  const timePassed = now - entry.lastRefill;
  const tokensToAdd = Math.floor((timePassed / config.windowMs) * config.maxRequests);

  if (tokensToAdd > 0) {
    entry.tokens = Math.min(config.maxRequests, entry.tokens + tokensToAdd);
    entry.lastRefill = now;
  }

  // Check if request is allowed
  if (entry.tokens > 0) {
    entry.tokens--;
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: entry.tokens,
      resetIn: config.windowMs - timePassed,
    };
  }

  // Rate limited - optionally block
  if (config.blockDuration) {
    entry.blocked = now;
    rateLimitStore.set(key, entry);
  }

  return {
    allowed: false,
    remaining: 0,
    resetIn: config.windowMs - timePassed,
    blocked: !!config.blockDuration,
  };
}

/**
 * Rate limit middleware for API routes
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig = RATE_LIMIT_PRESETS.default,
  keyGenerator?: (request: Request) => string
) {
  return async (request: Request): Promise<{ allowed: boolean; response?: Response }> => {
    // Generate rate limit key
    const key = keyGenerator
      ? keyGenerator(request)
      : getDefaultKey(request);

    const result = checkRateLimit(key, config);

    if (!result.allowed) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: result.blocked
              ? 'Too many requests. You have been temporarily blocked.'
              : 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(result.resetIn / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil(result.resetIn / 1000)),
              'X-RateLimit-Limit': String(config.maxRequests),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Date.now() + result.resetIn),
            },
          }
        ),
      };
    }

    return { allowed: true };
  };
}

/**
 * Generate default rate limit key from request
 */
function getDefaultKey(request: Request): string {
  // Try to get IP from headers (for proxied requests)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';

  // Combine with path for more granular limiting
  const url = new URL(request.url);
  return `${ip}:${url.pathname}`;
}

/**
 * Clear rate limit for a key (useful for testing)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Clear all rate limits
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(
  key: string,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.default
): { remaining: number; resetIn: number; blocked: boolean } {
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return {
      remaining: config.maxRequests,
      resetIn: 0,
      blocked: false,
    };
  }

  const now = Date.now();
  const timePassed = now - entry.lastRefill;
  const tokensToAdd = Math.floor((timePassed / config.windowMs) * config.maxRequests);
  const currentTokens = Math.min(config.maxRequests, entry.tokens + tokensToAdd);

  return {
    remaining: currentTokens,
    resetIn: Math.max(0, config.windowMs - timePassed),
    blocked: !!(entry.blocked && config.blockDuration && entry.blocked + config.blockDuration > now),
  };
}

/**
 * Cleanup old entries periodically
 */
export function cleanupRateLimitStore(maxAge: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.lastRefill > maxAge) {
      rateLimitStore.delete(key);
    }
  }
}

// Schedule cleanup every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => cleanupRateLimitStore(), 60 * 60 * 1000);
}
