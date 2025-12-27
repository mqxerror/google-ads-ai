/**
 * API Route: /api/keywords/performance
 * Fetch and return keyword performance data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getKeywordPerformance,
  getKeywordPerformanceSummary,
  getPerformanceTrends,
} from '@/lib/database/account-data';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerId,
      keywords,
      startDate,
      endDate,
      granularity = 'day',
    } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    const userId = session.user.email;

    // Default to last 30 days if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

    console.log(
      `[Performance API] Fetching data for ${keywords?.length || 'all'} keywords`
    );

    // Fetch performance data
    const performance = await getKeywordPerformance(userId, customerId, {
      keywords,
      startDate: start,
      endDate: end,
    });

    // Calculate summary statistics
    const summary = {
      totalImpressions: 0,
      totalClicks: 0,
      totalCost: 0,
      totalConversions: 0,
      avgCtr: 0,
    };

    const costMap = new Map<string, number>();

    for (const record of performance) {
      summary.totalImpressions += record.impressions;
      summary.totalClicks += record.clicks;
      const costInDollars = Number(record.cost_micros) / 1_000_000;
      summary.totalCost += costInDollars;
      summary.totalConversions += Number(record.conversions);

      // Track cost by date for aggregation
      const key = `${record.keyword_normalized}_${record.date}`;
      costMap.set(key, costInDollars);
    }

    summary.avgCtr =
      summary.totalImpressions > 0
        ? summary.totalClicks / summary.totalImpressions
        : 0;

    // Format performance data for response
    const formattedPerformance = performance.map((record) => ({
      keyword: record.keyword_normalized,
      date: record.date.toISOString().split('T')[0],
      impressions: record.impressions,
      clicks: record.clicks,
      cost: Number(record.cost_micros) / 1_000_000,
      conversions: Number(record.conversions),
      ctr: record.ctr ? Number(record.ctr) : 0,
      qualityScore: record.quality_score,
    }));

    // Apply granularity aggregation if not daily
    let aggregatedPerformance = formattedPerformance;

    if (granularity === 'week' || granularity === 'month') {
      const aggregated = new Map<
        string,
        {
          keyword: string;
          period: string;
          impressions: number;
          clicks: number;
          cost: number;
          conversions: number;
        }
      >();

      for (const record of formattedPerformance) {
        const date = new Date(record.date);
        let period: string;

        if (granularity === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          period = weekStart.toISOString().split('T')[0];
        } else {
          // month
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        const key = `${record.keyword}_${period}`;

        if (!aggregated.has(key)) {
          aggregated.set(key, {
            keyword: record.keyword,
            period,
            impressions: 0,
            clicks: 0,
            cost: 0,
            conversions: 0,
          });
        }

        const agg = aggregated.get(key)!;
        agg.impressions += record.impressions;
        agg.clicks += record.clicks;
        agg.cost += record.cost;
        agg.conversions += record.conversions;
      }

      aggregatedPerformance = Array.from(aggregated.values()).map((agg) => ({
        keyword: agg.keyword,
        date: agg.period,
        impressions: agg.impressions,
        clicks: agg.clicks,
        cost: agg.cost,
        conversions: agg.conversions,
        ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        qualityScore: null,
      }));
    }

    console.log(
      `[Performance API] Returning ${aggregatedPerformance.length} records`
    );

    return NextResponse.json({
      performance: aggregatedPerformance,
      summary,
    });
  } catch (error: any) {
    console.error('[Performance API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch performance data',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for single keyword summary
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const keyword = searchParams.get('keyword');
    const days = parseInt(searchParams.get('days') || '30');

    if (!customerId || !keyword) {
      return NextResponse.json(
        { error: 'customerId and keyword are required' },
        { status: 400 }
      );
    }

    const userId = session.user.email;

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const [summary, trends] = await Promise.all([
      getKeywordPerformanceSummary(userId, customerId, keyword, startDate, endDate),
      getPerformanceTrends(userId, customerId, keyword, days),
    ]);

    return NextResponse.json({
      summary,
      trends,
    });
  } catch (error: any) {
    console.error('[Performance API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch keyword summary',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
