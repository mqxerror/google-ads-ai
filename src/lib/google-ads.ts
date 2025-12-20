import { GoogleAdsApi, Customer } from 'google-ads-api';
import { calculateAIScoreWithBreakdown } from './ai-score';
import { CampaignType } from '@/types/campaign';
import { checkRateLimit, RATE_LIMIT_PRESETS } from './rate-limiter';

// Exponential backoff configuration
const BACKOFF_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

// Debug logging for GAQL queries (only in development)
const DEBUG_QUERIES = process.env.NODE_ENV === 'development' || process.env.DEBUG_GAQL === 'true';

function logQuery(operation: string, customerId: string, query: string, dateRange?: { startDate: string; endDate: string }) {
  if (DEBUG_QUERIES) {
    console.log(`\n[GAQL] ${operation} | Customer: ${customerId}`);
    if (dateRange) {
      console.log(`[GAQL] Date Range: ${dateRange.startDate} to ${dateRange.endDate}`);
    }
    console.log(`[GAQL] Query:\n${query.trim()}\n`);
  }
}

// Rate limit key generator for Google Ads API
function getGoogleAdsRateLimitKey(customerId: string): string {
  return `google-ads:${customerId}`;
}

/**
 * Execute a function with exponential backoff retry logic
 */
async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  customerId: string,
  operationName: string
): Promise<T> {
  let lastError: Error | undefined;
  let delay = BACKOFF_CONFIG.initialDelayMs;

  for (let attempt = 0; attempt <= BACKOFF_CONFIG.maxRetries; attempt++) {
    // Check rate limit before making the request
    const rateLimitKey = getGoogleAdsRateLimitKey(customerId);
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_PRESETS.googleAds);

    if (!rateLimitResult.allowed) {
      // Wait for rate limit to reset
      const waitTime = Math.min(rateLimitResult.resetIn, BACKOFF_CONFIG.maxDelayMs);
      console.log(`[Google Ads] Rate limited for ${customerId}, waiting ${waitTime}ms`);
      await sleep(waitTime);
      continue;
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a retryable error
      const isRetryable = isRetryableError(error);
      const isQuotaError = isQuotaExceededError(error);

      if (!isRetryable && !isQuotaError) {
        throw error;
      }

      if (attempt < BACKOFF_CONFIG.maxRetries) {
        // Apply longer delay for quota errors
        const actualDelay = isQuotaError ? delay * 2 : delay;
        console.log(
          `[Google Ads] ${operationName} failed (attempt ${attempt + 1}/${BACKOFF_CONFIG.maxRetries + 1}), ` +
          `retrying in ${actualDelay}ms: ${lastError.message}`
        );
        await sleep(actualDelay);
        delay = Math.min(delay * BACKOFF_CONFIG.backoffMultiplier, BACKOFF_CONFIG.maxDelayMs);
      }
    }
  }

  throw lastError || new Error(`${operationName} failed after ${BACKOFF_CONFIG.maxRetries + 1} attempts`);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'rate limit',
    'timeout',
    'temporarily unavailable',
    'internal error',
    'service unavailable',
    'connection',
    'econnreset',
    'socket hang up',
  ];

  return retryablePatterns.some(pattern => message.includes(pattern));
}

/**
 * Check if error is quota exceeded
 */
function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return message.includes('quota') || message.includes('resource_exhausted');
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create Google Ads API client
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createGoogleAdsClient(_refreshToken: string) {
  return new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
}

// Get customer instance for a specific account
export function getCustomer(client: GoogleAdsApi, customerId: string, refreshToken: string, loginCustomerId?: string): Customer {
  return client.Customer({
    customer_id: customerId,
    refresh_token: refreshToken,
    login_customer_id: loginCustomerId, // Required when accessing client accounts through MCC
  });
}

// List all accessible Google Ads accounts for the authenticated user
export async function listAccessibleAccounts(refreshToken: string): Promise<Array<{
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  manager: boolean;
}>> {
  const client = createGoogleAdsClient(refreshToken);

  try {
    const customers = await client.listAccessibleCustomers(refreshToken);

    const accountDetails = await Promise.all(
      customers.resource_names.map(async (resourceName) => {
        const customerId = resourceName.replace('customers/', '');
        try {
          const customer = getCustomer(client, customerId, refreshToken);
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
        } catch {
          // Account might not be accessible or have permission issues
          return null;
        }
      })
    );

    return accountDetails.filter((a): a is NonNullable<typeof a> => a !== null);
  } catch (error) {
    console.error('Error listing accessible accounts:', error);
    throw error;
  }
}

// List client accounts under a manager account (MCC)
export async function listClientAccounts(refreshToken: string, managerCustomerId: string): Promise<Array<{
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  manager: boolean;
}>> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, managerCustomerId, refreshToken);

  try {
    const result = await customer.query(`
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.manager,
        customer_client.status
      FROM customer_client
      WHERE customer_client.status = 'ENABLED'
    `);

    return result.map((row) => ({
      customerId: row.customer_client?.id?.toString() || '',
      descriptiveName: row.customer_client?.descriptive_name || `Account ${row.customer_client?.id}`,
      currencyCode: row.customer_client?.currency_code || 'USD',
      manager: row.customer_client?.manager || false,
    })).filter(a => a.customerId && !a.manager); // Filter out empty and sub-manager accounts
  } catch (error) {
    console.error('Error listing client accounts:', error);
    throw error;
  }
}

// Fetch campaigns for a customer (supports both direct accounts and MCC client accounts)
export async function fetchCampaigns(
  refreshToken: string,
  customerId: string,
  loginCustomerId?: string,
  startDate?: string, // YYYY-MM-DD
  endDate?: string    // YYYY-MM-DD
) {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  // Build date clause for the query
  // Google Ads API uses segments.date for date filtering
  let dateClause = '';
  if (startDate && endDate) {
    dateClause = `AND segments.date BETWEEN '${startDate}' AND '${endDate}'`;
  } else {
    // Default to last 30 days if no date range specified
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const defaultStart = thirtyDaysAgo.toISOString().split('T')[0];
    const defaultEnd = today.toISOString().split('T')[0];
    dateClause = `AND segments.date BETWEEN '${defaultStart}' AND '${defaultEnd}'`;
  }

  try {
    const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          campaign.bidding_strategy_type,
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
      `;

    logQuery('fetchCampaigns', customerId, query, startDate && endDate ? { startDate, endDate } : undefined);

    // Wrap API call with exponential backoff for resilience
    const campaigns = await withExponentialBackoff(
      () => customer.query(query),
      customerId,
      'fetchCampaigns'
    );

    return campaigns.map((row) => {
      const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
      const conversions = row.metrics?.conversions || 0;
      const clicks = row.metrics?.clicks || 0;
      const impressions = row.metrics?.impressions || 0;
      const ctr = row.metrics?.ctr ? row.metrics.ctr * 100 : (impressions > 0 ? (clicks / impressions) * 100 : 0);
      const cpa = conversions > 0 ? spend / conversions : 0;
      const roas = spend > 0 ? (row.metrics?.conversions_value || 0) / spend : 0;
      const campaignType = mapCampaignType(row.campaign?.advertising_channel_type) as CampaignType;

      // Calculate AI Score with breakdown
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

// Fetch ad groups for a campaign
export async function fetchAdGroups(
  refreshToken: string,
  customerId: string,
  campaignId: string,
  startDate: string,   // YYYY-MM-DD - REQUIRED for consistency
  endDate: string,     // YYYY-MM-DD - REQUIRED for consistency
  loginCustomerId?: string
) {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // CRITICAL: Use same date filtering as campaigns for data consistency
    const query = `
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
    `;

    logQuery('fetchAdGroups', customerId, query, { startDate, endDate });

    const adGroups = await customer.query(query);

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

// Fetch keywords for an ad group
export async function fetchKeywords(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  startDate: string,   // YYYY-MM-DD - REQUIRED for consistency
  endDate: string,     // YYYY-MM-DD - REQUIRED for consistency
  loginCustomerId?: string
) {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // Use keyword_view to get metrics - ad_group_criterion doesn't support metrics directly
    // CRITICAL: Use same date filtering as campaigns/ad groups for data consistency
    const query = `
      SELECT
        keyword_view.resource_name,
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group_criterion.quality_info.quality_score,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM keyword_view
      WHERE ad_group_criterion.ad_group = 'customers/${customerId}/adGroups/${adGroupId}'
        AND ad_group_criterion.status != 'REMOVED'
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
    `;

    logQuery('fetchKeywords', customerId, query, { startDate, endDate });

    const keywords = await customer.query(query);

    return keywords.map((row) => {
      const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
      const conversions = row.metrics?.conversions || 0;
      const clicks = row.metrics?.clicks || 0;
      const impressions = row.metrics?.impressions || 0;

      return {
        id: row.ad_group_criterion?.criterion_id?.toString() || '',
        adGroupId,
        text: row.ad_group_criterion?.keyword?.text || '',
        matchType: row.ad_group_criterion?.keyword?.match_type || 'BROAD',
        status: mapStatus(row.ad_group_criterion?.status),
        qualityScore: row.ad_group_criterion?.quality_info?.quality_score || 0,
        impressions,
        clicks,
        conversions,
        spend,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpa: conversions > 0 ? spend / conversions : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching keywords:', error);
    throw error;
  }
}

// Helper: Map Google Ads status to our status type
function mapStatus(status: unknown): 'ENABLED' | 'PAUSED' | 'REMOVED' {
  // Handle both numeric enum values and string representations
  if (status === 2 || status === 'ENABLED') return 'ENABLED';
  if (status === 3 || status === 'PAUSED') return 'PAUSED';
  if (status === 4 || status === 'REMOVED') return 'REMOVED';
  return 'PAUSED';
}

// Helper: Map Google Ads campaign type to our type
function mapCampaignType(type: unknown): string {
  // Handle both numeric enum values and string representations
  if (type === 2 || type === 'SEARCH') return 'SEARCH';
  if (type === 3 || type === 'DISPLAY') return 'DISPLAY';
  if (type === 4 || type === 'SHOPPING') return 'SHOPPING';
  if (type === 6 || type === 'VIDEO') return 'VIDEO';
  if (type === 9 || type === 'PERFORMANCE_MAX') return 'PERFORMANCE_MAX';
  if (type === 12 || type === 'DEMAND_GEN') return 'DEMAND_GEN';
  if (type === 7 || type === 'APP') return 'APP';
  return 'SEARCH';
}

// ============================================
// MUTATION OPERATIONS
// ============================================

// Update campaign status (pause/enable)
export async function updateCampaignStatus(
  refreshToken: string,
  customerId: string,
  campaignId: string,
  status: 'ENABLED' | 'PAUSED',
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // Google Ads API status values: ENABLED = 2, PAUSED = 3
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
      error: error instanceof Error ? error.message : 'Failed to update campaign status',
    };
  }
}

// Update ad group status (pause/enable)
export async function updateAdGroupStatus(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  status: 'ENABLED' | 'PAUSED',
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    const statusValue = status === 'ENABLED' ? 2 : 3;

    await customer.adGroups.update([{
      resource_name: `customers/${customerId}/adGroups/${adGroupId}`,
      status: statusValue,
    }] as Parameters<typeof customer.adGroups.update>[0]);

    return { success: true };
  } catch (error) {
    console.error('Error updating ad group status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update ad group status',
    };
  }
}

// Update keyword status (pause/enable)
export async function updateKeywordStatus(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  criterionId: string,
  status: 'ENABLED' | 'PAUSED',
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    const statusValue = status === 'ENABLED' ? 2 : 3;

    await customer.adGroupCriteria.update([{
      resource_name: `customers/${customerId}/adGroupCriteria/${adGroupId}~${criterionId}`,
      status: statusValue,
    }] as Parameters<typeof customer.adGroupCriteria.update>[0]);

    return { success: true };
  } catch (error) {
    console.error('Error updating keyword status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update keyword status',
    };
  }
}

// Update campaign budget
export async function updateCampaignBudget(
  refreshToken: string,
  customerId: string,
  campaignId: string,
  budgetAmountMicros: number,
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // First, get the campaign's budget resource
    const campaigns = await customer.query(`
      SELECT campaign.campaign_budget
      FROM campaign
      WHERE campaign.id = ${campaignId}
    `);

    if (campaigns.length === 0) {
      return { success: false, error: 'Campaign not found' };
    }

    const budgetResourceName = campaigns[0].campaign?.campaign_budget;
    if (!budgetResourceName) {
      return { success: false, error: 'Campaign budget not found' };
    }

    // Update the budget
    await customer.campaignBudgets.update([{
      resource_name: budgetResourceName,
      amount_micros: budgetAmountMicros,
    }] as Parameters<typeof customer.campaignBudgets.update>[0]);

    return { success: true };
  } catch (error) {
    console.error('Error updating campaign budget:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update campaign budget',
    };
  }
}

// Create a new campaign
export interface CreateCampaignInput {
  name: string;
  type: string;
  status: 'ENABLED' | 'PAUSED';
  dailyBudget: number;
  biddingStrategy: string;
  targetCpa?: number;
  targetRoas?: number;
  startDate?: string;
  endDate?: string;
}

export async function createCampaign(
  refreshToken: string,
  customerId: string,
  campaign: CreateCampaignInput,
  loginCustomerId?: string
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // First, create a campaign budget
    const budgetAmountMicros = campaign.dailyBudget * 1_000_000;

    const budgetResult = await customer.campaignBudgets.create([{
      name: `Budget for ${campaign.name}`,
      amount_micros: budgetAmountMicros,
      delivery_method: 2, // STANDARD
    }] as Parameters<typeof customer.campaignBudgets.create>[0]);

    const budgetResourceName = budgetResult.results[0]?.resource_name;
    if (!budgetResourceName) {
      return { success: false, error: 'Failed to create campaign budget' };
    }

    // Map campaign type to Google Ads enum
    const typeMapping: Record<string, number> = {
      'SEARCH': 2,
      'DISPLAY': 3,
      'SHOPPING': 4,
      'VIDEO': 6,
      'PERFORMANCE_MAX': 9,
      'DEMAND_GEN': 12,
      'APP': 7,
    };

    // Map bidding strategy type
    const biddingMapping: Record<string, number> = {
      'MAXIMIZE_CONVERSIONS': 10,
      'MAXIMIZE_CLICKS': 9,
      'TARGET_CPA': 6,
      'TARGET_ROAS': 11,
      'MANUAL_CPC': 1,
    };

    // Build campaign creation payload
    const campaignPayload: Record<string, unknown> = {
      name: campaign.name,
      advertising_channel_type: typeMapping[campaign.type] || 2,
      status: campaign.status === 'ENABLED' ? 2 : 3,
      campaign_budget: budgetResourceName,
      bidding_strategy_type: biddingMapping[campaign.biddingStrategy] || 10,
    };

    // Add start/end dates if provided
    if (campaign.startDate) {
      campaignPayload.start_date = campaign.startDate.replace(/-/g, '');
    }
    if (campaign.endDate) {
      campaignPayload.end_date = campaign.endDate.replace(/-/g, '');
    }

    // Add target CPA/ROAS if applicable
    if (campaign.biddingStrategy === 'TARGET_CPA' && campaign.targetCpa) {
      campaignPayload.target_cpa = {
        target_cpa_micros: campaign.targetCpa * 1_000_000,
      };
    }
    if (campaign.biddingStrategy === 'TARGET_ROAS' && campaign.targetRoas) {
      campaignPayload.target_roas = {
        target_roas: campaign.targetRoas,
      };
    }

    const result = await customer.campaigns.create([campaignPayload] as Parameters<typeof customer.campaigns.create>[0]);

    const campaignResourceName = result.results[0]?.resource_name;
    if (!campaignResourceName) {
      return { success: false, error: 'Failed to create campaign' };
    }

    // Extract campaign ID from resource name
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

// Update an existing campaign
export interface UpdateCampaignInput {
  name?: string;
  status?: 'ENABLED' | 'PAUSED';
}

export async function updateCampaign(
  refreshToken: string,
  customerId: string,
  campaignId: string,
  updates: UpdateCampaignInput,
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    const updatePayload: Record<string, unknown> = {
      resource_name: `customers/${customerId}/campaigns/${campaignId}`,
    };

    if (updates.name !== undefined) {
      updatePayload.name = updates.name;
    }

    if (updates.status !== undefined) {
      updatePayload.status = updates.status === 'ENABLED' ? 2 : 3;
    }

    await customer.campaigns.update([updatePayload] as Parameters<typeof customer.campaigns.update>[0]);

    return { success: true };
  } catch (error) {
    console.error('Error updating campaign:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update campaign',
    };
  }
}

// ============================================
// AD MANAGEMENT
// ============================================

export interface ResponsiveSearchAdInput {
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
  path1?: string;
  path2?: string;
  status: 'ENABLED' | 'PAUSED';
}

// Fetch ads for an ad group
export async function fetchAds(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  startDate: string,   // YYYY-MM-DD - REQUIRED for consistency
  endDate: string,     // YYYY-MM-DD - REQUIRED for consistency
  loginCustomerId?: string
) {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // CRITICAL: Use same date filtering as campaigns/ad groups/keywords for data consistency
    const query = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.status,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.responsive_search_ad.path1,
        ad_group_ad.ad.responsive_search_ad.path2,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.cost_micros,
        metrics.conversions
      FROM ad_group_ad
      WHERE ad_group_ad.ad_group = 'customers/${customerId}/adGroups/${adGroupId}'
        AND ad_group_ad.status != 'REMOVED'
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
    `;

    logQuery('fetchAds', customerId, query, { startDate, endDate });

    const ads = await customer.query(query);

    return ads.map((row) => {
      const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
      const conversions = row.metrics?.conversions || 0;
      const clicks = row.metrics?.clicks || 0;
      const impressions = row.metrics?.impressions || 0;
      const rsa = row.ad_group_ad?.ad?.responsive_search_ad;

      return {
        id: row.ad_group_ad?.ad?.id?.toString() || '',
        adGroupId,
        status: mapStatus(row.ad_group_ad?.status),
        type: 'RESPONSIVE_SEARCH_AD',
        headlines: rsa?.headlines?.map((h: { text?: string | null }) => h.text || '') || [],
        descriptions: rsa?.descriptions?.map((d: { text?: string | null }) => d.text || '') || [],
        finalUrls: row.ad_group_ad?.ad?.final_urls || [],
        path1: rsa?.path1 || '',
        path2: rsa?.path2 || '',
        clicks,
        impressions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        spend,
        conversions,
        cpa: conversions > 0 ? spend / conversions : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching ads:', error);
    throw error;
  }
}

// Create a new responsive search ad
export async function createAd(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  ad: ResponsiveSearchAdInput,
  loginCustomerId?: string
): Promise<{ success: boolean; adId?: string; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // Create the ad group ad with a responsive search ad
    const result = await customer.adGroupAds.create([{
      ad_group: `customers/${customerId}/adGroups/${adGroupId}`,
      status: ad.status === 'ENABLED' ? 2 : 3,
      ad: {
        final_urls: ad.finalUrls,
        responsive_search_ad: {
          headlines: ad.headlines.map(text => ({ text })),
          descriptions: ad.descriptions.map(text => ({ text })),
          path1: ad.path1 || undefined,
          path2: ad.path2 || undefined,
        },
      },
    }] as Parameters<typeof customer.adGroupAds.create>[0]);

    const adResourceName = result.results[0]?.resource_name;
    if (!adResourceName) {
      return { success: false, error: 'Failed to create ad' };
    }

    // Extract ad ID from resource name
    const adId = adResourceName.split('~').pop();

    return { success: true, adId };
  } catch (error) {
    console.error('Error creating ad:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create ad',
    };
  }
}

// Update an existing ad (only status can be updated; for content changes, you must create a new ad)
export async function updateAd(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  adId: string,
  updates: Partial<ResponsiveSearchAdInput>,
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // For responsive search ads, we can only update status
    // Content changes require removing the old ad and creating a new one
    if (updates.status) {
      await customer.adGroupAds.update([{
        resource_name: `customers/${customerId}/adGroupAds/${adGroupId}~${adId}`,
        status: updates.status === 'ENABLED' ? 2 : 3,
      }] as Parameters<typeof customer.adGroupAds.update>[0]);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating ad:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update ad',
    };
  }
}

// ============================================
// KEYWORD MANAGEMENT
// ============================================

export interface KeywordInput {
  text: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
}

// Create keywords in an ad group
export async function createKeywords(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  keywords: KeywordInput[],
  loginCustomerId?: string
): Promise<{ success: boolean; keywordIds?: string[]; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // Map match type to Google Ads enum values
    const matchTypeMapping: Record<string, number> = {
      'EXACT': 1,
      'PHRASE': 2,
      'BROAD': 3,
    };

    // Create operations for each keyword
    const operations = keywords.map((kw) => ({
      ad_group: `customers/${customerId}/adGroups/${adGroupId}`,
      status: 2, // ENABLED
      keyword: {
        text: kw.text,
        match_type: matchTypeMapping[kw.matchType] || 3, // Default to BROAD
      },
    }));

    // Batch create all keywords
    const keywordIds: string[] = [];
    for (const op of operations) {
      const result = await customer.adGroupCriteria.create([op] as Parameters<typeof customer.adGroupCriteria.create>[0]);
      const resourceName = result.results[0]?.resource_name;
      if (resourceName) {
        // Extract criterion ID from resource name (format: customers/xxx/adGroupCriteria/yyy~zzz)
        const criterionId = resourceName.split('~').pop();
        if (criterionId) {
          keywordIds.push(criterionId);
        }
      }
    }

    return { success: true, keywordIds };
  } catch (error) {
    console.error('Error creating keywords:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create keywords',
    };
  }
}

// Remove a keyword from an ad group
export async function removeKeyword(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  criterionId: string,
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    // Set status to REMOVED
    await customer.adGroupCriteria.update([{
      resource_name: `customers/${customerId}/adGroupCriteria/${adGroupId}~${criterionId}`,
      status: 4, // REMOVED
    }] as Parameters<typeof customer.adGroupCriteria.update>[0]);

    return { success: true };
  } catch (error) {
    console.error('Error removing keyword:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove keyword',
    };
  }
}

// Update ad group bid
export async function updateAdGroupBid(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  cpcBidMicros: number,
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    await customer.adGroups.update([{
      resource_name: `customers/${customerId}/adGroups/${adGroupId}`,
      cpc_bid_micros: cpcBidMicros,
    }] as Parameters<typeof customer.adGroups.update>[0]);

    return { success: true };
  } catch (error) {
    console.error('Error updating ad group bid:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update ad group bid',
    };
  }
}

// Update keyword match type (requires removing old and creating new)
export async function updateKeyword(
  refreshToken: string,
  customerId: string,
  adGroupId: string,
  criterionId: string,
  updates: { status?: 'ENABLED' | 'PAUSED'; cpcBidMicros?: number },
  loginCustomerId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    const updatePayload: Record<string, unknown> = {
      resource_name: `customers/${customerId}/adGroupCriteria/${adGroupId}~${criterionId}`,
    };

    if (updates.status) {
      updatePayload.status = updates.status === 'ENABLED' ? 2 : 3;
    }

    if (updates.cpcBidMicros) {
      updatePayload.cpc_bid_micros = updates.cpcBidMicros;
    }

    await customer.adGroupCriteria.update([updatePayload] as Parameters<typeof customer.adGroupCriteria.update>[0]);

    return { success: true };
  } catch (error) {
    console.error('Error updating keyword:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update keyword',
    };
  }
}

// ============================================
// REPORTING & ANALYTICS
// ============================================

export interface DailyMetrics {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpa: number;
}

// Fetch daily metrics for reporting
export async function fetchDailyMetrics(
  refreshToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<DailyMetrics[]> {
  const client = createGoogleAdsClient(refreshToken);
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    const result = await customer.query(`
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.ctr
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY segments.date ASC
    `);

    return result.map((row) => {
      const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
      const conversions = row.metrics?.conversions || 0;
      const clicks = row.metrics?.clicks || 0;
      const impressions = row.metrics?.impressions || 0;
      const ctr = row.metrics?.ctr || (impressions > 0 ? clicks / impressions : 0);
      const cpa = conversions > 0 ? spend / conversions : 0;

      return {
        date: row.segments?.date || '',
        spend,
        clicks,
        impressions,
        conversions,
        ctr,
        cpa,
      };
    });
  } catch (error) {
    console.error('Error fetching daily metrics:', error);
    throw error;
  }
}

