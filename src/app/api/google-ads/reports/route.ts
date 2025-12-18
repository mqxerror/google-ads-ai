import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchDailyMetrics } from '@/lib/google-ads';

// GET /api/google-ads/reports?accountId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
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

    const metrics = await fetchDailyMetrics(
      googleOAuthAccount.refresh_token,
      googleAdsAccount.googleAccountId,
      startDate,
      endDate,
      googleAdsAccount.parentManagerId || undefined
    );

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error fetching report data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report data', details: String(error) },
      { status: 500 }
    );
  }
}
