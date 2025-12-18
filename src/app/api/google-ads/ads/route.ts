import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchAds, createAd, updateAd } from '@/lib/google-ads';

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
