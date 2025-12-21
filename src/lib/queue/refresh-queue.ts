/**
 * Production-Grade Background Refresh Queue
 *
 * Features:
 * - Deterministic job deduplication (same params = same job ID)
 * - Per-customer rate limiting
 * - Global concurrency control
 * - Exponential backoff with jitter
 * - Job outcome persistence
 * - Manual refresh with priority
 */

import { Queue, QueueEvents } from 'bullmq';
import crypto from 'crypto';
import { getRedisOptions, isRedisAvailable } from './redis';

// ============================================
// Job Types & Data Structures
// ============================================

export type RefreshJobType =
  | 'refresh:campaigns'
  | 'refresh:ad-groups'
  | 'refresh:keywords'
  | 'refresh:ads'
  | 'refresh:reports';

export interface RefreshJobData {
  type: RefreshJobType;
  refreshToken: string;
  accountId: string;        // Internal DB account ID
  customerId: string;       // Google Ads customer ID
  parentManagerId?: string;
  startDate: string;
  endDate: string;
  parentEntityId?: string;  // campaignId for ad-groups, adGroupId for keywords/ads

  // Query modifiers that affect result shape (critical for cache key)
  conversionMode?: 'conversions' | 'all_conversions';  // Which conversion type
  includeToday?: boolean;   // Whether to include today's partial data
  timezone?: string;        // User's timezone for date boundaries
  columns?: string[];       // Selected KPI columns

  // Optional filters (for comprehensive dedupe key)
  filters?: Record<string, unknown>;

  // Metadata
  enqueuedAt: number;
  priority: 'normal' | 'high';  // high = manual refresh
  requestId?: string;       // For tracing
}

export interface RefreshJobResult {
  success: boolean;
  entityCount?: number;
  error?: string;
  duration: number;
  apiCalls: number;
}

// ============================================
// Queue Configuration
// ============================================

const QUEUE_NAME = 'gads-refresh';

// Concurrency: Max 2 workers to stay well under Google Ads quotas
const MAX_CONCURRENCY = 2;

// Rate limiting: Max 1 job per 2 seconds per customer
// Google Ads allows ~100 requests/minute, but we want headroom
const RATE_LIMIT_PER_CUSTOMER_MS = 2000;

// Retry with exponential backoff + jitter
const RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 60000,  // Start at 1 minute (Google often says "retry in 60s")
  },
};

// Job lifecycle settings
const JOB_OPTIONS = {
  attempts: RETRY_CONFIG.attempts,
  backoff: RETRY_CONFIG.backoff,
  removeOnComplete: {
    age: 24 * 60 * 60,    // Keep completed jobs for 24h
    count: 500,            // Max 500 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    count: 1000,           // Max 1000 failed jobs
  },
};

// ============================================
// Queue Singleton
// ============================================

let refreshQueue: Queue<RefreshJobData, RefreshJobResult> | null = null;
let queueEvents: QueueEvents | null = null;
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

// Track last enqueue time per customer (for rate limiting)
const lastEnqueueByCustomer = new Map<string, number>();

// Track active job IDs to prevent duplicate enqueues for stale cache
const pendingJobIds = new Set<string>();

// ============================================
// Deterministic Job ID Generation
// ============================================

/**
 * Generate a deterministic job ID from job parameters
 * Same params always produce the same ID for deduplication
 *
 * IMPORTANT: This key must include ALL factors that change result shape:
 * - Entity scope (type, customerId, parentEntityId, dateRange)
 * - Query modifiers (conversionMode, includeToday, timezone, columns)
 * - Filters
 */
export function generateJobId(data: Pick<
  RefreshJobData,
  | 'type'
  | 'customerId'
  | 'parentEntityId'
  | 'startDate'
  | 'endDate'
  | 'conversionMode'
  | 'includeToday'
  | 'timezone'
  | 'columns'
  | 'filters'
>): string {
  // IMPORTANT: BullMQ does NOT allow colons in job IDs
  // Use underscore as separator instead
  const parts = [
    data.type.replace(/:/g, '_'), // refresh:campaigns -> refresh_campaigns
    data.customerId,
    data.parentEntityId || 'root',
    data.startDate,
    data.endDate,
  ];

  // Include query modifiers that affect result shape
  // These are critical for cache consistency
  if (data.conversionMode) {
    parts.push(`conv-${data.conversionMode}`);
  }
  if (data.includeToday !== undefined) {
    parts.push(`today-${data.includeToday ? '1' : '0'}`);
  }
  if (data.timezone) {
    parts.push(`tz-${data.timezone.replace(/[/:]/g, '_')}`);
  }
  if (data.columns && data.columns.length > 0) {
    // Sort columns for consistent hash regardless of order
    const columnsHash = crypto
      .createHash('md5')
      .update(data.columns.slice().sort().join(','))
      .digest('hex')
      .slice(0, 6);
    parts.push(`cols-${columnsHash}`);
  }

  // Include filters hash if present
  if (data.filters && Object.keys(data.filters).length > 0) {
    const filtersHash = crypto
      .createHash('md5')
      .update(JSON.stringify(data.filters))
      .digest('hex')
      .slice(0, 8);
    parts.push(`f-${filtersHash}`);
  }

  return parts.join('_');
}

// ============================================
// Queue Initialization
// ============================================

/**
 * Initialize the refresh queue
 * Safe to call multiple times - returns cached promise
 */
export async function initRefreshQueue(): Promise<boolean> {
  // Return existing init promise if in progress
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Check Redis availability
      const redisAvailable = await isRedisAvailable();
      if (!redisAvailable) {
        console.error('[Queue] Redis not available - queue disabled');
        isInitialized = false;
        return false;
      }

      const connection = getRedisOptions();

      refreshQueue = new Queue<RefreshJobData, RefreshJobResult>(QUEUE_NAME, {
        connection,
        defaultJobOptions: JOB_OPTIONS,
      });

      // Set global concurrency limit
      await refreshQueue.setGlobalConcurrency(MAX_CONCURRENCY);

      // Set up queue events for observability
      queueEvents = new QueueEvents(QUEUE_NAME, { connection });

      queueEvents.on('completed', ({ jobId, returnvalue }) => {
        pendingJobIds.delete(jobId);
        console.log(`[Queue] ✓ Job ${jobId} completed:`, returnvalue);
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        pendingJobIds.delete(jobId);
        console.error(`[Queue] ✗ Job ${jobId} failed:`, failedReason);
      });

      queueEvents.on('stalled', ({ jobId }) => {
        console.warn(`[Queue] ⚠ Job ${jobId} stalled - will retry`);
      });

      isInitialized = true;
      console.log(`[Queue] Initialized: ${QUEUE_NAME} (concurrency: ${MAX_CONCURRENCY})`);
      return true;
    } catch (error) {
      console.error('[Queue] Initialization failed:', error);
      isInitialized = false;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Check if queue is ready for use
 */
export function isQueueReady(): boolean {
  return isInitialized && refreshQueue !== null;
}

/**
 * Get the queue instance (for admin/monitoring)
 */
export function getRefreshQueue(): Queue<RefreshJobData, RefreshJobResult> | null {
  return refreshQueue;
}

// ============================================
// Job Enqueueing with Deduplication
// ============================================

/**
 * Check if we should rate-limit this customer
 */
function shouldRateLimitCustomer(customerId: string): boolean {
  const lastEnqueue = lastEnqueueByCustomer.get(customerId);
  if (!lastEnqueue) return false;
  return Date.now() - lastEnqueue < RATE_LIMIT_PER_CUSTOMER_MS;
}

/**
 * Enqueue a refresh job with deduplication
 *
 * Returns:
 * - jobId if enqueued successfully
 * - null if queue unavailable
 * - 'duplicate' if job already pending
 * - 'rate-limited' if customer rate-limited
 */
export async function enqueueRefreshJob(
  data: Omit<RefreshJobData, 'enqueuedAt' | 'priority'>,
  priority: 'normal' | 'high' = 'normal'
): Promise<string | 'duplicate' | 'rate-limited' | null> {
  // Auto-initialize queue if not ready
  if (!isQueueReady() || !refreshQueue) {
    console.log('[Queue] Auto-initializing queue for enqueue...');
    try {
      await initRefreshQueue();
    } catch (err) {
      console.warn('[Queue] Failed to initialize queue:', err);
    }
  }

  // Check again after init attempt
  if (!isQueueReady() || !refreshQueue) {
    console.warn('[Queue] Queue not ready after init, cannot enqueue');
    return null;
  }

  const jobId = generateJobId(data);

  // Check if job already pending (skip on manual refresh)
  if (priority !== 'high' && pendingJobIds.has(jobId)) {
    console.log(`[Queue] Job ${jobId} already pending, skipping`);
    return 'duplicate';
  }

  // Check rate limit (skip on manual refresh)
  if (priority !== 'high' && shouldRateLimitCustomer(data.customerId)) {
    console.log(`[Queue] Customer ${data.customerId} rate-limited, skipping`);
    return 'rate-limited';
  }

  try {
    // Check if job exists in queue (BullMQ level deduplication)
    const existingJob = await refreshQueue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        console.log(`[Queue] Job ${jobId} exists in queue (${state})`);
        pendingJobIds.add(jobId);
        return 'duplicate';
      }
    }

    const jobData: RefreshJobData = {
      ...data,
      enqueuedAt: Date.now(),
      priority,
    };

    // High priority = lower number (0 = highest)
    const priorityValue = priority === 'high' ? 1 : 10;

    await refreshQueue.add(data.type, jobData, {
      jobId,
      priority: priorityValue,
    });

    // Track for deduplication
    pendingJobIds.add(jobId);
    lastEnqueueByCustomer.set(data.customerId, Date.now());

    console.log(`[Queue] Enqueued ${priority} job: ${jobId}`);
    return jobId;
  } catch (error) {
    console.error('[Queue] Failed to enqueue:', error);
    return null;
  }
}

// ============================================
// Convenience Enqueue Functions
// ============================================

interface BaseRefreshParams {
  refreshToken: string;
  accountId: string;
  customerId: string;
  parentManagerId?: string;
  startDate: string;
  endDate: string;
  filters?: Record<string, unknown>;
  requestId?: string;
}

export async function enqueueCampaignRefresh(
  params: BaseRefreshParams,
  priority: 'normal' | 'high' = 'normal'
): Promise<string | 'duplicate' | 'rate-limited' | null> {
  return enqueueRefreshJob({
    type: 'refresh:campaigns',
    ...params,
  }, priority);
}

export async function enqueueAdGroupRefresh(
  params: BaseRefreshParams & { campaignId: string },
  priority: 'normal' | 'high' = 'normal'
): Promise<string | 'duplicate' | 'rate-limited' | null> {
  return enqueueRefreshJob({
    type: 'refresh:ad-groups',
    ...params,
    parentEntityId: params.campaignId,
  }, priority);
}

export async function enqueueKeywordRefresh(
  params: BaseRefreshParams & { adGroupId: string },
  priority: 'normal' | 'high' = 'normal'
): Promise<string | 'duplicate' | 'rate-limited' | null> {
  return enqueueRefreshJob({
    type: 'refresh:keywords',
    ...params,
    parentEntityId: params.adGroupId,
  }, priority);
}

export async function enqueueAdRefresh(
  params: BaseRefreshParams & { adGroupId: string },
  priority: 'normal' | 'high' = 'normal'
): Promise<string | 'duplicate' | 'rate-limited' | null> {
  return enqueueRefreshJob({
    type: 'refresh:ads',
    ...params,
    parentEntityId: params.adGroupId,
  }, priority);
}

export async function enqueueReportRefresh(
  params: BaseRefreshParams,
  priority: 'normal' | 'high' = 'normal'
): Promise<string | 'duplicate' | 'rate-limited' | null> {
  return enqueueRefreshJob({
    type: 'refresh:reports',
    ...params,
  }, priority);
}

// ============================================
// Queue Monitoring & Admin
// ============================================

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  pendingInMemory: number;  // Jobs tracked locally
}

/**
 * Get queue statistics for monitoring
 */
export async function getQueueStats(): Promise<QueueStats | null> {
  if (!refreshQueue) return null;

  try {
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      refreshQueue.getWaitingCount(),
      refreshQueue.getActiveCount(),
      refreshQueue.getCompletedCount(),
      refreshQueue.getFailedCount(),
      refreshQueue.getDelayedCount(),
      refreshQueue.isPaused(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
      pendingInMemory: pendingJobIds.size,
    };
  } catch (error) {
    console.error('[Queue] Failed to get stats:', error);
    return null;
  }
}

/**
 * Get recent job details for debugging
 */
export async function getRecentJobs(count: number = 20) {
  if (!refreshQueue) return [];

  try {
    const jobs = await refreshQueue.getJobs(
      ['active', 'waiting', 'delayed', 'failed', 'completed'],
      0,
      count
    );

    return Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        type: job.data.type,
        customerId: job.data.customerId,
        parentEntityId: job.data.parentEntityId,
        dateRange: `${job.data.startDate} - ${job.data.endDate}`,
        priority: job.data.priority,
        state: await job.getState(),
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        enqueuedAt: new Date(job.data.enqueuedAt).toISOString(),
        processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
      }))
    );
  } catch (error) {
    console.error('[Queue] Failed to get recent jobs:', error);
    return [];
  }
}

/**
 * Get last refresh time per customer/entity for UI
 */
export async function getLastRefreshTimes(customerId: string): Promise<Record<string, string>> {
  if (!refreshQueue) return {};

  try {
    const jobs = await refreshQueue.getJobs(['completed'], 0, 100);
    const lastTimes: Record<string, string> = {};

    for (const job of jobs) {
      if (job.data.customerId !== customerId) continue;
      if (!job.finishedOn) continue;

      const key = job.data.parentEntityId
        ? `${job.data.type}:${job.data.parentEntityId}`
        : job.data.type;

      const finishedAt = new Date(job.finishedOn).toISOString();
      if (!lastTimes[key] || finishedAt > lastTimes[key]) {
        lastTimes[key] = finishedAt;
      }
    }

    return lastTimes;
  } catch (error) {
    console.error('[Queue] Failed to get last refresh times:', error);
    return {};
  }
}

// ============================================
// Queue Control
// ============================================

export async function pauseQueue(): Promise<void> {
  if (refreshQueue) {
    await refreshQueue.pause();
    console.log('[Queue] Paused');
  }
}

export async function resumeQueue(): Promise<void> {
  if (refreshQueue) {
    await refreshQueue.resume();
    console.log('[Queue] Resumed');
  }
}

export async function drainQueue(): Promise<void> {
  if (refreshQueue) {
    await refreshQueue.drain();
    pendingJobIds.clear();
    console.log('[Queue] Drained');
  }
}

export async function closeQueue(): Promise<void> {
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }
  if (refreshQueue) {
    await refreshQueue.close();
    refreshQueue = null;
  }
  isInitialized = false;
  initPromise = null;
  pendingJobIds.clear();
  lastEnqueueByCustomer.clear();
  console.log('[Queue] Closed gracefully');
}
