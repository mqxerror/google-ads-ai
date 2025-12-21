/**
 * Metrics Storage Layer
 *
 * CRITICAL INVARIANT: MetricsFact only stores per-day rows.
 * Range aggregates are NEVER written to MetricsFact.
 *
 * If you need to store range aggregates, use a separate table or don't cache.
 */

import prisma from '@/lib/prisma';
import { EntityType, DataFreshness, Prisma } from '@prisma/client';
import { isToday, parseISO, eachDayOfInterval, format } from 'date-fns';

export interface DailyMetric {
  date: string; // YYYY-MM-DD - REQUIRED
  entityId: string;
  entityName?: string;
  entityStatus?: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
}

export interface StorageResult {
  success: boolean;
  rowsWritten: number;
  granularity: 'daily';
  datesWritten: string[];
  error?: string;
}

/**
 * Store per-day metrics in MetricsFact
 *
 * CRITICAL: Only call this with per-day data (one row per date per entity).
 * NEVER call this with aggregated range data.
 *
 * @param customerId - Google Ads Customer ID
 * @param accountId - Internal account ID
 * @param entityType - CAMPAIGN, AD_GROUP, etc.
 * @param dailyMetrics - Array of per-day metrics (MUST have date field)
 */
export async function storeDailyMetrics(
  customerId: string,
  accountId: string,
  entityType: EntityType,
  dailyMetrics: DailyMetric[]
): Promise<StorageResult> {
  if (dailyMetrics.length === 0) {
    return { success: true, rowsWritten: 0, granularity: 'daily', datesWritten: [] };
  }

  // VALIDATION: Ensure all rows have dates
  const rowsWithoutDate = dailyMetrics.filter(m => !m.date);
  if (rowsWithoutDate.length > 0) {
    console.error('[MetricsStorage] CRITICAL: Attempted to store metrics without date field');
    return {
      success: false,
      rowsWritten: 0,
      granularity: 'daily',
      datesWritten: [],
      error: 'All metrics must have a date field. Range aggregates cannot be stored.',
    };
  }

  const datesWritten: string[] = [];
  let rowsWritten = 0;

  try {
    for (const metric of dailyMetrics) {
      const dataFreshness = isToday(parseISO(metric.date))
        ? DataFreshness.PARTIAL
        : DataFreshness.FINAL;

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
          date: new Date(metric.date),
          impressions: BigInt(metric.impressions || 0),
          clicks: BigInt(metric.clicks || 0),
          costMicros: BigInt(metric.costMicros || 0),
          conversions: new Prisma.Decimal(metric.conversions || 0),
          conversionsValue: new Prisma.Decimal(metric.conversionsValue || 0),
          ctr: new Prisma.Decimal(metric.impressions > 0 ? metric.clicks / metric.impressions : 0),
          averageCpc: new Prisma.Decimal(metric.clicks > 0 ? (metric.costMicros / 1_000_000) / metric.clicks : 0),
          accountId,
          dataFreshness,
        },
        update: {
          impressions: BigInt(metric.impressions || 0),
          clicks: BigInt(metric.clicks || 0),
          costMicros: BigInt(metric.costMicros || 0),
          conversions: new Prisma.Decimal(metric.conversions || 0),
          conversionsValue: new Prisma.Decimal(metric.conversionsValue || 0),
          ctr: new Prisma.Decimal(metric.impressions > 0 ? metric.clicks / metric.impressions : 0),
          averageCpc: new Prisma.Decimal(metric.clicks > 0 ? (metric.costMicros / 1_000_000) / metric.clicks : 0),
          dataFreshness,
          syncedAt: new Date(),
        },
      });

      if (!datesWritten.includes(metric.date)) {
        datesWritten.push(metric.date);
      }
      rowsWritten++;
    }

    console.log(`[MetricsStorage] Stored ${rowsWritten} daily rows for ${entityType} (dates: ${datesWritten.join(', ')})`);

    return {
      success: true,
      rowsWritten,
      granularity: 'daily',
      datesWritten,
    };
  } catch (error) {
    console.error('[MetricsStorage] Failed to store daily metrics:', error);
    return {
      success: false,
      rowsWritten,
      granularity: 'daily',
      datesWritten,
      error: String(error),
    };
  }
}

/**
 * Read per-day metrics from MetricsFact and aggregate for a date range
 *
 * @returns Aggregated metrics per entity, plus provenance info
 */
export async function readAndAggregateMetrics(
  customerId: string,
  entityType: EntityType,
  startDate: string,
  endDate: string
): Promise<{
  metrics: Map<string, {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conversionValue: number;
  }>;
  provenance: {
    dbDaysCovered: string[];
    missingDays: string[];
    totalDaysRequested: number;
    oldestSync: Date | null;
  };
}> {
  // Get all days in the requested range
  const requestedDays = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map(d => format(d, 'yyyy-MM-dd'));

  // Fetch from DB
  const cachedMetrics = await prisma.metricsFact.findMany({
    where: {
      customerId,
      entityType,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    orderBy: { entityId: 'asc' },
  });

  // Track which days we have data for
  const dbDaysCovered = [...new Set(cachedMetrics.map(m => format(m.date, 'yyyy-MM-dd')))];
  const missingDays = requestedDays.filter(d => !dbDaysCovered.includes(d));
  const oldestSync = cachedMetrics.length > 0
    ? new Date(Math.min(...cachedMetrics.map(m => m.syncedAt.getTime())))
    : null;

  // Aggregate metrics by entity
  const metrics = new Map<string, {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conversionValue: number;
  }>();

  for (const metric of cachedMetrics) {
    const existing = metrics.get(metric.entityId) || {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      conversionValue: 0,
    };

    metrics.set(metric.entityId, {
      impressions: existing.impressions + Number(metric.impressions),
      clicks: existing.clicks + Number(metric.clicks),
      cost: existing.cost + Number(metric.costMicros) / 1_000_000,
      conversions: existing.conversions + Number(metric.conversions),
      conversionValue: existing.conversionValue + Number(metric.conversionsValue),
    });
  }

  return {
    metrics,
    provenance: {
      dbDaysCovered,
      missingDays,
      totalDaysRequested: requestedDays.length,
      oldestSync,
    },
  };
}

/**
 * Invalidate cached metrics for a specific query
 */
export async function invalidateMetricsCache(
  customerId: string,
  entityType: EntityType,
  startDate: string,
  endDate: string,
  entityId?: string
): Promise<{ deleted: number }> {
  const result = await prisma.metricsFact.deleteMany({
    where: {
      customerId,
      entityType,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
      ...(entityId ? { entityId } : {}),
    },
  });

  console.log(`[MetricsStorage] Invalidated ${result.count} rows for ${customerId}/${entityType} (${startDate} to ${endDate})`);

  return { deleted: result.count };
}

/**
 * Check if we have complete daily coverage for a date range
 */
export async function checkDailyCoverage(
  customerId: string,
  entityType: EntityType,
  startDate: string,
  endDate: string
): Promise<{
  complete: boolean;
  coveredDays: string[];
  missingDays: string[];
  coveragePercent: number;
}> {
  const requestedDays = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map(d => format(d, 'yyyy-MM-dd'));

  const existingDates = await prisma.metricsFact.findMany({
    where: {
      customerId,
      entityType,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    select: { date: true },
    distinct: ['date'],
  });

  const coveredDays = existingDates.map(d => format(d.date, 'yyyy-MM-dd'));
  const missingDays = requestedDays.filter(d => !coveredDays.includes(d));
  const coveragePercent = requestedDays.length > 0
    ? (coveredDays.length / requestedDays.length) * 100
    : 0;

  return {
    complete: missingDays.length === 0,
    coveredDays,
    missingDays,
    coveragePercent,
  };
}
