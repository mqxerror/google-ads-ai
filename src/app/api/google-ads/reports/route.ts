import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchDailyMetrics } from '@/lib/google-ads';

// Generate demo metrics for a date range
function generateDemoMetrics(startDate: string, endDate: string) {
  const metrics = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseMultiplier = isWeekend ? 0.7 : 1;

    metrics.push({
      date: d.toISOString().split('T')[0],
      spend: Math.round((800 + Math.random() * 400) * baseMultiplier * 100) / 100,
      clicks: Math.round((1200 + Math.random() * 600) * baseMultiplier),
      impressions: Math.round((45000 + Math.random() * 15000) * baseMultiplier),
      conversions: Math.round((35 + Math.random() * 20) * baseMultiplier),
      conversionValue: Math.round((5000 + Math.random() * 2000) * baseMultiplier * 100) / 100,
    });
  }

  return metrics;
}

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

  // Demo mode - return mock metrics
  if (isDemoMode) {
    const metrics = generateDemoMetrics(startDate, endDate);
    return NextResponse.json({ metrics });
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
