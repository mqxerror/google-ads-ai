/**
 * Google Ads Negative Keywords API
 *
 * POST: Add negative keywords to Google Ads
 * Supports: account-level (shared list), campaign-level, or ad group-level
 * GET: Fetch existing negative keyword lists
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleAdsClient, getCustomer } from '@/lib/google-ads';

interface AddNegativeKeywordsRequest {
  customerId: string;
  keywords: string[];
  level: 'account' | 'campaign' | 'adgroup';
  campaignId?: string;
  adGroupId?: string;
  listName?: string;
  existingListId?: string; // Add to existing list
  matchType?: 'EXACT' | 'PHRASE' | 'BROAD';
}

// Match type enum values for Google Ads API
const MATCH_TYPE_VALUES: Record<string, number> = {
  'EXACT': 2,
  'PHRASE': 3,
  'BROAD': 4,
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.refreshToken) {
      return NextResponse.json({
        error: 'Not authenticated',
        success: false,
      }, { status: 401 });
    }

    const body: AddNegativeKeywordsRequest = await request.json();
    const {
      customerId,
      keywords,
      level,
      campaignId,
      adGroupId,
      listName,
      existingListId,
      matchType = 'EXACT',
    } = body;

    if (!customerId || !keywords || keywords.length === 0) {
      return NextResponse.json({
        error: 'customerId and keywords are required',
        success: false,
      }, { status: 400 });
    }

    console.log(`[Negative Keywords API] Adding ${keywords.length} keywords at ${level} level`);

    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const client = createGoogleAdsClient();
    const customer = getCustomer(client, customerId, session.refreshToken, loginCustomerId);

    let addedCount = 0;
    const matchTypeValue = MATCH_TYPE_VALUES[matchType] || 2;

    if (level === 'account') {
      // Account level: Use shared negative keyword list
      let sharedSetResourceName: string;

      if (existingListId) {
        // Use existing list
        sharedSetResourceName = `customers/${customerId}/sharedSets/${existingListId}`;
        console.log('[Negative Keywords API] Using existing shared set:', sharedSetResourceName);
      } else {
        // Create new shared set
        const sharedListName = listName || `Quick Ads - Negatives ${new Date().toISOString().split('T')[0]}`;

        try {
          const sharedSetResult = await customer.sharedSets.create([{
            name: sharedListName,
            type: 2, // NEGATIVE_KEYWORDS
          }] as any);

          const resourceName = sharedSetResult.results[0]?.resource_name;

          if (!resourceName) {
            return NextResponse.json({
              error: 'Failed to create shared negative keyword list',
              success: false,
            }, { status: 500 });
          }

          sharedSetResourceName = resourceName;
          console.log('[Negative Keywords API] Created shared set:', sharedSetResourceName);
        } catch (createError: any) {
          console.error('[Negative Keywords API] Error creating shared set:', createError);
          return NextResponse.json({
            error: `Failed to create list: ${createError.message || 'Unknown error'}`,
            success: false,
          }, { status: 500 });
        }
      }

      // Add keywords to the shared set in batches
      const chunkSize = 500;
      for (let i = 0; i < keywords.length; i += chunkSize) {
        const chunk = keywords.slice(i, i + chunkSize);

        try {
          const operations = chunk.map(keyword => ({
            shared_set: sharedSetResourceName,
            keyword: {
              text: keyword,
              match_type: matchTypeValue,
            },
          }));

          await customer.sharedCriteria.create(operations as any);
          addedCount += chunk.length;
          console.log(`[Negative Keywords API] Added batch ${Math.floor(i / chunkSize) + 1}: ${chunk.length} keywords`);
        } catch (batchError: any) {
          console.error('[Negative Keywords API] Error adding batch:', batchError);
          // Continue with remaining batches
        }
      }

      // Link shared set to all active campaigns (if new list)
      if (!existingListId) {
        try {
          const campaignsQuery = `
            SELECT campaign.id, campaign.resource_name
            FROM campaign
            WHERE campaign.status = 'ENABLED'
          `;
          const campaigns = await customer.query(campaignsQuery);

          if (campaigns.length > 0) {
            const linkOperations = campaigns.map((row: any) => ({
              campaign: row.campaign.resource_name,
              shared_set: sharedSetResourceName,
            }));

            await customer.campaignSharedSets.create(linkOperations as any);
            console.log('[Negative Keywords API] Linked to', campaigns.length, 'campaigns');

            return NextResponse.json({
              success: true,
              addedCount,
              sharedSetName: listName || 'Quick Ads Negatives',
              linkedCampaigns: campaigns.length,
              message: `Added ${addedCount} negative keywords and linked to ${campaigns.length} campaigns`,
            });
          }
        } catch (linkError: any) {
          console.error('[Negative Keywords API] Error linking to campaigns:', linkError);
          // Still return success for the keywords added
        }
      }

      return NextResponse.json({
        success: true,
        addedCount,
        sharedSetId: sharedSetResourceName?.split('/').pop(),
        message: `Added ${addedCount} negative keywords to shared list`,
      });

    } else if (level === 'campaign' && campaignId) {
      // Campaign level: Add as campaign negative keywords using mutate
      const campaignResourceName = `customers/${customerId}/campaigns/${campaignId}`;

      const chunkSize = 200; // Smaller chunks for better reliability
      let lastError: any = null;

      for (let i = 0; i < keywords.length; i += chunkSize) {
        const chunk = keywords.slice(i, i + chunkSize);

        try {
          // Use mutate operations directly
          const operations = chunk.map(keyword => ({
            create: {
              campaign: campaignResourceName,
              negative: true,
              keyword: {
                text: keyword,
                match_type: matchTypeValue,
              },
            },
          }));

          console.log('[Negative Keywords API] Mutating campaign criteria:', JSON.stringify(operations[0], null, 2));

          // Use the mutate method directly
          const response = await customer.mutateResources([
            ...operations.map(op => ({
              _resource: 'CampaignCriterion',
              ...op,
            })),
          ] as any);

          addedCount += chunk.length;
          console.log('[Negative Keywords API] Campaign batch success:', chunk.length);
        } catch (batchError: any) {
          console.error('[Negative Keywords API] Campaign batch error:', batchError?.message || batchError);

          // Try alternative approach - use campaignCriteria service
          try {
            console.log('[Negative Keywords API] Trying alternative approach...');
            const altOperations = chunk.map(keyword => ({
              campaign: campaignResourceName,
              negative: true,
              keyword: {
                text: keyword,
                match_type: matchTypeValue,
              },
            }));

            await customer.campaignCriteria.create(altOperations as any);
            addedCount += chunk.length;
            console.log('[Negative Keywords API] Alternative approach success:', chunk.length);
          } catch (altError: any) {
            console.error('[Negative Keywords API] Alternative also failed:', altError?.message || altError);
            lastError = altError;
            if (altError.message?.includes('DUPLICATE')) {
              continue;
            }
          }
        }
      }

      // If nothing was added and there was an error, report it
      if (addedCount === 0 && lastError) {
        return NextResponse.json({
          success: false,
          error: `Failed to add to campaign: ${lastError.message || 'Unknown error'}`,
          details: process.env.NODE_ENV === 'development' ? lastError.message : undefined,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: addedCount > 0,
        addedCount,
        campaignId,
        message: addedCount > 0
          ? `Added ${addedCount} negative keywords to campaign`
          : 'No keywords were added',
      });

    } else if (level === 'adgroup' && adGroupId && campaignId) {
      // Ad group level: Add as ad group negative keywords
      const adGroupResourceName = `customers/${customerId}/adGroups/${adGroupId}`;

      const chunkSize = 500;
      let lastError: any = null;

      for (let i = 0; i < keywords.length; i += chunkSize) {
        const chunk = keywords.slice(i, i + chunkSize);

        try {
          const operations = chunk.map(keyword => ({
            ad_group: adGroupResourceName,
            keyword: {
              text: keyword,
              match_type: matchTypeValue,
            },
            negative: true,
          }));

          await customer.adGroupCriteria.create(operations as any);
          addedCount += chunk.length;
        } catch (batchError: any) {
          console.error('[Negative Keywords API] Ad group batch error:', batchError);
          lastError = batchError;
          if (batchError.message?.includes('DUPLICATE')) {
            continue;
          }
        }
      }

      // If nothing was added and there was an error, report it
      if (addedCount === 0 && lastError) {
        return NextResponse.json({
          success: false,
          error: `Failed to add to ad group: ${lastError.message || 'Unknown error'}`,
          details: process.env.NODE_ENV === 'development' ? lastError.message : undefined,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: addedCount > 0,
        addedCount,
        adGroupId,
        message: addedCount > 0
          ? `Added ${addedCount} negative keywords to ad group`
          : 'No keywords were added',
      });

    } else {
      return NextResponse.json({
        error: 'Invalid level or missing campaignId/adGroupId',
        success: false,
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[Negative Keywords API] Error:', error);

    // Parse Google Ads API error
    let errorMessage = 'Failed to add negative keywords';

    if (error.message) {
      errorMessage = error.message;

      // Handle specific errors
      if (error.message.includes('DUPLICATE')) {
        errorMessage = 'Some keywords already exist as negatives';
      } else if (error.message.includes('PERMISSION_DENIED')) {
        errorMessage = 'Permission denied - check API access';
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        errorMessage = 'API quota exceeded - try again later';
      } else if (error.message.includes('INVALID_ARGUMENT')) {
        errorMessage = 'Invalid keyword format';
      }
    }

    return NextResponse.json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      success: false,
    }, { status: 500 });
  }
}

// GET: Fetch existing negative keyword lists
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.refreshToken) {
      return NextResponse.json({
        error: 'Not authenticated',
        lists: [],
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({
        error: 'customerId is required',
        lists: [],
      }, { status: 400 });
    }

    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const client = createGoogleAdsClient();
    const customer = getCustomer(client, customerId, session.refreshToken, loginCustomerId);

    // Fetch shared negative keyword lists
    const query = `
      SELECT
        shared_set.id,
        shared_set.name,
        shared_set.type,
        shared_set.member_count,
        shared_set.status
      FROM shared_set
      WHERE shared_set.type = 'NEGATIVE_KEYWORDS'
        AND shared_set.status = 'ENABLED'
      ORDER BY shared_set.name
    `;

    const results = await customer.query(query);

    const lists = results.map((row: any) => ({
      id: row.shared_set.id?.toString(),
      name: row.shared_set.name,
      keywordCount: row.shared_set.member_count || 0,
    }));

    // Also fetch campaigns for campaign-level option
    const campaignsQuery = `
      SELECT campaign.id, campaign.name, campaign.status
      FROM campaign
      WHERE campaign.status = 'ENABLED'
      ORDER BY campaign.name
    `;
    const campaignResults = await customer.query(campaignsQuery);

    const campaigns = campaignResults.map((row: any) => ({
      id: row.campaign.id?.toString(),
      name: row.campaign.name,
    }));

    return NextResponse.json({
      lists,
      campaigns,
      success: true,
    });

  } catch (error: any) {
    console.error('[Negative Keywords API] GET Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to fetch negative keyword lists',
      lists: [],
      campaigns: [],
    }, { status: 500 });
  }
}
