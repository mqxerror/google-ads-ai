import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchCampaigns, createCampaign, updateCampaign } from '@/lib/google-ads';

// GET /api/google-ads/campaigns?accountId=xxx - Fetch campaigns for an account
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const startDate = searchParams.get('startDate') || undefined; // YYYY-MM-DD
  const endDate = searchParams.get('endDate') || undefined;     // YYYY-MM-DD

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
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

    // For MCC client accounts, we need to pass the loginCustomerId (parent manager ID)
    const campaigns = await fetchCampaigns(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      googleAdsAccount.parentManagerId || undefined,
      startDate,
      endDate
    );

    // Update last sync time
    await prisma.googleAdsAccount.update({
      where: { id: accountId },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign', details: String(error) },
      { status: 500 }
    );
  }
}
