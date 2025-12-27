/**
 * Google APIs Orchestrator
 *
 * Coordinates enrichment across multiple free Google APIs:
 * - Google Autocomplete (keyword expansion)
 * - Google Trends (trending indicators)
 * - YouTube API (video opportunities)
 * - Google NLP (intent classification)
 *
 * Manages caching, rate limiting, and quota across all sources
 */

import { batchGetGoogleTrendsData, getTrendingScore, type TrendsData } from './trends';
import { batchGetYouTubeData, type YouTubeKeywordData } from './youtube';
import { batchClassifyIntent, type NLPData } from './nlp';

export interface GoogleApisEnrichmentOptions {
  // Which APIs to use
  useTrends?: boolean;
  useYouTube?: boolean;
  useNLP?: boolean;

  // API keys (optional, will fallback gracefully)
  youtubeApiKey?: string;
  nlpApiKey?: string;

  // Limits (for quota management)
  maxTrendsKeywords?: number;
  maxYouTubeKeywords?: number;
  maxNLPKeywords?: number;

  // Geographic targeting
  geo?: string; // Country code for Trends

  // Caching
  useCache?: boolean;
}

export interface EnrichedKeywordData {
  keyword: string;

  // From Google Trends
  trends?: {
    direction: 'rising' | 'declining' | 'stable' | 'breakout';
    interestScore: number; // 0-100
    trendingScore: number; // 0-100 (composite)
    peakMonth?: string;
  };

  // From YouTube
  youtube?: {
    videoCount: number;
    avgViews: number;
    topTags: string[];
    contentGap: boolean;
    gapScore: number;
  };

  // From NLP
  nlp?: {
    intent: 'transactional' | 'informational' | 'commercial' | 'navigational';
    intentConfidence: number;
    entities: Array<{ name: string; type: string }>;
  };
}

/**
 * Enrich keywords with data from all Google APIs
 */
export async function enrichWithGoogleAPIs(
  keywords: string[],
  options: GoogleApisEnrichmentOptions = {}
): Promise<Map<string, EnrichedKeywordData>> {
  const {
    useTrends = true,
    useYouTube = true,
    useNLP = true,
    youtubeApiKey,
    nlpApiKey,
    maxTrendsKeywords = 200, // Unlimited but rate limited
    maxYouTubeKeywords = 50, // 100 searches/day free
    maxNLPKeywords = 100, // 5K/month free
    geo = '',
    useCache = true,
  } = options;

  const results = new Map<string, EnrichedKeywordData>();

  // Initialize all keywords
  keywords.forEach(keyword => {
    results.set(keyword, { keyword });
  });

  console.log(`[Google APIs] Enriching ${keywords.length} keywords with multiple sources...`);

  // Fetch from all APIs in parallel
  const promises: Promise<any>[] = [];

  // Google Trends
  if (useTrends) {
    const trendsPromise = batchGetGoogleTrendsData(
      keywords.slice(0, maxTrendsKeywords),
      { geo }
    ).then(trendsData => {
      trendsData.forEach((data, keyword) => {
        const existing = results.get(keyword);
        if (existing) {
          existing.trends = {
            direction: data.direction,
            interestScore: data.avgInterest,
            trendingScore: getTrendingScore(data),
            peakMonth: data.peakMonth,
          };
        }
      });
      console.log(`[Google APIs] ✓ Trends: ${trendsData.size} keywords enriched`);
    });
    promises.push(trendsPromise);
  }

  // YouTube API
  if (useYouTube) {
    const youtubePromise = batchGetYouTubeData(
      keywords.slice(0, maxYouTubeKeywords),
      { apiKey: youtubeApiKey }
    ).then(youtubeData => {
      youtubeData.forEach((data, keyword) => {
        const existing = results.get(keyword);
        if (existing) {
          existing.youtube = {
            videoCount: data.totalResults,
            avgViews: data.avgViews,
            topTags: data.topTags,
            contentGap: data.contentGap,
            gapScore: data.gapScore,
          };
        }
      });
      console.log(`[Google APIs] ✓ YouTube: ${youtubeData.size} keywords enriched`);
    });
    promises.push(youtubePromise);
  }

  // Google NLP
  if (useNLP) {
    const nlpPromise = batchClassifyIntent(
      keywords.slice(0, maxNLPKeywords),
      { apiKey: nlpApiKey }
    ).then(nlpData => {
      nlpData.forEach((data, keyword) => {
        const existing = results.get(keyword);
        if (existing) {
          existing.nlp = {
            intent: data.intent,
            intentConfidence: data.intentConfidence,
            entities: data.entities.map(e => ({ name: e.name, type: e.type })),
          };
        }
      });
      console.log(`[Google APIs] ✓ NLP: ${nlpData.size} keywords classified`);
    });
    promises.push(nlpPromise);
  }

  // Wait for all API calls to complete
  await Promise.allSettled(promises);

  console.log(`[Google APIs] ✓ Enrichment complete for ${results.size} keywords`);

  return results;
}

/**
 * Calculate composite opportunity score
 * Considers: Trends, YouTube gaps, Search volume, Competition
 */
export function calculateCompositeScore(
  enrichedData: EnrichedKeywordData,
  googleAdsData?: {
    searchVolume: number;
    cpc: number;
    competition: string;
  }
): number {
  let score = 50; // Start at 50

  // Trends impact (+/-20)
  if (enrichedData.trends) {
    const trendBonus = enrichedData.trends.trendingScore * 0.2;
    score += trendBonus - 10; // -10 to +10 range
  }

  // YouTube content gap (+10)
  if (enrichedData.youtube?.contentGap) {
    score += enrichedData.youtube.gapScore * 0.1;
  }

  // Search volume impact (+20)
  if (googleAdsData?.searchVolume) {
    const volumeScore = Math.min(20, (googleAdsData.searchVolume / 1000) * 2);
    score += volumeScore;
  }

  // Competition impact (-20)
  if (googleAdsData?.competition) {
    const competitionPenalty = {
      'HIGH': -20,
      'MEDIUM': -10,
      'LOW': 0,
    }[googleAdsData.competition] || 0;
    score += competitionPenalty;
  }

  // Intent impact (+10 for high-value intent)
  if (enrichedData.nlp?.intent === 'transactional') {
    score += 10;
  } else if (enrichedData.nlp?.intent === 'commercial') {
    score += 5;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}
