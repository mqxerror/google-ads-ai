/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when external APIs become unavailable.
 * Each API (Google Ads, Moz, DataForSEO) has its own independent circuit breaker.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail fast without calling API
 * - HALF_OPEN: Testing if API has recovered
 *
 * GPT Recommendation: "Implement circuit breakers for APIs to prevent cascading
 * failures. This is crucial for maintaining system stability when one of the APIs
 * becomes unavailable."
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, block requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  successThreshold: number;    // Number of successes in HALF_OPEN to close
  timeout: number;             // Time in ms to wait before trying HALF_OPEN
  requestTimeout: number;      // Max time for individual request
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime: number | null = null;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          `Circuit breaker for ${this.name} is OPEN. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`,
          this.state
        );
      }
      // Time to try HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      console.log(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN for recovery test`);
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Request timeout after ${this.config.requestTimeout}ms`)),
          this.config.requestTimeout
        )
      )
    ]);
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      console.log(`[CircuitBreaker:${this.name}] HALF_OPEN success ${this.successCount}/${this.config.successThreshold}`);

      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        console.log(`[CircuitBreaker:${this.name}] Recovered! Transitioning to CLOSED`);
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(error: unknown): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[CircuitBreaker:${this.name}] Failure ${this.failureCount}/${this.config.failureThreshold}: ${errorMessage}`);

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery test, go back to OPEN
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
      console.log(`[CircuitBreaker:${this.name}] Recovery failed. OPEN until ${new Date(this.nextAttemptTime).toISOString()}`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      // Too many failures, open the circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
      console.log(`[CircuitBreaker:${this.name}] Threshold reached. OPEN until ${new Date(this.nextAttemptTime).toISOString()}`);
    }
  }

  /**
   * Get current circuit breaker stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset the circuit breaker (for testing or manual recovery)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = null;
    console.log(`[CircuitBreaker:${this.name}] Manually reset to CLOSED`);
  }

  /**
   * Check if circuit is currently allowing requests
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN &&
           this.nextAttemptTime !== null &&
           Date.now() < this.nextAttemptTime;
  }
}

/**
 * Custom error for circuit breaker trips
 */
export class CircuitBreakerError extends Error {
  constructor(message: string, public state: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Factory function to create circuit breakers with sensible defaults
 */
export function createCircuitBreaker(
  name: string,
  overrides?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  const defaults: CircuitBreakerConfig = {
    failureThreshold: 5,        // Open after 5 failures
    successThreshold: 2,        // Close after 2 successes in HALF_OPEN
    timeout: 60000,             // Wait 60s before trying again
    requestTimeout: 30000,      // 30s max per request
  };

  return new CircuitBreaker(name, { ...defaults, ...overrides });
}

/**
 * Singleton circuit breakers for keyword data APIs
 */
let googleAdsCircuitBreaker: CircuitBreaker | null = null;
let mozCircuitBreaker: CircuitBreaker | null = null;
let dataForSeoCircuitBreaker: CircuitBreaker | null = null;

export function getGoogleAdsCircuitBreaker(): CircuitBreaker {
  if (!googleAdsCircuitBreaker) {
    googleAdsCircuitBreaker = createCircuitBreaker('GoogleAds', {
      failureThreshold: 3,      // More lenient for Google Ads (free)
      timeout: 30000,           // Shorter timeout (30s)
      requestTimeout: 10000,    // 10s max per request
    });
  }
  return googleAdsCircuitBreaker;
}

export function getMozCircuitBreaker(): CircuitBreaker {
  if (!mozCircuitBreaker) {
    mozCircuitBreaker = createCircuitBreaker('Moz', {
      failureThreshold: 5,      // Standard threshold
      timeout: 60000,           // 60s timeout
      requestTimeout: 30000,    // 30s max per request (batch of 50 keywords ~20s)
    });
  }
  return mozCircuitBreaker;
}

export function getDataForSeoCircuitBreaker(): CircuitBreaker {
  if (!dataForSeoCircuitBreaker) {
    dataForSeoCircuitBreaker = createCircuitBreaker('DataForSEO', {
      failureThreshold: 5,
      timeout: 60000,
      requestTimeout: 30000,
    });
  }
  return dataForSeoCircuitBreaker;
}

/**
 * Get stats for all circuit breakers
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  return {
    googleAds: getGoogleAdsCircuitBreaker().getStats(),
    moz: getMozCircuitBreaker().getStats(),
    dataForSeo: getDataForSeoCircuitBreaker().getStats(),
  };
}

/**
 * Reset all circuit breakers (for testing or manual recovery)
 */
export function resetAllCircuitBreakers(): void {
  getGoogleAdsCircuitBreaker().reset();
  getMozCircuitBreaker().reset();
  getDataForSeoCircuitBreaker().reset();
  console.log('[CircuitBreaker] All circuit breakers reset');
}
