/**
 * Date Range Analyzer - Determines cached vs missing data ranges
 *
 * Given a requested date range, analyzes the database cache to determine:
 * - Which days have cached data (and how fresh)
 * - Which days are missing and need API fetch
 * - Optimal chunking strategy for API fetches
 */

import prisma from '@/lib/prisma';
import { EntityType } from '@prisma/client';
import { eachDayOfInterval, format, parseISO, differenceInDays, addDays } from 'date-fns';

export interface DateCoverage {
  date: string; // YYYY-MM-DD
  hasCachedData: boolean;
  syncedAt: Date | null;
  ageMinutes: number | null;
  isFresh: boolean; // < 5 minutes old
  isStale: boolean; // 5-60 minutes old
  isExpired: boolean; // > 60 minutes old
}

export interface DateRangeAnalysis {
  requestedRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  cachedRange: {
    dates: string[];
    count: number;
    oldestSync: string | null;
    newestSync: string | null;
  };
  missingRange: {
    dates: string[];
    count: number;
    chunks: Array<{ startDate: string; endDate: string; days: number }>;
  };
  coverage: DateCoverage[];
  summary: {
    percentCached: number;
    percentMissing: number;
    requiresApiFetch: boolean;
    estimatedApiCalls: number;
  };
  source: 'cache' | 'api' | 'hybrid';
}

// TTL thresholds in minutes
const FRESH_TTL = 5;
const STALE_TTL = 60;

// Maximum days per API chunk (to avoid rate limits)
const MAX_CHUNK_DAYS = 30;

/**
 * Analyze a date range for cache coverage
 */
export async function analyzeDateRange(
  customerId: string,
  entityType: EntityType,
  startDate: string,
  endDate: string,
  parentEntityId?: string
): Promise<DateRangeAnalysis> {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const totalDays = differenceInDays(end, start) + 1;

  // Get all days in the requested range
  const allDates = eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));

  // Query cached data for this range
  const whereClause: {
    customerId: string;
    entityType: EntityType;
    date: { gte: Date; lte: Date };
    parentEntityId?: string;
  } = {
    customerId,
    entityType,
    date: { gte: start, lte: end },
  };

  if (parentEntityId) {
    whereClause.parentEntityId = parentEntityId;
  }

  // Get distinct dates that have cached data with their sync times
  const cachedDates = await prisma.metricsFact.groupBy({
    by: ['date'],
    where: whereClause,
    _max: { syncedAt: true },
    _count: true,
  });

  // Build a map of cached dates
  const cachedDateMap = new Map<string, { syncedAt: Date | null; count: number }>();
  for (const row of cachedDates) {
    const dateStr = format(row.date, 'yyyy-MM-dd');
    cachedDateMap.set(dateStr, {
      syncedAt: row._max.syncedAt,
      count: row._count,
    });
  }

  // Analyze coverage for each day
  const now = Date.now();
  const coverage: DateCoverage[] = allDates.map(date => {
    const cached = cachedDateMap.get(date);
    const hasCachedData = !!cached && cached.count > 0;
    const syncedAt = cached?.syncedAt || null;
    const ageMinutes = syncedAt ? (now - syncedAt.getTime()) / 60000 : null;

    return {
      date,
      hasCachedData,
      syncedAt,
      ageMinutes,
      isFresh: ageMinutes !== null && ageMinutes < FRESH_TTL,
      isStale: ageMinutes !== null && ageMinutes >= FRESH_TTL && ageMinutes < STALE_TTL,
      isExpired: ageMinutes !== null && ageMinutes >= STALE_TTL,
    };
  });

  // Separate cached and missing dates
  const cachedDatesArray = coverage.filter(c => c.hasCachedData).map(c => c.date);
  const missingDatesArray = coverage.filter(c => !c.hasCachedData).map(c => c.date);

  // Calculate oldest/newest sync times for cached data
  const syncTimes = coverage
    .filter(c => c.syncedAt)
    .map(c => c.syncedAt!.getTime());
  const oldestSync = syncTimes.length > 0 ? new Date(Math.min(...syncTimes)).toISOString() : null;
  const newestSync = syncTimes.length > 0 ? new Date(Math.max(...syncTimes)).toISOString() : null;

  // Chunk missing dates into optimal API call ranges
  const chunks = chunkMissingDates(missingDatesArray);

  // Determine overall source
  let source: 'cache' | 'api' | 'hybrid' = 'cache';
  if (missingDatesArray.length === totalDays) {
    source = 'api';
  } else if (missingDatesArray.length > 0) {
    source = 'hybrid';
  }

  return {
    requestedRange: {
      startDate,
      endDate,
      totalDays,
    },
    cachedRange: {
      dates: cachedDatesArray,
      count: cachedDatesArray.length,
      oldestSync,
      newestSync,
    },
    missingRange: {
      dates: missingDatesArray,
      count: missingDatesArray.length,
      chunks,
    },
    coverage,
    summary: {
      percentCached: Math.round((cachedDatesArray.length / totalDays) * 100),
      percentMissing: Math.round((missingDatesArray.length / totalDays) * 100),
      requiresApiFetch: missingDatesArray.length > 0,
      estimatedApiCalls: chunks.length,
    },
    source,
  };
}

/**
 * Chunk missing dates into contiguous ranges for efficient API fetching
 */
function chunkMissingDates(missingDates: string[]): Array<{ startDate: string; endDate: string; days: number }> {
  if (missingDates.length === 0) return [];

  const sorted = [...missingDates].sort();
  const chunks: Array<{ startDate: string; endDate: string; days: number }> = [];

  let chunkStart = sorted[0];
  let chunkEnd = sorted[0];
  let currentChunkDays = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = parseISO(sorted[i - 1]);
    const currDate = parseISO(sorted[i]);
    const daysDiff = differenceInDays(currDate, prevDate);

    // If consecutive day and chunk isn't too large, extend current chunk
    if (daysDiff === 1 && currentChunkDays < MAX_CHUNK_DAYS) {
      chunkEnd = sorted[i];
      currentChunkDays++;
    } else {
      // Save current chunk and start new one
      chunks.push({
        startDate: chunkStart,
        endDate: chunkEnd,
        days: currentChunkDays,
      });
      chunkStart = sorted[i];
      chunkEnd = sorted[i];
      currentChunkDays = 1;
    }
  }

  // Don't forget the last chunk
  chunks.push({
    startDate: chunkStart,
    endDate: chunkEnd,
    days: currentChunkDays,
  });

  return chunks;
}

/**
 * Quick check if any API fetch is needed for a date range
 */
export async function needsApiFetch(
  customerId: string,
  entityType: EntityType,
  startDate: string,
  endDate: string,
  parentEntityId?: string
): Promise<boolean> {
  const analysis = await analyzeDateRange(customerId, entityType, startDate, endDate, parentEntityId);
  return analysis.summary.requiresApiFetch;
}

/**
 * Get source label for UI display
 */
export function getSourceLabel(analysis: DateRangeAnalysis): string {
  if (analysis.source === 'cache') {
    return 'DB Cache';
  }
  if (analysis.source === 'api') {
    return 'Google Ads API';
  }
  // Hybrid - show breakdown
  const cachedPct = analysis.summary.percentCached;
  return `Hybrid (${cachedPct}% DB, ${100 - cachedPct}% API)`;
}

/**
 * Get detailed source info for debugging/display
 */
export function getSourceDetails(analysis: DateRangeAnalysis): {
  label: string;
  dbRange: string | null;
  apiRange: string | null;
  dbDays: number;
  apiDays: number;
} {
  const dbDays = analysis.cachedRange.count;
  const apiDays = analysis.missingRange.count;

  let dbRange: string | null = null;
  let apiRange: string | null = null;

  if (dbDays > 0) {
    const dates = analysis.cachedRange.dates;
    dbRange = dates.length === 1
      ? dates[0]
      : `${dates[0]} to ${dates[dates.length - 1]}`;
  }

  if (apiDays > 0 && analysis.missingRange.chunks.length > 0) {
    const chunks = analysis.missingRange.chunks;
    if (chunks.length === 1) {
      apiRange = chunks[0].startDate === chunks[0].endDate
        ? chunks[0].startDate
        : `${chunks[0].startDate} to ${chunks[0].endDate}`;
    } else {
      apiRange = `${chunks.length} chunks`;
    }
  }

  return {
    label: getSourceLabel(analysis),
    dbRange,
    apiRange,
    dbDays,
    apiDays,
  };
}
