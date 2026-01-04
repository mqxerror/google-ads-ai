/**
 * On-Demand Keyword Enrichment API
 *
 * Fetches Volume, CPC, Competition from Google Ads for selected keywords
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchKeywordPlannerMetrics } from '@/lib/google-ads';

// Location code to Google Ads geoTargetConstant mapping
const LOCATION_GEO_CODES: Record<string, string> = {
  'US': '2840',
  'GB': '2826',
  'CA': '2124',
  'AU': '2036',
  'DE': '2276',
  'FR': '2250',
  'ES': '2724',
  'IT': '2380',
  'PT': '2620',
  'BR': '2076',
  'IN': '2356',
  'SG': '2702',
  'AE': '2784',
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { keywords, targetLocation = 'US', providers = ['google_ads'] } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords array required' }, { status: 400 });
    }

    // Limit to 100 keywords per request
    const keywordsToEnrich = keywords.slice(0, 100);

    console.log(`[Enrich API] Enriching ${keywordsToEnrich.length} keywords for location ${targetLocation}`);
    console.log(`[Enrich API] Session has refreshToken: ${!!session.refreshToken}, customerId: ${session.customerId || 'NONE'}`);

    // Check if we have required credentials
    if (!session.refreshToken || !session.customerId) {
      console.error('[Enrich API] Missing credentials - refreshToken or customerId');
      return NextResponse.json({
        error: 'Google Ads not connected. Please reconnect your account.',
        enriched: {}
      }, { status: 200 }); // Return 200 with empty data instead of error
    }

    // Get Google Ads metrics
    const geoCode = LOCATION_GEO_CODES[targetLocation] || '2840';

    // Get loginCustomerId from session or environment (required for MCC accounts)
    const loginCustomerId = (session as any).loginCustomerId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

    console.log(`[Enrich API] Using loginCustomerId: ${loginCustomerId || 'NONE'}, customerId: ${session.customerId}`);

    const googleAdsMetrics = await fetchKeywordPlannerMetrics(
      session.refreshToken || '',
      session.customerId || '',
      keywordsToEnrich,
      loginCustomerId, // Required for MCC accounts
      'en-US',   // locale
      geoCode    // locationId
    );

    // Convert to map for easy lookup
    const enriched: Record<string, any> = {};

    for (const metric of googleAdsMetrics) {
      enriched[metric.keyword] = {
        searchVolume: metric.monthlySearchVolume,
        cpc: metric.avgCpcMicros / 1_000_000,
        competition: metric.competition,
        competitionIndex: metric.competitionIndex,
        lowBidMicros: metric.lowBidMicros,
        highBidMicros: metric.highBidMicros,
        monthlySearchVolumes: metric.monthlySearchVolumes,
        threeMonthChange: metric.threeMonthChange,
        yearOverYearChange: metric.yearOverYearChange,
      };
    }

    console.log(`[Enrich API] Enriched ${Object.keys(enriched).length} keywords`);

    return NextResponse.json({
      enriched,
      stats: {
        requested: keywordsToEnrich.length,
        enriched: Object.keys(enriched).length,
        source: 'google_ads',
      },
    });
  } catch (error) {
    console.error('[Enrich API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to enrich keywords' },
      { status: 500 }
    );
  }
}
