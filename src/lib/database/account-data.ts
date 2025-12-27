/**
 * CRUD operations for Google Ads Account Data
 */

import { Pool } from 'pg';
import type {
  KeywordAccountData,
  KeywordPerformanceHistory,
  AccountKeyword,
} from './types';

// PostgreSQL connection pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || '38.97.60.181',
      port: parseInt(process.env.POSTGRES_PORT || '5433'),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres123',
      database: process.env.POSTGRES_DATABASE || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

// =====================================================
// Account Data Operations
// =====================================================

export async function upsertKeywordAccountData(
  userId: string,
  customerId: string,
  keywords: AccountKeyword[]
): Promise<{ inserted: number; updated: number }> {
  const pool = getPool();
  let inserted = 0;
  let updated = 0;

  for (const kw of keywords) {
    const keywordNormalized = kw.keyword.toLowerCase().trim();

    const result = await pool.query(
      `
      INSERT INTO keyword_account_data (
        user_id,
        customer_id,
        keyword,
        keyword_normalized,
        campaign_id,
        campaign_name,
        ad_group_id,
        ad_group_name,
        match_type,
        status,
        last_synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (user_id, customer_id, keyword_normalized, campaign_id, match_type)
      DO UPDATE SET
        keyword = EXCLUDED.keyword,
        campaign_name = EXCLUDED.campaign_name,
        ad_group_id = EXCLUDED.ad_group_id,
        ad_group_name = EXCLUDED.ad_group_name,
        status = EXCLUDED.status,
        last_synced_at = NOW()
      RETURNING (xmax = 0) AS inserted
      `,
      [
        userId,
        customerId,
        kw.keyword,
        keywordNormalized,
        kw.campaignId,
        kw.campaignName,
        kw.adGroupId,
        kw.adGroupName,
        kw.matchType,
        kw.status,
      ]
    );

    if (result.rows[0]?.inserted) {
      inserted++;
    } else {
      updated++;
    }
  }

  return { inserted, updated };
}

export async function getKeywordAccountData(
  userId: string,
  customerId: string,
  keywords?: string[]
): Promise<KeywordAccountData[]> {
  const pool = getPool();

  let query = `
    SELECT * FROM keyword_account_data
    WHERE user_id = $1 AND customer_id = $2
  `;

  const params: any[] = [userId, customerId];

  if (keywords && keywords.length > 0) {
    const keywordsNormalized = keywords.map((k) => k.toLowerCase().trim());
    query += ` AND keyword_normalized = ANY($3)`;
    params.push(keywordsNormalized);
  }

  query += ` ORDER BY keyword_normalized, match_type`;

  const result = await pool.query<KeywordAccountData>(query, params);
  return result.rows;
}

export async function checkKeywordInAccount(
  userId: string,
  customerId: string,
  keyword: string
): Promise<KeywordAccountData[]> {
  const pool = getPool();
  const keywordNormalized = keyword.toLowerCase().trim();

  const result = await pool.query<KeywordAccountData>(
    `
    SELECT * FROM keyword_account_data
    WHERE user_id = $1
      AND customer_id = $2
      AND keyword_normalized = $3
      AND status != 'REMOVED'
    ORDER BY match_type
    `,
    [userId, customerId, keywordNormalized]
  );

  return result.rows;
}

export async function getAccountKeywordsBatch(
  userId: string,
  customerId: string,
  keywords: string[]
): Promise<Map<string, KeywordAccountData[]>> {
  const pool = getPool();
  const keywordsNormalized = keywords.map((k) => k.toLowerCase().trim());

  const result = await pool.query<KeywordAccountData>(
    `
    SELECT * FROM keyword_account_data
    WHERE user_id = $1
      AND customer_id = $2
      AND keyword_normalized = ANY($3)
    ORDER BY keyword_normalized, match_type
    `,
    [userId, customerId, keywordsNormalized]
  );

  const map = new Map<string, KeywordAccountData[]>();

  for (const row of result.rows) {
    if (!map.has(row.keyword_normalized)) {
      map.set(row.keyword_normalized, []);
    }
    map.get(row.keyword_normalized)!.push(row);
  }

  return map;
}

export async function deleteOldAccountData(
  userId: string,
  customerId: string,
  olderThanDays: number = 30
): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    `
    DELETE FROM keyword_account_data
    WHERE user_id = $1
      AND customer_id = $2
      AND last_synced_at < NOW() - INTERVAL '${olderThanDays} days'
    `,
    [userId, customerId]
  );

  return result.rowCount || 0;
}

// =====================================================
// Performance History Operations
// =====================================================

export async function upsertKeywordPerformance(
  userId: string,
  customerId: string,
  performance: Array<{
    keyword: string;
    campaignId: string;
    date: string;
    impressions: number;
    clicks: number;
    conversions: number;
    costMicros: number;
    ctr?: number;
    qualityScore?: number;
  }>
): Promise<{ inserted: number; updated: number }> {
  const pool = getPool();
  let inserted = 0;
  let updated = 0;

  for (const perf of performance) {
    const keywordNormalized = perf.keyword.toLowerCase().trim();
    const ctr = perf.ctr ?? (perf.clicks / Math.max(1, perf.impressions));

    const result = await pool.query(
      `
      INSERT INTO keyword_performance_history (
        user_id,
        customer_id,
        keyword_normalized,
        campaign_id,
        date,
        impressions,
        clicks,
        conversions,
        cost_micros,
        ctr,
        quality_score,
        synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (user_id, customer_id, keyword_normalized, campaign_id, date)
      DO UPDATE SET
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        cost_micros = EXCLUDED.cost_micros,
        ctr = EXCLUDED.ctr,
        quality_score = EXCLUDED.quality_score,
        synced_at = NOW()
      RETURNING (xmax = 0) AS inserted
      `,
      [
        userId,
        customerId,
        keywordNormalized,
        perf.campaignId,
        perf.date,
        perf.impressions,
        perf.clicks,
        perf.conversions,
        perf.costMicros,
        ctr,
        perf.qualityScore || null,
      ]
    );

    if (result.rows[0]?.inserted) {
      inserted++;
    } else {
      updated++;
    }
  }

  return { inserted, updated };
}

export async function getKeywordPerformance(
  userId: string,
  customerId: string,
  options: {
    keyword?: string;
    keywords?: string[];
    campaignId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<KeywordPerformanceHistory[]> {
  const pool = getPool();

  let query = `
    SELECT * FROM keyword_performance_history
    WHERE user_id = $1 AND customer_id = $2
  `;

  const params: any[] = [userId, customerId];
  let paramIndex = 3;

  if (options.keyword) {
    const keywordNormalized = options.keyword.toLowerCase().trim();
    query += ` AND keyword_normalized = $${paramIndex++}`;
    params.push(keywordNormalized);
  }

  if (options.keywords && options.keywords.length > 0) {
    const keywordsNormalized = options.keywords.map((k) =>
      k.toLowerCase().trim()
    );
    query += ` AND keyword_normalized = ANY($${paramIndex++})`;
    params.push(keywordsNormalized);
  }

  if (options.campaignId) {
    query += ` AND campaign_id = $${paramIndex++}`;
    params.push(options.campaignId);
  }

  if (options.startDate) {
    query += ` AND date >= $${paramIndex++}`;
    params.push(options.startDate);
  }

  if (options.endDate) {
    query += ` AND date <= $${paramIndex++}`;
    params.push(options.endDate);
  }

  query += ` ORDER BY date DESC, keyword_normalized`;

  if (options.limit) {
    query += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  const result = await pool.query<KeywordPerformanceHistory>(query, params);
  return result.rows;
}

export async function getKeywordPerformanceSummary(
  userId: string,
  customerId: string,
  keyword: string,
  startDate: string,
  endDate: string
): Promise<{
  keyword: string;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalCost: number;
  avgCtr: number;
  avgQualityScore: number | null;
  daysWithData: number;
}> {
  const pool = getPool();
  const keywordNormalized = keyword.toLowerCase().trim();

  const result = await pool.query(
    `
    SELECT
      $3 as keyword,
      COALESCE(SUM(impressions), 0)::INTEGER as total_impressions,
      COALESCE(SUM(clicks), 0)::INTEGER as total_clicks,
      COALESCE(SUM(conversions), 0)::NUMERIC as total_conversions,
      COALESCE(SUM(cost_micros), 0)::BIGINT as total_cost_micros,
      CASE
        WHEN SUM(impressions) > 0
        THEN (SUM(clicks)::NUMERIC / SUM(impressions))
        ELSE 0
      END as avg_ctr,
      AVG(quality_score) as avg_quality_score,
      COUNT(DISTINCT date) as days_with_data
    FROM keyword_performance_history
    WHERE user_id = $1
      AND customer_id = $2
      AND keyword_normalized = $4
      AND date BETWEEN $5 AND $6
    `,
    [userId, customerId, keyword, keywordNormalized, startDate, endDate]
  );

  const row = result.rows[0];

  return {
    keyword,
    totalImpressions: row.total_impressions || 0,
    totalClicks: row.total_clicks || 0,
    totalConversions: parseFloat(row.total_conversions || '0'),
    totalCost: Number(row.total_cost_micros || 0) / 1_000_000,
    avgCtr: parseFloat(row.avg_ctr || '0'),
    avgQualityScore: row.avg_quality_score
      ? parseFloat(row.avg_quality_score)
      : null,
    daysWithData: row.days_with_data || 0,
  };
}

export async function getPerformanceTrends(
  userId: string,
  customerId: string,
  keyword: string,
  days: number = 30
): Promise<
  Array<{
    date: string;
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    ctr: number;
  }>
> {
  const pool = getPool();
  const keywordNormalized = keyword.toLowerCase().trim();

  const result = await pool.query(
    `
    SELECT
      date::TEXT as date,
      impressions,
      clicks,
      conversions,
      cost_micros / 1000000.0 as cost,
      ctr
    FROM keyword_performance_history
    WHERE user_id = $1
      AND customer_id = $2
      AND keyword_normalized = $3
      AND date >= CURRENT_DATE - INTERVAL '${days} days'
    ORDER BY date ASC
    `,
    [userId, customerId, keywordNormalized]
  );

  return result.rows.map((row) => ({
    date: row.date,
    impressions: row.impressions,
    clicks: row.clicks,
    conversions: parseFloat(row.conversions),
    cost: parseFloat(row.cost),
    ctr: parseFloat(row.ctr || '0'),
  }));
}

// =====================================================
// Utility Functions
// =====================================================

export async function getLastSyncTime(
  userId: string,
  customerId: string
): Promise<Date | null> {
  const pool = getPool();

  const result = await pool.query<{ last_synced_at: Date }>(
    `
    SELECT MAX(last_synced_at) as last_synced_at
    FROM keyword_account_data
    WHERE user_id = $1 AND customer_id = $2
    `,
    [userId, customerId]
  );

  return result.rows[0]?.last_synced_at || null;
}

export async function getAccountKeywordCount(
  userId: string,
  customerId: string
): Promise<number> {
  const pool = getPool();

  const result = await pool.query<{ count: string }>(
    `
    SELECT COUNT(DISTINCT keyword_normalized) as count
    FROM keyword_account_data
    WHERE user_id = $1 AND customer_id = $2
    `,
    [userId, customerId]
  );

  return parseInt(result.rows[0]?.count || '0');
}

export async function getCampaignKeywordCounts(
  userId: string,
  customerId: string
): Promise<Array<{ campaignId: string; campaignName: string; count: number }>> {
  const pool = getPool();

  const result = await pool.query<{
    campaign_id: string;
    campaign_name: string;
    count: string;
  }>(
    `
    SELECT
      campaign_id,
      campaign_name,
      COUNT(DISTINCT keyword_normalized) as count
    FROM keyword_account_data
    WHERE user_id = $1 AND customer_id = $2
    GROUP BY campaign_id, campaign_name
    ORDER BY count DESC
    `,
    [userId, customerId]
  );

  return result.rows.map((row) => ({
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    count: parseInt(row.count),
  }));
}
