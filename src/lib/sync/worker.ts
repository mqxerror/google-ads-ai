/**
 * BullMQ Worker
 *
 * Processes sync jobs in the background.
 * Fetches data from Google Ads API and stores in MetricsFact table.
 */

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './redis';
import { QUEUE_NAMES, SyncJobData, BackfillJobData } from './queue';
import { prisma } from '@/lib/prisma';
import { EntityType, DataFreshness, SyncStatus, Prisma } from '@prisma/client';
import { fetchCampaigns, fetchAdGroups, fetchKeywords, fetchAds } from '@/lib/google-ads';
import { format, isToday, parseISO } from 'date-fns';

// Worker instances
let syncWorker: Worker<SyncJobData> | null = null;
let backfillWorker: Worker<BackfillJobData> | null = null;

/**
 * Start the sync worker
 */
export function startSyncWorker(): Worker<SyncJobData> | null {
  if (syncWorker) return syncWorker;

  const connection = getRedisConnection();
  if (!connection) {
    console.log('[Worker] Redis unavailable, sync worker not started');
    return null;
  }

  syncWorker = new Worker<SyncJobData>(
    QUEUE_NAMES.METRICS_SYNC,
    async (job: Job<SyncJobData>) => {
      console.log(`[Worker] Processing sync job: ${job.id}`);

      try {
        await processSyncJob(job.data, (progress) => {
          job.updateProgress(progress);
        });

        return { success: true, processedAt: new Date().toISOString() };
      } catch (error) {
        console.error(`[Worker] Sync job failed: ${job.id}`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 2, // Process 2 jobs at a time
      limiter: {
        max: 10,
        duration: 60000, // Max 10 jobs per minute (API rate limiting)
      },
    }
  );

  syncWorker.on('completed', (job) => {
    console.log(`[Worker] Sync job completed: ${job.id}`);
  });

  syncWorker.on('failed', (job, err) => {
    console.error(`[Worker] Sync job failed: ${job?.id}`, err);
  });

  console.log('[Worker] Sync worker started');
  return syncWorker;
}

/**
 * Start the backfill worker
 */
export function startBackfillWorker(): Worker<BackfillJobData> | null {
  if (backfillWorker) return backfillWorker;

  const connection = getRedisConnection();
  if (!connection) {
    console.log('[Worker] Redis unavailable, backfill worker not started');
    return null;
  }

  backfillWorker = new Worker<BackfillJobData>(
    QUEUE_NAMES.BACKFILL,
    async (job: Job<BackfillJobData>) => {
      console.log(`[Worker] Processing backfill job: ${job.id}`);

      try {
        await processSyncJob(job.data, (progress) => {
          job.updateProgress(progress);
        });

        // Update backfill progress
        const progressPercent = ((job.data.batchNumber + 1) / job.data.totalBatches) * 100;

        await prisma.syncMetadata.update({
          where: {
            customerId_entityType: {
              customerId: job.data.customerId,
              entityType: job.data.entityType,
            },
          },
          data: {
            backfillProgress: new Prisma.Decimal(progressPercent),
          },
        });

        return { success: true, batch: job.data.batchNumber, processedAt: new Date().toISOString() };
      } catch (error) {
        console.error(`[Worker] Backfill job failed: ${job.id}`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1, // Process 1 backfill job at a time
      limiter: {
        max: 5,
        duration: 60000, // Max 5 backfill jobs per minute
      },
    }
  );

  backfillWorker.on('completed', (job) => {
    console.log(`[Worker] Backfill job completed: ${job.id}`);
  });

  backfillWorker.on('failed', (job, err) => {
    console.error(`[Worker] Backfill job failed: ${job?.id}`, err);
  });

  console.log('[Worker] Backfill worker started');
  return backfillWorker;
}

/**
 * Process a sync job
 */
async function processSyncJob(
  data: SyncJobData,
  onProgress: (progress: number) => void
): Promise<void> {
  const { accountId, customerId, refreshToken, entityType, startDate, endDate, loginCustomerId } = data;

  // Update sync metadata to IN_PROGRESS
  await prisma.syncMetadata.upsert({
    where: {
      customerId_entityType: {
        customerId,
        entityType,
      },
    },
    create: {
      customerId,
      entityType,
      accountId,
      lastSyncStatus: SyncStatus.IN_PROGRESS,
      lastSyncStarted: new Date(),
    },
    update: {
      lastSyncStatus: SyncStatus.IN_PROGRESS,
      lastSyncStarted: new Date(),
    },
  });

  onProgress(10);

  try {
    let metricsData: Array<{
      entityId: string;
      parentEntityId?: string;
      date: string;
      impressions: number;
      clicks: number;
      costMicros: bigint;
      conversions: number;
      conversionsValue: number;
    }> = [];

    // Fetch data based on entity type
    switch (entityType) {
      case EntityType.CAMPAIGN:
        const campaigns = await fetchCampaigns(refreshToken, customerId, startDate, endDate, loginCustomerId);
        metricsData = campaigns.map(c => ({
          entityId: c.id,
          date: endDate, // Aggregated for now
          impressions: c.impressions || 0,
          clicks: c.clicks || 0,
          costMicros: BigInt(Math.round((c.spend || 0) * 1_000_000)),
          conversions: c.conversions || 0,
          conversionsValue: (c as { conversionValue?: number }).conversionValue || 0,
        }));
        break;

      case EntityType.AD_GROUP:
        // Would need campaign ID to fetch ad groups
        // This is handled by the SyncService which orchestrates the full sync
        break;

      case EntityType.KEYWORD:
        // Would need ad group ID to fetch keywords
        break;

      case EntityType.AD:
        // Would need ad group ID to fetch ads
        break;
    }

    onProgress(50);

    // Determine data freshness
    const dataFreshness = isToday(parseISO(endDate))
      ? DataFreshness.PARTIAL
      : DataFreshness.FINAL;

    // Upsert metrics to database
    let rowsWritten = 0;

    for (const metric of metricsData) {
      const ctr = metric.impressions > 0
        ? (metric.clicks / metric.impressions)
        : 0;
      const averageCpc = metric.clicks > 0
        ? Number(metric.costMicros) / metric.clicks / 1_000_000
        : 0;

      await prisma.metricsFact.upsert({
        where: {
          customerId_entityType_entityId_date: {
            customerId,
            entityType,
            entityId: metric.entityId,
            date: new Date(metric.date),
          },
        },
        create: {
          customerId,
          entityType,
          entityId: metric.entityId,
          parentEntityId: metric.parentEntityId,
          date: new Date(metric.date),
          impressions: BigInt(metric.impressions),
          clicks: BigInt(metric.clicks),
          costMicros: metric.costMicros,
          conversions: new Prisma.Decimal(metric.conversions),
          conversionsValue: new Prisma.Decimal(metric.conversionsValue),
          ctr: new Prisma.Decimal(ctr),
          averageCpc: new Prisma.Decimal(averageCpc),
          accountId,
          dataFreshness,
        },
        update: {
          impressions: BigInt(metric.impressions),
          clicks: BigInt(metric.clicks),
          costMicros: metric.costMicros,
          conversions: new Prisma.Decimal(metric.conversions),
          conversionsValue: new Prisma.Decimal(metric.conversionsValue),
          ctr: new Prisma.Decimal(ctr),
          averageCpc: new Prisma.Decimal(averageCpc),
          dataFreshness,
          syncedAt: new Date(),
        },
      });

      rowsWritten++;
    }

    onProgress(90);

    // Update sync metadata to COMPLETED
    await prisma.syncMetadata.update({
      where: {
        customerId_entityType: {
          customerId,
          entityType,
        },
      },
      data: {
        lastSyncStatus: SyncStatus.COMPLETED,
        lastSyncCompleted: new Date(),
        lastSyncedDate: new Date(endDate),
        rowsWritten,
        lastSyncError: null,
      },
    });

    onProgress(100);
  } catch (error) {
    // Update sync metadata to FAILED
    await prisma.syncMetadata.update({
      where: {
        customerId_entityType: {
          customerId,
          entityType,
        },
      },
      data: {
        lastSyncStatus: SyncStatus.FAILED,
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

/**
 * Stop all workers
 */
export async function stopWorkers(): Promise<void> {
  if (syncWorker) {
    await syncWorker.close();
    syncWorker = null;
    console.log('[Worker] Sync worker stopped');
  }

  if (backfillWorker) {
    await backfillWorker.close();
    backfillWorker = null;
    console.log('[Worker] Backfill worker stopped');
  }
}

/**
 * Check if workers are running
 */
export function areWorkersRunning(): boolean {
  return syncWorker !== null || backfillWorker !== null;
}
