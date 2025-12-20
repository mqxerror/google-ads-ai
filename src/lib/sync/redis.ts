/**
 * Redis Connection Manager
 *
 * Provides a singleton Redis connection for BullMQ queues.
 * Falls back to in-memory processing if Redis is unavailable.
 */

import Redis from 'ioredis';

// Redis connection status
let isRedisAvailable = false;
let connectionAttempted = false;
let redisInstance: Redis | null = null;

// Get Redis URL from environment or default
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Get or create Redis connection
 */
export function getRedisConnection(): Redis | null {
  if (redisInstance) {
    return redisInstance;
  }

  if (connectionAttempted && !isRedisAvailable) {
    return null;
  }

  connectionAttempted = true;

  try {
    redisInstance = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        // Retry with exponential backoff, max 3 attempts
        if (times > 3) {
          console.log('[Redis] Max retries reached, falling back to in-memory processing');
          isRedisAvailable = false;
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    redisInstance.on('connect', () => {
      console.log('[Redis] Connected successfully');
      isRedisAvailable = true;
    });

    redisInstance.on('error', (err) => {
      console.warn('[Redis] Connection error:', err.message);
      isRedisAvailable = false;
    });

    redisInstance.on('close', () => {
      console.log('[Redis] Connection closed');
      isRedisAvailable = false;
    });

    return redisInstance;
  } catch (error) {
    console.warn('[Redis] Failed to connect:', error);
    isRedisAvailable = false;
    return null;
  }
}

/**
 * Check if Redis is available
 */
export function isRedisConnected(): boolean {
  return isRedisAvailable && redisInstance !== null;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    isRedisAvailable = false;
  }
}

/**
 * Get Redis connection options for BullMQ
 */
export function getRedisOptions(): { connection: Redis } | undefined {
  const connection = getRedisConnection();
  if (connection) {
    return { connection };
  }
  return undefined;
}
