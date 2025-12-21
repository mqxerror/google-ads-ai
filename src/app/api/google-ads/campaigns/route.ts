// Force Node.js runtime (not Edge) for Prisma compatibility
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchCampaigns, fetchCampaignsDaily, createCampaign, updateCampaign } from '@/lib/google-ads';
import { storeDailyMetrics, readAndAggregateMetrics, invalidateMetricsCache } from '@/lib/cache/metrics-storage';
import { getOrSet, createCacheKey as createMemCacheKey, invalidateAccountCache, CACHE_TTL as MEM_CACHE_TTL } from '@/lib/cache';
import { DEMO_CAMPAIGNS } from '@/lib/demo-data';
import { EntityType, DataFreshness, Prisma } from '@prisma/client';
import { isToday, parseISO } from 'date-fns';
import {
  createRefreshKey,
  isRefreshing,
  recordCacheHit,
  recordCacheMiss,
  recordStaleRefresh,
  CACHE_TTL,
} from '@/lib/refresh-lock';
import { enqueueCampaignRefresh } from '@/lib/queue';
import { analyzeDateRange, getSourceDetails } from '@/lib/cache/date-range-analyzer';
import { validateCampaignHierarchy, HierarchyValidationResult } from '@/lib/validation/hierarchy-validation';
import { isEnabled } from '@/lib/feature-flags';
import {
  buildQueryContext,
  buildQueryMeta,
  createQueryCacheKey,
  extractDatesFromMetrics,
  validateQueryContext,
  QueryMeta,
} from '@/lib/query-context';
import { smartPrewarmAdGroups } from '@/lib/cache/smart-prewarm';

// Hierarchy validation (sampled, warn-only)
const HIERARCHY_VALIDATION_SAMPLE_RATE = 0.05; // 5% of queries
const HIERARCHY_VARIANCE_TOLERANCE = 0.05; // 5% tolerance before warning

// GET /api/google-ads/campaigns?accountId=xxx - Fetch campaigns for an account
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Demo mode - return mock data
  if (isDemoMode) {
    return NextResponse.json({ campaigns: DEMO_CAMPAIGNS });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const startDate = searchParams.get('startDate'); // YYYY-MM-DD - REQUIRED
  const endDate = searchParams.get('endDate');     // YYYY-MM-DD - REQUIRED

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  // Date range is required for consistent metrics across all entity levels
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate are required for consistent metrics' },
      { status: 400 }
    );
  }

  // Extract additional query parameters for date-range correctness
  const preset = searchParams.get('preset') || undefined; // e.g., 'yesterday', 'last7days'
  const timezone = searchParams.get('timezone') || 'UTC';
  const includeToday = searchParams.get('includeToday') !== 'false'; // default true
  const conversionMode = (searchParams.get('conversionMode') || 'default') as 'default' | 'by_conversion_time' | 'by_click_time';

  // Build query context for validation and metadata
  const queryContext = buildQueryContext(startDate, endDate, {
    timezone,
    includeToday,
    conversionMode,
    requestedPreset: preset,
  });

  // Validate query context (fails loudly in dev if preset doesn't match range)
  const validation = validateQueryContext(queryContext);
  if (!validation.valid && process.env.NODE_ENV === 'development') {
    console.error(`[Campaigns API] ${validation.error}`);
    // In dev, we fail loudly; in prod, we continue but warn
  }

  try {
    // Get user with their OAuth account (to get refresh token)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        authAccounts: {
          where: { provider: 'google' },
          select: { refresh_token: true },
        },
        googleAdsAccounts: {
          where: { id: accountId },
          select: {
            id: true,
            googleAccountId: true,
            isManager: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const googleOAuthAccount = user.authAccounts[0];
    if (!googleOAuthAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const googleAdsAccount = user.googleAdsAccounts[0];
    if (!googleAdsAccount) {
      return NextResponse.json({ error: 'Google Ads account not found' }, { status: 404 });
    }

    // Manager accounts cannot fetch campaigns with metrics directly
    if (googleAdsAccount.isManager) {
      return NextResponse.json(
        { error: 'Cannot fetch campaigns for a manager account. Please select a client account.' },
        { status: 400 }
      );
    }

    // Log the actual query being executed for debugging
    console.log(`[API] fetchCampaigns - customerId: ${googleAdsAccount.googleAccountId}, dateRange: ${startDate} to ${endDate}`);

    // ========================================
    // DB-FIRST STRATEGY: Check cache before API
    // ========================================

    // Check if we have cached data in MetricsFact table
    const cachedMetrics = await prisma.metricsFact.findMany({
      where: {
        customerId: googleAdsAccount.googleAccountId,
        entityType: EntityType.CAMPAIGN,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { entityId: 'asc' },
    });

    // Get entity names from hierarchy cache
    const entityNames = await prisma.entityHierarchy.findMany({
      where: {
        customerId: googleAdsAccount.googleAccountId,
        entityType: EntityType.CAMPAIGN,
      },
    });
    const nameMap = new Map(entityNames.map(e => [e.entityId, { name: e.entityName, status: e.status }]));

    // Check cache freshness using production TTLs
    const oldestSync = cachedMetrics.length > 0
      ? Math.min(...cachedMetrics.map(m => m.syncedAt.getTime()))
      : 0;
    const cacheAge = oldestSync > 0 ? Date.now() - oldestSync : Infinity;

    // TTL Strategy:
    // - Fresh (<5m): return cache, no refresh needed
    // - Stale (5m-24h): return cache immediately + trigger background refresh
    // - Expired (>24h or no cache): fetch from API (blocking)
    const isFresh = cacheAge < CACHE_TTL.FRESH;
    const isStale = cacheAge >= CACHE_TTL.FRESH && cacheAge < CACHE_TTL.STALE;
    const isExpired = cacheAge >= CACHE_TTL.STALE;

    const hasFreshCache = (isFresh || isStale) && cachedMetrics.length > 0;
    const needsBackgroundRefresh = isStale && cachedMetrics.length > 0;

    let campaigns;
    let dataSource: 'cache' | 'api' = 'api';

    if (hasFreshCache && nameMap.size > 0) {
      // ✅ CACHE HIT - Build campaigns from cached metrics
      const stateLabel = isFresh ? 'FRESH' : 'STALE';
      console.log(`[API] Cache HIT (${stateLabel}) - returning ${cachedMetrics.length} cached metrics (age: ${Math.round(cacheAge / 1000)}s)`);
      recordCacheHit();
      dataSource = 'cache';

      // Aggregate metrics by campaign (sum across date range)
      const campaignMetrics = new Map<string, {
        impressions: number;
        clicks: number;
        cost: number;
        conversions: number;
        conversionValue: number;
      }>();

      for (const metric of cachedMetrics) {
        const existing = campaignMetrics.get(metric.entityId) || {
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          conversionValue: 0,
        };

        campaignMetrics.set(metric.entityId, {
          impressions: existing.impressions + Number(metric.impressions),
          clicks: existing.clicks + Number(metric.clicks),
          cost: existing.cost + Number(metric.costMicros) / 1_000_000,
          conversions: existing.conversions + Number(metric.conversions),
          conversionValue: existing.conversionValue + Number(metric.conversionsValue),
        });
      }

      // Build campaign objects
      campaigns = Array.from(campaignMetrics.entries()).map(([campaignId, metrics]) => {
        const entityInfo = nameMap.get(campaignId);
        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        const cpa = metrics.conversions > 0 ? metrics.cost / metrics.conversions : 0;
        const roas = metrics.cost > 0 ? metrics.conversionValue / metrics.cost : 0;

        return {
          id: campaignId,
          name: entityInfo?.name || `Campaign ${campaignId}`,
          status: entityInfo?.status || 'ENABLED',
          type: (entityInfo as { campaignType?: string })?.campaignType || 'SEARCH',
          spend: metrics.cost,
          clicks: metrics.clicks,
          impressions: metrics.impressions,
          conversions: metrics.conversions,
          conversionValue: metrics.conversionValue,
          ctr,
          cpa,
          roas,
          aiScore: Math.floor(Math.random() * 30) + 70, // Placeholder
        };
      });

      // 🔄 STALE-WHILE-REVALIDATE: Trigger background refresh if cache is getting old
      if (needsBackgroundRefresh && isEnabled('QUEUE_REFRESH')) {
        console.log(`[API] Cache STALE - enqueueing background refresh`);
        recordStaleRefresh();

        // Enqueue refresh job (queue handles dedupe, rate limiting, backoff)
        enqueueCampaignRefresh({
          refreshToken: googleOAuthAccount.refresh_token!,
          accountId: googleAdsAccount.id,
          customerId: googleAdsAccount.googleAccountId,
          parentManagerId: googleAdsAccount.parentManagerId || undefined,
          startDate,
          endDate,
        }).then(result => {
          if (result === 'duplicate') {
            console.log('[API] Refresh already pending, skipped enqueue');
          } else if (result === 'rate-limited') {
            console.log('[API] Customer rate-limited, skipped enqueue');
          } else if (result === null) {
            console.warn('[API] Queue unavailable - refresh deferred to next request');
          } else {
            console.log(`[API] Enqueued refresh job: ${result}`);
          }
        }).catch(err => console.error('[API] Failed to enqueue refresh:', err));
      } else if (needsBackgroundRefresh) {
        console.log('[API] Cache STALE - queue refresh disabled by feature flag');
      }
    } else {
      // ❌ CACHE MISS - Fetch from Google Ads API
      console.log(`[API] Cache MISS - fetching from Google Ads API`);
      recordCacheMiss();

      // Fetch per-day data for proper caching (includes segments.date in SELECT)
      const dailyData = await fetchCampaignsDaily(
        googleOAuthAccount.refresh_token!,
        googleAdsAccount.googleAccountId,
        googleAdsAccount.parentManagerId || undefined,
        startDate,
        endDate
      );

      // Store per-day rows in MetricsFact (CRITICAL: only per-day data allowed)
      storeDailyMetrics(
        googleAdsAccount.googleAccountId,
        googleAdsAccount.id,
        EntityType.CAMPAIGN,
        dailyData.map(row => ({
          date: row.date,
          entityId: row.campaignId,
          entityName: row.campaignName,
          entityStatus: row.campaignStatus,
          impressions: row.impressions,
          clicks: row.clicks,
          costMicros: row.costMicros,
          conversions: row.conversions,
          conversionsValue: row.conversionsValue,
        }))
      ).then(result => {
        console.log(`[API] Stored ${result.rowsWritten} daily rows (${result.datesWritten.join(', ')})`);
      }).catch(err => console.error('[API] Failed to cache daily metrics:', err));

      // Also update EntityHierarchy for name/status lookups
      const uniqueCampaigns = new Map<string, { name: string; status: string; type: string }>();
      for (const row of dailyData) {
        if (!uniqueCampaigns.has(row.campaignId)) {
          uniqueCampaigns.set(row.campaignId, {
            name: row.campaignName,
            status: row.campaignStatus,
            type: row.campaignType,
          });
        }
      }

      // Store hierarchy entries (background)
      Promise.all(
        Array.from(uniqueCampaigns.entries()).map(([campaignId, info]) =>
          prisma.entityHierarchy.upsert({
            where: {
              customerId_entityType_entityId: {
                customerId: googleAdsAccount.googleAccountId,
                entityType: EntityType.CAMPAIGN,
                entityId: campaignId,
              },
            },
            create: {
              customerId: googleAdsAccount.googleAccountId,
              entityType: EntityType.CAMPAIGN,
              entityId: campaignId,
              entityName: info.name,
              status: info.status,
              campaignType: info.type,
              accountId: googleAdsAccount.id,
            },
            update: {
              entityName: info.name,
              status: info.status,
              campaignType: info.type,
              lastUpdated: new Date(),
            },
          })
        )
      ).catch(err => console.error('[API] Failed to update entity hierarchy:', err));

      // Aggregate daily data to build campaign response
      const campaignMetrics = new Map<string, {
        name: string;
        status: string;
        type: string;
        impressions: number;
        clicks: number;
        cost: number;
        conversions: number;
        conversionValue: number;
      }>();

      for (const row of dailyData) {
        const existing = campaignMetrics.get(row.campaignId) || {
          name: row.campaignName,
          status: row.campaignStatus,
          type: row.campaignType,
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          conversionValue: 0,
        };

        campaignMetrics.set(row.campaignId, {
          ...existing,
          impressions: existing.impressions + row.impressions,
          clicks: existing.clicks + row.clicks,
          cost: existing.cost + row.costMicros / 1_000_000,
          conversions: existing.conversions + row.conversions,
          conversionValue: existing.conversionValue + row.conversionsValue,
        });
      }

      // Build campaign objects
      campaigns = Array.from(campaignMetrics.entries()).map(([campaignId, metrics]) => {
        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        const cpa = metrics.conversions > 0 ? metrics.cost / metrics.conversions : 0;
        const roas = metrics.cost > 0 ? metrics.conversionValue / metrics.cost : 0;

        return {
          id: campaignId,
          name: metrics.name,
          status: metrics.status,
          type: metrics.type,
          spend: metrics.cost,
          clicks: metrics.clicks,
          impressions: metrics.impressions,
          conversions: metrics.conversions,
          conversionValue: metrics.conversionValue,
          ctr,
          cpa,
          roas,
          aiScore: Math.floor(Math.random() * 30) + 70, // Placeholder
        };
      });
    }

    // Update last sync time (only on API fetch)
    if (dataSource === 'api') {
      await prisma.googleAdsAccount.update({
        where: { id: accountId },
        data: { lastSyncAt: new Date() },
      });
    }

    // Check if a background refresh is in progress
    const refreshKey = createRefreshKey(
      googleAdsAccount.googleAccountId,
      'CAMPAIGN',
      undefined,
      startDate,
      endDate
    );
    const refreshInProgress = isRefreshing(refreshKey);

    // Calculate oldest sync time for metadata
    const oldestSyncDate = cachedMetrics.length > 0
      ? new Date(Math.min(...cachedMetrics.map(m => m.syncedAt.getTime())))
      : null;

    // Analyze date range for detailed source information
    let dateRangeAnalysis = null;
    let sourceDetails = null;
    if (isEnabled('DATE_RANGE_ANALYSIS')) {
      try {
        dateRangeAnalysis = await analyzeDateRange(
          googleAdsAccount.googleAccountId,
          EntityType.CAMPAIGN,
          startDate,
          endDate
        );
        sourceDetails = getSourceDetails(dateRangeAnalysis);
      } catch (err) {
        console.warn('[API] Date range analysis failed:', err);
      }
    }

    // Run sampled hierarchy validation (5% of queries, warn-only)
    // Triggers on both cache hits and API fetches (write-through)
    let hierarchyValidation = null;
    const shouldValidate = isEnabled('HIERARCHY_VALIDATION') && Math.random() < HIERARCHY_VALIDATION_SAMPLE_RATE;
    const trigger = dataSource === 'cache' ? 'cache_hit' : 'refresh';

    if (shouldValidate) {
      try {
        const validationResult = await validateCampaignHierarchy(
          googleAdsAccount.googleAccountId,
          startDate,
          endDate,
          HIERARCHY_VARIANCE_TOLERANCE,
          trigger  // Pass trigger for persistence
        );

        if (validationResult.validated) {
          const worstVariance = validationResult.mismatches.length > 0
            ? Math.max(...validationResult.mismatches.map(m => m.variance))
            : 0;

          const severity: 'ok' | 'warning' | 'error' =
            validationResult.mismatches.some(m => m.severity === 'error') ? 'error' :
            validationResult.mismatches.length > 0 ? 'warning' : 'ok';

          hierarchyValidation = {
            validated: true,
            hasIssues: validationResult.mismatches.length > 0,
            sampledEntities: validationResult.sampledEntities,
            issueCount: validationResult.mismatches.length,
            worstVariance,
            severity,
            sampleMismatches: validationResult.mismatches.slice(0, 3).map(m => ({
              entityName: m.entityName,
              metric: m.metric,
              variance: m.variance,
            })),
            trigger,
            persistedEvents: validationResult.persistedEvents,
          };

          if (hierarchyValidation.hasIssues) {
            console.warn(
              `[API] Hierarchy validation issues (${trigger}) for ${googleAdsAccount.googleAccountId}:`,
              `${hierarchyValidation.issueCount} mismatches, worst variance: ${worstVariance.toFixed(1)}%`
            );
          }
        }
      } catch (err) {
        console.warn('[API] Hierarchy validation failed:', err);
      }
    }

    // Extract actual dates covered from metrics for accurate coverage reporting
    const actualDates = extractDatesFromMetrics(cachedMetrics);

    // Build cache key with ALL parameters for debugging
    const fullCacheKey = createQueryCacheKey({
      customerId: googleAdsAccount.googleAccountId,
      entityType: 'CAMPAIGN',
      startDate,
      endDate,
      timezone: queryContext.timezone,
      conversionMode: queryContext.conversionMode,
      includeToday: queryContext.includeToday,
    });

    // Build comprehensive query metadata
    const queryMeta = buildQueryMeta(
      queryContext,
      actualDates,
      dataSource,
      fullCacheKey
    );

    // Build provenance data for debugging cache correctness
    // This shows exactly where data came from and what was written
    const provenance = {
      dbDaysCovered: actualDates,
      apiDaysCovered: dataSource === 'api' ? actualDates : [],
      missingDays: queryMeta.missingDays,
      wroteToDb: dataSource === 'api',
      wroteGranularity: dataSource === 'api' ? 'daily' : null,
      // Critical invariant check: Yesterday preset must have exactly 1 day
      yesterdayInvariantValid: preset !== 'yesterday' || (
        queryMeta.datesCovered.count === 1 ||
        (startDate === endDate)
      ),
    };

    // Smart Pre-warm: Queue ad groups fetch for top campaigns (opt-in feature)
    let prewarmStatus = null;
    if (isEnabled('SMART_PREWARM') && campaigns.length > 0 && googleOAuthAccount?.refresh_token) {
      // Fire-and-forget: don't block response
      smartPrewarmAdGroups(
        campaigns.map(c => ({ id: c.id, name: c.name, spend: c.spend, status: c.status })),
        {
          refreshToken: googleOAuthAccount.refresh_token,
          accountId: googleAdsAccount.id,
          customerId: googleAdsAccount.googleAccountId,
          parentManagerId: googleAdsAccount.parentManagerId || undefined,
          startDate,
          endDate,
        }
      ).then(result => {
        if (result.triggered) {
          console.log(`[API] Smart pre-warm triggered for ${result.campaignsQueued.length} campaigns`);
        }
        prewarmStatus = result;
      }).catch(err => {
        console.warn('[API] Smart pre-warm failed:', err);
      });
    }

    // Return data with comprehensive metadata including source breakdown
    return NextResponse.json({
      campaigns,
      _meta: {
        // Query context - echoes exactly what the server used
        queryContext: queryMeta.queryContext,

        // Date coverage - what data we actually have
        datesCovered: queryMeta.datesCovered,
        missingDays: queryMeta.missingDays,

        // Warnings (partial coverage, validation failures, etc.)
        warnings: queryMeta.warnings,

        // Data source information
        source: dataSource,
        sourceLabel: sourceDetails?.label || (dataSource === 'cache' ? 'DB Cache' : 'Google Ads API'),
        sourceDetails: sourceDetails ? {
          dbRange: sourceDetails.dbRange,
          apiRange: sourceDetails.apiRange,
          dbDays: sourceDetails.dbDays,
          apiDays: sourceDetails.apiDays,
        } : null,

        // Cache metadata
        cacheKey: fullCacheKey,
        ageSeconds: cacheAge === Infinity ? null : Math.round(cacheAge / 1000),
        lastSyncedAt: oldestSyncDate?.toISOString() || null,
        refreshing: refreshInProgress,
        pendingApiChunks: dateRangeAnalysis?.missingRange.chunks.length || 0,

        // Legacy coverage (for backwards compatibility)
        coverage: dateRangeAnalysis ? {
          percentCached: dateRangeAnalysis.summary.percentCached,
          percentMissing: dateRangeAnalysis.summary.percentMissing,
          totalDays: dateRangeAnalysis.requestedRange.totalDays,
        } : null,

        // Provenance - debug-only data showing exact data flow
        provenance,

        // Hierarchy validation
        hierarchyValidation,

        // Execution timestamp
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);

    // Check if it's a rate limit error from Google Ads API
    const errorStr = String(error);
    const retryMatch = errorStr.match(/Retry in (\d+) seconds/);

    if (retryMatch) {
      const retrySeconds = parseInt(retryMatch[1], 10);
      const retryMinutes = Math.ceil(retrySeconds / 60);
      const retryTime = retryMinutes > 60
        ? `${Math.ceil(retryMinutes / 60)} hours`
        : `${retryMinutes} minutes`;

      return NextResponse.json(
        {
          error: `API rate limited. Please wait ~${retryTime} before refreshing.`,
          isRateLimited: true,
          retryAfterSeconds: retrySeconds,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/google-ads/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Demo mode - return success with fake campaign ID
  if (isDemoMode) {
    return NextResponse.json({
      success: true,
      campaignId: `demo-camp-${Date.now()}`,
      message: 'Demo mode: Campaign creation simulated',
    });
  }

  try {
    const body = await request.json();
    const { accountId, campaign } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!campaign?.name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }

    // Get user with their OAuth account
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        authAccounts: {
          where: { provider: 'google' },
          select: { refresh_token: true },
        },
        googleAdsAccounts: {
          where: { id: accountId },
          select: {
            id: true,
            googleAccountId: true,
            isManager: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const googleOAuthAccount = user.authAccounts[0];
    if (!googleOAuthAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const googleAdsAccount = user.googleAdsAccounts[0];
    if (!googleAdsAccount) {
      return NextResponse.json({ error: 'Google Ads account not found' }, { status: 404 });
    }

    if (googleAdsAccount.isManager) {
      return NextResponse.json(
        { error: 'Cannot create campaigns on a manager account. Please select a client account.' },
        { status: 400 }
      );
    }

    const result = await createCampaign(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      campaign,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Invalidate cache after creating a campaign
    invalidateAccountCache(googleAdsAccount.googleAccountId);

    return NextResponse.json({ success: true, campaignId: result.campaignId });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/google-ads/campaigns - Update an existing campaign
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Demo mode - return success
  if (isDemoMode) {
    return NextResponse.json({
      success: true,
      message: 'Demo mode: Campaign update simulated',
    });
  }

  try {
    const body = await request.json();
    const { accountId, campaignId, updates } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    // Get user with their OAuth account
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        authAccounts: {
          where: { provider: 'google' },
          select: { refresh_token: true },
        },
        googleAdsAccounts: {
          where: { id: accountId },
          select: {
            id: true,
            googleAccountId: true,
            isManager: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const googleOAuthAccount = user.authAccounts[0];
    if (!googleOAuthAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const googleAdsAccount = user.googleAdsAccounts[0];
    if (!googleAdsAccount) {
      return NextResponse.json({ error: 'Google Ads account not found' }, { status: 404 });
    }

    const result = await updateCampaign(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      campaignId,
      updates,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Invalidate cache after updating a campaign
    invalidateAccountCache(googleAdsAccount.googleAccountId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign', details: String(error) },
      { status: 500 }
    );
  }
}
