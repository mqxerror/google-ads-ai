/**
 * Google Ads Search Terms API
 *
 * GET: Fetch search terms report from Google Ads
 * Returns search terms with metrics for negative keyword analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleAdsClient, getCustomer } from '@/lib/google-ads';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.refreshToken) {
      return NextResponse.json({
        error: 'Not authenticated',
        searchTerms: []
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const campaignId = searchParams.get('campaignId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!customerId) {
      return NextResponse.json({
        error: 'customerId is required',
        searchTerms: []
      }, { status: 400 });
    }

    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const client = createGoogleAdsClient();
    const customer = getCustomer(client, customerId, session.refreshToken, loginCustomerId);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Build campaign filter
    const campaignFilter = campaignId
      ? `AND campaign.id = ${campaignId}`
      : '';

    // Fetch search terms report
    const query = `
      SELECT
        search_term_view.search_term,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        segments.search_term_match_type
      FROM search_term_view
      WHERE segments.date BETWEEN '${startDateStr}' AND '${endDateStr}'
        ${campaignFilter}
        AND metrics.impressions > 0
      ORDER BY metrics.cost_micros DESC
      LIMIT 500
    `;

    const results = await customer.query(query);

    const searchTerms = results.map((row: any) => {
      const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
      const conversions = row.metrics?.conversions || 0;
      const clicks = row.metrics?.clicks || 0;
      const impressions = row.metrics?.impressions || 0;

      return {
        searchTerm: row.search_term_view?.search_term || '',
        campaignId: row.campaign?.id?.toString() || '',
        campaignName: row.campaign?.name || '',
        adGroupId: row.ad_group?.id?.toString() || '',
        adGroupName: row.ad_group?.name || '',
        impressions,
        clicks,
        cost,
        conversions,
        conversionsValue: row.metrics?.conversions_value || 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? cost / clicks : 0,
        conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
        matchType: row.segments?.search_term_match_type || 'UNKNOWN',
        // Flag potential wasters: high cost, zero conversions
        isWaster: cost > 5 && conversions === 0,
      };
    });

    // Calculate summary stats
    const totalCost = searchTerms.reduce((sum: number, st: any) => sum + st.cost, 0);
    const wasterCost = searchTerms
      .filter((st: any) => st.isWaster)
      .reduce((sum: number, st: any) => sum + st.cost, 0);

    return NextResponse.json({
      searchTerms,
      summary: {
        totalTerms: searchTerms.length,
        totalCost,
        wasterCount: searchTerms.filter((st: any) => st.isWaster).length,
        wasterCost,
        potentialSavings: wasterCost * 0.8, // Assume 80% can be saved
      },
      dateRange: { startDate: startDateStr, endDate: endDateStr },
    });

  } catch (error) {
    console.error('[Search Terms API] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch search terms',
      searchTerms: [],
    }, { status: 500 });
  }
}
