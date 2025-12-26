/**
 * Keyword Metrics Cache Layer
 *
 * Two-tier caching strategy:
 * 1. In-memory cache (1-hour TTL, 5000 max entries) - hot cache
 * 2. Database cache (dynamic 7/14/30-day TTL) - persistent cache
 *
 * GPT Recommendations:
 * - Dynamic TTL based on keyword popularity (7 days for popular, 30 for long-tail)
 * - Retain both caching layers for speed + persistence
 * - Monitor performance and adjust if redundancy observed
 */

import { getSupabaseClient, KeywordMetrics } from '../supabase';

// =====================================================
// In-Memory Cache (Tier 1 - Hot Cache)
// =====================================================

interface CachedEntry<T> {
  data: T;
  timestamp: number;
}

class LRUCache<T> {
  private cache: Map<string, CachedEntry<T>>;
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  set(key: string, data: T): void {
    // Remove if exists (to update timestamp)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Add new entry
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Singleton in-memory cache
const memoryCache = new LRUCache<KeywordMetrics>(5000, 3600000); // 5000 entries, 1 hour TTL

// =====================================================
// Cache Key Generation
// =====================================================

export function getCacheKey(
  keyword: string,
  locale: string = 'en-US',
  device: string = 'desktop',
  locationId: string = '2840' // Google Ads geoTargetConstant (default: US)
): string {
  const normalized = keyword.toLowerCase().trim();
  return `${normalized}:${locale}:${device}:${locationId}`;
}

export function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().trim();
}

// =====================================================
// Database Cache Operations (Tier 2 - Persistent)
// =====================================================

export interface CacheLookupOptions {
  locale?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  locationId?: string; // Google Ads geoTargetConstant (e.g., '2840' for US)
  forceRefresh?: boolean;
}

export interface CacheLookupResult {
  hits: Map<string, KeywordMetrics>;      // Keywords found in cache (fresh)
  misses: string[];                       // Keywords not in cache
  stale: Map<string, KeywordMetrics>;     // Keywords in cache but expired
}

/**
 * Batch lookup keywords from cache (memory + database)
 */
export async function batchLookupCache(
  keywords: string[],
  options: CacheLookupOptions = {}
): Promise<CacheLookupResult> {
  const { locale = 'en-US', device = 'desktop', locationId = '2840', forceRefresh = false } = options;

  const hits = new Map<string, KeywordMetrics>();
  const stale = new Map<string, KeywordMetrics>();
  const misses: string[] = [];

  // Step 1: Check in-memory cache (unless force refresh)
  if (!forceRefresh) {
    for (const keyword of keywords) {
      const cacheKey = getCacheKey(keyword, locale, device, locationId);
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        hits.set(keyword, cached);
      }
    }
  }

  // Step 2: Check database cache for remaining keywords
  const uncachedKeywords = keywords.filter(k => !hits.has(k));
  if (uncachedKeywords.length > 0) {
    const dbResults = await lookupDatabase(uncachedKeywords, locale, device, locationId, forceRefresh);

    // Merge results
    dbResults.hits.forEach((metrics, keyword) => {
      hits.set(keyword, metrics);
      // Also store in memory cache
      const cacheKey = getCacheKey(keyword, locale, device, locationId);
      memoryCache.set(cacheKey, metrics);
    });

    dbResults.stale.forEach((metrics, keyword) => stale.set(keyword, metrics));
    misses.push(...dbResults.misses);
  }

  return { hits, misses, stale };
}

/**
 * Lookup keywords in database
 */
async function lookupDatabase(
  keywords: string[],
  locale: string,
  device: string,
  locationId: string,
  forceRefresh: boolean
): Promise<CacheLookupResult> {
  // Use direct PostgreSQL connection instead of Supabase client
  // to avoid authentication issues
  const { Pool } = await import('pg');
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '38.97.60.181',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: process.env.POSTGRES_DB || 'google_ads_manager',
  });

  const normalized = keywords.map(normalizeKeyword);

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM keyword_metrics
      WHERE keyword_normalized = ANY($1::text[])
        AND locale = $2
        AND device = $3
        AND location_id = $4
      `,
      [normalized, locale, device, locationId]
    );

    const data = result.rows;

    const hits = new Map<string, KeywordMetrics>();
    const stale = new Map<string, KeywordMetrics>();
    const foundKeywords = new Set<string>();

    for (const row of data || []) {
      foundKeywords.add(row.keyword);

      const isExpired = new Date(row.expires_at) < new Date();
      if (isExpired || forceRefresh) {
        stale.set(row.keyword, row as KeywordMetrics);
      } else {
        hits.set(row.keyword, row as KeywordMetrics);
      }
    }

    const misses = keywords.filter(k => !foundKeywords.has(k));

    await pool.end();
    return { hits, stale, misses };

  } catch (error) {
    console.error('[KeywordCache] Database lookup error:', error);
    await pool.end();
    return {
      hits: new Map(),
      stale: new Map(),
      misses: keywords,
    };
  }
}

/**
 * Store keyword metrics in cache (database + memory)
 */
export async function storeInCache(metrics: KeywordMetrics): Promise<void> {
  // Use direct PostgreSQL connection
  const { Pool } = await import('pg');
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '38.97.60.181',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: process.env.POSTGRES_DB || 'google_ads_manager',
  });

  const now = new Date();
  const nowISO = now.toISOString();

  // Calculate expires_at if not provided
  const ttlDays = metrics.ttl_days || 30;
  const expiresAt = metrics.expires_at || new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Upsert to database using INSERT ... ON CONFLICT
    await pool.query(
      `
      INSERT INTO keyword_metrics (
        keyword, keyword_normalized, locale, device, location_id,
        gads_search_volume, gads_avg_cpc_micros, gads_competition, gads_competition_index,
        gads_fetched_at, gads_status, gads_error,
        moz_volume, moz_difficulty, moz_organic_ctr, moz_priority,
        moz_intent_primary, moz_intent_scores, moz_fetched_at, moz_status, moz_error,
        dataforseo_search_volume, dataforseo_cpc, dataforseo_competition, dataforseo_trends,
        dataforseo_fetched_at, dataforseo_status, dataforseo_error,
        best_search_volume, best_cpc, best_difficulty, best_intent, best_source,
        created_at, updated_at, cache_hit_count, last_accessed_at, ttl_days, expires_at, schema_version
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
        $35, $36, $37, $38, $39, $40
      )
      ON CONFLICT (keyword_normalized, locale, device, location_id)
      DO UPDATE SET
        gads_search_volume = EXCLUDED.gads_search_volume,
        gads_avg_cpc_micros = EXCLUDED.gads_avg_cpc_micros,
        gads_competition = EXCLUDED.gads_competition,
        gads_competition_index = EXCLUDED.gads_competition_index,
        gads_fetched_at = EXCLUDED.gads_fetched_at,
        gads_status = EXCLUDED.gads_status,
        moz_volume = EXCLUDED.moz_volume,
        moz_difficulty = EXCLUDED.moz_difficulty,
        moz_intent_primary = EXCLUDED.moz_intent_primary,
        dataforseo_search_volume = EXCLUDED.dataforseo_search_volume,
        dataforseo_cpc = EXCLUDED.dataforseo_cpc,
        best_search_volume = EXCLUDED.best_search_volume,
        best_cpc = EXCLUDED.best_cpc,
        best_difficulty = EXCLUDED.best_difficulty,
        best_intent = EXCLUDED.best_intent,
        best_source = EXCLUDED.best_source,
        updated_at = NOW(),
        expires_at = EXCLUDED.expires_at
      `,
      [
        metrics.keyword, metrics.keyword_normalized, metrics.locale, metrics.device, metrics.location_id,
        metrics.gads_search_volume, metrics.gads_avg_cpc_micros, metrics.gads_competition, metrics.gads_competition_index,
        metrics.gads_fetched_at, metrics.gads_status, metrics.gads_error,
        metrics.moz_volume, metrics.moz_difficulty, metrics.moz_organic_ctr, metrics.moz_priority,
        metrics.moz_intent_primary, metrics.moz_intent_scores, metrics.moz_fetched_at, metrics.moz_status, metrics.moz_error,
        metrics.dataforseo_search_volume, metrics.dataforseo_cpc, metrics.dataforseo_competition, metrics.dataforseo_trends,
        metrics.dataforseo_fetched_at, metrics.dataforseo_status, metrics.dataforseo_error,
        metrics.best_search_volume, metrics.best_cpc, metrics.best_difficulty, metrics.best_intent, metrics.best_source,
        metrics.created_at || nowISO,
        metrics.updated_at || nowISO,
        metrics.cache_hit_count || 0,
        metrics.last_accessed_at || nowISO,
        ttlDays,
        expiresAt,
        metrics.schema_version || 1
      ]
    );

    await pool.end();

    // Also store in memory cache
    const cacheKey = getCacheKey(metrics.keyword, metrics.locale, metrics.device, metrics.location_id || '2840');
    memoryCache.set(cacheKey, metrics);

  } catch (error) {
    await pool.end();
    console.error('[KeywordCache] Failed to store in database:', error);
    throw new Error(`Failed to cache keyword metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch store multiple keyword metrics
 */
export async function batchStoreInCache(metricsArray: KeywordMetrics[]): Promise<void> {
  if (metricsArray.length === 0) return;

  // Use direct PostgreSQL connection
  const { Pool } = await import('pg');
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '38.97.60.181',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: process.env.POSTGRES_DB || 'google_ads_manager',
  });

  try {
    // Build batch insert query
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    const now = new Date();
    const nowISO = now.toISOString();

    for (const metrics of metricsArray) {
      const rowPlaceholders = [];
      for (let i = 0; i < 40; i++) {
        rowPlaceholders.push(`$${paramIndex++}`);
      }
      placeholders.push(`(${rowPlaceholders.join(', ')})`);

      // Calculate expires_at if not provided
      const ttlDays = metrics.ttl_days || 30;
      const expiresAt = metrics.expires_at || new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

      values.push(
        metrics.keyword, metrics.keyword_normalized, metrics.locale, metrics.device, metrics.location_id,
        metrics.gads_search_volume, metrics.gads_avg_cpc_micros, metrics.gads_competition, metrics.gads_competition_index,
        metrics.gads_fetched_at, metrics.gads_status, metrics.gads_error,
        metrics.moz_volume, metrics.moz_difficulty, metrics.moz_organic_ctr, metrics.moz_priority,
        metrics.moz_intent_primary, metrics.moz_intent_scores, metrics.moz_fetched_at, metrics.moz_status, metrics.moz_error,
        metrics.dataforseo_search_volume, metrics.dataforseo_cpc, metrics.dataforseo_competition, metrics.dataforseo_trends,
        metrics.dataforseo_fetched_at, metrics.dataforseo_status, metrics.dataforseo_error,
        metrics.best_search_volume, metrics.best_cpc, metrics.best_difficulty, metrics.best_intent, metrics.best_source,
        metrics.created_at || nowISO,
        metrics.updated_at || nowISO,
        metrics.cache_hit_count || 0,
        metrics.last_accessed_at || nowISO,
        ttlDays,
        expiresAt,
        metrics.schema_version || 1
      );
    }

    await pool.query(
      `INSERT INTO keyword_metrics (
        keyword, keyword_normalized, locale, device, location_id,
        gads_search_volume, gads_avg_cpc_micros, gads_competition, gads_competition_index,
        gads_fetched_at, gads_status, gads_error,
        moz_volume, moz_difficulty, moz_organic_ctr, moz_priority,
        moz_intent_primary, moz_intent_scores, moz_fetched_at, moz_status, moz_error,
        dataforseo_search_volume, dataforseo_cpc, dataforseo_competition, dataforseo_trends,
        dataforseo_fetched_at, dataforseo_status, dataforseo_error,
        best_search_volume, best_cpc, best_difficulty, best_intent, best_source,
        created_at, updated_at, cache_hit_count, last_accessed_at,
        ttl_days, expires_at, schema_version
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (keyword_normalized, locale, device, location_id)
      DO UPDATE SET
        gads_search_volume = EXCLUDED.gads_search_volume,
        gads_avg_cpc_micros = EXCLUDED.gads_avg_cpc_micros,
        gads_competition = EXCLUDED.gads_competition,
        gads_competition_index = EXCLUDED.gads_competition_index,
        gads_fetched_at = EXCLUDED.gads_fetched_at,
        gads_status = EXCLUDED.gads_status,
        moz_volume = EXCLUDED.moz_volume,
        moz_difficulty = EXCLUDED.moz_difficulty,
        moz_intent_primary = EXCLUDED.moz_intent_primary,
        dataforseo_search_volume = EXCLUDED.dataforseo_search_volume,
        dataforseo_cpc = EXCLUDED.dataforseo_cpc,
        best_search_volume = EXCLUDED.best_search_volume,
        best_cpc = EXCLUDED.best_cpc,
        best_difficulty = EXCLUDED.best_difficulty,
        best_intent = EXCLUDED.best_intent,
        best_source = EXCLUDED.best_source,
        updated_at = NOW(),
        expires_at = EXCLUDED.expires_at`,
      values
    );

    await pool.end();

    // Also store in memory cache
    for (const metrics of metricsArray) {
      const cacheKey = getCacheKey(metrics.keyword, metrics.locale, metrics.device, metrics.location_id || '2840');
      memoryCache.set(cacheKey, metrics);
    }
  } catch (error) {
    await pool.end();
    console.error('[KeywordCache] Failed to batch store in database:', error);
    throw new Error(`Failed to batch cache keyword metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Increment cache hit count (triggers dynamic TTL recalculation)
 */
export async function incrementCacheHit(
  keyword: string,
  locale: string = 'en-US',
  device: string = 'desktop',
  locationId: string = '2840'
): Promise<void> {
  const client = getSupabaseClient();
  const normalized = normalizeKeyword(keyword);

  // First, get current hit count
  const { data: current, error: fetchError } = await client
    .from('keyword_metrics')
    .select('cache_hit_count')
    .eq('keyword_normalized', normalized)
    .eq('locale', locale)
    .eq('device', device)
    .eq('location_id', locationId)
    .single();

  if (fetchError || !current) {
    console.error('[KeywordCache] Failed to fetch for increment:', fetchError);
    return;
  }

  // Increment cache_hit_count (triggers dynamic TTL update via trigger)
  const { error } = await client
    .from('keyword_metrics')
    .update({
      cache_hit_count: current.cache_hit_count + 1,
      last_accessed_at: new Date().toISOString(),
      // expires_at updated by trigger
    })
    .eq('keyword_normalized', normalized)
    .eq('locale', locale)
    .eq('device', device)
    .eq('location_id', locationId);

  if (error) {
    console.error('[KeywordCache] Failed to increment hit count:', error);
  }
}

/**
 * Get keywords needing proactive refresh (expiring soon + popular)
 */
export async function getKeywordsNeedingRefresh(limit: number = 100): Promise<KeywordMetrics[]> {
  const client = getSupabaseClient();

  // Call database function (from migration 004)
  const { data, error } = await client.rpc('keyword_metrics_needing_refresh', {
    p_limit: limit
  });

  if (error) {
    console.error('[KeywordCache] Failed to get keywords needing refresh:', error);
    return [];
  }

  return data || [];
}

/**
 * Cleanup expired, unused keywords
 */
export async function cleanupExpiredCache(): Promise<number> {
  const client = getSupabaseClient();

  // Call database function (from migration 004)
  const { data, error } = await client.rpc('cleanup_expired_keyword_metrics');

  if (error) {
    console.error('[KeywordCache] Failed to cleanup expired cache:', error);
    return 0;
  }

  const deletedCount = data as number;
  console.log(`[KeywordCache] Cleaned up ${deletedCount} expired keywords`);

  return deletedCount;
}

/**
 * Clear in-memory cache (for testing)
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
  console.log('[KeywordCache] In-memory cache cleared');
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  memorySize: number;
  databaseSize: number;
  popularKeywords: number;
  expiredKeywords: number;
}> {
  const client = getSupabaseClient();

  // Get database stats
  const { count: totalCount } = await client
    .from('keyword_metrics')
    .select('*', { count: 'exact', head: true });

  const { count: popularCount } = await client
    .from('keyword_metrics')
    .select('*', { count: 'exact', head: true })
    .gt('cache_hit_count', 10);

  const { count: expiredCount } = await client
    .from('keyword_metrics')
    .select('*', { count: 'exact', head: true })
    .lt('expires_at', new Date().toISOString());

  return {
    memorySize: memoryCache.size(),
    databaseSize: totalCount || 0,
    popularKeywords: popularCount || 0,
    expiredKeywords: expiredCount || 0,
  };
}
