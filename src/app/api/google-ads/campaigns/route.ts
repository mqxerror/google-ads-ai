import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateCampaignStatus, createCampaign, CreateCampaignInput, fetchCampaigns } from '@/lib/google-ads';
import { getCampaignsFromDB, getLastSyncStatus, canSync } from '@/lib/data-sync';
import { logGoogleAdsCall, logError } from '@/lib/log-store';

// Demo campaigns for testing (shown when no DB data available)
const DEMO_CAMPAIGNS = [
  { id: '1', name: 'Brand Search', status: 'ENABLED' as const, type: 'SEARCH' as const, spend: 2500, clicks: 1200, impressions: 15000, conversions: 45, ctr: 8.0, cpa: 55.56, roas: 3.2, aiScore: 78, aiRecommendation: 'Consider increasing budget' },
  { id: '2', name: 'Generic Keywords', status: 'ENABLED' as const, type: 'SEARCH' as const, spend: 4200, clicks: 800, impressions: 25000, conversions: 12, ctr: 3.2, cpa: 350, roas: 0.8, aiScore: 35, aiRecommendation: 'High CPA - review keywords' },
  { id: '3', name: 'Shopping Feed', status: 'ENABLED' as const, type: 'SHOPPING' as const, spend: 1800, clicks: 650, impressions: 12000, conversions: 28, ctr: 5.4, cpa: 64.29, roas: 4.1, aiScore: 82, aiRecommendation: 'Top performer - scale up' },
  { id: '4', name: 'Display Remarketing', status: 'PAUSED' as const, type: 'DISPLAY' as const, spend: 950, clicks: 200, impressions: 45000, conversions: 3, ctr: 0.4, cpa: 316.67, roas: 0.5, aiScore: 28, aiRecommendation: 'Underperforming - consider removal' },
  { id: '5', name: 'Performance Max', status: 'ENABLED' as const, type: 'PERFORMANCE_MAX' as const, spend: 3200, clicks: 950, impressions: 32000, conversions: 52, ctr: 2.97, cpa: 61.54, roas: 2.8, aiScore: 71, aiRecommendation: 'Good performance, monitor closely' },
];

/**
 * Format time ago string from a date
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    // Use loginCustomerId from request, or fall back to env var
    const loginCustomerId = searchParams.get('loginCustomerId') || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    // Date range parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log(`[Campaigns API] Request: customerId=${customerId}, startDate=${startDate}, endDate=${endDate}, forceRefresh=${forceRefresh}`);

    // Demo mode - return demo data
    if (!customerId || customerId === 'demo') {
      return NextResponse.json({
        campaigns: DEMO_CAMPAIGNS,
        isDemo: true,
        dataFreshness: null,
        canSync: false,
      });
    }

    // Force refresh - fetch directly from Google Ads API (bypasses cache and rate limits)
    // This is a "light refresh" that doesn't update the database but shows latest campaigns
    if (forceRefresh && session?.refreshToken) {
      const startTime = Date.now();
      try {
        console.log(`[Campaigns API] Force refresh - fetching from Google Ads API (${startDate} to ${endDate})`);
        logGoogleAdsCall('fetchCampaigns (force refresh)', {
          customerId,
          startDate,
          endDate,
          source: 'force_refresh',
        });

        const campaigns = await fetchCampaigns(
          session.refreshToken,
          customerId,
          loginCustomerId,
          startDate || undefined,
          endDate || undefined
        );

        logGoogleAdsCall('fetchCampaigns completed', {
          customerId,
          campaignCount: campaigns.length,
          totalSpend: campaigns.reduce((sum, c) => sum + (c.spend || 0), 0),
          dateRange: { startDate, endDate },
        }, startTime);

        return NextResponse.json({
          campaigns,
          isDemo: false,
          dataFreshness: {
            lastSyncedAt: new Date().toISOString(),
            timeAgo: 'just now',
            isStale: false,
            isLiveData: true, // Flag to indicate this is live data, not cached
          },
          canSync: true,
          source: 'live_api',
          dateRange: { startDate, endDate },
        });
      } catch (apiError) {
        console.error('[Campaigns API] Force refresh failed:', apiError);
        logError('google_ads', 'Force refresh failed', apiError);
        // Fall through to cached data
      }
    }

    // Try to get cached data from database first (no API call!)
    try {
      const campaigns = await getCampaignsFromDB(customerId);
      const syncStatus = await getLastSyncStatus(customerId);
      const syncCheck = await canSync(customerId, true);

      // If we have cached data, return it
      if (campaigns.length > 0) {
        const lastSyncedAt = syncStatus.lastSyncedAt
          ? new Date(syncStatus.lastSyncedAt)
          : null;

        return NextResponse.json({
          campaigns,
          isDemo: false,
          dataFreshness: lastSyncedAt
            ? {
                lastSyncedAt: lastSyncedAt.toISOString(),
                timeAgo: formatTimeAgo(lastSyncedAt),
                isStale: Date.now() - lastSyncedAt.getTime() > 24 * 60 * 60 * 1000, // > 24 hours
              }
            : null,
          canSync: syncCheck.allowed,
          nextSyncAt: syncCheck.nextSyncAt?.toISOString() || null,
          source: 'cache',
        });
      }

      // No cached data - try live API fetch if authenticated
      if (session?.refreshToken) {
        const startTime = Date.now();
        try {
          console.log(`[Campaigns API] No cache, fetching from Google Ads API (${startDate} to ${endDate})`);
          logGoogleAdsCall('fetchCampaigns (no cache)', {
            customerId,
            startDate,
            endDate,
            source: 'no_cache',
          });

          const campaigns = await fetchCampaigns(
            session.refreshToken,
            customerId,
            loginCustomerId,
            startDate || undefined,
            endDate || undefined
          );

          logGoogleAdsCall('fetchCampaigns completed', {
            customerId,
            campaignCount: campaigns.length,
            totalSpend: campaigns.reduce((sum, c) => sum + (c.spend || 0), 0),
            dateRange: { startDate, endDate },
          }, startTime);

          if (campaigns.length > 0) {
            return NextResponse.json({
              campaigns,
              isDemo: false,
              needsSync: true, // Encourage full sync for metrics storage
              message: 'Showing live data. Click "Sync Data" to cache metrics.',
              canSync: syncCheck.allowed,
              source: 'live_api',
              dateRange: { startDate, endDate },
            });
          }
        } catch (apiError) {
          console.error('[Campaigns API] Live API fetch failed:', apiError);
          logError('google_ads', 'Live API fetch failed', apiError);
        }
      }

      // No cached data and API failed - return demo mode until first sync
      return NextResponse.json({
        campaigns: DEMO_CAMPAIGNS,
        isDemo: true,
        needsSync: true,
        message: 'No cached data. Click "Sync Data" to fetch from Google Ads.',
        canSync: syncCheck.allowed,
      });
    } catch (dbError) {
      console.error('[Campaigns API] Database error:', dbError);
      // Fallback to demo if database unavailable
      return NextResponse.json({
        campaigns: DEMO_CAMPAIGNS,
        isDemo: true,
        error: 'Database unavailable',
      });
    }
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({
      campaigns: DEMO_CAMPAIGNS,
      isDemo: true,
      error: 'Failed to load campaigns',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { customerId, campaign } = body as {
      customerId: string;
      campaign: CreateCampaignInput;
    };

    if (!session?.refreshToken || !customerId || customerId === 'demo') {
      // Demo mode - simulate success
      return NextResponse.json({
        success: true,
        campaignId: `demo-${Date.now()}`,
      });
    }

    const result = await createCampaign(
      session.refreshToken,
      customerId,
      campaign,
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { customerId, campaignId, status } = body as {
      customerId: string;
      campaignId: string;
      status: 'ENABLED' | 'PAUSED';
    };

    if (!session?.refreshToken || !customerId || customerId === 'demo') {
      return NextResponse.json({ success: true });
    }

    const result = await updateCampaignStatus(
      session.refreshToken,
      customerId,
      campaignId,
      status,
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}
