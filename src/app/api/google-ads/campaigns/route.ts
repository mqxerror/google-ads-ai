import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchCampaigns, updateCampaignStatus, createCampaign, CreateCampaignInput } from '@/lib/google-ads';

// Demo campaigns for testing
const DEMO_CAMPAIGNS = [
  { id: '1', name: 'Brand Search', status: 'ENABLED' as const, type: 'SEARCH' as const, spend: 2500, clicks: 1200, impressions: 15000, conversions: 45, ctr: 8.0, cpa: 55.56, roas: 3.2, aiScore: 78, aiRecommendation: 'Consider increasing budget' },
  { id: '2', name: 'Generic Keywords', status: 'ENABLED' as const, type: 'SEARCH' as const, spend: 4200, clicks: 800, impressions: 25000, conversions: 12, ctr: 3.2, cpa: 350, roas: 0.8, aiScore: 35, aiRecommendation: 'High CPA - review keywords' },
  { id: '3', name: 'Shopping Feed', status: 'ENABLED' as const, type: 'SHOPPING' as const, spend: 1800, clicks: 650, impressions: 12000, conversions: 28, ctr: 5.4, cpa: 64.29, roas: 4.1, aiScore: 82, aiRecommendation: 'Top performer - scale up' },
  { id: '4', name: 'Display Remarketing', status: 'PAUSED' as const, type: 'DISPLAY' as const, spend: 950, clicks: 200, impressions: 45000, conversions: 3, ctr: 0.4, cpa: 316.67, roas: 0.5, aiScore: 28, aiRecommendation: 'Underperforming - consider removal' },
  { id: '5', name: 'Performance Max', status: 'ENABLED' as const, type: 'PERFORMANCE_MAX' as const, spend: 3200, clicks: 950, impressions: 32000, conversions: 52, ctr: 2.97, cpa: 61.54, roas: 2.8, aiScore: 71, aiRecommendation: 'Good performance, monitor closely' },
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');

    // Demo mode or no real credentials
    if (!session?.accessToken || !customerId || customerId === 'demo') {
      return NextResponse.json({ campaigns: DEMO_CAMPAIGNS });
    }

    const campaigns = await fetchCampaigns(
      session.accessToken,
      customerId,
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
    );

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ campaigns: DEMO_CAMPAIGNS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { customerId, campaign } = body as {
      customerId: string;
      campaign: CreateCampaignInput;
    };

    if (!session?.accessToken || !customerId || customerId === 'demo') {
      // Demo mode - simulate success
      return NextResponse.json({
        success: true,
        campaignId: `demo-${Date.now()}`,
      });
    }

    const result = await createCampaign(
      session.accessToken,
      customerId,
      campaign,
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { customerId, campaignId, status } = body as {
      customerId: string;
      campaignId: string;
      status: 'ENABLED' | 'PAUSED';
    };

    if (!session?.accessToken || !customerId || customerId === 'demo') {
      return NextResponse.json({ success: true });
    }

    const result = await updateCampaignStatus(
      session.accessToken,
      customerId,
      campaignId,
      status,
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}
