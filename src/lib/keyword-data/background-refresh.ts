/**
 * Background Refresh Job
 *
 * Proactively refreshes popular keywords before cache expiration
 * to ensure high-quality data for frequently-accessed keywords.
 *
 * Strategy:
 * - Identify keywords with high cache_hit_count (popular)
 * - Refresh keywords within 2 days of expiration
 * - Process in small batches to avoid rate limits
 * - Update cache_hit_count to maintain dynamic TTL
 */

import { getSupabaseClient } from '../supabase';
import { enrichKeywordsWithMetrics } from './index';
import type { RefreshJob } from './types';

// Configuration
const REFRESH_THRESHOLD_DAYS = 2; // Refresh if expiring within 2 days
const MIN_CACHE_HITS = 5; // Only refresh keywords with 5+ cache hits
const BATCH_SIZE = 50; // Process 50 keywords at a time
const MAX_KEYWORDS_PER_RUN = 200; // Limit per job run

/**
 * Identify keywords that need proactive refresh
 * Returns keywords that:
 * - Have high cache hit count (popular)
 * - Are expiring soon (within REFRESH_THRESHOLD_DAYS)
 */
export async function identifyKeywordsForRefresh(): Promise<Array<{
  keyword: string;
  locale: string;
  device: string;
  cacheHitCount: number;
  expiresAt: string;
  daysUntilExpiration: number;
}>> {
  const client = getSupabaseClient();

  try {
    // Query keywords that are:
    // 1. Popular (cache_hit_count >= MIN_CACHE_HITS)
    // 2. Expiring soon (expires_at within REFRESH_THRESHOLD_DAYS)
    // 3. Not already stale
    const now = new Date();
    const refreshThreshold = new Date(now.getTime() + REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    const { data, error } = await client
      .from('keyword_metrics')
      .select('keyword, locale, device, cache_hit_count, expires_at')
      .gte('cache_hit_count', MIN_CACHE_HITS)
      .gte('expires_at', now.toISOString())
      .lte('expires_at', refreshThreshold.toISOString())
      .order('cache_hit_count', { ascending: false })
      .limit(MAX_KEYWORDS_PER_RUN);

    if (error) {
      console.error('[BackgroundRefresh] Error querying keywords:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[BackgroundRefresh] No keywords need refresh at this time');
      return [];
    }

    // Calculate days until expiration
    const keywords = data.map(row => {
      const expiresAt = new Date(row.expires_at);
      const daysUntilExpiration = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        keyword: row.keyword,
        locale: row.locale,
        device: row.device,
        cacheHitCount: row.cache_hit_count,
        expiresAt: row.expires_at,
        daysUntilExpiration,
      };
    });

    console.log(`[BackgroundRefresh] Identified ${keywords.length} keywords for refresh`);
    return keywords;
  } catch (error) {
    console.error('[BackgroundRefresh] Unexpected error:', error);
    return [];
  }
}

/**
 * Run background refresh job
 * Returns job status and results
 */
export async function runBackgroundRefresh(options: {
  refreshToken?: string;
  customerId?: string;
  loginCustomerId?: string;
  mozToken?: string;
  providers?: ('google_ads' | 'moz' | 'dataforseo')[];
  dryRun?: boolean;
} = {}): Promise<RefreshJob> {
  const {
    refreshToken,
    customerId,
    loginCustomerId,
    mozToken,
    providers = ['google_ads'],
    dryRun = false,
  } = options;

  const job: RefreshJob = {
    id: `refresh-${Date.now()}`,
    keywords: [],
    status: 'running',
    startedAt: new Date(),
    completedAt: null,
    refreshedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // Step 1: Identify keywords to refresh
    const keywordsToRefresh = await identifyKeywordsForRefresh();

    if (keywordsToRefresh.length === 0) {
      job.status = 'completed';
      job.completedAt = new Date();
      return job;
    }

    job.keywords = keywordsToRefresh.map(k => k.keyword);

    console.log(`[BackgroundRefresh] Starting refresh for ${job.keywords.length} keywords`);
    console.log(`[BackgroundRefresh] Dry run: ${dryRun}`);

    if (dryRun) {
      // In dry run mode, just return what would be refreshed
      job.status = 'completed';
      job.completedAt = new Date();
      console.log('[BackgroundRefresh] Dry run completed. Keywords that would be refreshed:', job.keywords);
      return job;
    }

    // Step 2: Process in batches
    const batches: string[][] = [];
    for (let i = 0; i < job.keywords.length; i += BATCH_SIZE) {
      batches.push(job.keywords.slice(i, i + BATCH_SIZE));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[BackgroundRefresh] Processing batch ${i + 1}/${batches.length} (${batch.length} keywords)`);

      try {
        // Get locale and device from first keyword in batch (assume same for batch)
        const firstKeywordMeta = keywordsToRefresh.find(k => k.keyword === batch[0]);
        const locale = firstKeywordMeta?.locale || 'en-US';
        const device = (firstKeywordMeta?.device || 'desktop') as 'desktop' | 'mobile' | 'tablet';

        // Enrich keywords (force refresh from APIs)
        const result = await enrichKeywordsWithMetrics(batch, {
          locale,
          device,
          providers,
          useCache: true,
          forceRefresh: true, // Force API call even if cached
          refreshToken,
          customerId,
          loginCustomerId,
          mozToken,
        });

        // Count successes and failures
        for (const [keyword, enriched] of result.enriched) {
          if (enriched.metrics && enriched.metrics.searchVolume !== null) {
            job.refreshedCount++;
          } else {
            job.failedCount++;
            job.errors.push(`Failed to refresh: ${keyword}`);
          }
        }

        console.log(`[BackgroundRefresh] Batch ${i + 1} complete: ${job.refreshedCount} refreshed, ${job.failedCount} failed`);

        // Rate limiting: small delay between batches
        if (i < batches.length - 1) {
          await delay(2000); // 2 second delay
        }
      } catch (error) {
        console.error(`[BackgroundRefresh] Error processing batch ${i + 1}:`, error);
        job.failedCount += batch.length;
        job.errors.push(`Batch ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();

    console.log(`[BackgroundRefresh] Job completed: ${job.refreshedCount} refreshed, ${job.failedCount} failed`);
    return job;
  } catch (error) {
    console.error('[BackgroundRefresh] Job failed:', error);
    job.status = 'failed';
    job.completedAt = new Date();
    job.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return job;
  }
}

/**
 * Get refresh job recommendations
 * Returns stats about cache health and refresh needs
 */
export async function getRefreshRecommendations(): Promise<{
  totalKeywords: number;
  popular: number; // cache_hit_count >= 10
  expiringWithin2Days: number;
  expiringWithin7Days: number;
  stale: number;
  recommendRefreshNow: boolean;
}> {
  const client = getSupabaseClient();

  try {
    const now = new Date();
    const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Total keywords
    const { count: totalKeywords } = await client
      .from('keyword_metrics')
      .select('*', { count: 'exact', head: true });

    // Popular keywords (cache_hit_count >= 10)
    const { count: popular } = await client
      .from('keyword_metrics')
      .select('*', { count: 'exact', head: true })
      .gte('cache_hit_count', 10);

    // Expiring within 2 days
    const { count: expiringWithin2Days } = await client
      .from('keyword_metrics')
      .select('*', { count: 'exact', head: true })
      .gte('cache_hit_count', MIN_CACHE_HITS)
      .gte('expires_at', now.toISOString())
      .lte('expires_at', in2Days.toISOString());

    // Expiring within 7 days
    const { count: expiringWithin7Days } = await client
      .from('keyword_metrics')
      .select('*', { count: 'exact', head: true })
      .gte('cache_hit_count', MIN_CACHE_HITS)
      .gte('expires_at', now.toISOString())
      .lte('expires_at', in7Days.toISOString());

    // Stale (already expired)
    const { count: stale } = await client
      .from('keyword_metrics')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', now.toISOString());

    const recommendRefreshNow = (expiringWithin2Days || 0) > 20;

    return {
      totalKeywords: totalKeywords || 0,
      popular: popular || 0,
      expiringWithin2Days: expiringWithin2Days || 0,
      expiringWithin7Days: expiringWithin7Days || 0,
      stale: stale || 0,
      recommendRefreshNow,
    };
  } catch (error) {
    console.error('[BackgroundRefresh] Error getting recommendations:', error);
    return {
      totalKeywords: 0,
      popular: 0,
      expiringWithin2Days: 0,
      expiringWithin7Days: 0,
      stale: 0,
      recommendRefreshNow: false,
    };
  }
}

/**
 * Cleanup stale keywords
 * Removes expired keywords with low cache hit counts
 */
export async function cleanupStaleKeywords(minCacheHits: number = 3): Promise<number> {
  const client = getSupabaseClient();

  try {
    const now = new Date();

    // Delete keywords that:
    // - Are expired (expires_at < now)
    // - Have low cache hit count (< minCacheHits)
    const { error, count } = await client
      .from('keyword_metrics')
      .delete({ count: 'exact' })
      .lt('expires_at', now.toISOString())
      .lt('cache_hit_count', minCacheHits);

    if (error) {
      console.error('[BackgroundRefresh] Error cleaning up stale keywords:', error);
      return 0;
    }

    console.log(`[BackgroundRefresh] Cleaned up ${count || 0} stale keywords`);
    return count || 0;
  } catch (error) {
    console.error('[BackgroundRefresh] Unexpected error during cleanup:', error);
    return 0;
  }
}

/**
 * Delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
