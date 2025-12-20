import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchAdGroups } from '@/lib/google-ads';
import { DEMO_AD_GROUPS } from '@/lib/demo-data';
import { EntityType, DataFreshness, Prisma } from '@prisma/client';
import { isToday, parseISO } from 'date-fns';
import {
  createRefreshKey,
  tryAcquireLock,
  releaseLock,
  setBackoff,
  isRefreshing,
} from '@/lib/refresh-lock';

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

    // Check cache freshness with TTL thresholds
    const oldestSync = cachedMetrics.length > 0
      ? Math.min(...cachedMetrics.map(m => m.syncedAt.getTime()))
      : 0;
    const cacheAge = oldestSync > 0 ? Date.now() - oldestSync : Infinity;

    const FRESH_THRESHOLD = 5 * 60 * 1000;  // 5 minutes - super fresh
    const STALE_THRESHOLD = 15 * 60 * 1000; // 15 minutes - still usable

    const hasFreshCache = cacheAge < STALE_THRESHOLD && cachedMetrics.length > 0;
    const needsBackgroundRefresh = cacheAge >= FRESH_THRESHOLD && cacheAge < STALE_THRESHOLD;

    let adGroups;
    let dataSource: 'cache' | 'api' = 'api';

    if (hasFreshCache && nameMap.size > 0) {
      // ✅ CACHE HIT - Build ad groups from cached metrics
      console.log(`[API] Ad Groups Cache HIT - returning ${cachedMetrics.length} cached metrics (age: ${Math.round(cacheAge / 1000)}s)`);
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
        console.log(`[API] Ad Groups Cache STALE - triggering background refresh`);
        backgroundRefreshAdGroups(
          googleOAuthAccount.refresh_token!,
          googleAdsAccount.id,
          googleAdsAccount.googleAccountId,
          campaignId,
          googleAdsAccount.parentManagerId || undefined,
          startDate,
          endDate
        ).catch(err => console.error('[API] Background refresh failed:', err));
      }
    } else {
      // ❌ CACHE MISS - Fetch from Google Ads API
      console.log(`[API] Ad Groups Cache MISS - fetching from Google Ads API`);

      adGroups = await fetchAdGroups(
        googleOAuthAccount.refresh_token,
        googleAdsAccount.googleAccountId,
        campaignId,
        startDate,
        endDate,
        googleAdsAccount.parentManagerId || undefined
      );

      // Store in MetricsFact for future cache hits (background, don't await)
      storeAdGroupMetrics(
        googleAdsAccount.id,
        googleAdsAccount.googleAccountId,
        campaignId,
        adGroups,
        endDate
      ).catch(err => console.error('[API] Failed to cache ad group metrics:', err));
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

    // Return data with comprehensive metadata
    return NextResponse.json({
      adGroups,
      _meta: {
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

/**
 * Store ad group metrics in MetricsFact table for caching
 */
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
  endDate: string
): Promise<void> {
  const dataFreshness = isToday(parseISO(endDate))
    ? DataFreshness.PARTIAL
    : DataFreshness.FINAL;

  for (const adGroup of adGroups) {
    // Store in MetricsFact
    await prisma.metricsFact.upsert({
      where: {
        customerId_entityType_entityId_date: {
          customerId,
          entityType: EntityType.AD_GROUP,
          entityId: adGroup.id,
          date: new Date(endDate),
        },
      },
      create: {
        customerId,
        entityType: EntityType.AD_GROUP,
        entityId: adGroup.id,
        parentEntityType: EntityType.CAMPAIGN,
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
    });

    // Store in EntityHierarchy for name/status lookup
    await prisma.entityHierarchy.upsert({
      where: {
        customerId_entityType_entityId: {
          customerId,
          entityType: EntityType.AD_GROUP,
          entityId: adGroup.id,
        },
      },
      create: {
        customerId,
        entityType: EntityType.AD_GROUP,
        entityId: adGroup.id,
        entityName: adGroup.name,
        status: adGroup.status,
        parentEntityType: EntityType.CAMPAIGN,
        parentEntityId: campaignId,
        accountId,
      },
      update: {
        entityName: adGroup.name,
        status: adGroup.status,
        parentEntityId: campaignId,
        lastUpdated: new Date(),
      },
    });
  }

  console.log(`[Cache] Stored ${adGroups.length} ad groups in MetricsFact`);
}

/**
 * Background refresh ad groups with lock protection
 * Fetches fresh data from Google Ads API and updates the cache
 */
async function backgroundRefreshAdGroups(
  refreshToken: string,
  accountId: string,
  customerId: string,
  campaignId: string,
  parentManagerId: string | undefined,
  startDate: string,
  endDate: string
): Promise<void> {
  const lockKey = createRefreshKey(customerId, 'AD_GROUP', campaignId, startDate, endDate);

  // Try to acquire lock - if already refreshing, skip
  if (!tryAcquireLock(lockKey)) {
    return;
  }

  try {
    console.log(`[Background] Starting ad groups refresh for campaign ${campaignId}`);

    // Fetch fresh data from Google Ads API
    const adGroups = await fetchAdGroups(
      refreshToken,
      customerId,
      campaignId,
      startDate,
      endDate,
      parentManagerId
    );

    // Store in cache
    await storeAdGroupMetrics(accountId, customerId, campaignId, adGroups, endDate);

    console.log(`[Background] Completed ad groups refresh: ${adGroups.length} ad groups`);
  } catch (error) {
    const errorStr = String(error);

    // Check for rate limit and set backoff
    const retryMatch = errorStr.match(/Retry in (\d+) seconds/);
    if (retryMatch) {
      const retrySeconds = parseInt(retryMatch[1], 10);
      setBackoff(lockKey, retrySeconds);
      console.error(`[Background] Rate limited, backing off for ${retrySeconds}s`);
    } else {
      // For other errors, set a short backoff to prevent hammering
      setBackoff(lockKey, 60);
      console.error(`[Background] Refresh failed:`, error);
    }
  } finally {
    releaseLock(lockKey);
  }
}
