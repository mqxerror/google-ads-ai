/**
 * Data Sync Service for Quick Ads AI
 *
 * Handles synchronization between Google Ads API and local database
 * - Fetches campaign data from Google Ads
 * - Stores metrics in PostgreSQL
 * - Calculates AI Scores
 * - Supports daily auto-sync and manual refresh
 *
 * RATE LIMITING: Google Ads API has strict limits
 * - Only sync once per day automatically
 * - Manual refresh limited to once per hour
 * - Always check cache before API calls
 * - Use cached data for dashboard, only API for explicit refresh
 */

// Rate limiting: Minimum time between syncs (in milliseconds)
// TODO: Re-enable rate limits for production
const MIN_SYNC_INTERVAL_AUTO = 0; // Disabled for development
const MIN_SYNC_INTERVAL_MANUAL = 0; // Disabled for development - sync anytime

import { Pool, PoolClient } from 'pg';
import { fetchCampaigns, fetchAdGroups, listAccessibleAccounts, listMCCClientAccounts } from './google-ads';
import { calculateAIScoreWithBreakdown } from './ai-score';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface SyncOptions {
  accountId: string;
  customerId: string;
  refreshToken: string;
  loginCustomerId?: string;
  startDate?: string;
  endDate?: string;
  syncType?: 'full_sync' | 'incremental' | 'metrics_only';
  forceSync?: boolean; // Override rate limits (use sparingly!)
}

/**
 * Check if sync is allowed based on rate limits
 * Returns { allowed: boolean, reason?: string, nextSyncAt?: Date }
 */
export async function canSync(
  customerId: string,
  isManual: boolean = true
): Promise<{ allowed: boolean; reason?: string; nextSyncAt?: Date; lastSyncedAt?: Date }> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT last_synced_at FROM google_ads_accounts WHERE customer_id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return { allowed: true }; // New account, allow sync
    }

    const lastSynced = result.rows[0].last_synced_at;
    if (!lastSynced) {
      return { allowed: true }; // Never synced, allow
    }

    const lastSyncedAt = new Date(lastSynced);
    const minInterval = isManual ? MIN_SYNC_INTERVAL_MANUAL : MIN_SYNC_INTERVAL_AUTO;
    const nextSyncAt = new Date(lastSyncedAt.getTime() + minInterval);
    const now = new Date();

    if (now < nextSyncAt) {
      const waitMinutes = Math.ceil((nextSyncAt.getTime() - now.getTime()) / 60000);
      return {
        allowed: false,
        reason: `Rate limited. Please wait ${waitMinutes} minutes before syncing again.`,
        nextSyncAt,
        lastSyncedAt,
      };
    }

    return { allowed: true, lastSyncedAt };
  } finally {
    client.release();
  }
}

export interface SyncResult {
  success: boolean;
  jobId?: string;
  recordsSynced: number;
  campaignsUpdated: number;
  metricsInserted: number;
  error?: string;
  duration?: number;
}

/**
 * Create or get user in database
 */
export async function upsertUser(
  email: string,
  name?: string,
  refreshToken?: string
): Promise<string> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO users (email, name, refresh_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (email)
       DO UPDATE SET
         name = COALESCE($2, users.name),
         refresh_token = COALESCE($3, users.refresh_token),
         updated_at = NOW()
       RETURNING id`,
      [email, name, refreshToken]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Sync accessible Google Ads accounts for a user
 * First tries direct access, then falls back to MCC discovery
 */
export async function syncUserAccounts(
  userId: string,
  refreshToken: string
): Promise<{ accountsFound: number; accountsSynced: number }> {
  const client = await pool.connect();
  try {
    // Get directly accessible accounts
    const accessibleAccounts = await listAccessibleAccounts(refreshToken);

    // Filter to client accounts only (not manager accounts)
    let accounts = accessibleAccounts.filter(acc => !acc.manager);

    // If no client accounts, try MCC discovery
    if (accounts.length === 0) {
      console.log('[Data Sync] No direct client accounts, trying MCC discovery...');
      const mccAccounts = await listMCCClientAccounts(refreshToken);
      accounts = mccAccounts;
    }

    console.log(`[Data Sync] Syncing ${accounts.length} accounts to database`);

    let synced = 0;
    for (const account of accounts) {
      await client.query(
        `INSERT INTO google_ads_accounts (user_id, customer_id, descriptive_name, currency_code, time_zone, is_manager)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, customer_id)
         DO UPDATE SET
           descriptive_name = $3,
           currency_code = $4,
           time_zone = $5,
           is_manager = $6,
           updated_at = NOW()`,
        [userId, account.customerId, account.descriptiveName, account.currencyCode, account.timeZone, account.manager || false]
      );
      synced++;
    }

    return { accountsFound: accounts.length, accountsSynced: synced };
  } finally {
    client.release();
  }
}

/**
 * Create a sync job record
 */
async function createSyncJob(
  client: PoolClient,
  accountId: string,
  syncType: string
): Promise<string> {
  const result = await client.query(
    `INSERT INTO sync_jobs (account_id, job_type, status, started_at)
     VALUES ($1, $2, 'running', NOW())
     RETURNING id`,
    [accountId, syncType]
  );
  return result.rows[0].id;
}

/**
 * Update sync job status
 */
async function updateSyncJob(
  client: PoolClient,
  jobId: string,
  status: 'completed' | 'failed',
  recordsSynced: number,
  error?: string
): Promise<void> {
  await client.query(
    `UPDATE sync_jobs
     SET status = $2, completed_at = NOW(), records_synced = $3, error_message = $4
     WHERE id = $1`,
    [jobId, status, recordsSynced, error]
  );
}

/**
 * Sync campaigns and metrics from Google Ads API to database
 */
export async function syncCampaignData(options: SyncOptions): Promise<SyncResult> {
  const startTime = Date.now();
  const client = await pool.connect();

  let jobId: string | undefined;
  let campaignsUpdated = 0;
  let metricsInserted = 0;

  try {
    // Start transaction
    await client.query('BEGIN');

    // Create sync job
    jobId = await createSyncJob(client, options.accountId, options.syncType || 'incremental');

    // Get internal account ID
    const accountResult = await client.query(
      `SELECT id FROM google_ads_accounts WHERE customer_id = $1 LIMIT 1`,
      [options.customerId]
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`Account ${options.customerId} not found in database`);
    }

    const dbAccountId = accountResult.rows[0].id;

    // Fetch campaigns from Google Ads API
    const campaigns = await fetchCampaigns(
      options.refreshToken,
      options.customerId,
      options.loginCustomerId,
      options.startDate,
      options.endDate
    );

    // Process each campaign
    for (const campaign of campaigns) {
      // Upsert campaign
      const campaignResult = await client.query(
        `INSERT INTO campaigns (account_id, google_campaign_id, name, status, campaign_type)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (account_id, google_campaign_id)
         DO UPDATE SET
           name = $3,
           status = $4,
           campaign_type = $5,
           updated_at = NOW()
         RETURNING id`,
        [dbAccountId, campaign.id, campaign.name, campaign.status, campaign.type]
      );

      const campaignId = campaignResult.rows[0].id;
      campaignsUpdated++;

      // Insert daily metrics (for today or specified date)
      const metricsDate = options.endDate || new Date().toISOString().split('T')[0];

      // Calculate data confidence based on clicks
      const dataConfidence = Math.min(1.0, 0.5 + (campaign.clicks / 200));

      await client.query(
        `INSERT INTO campaign_metrics (
           campaign_id, date, impressions, clicks, cost, conversions, conversions_value,
           ctr, avg_cpc, conversion_rate, cost_per_conversion, roas,
           ai_score, ai_score_ctr, ai_score_conv, ai_score_cpc, ai_score_qs, data_confidence
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (campaign_id, date)
         DO UPDATE SET
           impressions = $3,
           clicks = $4,
           cost = $5,
           conversions = $6,
           conversions_value = $7,
           ctr = $8,
           avg_cpc = $9,
           conversion_rate = $10,
           cost_per_conversion = $11,
           roas = $12,
           ai_score = $13,
           ai_score_ctr = $14,
           ai_score_conv = $15,
           ai_score_cpc = $16,
           ai_score_qs = $17,
           data_confidence = $18`,
        [
          campaignId,
          metricsDate,
          campaign.impressions,
          campaign.clicks,
          campaign.spend,
          campaign.conversions,
          campaign.roas * campaign.spend, // conversions_value
          campaign.ctr / 100, // Store as decimal
          campaign.spend / Math.max(campaign.clicks, 1), // avg_cpc
          campaign.conversions / Math.max(campaign.clicks, 1), // conversion_rate
          campaign.cpa,
          campaign.roas,
          campaign.aiScore,
          // Extract scores from factors array if available
          campaign.aiScoreBreakdown?.factors?.find(f => f.name === 'CTR Performance')?.score || 0,
          campaign.aiScoreBreakdown?.factors?.find(f => f.name === 'Conversion Efficiency')?.score || 0,
          campaign.aiScoreBreakdown?.factors?.find(f => f.name === 'Wasted Spend')?.score || 0,
          campaign.aiScoreBreakdown?.factors?.find(f => f.name === 'Return on Ad Spend')?.score || 70,
          dataConfidence,
        ]
      );
      metricsInserted++;

      // Refresh aggregates for this campaign
      await client.query(`SELECT refresh_campaign_aggregates($1, 30)`, [campaignId]);
    }

    // Update account last synced
    await client.query(
      `UPDATE google_ads_accounts SET last_synced_at = NOW() WHERE id = $1`,
      [dbAccountId]
    );

    // Complete sync job
    await updateSyncJob(client, jobId, 'completed', campaignsUpdated + metricsInserted);

    // Commit transaction
    await client.query('COMMIT');

    return {
      success: true,
      jobId,
      recordsSynced: campaignsUpdated + metricsInserted,
      campaignsUpdated,
      metricsInserted,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');

    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';

    if (jobId) {
      await updateSyncJob(client, jobId, 'failed', 0, errorMessage);
    }

    return {
      success: false,
      jobId,
      recordsSynced: 0,
      campaignsUpdated: 0,
      metricsInserted: 0,
      error: errorMessage,
      duration: Date.now() - startTime,
    };
  } finally {
    client.release();
  }
}

/**
 * Get campaigns with aggregated metrics from database
 */
export async function getCampaignsFromDB(
  customerId: string,
  options?: { includeInactive?: boolean; limit?: number }
): Promise<Campaign[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         c.id,
         c.google_campaign_id,
         c.name,
         c.status,
         c.campaign_type,
         ca.total_spend as spend,
         ca.total_clicks as clicks,
         ca.total_impressions as impressions,
         ca.total_conversions as conversions,
         ca.avg_ctr * 100 as ctr,
         ca.avg_cpa as cpa,
         ca.avg_roas as roas,
         ca.current_ai_score as ai_score,
         ca.ai_score_trend
       FROM campaigns c
       JOIN google_ads_accounts a ON c.account_id = a.id
       LEFT JOIN campaign_aggregates ca ON c.id = ca.campaign_id
       WHERE a.customer_id = $1
         ${options?.includeInactive ? '' : "AND c.status != 'REMOVED'"}
       ORDER BY ca.total_spend DESC NULLS LAST
       LIMIT $2`,
      [customerId, options?.limit || 100]
    );

    return result.rows.map((row) => ({
      id: row.google_campaign_id,
      name: row.name,
      status: row.status,
      type: row.campaign_type,
      spend: parseFloat(row.spend) || 0,
      clicks: parseInt(row.clicks) || 0,
      impressions: parseInt(row.impressions) || 0,
      conversions: parseFloat(row.conversions) || 0,
      ctr: parseFloat(row.ctr) || 0,
      cpa: parseFloat(row.cpa) || 0,
      roas: parseFloat(row.roas) || 0,
      aiScore: parseInt(row.ai_score) || 0,
      aiScoreTrend: row.ai_score_trend,
    }));
  } finally {
    client.release();
  }
}

/**
 * Get last sync status for an account
 */
export async function getLastSyncStatus(customerId: string): Promise<{
  lastSyncedAt: string | null;
  lastJobStatus: string | null;
  lastJobError: string | null;
}> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         a.last_synced_at,
         sj.status as last_job_status,
         sj.error_message as last_job_error
       FROM google_ads_accounts a
       LEFT JOIN LATERAL (
         SELECT status, error_message
         FROM sync_jobs
         WHERE account_id = a.id
         ORDER BY created_at DESC
         LIMIT 1
       ) sj ON true
       WHERE a.customer_id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return { lastSyncedAt: null, lastJobStatus: null, lastJobError: null };
    }

    return {
      lastSyncedAt: result.rows[0].last_synced_at,
      lastJobStatus: result.rows[0].last_job_status,
      lastJobError: result.rows[0].last_job_error,
    };
  } finally {
    client.release();
  }
}

// Campaign type for return values
interface Campaign {
  id: string;
  name: string;
  status: string;
  type: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
  aiScore: number;
  aiScoreTrend?: string;
}

export { pool };
