import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchAdGroups } from '@/lib/google-ads';
import { DEMO_AD_GROUPS } from '@/lib/demo-data';

// GET /api/google-ads/ad-groups?accountId=xxx&campaignId=xxx&startDate=xxx&endDate=xxx - Fetch ad groups for a campaign
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const campaignId = searchParams.get('campaignId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate are required for consistent metrics' },
      { status: 400 }
    );
  }

  // Demo mode - return mock ad groups for the campaign
  if (isDemoMode) {
    const adGroups = DEMO_AD_GROUPS.filter(ag => ag.campaignId === campaignId);
    return NextResponse.json({ adGroups });
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

    // Log the actual query being executed for debugging
    console.log(`[API] fetchAdGroups - customerId: ${googleAdsAccount.googleAccountId}, campaignId: ${campaignId}, dateRange: ${startDate} to ${endDate}`);

    // Fetch ad groups from Google Ads API with date filtering for consistent metrics
    const adGroups = await fetchAdGroups(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      campaignId,
      startDate,
      endDate,
      googleAdsAccount.parentManagerId || undefined
    );

    // Return data with metadata about the query that was executed
    return NextResponse.json({
      adGroups,
      _meta: {
        query: {
          customerId: googleAdsAccount.googleAccountId,
          campaignId,
          startDate,
          endDate,
        },
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching ad groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad groups', details: String(error) },
      { status: 500 }
    );
  }
}
