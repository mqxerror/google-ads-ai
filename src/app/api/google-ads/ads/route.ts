import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchAds, createAd, updateAd } from '@/lib/google-ads';
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
import { enqueueAdRefresh } from '@/lib/queue';

// Demo ads data
const DEMO_ADS = [
  {
    id: 'demo-ad-1',
    adGroupId: 'demo-ag-1',
    type: 'RESPONSIVE_SEARCH_AD',
    status: 'ENABLED',
    headlines: ['Best Project Software', 'Try Free Today', 'Trusted by 10K+ Teams'],
    descriptions: ['Streamline your workflow with our powerful tools.', 'Start your free trial now.'],
    finalUrls: ['https://example.com'],
    clicks: 320,
    impressions: 12500,
    ctr: 2.56,
    conversions: 28,
    spend: 550.00,
  },
  {
    id: 'demo-ad-2',
    adGroupId: 'demo-ag-1',
    type: 'RESPONSIVE_SEARCH_AD',
    status: 'ENABLED',
    headlines: ['#1 Team Collaboration', 'Free 14-Day Trial', 'No Credit Card Needed'],
    descriptions: ['Join thousands of happy customers.', 'Easy setup in minutes.'],
    finalUrls: ['https://example.com/trial'],
    clicks: 295,
    impressions: 11200,
    ctr: 2.63,
    conversions: 24,
    spend: 490.00,
  },
  {
    id: 'demo-ad-3',
    adGroupId: 'demo-ag-3',
    type: 'RESPONSIVE_SEARCH_AD',
    status: 'PAUSED',
    headlines: ['Manage Projects Easily', 'Boost Productivity', 'See Results Fast'],
    descriptions: ['The all-in-one solution for modern teams.', 'Get started in seconds.'],
    finalUrls: ['https://example.com/features'],
    clicks: 180,
    impressions: 8500,
    ctr: 2.12,
    conversions: 12,
    spend: 320.00,
  },
];

// GET /api/google-ads/ads?accountId=xxx&adGroupId=xxx&startDate=xxx&endDate=xxx - Fetch ads for an ad group
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

  // Demo mode - return mock ads for the ad group
  if (isDemoMode) {
    const ads = DEMO_ADS.filter(ad => ad.adGroupId === adGroupId);
    return NextResponse.json({ ads });
  }

  try {
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
    console.log(`[API] fetchAds - customerId: ${googleAdsAccount.googleAccountId}, adGroupId: ${adGroupId}, dateRange: ${startDate} to ${endDate}`);

    // ========================================
    // DB-FIRST STRATEGY: Check cache before API
    // ========================================

    // Check if we have cached data in MetricsFact table
    const cachedMetrics = await prisma.metricsFact.findMany({
      where: {
        customerId: googleAdsAccount.googleAccountId,
        entityType: EntityType.AD,
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
        entityType: EntityType.AD,
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

    let ads;
    let dataSource: 'cache' | 'api' = 'api';

    if (hasFreshCache && nameMap.size > 0) {
      // ✅ CACHE HIT - Build ads from cached metrics
      const stateLabel = isFresh ? 'FRESH' : 'STALE';
      console.log(`[API] Ads Cache HIT (${stateLabel}) - returning ${cachedMetrics.length} cached metrics (age: ${Math.round(cacheAge / 1000)}s)`);
      recordCacheHit();
      dataSource = 'cache';

      // Aggregate metrics by ad (sum across date range)
      const adMetrics = new Map<string, {
        impressions: number;
        clicks: number;
        cost: number;
        conversions: number;
        conversionValue: number;
      }>();

      for (const metric of cachedMetrics) {
        const existing = adMetrics.get(metric.entityId) || {
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          conversionValue: 0,
        };

        adMetrics.set(metric.entityId, {
          impressions: existing.impressions + Number(metric.impressions),
          clicks: existing.clicks + Number(metric.clicks),
          cost: existing.cost + Number(metric.costMicros) / 1_000_000,
          conversions: existing.conversions + Number(metric.conversions),
          conversionValue: existing.conversionValue + Number(metric.conversionsValue),
        });
      }

      // Build ad objects
      ads = Array.from(adMetrics.entries()).map(([adId, metrics]) => {
        const entityInfo = nameMap.get(adId);
        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;

        return {
          id: adId,
          adGroupId,
          type: 'RESPONSIVE_SEARCH_AD',
          status: entityInfo?.status || 'ENABLED',
          headlines: [], // Not stored in cache
          descriptions: [], // Not stored in cache
          finalUrls: [], // Not stored in cache
          spend: metrics.cost,
          clicks: metrics.clicks,
          impressions: metrics.impressions,
          conversions: metrics.conversions,
          ctr,
        };
      });

      // 🔄 STALE-WHILE-REVALIDATE: Trigger background refresh if cache is getting old
      if (needsBackgroundRefresh) {
        console.log(`[API] Ads Cache STALE - enqueueing background refresh`);
        recordStaleRefresh();

        // Enqueue refresh job (queue handles dedupe, rate limiting, backoff)
        enqueueAdRefresh({
          refreshToken: googleOAuthAccount.refresh_token!,
          accountId: googleAdsAccount.id,
          customerId: googleAdsAccount.googleAccountId,
          adGroupId,
          parentManagerId: googleAdsAccount.parentManagerId || undefined,
          startDate,
          endDate,
        }).then(result => {
          if (result === 'duplicate') {
            console.log('[API] Ads refresh already pending, skipped enqueue');
          } else if (result === 'rate-limited') {
            console.log('[API] Customer rate-limited, skipped enqueue');
          } else if (result === null) {
            console.warn('[API] Queue unavailable - refresh deferred to next request');
          } else {
            console.log(`[API] Enqueued ads refresh job: ${result}`);
          }
        }).catch(err => console.error('[API] Failed to enqueue refresh:', err));
      }
    } else {
      // ❌ CACHE MISS - Fetch from Google Ads API
      console.log(`[API] Ads Cache MISS - fetching from Google Ads API`);
      recordCacheMiss();

      ads = await fetchAds(
        googleOAuthAccount.refresh_token,
        googleAdsAccount.googleAccountId,
        adGroupId,
        startDate,
        endDate,
        googleAdsAccount.parentManagerId || undefined
      );

      // Store in MetricsFact for future cache hits (background, don't await)
      storeAdMetrics(
        googleAdsAccount.id,
        googleAdsAccount.googleAccountId,
        adGroupId,
        ads,
        endDate
      ).catch(err => console.error('[API] Failed to cache ad metrics:', err));
    }

    // Check if a background refresh is in progress
    const refreshKey = createRefreshKey(
      googleAdsAccount.googleAccountId,
      'AD',
      adGroupId,
      startDate,
      endDate
    );
    const refreshInProgress = isRefreshing(refreshKey);

    // Calculate oldest sync time for metadata
    const oldestSyncDate = cachedMetrics.length > 0
      ? new Date(Math.min(...cachedMetrics.map(m => m.syncedAt.getTime())))
      : null;

    // Return data with comprehensive metadata
    return NextResponse.json({
      ads,
      _meta: {
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
    console.error('Error fetching ads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ads', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/google-ads/ads - Create a new responsive search ad
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Demo mode - return success with fake ad ID
  if (isDemoMode) {
    return NextResponse.json({
      success: true,
      adId: `demo-ad-${Date.now()}`,
      message: 'Demo mode: Ad creation simulated',
    });
  }

  try {
    const body = await request.json();
    const { accountId, adGroupId, ad } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!adGroupId) {
      return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
    }

    if (!ad?.headlines?.length || !ad?.descriptions?.length || !ad?.finalUrls?.length) {
      return NextResponse.json({ error: 'Ad headlines, descriptions, and finalUrls are required' }, { status: 400 });
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

    const result = await createAd(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      ad,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, adId: result.adId });
  } catch (error) {
    console.error('Error creating ad:', error);
    return NextResponse.json(
      { error: 'Failed to create ad', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/google-ads/ads - Update an existing ad
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Demo mode - return success
  if (isDemoMode) {
    return NextResponse.json({
      success: true,
      message: 'Demo mode: Ad update simulated',
    });
  }

  try {
    const body = await request.json();
    const { accountId, adGroupId, adId, ad } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (!adGroupId) {
      return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
    }

    if (!adId) {
      return NextResponse.json({ error: 'adId is required' }, { status: 400 });
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

    const result = await updateAd(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      adId,
      ad,
      googleAdsAccount.parentManagerId || undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating ad:', error);
    return NextResponse.json(
      { error: 'Failed to update ad', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Store ad metrics in MetricsFact table for caching
 */
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

  for (const ad of ads) {
    // Store in MetricsFact
    await prisma.metricsFact.upsert({
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
    });

    // Store in EntityHierarchy for status lookup
    await prisma.entityHierarchy.upsert({
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
    });
  }

  console.log(`[Cache] Stored ${ads.length} ads in MetricsFact`);
}
