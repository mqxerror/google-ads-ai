// Force Node.js runtime (not Edge) for Prisma compatibility
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchKeywords, createKeywords, removeKeyword, updateKeyword } from '@/lib/google-ads';
import { DEMO_KEYWORDS } from '@/lib/demo-data';
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
import { enqueueKeywordRefresh } from '@/lib/queue';
import {
  buildQueryContext,
  buildQueryMeta,
  createQueryCacheKey,
  extractDatesFromMetrics,
  validateQueryContext,
} from '@/lib/query-context';

// GET /api/google-ads/keywords?accountId=xxx&adGroupId=xxx&startDate=xxx&endDate=xxx - Fetch keywords for an ad group
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const adGroupId = searchParams.get('adGroupId');
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

  if (!adGroupId) {
    return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate are required for consistent metrics' },
      { status: 400 }
    );
  }

  // Demo mode - return mock keywords for the ad group
  if (isDemoMode) {
    const keywords = DEMO_KEYWORDS.filter(kw => kw.adGroupId === adGroupId);
    return NextResponse.json({ keywords });
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
    console.log(`[API] fetchKeywords - customerId: ${googleAdsAccount.googleAccountId}, adGroupId: ${adGroupId}, dateRange: ${startDate} to ${endDate}`);

    // ========================================
    // DB-FIRST STRATEGY: Check cache before API
    // ========================================

    // Check if we have cached data in MetricsFact table
    const cachedMetrics = await prisma.metricsFact.findMany({
      where: {
        customerId: googleAdsAccount.googleAccountId,
        entityType: EntityType.KEYWORD,
        parentEntityId: adGroupId,
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
        entityType: EntityType.KEYWORD,
        parentEntityId: adGroupId,
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

    let keywords;
    let dataSource: 'cache' | 'api' = 'api';

    if (hasFreshCache && nameMap.size > 0) {
      // ✅ CACHE HIT - Build keywords from cached metrics
      const stateLabel = isFresh ? 'FRESH' : 'STALE';
      console.log(`[API] Keywords Cache HIT (${stateLabel}) - returning ${cachedMetrics.length} cached metrics (age: ${Math.round(cacheAge / 1000)}s)`);
      recordCacheHit();
      dataSource = 'cache';

      // Aggregate metrics by keyword (sum across date range)
      const keywordMetrics = new Map<string, {
        impressions: number;
        clicks: number;
        cost: number;
        conversions: number;
        conversionValue: number;
      }>();

      for (const metric of cachedMetrics) {
        const existing = keywordMetrics.get(metric.entityId) || {
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          conversionValue: 0,
        };

        keywordMetrics.set(metric.entityId, {
          impressions: existing.impressions + Number(metric.impressions),
          clicks: existing.clicks + Number(metric.clicks),
          cost: existing.cost + Number(metric.costMicros) / 1_000_000,
          conversions: existing.conversions + Number(metric.conversions),
          conversionValue: existing.conversionValue + Number(metric.conversionsValue),
        });
      }

      // Build keyword objects
      keywords = Array.from(keywordMetrics.entries()).map(([keywordId, metrics]) => {
        const entityInfo = nameMap.get(keywordId);
        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        const cpc = metrics.clicks > 0 ? metrics.cost / metrics.clicks : 0;

        return {
          id: keywordId,
          adGroupId,
          text: entityInfo?.name || `Keyword ${keywordId}`,
          matchType: 'UNKNOWN', // Not stored in cache, will be overwritten on next API fetch
          status: entityInfo?.status || 'ENABLED',
          spend: metrics.cost,
          clicks: metrics.clicks,
          impressions: metrics.impressions,
          conversions: metrics.conversions,
          ctr,
          cpc,
        };
      });

      // 🔄 STALE-WHILE-REVALIDATE: Trigger background refresh if cache is getting old
      if (needsBackgroundRefresh) {
        console.log(`[API] Keywords Cache STALE - enqueueing background refresh`);
        recordStaleRefresh();

        // Enqueue refresh job (queue handles dedupe, rate limiting, backoff)
        enqueueKeywordRefresh({
          refreshToken: googleOAuthAccount.refresh_token!,
          accountId: googleAdsAccount.id,
          customerId: googleAdsAccount.googleAccountId,
          adGroupId,
          parentManagerId: googleAdsAccount.parentManagerId || undefined,
          startDate,
          endDate,
        }).then(result => {
          if (result === 'duplicate') {
            console.log('[API] Keywords refresh already pending, skipped enqueue');
          } else if (result === 'rate-limited') {
            console.log('[API] Customer rate-limited, skipped enqueue');
          } else if (result === null) {
            console.warn('[API] Queue unavailable - refresh deferred to next request');
          } else {
            console.log(`[API] Enqueued keywords refresh job: ${result}`);
          }
        }).catch(err => console.error('[API] Failed to enqueue refresh:', err));
      }
    } else {
      // ❌ CACHE MISS - Fetch from Google Ads API
      console.log(`[API] Keywords Cache MISS - fetching from Google Ads API`);
      recordCacheMiss();

      keywords = await fetchKeywords(
        googleOAuthAccount.refresh_token,
        googleAdsAccount.googleAccountId,
        adGroupId,
        startDate,
        endDate,
        googleAdsAccount.parentManagerId || undefined
      );

      // Store in MetricsFact for future cache hits (background, don't await)
      storeKeywordMetrics(
        googleAdsAccount.id,
        googleAdsAccount.googleAccountId,
        adGroupId,
        keywords,
        endDate
      ).catch(err => console.error('[API] Failed to cache keyword metrics:', err));
    }

    // Check if a background refresh is in progress
    const refreshKey = createRefreshKey(
      googleAdsAccount.googleAccountId,
      'KEYWORD',
      adGroupId,
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
      console.warn(`[API] Keywords query context validation failed: ${validation.error}`);
    }

    // Extract actual dates from cached metrics
    const actualDates = extractDatesFromMetrics(cachedMetrics);

    // Build comprehensive cache key
    const fullCacheKey = createQueryCacheKey({
      customerId: googleAdsAccount.googleAccountId,
      entityType: 'KEYWORD',
      startDate,
      endDate,
      timezone,
      conversionMode,
      includeToday,
      parentEntityId: adGroupId,
    });

    // Build query meta with date coverage analysis
    const queryMeta = buildQueryMeta(queryContext, actualDates, dataSource, fullCacheKey);

    // Return data with comprehensive metadata
    return NextResponse.json({
      keywords,
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
          adGroupId,
          startDate,
          endDate,
        },
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/google-ads/keywords - Create new keywords in an ad group
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId, adGroupId, keywords } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!adGroupId) {
      return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords array is required' }, { status: 400 });
    }

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

    const result = await createKeywords(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      keywords,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, keywordIds: result.keywordIds });
  } catch (error) {
    console.error('Error creating keywords:', error);
    return NextResponse.json(
      { error: 'Failed to create keywords', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/google-ads/keywords - Update an existing keyword
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId, adGroupId, keywordId, updates } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!adGroupId) {
      return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
    }

    if (!keywordId) {
      return NextResponse.json({ error: 'keywordId is required' }, { status: 400 });
    }

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

    const result = await updateKeyword(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      keywordId,
      updates,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating keyword:', error);
    return NextResponse.json(
      { error: 'Failed to update keyword', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/google-ads/keywords - Remove a keyword
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const adGroupId = searchParams.get('adGroupId');
    const keywordId = searchParams.get('keywordId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!adGroupId) {
      return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
    }

    if (!keywordId) {
      return NextResponse.json({ error: 'keywordId is required' }, { status: 400 });
    }

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

    const result = await removeKeyword(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      keywordId,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing keyword:', error);
    return NextResponse.json(
      { error: 'Failed to remove keyword', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Store keyword metrics in MetricsFact table for caching
 */
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

  for (const keyword of keywords) {
    // Store in MetricsFact
    await prisma.metricsFact.upsert({
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
    });

    // Store in EntityHierarchy for name/status lookup
    await prisma.entityHierarchy.upsert({
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
    });
  }

  console.log(`[Cache] Stored ${keywords.length} keywords in MetricsFact`);
}
