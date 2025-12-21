/**
 * Production Background Refresh Worker
 *
 * Features:
 * - Processes jobs from BullMQ queue
 * - Exponential backoff with jitter on rate limits
 * - Job outcome persistence to database
 * - Idempotent job handlers (safe to run twice)
 * - Smallest scope refresh (only what's stale)
 */

import { Worker, Job, UnrecoverableError } from 'bullmq';
import { getRedisOptions, updateWorkerHeartbeat } from './redis';
import { RefreshJobData, RefreshJobResult, generateJobId } from './refresh-queue';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma';
import {
  fetchCampaigns,
  fetchAdGroups,
  fetchKeywords,
  fetchAds,
  fetchDailyMetrics,
} from '../google-ads';
import { EntityType, DataFreshness, Prisma } from '@prisma/client';
import { isToday, parseISO } from 'date-fns';
import { validateCampaignHierarchy } from '../validation/hierarchy-validation';
import { markJobRunning, markJobCompleted, markJobFailed } from '../cache/smart-prewarm';

// Post-refresh validation sampling rate
const POST_REFRESH_VALIDATION_SAMPLE_RATE = 0.10; // 10% of refresh jobs

const QUEUE_NAME = 'gads-refresh';

// Worker instance
let refreshWorker: Worker<RefreshJobData, RefreshJobResult> | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let workerId: string = '';
let jobsProcessed = 0;

// ============================================
// Backoff with Jitter
// ============================================

/**
 * Calculate exponential backoff with jitter
 * Prevents thundering herd on rate limit recovery
 */
function calculateBackoffWithJitter(baseDelayMs: number, attempt: number): number {
  // Exponential: 60s, 120s, 240s... capped at 10 minutes
  const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 10 * 60 * 1000);

  // Add ±25% jitter
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.round(exponentialDelay + jitter);
}

// ============================================
// Job Logging
// ============================================

async function logJobStart(job: Job<RefreshJobData>): Promise<string> {
  const log = await prisma.refreshJobLog.upsert({
    where: {
      // Use job ID for idempotency
      id: job.id || generateJobId(job.data),
    },
    create: {
      id: job.id || generateJobId(job.data),
      jobId: job.id || generateJobId(job.data),
      customerId: job.data.customerId,
      accountId: job.data.accountId,
      jobType: job.data.type,
      parentEntityId: job.data.parentEntityId,
      startDate: job.data.startDate,
      endDate: job.data.endDate,
      priority: job.data.priority,
      status: 'processing',
      attemptNumber: job.attemptsMade + 1,
      enqueuedAt: new Date(job.data.enqueuedAt),
      startedAt: new Date(),
    },
    update: {
      status: 'processing',
      attemptNumber: job.attemptsMade + 1,
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  return log.id;
}

async function logJobComplete(
  logId: string,
  result: RefreshJobResult
): Promise<void> {
  await prisma.refreshJobLog.update({
    where: { id: logId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      durationMs: result.duration,
      entityCount: result.entityCount,
      apiCalls: result.apiCalls,
    },
  });
}

async function logJobFailed(
  logId: string,
  error: string,
  nextRetryAt?: Date
): Promise<void> {
  await prisma.refreshJobLog.update({
    where: { id: logId },
    data: {
      status: nextRetryAt ? 'retrying' : 'failed',
      completedAt: new Date(),
      errorMessage: error,
      nextRetryAt,
    },
  });
}

// ============================================
// Worker Initialization
// ============================================

export async function startRefreshWorker(): Promise<void> {
  if (refreshWorker) {
    console.log('[Worker] Already running');
    return;
  }

  // Generate unique worker ID
  workerId = `worker-${uuidv4().slice(0, 8)}`;
  jobsProcessed = 0;

  const connection = getRedisOptions();

  refreshWorker = new Worker<RefreshJobData, RefreshJobResult>(
    QUEUE_NAME,
    async (job: Job<RefreshJobData>) => processRefreshJob(job),
    {
      connection,
      concurrency: 1, // Process one job at a time per worker
      // Rate limiting: 1 job per 2 seconds
      limiter: {
        max: 1,
        duration: 2000,
      },
    }
  );

  refreshWorker.on('completed', (job, result) => {
    jobsProcessed++;
    console.log(`[Worker] ✓ ${job.data.type} completed: ${result.entityCount} entities in ${result.duration}ms`);
    // Update heartbeat after each job
    updateWorkerHeartbeat(workerId, jobsProcessed).catch(() => {});
  });

  refreshWorker.on('failed', (job, err) => {
    console.error(`[Worker] ✗ ${job?.data.type} failed:`, err.message);
    // Update heartbeat even on failure
    updateWorkerHeartbeat(workerId, jobsProcessed).catch(() => {});
  });

  refreshWorker.on('error', (err) => {
    console.error('[Worker] Error:', err);
  });

  // Start heartbeat interval (every 15 seconds)
  heartbeatInterval = setInterval(() => {
    updateWorkerHeartbeat(workerId, jobsProcessed).catch(() => {});
  }, 15000);

  // Initial heartbeat
  await updateWorkerHeartbeat(workerId, jobsProcessed);

  console.log(`[Worker] Started with ID: ${workerId}`);
}

export async function stopRefreshWorker(): Promise<void> {
  // Stop heartbeat interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (refreshWorker) {
    await refreshWorker.close();
    refreshWorker = null;
    console.log('[Worker] Stopped');
  }
}

// ============================================
// Job Processing
// ============================================

async function processRefreshJob(
  job: Job<RefreshJobData>
): Promise<RefreshJobResult> {
  const startTime = Date.now();
  const { data } = job;
  let apiCalls = 0;

  // Log job start
  const logId = await logJobStart(job);

  console.log(`[Worker] Processing ${data.type} for ${data.customerId} (attempt ${job.attemptsMade + 1})`);

  try {
    let entityCount = 0;
    apiCalls = 1; // Each refresh is typically 1 API call

    switch (data.type) {
      case 'refresh:campaigns':
        entityCount = await refreshCampaigns(data);
        break;
      case 'refresh:ad-groups':
        entityCount = await refreshAdGroups(data);
        break;
      case 'refresh:keywords':
        entityCount = await refreshKeywords(data);
        break;
      case 'refresh:ads':
        entityCount = await refreshAds(data);
        break;
      case 'refresh:reports':
        entityCount = await refreshReports(data);
        break;
      default:
        throw new Error(`Unknown job type: ${data.type}`);
    }

    const result: RefreshJobResult = {
      success: true,
      entityCount,
      duration: Date.now() - startTime,
      apiCalls,
    };

    await logJobComplete(logId, result);
    return result;

  } catch (error) {
    const errorStr = String(error);
    const duration = Date.now() - startTime;

    // Check for Google Ads rate limit
    const retryMatch = errorStr.match(/Retry in (\d+) seconds/);
    if (retryMatch) {
      const googleDelay = parseInt(retryMatch[1], 10) * 1000;
      const backoffDelay = calculateBackoffWithJitter(googleDelay, job.attemptsMade + 1);

      console.warn(`[Worker] Rate limited. Will retry with exponential backoff.`);

      await logJobFailed(logId, errorStr, new Date(Date.now() + backoffDelay));

      // Throw error to trigger BullMQ's built-in exponential backoff retry
      throw new Error(`Rate limited: ${errorStr}`);
    }

    // Check for quota exceeded (harder limit)
    if (errorStr.includes('RESOURCE_EXHAUSTED') || errorStr.includes('quota')) {
      const backoffDelay = calculateBackoffWithJitter(5 * 60 * 1000, job.attemptsMade + 1); // 5 min base

      console.error(`[Worker] Quota exhausted. Will retry with exponential backoff.`);

      await logJobFailed(logId, errorStr, new Date(Date.now() + backoffDelay));
      // Throw error to trigger BullMQ's built-in exponential backoff retry
      throw new Error(`Quota exhausted: ${errorStr}`);
    }

    // Other errors - log and fail (will use default retry)
    await logJobFailed(logId, errorStr);

    return {
      success: false,
      error: errorStr,
      duration,
      apiCalls,
    };
  }
}

// ============================================
// Entity-Specific Refresh (Idempotent)
// ============================================

async function refreshCampaigns(data: RefreshJobData): Promise<number> {
  const campaigns = await fetchCampaigns(
    data.refreshToken,
    data.customerId,
    data.parentManagerId,
    data.startDate,
    data.endDate
  );

  await storeCampaignMetrics(
    data.accountId,
    data.customerId,
    campaigns,
    data.endDate
  );

  await prisma.googleAdsAccount.update({
    where: { id: data.accountId },
    data: { lastSyncAt: new Date() },
  });

  // Run sampled hierarchy validation after refresh (10% of jobs)
  // This catches sync issues early, before users see discrepancies
  if (Math.random() < POST_REFRESH_VALIDATION_SAMPLE_RATE) {
    try {
      const validation = await validateCampaignHierarchy(
        data.customerId,
        data.startDate,
        data.endDate,
        0.05, // 5% tolerance
        'refresh' // Trigger type for persistence
      );

      if (validation.mismatches.length > 0) {
        console.warn(
          `[Worker] Post-refresh validation found ${validation.mismatches.length} mismatches ` +
          `for ${data.customerId} (persisted: ${validation.persistedEvents})`
        );
      }
    } catch (err) {
      // Don't fail the job if validation fails
      console.warn('[Worker] Post-refresh validation error:', err);
    }
  }

  return campaigns.length;
}

async function refreshAdGroups(data: RefreshJobData): Promise<number> {
  if (!data.parentEntityId) {
    throw new Error('parentEntityId (campaignId) required');
  }

  // Track prewarm progress: mark job as running
  markJobRunning(data.customerId, data.parentEntityId);

  try {
    const adGroups = await fetchAdGroups(
      data.refreshToken,
      data.customerId,
      data.parentEntityId,
      data.startDate,
      data.endDate,
      data.parentManagerId
    );

    await storeAdGroupMetrics(
      data.accountId,
      data.customerId,
      data.parentEntityId,
      adGroups,
      data.endDate
    );

    // Track prewarm progress: mark job as completed
    markJobCompleted(data.customerId, data.parentEntityId);

    return adGroups.length;
  } catch (error) {
    // Track prewarm progress: mark job as failed
    markJobFailed(data.customerId, data.parentEntityId);
    throw error;
  }
}

async function refreshKeywords(data: RefreshJobData): Promise<number> {
  if (!data.parentEntityId) {
    throw new Error('parentEntityId (adGroupId) required');
  }

  const keywords = await fetchKeywords(
    data.refreshToken,
    data.customerId,
    data.parentEntityId,
    data.startDate,
    data.endDate,
    data.parentManagerId
  );

  await storeKeywordMetrics(
    data.accountId,
    data.customerId,
    data.parentEntityId,
    keywords,
    data.endDate
  );

  return keywords.length;
}

async function refreshAds(data: RefreshJobData): Promise<number> {
  if (!data.parentEntityId) {
    throw new Error('parentEntityId (adGroupId) required');
  }

  const ads = await fetchAds(
    data.refreshToken,
    data.customerId,
    data.parentEntityId,
    data.startDate,
    data.endDate,
    data.parentManagerId
  );

  await storeAdMetrics(
    data.accountId,
    data.customerId,
    data.parentEntityId,
    ads,
    data.endDate
  );

  return ads.length;
}

async function refreshReports(data: RefreshJobData): Promise<number> {
  const metrics = await fetchDailyMetrics(
    data.refreshToken,
    data.customerId,
    data.startDate,
    data.endDate,
    data.parentManagerId
  );

  await storeDailyMetrics(data.accountId, data.customerId, metrics);

  return metrics.length;
}

// ============================================
// Storage Functions (Idempotent via upsert)
// ============================================

async function storeCampaignMetrics(
  accountId: string,
  customerId: string,
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    type?: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    conversionValue?: number;
  }>,
  endDate: string
): Promise<void> {
  const dataFreshness = isToday(parseISO(endDate))
    ? DataFreshness.PARTIAL
    : DataFreshness.FINAL;

  // Use transaction for atomicity
  await prisma.$transaction(
    campaigns.map((campaign) =>
      prisma.metricsFact.upsert({
        where: {
          customerId_entityType_entityId_date: {
            customerId,
            entityType: EntityType.CAMPAIGN,
            entityId: campaign.id,
            date: new Date(endDate),
          },
        },
        create: {
          customerId,
          entityType: EntityType.CAMPAIGN,
          entityId: campaign.id,
          date: new Date(endDate),
          impressions: BigInt(campaign.impressions || 0),
          clicks: BigInt(campaign.clicks || 0),
          costMicros: BigInt(Math.round((campaign.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(campaign.conversions || 0),
          conversionsValue: new Prisma.Decimal(campaign.conversionValue || 0),
          ctr: new Prisma.Decimal(campaign.impressions > 0 ? campaign.clicks / campaign.impressions : 0),
          averageCpc: new Prisma.Decimal(campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0),
          accountId,
          dataFreshness,
        },
        update: {
          impressions: BigInt(campaign.impressions || 0),
          clicks: BigInt(campaign.clicks || 0),
          costMicros: BigInt(Math.round((campaign.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(campaign.conversions || 0),
          conversionsValue: new Prisma.Decimal(campaign.conversionValue || 0),
          ctr: new Prisma.Decimal(campaign.impressions > 0 ? campaign.clicks / campaign.impressions : 0),
          averageCpc: new Prisma.Decimal(campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0),
          dataFreshness,
          syncedAt: new Date(),
        },
      })
    )
  );

  // Update hierarchy (separate transaction for isolation)
  await prisma.$transaction(
    campaigns.map((campaign) =>
      prisma.entityHierarchy.upsert({
        where: {
          customerId_entityType_entityId: {
            customerId,
            entityType: EntityType.CAMPAIGN,
            entityId: campaign.id,
          },
        },
        create: {
          customerId,
          entityType: EntityType.CAMPAIGN,
          entityId: campaign.id,
          entityName: campaign.name,
          status: campaign.status,
          campaignType: campaign.type || null,
          accountId,
        },
        update: {
          entityName: campaign.name,
          status: campaign.status,
          campaignType: campaign.type || null,
          lastUpdated: new Date(),
        },
      })
    )
  );

  console.log(`[Worker] Stored ${campaigns.length} campaigns`);
}

async function storeAdGroupMetrics(
  accountId: string,
  customerId: string,
  campaignId: string,
  adGroups: Array<{
    id: string;
    name: string;
    status: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
  }>,
  endDate: string
): Promise<void> {
  const dataFreshness = isToday(parseISO(endDate))
    ? DataFreshness.PARTIAL
    : DataFreshness.FINAL;

  await prisma.$transaction(
    adGroups.map((adGroup) =>
      prisma.metricsFact.upsert({
        where: {
          customerId_entityType_entityId_date: {
            customerId,
            entityType: EntityType.AD_GROUP,
            entityId: adGroup.id,
            date: new Date(endDate),
          },
        },
        create: {
          customerId,
          entityType: EntityType.AD_GROUP,
          entityId: adGroup.id,
          parentEntityType: EntityType.CAMPAIGN,
          parentEntityId: campaignId,
          date: new Date(endDate),
          impressions: BigInt(adGroup.impressions || 0),
          clicks: BigInt(adGroup.clicks || 0),
          costMicros: BigInt(Math.round((adGroup.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(adGroup.conversions || 0),
          conversionsValue: new Prisma.Decimal(0),
          ctr: new Prisma.Decimal(adGroup.impressions > 0 ? adGroup.clicks / adGroup.impressions : 0),
          averageCpc: new Prisma.Decimal(adGroup.clicks > 0 ? adGroup.spend / adGroup.clicks : 0),
          accountId,
          dataFreshness,
        },
        update: {
          parentEntityId: campaignId,
          impressions: BigInt(adGroup.impressions || 0),
          clicks: BigInt(adGroup.clicks || 0),
          costMicros: BigInt(Math.round((adGroup.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(adGroup.conversions || 0),
          ctr: new Prisma.Decimal(adGroup.impressions > 0 ? adGroup.clicks / adGroup.impressions : 0),
          averageCpc: new Prisma.Decimal(adGroup.clicks > 0 ? adGroup.spend / adGroup.clicks : 0),
          dataFreshness,
          syncedAt: new Date(),
        },
      })
    )
  );

  await prisma.$transaction(
    adGroups.map((adGroup) =>
      prisma.entityHierarchy.upsert({
        where: {
          customerId_entityType_entityId: {
            customerId,
            entityType: EntityType.AD_GROUP,
            entityId: adGroup.id,
          },
        },
        create: {
          customerId,
          entityType: EntityType.AD_GROUP,
          entityId: adGroup.id,
          entityName: adGroup.name,
          status: adGroup.status,
          parentEntityType: EntityType.CAMPAIGN,
          parentEntityId: campaignId,
          accountId,
        },
        update: {
          entityName: adGroup.name,
          status: adGroup.status,
          parentEntityId: campaignId,
          lastUpdated: new Date(),
        },
      })
    )
  );

  console.log(`[Worker] Stored ${adGroups.length} ad groups`);
}

async function storeKeywordMetrics(
  accountId: string,
  customerId: string,
  adGroupId: string,
  keywords: Array<{
    id: string;
    text: string;
    status: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
  }>,
  endDate: string
): Promise<void> {
  const dataFreshness = isToday(parseISO(endDate))
    ? DataFreshness.PARTIAL
    : DataFreshness.FINAL;

  await prisma.$transaction(
    keywords.map((keyword) =>
      prisma.metricsFact.upsert({
        where: {
          customerId_entityType_entityId_date: {
            customerId,
            entityType: EntityType.KEYWORD,
            entityId: keyword.id,
            date: new Date(endDate),
          },
        },
        create: {
          customerId,
          entityType: EntityType.KEYWORD,
          entityId: keyword.id,
          parentEntityType: EntityType.AD_GROUP,
          parentEntityId: adGroupId,
          date: new Date(endDate),
          impressions: BigInt(keyword.impressions || 0),
          clicks: BigInt(keyword.clicks || 0),
          costMicros: BigInt(Math.round((keyword.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(keyword.conversions || 0),
          conversionsValue: new Prisma.Decimal(0),
          ctr: new Prisma.Decimal(keyword.impressions > 0 ? keyword.clicks / keyword.impressions : 0),
          averageCpc: new Prisma.Decimal(keyword.clicks > 0 ? keyword.spend / keyword.clicks : 0),
          accountId,
          dataFreshness,
        },
        update: {
          parentEntityId: adGroupId,
          impressions: BigInt(keyword.impressions || 0),
          clicks: BigInt(keyword.clicks || 0),
          costMicros: BigInt(Math.round((keyword.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(keyword.conversions || 0),
          ctr: new Prisma.Decimal(keyword.impressions > 0 ? keyword.clicks / keyword.impressions : 0),
          averageCpc: new Prisma.Decimal(keyword.clicks > 0 ? keyword.spend / keyword.clicks : 0),
          dataFreshness,
          syncedAt: new Date(),
        },
      })
    )
  );

  await prisma.$transaction(
    keywords.map((keyword) =>
      prisma.entityHierarchy.upsert({
        where: {
          customerId_entityType_entityId: {
            customerId,
            entityType: EntityType.KEYWORD,
            entityId: keyword.id,
          },
        },
        create: {
          customerId,
          entityType: EntityType.KEYWORD,
          entityId: keyword.id,
          entityName: keyword.text,
          status: keyword.status,
          parentEntityType: EntityType.AD_GROUP,
          parentEntityId: adGroupId,
          accountId,
        },
        update: {
          entityName: keyword.text,
          status: keyword.status,
          parentEntityId: adGroupId,
          lastUpdated: new Date(),
        },
      })
    )
  );

  console.log(`[Worker] Stored ${keywords.length} keywords`);
}

async function storeAdMetrics(
  accountId: string,
  customerId: string,
  adGroupId: string,
  ads: Array<{
    id: string;
    status: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
  }>,
  endDate: string
): Promise<void> {
  const dataFreshness = isToday(parseISO(endDate))
    ? DataFreshness.PARTIAL
    : DataFreshness.FINAL;

  await prisma.$transaction(
    ads.map((ad) =>
      prisma.metricsFact.upsert({
        where: {
          customerId_entityType_entityId_date: {
            customerId,
            entityType: EntityType.AD,
            entityId: ad.id,
            date: new Date(endDate),
          },
        },
        create: {
          customerId,
          entityType: EntityType.AD,
          entityId: ad.id,
          parentEntityType: EntityType.AD_GROUP,
          parentEntityId: adGroupId,
          date: new Date(endDate),
          impressions: BigInt(ad.impressions || 0),
          clicks: BigInt(ad.clicks || 0),
          costMicros: BigInt(Math.round((ad.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(ad.conversions || 0),
          conversionsValue: new Prisma.Decimal(0),
          ctr: new Prisma.Decimal(ad.impressions > 0 ? ad.clicks / ad.impressions : 0),
          averageCpc: new Prisma.Decimal(ad.clicks > 0 ? ad.spend / ad.clicks : 0),
          accountId,
          dataFreshness,
        },
        update: {
          parentEntityId: adGroupId,
          impressions: BigInt(ad.impressions || 0),
          clicks: BigInt(ad.clicks || 0),
          costMicros: BigInt(Math.round((ad.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(ad.conversions || 0),
          ctr: new Prisma.Decimal(ad.impressions > 0 ? ad.clicks / ad.impressions : 0),
          averageCpc: new Prisma.Decimal(ad.clicks > 0 ? ad.spend / ad.clicks : 0),
          dataFreshness,
          syncedAt: new Date(),
        },
      })
    )
  );

  await prisma.$transaction(
    ads.map((ad) =>
      prisma.entityHierarchy.upsert({
        where: {
          customerId_entityType_entityId: {
            customerId,
            entityType: EntityType.AD,
            entityId: ad.id,
          },
        },
        create: {
          customerId,
          entityType: EntityType.AD,
          entityId: ad.id,
          entityName: `Ad ${ad.id}`,
          status: ad.status,
          parentEntityType: EntityType.AD_GROUP,
          parentEntityId: adGroupId,
          accountId,
        },
        update: {
          status: ad.status,
          parentEntityId: adGroupId,
          lastUpdated: new Date(),
        },
      })
    )
  );

  console.log(`[Worker] Stored ${ads.length} ads`);
}

async function storeDailyMetrics(
  accountId: string,
  customerId: string,
  metrics: Array<{
    date: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    conversionValue?: number;
  }>
): Promise<void> {
  await prisma.$transaction(
    metrics.map((metric) => {
      const dataFreshness = isToday(parseISO(metric.date))
        ? DataFreshness.PARTIAL
        : DataFreshness.FINAL;

      return prisma.metricsFact.upsert({
        where: {
          customerId_entityType_entityId_date: {
            customerId,
            entityType: EntityType.ACCOUNT,
            entityId: customerId,
            date: new Date(metric.date),
          },
        },
        create: {
          customerId,
          entityType: EntityType.ACCOUNT,
          entityId: customerId,
          date: new Date(metric.date),
          impressions: BigInt(metric.impressions || 0),
          clicks: BigInt(metric.clicks || 0),
          costMicros: BigInt(Math.round((metric.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(metric.conversions || 0),
          conversionsValue: new Prisma.Decimal(metric.conversionValue || 0),
          ctr: new Prisma.Decimal(metric.impressions > 0 ? metric.clicks / metric.impressions : 0),
          averageCpc: new Prisma.Decimal(metric.clicks > 0 ? metric.spend / metric.clicks : 0),
          accountId,
          dataFreshness,
        },
        update: {
          impressions: BigInt(metric.impressions || 0),
          clicks: BigInt(metric.clicks || 0),
          costMicros: BigInt(Math.round((metric.spend || 0) * 1_000_000)),
          conversions: new Prisma.Decimal(metric.conversions || 0),
          conversionsValue: new Prisma.Decimal(metric.conversionValue || 0),
          ctr: new Prisma.Decimal(metric.impressions > 0 ? metric.clicks / metric.impressions : 0),
          averageCpc: new Prisma.Decimal(metric.clicks > 0 ? metric.spend / metric.clicks : 0),
          dataFreshness,
          syncedAt: new Date(),
        },
      });
    })
  );

  console.log(`[Worker] Stored ${metrics.length} daily metrics`);
}
