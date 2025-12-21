/**
 * Production Redis Configuration for BullMQ
 *
 * Features:
 * - Separate namespace (DB index) for queue isolation
 * - Connection timeouts and retry strategy
 * - Health monitoring
 * - Graceful degradation when unavailable
 */

import Redis from 'ioredis';

// ============================================
// Configuration
// ============================================

const REDIS_DB_INDEX = 1; // Use DB 1 for queue (DB 0 for other caching)

function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const parsedUrl = parseRedisUrl(redisUrl);

export const REDIS_CONFIG = {
  host: parsedUrl.host,
  port: parsedUrl.port,
  password: parsedUrl.password,
  username: parsedUrl.username,
  db: REDIS_DB_INDEX,
  // BullMQ requirements
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Timeouts
  connectTimeout: 10000,      // 10 seconds to connect
  commandTimeout: 30000,      // 30 seconds per command (BullMQ uses blocking commands)
  // Keep-alive
  keepAlive: 30000,           // 30 seconds
  // Retry strategy with exponential backoff + jitter
  retryStrategy: (times: number) => {
    if (times > 10) {
      console.error('[Redis] Max connection retries reached');
      return null; // Stop retrying
    }
    // Exponential backoff: 100ms, 200ms, 400ms... up to 3s
    // Add jitter: ±20%
    const baseDelay = Math.min(100 * Math.pow(2, times - 1), 3000);
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.round(baseDelay + jitter);
    console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
};

// ============================================
// Connection Management
// ============================================

let redisConnection: Redis | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

/**
 * Get or create the shared Redis connection
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    connectionStatus = 'connecting';
    redisConnection = new Redis(REDIS_CONFIG);

    redisConnection.on('connect', () => {
      connectionStatus = 'connected';
      console.log(`[Redis] Connected to ${REDIS_CONFIG.host}:${REDIS_CONFIG.port} DB:${REDIS_DB_INDEX}`);
    });

    redisConnection.on('error', (err) => {
      connectionStatus = 'error';
      console.error('[Redis] Connection error:', err.message);
    });

    redisConnection.on('close', () => {
      connectionStatus = 'disconnected';
      console.log('[Redis] Connection closed');
    });

    redisConnection.on('reconnecting', () => {
      connectionStatus = 'connecting';
    });
  }

  return redisConnection;
}

/**
 * Check if Redis is available and healthy
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const result = await Promise.race([
      redis.ping(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Ping timeout')), 2000)
      ),
    ]);
    return result === 'PONG';
  } catch (err) {
    console.warn('[Redis] Health check failed:', (err as Error).message);
    return false;
  }
}

/**
 * Get current connection status
 */
export function getRedisStatus(): typeof connectionStatus {
  return connectionStatus;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    connectionStatus = 'disconnected';
    console.log('[Redis] Connection closed gracefully');
  }
}

/**
 * Get Redis connection options for BullMQ
 * BullMQ manages its own connections, so we provide config, not instance
 */
export function getRedisOptions() {
  return { ...REDIS_CONFIG };
}

// ============================================
// Worker Heartbeat
// ============================================

const HEARTBEAT_KEY = 'gads:worker:heartbeat';
const HEARTBEAT_TTL = 60; // Key expires after 60s of no updates

/**
 * Update worker heartbeat in Redis
 * Should be called periodically by the worker
 */
export async function updateWorkerHeartbeat(workerId: string, jobsProcessed: number): Promise<void> {
  try {
    const redis = getRedisConnection();
    const heartbeat = JSON.stringify({
      workerId,
      lastSeen: new Date().toISOString(),
      jobsProcessed,
      status: 'active',
    });
    await redis.setex(HEARTBEAT_KEY, HEARTBEAT_TTL, heartbeat);
  } catch (err) {
    console.warn('[Redis] Failed to update heartbeat:', (err as Error).message);
  }
}

/**
 * Get worker heartbeat status
 * Returns null if no heartbeat or expired
 */
export async function getWorkerHeartbeat(): Promise<{
  workerId: string;
  lastSeen: string;
  jobsProcessed: number;
  status: 'active' | 'stale' | 'dead';
  ageSeconds: number;
} | null> {
  try {
    const redis = getRedisConnection();
    const data = await redis.get(HEARTBEAT_KEY);
    if (!data) return null;

    const heartbeat = JSON.parse(data);
    const ageMs = Date.now() - new Date(heartbeat.lastSeen).getTime();
    const ageSeconds = Math.floor(ageMs / 1000);

    // Determine status based on age
    let status: 'active' | 'stale' | 'dead' = 'active';
    if (ageSeconds > 30) status = 'stale';
    if (ageSeconds > 60) status = 'dead';

    return {
      ...heartbeat,
      status,
      ageSeconds,
    };
  } catch (err) {
    console.warn('[Redis] Failed to read heartbeat:', (err as Error).message);
    return null;
  }
}
