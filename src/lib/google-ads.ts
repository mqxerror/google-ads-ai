import { GoogleAdsApi, Customer } from 'google-ads-api';
import { calculateAIScoreWithBreakdown } from './ai-score';
import { CampaignType } from '@/types/campaign';

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
      const status = row.customer_client?.status || 'UNKNOWN';
      const isActive = status === 'ENABLED';
      return {
        customerId: id,
        // Use name if available, otherwise show formatted account ID
        // Mark inactive accounts
        descriptiveName: name
          ? (isActive ? name : `${name} (Inactive)`)
          : `Account ${id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}${isActive ? '' : ' (Inactive)'}`,
        currencyCode: row.customer_client?.currency_code || 'USD',
        timeZone: row.customer_client?.time_zone || 'America/New_York',
        manager: false,
        status,
        level: row.customer_client?.level || 0,
        isActive,
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

    const budgetResult = await customer.campaignBudgets.create([{
      name: `Budget for ${campaign.name}`,
      amount_micros: budgetAmountMicros,
      delivery_method: 2,
    }] as Parameters<typeof customer.campaignBudgets.create>[0]);

    const budgetResourceName = budgetResult.results[0]?.resource_name;
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

    const result = await customer.campaigns.create([{
      name: campaign.name,
      advertising_channel_type: typeMapping[campaign.type] || 2,
      status: campaign.status === 'ENABLED' ? 2 : 3,
      campaign_budget: budgetResourceName,
      bidding_strategy_type: biddingMapping[campaign.biddingStrategy] || 10,
    }] as Parameters<typeof customer.campaigns.create>[0]);

    const campaignResourceName = result.results[0]?.resource_name;
    if (!campaignResourceName) {
      return { success: false, error: 'Failed to create campaign' };
    }

    const campaignId = campaignResourceName.split('/').pop();
    return { success: true, campaignId };
  } catch (error) {
    console.error('Error creating campaign:', error);
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
