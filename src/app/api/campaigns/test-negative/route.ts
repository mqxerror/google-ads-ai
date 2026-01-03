import { NextRequest, NextResponse } from 'next/server';
import { createGoogleAdsClient, getCustomer } from '@/lib/google-ads';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Test endpoint to verify negative keywords are properly added to a campaign
 * Usage: POST /api/campaigns/test-negative
 * Body: { campaignId: "123456789", negativeKeywords: ["free", "cheap"] }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id || !session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = request.headers.get('x-customer-id');
    if (!customerId) {
      return NextResponse.json({ error: 'Missing customer ID' }, { status: 400 });
    }

    const body = await request.json();
    const { campaignId, negativeKeywords } = body;

    if (!campaignId || !negativeKeywords || negativeKeywords.length === 0) {
      return NextResponse.json(
        { error: 'Missing campaignId or negativeKeywords' },
        { status: 400 }
      );
    }

    const client = createGoogleAdsClient();
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const customer = getCustomer(client, customerId, session.accessToken, loginCustomerId);

    const campaignResourceName = `customers/${customerId}/campaigns/${campaignId}`;

    console.log('[Test Negative] Adding negative keywords to campaign:', campaignId);
    console.log('[Test Negative] Keywords:', negativeKeywords);

    try {
      const negativeKeywordOperations = negativeKeywords.map((keyword: string) => ({
        campaign: campaignResourceName,
        negative: true,
        keyword: {
          text: keyword,
          match_type: 4, // BROAD
        },
        type: 'KEYWORD',
      }));

      console.log('[Test Negative] Operations:', JSON.stringify(negativeKeywordOperations, null, 2));

      const result = await customer.campaignCriteria.create(negativeKeywordOperations as any);

      console.log('[Test Negative] ✅ Success! Result:', result);

      return NextResponse.json({
        success: true,
        message: `Successfully added ${negativeKeywords.length} negative keywords`,
        keywords: negativeKeywords,
        result: result.results?.map((r: any) => r.resource_name),
      });
    } catch (error) {
      console.error('[Test Negative] ❌ Error:', error);

      return NextResponse.json(
        {
          error: 'Failed to add negative keywords',
          details: error instanceof Error ? error.message : 'Unknown error',
          keywords: negativeKeywords,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Test Negative] Outer error:', error);
    return NextResponse.json(
      {
        error: 'Request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
