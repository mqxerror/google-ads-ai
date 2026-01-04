import { GoogleAdsApi, Customer } from 'google-ads-api';
import { calculateAIScoreWithBreakdown } from './ai-score';
import { CampaignType } from '@/types/campaign';
import { getGoogleAdsCircuitBreaker } from './keyword-data/circuit-breaker';
import type { GoogleAdsKeywordMetrics } from './keyword-data/types';
import type { AccountKeyword, KeywordPerformanceData } from './database/types';

// Create Google Ads API client
export function createGoogleAdsClient() {
  return new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
}

// Get customer instance
export function getCustomer(
  client: GoogleAdsApi,
  customerId: string,
  refreshToken: string,
  loginCustomerId?: string
): Customer {
  return client.Customer({
    customer_id: customerId,
    refresh_token: refreshToken,
    login_customer_id: loginCustomerId,
  });
}

// List accessible accounts
export async function listAccessibleAccounts(refreshToken: string) {
  const client = createGoogleAdsClient();
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  try {
    const customers = await client.listAccessibleCustomers(refreshToken);

    const accountDetails = await Promise.all(
      customers.resource_names.map(async (resourceName) => {
        const customerId = resourceName.replace('customers/', '');
        try {
          // Use loginCustomerId (MCC) when querying client accounts
          const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);
          const result = await customer.query(`
            SELECT
              customer.id,
              customer.descriptive_name,
              customer.currency_code,
              customer.time_zone,
              customer.manager
            FROM customer
            LIMIT 1
          `);

          if (result.length > 0) {
            const row = result[0];
            return {
              customerId: row.customer?.id?.toString() || customerId,
              descriptiveName: row.customer?.descriptive_name || `Account ${customerId}`,
              currencyCode: row.customer?.currency_code || 'USD',
              timeZone: row.customer?.time_zone || 'America/New_York',
              manager: row.customer?.manager || false,
            };
          }
          return null;
        } catch (err) {
          console.log(`[Google Ads] Could not fetch details for ${customerId}:`, err);
          return null;
        }
      })
    );

    return accountDetails.filter((a): a is NonNullable<typeof a> => a !== null);
  } catch (error) {
    console.error('Error listing accounts:', error);
    throw error;
  }
}

// List client accounts under an MCC (Manager account)
export async function listMCCClientAccounts(refreshToken: string, mccId?: string) {
  const client = createGoogleAdsClient();
  const loginCustomerId = mccId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  if (!loginCustomerId) {
    console.log('[Google Ads] No MCC ID configured');
    return [];
  }

  try {
    // Query the MCC to get all client accounts
    const customer = getCustomer(client, loginCustomerId, refreshToken, loginCustomerId);

    // Get ALL client accounts under MCC (not just level 1, include inactive for visibility)
    const result = await customer.query(`
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.manager,
        customer_client.status,
        customer_client.level
      FROM customer_client
      WHERE customer_client.manager = FALSE
    `);

    console.log(`[Google Ads] Raw MCC query returned ${result.length} accounts`);

    console.log(`[Google Ads] Found ${result.length} client accounts under MCC ${loginCustomerId}`);

    const accounts = result.map((row) => {
      const id = row.customer_client?.id?.toString() || '';
      const name = row.customer_client?.descriptive_name;
      const rawStatus = row.customer_client?.status;
      // Status can be string 'ENABLED' or number 2 (enum value)
      const isActive = rawStatus === 'ENABLED' || rawStatus === 2;
      const status = isActive ? 'ENABLED' : (rawStatus === 'SUSPENDED' || rawStatus === 4 ? 'SUSPENDED' : 'UNKNOWN');
      return {
        customerId: id,
        // Use name if available, otherwise show formatted account ID
        // Only mark as inactive if explicitly suspended (not just unknown)
        descriptiveName: name
          ? (rawStatus === 'SUSPENDED' || rawStatus === 4 ? `${name} (Suspended)` : name)
          : `Account ${id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}`,
        currencyCode: row.customer_client?.currency_code || 'USD',
        timeZone: row.customer_client?.time_zone || 'America/New_York',
        manager: false,
        status,
        level: row.customer_client?.level || 0,
        isActive: true, // Assume active unless explicitly suspended
      };
    }).filter(acc => acc.customerId);

    // Sort: active accounts first, then by name
    return accounts.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.descriptiveName.localeCompare(b.descriptiveName);
    });
  } catch (error) {
    console.error('[Google Ads] Error listing MCC client accounts:', error);
    return [];
  }
}

// Fetch campaigns
export async function fetchCampaigns(
  refreshToken: string,
  customerId: string,
  loginCustomerId?: string,
  startDate?: string,
  endDate?: string
) {
  const client = createGoogleAdsClient();
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  let dateClause = '';
  if (startDate && endDate) {
    dateClause = `AND segments.date BETWEEN '${startDate}' AND '${endDate}'`;
  } else {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const defaultStart = thirtyDaysAgo.toISOString().split('T')[0];
    const defaultEnd = today.toISOString().split('T')[0];
    dateClause = `AND segments.date BETWEEN '${defaultStart}' AND '${defaultEnd}'`;
  }

  try {
    const campaigns = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE campaign.status != 'REMOVED'
        ${dateClause}
      ORDER BY metrics.cost_micros DESC
    `);

    return campaigns.map((row) => {
      const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
      const conversions = row.metrics?.conversions || 0;
      const clicks = row.metrics?.clicks || 0;
      const impressions = row.metrics?.impressions || 0;
      const ctr = row.metrics?.ctr ? row.metrics.ctr * 100 : (impressions > 0 ? (clicks / impressions) * 100 : 0);
      const cpa = conversions > 0 ? spend / conversions : 0;
      const roas = spend > 0 ? (row.metrics?.conversions_value || 0) / spend : 0;
      const campaignType = mapCampaignType(row.campaign?.advertising_channel_type) as CampaignType;

      const aiScoreBreakdown = calculateAIScoreWithBreakdown({
        spend,
        clicks,
        impressions,
        conversions,
        ctr,
        cpa,
        roas,
        type: campaignType,
      });

      return {
        id: row.campaign?.id?.toString() || '',
        name: row.campaign?.name || '',
        status: mapStatus(row.campaign?.status),
        type: campaignType,
        spend,
        clicks,
        impressions,
        conversions,
        ctr,
        cpa,
        roas,
        aiScore: aiScoreBreakdown.totalScore,
        aiScoreBreakdown,
        aiRecommendation: aiScoreBreakdown.topIssue,
      };
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    throw error;
  }
}

// Fetch ad groups
export async function fetchAdGroups(
  refreshToken: string,
  customerId: string,
  campaignId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
) {
  const client = createGoogleAdsClient();
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    const adGroups = await customer.query(`
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM ad_group
      WHERE ad_group.campaign = 'customers/${customerId}/campaigns/${campaignId}'
        AND ad_group.status != 'REMOVED'
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
    `);

    return adGroups.map((row) => {
      const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
      const conversions = row.metrics?.conversions || 0;
      const clicks = row.metrics?.clicks || 0;
      const impressions = row.metrics?.impressions || 0;

      return {
        id: row.ad_group?.id?.toString() || '',
        campaignId,
        name: row.ad_group?.name || '',
        status: mapStatus(row.ad_group?.status),
        impressions,
        clicks,
        conversions,
        spend,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpa: conversions > 0 ? spend / conversions : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching ad groups:', error);
    throw error;
  }
}

// Update campaign status
export async function updateCampaignStatus(
  refreshToken: string,
  customerId: string,
  campaignId: string,
  status: 'ENABLED' | 'PAUSED',
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient();
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    const statusValue = status === 'ENABLED' ? 2 : 3;

    await customer.campaigns.update([{
      resource_name: `customers/${customerId}/campaigns/${campaignId}`,
      status: statusValue,
    }] as Parameters<typeof customer.campaigns.update>[0]);

    return { success: true };
  } catch (error) {
    console.error('Error updating campaign status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status',
    };
  }
}

// Create campaign
export interface CreateCampaignInput {
  name: string;
  type: string;
  status: 'ENABLED' | 'PAUSED';
  dailyBudget: number;
  biddingStrategy: string;
  targetCpa?: number;
  // Network settings
  includeSearchPartners?: boolean;
  includeDisplayNetwork?: boolean;
}

export async function createCampaign(
  refreshToken: string,
  customerId: string,
  campaign: CreateCampaignInput,
  loginCustomerId?: string
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  const client = createGoogleAdsClient();
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    const budgetAmountMicros = campaign.dailyBudget * 1_000_000;

    // Make budget name unique to avoid "already exists" errors
    const timestamp = Date.now();
    const budgetPayload = {
      name: `Budget for ${campaign.name} ${timestamp}`,
      amount_micros: budgetAmountMicros,
      delivery_method: 2, // STANDARD delivery
      explicitly_shared: false, // NON-SHARED budget (dedicated to this campaign only)
    };

    console.log('🔷 Creating budget:', JSON.stringify(budgetPayload, null, 2));
    const budgetResult = await customer.campaignBudgets.create([budgetPayload] as Parameters<typeof customer.campaignBudgets.create>[0]);

    const budgetResourceName = budgetResult.results[0]?.resource_name;
    console.log('🔷 Budget created:', budgetResourceName);

    if (!budgetResourceName) {
      return { success: false, error: 'Failed to create budget' };
    }

    const typeMapping: Record<string, number> = {
      'SEARCH': 2,
      'DISPLAY': 3,
      'SHOPPING': 4,
      'VIDEO': 6,
      'PERFORMANCE_MAX': 9,
    };

    const biddingMapping: Record<string, number> = {
      'MAXIMIZE_CONVERSIONS': 10,
      'MAXIMIZE_CLICKS': 9,
      'TARGET_CPA': 6,
      'MANUAL_CPC': 1,
    };

    // Build campaign payload with campaign-level bidding strategy
    // Add timestamp to campaign name to ensure uniqueness
    const uniqueCampaignName = `${campaign.name} ${timestamp}`;

    const campaignPayload: any = {
      name: uniqueCampaignName,
      advertising_channel_type: typeMapping[campaign.type] || 2,
      status: campaign.status === 'ENABLED' ? 2 : 3,
      campaign_budget: budgetResourceName,
      contains_eu_political_advertising: 3, // DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING (required enum)
      // Network settings for Search campaigns
      network_settings: {
        target_google_search: true, // Always target Google Search
        target_search_network: campaign.includeSearchPartners ?? false,
        target_content_network: campaign.includeDisplayNetwork ?? false,
        target_partner_search_network: false,
      },
    };

    // Add campaign-level bidding strategy (not portfolio bidding_strategy_type)
    if (campaign.biddingStrategy === 'MANUAL_CPC') {
      campaignPayload.manual_cpc = {
        enhanced_cpc_enabled: false, // Basic MANUAL_CPC (enhanced may not be allowed on test accounts)
      };
    } else if (campaign.biddingStrategy === 'MAXIMIZE_CLICKS') {
      campaignPayload.maximize_clicks = {};
    } else if (campaign.biddingStrategy === 'MAXIMIZE_CONVERSIONS') {
      campaignPayload.maximize_conversions = {};
    } else if (campaign.biddingStrategy === 'TARGET_CPA') {
      campaignPayload.target_cpa = {
        target_cpa_micros: 10_000_000, // Default $10 CPA
      };
    } else {
      // Default to basic MANUAL_CPC
      campaignPayload.manual_cpc = {
        enhanced_cpc_enabled: false,
      };
    }

    console.log('=== GOOGLE ADS API REQUEST DEBUG ===');
    console.log('Customer ID:', customerId);
    console.log('Budget Resource:', budgetResourceName);
    console.log('Campaign Type:', campaign.type, '→', typeMapping[campaign.type]);
    console.log('Bidding Strategy:', campaign.biddingStrategy);
    console.log('Campaign Payload:', JSON.stringify(campaignPayload, null, 2));
    console.log('=== END DEBUG ===');

    const result = await customer.campaigns.create([campaignPayload] as Parameters<typeof customer.campaigns.create>[0]);

    const campaignResourceName = result.results[0]?.resource_name;
    if (!campaignResourceName) {
      return { success: false, error: 'Failed to create campaign' };
    }

    const campaignId = campaignResourceName.split('/').pop();
    console.log('✅ Campaign created successfully! ID:', campaignId);
    return { success: true, campaignId };
  } catch (error) {
    console.error('❌ GOOGLE ADS API ERROR ===');
    console.error('Error Type:', error?.constructor?.name);
    console.error('Error Message:', error instanceof Error ? error.message : 'Unknown');
    console.error('Full Error Object:', JSON.stringify(error, null, 2));

    // If it's a Google Ads API error, log the details
    if (error && typeof error === 'object' && 'errors' in error) {
      console.error('Google Ads API Errors:', (error as any).errors);
    }
    console.error('=== END ERROR ===');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create campaign',
    };
  }
}

// Helper functions
function mapStatus(status: unknown): 'ENABLED' | 'PAUSED' | 'REMOVED' {
  if (status === 2 || status === 'ENABLED') return 'ENABLED';
  if (status === 3 || status === 'PAUSED') return 'PAUSED';
  if (status === 4 || status === 'REMOVED') return 'REMOVED';
  return 'PAUSED';
}

function mapCampaignType(type: unknown): string {
  if (type === 2 || type === 'SEARCH') return 'SEARCH';
  if (type === 3 || type === 'DISPLAY') return 'DISPLAY';
  if (type === 4 || type === 'SHOPPING') return 'SHOPPING';
  if (type === 6 || type === 'VIDEO') return 'VIDEO';
  if (type === 9 || type === 'PERFORMANCE_MAX') return 'PERFORMANCE_MAX';
  if (type === 12 || type === 'DEMAND_GEN') return 'DEMAND_GEN';
  return 'SEARCH';
}

// Fetch keyword metrics from Google Ads Keyword Planner
export async function fetchKeywordPlannerMetrics(
  refreshToken: string,
  customerId: string,
  keywords: string[],
  loginCustomerId?: string,
  locale: string = 'en-US',
  locationId: string = '2840' // US by default
): Promise<GoogleAdsKeywordMetrics[]> {
  if (keywords.length === 0) {
    return [];
  }

  // Batch keywords (max 20 per Google Ads Keyword Plan Ideas API)
  const batchSize = 20;
  const batches: string[][] = [];
  for (let i = 0; i < keywords.length; i += batchSize) {
    batches.push(keywords.slice(i, i + batchSize));
  }

  const breaker = getGoogleAdsCircuitBreaker();
  const allResults: GoogleAdsKeywordMetrics[] = [];

  for (const batch of batches) {
    try {
      const batchResults = await breaker.execute(async () => {
        const client = createGoogleAdsClient();
        const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

        // Use KeywordPlanIdeaService.generateKeywordIdeas method
        const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
          customer_id: customerId,
          language: 'languageConstants/1000', // English
          geo_target_constants: [`geoTargetConstants/${locationId}`],
          keyword_seed: {
            keywords: batch,
          },
          // IMPORTANT: Request maximum results (default is ~100-200, max is 10000)
          page_size: 10000,
        } as any);

        // Response is an array directly, not { results: [...] }
        const results = Array.isArray(response) ? response : (response.results || []);

        console.log(`[Google Ads] API Response type:`, typeof response, Array.isArray(response) ? 'array' : 'object');
        console.log(`[Google Ads] Results count: ${results.length}`);

        return results.map((result: any) => {
          const metrics = result.keyword_idea_metrics;

          // Parse monthly search volumes array
          const monthlySearchVolumes: { year: number; month: number; volume: number }[] = [];
          let avgMonthlySearches = 0;

          if (metrics?.monthly_search_volumes?.length > 0) {
            // Extract each month's data
            for (const m of metrics.monthly_search_volumes) {
              monthlySearchVolumes.push({
                year: parseInt(m.year || '0'),
                month: parseInt(m.month || '0'),
                volume: parseInt(m.monthly_searches || '0'),
              });
            }

            // Sort by date (oldest first for sparkline)
            monthlySearchVolumes.sort((a, b) => {
              if (a.year !== b.year) return a.year - b.year;
              return a.month - b.month;
            });

            // Calculate average from non-zero volumes
            const volumes = monthlySearchVolumes.map(m => m.volume).filter(v => v > 0);
            if (volumes.length > 0) {
              avgMonthlySearches = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);
            }
          } else {
            avgMonthlySearches = metrics?.avg_monthly_searches || 0;
          }

          // Calculate 3-month change (if we have enough data)
          let threeMonthChange: number | null = null;
          if (monthlySearchVolumes.length >= 4) {
            const recent = monthlySearchVolumes[monthlySearchVolumes.length - 1]?.volume || 0;
            const threeMonthsAgo = monthlySearchVolumes[monthlySearchVolumes.length - 4]?.volume || 0;
            if (threeMonthsAgo > 0) {
              threeMonthChange = Math.round(((recent - threeMonthsAgo) / threeMonthsAgo) * 100);
            }
          }

          // Calculate YoY change (if we have 12+ months)
          let yearOverYearChange: number | null = null;
          if (monthlySearchVolumes.length >= 12) {
            const recent = monthlySearchVolumes[monthlySearchVolumes.length - 1]?.volume || 0;
            const yearAgo = monthlySearchVolumes[0]?.volume || 0;
            if (yearAgo > 0) {
              yearOverYearChange = Math.round(((recent - yearAgo) / yearAgo) * 100);
            }
          }

          // Convert bid values to numbers (API returns strings!)
          const lowBidStr = metrics?.low_top_of_page_bid_micros || '0';
          const highBidStr = metrics?.high_top_of_page_bid_micros || '0';
          const lowBid = Number(lowBidStr);
          const highBid = Number(highBidStr);
          const avgCpc = lowBid > 0 && highBid > 0 ? Math.round((lowBid + highBid) / 2) : 0;

          console.log(`[Google Ads] ✓ Keyword: ${result.text}, Volume: ${avgMonthlySearches}, 3M: ${threeMonthChange}%, YoY: ${yearOverYearChange}%`);

          return {
            keyword: result.text || '',
            monthlySearchVolume: avgMonthlySearches,
            avgCpcMicros: avgCpc,
            lowBidMicros: lowBid,
            highBidMicros: highBid,
            competition: mapCompetitionLevel(metrics?.competition),
            competitionIndex: metrics?.competition_index || 0,
            monthlySearchVolumes,
            threeMonthChange,
            yearOverYearChange,
          };
        });
      });

      allResults.push(...batchResults);
    } catch (error) {
      console.error(`[Google Ads] Error fetching keyword metrics for batch:`, error);

      // Return null metrics for failed keywords (graceful degradation)
      batch.forEach(keyword => {
        allResults.push({
          keyword,
          monthlySearchVolume: 0,
          avgCpcMicros: 0,
          lowBidMicros: 0,
          highBidMicros: 0,
          competition: 'LOW',
          competitionIndex: 0,
          monthlySearchVolumes: [],
          threeMonthChange: null,
          yearOverYearChange: null,
        });
      });
    }
  }

  return allResults;
}

// Helper to map competition level
function mapCompetitionLevel(competition: unknown): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (competition === 'HIGH' || competition === 3) return 'HIGH';
  if (competition === 'MEDIUM' || competition === 2) return 'MEDIUM';
  return 'LOW';
}

/**
 * Generate keyword ideas from seed keywords using Google Ads Keyword Planner
 * This returns NEW keyword suggestions with volume data (like Google Keyword Planner tool)
 */
export async function generateKeywordIdeasFromSeeds(
  refreshToken: string,
  customerId: string,
  seedKeywords: string[],
  loginCustomerId?: string,
  locationId: string = '2840', // US by default
  maxResults: number = 500
): Promise<GoogleAdsKeywordMetrics[]> {
  if (seedKeywords.length === 0) {
    return [];
  }

  const breaker = getGoogleAdsCircuitBreaker();

  try {
    const results = await breaker.execute(async () => {
      const client = createGoogleAdsClient();
      const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

      console.log(`[Google Ads] Generating keyword ideas from ${seedKeywords.length} seeds...`);

      // Use KeywordPlanIdeaService.generateKeywordIdeas method
      const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
        customer_id: customerId,
        language: 'languageConstants/1000', // English
        geo_target_constants: [`geoTargetConstants/${locationId}`],
        keyword_seed: {
          keywords: seedKeywords,
        },
        // Request more results - Google returns up to 10,000
        page_size: Math.min(maxResults, 3000),
      } as any);

      // Response is an array directly
      const ideaResults = Array.isArray(response) ? response : (response.results || []);

      console.log(`[Google Ads] Generated ${ideaResults.length} keyword ideas`);

      return ideaResults.map((result: any) => {
        const metrics = result.keyword_idea_metrics;

        // Parse monthly search volumes array
        const monthlySearchVolumes: { year: number; month: number; volume: number }[] = [];
        let avgMonthlySearches = 0;

        if (metrics?.monthly_search_volumes?.length > 0) {
          for (const m of metrics.monthly_search_volumes) {
            monthlySearchVolumes.push({
              year: parseInt(m.year || '0'),
              month: parseInt(m.month || '0'),
              volume: parseInt(m.monthly_searches || '0'),
            });
          }

          monthlySearchVolumes.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          });

          const volumes = monthlySearchVolumes.map(m => m.volume).filter(v => v > 0);
          if (volumes.length > 0) {
            avgMonthlySearches = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);
          }
        } else {
          avgMonthlySearches = metrics?.avg_monthly_searches || 0;
        }

        // Calculate 3-month change
        let threeMonthChange: number | null = null;
        if (monthlySearchVolumes.length >= 4) {
          const recent = monthlySearchVolumes[monthlySearchVolumes.length - 1]?.volume || 0;
          const threeMonthsAgo = monthlySearchVolumes[monthlySearchVolumes.length - 4]?.volume || 0;
          if (threeMonthsAgo > 0) {
            threeMonthChange = Math.round(((recent - threeMonthsAgo) / threeMonthsAgo) * 100);
          }
        }

        // Calculate YoY change
        let yearOverYearChange: number | null = null;
        if (monthlySearchVolumes.length >= 12) {
          const recent = monthlySearchVolumes[monthlySearchVolumes.length - 1]?.volume || 0;
          const yearAgo = monthlySearchVolumes[0]?.volume || 0;
          if (yearAgo > 0) {
            yearOverYearChange = Math.round(((recent - yearAgo) / yearAgo) * 100);
          }
        }

        // Convert bid values to numbers
        const lowBidStr = metrics?.low_top_of_page_bid_micros || '0';
        const highBidStr = metrics?.high_top_of_page_bid_micros || '0';
        const lowBid = Number(lowBidStr);
        const highBid = Number(highBidStr);
        const avgCpc = lowBid > 0 && highBid > 0 ? Math.round((lowBid + highBid) / 2) : 0;

        return {
          keyword: result.text || '',
          monthlySearchVolume: avgMonthlySearches,
          avgCpcMicros: avgCpc,
          lowBidMicros: lowBid,
          highBidMicros: highBid,
          competition: mapCompetitionLevel(metrics?.competition),
          competitionIndex: metrics?.competition_index || 0,
          monthlySearchVolumes,
          threeMonthChange,
          yearOverYearChange,
        };
      });
    });

    // Sort by volume descending (highest first)
    results.sort((a, b) => b.monthlySearchVolume - a.monthlySearchVolume);

    console.log(`[Google Ads] Returning ${results.length} keyword ideas (sorted by volume)`);
    return results;

  } catch (error) {
    console.error(`[Google Ads] Error generating keyword ideas:`, error);
    return [];
  }
}

// =====================================================
// Keyword Center - Account Integration Functions
// =====================================================

/**
 * Fetch all keywords from user's Google Ads campaigns
 * Used for syncing account keywords to keyword_account_data table
 */
export async function fetchAllCampaignKeywords(
  refreshToken: string,
  customerId: string,
  options?: {
    campaignIds?: string[];
    includeRemoved?: boolean;
    loginCustomerId?: string;
  }
): Promise<AccountKeyword[]> {
  const client = createGoogleAdsClient();
  const customer = getCustomer(
    client,
    customerId,
    refreshToken,
    options?.loginCustomerId
  );

  const campaignFilter = options?.campaignIds?.length
    ? `AND campaign.id IN (${options.campaignIds.join(', ')})`
    : '';

  const statusFilter = options?.includeRemoved
    ? ''
    : `AND ad_group_criterion.status != 'REMOVED'`;

  const query = `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.status
    FROM keyword_view
    WHERE ad_group_criterion.type = KEYWORD
      ${campaignFilter}
      ${statusFilter}
  `;

  console.log('[Google Ads] Fetching campaign keywords...');

  try {
    const results = await customer.query(query);

    console.log(`[Google Ads] Found ${results.length} keywords`);

    return results.map((row: any) => ({
      keyword: row.ad_group_criterion?.keyword?.text || '',
      matchType: row.ad_group_criterion?.keyword?.match_type || 'BROAD',
      campaignId: row.campaign?.id?.toString() || '',
      campaignName: row.campaign?.name || '',
      adGroupId: row.ad_group?.id?.toString() || '',
      adGroupName: row.ad_group?.name || '',
      status: row.ad_group_criterion?.status || 'ENABLED',
    }));
  } catch (error) {
    console.error('[Google Ads] Error fetching campaign keywords:', error);
    throw error;
  }
}

/**
 * Fetch keyword performance data for specified keywords or all keywords
 * Used for populating keyword_performance_history table
 */
export async function fetchKeywordPerformance(
  refreshToken: string,
  customerId: string,
  options: {
    keywords?: string[];
    startDate: string; // YYYY-MM-DD
    endDate: string;
    campaignIds?: string[];
    loginCustomerId?: string;
  }
): Promise<KeywordPerformanceData[]> {
  const client = createGoogleAdsClient();
  const customer = getCustomer(
    client,
    customerId,
    refreshToken,
    options.loginCustomerId
  );

  const keywordFilter = options.keywords?.length
    ? `AND ad_group_criterion.keyword.text IN ('${options.keywords.join("', '")}')`
    : '';

  const campaignFilter = options.campaignIds?.length
    ? `AND campaign.id IN (${options.campaignIds.join(', ')})`
    : '';

  const query = `
    SELECT
      ad_group_criterion.keyword.text,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.quality_score
    FROM keyword_view
    WHERE segments.date BETWEEN '${options.startDate}' AND '${options.endDate}'
      ${keywordFilter}
      ${campaignFilter}
      AND ad_group_criterion.type = KEYWORD
    ORDER BY segments.date DESC
  `;

  console.log('[Google Ads] Fetching keyword performance data...');

  try {
    const results = await customer.query(query);

    console.log(`[Google Ads] Found ${results.length} performance records`);

    return results.map((row: any) => {
      const impressions = row.metrics?.impressions || 0;
      const clicks = row.metrics?.clicks || 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;

      return {
        keyword: row.ad_group_criterion?.keyword?.text || '',
        date: row.segments?.date || '',
        impressions,
        clicks,
        cost: (row.metrics?.cost_micros || 0) / 1_000_000,
        conversions: row.metrics?.conversions || 0,
        ctr,
        qualityScore: row.metrics?.quality_score || null,
      };
    });
  } catch (error) {
    console.error('[Google Ads] Error fetching keyword performance:', error);
    throw error;
  }
}

/**
 * Match generated keywords against account keywords
 * Used by Keyword Center to show which keywords already exist in campaigns
 */
export async function matchKeywordsAgainstAccount(
  userId: string,
  customerId: string,
  keywords: string[]
): Promise<Map<string, AccountKeyword[]>> {
  // Import database function dynamically to avoid circular dependencies
  const { getAccountKeywordsBatch } = await import('./database/account-data');

  const matchMap = await getAccountKeywordsBatch(userId, customerId, keywords);

  return matchMap as unknown as Map<string, AccountKeyword[]>;
}
