import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchAds, createAd, updateAd } from '@/lib/google-ads';

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

// GET /api/google-ads/ads?accountId=xxx&adGroupId=xxx - Fetch ads for an ad group
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const adGroupId = searchParams.get('adGroupId');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  if (!adGroupId) {
    return NextResponse.json({ error: 'adGroupId is required' }, { status: 400 });
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

    const ads = await fetchAds(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      adGroupId,
      googleAdsAccount.parentManagerId || undefined
    );

    return NextResponse.json({ ads });
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
