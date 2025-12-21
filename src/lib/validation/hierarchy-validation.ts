/**
 * Hierarchy Validation - Detect data regressions
 *
 * Checks that parent entity metrics ≈ SUM(child entity metrics) within tolerance
 * Uses DB-vs-DB comparison for consistency.
 *
 * Production hardening:
 * - Absolute thresholds to avoid false alarms on small values
 * - Divide-by-zero guards
 * - Same query context (date range, entity type)
 * - Persistence of mismatch events for trend analysis
 */

import prisma from '@/lib/prisma';
import { EntityType, Prisma } from '@prisma/client';

// ============================================
// Configuration
// ============================================

// Default tolerance: 5% variance allowed
const DEFAULT_TOLERANCE = 0.05;

// Maximum campaigns to validate per call (sampling)
const SAMPLE_SIZE = 10;

// Absolute minimum thresholds to avoid noise on small values
const MIN_THRESHOLDS = {
  spend: 1.00,          // Ignore campaigns with < $1 spend
  clicks: 10,           // Ignore if < 10 clicks
  impressions: 100,     // Ignore if < 100 impressions
  conversions: 0.5,     // Ignore if < 0.5 conversions
};

// Absolute difference thresholds - don't flag if absolute diff is tiny
const MIN_ABSOLUTE_DIFF = {
  spend: 0.50,          // < $0.50 difference is rounding noise
  clicks: 2,            // < 2 clicks difference is noise
  impressions: 10,      // < 10 impressions difference is noise
  conversions: 0.1,     // < 0.1 conversions difference is noise
};

// ============================================
// Types
// ============================================

export type ValidationTrigger = 'cache_hit' | 'refresh' | 'manual' | 'scheduled';

export interface QueryContext {
  startDate: string;
  endDate: string;
  timezone: string;
}

export interface HierarchyMismatch {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  metric: string;
  parentValue: number;
  childSum: number;
  absoluteDiff: number;
  variance: number; // percentage difference
  severity: 'warning' | 'error';
}

export interface HierarchyValidationResult {
  validated: boolean;
  sampledEntities: number;
  mismatches: HierarchyMismatch[];
  summary: {
    campaignsChecked: number;
    campaignsWithIssues: number;
    totalVariance: number;
    avgVariance: number;
  };
  timestamp: string;
  trigger: ValidationTrigger;
  queryContext: QueryContext;
  persistedEvents: number; // How many events were persisted
}

// ============================================
// Main Validation Function
// ============================================

/**
 * Validate campaign metrics against sum of ad group metrics
 * Uses DB-vs-DB comparison with same date range for consistency
 */
export async function validateCampaignHierarchy(
  customerId: string,
  dateStart: string,
  dateEnd: string,
  tolerance: number = DEFAULT_TOLERANCE,
  trigger: ValidationTrigger = 'cache_hit',
  timezone: string = 'UTC'
): Promise<HierarchyValidationResult> {
  const mismatches: HierarchyMismatch[] = [];
  const startDate = new Date(dateStart);
  const endDate = new Date(dateEnd);
  const queryContext: QueryContext = { startDate: dateStart, endDate: dateEnd, timezone };

  // Get a sample of campaigns with recent data (prefer campaigns with activity)
  const campaigns = await prisma.entityHierarchy.findMany({
    where: {
      customerId,
      entityType: EntityType.CAMPAIGN,
      status: 'ENABLED', // Only check enabled campaigns
    },
    take: SAMPLE_SIZE,
    orderBy: { lastUpdated: 'desc' },
    select: {
      entityId: true,
      entityName: true,
    },
  });

  if (campaigns.length === 0) {
    return {
      validated: false,
      sampledEntities: 0,
      mismatches: [],
      summary: {
        campaignsChecked: 0,
        campaignsWithIssues: 0,
        totalVariance: 0,
        avgVariance: 0,
      },
      timestamp: new Date().toISOString(),
      trigger,
      queryContext,
      persistedEvents: 0,
    };
  }

  let totalVariance = 0;
  let campaignsWithIssues = 0;
  let validCampaignsChecked = 0;

  for (const campaign of campaigns) {
    // ========================================
    // DB-vs-DB Rollup Comparison
    // Fetch campaign metrics from MetricsFact (same source as UI)
    // ========================================
    const campaignMetrics = await prisma.metricsFact.aggregate({
      where: {
        customerId,
        entityType: EntityType.CAMPAIGN,
        entityId: campaign.entityId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        costMicros: true,
        clicks: true,
        impressions: true,
        conversions: true,
      },
    });

    // Get sum of ad group metrics for this campaign (from same DB)
    const adGroupMetrics = await prisma.metricsFact.aggregate({
      where: {
        customerId,
        entityType: EntityType.AD_GROUP,
        parentEntityId: campaign.entityId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        costMicros: true,
        clicks: true,
        impressions: true,
        conversions: true,
      },
    });

    // Skip if no ad groups exist for this campaign
    if (adGroupMetrics._sum.costMicros === null) {
      continue;
    }

    // Convert to comparable values
    const campaignSpend = Number(campaignMetrics._sum.costMicros || 0) / 1_000_000;
    const adGroupSpend = Number(adGroupMetrics._sum.costMicros || 0) / 1_000_000;
    const campaignClicks = Number(campaignMetrics._sum.clicks || 0);
    const adGroupClicks = Number(adGroupMetrics._sum.clicks || 0);
    const campaignImpressions = Number(campaignMetrics._sum.impressions || 0);
    const adGroupImpressions = Number(adGroupMetrics._sum.impressions || 0);
    const campaignConversions = Number(campaignMetrics._sum.conversions || 0);
    const adGroupConversions = Number(adGroupMetrics._sum.conversions || 0);

    validCampaignsChecked++;

    // Check each metric with proper thresholds
    checkMetric(
      campaign,
      'spend',
      campaignSpend,
      adGroupSpend,
      tolerance,
      mismatches
    );

    checkMetric(
      campaign,
      'clicks',
      campaignClicks,
      adGroupClicks,
      tolerance,
      mismatches
    );

    checkMetric(
      campaign,
      'impressions',
      campaignImpressions,
      adGroupImpressions,
      tolerance,
      mismatches
    );

    checkMetric(
      campaign,
      'conversions',
      campaignConversions,
      adGroupConversions,
      tolerance,
      mismatches
    );

    // Track if this campaign had any issues
    const campaignMismatches = mismatches.filter(m => m.entityId === campaign.entityId);
    if (campaignMismatches.length > 0) {
      campaignsWithIssues++;
      totalVariance += Math.max(...campaignMismatches.map(m => m.variance));
    }
  }

  const avgVariance = validCampaignsChecked > 0 ? totalVariance / validCampaignsChecked : 0;

  // Persist mismatches for trend analysis
  let persistedEvents = 0;
  if (mismatches.length > 0) {
    persistedEvents = await persistMismatchEvents(
      customerId,
      mismatches,
      queryContext,
      trigger,
      campaigns.length
    );
  }

  return {
    validated: true,
    sampledEntities: campaigns.length,
    mismatches,
    summary: {
      campaignsChecked: validCampaignsChecked,
      campaignsWithIssues,
      totalVariance: Math.round(totalVariance * 100) / 100,
      avgVariance: Math.round(avgVariance * 100) / 100,
    },
    timestamp: new Date().toISOString(),
    trigger,
    queryContext,
    persistedEvents,
  };
}

// ============================================
// Metric Check with Thresholds
// ============================================

function checkMetric(
  campaign: { entityId: string; entityName: string | null },
  metric: keyof typeof MIN_THRESHOLDS,
  parentValue: number,
  childSum: number,
  tolerance: number,
  mismatches: HierarchyMismatch[]
): void {
  // Skip if parent value is below minimum threshold
  if (parentValue < MIN_THRESHOLDS[metric]) {
    return;
  }

  // Calculate absolute difference
  const absoluteDiff = Math.abs(parentValue - childSum);

  // Skip if absolute difference is below noise threshold
  if (absoluteDiff < MIN_ABSOLUTE_DIFF[metric]) {
    return;
  }

  // Divide-by-zero guard: use max of parent/child for denominator
  const denominator = Math.max(parentValue, childSum, 0.001); // Never divide by zero
  const variance = absoluteDiff / denominator;

  // Only flag if variance exceeds tolerance
  if (variance > tolerance) {
    const severity: 'warning' | 'error' = variance > 0.2 ? 'error' : 'warning';

    // Check if we already have a mismatch for this campaign/metric combo
    const existing = mismatches.find(
      m => m.entityId === campaign.entityId && m.metric === metric
    );

    if (!existing) {
      mismatches.push({
        entityType: EntityType.CAMPAIGN,
        entityId: campaign.entityId,
        entityName: campaign.entityName || campaign.entityId,
        metric,
        parentValue,
        childSum,
        absoluteDiff,
        variance: variance * 100, // Store as percentage
        severity,
      });
    }
  }
}

// ============================================
// Persistence
// ============================================

async function persistMismatchEvents(
  customerId: string,
  mismatches: HierarchyMismatch[],
  queryContext: QueryContext,
  trigger: ValidationTrigger,
  sampledEntities: number
): Promise<number> {
  try {
    // Batch insert all mismatches
    const result = await prisma.hierarchyMismatchEvent.createMany({
      data: mismatches.map(m => ({
        customerId,
        trigger,
        startDate: queryContext.startDate,
        endDate: queryContext.endDate,
        timezone: queryContext.timezone,
        entityType: m.entityType,
        entityId: m.entityId,
        entityName: m.entityName,
        metric: m.metric,
        parentValue: new Prisma.Decimal(m.parentValue),
        childSum: new Prisma.Decimal(m.childSum),
        absoluteDiff: new Prisma.Decimal(m.absoluteDiff),
        variancePercent: new Prisma.Decimal(m.variance),
        severity: m.severity,
        sampledEntities,
        sampleRate: new Prisma.Decimal(0.05),
      })),
      skipDuplicates: true,
    });

    console.log(`[HierarchyValidation] Persisted ${result.count} mismatch events`);
    return result.count;
  } catch (err) {
    console.error('[HierarchyValidation] Failed to persist events:', err);
    return 0;
  }
}

// ============================================
// Quick Health Check
// ============================================

/**
 * Quick health check - returns true if hierarchy is valid, false if issues detected
 */
export async function isHierarchyHealthy(
  customerId: string,
  dateStart: string,
  dateEnd: string,
  tolerance: number = DEFAULT_TOLERANCE
): Promise<boolean> {
  const result = await validateCampaignHierarchy(customerId, dateStart, dateEnd, tolerance);
  return result.mismatches.length === 0;
}

// ============================================
// Trend Analysis Queries
// ============================================

/**
 * Get mismatch event history for a customer
 */
export async function getMismatchHistory(
  customerId: string,
  days: number = 30,
  limit: number = 100
): Promise<{
  events: Array<{
    id: string;
    createdAt: Date;
    trigger: string;
    entityName: string;
    metric: string;
    variancePercent: number;
    severity: string;
    acknowledged: boolean;
  }>;
  summary: {
    totalEvents: number;
    byMetric: Record<string, number>;
    bySeverity: Record<string, number>;
    avgVariance: number;
  };
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const events = await prisma.hierarchyMismatchEvent.findMany({
    where: {
      customerId,
      createdAt: { gte: cutoffDate },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      trigger: true,
      entityName: true,
      metric: true,
      variancePercent: true,
      severity: true,
      acknowledged: true,
    },
  });

  // Calculate summary stats
  const byMetric: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let totalVariance = 0;

  for (const event of events) {
    byMetric[event.metric] = (byMetric[event.metric] || 0) + 1;
    bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
    totalVariance += Number(event.variancePercent);
  }

  return {
    events: events.map(e => ({
      ...e,
      variancePercent: Number(e.variancePercent),
    })),
    summary: {
      totalEvents: events.length,
      byMetric,
      bySeverity,
      avgVariance: events.length > 0 ? totalVariance / events.length : 0,
    },
  };
}

/**
 * Acknowledge a mismatch event (dismiss warning)
 */
export async function acknowledgeMismatch(eventId: string): Promise<void> {
  await prisma.hierarchyMismatchEvent.update({
    where: { id: eventId },
    data: { acknowledged: true },
  });
}

/**
 * Clean up old mismatch events (retention)
 */
export async function cleanupOldMismatchEvents(retentionDays: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.hierarchyMismatchEvent.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
      acknowledged: true, // Only delete acknowledged events
    },
  });

  return result.count;
}
