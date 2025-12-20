import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchDailyMetrics } from '@/lib/google-ads';
import { EntityType, DataFreshness, Prisma } from '@prisma/client';
import { isToday, parseISO } from 'date-fns';

// Generate demo metrics for a date range
function generateDemoMetrics(startDate: string, endDate: string) {
  const metrics = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseMultiplier = isWeekend ? 0.7 : 1;

    metrics.push({
      date: d.toISOString().split('T')[0],
      spend: Math.round((800 + Math.random() * 400) * baseMultiplier * 100) / 100,
      clicks: Math.round((1200 + Math.random() * 600) * baseMultiplier),
      impressions: Math.round((45000 + Math.random() * 15000) * baseMultiplier),
      conversions: Math.round((35 + Math.random() * 20) * baseMultiplier),
      conversionValue: Math.round((5000 + Math.random() * 2000) * baseMultiplier * 100) / 100,
    });
  }

  return metrics;
}

// GET /api/google-ads/reports?accountId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  // Demo mode - return mock metrics
  if (isDemoMode) {
    const metrics = generateDemoMetrics(startDate, endDate);
    return NextResponse.json({ metrics });
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

    // ========================================
    // DB-FIRST STRATEGY: Check cache before API
    // ========================================

    // Check if we have cached daily metrics in MetricsFact table
    const cachedMetrics = await prisma.metricsFact.findMany({
      where: {
        customerId: googleAdsAccount.googleAccountId,
        entityType: EntityType.ACCOUNT,
        entityId: googleAdsAccount.googleAccountId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: 'asc' },
    });

    // Check cache freshness (less than 15 minutes old)
    const hasFreshCache = cachedMetrics.length > 0 &&
      cachedMetrics.some(m => {
        const syncAge = Date.now() - m.syncedAt.getTime();
        return syncAge < 15 * 60 * 1000; // 15 minutes
      });

    // Check if we have all dates in the range cached
    const startD = new Date(startDate);
    const endD = new Date(endDate);
    const expectedDays = Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const hasAllDays = cachedMetrics.length >= expectedDays;

    let metrics;
    let dataSource: 'cache' | 'api' = 'api';

    if (hasFreshCache && hasAllDays) {
      // ✅ CACHE HIT - Build daily metrics from cache
      console.log(`[API] Reports Cache HIT - returning ${cachedMetrics.length} cached daily metrics`);
      dataSource = 'cache';

      metrics = cachedMetrics.map(m => ({
        date: m.date.toISOString().split('T')[0],
        spend: Number(m.costMicros) / 1_000_000,
        clicks: Number(m.clicks),
        impressions: Number(m.impressions),
        conversions: Number(m.conversions),
        conversionValue: Number(m.conversionsValue),
      }));
    } else {
      // ❌ CACHE MISS - Fetch from Google Ads API
      console.log(`[API] Reports Cache MISS - fetching from Google Ads API`);

      metrics = await fetchDailyMetrics(
        googleOAuthAccount.refresh_token,
        googleAdsAccount.googleAccountId,
        startDate,
        endDate,
        googleAdsAccount.parentManagerId || undefined
      );

      // Store in MetricsFact for future cache hits (background, don't await)
      storeDailyMetrics(
        googleAdsAccount.id,
        googleAdsAccount.googleAccountId,
        metrics
      ).catch(err => console.error('[API] Failed to cache daily metrics:', err));
    }

    return NextResponse.json({
      metrics,
      _meta: {
        source: dataSource,
        query: {
          customerId: googleAdsAccount.googleAccountId,
          startDate,
          endDate,
        },
        executedAt: new Date().toISOString(),
        cacheInfo: {
          hasFreshCache,
          cachedDays: hasFreshCache ? metrics.length : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching report data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report data', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Store daily account metrics in MetricsFact table for caching
 */
async function storeDailyMetrics(
  accountId: string,
  customerId: string,
  metrics: Array<{
    date: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    conversionValue?: number;
  }>
): Promise<void> {
  for (const metric of metrics) {
    const dataFreshness = isToday(parseISO(metric.date))
      ? DataFreshness.PARTIAL
      : DataFreshness.FINAL;

    await prisma.metricsFact.upsert({
      where: {
        customerId_entityType_entityId_date: {
          customerId,
          entityType: EntityType.ACCOUNT,
          entityId: customerId,
          date: new Date(metric.date),
        },
      },
      create: {
        customerId,
        entityType: EntityType.ACCOUNT,
        entityId: customerId,
        date: new Date(metric.date),
        impressions: BigInt(metric.impressions || 0),
        clicks: BigInt(metric.clicks || 0),
        costMicros: BigInt(Math.round((metric.spend || 0) * 1_000_000)),
        conversions: new Prisma.Decimal(metric.conversions || 0),
        conversionsValue: new Prisma.Decimal(metric.conversionValue || 0),
        ctr: new Prisma.Decimal(metric.impressions > 0 ? metric.clicks / metric.impressions : 0),
        averageCpc: new Prisma.Decimal(metric.clicks > 0 ? metric.spend / metric.clicks : 0),
        accountId,
        dataFreshness,
      },
      update: {
        impressions: BigInt(metric.impressions || 0),
        clicks: BigInt(metric.clicks || 0),
        costMicros: BigInt(Math.round((metric.spend || 0) * 1_000_000)),
        conversions: new Prisma.Decimal(metric.conversions || 0),
        conversionsValue: new Prisma.Decimal(metric.conversionValue || 0),
        ctr: new Prisma.Decimal(metric.impressions > 0 ? metric.clicks / metric.impressions : 0),
        averageCpc: new Prisma.Decimal(metric.clicks > 0 ? metric.spend / metric.clicks : 0),
        dataFreshness,
        syncedAt: new Date(),
      },
    });
  }

  console.log(`[Cache] Stored ${metrics.length} daily account metrics in MetricsFact`);
}
