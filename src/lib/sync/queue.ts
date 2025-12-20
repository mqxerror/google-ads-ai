/**
 * BullMQ Queue Setup
 *
 * Defines queues for background sync jobs.
 * Falls back to synchronous processing if Redis is unavailable.
 */

import { Queue, QueueEvents, Worker, Job } from 'bullmq';
import { getRedisConnection, isRedisConnected } from './redis';
import { EntityType } from '@prisma/client';

// Job types
export interface SyncJobData {
  accountId: string;
  customerId: string;
  refreshToken: string;
  entityType: EntityType;
  startDate: string;
  endDate: string;
  loginCustomerId?: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface BackfillJobData extends SyncJobData {
  batchSize: number;
  batchNumber: number;
  totalBatches: number;
}

// Queue names
export const QUEUE_NAMES = {
  METRICS_SYNC: 'metrics-sync',
  BACKFILL: 'backfill',
} as const;

// Queue instances (lazy initialization)
let syncQueue: Queue<SyncJobData> | null = null;
let backfillQueue: Queue<BackfillJobData> | null = null;
let syncQueueEvents: QueueEvents | null = null;

/**
 * Get or create the sync queue
 */
export function getSyncQueue(): Queue<SyncJobData> | null {
  if (syncQueue) return syncQueue;

  const connection = getRedisConnection();
  if (!connection) {
    console.log('[Queue] Redis unavailable, sync queue not created');
    return null;
  }

  syncQueue = new Queue<SyncJobData>(QUEUE_NAMES.METRICS_SYNC, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 100,     // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  });

  console.log('[Queue] Sync queue created');
  return syncQueue;
}

/**
 * Get or create the backfill queue
 */
export function getBackfillQueue(): Queue<BackfillJobData> | null {
  if (backfillQueue) return backfillQueue;

  const connection = getRedisConnection();
  if (!connection) {
    console.log('[Queue] Redis unavailable, backfill queue not created');
    return null;
  }

  backfillQueue = new Queue<BackfillJobData>(QUEUE_NAMES.BACKFILL, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 50,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    },
  });

  console.log('[Queue] Backfill queue created');
  return backfillQueue;
}

/**
 * Add a sync job to the queue
 */
export async function enqueueSyncJob(data: SyncJobData): Promise<Job<SyncJobData> | null> {
  const queue = getSyncQueue();
  if (!queue) {
    console.log('[Queue] No queue available, skipping job');
    return null;
  }

  const priority = data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5;

  const job = await queue.add(
    `sync-${data.entityType}-${data.customerId}`,
    data,
    {
      priority,
      jobId: `sync-${data.customerId}-${data.entityType}-${data.startDate}-${data.endDate}`,
    }
  );

  console.log(`[Queue] Sync job added: ${job.id}`);
  return job;
}

/**
 * Add a backfill job to the queue
 */
export async function enqueueBackfillJob(data: BackfillJobData): Promise<Job<BackfillJobData> | null> {
  const queue = getBackfillQueue();
  if (!queue) {
    console.log('[Queue] No queue available, skipping backfill job');
    return null;
  }

  const job = await queue.add(
    `backfill-${data.entityType}-${data.customerId}-batch-${data.batchNumber}`,
    data,
    {
      priority: 10, // Low priority for backfill
      jobId: `backfill-${data.customerId}-${data.entityType}-batch-${data.batchNumber}`,
    }
  );

  console.log(`[Queue] Backfill job added: ${job.id}`);
  return job;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  syncQueue: { waiting: number; active: number; completed: number; failed: number } | null;
  backfillQueue: { waiting: number; active: number; completed: number; failed: number } | null;
}> {
  const sync = getSyncQueue();
  const backfill = getBackfillQueue();

  const getStats = async (queue: Queue | null) => {
    if (!queue) return null;

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  };

  return {
    syncQueue: await getStats(sync),
    backfillQueue: await getStats(backfill),
  };
}

/**
 * Clean up old jobs
 */
export async function cleanupOldJobs(): Promise<void> {
  const sync = getSyncQueue();
  const backfill = getBackfillQueue();

  if (sync) {
    await sync.clean(24 * 3600 * 1000, 100, 'completed');
    await sync.clean(7 * 24 * 3600 * 1000, 50, 'failed');
  }

  if (backfill) {
    await backfill.clean(24 * 3600 * 1000, 50, 'completed');
    await backfill.clean(7 * 24 * 3600 * 1000, 25, 'failed');
  }
}

/**
 * Close all queues
 */
export async function closeQueues(): Promise<void> {
  if (syncQueue) {
    await syncQueue.close();
    syncQueue = null;
  }

  if (backfillQueue) {
    await backfillQueue.close();
    backfillQueue = null;
  }

  if (syncQueueEvents) {
    await syncQueueEvents.close();
    syncQueueEvents = null;
  }
}
