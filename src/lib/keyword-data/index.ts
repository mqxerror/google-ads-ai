/**
 * Keyword Data Orchestration Layer
 *
 * Main entry point for enriching keywords with external API data.
 * Coordinates caching, API calls, and metric merging.
 *
 * Flow:
 * 1. Check cache (in-memory + database)
 * 2. Fetch from Google Ads Keyword Planner (primary source)
 * 3. Fetch from Google APIs (Trends, YouTube, NLP)
 * 4. Optionally fetch from Moz (difficulty, intent)
 * 5. Optionally fetch from DataForSEO (fallback/supplement)
 * 6. Merge metrics with priority: Google Ads > DataForSEO > Moz
 * 7. Calculate opportunity scores (including Trends, YouTube, NLP data)
 * 8. Store in cache with dynamic TTL
 * 9. Return enriched keywords with stats
 */

import { fetchKeywordPlannerMetrics } from '../google-ads';
import { fetchDataForSEOMetrics } from './dataforseo';
import { fetchKeywordMetrics as fetchMozMetrics } from '../moz';
import { getMozCircuitBreaker } from './circuit-breaker';
import { enrichWithGoogleAPIs, calculateCompositeScore, type EnrichedKeywordData } from '../google-apis/orchestrator';
import {
  batchLookupCache,
  batchStoreInCache,
  normalizeKeyword,
  incrementCacheHit,
} from './cache';
import type {
  EnrichmentOptions,
  EnrichmentResult,
  EnrichedKeyword,
  GoogleAdsKeywordMetrics,
  DataForSEOKeywordMetrics,
} from './types';
import type { KeywordMetrics } from '../supabase';

/**
 * Enrich keywords with metrics from external APIs
 * Uses caching and circuit breakers for cost efficiency and reliability
 */
export async function enrichKeywordsWithMetrics(
  keywords: string[],
  options: EnrichmentOptions & {
    refreshToken?: string;
    customerId?: string;
    loginCustomerId?: string;
    mozToken?: string;
    locationId?: string; // NEW: Google Ads geoTargetConstant (e.g., '2840' for US)
  } = {}
): Promise<EnrichmentResult> {
  const {
    locale = 'en-US',
    device = 'desktop',
    providers = ['google_ads'],
    useCache = true,
    forceRefresh = false,
    maxRetries = 2,
    refreshToken,
    customerId,
    loginCustomerId,
    mozToken,
    locationId = '2840', // NEW: Default to US
  } = options;

  const stats = {
    totalRequested: keywords.length,
    cached: 0,
    googleFetched: 0,
    mozFetched: 0,
    dataForSeoFetched: 0,
    failed: 0,
    creditsUsed: 0,
    errors: [] as Array<{ keyword: string; provider: string; error: string }>,
  };

  // Step 1: Check cache (unless force refresh)
  let cacheHits = new Map<string, EnrichedKeyword>();
  let keywordsToFetch: string[] = [];

  if (useCache && !forceRefresh) {
    console.log('[KeywordEnrichment] Checking cache for', keywords.length, 'keywords');
    const cacheResult = await batchLookupCache(keywords, { locale, device, locationId });

    // Convert cached KeywordMetrics to EnrichedKeyword
    for (const [keyword, cachedMetric] of cacheResult.hits) {
      cacheHits.set(keyword, convertToEnrichedKeyword(cachedMetric));
      // Increment cache hit count for dynamic TTL
      await incrementCacheHit(keyword, locale, device, locationId);
    }

    // CRITICAL FIX: Include stale entries in keywords to fetch
    // Stale = expired cache entries that need fresh data
    const staleKeywords = Array.from(cacheResult.stale.keys());
    keywordsToFetch = [...cacheResult.misses, ...staleKeywords];
    stats.cached = cacheHits.size;

    console.log(`[KeywordEnrichment] Cache: ${cacheHits.size} hits, ${staleKeywords.length} stale (need refresh), ${cacheResult.misses.length} misses`);
  } else {
    keywordsToFetch = keywords;
  }

  const enriched = new Map<string, EnrichedKeyword>(cacheHits);

  // If all keywords were cached, return early
  if (keywordsToFetch.length === 0) {
    return { enriched, stats };
  }

  // Step 2: Fetch from Google Ads (primary source)
  console.log('[KeywordEnrichment] DEBUG - Step 2 Google Ads:', {
    hasGoogleAdsProvider: providers.includes('google_ads'),
    hasRefreshToken: !!refreshToken,
    hasCustomerId: !!customerId,
    providers: providers,
    keywordsToFetchCount: keywordsToFetch.length,
    keywordsToFetch: keywordsToFetch,
  });

  if (providers.includes('google_ads') && refreshToken && customerId) {
    try {
      console.log('[KeywordEnrichment] ✓ Calling Google Ads API for', keywordsToFetch.length, 'keywords:', keywordsToFetch);

      const googleMetrics = await fetchKeywordPlannerMetrics(
        refreshToken,
        customerId,
        keywordsToFetch,
        loginCustomerId,
        locale,
        locationId // NEW: Pass location for geo-targeted metrics
      );

      stats.googleFetched = googleMetrics.length;

      // Convert to EnrichedKeyword and add to map
      for (const metric of googleMetrics) {
        const existing = enriched.get(metric.keyword);
        if (existing) {
          // Merge Google data into existing
          mergeGoogleAdsMetrics(existing, metric);
        } else {
          enriched.set(metric.keyword, {
            keyword: metric.keyword,
            metrics: {
              searchVolume: metric.monthlySearchVolume,
              cpc: metric.avgCpcMicros / 1_000_000,
              competition: metric.competition,
              difficulty: null,
              organicCtr: null,
              priority: null,
              intent: null,
              intentScores: null,
              dataSource: 'google_ads',
              lastUpdated: new Date().toISOString(),
              cacheAge: 0,
            },
          });
        }
      }

      console.log(`[KeywordEnrichment] Google Ads: ${googleMetrics.length} keywords enriched`);
    } catch (error) {
      console.error('[KeywordEnrichment] Google Ads error:', error);
      stats.errors.push({
        keyword: 'batch',
        provider: 'google_ads',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Step 3: Fetch from Google APIs (Trends, YouTube, NLP)
  let googleApisData = new Map<string, EnrichedKeywordData>();

  try {
    console.log('[KeywordEnrichment] Fetching Google APIs data (Trends, YouTube, NLP)');

    // Get country code from locationId (simplified mapping)
    const countryMap: Record<string, string> = {
      '2840': 'US', // United States
      '2826': 'GB', // United Kingdom
      '2124': 'CA', // Canada
      '2036': 'AU', // Australia
    };
    const geo = countryMap[locationId] || 'US';

    googleApisData = await enrichWithGoogleAPIs(
      Array.from(enriched.keys()), // Enrich all keywords we have so far
      {
        useTrends: true,
        useYouTube: true,
        useNLP: true,
        youtubeApiKey: process.env.YOUTUBE_API_KEY,
        nlpApiKey: process.env.GOOGLE_NLP_API_KEY,
        geo,
        useCache: true,
      }
    );

    console.log(`[KeywordEnrichment] Google APIs: ${googleApisData.size} keywords enriched with Trends/YouTube/NLP`);
  } catch (error) {
    console.error('[KeywordEnrichment] Google APIs error:', error);
    stats.errors.push({
      keyword: 'batch',
      provider: 'google_apis',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Step 4: Fetch from Moz (difficulty, intent) in parallel if requested
  if (providers.includes('moz') && mozToken) {
    try {
      console.log('[KeywordEnrichment] Fetching from Moz:', keywordsToFetch.length, 'keywords');

      const mozBreaker = getMozCircuitBreaker();

      const mozResults = await mozBreaker.execute(async () => {
        // Fetch metrics for each keyword (Moz doesn't support batch for metrics)
        const results = await Promise.all(
          keywordsToFetch.slice(0, 50).map(async (keyword) => {
            try {
              const metrics = await fetchMozMetrics(keyword, { locale, device, token: mozToken });
              return { keyword, metrics };
            } catch (error) {
              return { keyword, metrics: null, error };
            }
          })
        );
        return results;
      });

      stats.mozFetched = mozResults.filter(r => r.metrics).length;
      stats.creditsUsed += keywordsToFetch.slice(0, 50).length; // Moz charges per keyword

      // Merge Moz data
      for (const result of mozResults) {
        if (result.metrics) {
          const existing = enriched.get(result.keyword);
          if (existing && existing.metrics) {
            // Supplement with Moz data
            existing.metrics.difficulty = result.metrics.difficulty;
            existing.metrics.organicCtr = result.metrics.organicCtr;
            existing.metrics.priority = result.metrics.priority;

            // If no volume from Google, use Moz
            if (!existing.metrics.searchVolume && result.metrics.volume) {
              existing.metrics.searchVolume = result.metrics.volume;
              existing.metrics.dataSource = 'moz';
            }
          } else {
            // Create new entry with Moz data only
            enriched.set(result.keyword, {
              keyword: result.keyword,
              metrics: {
                searchVolume: result.metrics.volume,
                cpc: null,
                competition: null,
                difficulty: result.metrics.difficulty,
                organicCtr: result.metrics.organicCtr,
                priority: result.metrics.priority,
                intent: null,
                intentScores: null,
                dataSource: 'moz',
                lastUpdated: new Date().toISOString(),
                cacheAge: 0,
              },
            });
          }
        }
      }

      console.log(`[KeywordEnrichment] Moz: ${stats.mozFetched} keywords enriched`);
    } catch (error) {
      console.error('[KeywordEnrichment] Moz error:', error);
      stats.errors.push({
        keyword: 'batch',
        provider: 'moz',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Step 4: Fetch from DataForSEO (fallback) if requested
  if (providers.includes('dataforseo')) {
    try {
      // Only fetch for keywords missing Google data
      const keywordsMissingData = keywordsToFetch.filter(kw => {
        const existing = enriched.get(kw);
        return !existing || !existing.metrics?.searchVolume;
      });

      if (keywordsMissingData.length > 0) {
        console.log('[KeywordEnrichment] Fetching from DataForSEO:', keywordsMissingData.length, 'keywords');

        const dataForSeoMetrics = await fetchDataForSEOMetrics(
          keywordsMissingData,
          parseInt(locationId) || 2840, // Convert string to number, default to US
          locale.split('-')[0] // Extract language code (e.g., 'en' from 'en-US')
        );

        stats.dataForSeoFetched = dataForSeoMetrics.filter(m => m.searchVolume > 0).length;

        // Merge DataForSEO data
        for (const metric of dataForSeoMetrics) {
          const existing = enriched.get(metric.keyword);
          if (existing && existing.metrics) {
            // Supplement missing data
            if (!existing.metrics.searchVolume) {
              existing.metrics.searchVolume = metric.searchVolume;
            }
            if (!existing.metrics.cpc) {
              existing.metrics.cpc = metric.cpc;
            }
            if (!existing.metrics.competition) {
              existing.metrics.competition = metric.competition > 0.7 ? 'HIGH' : metric.competition > 0.3 ? 'MEDIUM' : 'LOW';
            }
          } else {
            // Create new entry
            enriched.set(metric.keyword, {
              keyword: metric.keyword,
              metrics: {
                searchVolume: metric.searchVolume,
                cpc: metric.cpc,
                competition: metric.competition > 0.7 ? 'HIGH' : metric.competition > 0.3 ? 'MEDIUM' : 'LOW',
                difficulty: null,
                organicCtr: null,
                priority: null,
                intent: null,
                intentScores: null,
                dataSource: 'dataforseo',
                lastUpdated: new Date().toISOString(),
                cacheAge: 0,
              },
            });
          }
        }

        console.log(`[KeywordEnrichment] DataForSEO: ${stats.dataForSeoFetched} keywords enriched`);
      }
    } catch (error) {
      console.error('[KeywordEnrichment] DataForSEO error:', error);
      stats.errors.push({
        keyword: 'batch',
        provider: 'dataforseo',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Step 5: Calculate opportunity scores (including Google APIs data)
  for (const [keyword, data] of enriched) {
    if (data.metrics) {
      // Get Google APIs enrichment data for this keyword
      const googleApiData = googleApisData.get(keyword);

      // Use composite score if we have Google APIs data, otherwise use basic score
      if (googleApiData) {
        data.opportunityScore = calculateCompositeScore(googleApiData, {
          searchVolume: data.metrics.searchVolume || 0,
          cpc: data.metrics.cpc || 0,
          competition: data.metrics.competition || 'MEDIUM',
        });
      } else {
        data.opportunityScore = calculateOpportunityScore(data.metrics);
      }

      // Store Google APIs data for caching
      if (googleApiData) {
        (data as any).googleApisData = googleApiData;
      }
    }
  }

  // Step 6: Store newly fetched keywords in cache
  const keywordsToCache: Partial<KeywordMetrics>[] = [];

  for (const keyword of keywordsToFetch) {
    const enrichedData = enriched.get(keyword);
    if (enrichedData && enrichedData.metrics) {
      keywordsToCache.push(convertToKeywordMetrics(keyword, enrichedData, locale, device, locationId));
    }
  }

  if (keywordsToCache.length > 0 && useCache) {
    try {
      await batchStoreInCache(keywordsToCache as KeywordMetrics[]);
      console.log(`[KeywordEnrichment] Cached ${keywordsToCache.length} keywords`);
    } catch (error) {
      console.error('[KeywordEnrichment] Cache storage error:', error);
    }
  }

  // Step 7: Add null metrics for keywords that failed completely
  for (const keyword of keywords) {
    if (!enriched.has(keyword)) {
      enriched.set(keyword, {
        keyword,
        metrics: null,
      });
      stats.failed++;
    }
  }

  return { enriched, stats };
}

/**
 * Convert cached KeywordMetrics to EnrichedKeyword
 */
function convertToEnrichedKeyword(cached: KeywordMetrics): EnrichedKeyword {
  const now = new Date();
  const lastUpdated = new Date(cached.updated_at);
  const cacheAge = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

  // Convert PostgreSQL DECIMAL strings to numbers
  const cpc = cached.best_cpc ? parseFloat(cached.best_cpc as any) : null;
  const difficulty = cached.moz_difficulty ? parseFloat(cached.moz_difficulty as any) : null;
  const organicCtr = cached.moz_organic_ctr ? parseFloat(cached.moz_organic_ctr as any) : null;
  const priority = cached.moz_priority ? parseFloat(cached.moz_priority as any) : null;

  return {
    keyword: cached.keyword,
    metrics: {
      searchVolume: cached.best_search_volume,
      cpc,
      competition: cached.gads_competition || null,
      difficulty,
      organicCtr,
      priority,
      intent: cached.moz_intent_primary,
      intentScores: cached.moz_intent_scores,
      dataSource: cached.best_source as any,
      lastUpdated: cached.updated_at,
      cacheAge,
    },
    opportunityScore: calculateOpportunityScore({
      searchVolume: cached.best_search_volume,
      cpc,
      competition: cached.gads_competition,
      difficulty,
      organicCtr,
      priority,
      intent: cached.moz_intent_primary,
      intentScores: cached.moz_intent_scores,
      dataSource: cached.best_source as any,
      lastUpdated: cached.updated_at,
      cacheAge,
    }),
  };
}

/**
 * Merge Google Ads metrics into existing enriched keyword
 */
function mergeGoogleAdsMetrics(
  existing: EnrichedKeyword,
  googleMetric: GoogleAdsKeywordMetrics
): void {
  if (!existing.metrics) {
    existing.metrics = {
      searchVolume: null,
      cpc: null,
      competition: null,
      difficulty: null,
      organicCtr: null,
      priority: null,
      intent: null,
      intentScores: null,
      dataSource: 'unavailable',
      lastUpdated: new Date().toISOString(),
      cacheAge: 0,
    };
  }

  existing.metrics.searchVolume = googleMetric.monthlySearchVolume;
  existing.metrics.cpc = googleMetric.avgCpcMicros / 1_000_000;
  existing.metrics.competition = googleMetric.competition;
  existing.metrics.dataSource = 'google_ads';
  existing.metrics.lastUpdated = new Date().toISOString();
}

/**
 * Convert EnrichedKeyword to KeywordMetrics for caching
 */
function convertToKeywordMetrics(
  keyword: string,
  enriched: EnrichedKeyword,
  locale: string,
  device: 'desktop' | 'mobile' | 'tablet',
  locationId: string
): Partial<KeywordMetrics> {
  const metrics = enriched.metrics;
  const googleApisData = (enriched as any).googleApisData as EnrichedKeywordData | undefined;

  if (!metrics) {
    return {
      keyword,
      keyword_normalized: normalizeKeyword(keyword),
      locale,
      device: device as 'desktop' | 'mobile' | 'tablet',
      location_id: locationId,
      schema_version: '1',
    };
  }

  // Build base metrics object
  const baseMetrics = {
    keyword,
    keyword_normalized: normalizeKeyword(keyword),
    locale,
    device: device as 'desktop' | 'mobile' | 'tablet',
    location_id: locationId,
    gads_search_volume: metrics.dataSource === 'google_ads' ? metrics.searchVolume : null,
    gads_avg_cpc_micros: metrics.dataSource === 'google_ads' && metrics.cpc ? Math.round(metrics.cpc * 1_000_000) : null,
    gads_competition: metrics.dataSource === 'google_ads' ? metrics.competition : null,
    gads_status: metrics.dataSource === 'google_ads' ? 'success' : null,
    moz_difficulty: metrics.difficulty,
    moz_organic_ctr: metrics.organicCtr,
    moz_priority: metrics.priority,
    moz_intent_primary: metrics.intent,
    moz_intent_scores: metrics.intentScores,
    moz_status: metrics.difficulty !== null ? 'success' : null,
    dataforseo_search_volume: metrics.dataSource === 'dataforseo' ? metrics.searchVolume : null,
    dataforseo_cpc: metrics.dataSource === 'dataforseo' ? metrics.cpc : null,
    dataforseo_status: metrics.dataSource === 'dataforseo' ? 'success' : null,
    best_search_volume: metrics.searchVolume,
    best_cpc: metrics.cpc,
    best_source: metrics.dataSource,
    cache_hit_count: 0,
    ttl_days: 30,
    schema_version: '1',
  };

  // Add Google APIs data if available
  if (googleApisData) {
    return {
      ...baseMetrics,
      // Google Trends
      trends_interest_score: googleApisData.trends?.interestScore || null,
      trends_direction: googleApisData.trends?.direction || null,
      trends_peak_interest: googleApisData.trends?.trendingScore || null,
      trends_peak_month: googleApisData.trends?.peakMonth || null,
      trends_fetched_at: new Date(),
      trends_status: googleApisData.trends ? 'success' : 'pending',
      // YouTube
      youtube_video_count: googleApisData.youtube?.videoCount || null,
      youtube_avg_views: googleApisData.youtube?.avgViews || null,
      youtube_top_tags: googleApisData.youtube?.topTags || null,
      youtube_content_gap: googleApisData.youtube?.contentGap || false,
      youtube_fetched_at: new Date(),
      youtube_status: googleApisData.youtube ? 'success' : 'pending',
      // Google NLP
      nlp_intent: googleApisData.nlp?.intent || null,
      nlp_intent_confidence: googleApisData.nlp?.intentConfidence || null,
      nlp_entities: googleApisData.nlp?.entities ? JSON.parse(JSON.stringify(googleApisData.nlp.entities)) : null,
      nlp_fetched_at: new Date(),
      nlp_status: googleApisData.nlp ? 'success' : 'pending',
    } as any;
  }

  return baseMetrics as any;
}

/**
 * Calculate opportunity score (0-100)
 * Factors: search volume, competition, CPC, difficulty
 */
function calculateOpportunityScore(metrics: {
  searchVolume: number | null;
  cpc: number | null;
  competition: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  difficulty: number | null;
  organicCtr: number | null;
  priority: number | null;
  intent: string | null;
  intentScores: Record<string, number> | null;
  dataSource: string;
  lastUpdated: string;
  cacheAge: number;
}): number {
  let score = 0;

  // Volume score (0-40 points): higher is better
  if (metrics.searchVolume) {
    if (metrics.searchVolume >= 10000) score += 40;
    else if (metrics.searchVolume >= 1000) score += 30;
    else if (metrics.searchVolume >= 100) score += 20;
    else score += 10;
  }

  // Competition score (0-20 points): lower is better
  if (metrics.competition) {
    if (metrics.competition === 'LOW') score += 20;
    else if (metrics.competition === 'MEDIUM') score += 10;
    else score += 5;
  }

  // Difficulty score (0-20 points): lower is better (Moz difficulty 0-100)
  if (metrics.difficulty !== null) {
    if (metrics.difficulty < 30) score += 20;
    else if (metrics.difficulty < 50) score += 15;
    else if (metrics.difficulty < 70) score += 10;
    else score += 5;
  }

  // CPC/Value score (0-20 points): moderate CPC is best (indicates commercial intent)
  if (metrics.cpc) {
    if (metrics.cpc >= 1 && metrics.cpc <= 5) score += 20;
    else if (metrics.cpc > 5) score += 15;
    else if (metrics.cpc > 0.5) score += 10;
    else score += 5;
  }

  return Math.min(100, score);
}
