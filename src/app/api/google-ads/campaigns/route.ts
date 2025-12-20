import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchCampaigns, createCampaign, updateCampaign } from '@/lib/google-ads';
import { getOrSet, createCacheKey, invalidateAccountCache, CACHE_TTL } from '@/lib/cache';
import { DEMO_CAMPAIGNS } from '@/lib/demo-data';

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

    // For MCC client accounts, we need to pass the loginCustomerId (parent manager ID)
    // Use caching to reduce API calls - cache for 5 minutes
    const cacheKey = createCacheKey(
      'campaigns',
      googleAdsAccount.googleAccountId,
      startDate,
      endDate
    );

    const campaigns = await getOrSet(
      cacheKey,
      () => fetchCampaigns(
        googleOAuthAccount.refresh_token!, // Already validated above
        googleAdsAccount.googleAccountId,
        googleAdsAccount.parentManagerId || undefined,
        startDate,
        endDate
      ),
      CACHE_TTL.MEDIUM // 5 minute cache
    );

    // Update last sync time
    await prisma.googleAdsAccount.update({
      where: { id: accountId },
      data: { lastSyncAt: new Date() },
    });

    // Return data with metadata about the query that was executed
    return NextResponse.json({
      campaigns,
      _meta: {
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
