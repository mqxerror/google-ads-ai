import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchCampaigns, createCampaign, updateCampaign } from '@/lib/google-ads';
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
      if (needsBackgroundRefresh) {
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
      }
    } else {
      // ❌ CACHE MISS - Fetch from Google Ads API
      console.log(`[API] Cache MISS - fetching from Google Ads API`);
      recordCacheMiss();

      const cacheKey = createMemCacheKey(
        'campaigns',
        googleAdsAccount.googleAccountId,
        startDate,
        endDate
      );

      campaigns = await getOrSet(
        cacheKey,
        () => fetchCampaigns(
          googleOAuthAccount.refresh_token!,
          googleAdsAccount.googleAccountId,
          googleAdsAccount.parentManagerId || undefined,
          startDate,
          endDate
        ),
        MEM_CACHE_TTL.MEDIUM
      );

      // Store in MetricsFact for future cache hits (background, don't await)
      storeCampaignMetrics(
        googleAdsAccount.id,
        googleAdsAccount.googleAccountId,
        campaigns,
        endDate
      ).catch(err => console.error('[API] Failed to cache metrics:', err));
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

    // Return data with comprehensive metadata
    return NextResponse.json({
      campaigns,
      _meta: {
        source: dataSource,
        ageSeconds: cacheAge === Infinity ? null : Math.round(cacheAge / 1000),
        lastSyncedAt: oldestSyncDate?.toISOString() || null,
        refreshing: refreshInProgress,
        query: {
          customerId: googleAdsAccount.googleAccountId,
          startDate,
          endDate,
        },
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

/**
 * Store campaign metrics in MetricsFact table for caching
 */
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

  for (const campaign of campaigns) {
    // Store in MetricsFact (aggregated for now - single row per campaign)
    await prisma.metricsFact.upsert({
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
    });

    // Store in EntityHierarchy for name/status/type lookup
    await prisma.entityHierarchy.upsert({
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
    });
  }

  console.log(`[Cache] Stored ${campaigns.length} campaigns in MetricsFact`);
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
