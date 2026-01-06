import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchAdGroupKeywords } from '@/lib/google-ads';

// Demo keywords for testing
const DEMO_KEYWORDS = [
  { id: '1', adGroupId: '1', campaignId: '1', keyword: 'brand shoes', matchType: 'EXACT', status: 'ENABLED', qualityScore: 9, impressions: 2000, clicks: 180, conversions: 8, spend: 350, ctr: 9.0, cpa: 43.75 },
  { id: '2', adGroupId: '1', campaignId: '1', keyword: 'brand sneakers', matchType: 'PHRASE', status: 'ENABLED', qualityScore: 8, impressions: 1500, clicks: 120, conversions: 5, spend: 250, ctr: 8.0, cpa: 50.00 },
  { id: '3', adGroupId: '1', campaignId: '1', keyword: 'buy brand shoes online', matchType: 'BROAD', status: 'ENABLED', qualityScore: 7, impressions: 1000, clicks: 80, conversions: 2, spend: 180, ctr: 8.0, cpa: 90.00 },
  { id: '4', adGroupId: '2', campaignId: '1', keyword: 'running shoes', matchType: 'EXACT', status: 'ENABLED', qualityScore: 6, impressions: 3000, clicks: 200, conversions: 10, spend: 450, ctr: 6.7, cpa: 45.00 },
  { id: '5', adGroupId: '2', campaignId: '1', keyword: 'athletic footwear', matchType: 'BROAD', status: 'PAUSED', qualityScore: 4, impressions: 5000, clicks: 150, conversions: 3, spend: 400, ctr: 3.0, cpa: 133.33 },
  { id: '6', adGroupId: '4', campaignId: '2', keyword: 'cheap shoes', matchType: 'BROAD', status: 'ENABLED', qualityScore: 3, impressions: 8000, clicks: 200, conversions: 2, spend: 900, ctr: 2.5, cpa: 450.00 },
  { id: '7', adGroupId: '4', campaignId: '2', keyword: 'discount footwear', matchType: 'PHRASE', status: 'ENABLED', qualityScore: 4, impressions: 4000, clicks: 180, conversions: 4, spend: 800, ctr: 4.5, cpa: 200.00 },
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const campaignId = searchParams.get('campaignId');
    const adGroupId = searchParams.get('adGroupId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!campaignId || !adGroupId) {
      return NextResponse.json(
        { error: 'campaignId and adGroupId are required' },
        { status: 400 }
      );
    }

    // Demo mode
    if (!customerId || customerId === 'demo') {
      const demoKeywords = DEMO_KEYWORDS.filter(
        kw => kw.campaignId === campaignId && kw.adGroupId === adGroupId
      );
      return NextResponse.json({
        keywords: demoKeywords,
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

    const keywords = await fetchAdGroupKeywords(
      session.refreshToken,
      customerId,
      campaignId,
      adGroupId,
      startDate || defaultStart,
      endDate || defaultEnd,
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
    );

    return NextResponse.json({
      keywords,
      isDemo: false,
    });
  } catch (error) {
    console.error('Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}
