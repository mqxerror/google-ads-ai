/**
 * Compare Mode API
 *
 * GET /api/google-ads/campaigns/compare - Fetch comparison data for campaigns
 *
 * Compares current period metrics with previous equivalent period
 * and returns deltas for inline display in the grid.
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { CampaignComparison } from '@/types/campaign';

interface ComparisonData {
  campaignId: string;
  comparison: CampaignComparison;
}

// GET: Fetch comparison data for campaigns
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const startDate = searchParams.get('startDate'); // Current period start
  const endDate = searchParams.get('endDate'); // Current period end

  if (!accountId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'accountId, startDate, and endDate are required' },
      { status: 400 }
    );
  }

  try {
    // Get account
    const account = await prisma.googleAdsAccount.findUnique({
      where: { id: accountId },
      select: { googleAccountId: true },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const customerId = account.googleAccountId;

    // Parse dates
    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);

    // Calculate duration in days
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1;

    // Calculate previous period (same duration ending before current start)
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - durationDays + 1);

    // Fetch metrics for both periods
    const [currentMetrics, previousMetrics] = await Promise.all([
      fetchPeriodMetrics(customerId, currentStart, currentEnd),
      fetchPeriodMetrics(customerId, previousStart, previousEnd),
    ]);

    // Build previous metrics map
    const previousMap = new Map(previousMetrics.map((m) => [m.campaignId, m]));

    // Calculate comparisons
    const comparisons: ComparisonData[] = currentMetrics.map((current) => {
      const previous = previousMap.get(current.campaignId);

      // Calculate deltas (handle division by zero)
      const calcDelta = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
      };

      const comparison: CampaignComparison = {
        previousSpend: previous?.spend || 0,
        previousClicks: previous?.clicks || 0,
        previousImpressions: previous?.impressions || 0,
        previousConversions: previous?.conversions || 0,
        previousCpa: previous?.cpa || 0,
        previousCtr: previous?.ctr || 0,
        previousRoas: previous?.roas || 0,
        spendDelta: calcDelta(current.spend, previous?.spend || 0),
        clicksDelta: calcDelta(current.clicks, previous?.clicks || 0),
        impressionsDelta: calcDelta(current.impressions, previous?.impressions || 0),
        conversionsDelta: calcDelta(current.conversions, previous?.conversions || 0),
        cpaDelta: calcDelta(current.cpa, previous?.cpa || 0),
        ctrDelta: calcDelta(current.ctr, previous?.ctr || 0),
        roasDelta: calcDelta(current.roas, previous?.roas || 0),
        comparePeriod: {
          start: previousStart.toISOString().split('T')[0],
          end: previousEnd.toISOString().split('T')[0],
        },
      };

      return {
        campaignId: current.campaignId,
        comparison,
      };
    });

    return NextResponse.json({
      success: true,
      comparisons,
      currentPeriod: {
        start: startDate,
        end: endDate,
        days: durationDays,
      },
      comparePeriod: {
        start: previousStart.toISOString().split('T')[0],
        end: previousEnd.toISOString().split('T')[0],
        days: durationDays,
      },
    });
  } catch (error) {
    console.error('[Compare API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comparison data', details: String(error) },
      { status: 500 }
    );
  }
}

// Helper: Fetch aggregated metrics for a period
async function fetchPeriodMetrics(
  customerId: string,
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    campaignId: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    cpa: number;
    ctr: number;
    roas: number;
  }>
> {
  // Query MetricsFact for the date range
  const metrics = await prisma.metricsFact.groupBy({
    by: ['entityId'],
    where: {
      customerId,
      entityType: 'CAMPAIGN',
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      impressions: true,
      clicks: true,
      costMicros: true,
      conversions: true,
      conversionsValue: true,
    },
  });

  return metrics.map((m) => {
    const spend = Number(m._sum.costMicros || 0) / 1_000_000;
    const clicks = Number(m._sum.clicks || 0);
    const impressions = Number(m._sum.impressions || 0);
    const conversions = Number(m._sum.conversions || 0);
    const conversionValue = Number(m._sum.conversionsValue || 0);

    return {
      campaignId: m.entityId,
      spend,
      clicks,
      impressions,
      conversions,
      cpa: conversions > 0 ? spend / conversions : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      roas: spend > 0 ? conversionValue / spend : 0,
    };
  });
}
