/**
 * SERP Intelligence Database Operations
 *
 * Handles CRUD operations for:
 * - tracked_keywords: Keywords user wants to monitor for PPC decisions
 * - serp_snapshots: Daily position snapshots with competitive intelligence
 * - serp_opportunities: AI-generated PPC recommendations
 *
 * This is for Google Ads optimization, NOT SEO tracking:
 * - Identify PPC opportunities (weak organic + high volume)
 * - Track competitor ad presence
 * - Detect SERP features affecting ad strategy
 */

import { Pool } from 'pg';

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || '38.97.60.181',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres123',
  database: process.env.POSTGRES_DB || 'google_ads_manager',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ============================================================================
// TYPES
// ============================================================================

export interface TrackedKeyword {
  id: string;
  user_id: string;
  customer_id: string;
  keyword: string;
  keyword_normalized: string;
  target_domain: string;
  location_code: string;
  device: 'desktop' | 'mobile';
  language: string;
  is_active: boolean;
  tracking_frequency: 'daily' | 'weekly';
  project_name: string | null;
  color: string;
  icon: string | null;
  created_at: Date;
  updated_at: Date;
  last_checked_at: Date | null;
}

export interface SerpSnapshot {
  id: string;
  tracked_keyword_id: string;
  organic_position: number | null;
  position_change: number | null;
  featured_snippet: boolean;
  local_pack_present: boolean;
  shopping_ads_present: boolean;
  people_also_ask_present: boolean;
  related_searches_present: boolean;
  competitor_ads_count: number;
  top_ads_count: number;
  bottom_ads_count: number;
  top_ad_domains: string[];
  bottom_ad_domains: string[];
  organic_competitors: string[];
  organic_top_3_domains: string[];
  serp_features_raw: any;
  raw_response: any;
  snapshot_date: Date;
  fetched_at: Date;
  scrapingrobot_status: string;
  scrapingrobot_error: string | null;
  api_cost_cents: number;
}

export interface SerpOpportunity {
  id: string;
  user_id: string;
  tracked_keyword_id: string;
  opportunity_type: string;
  priority: 'high' | 'medium' | 'low';
  recommendation_text: string;
  suggested_action: string;
  estimated_impact: any;
  related_campaign_id: string | null;
  suggested_bid_amount_micros: number | null;
  status: 'active' | 'dismissed' | 'implemented' | 'expired';
  dismissed_at: Date | null;
  dismissed_reason: string | null;
  implemented_at: Date | null;
  created_at: Date;
  expires_at: Date;
}

// ============================================================================
// TRACKED KEYWORDS
// ============================================================================

/**
 * Add keywords to track for SERP intelligence
 */
export async function addTrackedKeywords(
  userId: string,
  customerId: string,
  keywords: Array<{
    keyword: string;
    targetDomain: string;
    locationCode?: string;
    device?: 'desktop' | 'mobile';
    language?: string;
    projectName?: string;
    color?: string;
  }>
): Promise<TrackedKeyword[]> {
  const client = await pool.connect();

  try {
    const insertedKeywords: TrackedKeyword[] = [];

    for (const kw of keywords) {
      const normalizedKeyword = kw.keyword.toLowerCase().trim();

      const result = await client.query(
        `
        INSERT INTO tracked_keywords (
          user_id, customer_id, keyword, keyword_normalized, target_domain,
          location_code, device, language, project_name, color
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id, customer_id, keyword_normalized, location_code, device)
        DO UPDATE SET
          is_active = TRUE,
          updated_at = NOW()
        RETURNING *
        `,
        [
          userId,
          customerId,
          kw.keyword,
          normalizedKeyword,
          kw.targetDomain,
          kw.locationCode || '2840',
          kw.device || 'desktop',
          kw.language || 'en',
          kw.projectName || null,
          kw.color || '#4F46E5',
        ]
      );

      insertedKeywords.push(result.rows[0]);
    }

    console.log(`[SERP Intelligence] Added ${insertedKeywords.length} tracked keywords`);
    return insertedKeywords;
  } finally {
    client.release();
  }
}

/**
 * Get all tracked keywords for a user
 */
export async function getTrackedKeywords(
  userId: string,
  options: {
    customerId?: string;
    isActive?: boolean;
    projectName?: string;
  } = {}
): Promise<TrackedKeyword[]> {
  const conditions: string[] = ['user_id = $1'];
  const params: any[] = [userId];

  if (options.customerId) {
    params.push(options.customerId);
    conditions.push(`customer_id = $${params.length}`);
  }

  if (options.isActive !== undefined) {
    params.push(options.isActive);
    conditions.push(`is_active = $${params.length}`);
  }

  if (options.projectName) {
    params.push(options.projectName);
    conditions.push(`project_name = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT * FROM tracked_keywords
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    `,
    params
  );

  return result.rows;
}

/**
 * Get tracked keywords with latest snapshot data (for dashboard)
 */
export async function getTrackedKeywordsWithLatestSnapshot(
  userId: string,
  customerId: string
): Promise<Array<TrackedKeyword & { latestSnapshot: SerpSnapshot | null }>> {
  const result = await pool.query(
    `
    SELECT
      tk.*,
      (
        SELECT row_to_json(ss)
        FROM serp_snapshots ss
        WHERE ss.tracked_keyword_id = tk.id
        ORDER BY ss.snapshot_date DESC
        LIMIT 1
      ) as latest_snapshot
    FROM tracked_keywords tk
    WHERE tk.user_id = $1
      AND tk.customer_id = $2
      AND tk.is_active = TRUE
    ORDER BY tk.created_at DESC
    `,
    [userId, customerId]
  );

  return result.rows.map((row) => ({
    ...row,
    latestSnapshot: row.latest_snapshot,
  }));
}

/**
 * Update tracked keyword settings
 */
export async function updateTrackedKeyword(
  id: string,
  userId: string,
  updates: Partial<Pick<TrackedKeyword, 'is_active' | 'tracking_frequency' | 'project_name' | 'color'>>
): Promise<TrackedKeyword | null> {
  const fields: string[] = [];
  const params: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    params.push(value);
    fields.push(`${key} = $${params.length}`);
  });

  if (fields.length === 0) return null;

  params.push(id);
  params.push(userId);

  const result = await pool.query(
    `
    UPDATE tracked_keywords
    SET ${fields.join(', ')}
    WHERE id = $${params.length - 1} AND user_id = $${params.length}
    RETURNING *
    `,
    params
  );

  return result.rows[0] || null;
}

/**
 * Delete (deactivate) tracked keyword
 */
export async function deleteTrackedKeyword(id: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `
    UPDATE tracked_keywords
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    `,
    [id, userId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Get tracked keywords by IDs (for manual position checks)
 */
export async function getTrackedKeywordsByIds(
  keywordIds: string[],
  userId: string
): Promise<TrackedKeyword[]> {
  const result = await pool.query(
    `
    SELECT * FROM tracked_keywords
    WHERE id = ANY($1::uuid[])
      AND user_id = $2
      AND is_active = TRUE
    ORDER BY created_at DESC
    `,
    [keywordIds, userId]
  );

  return result.rows;
}

/**
 * Get timestamp of last manual check for rate limiting
 */
export async function getLastManualCheckTime(
  userId: string,
  customerId: string
): Promise<Date | null> {
  const result = await pool.query(
    `
    SELECT MAX(last_checked_at) as last_check
    FROM tracked_keywords
    WHERE user_id = $1
      AND customer_id = $2
      AND last_checked_at IS NOT NULL
    `,
    [userId, customerId]
  );

  return result.rows[0]?.last_check || null;
}

/**
 * Record manual check timestamp (for rate limiting)
 */
export async function recordManualCheck(userId: string, customerId: string): Promise<void> {
  // Update is handled automatically when we call storeSerpSnapshot
  // This is just a placeholder for explicit rate limit tracking if needed
  console.log(`[SERP Intelligence] Manual check recorded for user ${userId}, customer ${customerId}`);
}

// ============================================================================
// SERP SNAPSHOTS
// ============================================================================

/**
 * Store SERP snapshot
 */
export async function storeSerpSnapshot(
  trackedKeywordId: string,
  snapshotData: {
    organicPosition: number | null;
    featuredSnippet: boolean;
    localPackPresent: boolean;
    shoppingAdsPresent: boolean;
    peopleAlsoAskPresent: boolean;
    relatedSearchesPresent: boolean;
    competitorAdsCount: number;
    topAdsCount: number;
    bottomAdsCount: number;
    topAdDomains: string[];
    bottomAdDomains: string[];
    organicCompetitors: string[];
    organicTop3Domains: string[];
    serpFeaturesRaw?: any;
    rawResponse?: any;
    snapshotDate: Date;
    scrapingrobotStatus: string;
    scrapingrobotError?: string;
    apiCostCents: number;
  }
): Promise<SerpSnapshot> {
  const result = await pool.query(
    `
    INSERT INTO serp_snapshots (
      tracked_keyword_id, organic_position,
      featured_snippet, local_pack_present, shopping_ads_present,
      people_also_ask_present, related_searches_present,
      competitor_ads_count, top_ads_count, bottom_ads_count,
      top_ad_domains, bottom_ad_domains,
      organic_competitors, organic_top_3_domains,
      serp_features_raw, raw_response,
      snapshot_date, scrapingrobot_status, scrapingrobot_error,
      api_cost_cents
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    ON CONFLICT (tracked_keyword_id, snapshot_date)
    DO UPDATE SET
      organic_position = EXCLUDED.organic_position,
      position_change = EXCLUDED.position_change,
      featured_snippet = EXCLUDED.featured_snippet,
      local_pack_present = EXCLUDED.local_pack_present,
      shopping_ads_present = EXCLUDED.shopping_ads_present,
      people_also_ask_present = EXCLUDED.people_also_ask_present,
      related_searches_present = EXCLUDED.related_searches_present,
      competitor_ads_count = EXCLUDED.competitor_ads_count,
      top_ads_count = EXCLUDED.top_ads_count,
      bottom_ads_count = EXCLUDED.bottom_ads_count,
      top_ad_domains = EXCLUDED.top_ad_domains,
      bottom_ad_domains = EXCLUDED.bottom_ad_domains,
      organic_competitors = EXCLUDED.organic_competitors,
      organic_top_3_domains = EXCLUDED.organic_top_3_domains,
      serp_features_raw = EXCLUDED.serp_features_raw,
      raw_response = EXCLUDED.raw_response,
      scrapingrobot_status = EXCLUDED.scrapingrobot_status,
      scrapingrobot_error = EXCLUDED.scrapingrobot_error,
      api_cost_cents = EXCLUDED.api_cost_cents,
      fetched_at = NOW()
    RETURNING *
    `,
    [
      trackedKeywordId,
      snapshotData.organicPosition,
      snapshotData.featuredSnippet,
      snapshotData.localPackPresent,
      snapshotData.shoppingAdsPresent,
      snapshotData.peopleAlsoAskPresent,
      snapshotData.relatedSearchesPresent,
      snapshotData.competitorAdsCount,
      snapshotData.topAdsCount,
      snapshotData.bottomAdsCount,
      snapshotData.topAdDomains,
      snapshotData.bottomAdDomains,
      snapshotData.organicCompetitors,
      snapshotData.organicTop3Domains,
      snapshotData.serpFeaturesRaw ? JSON.stringify(snapshotData.serpFeaturesRaw) : null,
      snapshotData.rawResponse ? JSON.stringify(snapshotData.rawResponse) : null,
      snapshotData.snapshotDate,
      snapshotData.scrapingrobotStatus,
      snapshotData.scrapingrobotError || null,
      snapshotData.apiCostCents,
    ]
  );

  // Update last_checked_at on tracked_keyword
  await pool.query(
    `UPDATE tracked_keywords SET last_checked_at = NOW() WHERE id = $1`,
    [trackedKeywordId]
  );

  return result.rows[0];
}

/**
 * Get SERP snapshots for a keyword (position history)
 */
export async function getSerpSnapshots(
  trackedKeywordId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
): Promise<SerpSnapshot[]> {
  const conditions: string[] = ['tracked_keyword_id = $1'];
  const params: any[] = [trackedKeywordId];

  if (options.startDate) {
    params.push(options.startDate);
    conditions.push(`snapshot_date >= $${params.length}`);
  }

  if (options.endDate) {
    params.push(options.endDate);
    conditions.push(`snapshot_date <= $${params.length}`);
  }

  const limit = options.limit || 90; // Default 90 days
  params.push(limit);

  const result = await pool.query(
    `
    SELECT * FROM serp_snapshots
    WHERE ${conditions.join(' AND ')}
    ORDER BY snapshot_date DESC
    LIMIT $${params.length}
    `,
    params
  );

  return result.rows;
}

// ============================================================================
// SERP OPPORTUNITIES
// ============================================================================

/**
 * Create PPC opportunity
 */
export async function createSerpOpportunity(
  userId: string,
  trackedKeywordId: string,
  opportunity: {
    opportunityType: string;
    priority: 'high' | 'medium' | 'low';
    recommendationText: string;
    suggestedAction: string;
    estimatedImpact?: any;
    relatedCampaignId?: string;
    suggestedBidAmountMicros?: number;
  }
): Promise<SerpOpportunity> {
  const result = await pool.query(
    `
    INSERT INTO serp_opportunities (
      user_id, tracked_keyword_id, opportunity_type, priority,
      recommendation_text, suggested_action, estimated_impact,
      related_campaign_id, suggested_bid_amount_micros
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      userId,
      trackedKeywordId,
      opportunity.opportunityType,
      opportunity.priority,
      opportunity.recommendationText,
      opportunity.suggestedAction,
      opportunity.estimatedImpact || null,
      opportunity.relatedCampaignId || null,
      opportunity.suggestedBidAmountMicros || null,
    ]
  );

  return result.rows[0];
}

/**
 * Get active PPC opportunities for user
 */
export async function getSerpOpportunities(
  userId: string,
  options: {
    status?: string;
    priority?: string;
    limit?: number;
  } = {}
): Promise<SerpOpportunity[]> {
  const conditions: string[] = ['user_id = $1'];
  const params: any[] = [userId];

  if (options.status) {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  }

  if (options.priority) {
    params.push(options.priority);
    conditions.push(`priority = $${params.length}`);
  }

  const limit = options.limit || 50;
  params.push(limit);

  const result = await pool.query(
    `
    SELECT * FROM serp_opportunities
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      created_at DESC
    LIMIT $${params.length}
    `,
    params
  );

  return result.rows;
}

/**
 * Dismiss or implement opportunity
 */
export async function updateSerpOpportunityStatus(
  id: string,
  userId: string,
  status: 'dismissed' | 'implemented',
  reason?: string
): Promise<SerpOpportunity | null> {
  const result = await pool.query(
    `
    UPDATE serp_opportunities
    SET
      status = $1,
      ${status === 'dismissed' ? 'dismissed_at = NOW(), dismissed_reason = $4' : 'implemented_at = NOW()'}
    WHERE id = $2 AND user_id = $3
    RETURNING *
    `,
    status === 'dismissed' ? [status, id, userId, reason] : [status, id, userId]
  );

  return result.rows[0] || null;
}

/**
 * Auto-expire old opportunities (called by cron job)
 */
export async function expireOldOpportunities(): Promise<number> {
  const result = await pool.query(
    `
    UPDATE serp_opportunities
    SET status = 'expired'
    WHERE status = 'active' AND expires_at < NOW()
    `
  );

  return result.rowCount ?? 0;
}

// ============================================================================
// ANALYTICS & INSIGHTS
// ============================================================================

/**
 * Get dashboard stats for SERP intelligence
 */
export async function getDashboardStats(
  userId: string,
  customerId: string
): Promise<{
  totalTrackedKeywords: number;
  activeKeywords: number;
  avgCompetitorAds: number;
  avgOrganicPosition: number;
  ppcOpportunities: number;
  serpFeaturesTriggered: number;
  positionImprovements: number;
  positionDeclines: number;
}> {
  const result = await pool.query(
    `
    WITH latest_snapshots AS (
      SELECT DISTINCT ON (ss.tracked_keyword_id)
        ss.tracked_keyword_id,
        ss.organic_position,
        ss.competitor_ads_count,
        ss.shopping_ads_present,
        ss.local_pack_present,
        ss.featured_snippet,
        ss.position_change
      FROM serp_snapshots ss
      INNER JOIN tracked_keywords tk ON tk.id = ss.tracked_keyword_id
      WHERE tk.user_id = $1 AND tk.customer_id = $2 AND tk.is_active = TRUE
      ORDER BY ss.tracked_keyword_id, ss.snapshot_date DESC
    )
    SELECT
      (SELECT COUNT(*) FROM tracked_keywords WHERE user_id = $1 AND customer_id = $2) as total_tracked_keywords,
      (SELECT COUNT(*) FROM tracked_keywords WHERE user_id = $1 AND customer_id = $2 AND is_active = TRUE) as active_keywords,
      COALESCE(AVG(competitor_ads_count)::numeric, 0) as avg_competitor_ads,
      COALESCE(AVG(organic_position)::numeric, 0) as avg_organic_position,
      (SELECT COUNT(*) FROM serp_opportunities WHERE user_id = $1 AND status = 'active') as ppc_opportunities,
      (SELECT COUNT(*) FROM latest_snapshots WHERE shopping_ads_present OR local_pack_present OR featured_snippet) as serp_features_triggered,
      (SELECT COUNT(*) FROM latest_snapshots WHERE position_change < 0) as position_improvements,
      (SELECT COUNT(*) FROM latest_snapshots WHERE position_change > 0) as position_declines
    FROM latest_snapshots
    `,
    [userId, customerId]
  );

  return result.rows[0];
}

/**
 * Get keywords needing daily check (for background job)
 */
export async function getKeywordsNeedingCheck(): Promise<TrackedKeyword[]> {
  const result = await pool.query(
    `
    SELECT * FROM tracked_keywords
    WHERE is_active = TRUE
      AND tracking_frequency = 'daily'
      AND (
        last_checked_at IS NULL
        OR last_checked_at < NOW() - INTERVAL '20 hours'
      )
    ORDER BY last_checked_at ASC NULLS FIRST
    `
  );

  return result.rows;
}

/**
 * Get user UUID from email (for NextAuth v5 compatibility)
 */
export async function getUserIdFromEmail(email: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT id FROM "User" WHERE email = $1 LIMIT 1',
    [email]
  );

  return result.rows[0]?.id || null;
}

export { pool };
