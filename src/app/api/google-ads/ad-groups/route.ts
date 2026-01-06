import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchAdGroups } from '@/lib/google-ads';

// Demo ad groups for testing
const DEMO_AD_GROUPS = [
  { id: '1', campaignId: '1', name: 'Brand Terms', status: 'ENABLED', impressions: 5000, clicks: 400, conversions: 15, spend: 800, ctr: 8.0, cpa: 53.33 },
  { id: '2', campaignId: '1', name: 'Product Terms', status: 'ENABLED', impressions: 8000, clicks: 600, conversions: 22, spend: 1200, ctr: 7.5, cpa: 54.55 },
  { id: '3', campaignId: '1', name: 'Competitor Terms', status: 'PAUSED', impressions: 2000, clicks: 200, conversions: 8, spend: 500, ctr: 10.0, cpa: 62.50 },
  { id: '4', campaignId: '2', name: 'Generic Keywords', status: 'ENABLED', impressions: 15000, clicks: 500, conversions: 8, spend: 2500, ctr: 3.3, cpa: 312.50 },
  { id: '5', campaignId: '2', name: 'Long Tail', status: 'ENABLED', impressions: 10000, clicks: 300, conversions: 4, spend: 1700, ctr: 3.0, cpa: 425.00 },
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const campaignId = searchParams.get('campaignId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    // Demo mode
    if (!customerId || customerId === 'demo') {
      const demoAdGroups = DEMO_AD_GROUPS.filter(ag => ag.campaignId === campaignId);
      return NextResponse.json({
        adGroups: demoAdGroups,
        isDemo: true,
      });
    }

    // Real API call
    if (!session?.refreshToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Default date range: last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const defaultStart = thirtyDaysAgo.toISOString().split('T')[0];
    const defaultEnd = today.toISOString().split('T')[0];

    const adGroups = await fetchAdGroups(
      session.refreshToken,
      customerId,
      campaignId,
      startDate || defaultStart,
      endDate || defaultEnd,
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
    );

    return NextResponse.json({
      adGroups,
      isDemo: false,
    });
  } catch (error) {
    console.error('Error fetching ad groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad groups' },
      { status: 500 }
    );
  }
}
