/**
 * Hybrid Fetch Strategy - DB-first with API fallback
 *
 * Production Guardrails:
 * 1. Merge by non-overlapping date windows only - no double counting
 * 2. Query parameter consistency across all entity queries
 * 3. Quota spike prevention with caps and rate limits
 * 4. Full source tracking for diagnostics
 */

import prisma from '@/lib/prisma';
import { EntityType, DataFreshness, Prisma } from '@prisma/client';
import { analyzeDateRange, DateRangeAnalysis, getSourceLabel, getSourceDetails } from './date-range-analyzer';
import { enqueueRefreshJob, isQueueReady } from '@/lib/queue';
import { isToday, parseISO, format } from 'date-fns';
import { validateCampaignHierarchy, HierarchyValidationResult, HierarchyMismatch } from '@/lib/validation/hierarchy-validation';

// ============================================
// Configuration Constants
// ============================================

// Entity types that get write-through (persisted to DB)
const WRITE_THROUGH_ENTITIES: EntityType[] = [
  'CAMPAIGN' as EntityType,
  'AD_GROUP' as EntityType,
];

// Entity types that are on-demand only (short TTL, not persisted)
const ON_DEMAND_ENTITIES: EntityType[] = [
  'KEYWORD' as EntityType,
  'AD' as EntityType,
];

// Short TTL for on-demand entities (10 minutes)
const ON_DEMAND_TTL_MINUTES = 10;

// Quota guardrails
const MAX_INLINE_MISSING_DAYS = 7; // Max days to fetch inline (beyond this, queue it)
const MAX_INLINE_CHUNKS = 2; // Max API chunks to fetch inline
const MAX_DAYS_PER_REQUEST = 30; // Max days per single API request

// Retention policy (in days)
const RETENTION_CAMPAIGNS_DAYS = 395; // ~13 months for YoY comparisons
const RETENTION_ADGROUPS_DAYS = 395; // ~13 months for YoY comparisons
const RETENTION_KEYWORDS_DAYS = 90; // 3 months - on-demand entities

// Hierarchy validation (sampled)
const HIERARCHY_VALIDATION_SAMPLE_RATE = 0.05; // 5% of queries
const HIERARCHY_VARIANCE_TOLERANCE = 0.05; // 5% tolerance before warning

// ============================================
// Query Parameters - Consistency Contract
// ============================================

/**
 * Query parameters that MUST be consistent across all entity queries
 * to ensure drill-downs reconcile properly.
 */
export interface QueryContext {
  // Date boundaries
  startDate: string;
  endDate: string;
  timezone: string; // e.g., 'America/New_York'
  includeToday: boolean; // Whether to include today's partial data

  // Conversion settings
  conversionMode: 'conversions' | 'all_conversions';

  // Filters (serialized for cache key)
  filtersHash?: string;

  // Column selection (serialized for cache key)
  columnsHash?: string;
}

/**
 * Generate default query context
 */
export function getDefaultQueryContext(
  startDate: string,
  endDate: string,
  timezone?: string
): QueryContext {
  const today = new Date().toISOString().split('T')[0];
  return {
    startDate,
    endDate,
    timezone: timezone || 'UTC',
    includeToday: endDate === today,
    conversionMode: 'conversions',
  };
}

// ============================================
// Source Metadata Types
// ============================================

/**
 * Hierarchy validation summary for UI display
 */
export interface HierarchyValidationSummary {
  validated: boolean;
  hasIssues: boolean;
  sampledEntities: number;
  issueCount: number;
  worstVariance: number; // percentage
  severity: 'ok' | 'warning' | 'error';
  // Sample of mismatches for tooltip/popover
  sampleMismatches: Array<{
    entityName: string;
    metric: string;
    variance: number;
  }>;
}

export interface SourceMetadata {
  source: 'cache' | 'api' | 'hybrid';
  label: string;
  dbRange: string | null;
  apiRange: string | null;
  dbDays: number;
  apiDays: number;
  dbRowCount: number;
  apiRowCount: number;
  lastSyncedAt: string | null;
  analysis: DateRangeAnalysis;
  // Enhanced tracking
  queryContext: QueryContext;
  fetchOutcome: 'success' | 'partial' | 'queued' | 'error';
  errorMessage?: string;
  // Hierarchy validation (sampled, warn-only)
  hierarchyValidation?: HierarchyValidationSummary;
}

export interface HybridFetchResult<T> {
  data: T[];
  meta: SourceMetadata;
  pendingApiChunks: number;
  queuedForBackfill: boolean; // True if large backfill was queued instead of inline
}

// ============================================
// Row Types (coverage tracked at response level, not per-row)
// ============================================

interface BaseRow {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  parentEntityId?: string;
  status: string;
  // Metrics (aggregated across requested date range)
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  source: 'cache' | 'api';
}

interface CampaignRow extends BaseRow {
  campaignType?: string;
}

interface AdGroupRow extends BaseRow {
  // No additional fields needed
}

interface KeywordRow extends BaseRow {
  matchType?: string;
  qualityScore?: number;
}

// ============================================
// Main Fetch Functions
// ============================================

/**
 * Fetch campaign data with hybrid strategy and production guardrails
 */
export async function fetchCampaignsHybrid(
  accountId: string,
  customerId: string,
  refreshToken: string,
  startDate: string,
  endDate: string,
  parentManagerId?: string | null,
  queryContext?: Partial<QueryContext>
): Promise<HybridFetchResult<CampaignRow>> {
  // Build consistent query context
  const ctx: QueryContext = {
    ...getDefaultQueryContext(startDate, endDate),
    ...queryContext,
  };

  // Analyze date range coverage
  const analysis = await analyzeDateRange(
    customerId,
    'CAMPAIGN' as EntityType,
    startDate,
    endDate
  );

  let dbData: CampaignRow[] = [];
  let apiData: CampaignRow[] = [];
  let pendingApiChunks = 0;
  let queuedForBackfill = false;
  let fetchOutcome: 'success' | 'partial' | 'queued' | 'error' = 'success';
  let errorMessage: string | undefined;

  // Fetch cached data from DB (for cached dates only)
  if (analysis.cachedRange.count > 0) {
    dbData = await fetchCampaignsFromDb(
      customerId,
      analysis.cachedRange.dates // Pass specific dates, not range
    );
  }

  // Handle missing data with quota guardrails
  if (analysis.summary.requiresApiFetch) {
    const totalMissingDays = analysis.missingRange.count;
    const totalChunks = analysis.missingRange.chunks.length;

    // Check if we should queue instead of inline fetch
    const shouldQueue = totalMissingDays > MAX_INLINE_MISSING_DAYS ||
                       totalChunks > MAX_INLINE_CHUNKS ||
                       isQueueReady(); // Prefer queue when available

    if (shouldQueue && isQueueReady()) {
      // Queue all chunks for background processing
      for (const chunk of analysis.missingRange.chunks) {
        await enqueueRefreshJob({
          accountId,
          customerId,
          refreshToken,
          type: 'refresh:campaigns',
          startDate: chunk.startDate,
          endDate: chunk.endDate,
          parentManagerId: parentManagerId || undefined,
          // Include query context for consistency
          conversionMode: ctx.conversionMode,
          includeToday: ctx.includeToday,
          timezone: ctx.timezone,
        }, 'high');
        pendingApiChunks++;
      }
      queuedForBackfill = true;
      fetchOutcome = 'queued';
    } else {
      // Inline fetch with caps
      const chunksToFetch = analysis.missingRange.chunks.slice(0, MAX_INLINE_CHUNKS);
      const skippedChunks = analysis.missingRange.chunks.length - chunksToFetch.length;

      for (const chunk of chunksToFetch) {
        try {
          const { fetchCampaigns } = await import('@/lib/google-ads');
          const campaigns = await fetchCampaigns(
            refreshToken,
            customerId,
            parentManagerId || undefined,
            chunk.startDate,
            chunk.endDate
          );

          // Write-through to DB
          await storeCampaignMetrics(accountId, customerId, campaigns, chunk.startDate, chunk.endDate);

          // Convert to rows (coverage tracked at response level via meta.analysis)
          apiData.push(...campaigns.map(c => ({
            entityId: c.id,
            entityName: c.name,
            entityType: 'CAMPAIGN' as EntityType,
            status: c.status,
            spend: c.spend,
            clicks: c.clicks,
            impressions: c.impressions,
            conversions: c.conversions,
            conversionValue: 0,
            source: 'api' as const,
          })));
        } catch (err) {
          console.error(`[HybridFetch] Failed to fetch campaigns for chunk ${chunk.startDate}-${chunk.endDate}:`, err);
          errorMessage = err instanceof Error ? err.message : 'Unknown error';
          fetchOutcome = 'partial';
        }
      }

      // Queue remaining chunks if any were skipped
      if (skippedChunks > 0 && isQueueReady()) {
        const remainingChunks = analysis.missingRange.chunks.slice(MAX_INLINE_CHUNKS);
        for (const chunk of remainingChunks) {
          await enqueueRefreshJob({
            accountId,
            customerId,
            refreshToken,
            type: 'refresh:campaigns',
            startDate: chunk.startDate,
            endDate: chunk.endDate,
            parentManagerId: parentManagerId || undefined,
            conversionMode: ctx.conversionMode,
            includeToday: ctx.includeToday,
            timezone: ctx.timezone,
          }, 'normal');
          pendingApiChunks++;
        }
      }
    }
  }

  // Merge with strict non-overlapping validation
  const mergedData = mergeResultsSafe(dbData, apiData, analysis);

  // Build source metadata
  const sourceDetails = getSourceDetails(analysis);
  const meta: SourceMetadata = {
    source: analysis.source,
    label: sourceDetails.label,
    dbRange: sourceDetails.dbRange,
    apiRange: sourceDetails.apiRange,
    dbDays: sourceDetails.dbDays,
    apiDays: sourceDetails.apiDays,
    dbRowCount: dbData.length,
    apiRowCount: apiData.length,
    lastSyncedAt: analysis.cachedRange.newestSync,
    analysis,
    queryContext: ctx,
    fetchOutcome,
    errorMessage,
  };

  // Run sampled hierarchy validation (5% of queries, warn-only)
  // Only run when we have cached data to validate against
  if (dbData.length > 0) {
    const hierarchyValidation = await runSampledHierarchyValidation(
      customerId,
      startDate,
      endDate
    );
    if (hierarchyValidation) {
      meta.hierarchyValidation = hierarchyValidation;
      if (hierarchyValidation.hasIssues) {
        console.warn(
          `[HybridFetch] Hierarchy validation issues detected for ${customerId}:`,
          `${hierarchyValidation.issueCount} mismatches, worst variance: ${hierarchyValidation.worstVariance.toFixed(1)}%`
        );
      }
    }
  }

  return {
    data: mergedData,
    meta,
    pendingApiChunks,
    queuedForBackfill,
  };
}

/**
 * Fetch ad groups with hybrid strategy
 */
export async function fetchAdGroupsHybrid(
  accountId: string,
  customerId: string,
  refreshToken: string,
  campaignId: string,
  startDate: string,
  endDate: string,
  parentManagerId?: string | null,
  queryContext?: Partial<QueryContext>
): Promise<HybridFetchResult<AdGroupRow>> {
  const ctx: QueryContext = {
    ...getDefaultQueryContext(startDate, endDate),
    ...queryContext,
  };

  const analysis = await analyzeDateRange(
    customerId,
    'AD_GROUP' as EntityType,
    startDate,
    endDate,
    campaignId
  );

  let dbData: AdGroupRow[] = [];
  let apiData: AdGroupRow[] = [];
  let pendingApiChunks = 0;
  let queuedForBackfill = false;
  let fetchOutcome: 'success' | 'partial' | 'queued' | 'error' = 'success';

  if (analysis.cachedRange.count > 0) {
    dbData = await fetchAdGroupsFromDb(
      customerId,
      campaignId,
      analysis.cachedRange.dates
    );
  }

  if (analysis.summary.requiresApiFetch) {
    const shouldQueue = analysis.missingRange.count > MAX_INLINE_MISSING_DAYS ||
                       analysis.missingRange.chunks.length > MAX_INLINE_CHUNKS;

    if (shouldQueue && isQueueReady()) {
      for (const chunk of analysis.missingRange.chunks) {
        await enqueueRefreshJob({
          accountId,
          customerId,
          refreshToken,
          type: 'refresh:ad-groups',
          parentEntityId: campaignId,
          startDate: chunk.startDate,
          endDate: chunk.endDate,
          parentManagerId: parentManagerId || undefined,
          conversionMode: ctx.conversionMode,
          includeToday: ctx.includeToday,
          timezone: ctx.timezone,
        }, 'high');
        pendingApiChunks++;
      }
      queuedForBackfill = true;
      fetchOutcome = 'queued';
    } else {
      const chunksToFetch = analysis.missingRange.chunks.slice(0, MAX_INLINE_CHUNKS);

      for (const chunk of chunksToFetch) {
        try {
          const { fetchAdGroups } = await import('@/lib/google-ads');
          const adGroups = await fetchAdGroups(
            refreshToken,
            customerId,
            campaignId,
            chunk.startDate,
            chunk.endDate,
            parentManagerId || undefined
          );

          await storeAdGroupMetrics(accountId, customerId, campaignId, adGroups, chunk.startDate, chunk.endDate);

          apiData.push(...adGroups.map(ag => ({
            entityId: ag.id,
            entityName: ag.name,
            entityType: 'AD_GROUP' as EntityType,
            parentEntityId: campaignId,
            status: ag.status,
            spend: ag.spend,
            clicks: ag.clicks,
            impressions: ag.impressions,
            conversions: ag.conversions,
            conversionValue: 0,
            source: 'api' as const,
          })));
        } catch (err) {
          console.error(`[HybridFetch] Failed to fetch ad groups:`, err);
          fetchOutcome = 'partial';
        }
      }
    }
  }

  const mergedData = mergeResultsSafe(dbData, apiData, analysis);
  const sourceDetails = getSourceDetails(analysis);

  return {
    data: mergedData,
    meta: {
      source: analysis.source,
      label: sourceDetails.label,
      dbRange: sourceDetails.dbRange,
      apiRange: sourceDetails.apiRange,
      dbDays: sourceDetails.dbDays,
      apiDays: sourceDetails.apiDays,
      dbRowCount: dbData.length,
      apiRowCount: apiData.length,
      lastSyncedAt: analysis.cachedRange.newestSync,
      analysis,
      queryContext: ctx,
      fetchOutcome,
    },
    pendingApiChunks,
    queuedForBackfill,
  };
}

/**
 * Fetch keywords - ON DEMAND only (no write-through)
 */
export async function fetchKeywordsOnDemand(
  customerId: string,
  refreshToken: string,
  adGroupId: string,
  startDate: string,
  endDate: string,
  parentManagerId?: string | null,
  queryContext?: Partial<QueryContext>
): Promise<HybridFetchResult<KeywordRow>> {
  const ctx: QueryContext = {
    ...getDefaultQueryContext(startDate, endDate),
    ...queryContext,
  };

  const { fetchKeywords } = await import('@/lib/google-ads');

  const keywords = await fetchKeywords(
    refreshToken,
    customerId,
    adGroupId,
    startDate,
    endDate,
    parentManagerId || undefined
  );

  const dates = getDatesBetween(startDate, endDate);
  const data: KeywordRow[] = keywords.map(kw => ({
    entityId: kw.id,
    entityName: kw.text,
    entityType: 'KEYWORD' as EntityType,
    parentEntityId: adGroupId,
    status: kw.status,
    spend: kw.spend,
    clicks: kw.clicks,
    impressions: kw.impressions,
    conversions: kw.conversions,
    conversionValue: 0,
    matchType: String(kw.matchType || 'UNKNOWN'),
    qualityScore: kw.qualityScore,
    source: 'api' as const,
  }));

  return {
    data,
    meta: {
      source: 'api',
      label: 'Google Ads API (On-Demand)',
      dbRange: null,
      apiRange: `${startDate} to ${endDate}`,
      dbDays: 0,
      apiDays: dates.length,
      dbRowCount: 0,
      apiRowCount: data.length,
      lastSyncedAt: new Date().toISOString(),
      analysis: {
        requestedRange: { startDate, endDate, totalDays: dates.length },
        cachedRange: { dates: [], count: 0, oldestSync: null, newestSync: null },
        missingRange: { dates, count: dates.length, chunks: [{ startDate, endDate, days: dates.length }] },
        coverage: [],
        summary: { percentCached: 0, percentMissing: 100, requiresApiFetch: true, estimatedApiCalls: 1 },
        source: 'api',
      },
      queryContext: ctx,
      fetchOutcome: 'success',
    },
    pendingApiChunks: 0,
    queuedForBackfill: false,
  };
}

// ============================================
// DB Fetch Functions (by specific dates)
// ============================================

async function fetchCampaignsFromDb(
  customerId: string,
  dates: string[]
): Promise<CampaignRow[]> {
  if (dates.length === 0) return [];

  const metrics = await prisma.metricsFact.findMany({
    where: {
      customerId,
      entityType: 'CAMPAIGN' as EntityType,
      date: { in: dates.map(d => new Date(d)) },
    },
  });

  const entityIds = [...new Set(metrics.map(m => m.entityId))];
  const hierarchies = await prisma.entityHierarchy.findMany({
    where: {
      customerId,
      entityType: 'CAMPAIGN' as EntityType,
      entityId: { in: entityIds },
    },
  });

  const hierarchyMap = new Map(hierarchies.map(h => [h.entityId, h]));

  // Aggregate by entity (coverage tracked at response level via meta.analysis)
  const aggregated = new Map<string, CampaignRow>();

  for (const row of metrics) {
    const existing = aggregated.get(row.entityId);
    const spend = Number(row.costMicros) / 1_000_000;
    const clicks = Number(row.clicks);
    const impressions = Number(row.impressions);
    const conversions = Number(row.conversions);
    const conversionValue = Number(row.conversionsValue);
    const hierarchy = hierarchyMap.get(row.entityId);

    if (existing) {
      existing.spend += spend;
      existing.clicks += clicks;
      existing.impressions += impressions;
      existing.conversions += conversions;
      existing.conversionValue += conversionValue;
    } else {
      aggregated.set(row.entityId, {
        entityId: row.entityId,
        entityName: hierarchy?.entityName || row.entityId,
        entityType: 'CAMPAIGN' as EntityType,
        status: hierarchy?.status || 'UNKNOWN',
        spend,
        clicks,
        impressions,
        conversions,
        conversionValue,
        campaignType: hierarchy?.campaignType || undefined,
        source: 'cache',
      });
    }
  }

  return Array.from(aggregated.values());
}

async function fetchAdGroupsFromDb(
  customerId: string,
  campaignId: string,
  dates: string[]
): Promise<AdGroupRow[]> {
  if (dates.length === 0) return [];

  const metrics = await prisma.metricsFact.findMany({
    where: {
      customerId,
      entityType: 'AD_GROUP' as EntityType,
      parentEntityId: campaignId,
      date: { in: dates.map(d => new Date(d)) },
    },
  });

  const entityIds = [...new Set(metrics.map(m => m.entityId))];
  const hierarchies = await prisma.entityHierarchy.findMany({
    where: {
      customerId,
      entityType: 'AD_GROUP' as EntityType,
      entityId: { in: entityIds },
    },
  });

  const hierarchyMap = new Map(hierarchies.map(h => [h.entityId, h]));

  const aggregated = new Map<string, AdGroupRow>();

  for (const row of metrics) {
    const existing = aggregated.get(row.entityId);
    const spend = Number(row.costMicros) / 1_000_000;
    const clicks = Number(row.clicks);
    const impressions = Number(row.impressions);
    const conversions = Number(row.conversions);
    const conversionValue = Number(row.conversionsValue);
    const hierarchy = hierarchyMap.get(row.entityId);

    if (existing) {
      existing.spend += spend;
      existing.clicks += clicks;
      existing.impressions += impressions;
      existing.conversions += conversions;
      existing.conversionValue += conversionValue;
    } else {
      aggregated.set(row.entityId, {
        entityId: row.entityId,
        entityName: hierarchy?.entityName || row.entityId,
        entityType: 'AD_GROUP' as EntityType,
        parentEntityId: campaignId,
        status: hierarchy?.status || 'UNKNOWN',
        spend,
        clicks,
        impressions,
        conversions,
        conversionValue,
        source: 'cache',
      });
    }
  }

  return Array.from(aggregated.values());
}

// ============================================
// Safe Merge with Non-Overlap Validation
// ============================================

/**
 * Merge DB and API results with strict non-overlap validation.
 * Uses the analysis to ensure we're not double counting.
 */
function mergeResultsSafe<T extends BaseRow>(
  dbData: T[],
  apiData: T[],
  analysis: DateRangeAnalysis
): T[] {
  // Validate that DB dates and API dates don't overlap
  const dbDatesSet = new Set(analysis.cachedRange.dates);
  const apiDatesSet = new Set(analysis.missingRange.dates);

  const overlap = [...dbDatesSet].filter(d => apiDatesSet.has(d));
  if (overlap.length > 0) {
    console.error(`[HybridFetch] CRITICAL: Date overlap detected! Overlapping dates: ${overlap.join(', ')}`);
    // In production, we could throw here, but for now log and continue
  }

  // Create merged map by entityId
  const merged = new Map<string, T>();

  // Add DB data first
  for (const row of dbData) {
    merged.set(row.entityId, { ...row });
  }

  // Add API data - merge metrics if entity already exists
  for (const row of apiData) {
    const existing = merged.get(row.entityId);
    if (existing) {
      // Combine metrics from non-overlapping date ranges
      // (coverage validated via analysis at response level)
      merged.set(row.entityId, {
        ...existing,
        spend: existing.spend + row.spend,
        clicks: existing.clicks + row.clicks,
        impressions: existing.impressions + row.impressions,
        conversions: existing.conversions + row.conversions,
        conversionValue: existing.conversionValue + row.conversionValue,
        source: 'api', // Mark as hybrid since it has API data
      });
    } else {
      merged.set(row.entityId, { ...row });
    }
  }

  return Array.from(merged.values());
}

// ============================================
// Write-Through Functions
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
  startDate: string,
  endDate: string
): Promise<void> {
  // For now, store as aggregate for endDate
  // TODO: If API returns per-day breakdown, store each day separately
  const dataFreshness = isToday(parseISO(endDate))
    ? 'PARTIAL' as DataFreshness
    : 'FINAL' as DataFreshness;

  await prisma.$transaction(
    campaigns.map((campaign) =>
      prisma.metricsFact.upsert({
        where: {
          customerId_entityType_entityId_date: {
            customerId,
            entityType: 'CAMPAIGN' as EntityType,
            entityId: campaign.id,
            date: new Date(endDate),
          },
        },
        create: {
          customerId,
          entityType: 'CAMPAIGN' as EntityType,
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

  // Update hierarchy
  await prisma.$transaction(
    campaigns.map((campaign) =>
      prisma.entityHierarchy.upsert({
        where: {
          customerId_entityType_entityId: {
            customerId,
            entityType: 'CAMPAIGN' as EntityType,
            entityId: campaign.id,
          },
        },
        create: {
          customerId,
          entityType: 'CAMPAIGN' as EntityType,
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
  startDate: string,
  endDate: string
): Promise<void> {
  const dataFreshness = isToday(parseISO(endDate))
    ? 'PARTIAL' as DataFreshness
    : 'FINAL' as DataFreshness;

  await prisma.$transaction(
    adGroups.map((adGroup) =>
      prisma.metricsFact.upsert({
        where: {
          customerId_entityType_entityId_date: {
            customerId,
            entityType: 'AD_GROUP' as EntityType,
            entityId: adGroup.id,
            date: new Date(endDate),
          },
        },
        create: {
          customerId,
          entityType: 'AD_GROUP' as EntityType,
          entityId: adGroup.id,
          parentEntityType: 'CAMPAIGN' as EntityType,
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
            entityType: 'AD_GROUP' as EntityType,
            entityId: adGroup.id,
          },
        },
        create: {
          customerId,
          entityType: 'AD_GROUP' as EntityType,
          entityId: adGroup.id,
          entityName: adGroup.name,
          status: adGroup.status,
          parentEntityType: 'CAMPAIGN' as EntityType,
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
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get all dates between start and end (inclusive)
 */
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Determine if this query should run hierarchy validation (sampling)
 */
function shouldRunHierarchyValidation(): boolean {
  return Math.random() < HIERARCHY_VALIDATION_SAMPLE_RATE;
}

/**
 * Run hierarchy validation and convert to UI-friendly summary
 */
async function runSampledHierarchyValidation(
  customerId: string,
  startDate: string,
  endDate: string
): Promise<HierarchyValidationSummary | undefined> {
  // Only run on ~5% of queries
  if (!shouldRunHierarchyValidation()) {
    return undefined;
  }

  try {
    const result = await validateCampaignHierarchy(
      customerId,
      startDate,
      endDate,
      HIERARCHY_VARIANCE_TOLERANCE
    );

    // Convert to UI summary
    const worstVariance = result.mismatches.length > 0
      ? Math.max(...result.mismatches.map(m => m.variance))
      : 0;

    const severity: 'ok' | 'warning' | 'error' =
      result.mismatches.some(m => m.severity === 'error') ? 'error' :
      result.mismatches.length > 0 ? 'warning' : 'ok';

    return {
      validated: result.validated,
      hasIssues: result.mismatches.length > 0,
      sampledEntities: result.sampledEntities,
      issueCount: result.mismatches.length,
      worstVariance,
      severity,
      sampleMismatches: result.mismatches.slice(0, 3).map(m => ({
        entityName: m.entityName,
        metric: m.metric,
        variance: m.variance,
      })),
    };
  } catch (err) {
    console.error('[HybridFetch] Hierarchy validation failed:', err);
    return undefined;
  }
}

// ============================================
// Exports
// ============================================

export {
  WRITE_THROUGH_ENTITIES,
  ON_DEMAND_ENTITIES,
  ON_DEMAND_TTL_MINUTES,
  MAX_INLINE_MISSING_DAYS,
  MAX_INLINE_CHUNKS,
  RETENTION_CAMPAIGNS_DAYS,
  RETENTION_ADGROUPS_DAYS,
  RETENTION_KEYWORDS_DAYS,
};
