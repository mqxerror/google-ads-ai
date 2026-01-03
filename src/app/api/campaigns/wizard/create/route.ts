import { NextRequest, NextResponse } from 'next/server';
import { createGoogleAdsClient, getCustomer } from '@/lib/google-ads';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface CreateCampaignRequest {
  campaignName: string;
  campaignType: 'SEARCH' | 'PERFORMANCE_MAX' | 'SHOPPING';
  targetLocation: string;
  language: string;
  goal: 'LEADS' | 'SALES' | 'TRAFFIC';
  adGroups: Array<{
    id: string;
    name: string;
    keywords: Array<{ keyword: string; metrics?: any }>;
  }>;
  ads: Array<{
    adGroupId: string;
    headlines: string[];
    descriptions: string[];
  }>;
  dailyBudget: number;
  biddingStrategy: 'MAXIMIZE_CONVERSIONS' | 'MANUAL_CPC' | 'TARGET_CPA';
  targetCpa?: number;
  negativeKeywords: string[];
}

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

    const body: CreateCampaignRequest = await request.json();

    const {
      campaignName,
      campaignType,
      targetLocation,
      language,
      goal,
      adGroups,
      ads,
      dailyBudget,
      biddingStrategy,
      targetCpa,
      negativeKeywords,
    } = body;

    if (!campaignName || !adGroups || adGroups.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = createGoogleAdsClient();
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const customer = getCustomer(client, customerId, session.accessToken, loginCustomerId);

    console.log(`[Create Campaign API] Creating campaign: ${campaignName}`);

    // Step 1: Create budget
    console.log(`[Create Campaign API] Creating budget: $${dailyBudget}/day`);
    const budgetAmountMicros = Math.round(dailyBudget * 1_000_000);

    const budgetResult = await customer.campaignBudgets.create([
      {
        name: `Budget for ${campaignName}`,
        amount_micros: budgetAmountMicros,
        delivery_method: 2, // STANDARD
      },
    ] as any);

    const budgetResourceName = budgetResult.results[0]?.resource_name;
    if (!budgetResourceName) {
      throw new Error('Failed to create campaign budget');
    }

    // Step 2: Create campaign
    console.log(`[Create Campaign API] Creating campaign...`);

    const typeMapping: Record<string, number> = {
      SEARCH: 2,
      DISPLAY: 3,
      SHOPPING: 4,
      VIDEO: 6,
      PERFORMANCE_MAX: 9,
    };

    const campaignCreatePayload: any = {
      name: campaignName,
      advertising_channel_type: typeMapping[campaignType] || 2,
      status: 2, // ENABLED
      campaign_budget: budgetResourceName,
      network_settings: {
        target_google_search: true,
        target_search_network: true,
        target_content_network: false,
        target_partner_search_network: false,
      },
    };

    // Configure bidding strategy
    if (biddingStrategy === 'MAXIMIZE_CONVERSIONS') {
      campaignCreatePayload.bidding_strategy_type = 10; // MAXIMIZE_CONVERSIONS
      campaignCreatePayload.maximize_conversions = {};
    } else if (biddingStrategy === 'TARGET_CPA' && targetCpa) {
      campaignCreatePayload.bidding_strategy_type = 6; // TARGET_CPA
      campaignCreatePayload.target_cpa = {
        target_cpa_micros: Math.round(targetCpa * 1_000_000),
      };
    } else if (biddingStrategy === 'MANUAL_CPC') {
      campaignCreatePayload.bidding_strategy_type = 1; // MANUAL_CPC
      campaignCreatePayload.manual_cpc = {
        enhanced_cpc_enabled: true,
      };
    }

    // Add geo targeting
    campaignCreatePayload.geo_target_type_setting = {
      positive_geo_target_type: 5, // PRESENCE_OR_INTEREST
    };

    const campaignResult = await customer.campaigns.create([campaignCreatePayload] as any);

    const campaignResourceName = campaignResult.results[0]?.resource_name;
    if (!campaignResourceName) {
      throw new Error('Failed to create campaign');
    }

    const createdCampaignId = campaignResourceName.split('/').pop();
    console.log(`[Create Campaign API] Campaign created: ${createdCampaignId}`);

    // Step 3: Add geo targeting (location)
    console.log(`[Create Campaign API] Adding location targeting: ${targetLocation}`);
    try {
      await customer.campaignCriteria.create([
        {
          campaign: campaignResourceName,
          location: {
            geo_target_constant: `geoTargetConstants/${targetLocation}`,
          },
        },
      ] as any);
    } catch (error) {
      console.error('[Create Campaign API] Error adding location targeting:', error);
      // Non-fatal, continue
    }

    // Step 4: Add language targeting
    console.log(`[Create Campaign API] Adding language targeting: ${language}`);
    const languageMapping: Record<string, string> = {
      en: '1000', // English
      es: '1003', // Spanish
      fr: '1002', // French
      de: '1001', // German
      pt: '1014', // Portuguese
    };

    try {
      await customer.campaignCriteria.create([
        {
          campaign: campaignResourceName,
          language: {
            language_constant: `languageConstants/${languageMapping[language] || '1000'}`,
          },
        },
      ] as any);
    } catch (error) {
      console.error('[Create Campaign API] Error adding language targeting:', error);
      // Non-fatal, continue
    }

    // Step 5: Create ad groups with keywords and ads
    console.log(`[Create Campaign API] Creating ${adGroups.length} ad groups...`);

    for (const adGroup of adGroups) {
      console.log(`[Create Campaign API] Creating ad group: ${adGroup.name}`);

      // Create ad group
      const adGroupResult = await customer.adGroups.create([
        {
          name: adGroup.name,
          campaign: campaignResourceName,
          status: 2, // ENABLED
          type: 2, // SEARCH_STANDARD
          cpc_bid_micros: 1_000_000, // Default $1 CPC (will be overridden by campaign bidding strategy)
        },
      ] as any);

      const adGroupResourceName = adGroupResult.results[0]?.resource_name;
      if (!adGroupResourceName) {
        console.error(`[Create Campaign API] Failed to create ad group: ${adGroup.name}`);
        continue;
      }

      const adGroupId = adGroupResourceName.split('/').pop();
      console.log(`[Create Campaign API] Ad group created: ${adGroupId}`);

      // Add keywords to ad group
      console.log(`[Create Campaign API] Adding ${adGroup.keywords.length} keywords to ${adGroup.name}`);

      const keywordOperations = adGroup.keywords.map((kw) => ({
        ad_group: adGroupResourceName,
        status: 2, // ENABLED
        keyword: {
          text: kw.keyword,
          match_type: 4, // BROAD (can be changed to 3=PHRASE or 2=EXACT)
        },
      }));

      try {
        await customer.adGroupCriteria.create(keywordOperations as any);
        console.log(`[Create Campaign API] Keywords added to ${adGroup.name}`);
      } catch (error) {
        console.error(`[Create Campaign API] Error adding keywords to ${adGroup.name}:`, error);
      }

      // Create responsive search ad
      const adCopy = ads.find((ad) => ad.adGroupId === adGroup.id);
      if (adCopy && adCopy.headlines.length >= 3 && adCopy.descriptions.length >= 2) {
        console.log(`[Create Campaign API] Creating responsive search ad for ${adGroup.name}`);

        try {
          // Build ad group ad operations
          const adGroupAdOperation = {
            ad_group: adGroupResourceName,
            status: 2, // ENABLED
            ad: {
              final_urls: ['https://example.com'], // TODO: Use actual landing page URL
              responsive_search_ad: {
                headlines: adCopy.headlines.slice(0, 15).map((text) => ({ text })),
                descriptions: adCopy.descriptions.slice(0, 4).map((text) => ({ text })),
              },
            },
          };

          await customer.adGroupAds.create([adGroupAdOperation] as any);
          console.log(`[Create Campaign API] Responsive search ad created for ${adGroup.name}`);
        } catch (error) {
          console.error(`[Create Campaign API] Error creating ad for ${adGroup.name}:`, error);
        }
      } else {
        console.log(`[Create Campaign API] Skipping ad creation for ${adGroup.name} - missing ad copy`);
      }
    }

    // Step 6: Add negative keywords to campaign
    if (negativeKeywords && negativeKeywords.length > 0) {
      console.log(`[Create Campaign API] Adding ${negativeKeywords.length} negative keywords...`);

      try {
        // Google Ads API requires negative keywords to be added as campaign-level negative keywords
        // Using the proper structure for campaign negative keywords
        const negativeKeywordOperations = negativeKeywords.map((keyword) => ({
          campaign: campaignResourceName,
          negative: true,
          keyword: {
            text: keyword,
            match_type: 4, // BROAD
          },
          type: 'KEYWORD',
        }));

        const negativeResult = await customer.campaignCriteria.create(negativeKeywordOperations as any);
        console.log(`[Create Campaign API] ✅ Successfully added ${negativeKeywords.length} negative keywords`);
        console.log(`[Create Campaign API] Negative keywords:`, negativeKeywords.join(', '));
      } catch (error) {
        console.error('[Create Campaign API] ❌ Error adding negative keywords:', error);
        if (error instanceof Error) {
          console.error('[Create Campaign API] Error details:', error.message);
        }
        // Non-fatal, continue - campaign is still created successfully
      }
    }

    console.log(`[Create Campaign API] Campaign creation complete: ${createdCampaignId}`);

    return NextResponse.json({
      success: true,
      campaignId: createdCampaignId,
      campaignName,
      message: 'Campaign created successfully',
    });
  } catch (error) {
    console.error('[Create Campaign API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create campaign',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
