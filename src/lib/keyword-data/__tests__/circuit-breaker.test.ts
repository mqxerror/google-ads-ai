/**
 * Circuit Breaker Tests
 * Run with: npm test circuit-breaker.test.ts
 */

import { CircuitBreaker, CircuitState, createCircuitBreaker } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = createCircuitBreaker('TestAPI', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      requestTimeout: 500,
    });
  });

  describe('Successful requests', () => {
    test('should execute function and return result', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await breaker.execute(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should reset failure count after success', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      const successFn = jest.fn().mockResolvedValue('success');

      // Fail once
      await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      expect(breaker.getStats().failures).toBe(1);

      // Success resets failures
      await breaker.execute(successFn);
      expect(breaker.getStats().failures).toBe(0);
    });
  });

  describe('Circuit opening', () => {
    test('should open circuit after threshold failures', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      }

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.failures).toBe(3);
    });

    test('should reject immediately when circuit is open', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // Next call should fail fast
      const fn = jest.fn().mockResolvedValue('success');
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker');
      expect(fn).not.toHaveBeenCalled(); // Function not executed
    });
  });

  describe('Circuit recovery', () => {
    test('should transition to HALF_OPEN after timeout', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      expect(breaker.getStats().state).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      const successFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      expect(breaker.getStats().state).toBe(CircuitState.HALF_OPEN);
    });

    test('should close circuit after successful recovery', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      const successFn = jest.fn().mockResolvedValue('success');

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Succeed twice (threshold) in HALF_OPEN
      await breaker.execute(successFn);
      await breaker.execute(successFn);

      expect(breaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    test('should reopen circuit if recovery fails', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Fail during recovery
      await expect(breaker.execute(failingFn)).rejects.toThrow('fail');

      expect(breaker.getStats().state).toBe(CircuitState.OPEN);
    });
  });

  describe('Request timeout', () => {
    test('should timeout slow requests', async () => {
      const slowFn = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));

      await expect(breaker.execute(slowFn)).rejects.toThrow('Request timeout');
    });
  });

  describe('Manual reset', () => {
    test('should reset circuit to CLOSED state', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      expect(breaker.getStats().state).toBe(CircuitState.OPEN);

      // Manual reset
      breaker.reset();

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
    });
  });
});
