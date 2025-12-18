import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchAdGroups } from '@/lib/google-ads';

// GET /api/google-ads/ad-groups?accountId=xxx&campaignId=xxx - Fetch ad groups for a campaign
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const campaignId = searchParams.get('campaignId');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
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

    // Fetch ad groups from Google Ads API
    const adGroups = await fetchAdGroups(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      campaignId,
      googleAdsAccount.parentManagerId || undefined
    );

    return NextResponse.json({ adGroups });
  } catch (error) {
    console.error('Error fetching ad groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad groups', details: String(error) },
      { status: 500 }
    );
  }
}
