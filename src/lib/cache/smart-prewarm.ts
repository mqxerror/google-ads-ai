/**
 * Smart Pre-warm Service
 *
 * Pre-warms ad group cache for visible/top campaigns to make drill-downs instant.
 *
 * Strategy:
 * - Pre-warm ad groups for top 10 visible campaigns (respects filters/sort)
 * - Do NOT pre-warm keywords/ads (on-demand only)
 * - Strict quota guardrails (max jobs/min/customer + backoff)
 * - Track progress: queued/running/completed
 *
 * Enable with: FF_SMART_PREWARM=true
 */

import prisma from '@/lib/prisma';
import { EntityType } from '@prisma/client';
import { enqueueAdGroupRefresh } from '@/lib/queue';

// Pre-warm configuration
export const PREWARM_CONFIG = {
  // Max campaigns to pre-warm per batch
  MAX_CAMPAIGNS_PER_BATCH: 10,

  // Max jobs per minute per customer (quota guardrail)
  MAX_JOBS_PER_MINUTE: 5,

  // Don't pre-warm if data was synced within this window
  CACHE_FRESH_THRESHOLD_MS: 30 * 60 * 1000, // 30 minutes

  // Delay between enqueue calls (rate limiting)
  ENQUEUE_DELAY_MS: 200,

  // Backoff when rate limited
  RATE_LIMIT_BACKOFF_MS: 60 * 1000, // 1 minute

  // Progress tracking key prefix in Redis
  PROGRESS_KEY_PREFIX: 'prewarm:progress:',

  // Average time per ad group fetch (for estimation)
  AVG_FETCH_TIME_MS: 2000,
};

export interface Campaign {
  id: string;
  name: string;
  spend: number;
  status?: string;
}

export interface PrewarmProgress {
  customerId: string;
  startedAt: string;
  totalCampaigns: number;
  queued: string[];
  running: string[];
  completed: string[];
  failed: string[];
  estimatedRemainingMs: number;
  lastUpdated: string;
}

export interface PrewarmResult {
  triggered: boolean;
  campaignsQueued: string[];
  campaignsSkipped: string[];
  campaignsAlreadyCached: string[];
  quotaLimited: boolean;
  reason?: string;
  progress?: PrewarmProgress;
}

// In-memory progress tracking (per customer)
const progressStore = new Map<string, PrewarmProgress>();

// Rate limiting: track jobs per customer
const jobCounters = new Map<string, { count: number; resetAt: number }>();

/**
 * Check quota: max jobs per minute per customer
 */
function checkQuota(customerId: string): { allowed: boolean; waitMs: number } {
  const now = Date.now();
  const counter = jobCounters.get(customerId);

  if (!counter || now > counter.resetAt) {
    // Reset counter
    jobCounters.set(customerId, { count: 0, resetAt: now + 60000 });
    return { allowed: true, waitMs: 0 };
  }

  if (counter.count >= PREWARM_CONFIG.MAX_JOBS_PER_MINUTE) {
    return { allowed: false, waitMs: counter.resetAt - now };
  }

  return { allowed: true, waitMs: 0 };
}

/**
 * Increment job counter for quota tracking
 */
function incrementJobCounter(customerId: string): void {
  const counter = jobCounters.get(customerId);
  if (counter) {
    counter.count++;
  }
}

/**
 * Check if ad groups are already cached for a campaign
 */
async function hasAdGroupCache(
  customerId: string,
  campaignId: string,
  startDate: string,
  endDate: string
): Promise<boolean> {
  const count = await prisma.metricsFact.count({
    where: {
      customerId,
      entityType: EntityType.AD_GROUP,
      parentEntityId: campaignId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
      syncedAt: {
        gte: new Date(Date.now() - PREWARM_CONFIG.CACHE_FRESH_THRESHOLD_MS),
      },
    },
  });

  return count > 0;
}

/**
 * Initialize progress tracking for a pre-warm batch
 */
function initProgress(customerId: string, campaignIds: string[]): PrewarmProgress {
  const progress: PrewarmProgress = {
    customerId,
    startedAt: new Date().toISOString(),
    totalCampaigns: campaignIds.length,
    queued: [...campaignIds],
    running: [],
    completed: [],
    failed: [],
    estimatedRemainingMs: campaignIds.length * PREWARM_CONFIG.AVG_FETCH_TIME_MS,
    lastUpdated: new Date().toISOString(),
  };

  progressStore.set(customerId, progress);
  return progress;
}

/**
 * Update progress when a job starts
 */
export function markJobRunning(customerId: string, campaignId: string): void {
  const progress = progressStore.get(customerId);
  if (!progress) return;

  progress.queued = progress.queued.filter(id => id !== campaignId);
  if (!progress.running.includes(campaignId)) {
    progress.running.push(campaignId);
  }
  progress.lastUpdated = new Date().toISOString();
  updateEstimate(progress);
}

/**
 * Update progress when a job completes
 */
export function markJobCompleted(customerId: string, campaignId: string): void {
  const progress = progressStore.get(customerId);
  if (!progress) return;

  progress.running = progress.running.filter(id => id !== campaignId);
  progress.queued = progress.queued.filter(id => id !== campaignId);
  if (!progress.completed.includes(campaignId)) {
    progress.completed.push(campaignId);
  }
  progress.lastUpdated = new Date().toISOString();
  updateEstimate(progress);

  // Clean up if all done
  if (progress.queued.length === 0 && progress.running.length === 0) {
    setTimeout(() => progressStore.delete(customerId), 60000); // Keep for 1 min after done
  }
}

/**
 * Update progress when a job fails
 */
export function markJobFailed(customerId: string, campaignId: string): void {
  const progress = progressStore.get(customerId);
  if (!progress) return;

  progress.running = progress.running.filter(id => id !== campaignId);
  progress.queued = progress.queued.filter(id => id !== campaignId);
  if (!progress.failed.includes(campaignId)) {
    progress.failed.push(campaignId);
  }
  progress.lastUpdated = new Date().toISOString();
  updateEstimate(progress);
}

/**
 * Update estimated remaining time
 */
function updateEstimate(progress: PrewarmProgress): void {
  const remaining = progress.queued.length + progress.running.length;
  progress.estimatedRemainingMs = remaining * PREWARM_CONFIG.AVG_FETCH_TIME_MS;
}

/**
 * Get current pre-warm progress for a customer
 */
export function getProgress(customerId: string): PrewarmProgress | null {
  return progressStore.get(customerId) || null;
}

/**
 * Get all active pre-warm progress
 */
export function getAllProgress(): PrewarmProgress[] {
  return Array.from(progressStore.values());
}

/**
 * Smart pre-warm ad groups for visible/top campaigns
 *
 * @param visibleCampaigns - Campaigns currently visible (already filtered/sorted by frontend)
 * @param params - API params for fetching ad groups
 */
export async function smartPrewarmAdGroups(
  visibleCampaigns: Campaign[],
  params: {
    refreshToken: string;
    accountId: string;
    customerId: string;
    parentManagerId?: string;
    startDate: string;
    endDate: string;
  }
): Promise<PrewarmResult> {
  const result: PrewarmResult = {
    triggered: false,
    campaignsQueued: [],
    campaignsSkipped: [],
    campaignsAlreadyCached: [],
    quotaLimited: false,
  };

  if (visibleCampaigns.length === 0) {
    result.reason = 'No campaigns to pre-warm';
    return result;
  }

  // Take top N visible campaigns (already sorted by frontend)
  const eligibleCampaigns = visibleCampaigns
    .filter(c => c.status !== 'REMOVED')
    .slice(0, PREWARM_CONFIG.MAX_CAMPAIGNS_PER_BATCH);

  if (eligibleCampaigns.length === 0) {
    result.reason = 'No eligible campaigns (all removed)';
    return result;
  }

  // Check quota before starting
  const quota = checkQuota(params.customerId);
  if (!quota.allowed) {
    result.quotaLimited = true;
    result.reason = `Quota limited. Wait ${Math.ceil(quota.waitMs / 1000)}s`;
    return result;
  }

  // Check which campaigns need pre-warming
  const needsPrewarm: Campaign[] = [];

  for (const campaign of eligibleCampaigns) {
    const hasCache = await hasAdGroupCache(
      params.customerId,
      campaign.id,
      params.startDate,
      params.endDate
    );

    if (hasCache) {
      result.campaignsAlreadyCached.push(campaign.id);
    } else {
      needsPrewarm.push(campaign);
    }
  }

  if (needsPrewarm.length === 0) {
    result.reason = 'All visible campaigns already cached';
    return result;
  }

  // Initialize progress tracking
  const campaignIds = needsPrewarm.map(c => c.id);
  const progress = initProgress(params.customerId, campaignIds);
  result.progress = progress;

  // Enqueue pre-warm jobs with quota limits
  for (const campaign of needsPrewarm) {
    // Re-check quota before each job
    const jobQuota = checkQuota(params.customerId);
    if (!jobQuota.allowed) {
      result.quotaLimited = true;
      result.campaignsSkipped.push(campaign.id);
      // Remove from queued
      progress.queued = progress.queued.filter(id => id !== campaign.id);
      continue;
    }

    try {
      const jobResult = await enqueueAdGroupRefresh({
        refreshToken: params.refreshToken,
        accountId: params.accountId,
        customerId: params.customerId,
        campaignId: campaign.id,
        parentManagerId: params.parentManagerId,
        startDate: params.startDate,
        endDate: params.endDate,
      });

      if (jobResult && jobResult !== 'duplicate' && jobResult !== 'rate-limited') {
        result.campaignsQueued.push(campaign.id);
        result.triggered = true;
        incrementJobCounter(params.customerId);

        // Small delay to avoid queue flooding
        if (PREWARM_CONFIG.ENQUEUE_DELAY_MS > 0) {
          await new Promise(r => setTimeout(r, PREWARM_CONFIG.ENQUEUE_DELAY_MS));
        }
      } else {
        result.campaignsSkipped.push(campaign.id);
        progress.queued = progress.queued.filter(id => id !== campaign.id);
      }
    } catch (err) {
      console.warn(`[SmartPrewarm] Failed to enqueue campaign ${campaign.id}:`, err);
      result.campaignsSkipped.push(campaign.id);
      markJobFailed(params.customerId, campaign.id);
    }
  }

  if (result.campaignsQueued.length > 0) {
    console.log(
      `[SmartPrewarm] Queued ${result.campaignsQueued.length}/${needsPrewarm.length} campaigns for pre-warm`
    );
  }

  return result;
}

/**
 * Get pre-warm cache status for campaigns
 * Returns warm/cold status for each campaign
 */
export async function getPrewarmStatus(
  customerId: string,
  campaignIds: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, 'warm' | 'cold' | 'warming'>> {
  const status = new Map<string, 'warm' | 'cold' | 'warming'>();
  const progress = getProgress(customerId);

  for (const campaignId of campaignIds) {
    // Check if currently warming
    if (progress?.running.includes(campaignId) || progress?.queued.includes(campaignId)) {
      status.set(campaignId, 'warming');
      continue;
    }

    // Check if cached
    const hasCache = await hasAdGroupCache(customerId, campaignId, startDate, endDate);
    status.set(campaignId, hasCache ? 'warm' : 'cold');
  }

  return status;
}
