// Force Node.js runtime (not Edge) for Prisma compatibility
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchAdGroups, fetchAdGroupsDaily } from '@/lib/google-ads';
import { storeDailyMetrics } from '@/lib/cache/metrics-storage';
import { DEMO_AD_GROUPS } from '@/lib/demo-data';
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
import { enqueueAdGroupRefresh } from '@/lib/queue';
import {
  buildQueryContext,
  buildQueryMeta,
  createQueryCacheKey,
  extractDatesFromMetrics,
  validateQueryContext,
} from '@/lib/query-context';

// GET /api/google-ads/ad-groups?accountId=xxx&campaignId=xxx&startDate=xxx&endDate=xxx - Fetch ad groups for a campaign
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const campaignId = searchParams.get('campaignId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Additional query modifiers for query context
  const preset = searchParams.get('preset') || undefined;
  const timezone = searchParams.get('timezone') || 'UTC';
  const includeToday = searchParams.get('includeToday') !== 'false';
  const conversionMode = (searchParams.get('conversionMode') || 'default') as
    | 'default'
    | 'by_conversion_time'
    | 'by_click_time';

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate are required for consistent metrics' },
      { status: 400 }
    );
  }

  // Demo mode - return mock ad groups for the campaign
  if (isDemoMode) {
    const adGroups = DEMO_AD_GROUPS.filter(ag => ag.campaignId === campaignId);
    return NextResponse.json({ adGroups });
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

    // Log the actual query being executed for debugging
    console.log(`[API] fetchAdGroups - customerId: ${googleAdsAccount.googleAccountId}, campaignId: ${campaignId}, dateRange: ${startDate} to ${endDate}`);

    // ========================================
    // DB-FIRST STRATEGY: Check cache before API
    // ========================================

    // Check if we have cached data in MetricsFact table
    const cachedMetrics = await prisma.metricsFact.findMany({
      where: {
        customerId: googleAdsAccount.googleAccountId,
        entityType: EntityType.AD_GROUP,
        parentEntityId: campaignId,
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
        entityType: EntityType.AD_GROUP,
        parentEntityId: campaignId,
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

    let adGroups;
    let dataSource: 'cache' | 'api' = 'api';

    if (hasFreshCache && nameMap.size > 0) {
      // ✅ CACHE HIT - Build ad groups from cached metrics
      const stateLabel = isFresh ? 'FRESH' : 'STALE';
      console.log(`[API] Ad Groups Cache HIT (${stateLabel}) - returning ${cachedMetrics.length} cached metrics (age: ${Math.round(cacheAge / 1000)}s)`);
      recordCacheHit();
      dataSource = 'cache';

      // Aggregate metrics by ad group (sum across date range)
      const adGroupMetrics = new Map<string, {
        impressions: number;
        clicks: number;
        cost: number;
        conversions: number;
        conversionValue: number;
      }>();

      for (const metric of cachedMetrics) {
        const existing = adGroupMetrics.get(metric.entityId) || {
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          conversionValue: 0,
        };

        adGroupMetrics.set(metric.entityId, {
          impressions: existing.impressions + Number(metric.impressions),
          clicks: existing.clicks + Number(metric.clicks),
          cost: existing.cost + Number(metric.costMicros) / 1_000_000,
          conversions: existing.conversions + Number(metric.conversions),
          conversionValue: existing.conversionValue + Number(metric.conversionsValue),
        });
      }

      // Build ad group objects
      adGroups = Array.from(adGroupMetrics.entries()).map(([adGroupId, metrics]) => {
        const entityInfo = nameMap.get(adGroupId);
        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        const cpa = metrics.conversions > 0 ? metrics.cost / metrics.conversions : 0;

        return {
          id: adGroupId,
          campaignId,
          name: entityInfo?.name || `Ad Group ${adGroupId}`,
          status: entityInfo?.status || 'ENABLED',
          spend: metrics.cost,
          clicks: metrics.clicks,
          impressions: metrics.impressions,
          conversions: metrics.conversions,
          ctr,
          cpa,
        };
      });

      // 🔄 STALE-WHILE-REVALIDATE: Trigger background refresh if cache is getting old
      if (needsBackgroundRefresh) {
        console.log(`[API] Ad Groups Cache STALE - enqueueing background refresh`);
        recordStaleRefresh();

        // Enqueue refresh job (queue handles dedupe, rate limiting, backoff)
        enqueueAdGroupRefresh({
          refreshToken: googleOAuthAccount.refresh_token!,
          accountId: googleAdsAccount.id,
          customerId: googleAdsAccount.googleAccountId,
          campaignId,
          parentManagerId: googleAdsAccount.parentManagerId || undefined,
          startDate,
          endDate,
        }).then(result => {
          if (result === 'duplicate') {
            console.log('[API] Ad groups refresh already pending, skipped enqueue');
          } else if (result === 'rate-limited') {
            console.log('[API] Customer rate-limited, skipped enqueue');
          } else if (result === null) {
            console.warn('[API] Queue unavailable - refresh deferred to next request');
          } else {
            console.log(`[API] Enqueued ad groups refresh job: ${result}`);
          }
        }).catch(err => console.error('[API] Failed to enqueue refresh:', err));
      }
    } else {
      // ❌ CACHE MISS - Fetch from Google Ads API
      console.log(`[API] Ad Groups Cache MISS - fetching from Google Ads API`);
      recordCacheMiss();

      // Fetch per-day data for proper caching (includes segments.date in SELECT)
      const dailyData = await fetchAdGroupsDaily(
        googleOAuthAccount.refresh_token!,
        googleAdsAccount.googleAccountId,
        campaignId,
        startDate,
        endDate,
        googleAdsAccount.parentManagerId || undefined
      );

      // Store per-day rows in MetricsFact (CRITICAL: only per-day data allowed)
      storeDailyMetrics(
        googleAdsAccount.googleAccountId,
        googleAdsAccount.id,
        EntityType.AD_GROUP,
        dailyData.map(row => ({
          date: row.date,
          entityId: row.adGroupId,
          entityName: row.adGroupName,
          entityStatus: row.adGroupStatus,
          impressions: row.impressions,
          clicks: row.clicks,
          costMicros: row.costMicros,
          conversions: row.conversions,
          conversionsValue: 0,
        }))
      ).then(result => {
        console.log(`[API] Stored ${result.rowsWritten} daily ad group rows (${result.datesWritten.join(', ')})`);
      }).catch(err => console.error('[API] Failed to cache daily ad group metrics:', err));

      // Also update EntityHierarchy for name/status lookups
      const uniqueAdGroups = new Map<string, { name: string; status: string }>();
      for (const row of dailyData) {
        if (!uniqueAdGroups.has(row.adGroupId)) {
          uniqueAdGroups.set(row.adGroupId, {
            name: row.adGroupName,
            status: row.adGroupStatus,
          });
        }
      }

      // Store hierarchy entries (background)
      Promise.all(
        Array.from(uniqueAdGroups.entries()).map(([adGroupId, info]) =>
          prisma.entityHierarchy.upsert({
            where: {
              customerId_entityType_entityId: {
                customerId: googleAdsAccount.googleAccountId,
                entityType: EntityType.AD_GROUP,
                entityId: adGroupId,
              },
            },
            create: {
              customerId: googleAdsAccount.googleAccountId,
              entityType: EntityType.AD_GROUP,
              entityId: adGroupId,
              entityName: info.name,
              status: info.status,
              parentEntityType: EntityType.CAMPAIGN,
              parentEntityId: campaignId,
              accountId: googleAdsAccount.id,
            },
            update: {
              entityName: info.name,
              status: info.status,
              parentEntityId: campaignId,
              lastUpdated: new Date(),
            },
          })
        )
      ).catch(err => console.error('[API] Failed to update ad group hierarchy:', err));

      // Aggregate daily data to build ad group response
      const adGroupMetrics = new Map<string, {
        name: string;
        status: string;
        impressions: number;
        clicks: number;
        cost: number;
        conversions: number;
      }>();

      for (const row of dailyData) {
        const existing = adGroupMetrics.get(row.adGroupId) || {
          name: row.adGroupName,
          status: row.adGroupStatus,
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
        };

        adGroupMetrics.set(row.adGroupId, {
          ...existing,
          impressions: existing.impressions + row.impressions,
          clicks: existing.clicks + row.clicks,
          cost: existing.cost + row.costMicros / 1_000_000,
          conversions: existing.conversions + row.conversions,
        });
      }

      // Build ad group objects
      adGroups = Array.from(adGroupMetrics.entries()).map(([adGroupId, metrics]) => {
        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        const cpa = metrics.conversions > 0 ? metrics.cost / metrics.conversions : 0;

        return {
          id: adGroupId,
          campaignId,
          name: metrics.name,
          status: metrics.status,
          spend: metrics.cost,
          clicks: metrics.clicks,
          impressions: metrics.impressions,
          conversions: metrics.conversions,
          ctr,
          cpa,
        };
      });
    }

    // Check if a background refresh is in progress
    const refreshKey = createRefreshKey(
      googleAdsAccount.googleAccountId,
      'AD_GROUP',
      campaignId,
      startDate,
      endDate
    );
    const refreshInProgress = isRefreshing(refreshKey);

    // Calculate oldest sync time for metadata
    const oldestSyncDate = cachedMetrics.length > 0
      ? new Date(Math.min(...cachedMetrics.map(m => m.syncedAt.getTime())))
      : null;

    // Build query context for date range correctness
    const queryContext = buildQueryContext(startDate, endDate, {
      timezone,
      includeToday,
      conversionMode,
      requestedPreset: preset,
    });

    // Validate query context (catches Yesterday != 1-day bugs)
    const validation = validateQueryContext(queryContext);
    if (!validation.valid) {
      console.warn(`[API] AdGroups query context validation failed: ${validation.error}`);
    }

    // Extract actual dates from cached metrics
    const actualDates = extractDatesFromMetrics(cachedMetrics);

    // Build comprehensive cache key
    const fullCacheKey = createQueryCacheKey({
      customerId: googleAdsAccount.googleAccountId,
      entityType: 'AD_GROUP',
      startDate,
      endDate,
      timezone,
      conversionMode,
      includeToday,
      parentEntityId: campaignId,
    });

    // Build query meta with date coverage analysis
    const queryMeta = buildQueryMeta(queryContext, actualDates, dataSource, fullCacheKey);

    // Return data with comprehensive metadata
    return NextResponse.json({
      adGroups,
      _meta: {
        queryContext: queryMeta.queryContext,
        datesCovered: queryMeta.datesCovered,
        missingDays: queryMeta.missingDays,
        warnings: queryMeta.warnings,
        cacheKey: fullCacheKey,
        source: dataSource,
        ageSeconds: cacheAge === Infinity ? null : Math.round(cacheAge / 1000),
        lastSyncedAt: oldestSyncDate?.toISOString() || null,
        refreshing: refreshInProgress,
        query: {
          customerId: googleAdsAccount.googleAccountId,
          campaignId,
          startDate,
          endDate,
        },
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching ad groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad groups', details: String(error) },
      { status: 500 }
    );
  }
}

