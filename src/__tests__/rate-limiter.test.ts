import {
  checkRateLimit,
  clearRateLimit,
  clearAllRateLimits,
  getRateLimitStatus,
  RATE_LIMIT_PRESETS,
} from '../lib/rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within the limit', () => {
      const config = { maxRequests: 5, windowMs: 60000 };
      const key = 'test-key-1';

      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(key, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(config.maxRequests - i - 1);
      }
    });

    it('should block requests that exceed the limit', () => {
      const config = { maxRequests: 3, windowMs: 60000 };
      const key = 'test-key-2';

      // Use up all tokens
      for (let i = 0; i < 3; i++) {
        checkRateLimit(key, config);
      }

      // This request should be blocked
      const result = checkRateLimit(key, config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different keys separately', () => {
      const config = { maxRequests: 2, windowMs: 60000 };

      checkRateLimit('key-a', config);
      checkRateLimit('key-a', config);

      // key-a is exhausted
      expect(checkRateLimit('key-a', config).allowed).toBe(false);

      // key-b should still have tokens
      expect(checkRateLimit('key-b', config).allowed).toBe(true);
    });

    it('should use default preset if no config provided', () => {
      const result = checkRateLimit('test-default');
      expect(result.allowed).toBe(true);
    });
  });

  describe('clearRateLimit', () => {
    it('should clear rate limit for a specific key', () => {
      const config = { maxRequests: 1, windowMs: 60000 };
      const key = 'clear-test';

      checkRateLimit(key, config);
      expect(checkRateLimit(key, config).allowed).toBe(false);

      clearRateLimit(key);
      expect(checkRateLimit(key, config).allowed).toBe(true);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return full tokens for new keys', () => {
      const config = { maxRequests: 10, windowMs: 60000 };
      const status = getRateLimitStatus('new-key', config);

      expect(status.remaining).toBe(10);
      expect(status.blocked).toBe(false);
    });

    it('should return correct remaining tokens', () => {
      const config = { maxRequests: 5, windowMs: 60000 };
      const key = 'status-test';

      checkRateLimit(key, config);
      checkRateLimit(key, config);

      const status = getRateLimitStatus(key, config);
      expect(status.remaining).toBe(3);
    });
  });

  describe('RATE_LIMIT_PRESETS', () => {
    it('should have required presets', () => {
      expect(RATE_LIMIT_PRESETS).toHaveProperty('default');
      expect(RATE_LIMIT_PRESETS).toHaveProperty('auth');
      expect(RATE_LIMIT_PRESETS).toHaveProperty('googleAds');
      expect(RATE_LIMIT_PRESETS).toHaveProperty('ai');
      expect(RATE_LIMIT_PRESETS).toHaveProperty('bulk');
      expect(RATE_LIMIT_PRESETS).toHaveProperty('reports');
    });

    it('should have valid configuration values', () => {
      Object.values(RATE_LIMIT_PRESETS).forEach(preset => {
        expect(preset.maxRequests).toBeGreaterThan(0);
        expect(preset.windowMs).toBeGreaterThan(0);
      });
    });
  });
});
