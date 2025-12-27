/**
 * SERP Features Detection & Analysis
 * Analyzes search engine results pages to identify features and calculate difficulty
 *
 * Integrates with DataForSEO SERP API to detect:
 * - Featured snippets
 * - Knowledge panels
 * - Local packs
 * - Ads (top, bottom, shopping)
 * - People Also Ask boxes
 * - Related searches
 *
 * Calculates SERP difficulty score (0-100) based on features present
 */

import type {
  SerpFeatures,
  SerpAnalysisResult,
  DataForSeoSerpResponse,
} from '../database/types';
import { Pool } from 'pg';

// =====================================================
// DataForSEO API Configuration
// =====================================================

const DATAFORSEO_API_URL = 'https://api.dataforseo.com/v3';
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

// =====================================================
// SERP Difficulty Calculation
// =====================================================

/**
 * Calculate SERP difficulty score based on features present
 * Higher score = harder to rank organically
 *
 * Scoring logic:
 * - Each ad adds difficulty (5 points per ad)
 * - Top ads add more (15 points for 4+ top ads)
 * - Featured snippet adds significant difficulty (15 points)
 * - Knowledge panel adds major difficulty (20 points)
 * - Local pack adds difficulty (10 points)
 * - Shopping ads add difficulty (10 points)
 *
 * @param features - Detected SERP features
 * @returns Difficulty score (0-100)
 */
export function calculateSerpDifficulty(features: SerpFeatures): number {
  let score = 0;

  // Each ad adds difficulty
  score += (features.ads.totalCount || 0) * 5;

  // Too many top ads make it very hard to get organic clicks
  if ((features.ads.topCount || 0) >= 4) {
    score += 20;
  } else if ((features.ads.topCount || 0) >= 2) {
    score += 10;
  }

  // SERP features add difficulty
  if (features.features.featuredSnippet) {
    score += 15; // Featured snippet takes top position
  }

  if (features.features.knowledgePanel) {
    score += 20; // Knowledge panel is very prominent
  }

  if (features.features.localPack) {
    score += 10; // Local pack pushes organic results down
  }

  if (features.ads.hasShoppingAds) {
    score += 10; // Shopping ads very visual
  }

  if (features.features.peopleAlsoAsk) {
    score += 5; // PAA boxes take space
  }

  // Clamp to 0-100 range
  return Math.min(100, Math.max(0, score));
}

/**
 * Generate human-readable difficulty label and color
 */
export function classifySerpDifficulty(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 80) {
    return {
      label: 'Extremely Hard',
      color: 'red',
      description: 'Very difficult to rank organically - SERP dominated by ads and features',
    };
  }

  if (score >= 60) {
    return {
      label: 'Hard',
      color: 'orange',
      description: 'Challenging to rank - multiple ads and SERP features present',
    };
  }

  if (score >= 40) {
    return {
      label: 'Moderate',
      color: 'yellow',
      description: 'Moderate difficulty - some ads and features competing for attention',
    };
  }

  if (score >= 20) {
    return {
      label: 'Easy',
      color: 'green',
      description: 'Good opportunity - limited ads and SERP features',
    };
  }

  return {
    label: 'Very Easy',
    color: 'emerald',
    description: 'Excellent opportunity - minimal competition for organic visibility',
  };
}

// =====================================================
// DataForSEO API Integration
// =====================================================

/**
 * Fetch SERP data from DataForSEO API
 *
 * @param keyword - Keyword to analyze
 * @param locationId - Google Ads location ID (e.g., '2840' for US)
 * @param device - Device type ('desktop' | 'mobile')
 * @returns Raw SERP data from DataForSEO
 */
async function fetchDataForSeoSerp(
  keyword: string,
  locationId: string = '2840', // US by default
  device: 'desktop' | 'mobile' = 'desktop'
): Promise<DataForSeoSerpResponse | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    console.warn('DataForSEO credentials not configured - SERP analysis unavailable');
    return null;
  }

  const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

  try {
    const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/organic/live/advanced`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword: keyword,
          location_code: parseInt(locationId),
          language_code: 'en',
          device: device,
          os: device === 'mobile' ? 'android' : 'windows',
        },
      ]),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('DataForSEO API error:', error);
      return null;
    }

    const data = await response.json();

    if (data.status_code !== 20000) {
      console.error('DataForSEO API returned error:', data.status_message);
      return null;
    }

    return data.tasks?.[0]?.result?.[0] || null;
  } catch (error) {
    console.error('Failed to fetch SERP data from DataForSEO:', error);
    return null;
  }
}

/**
 * Parse DataForSEO response into structured SERP features
 */
function parseDataForSeoResponse(data: DataForSeoSerpResponse): SerpFeatures {
  const items = data.items || [];

  // Detect features from items
  const hasFeaturedSnippet = items.some(item => item.type === 'featured_snippet');
  const hasKnowledgePanel = items.some(item => item.type === 'knowledge_panel');
  const hasLocalPack = items.some(item => item.type === 'local_pack');
  const hasPeopleAlsoAsk = items.some(item => item.type === 'people_also_ask');
  const hasRelatedSearches = items.some(item => item.type === 'related_searches');

  // Count ads
  const paidItems = items.filter(item => item.type === 'paid');
  const topAds = paidItems.filter(item => item.rank_group && item.rank_group <= 4);
  const bottomAds = paidItems.filter(item => item.rank_group && item.rank_group > 4);
  const shoppingAds = items.filter(item => item.type === 'shopping');

  // Get organic results info
  const organicItems = items.filter(item => item.type === 'organic');
  const firstOrganic = organicItems[0];

  return {
    keyword: data.keyword || '',
    locationId: data.location_code?.toString() || '2840',
    device: 'desktop' as const,

    features: {
      featuredSnippet: hasFeaturedSnippet,
      knowledgePanel: hasKnowledgePanel,
      localPack: hasLocalPack,
      peopleAlsoAsk: hasPeopleAlsoAsk,
      relatedSearches: hasRelatedSearches,
    },

    ads: {
      totalCount: paidItems.length + shoppingAds.length,
      topCount: topAds.length,
      bottomCount: bottomAds.length,
      hasShoppingAds: shoppingAds.length > 0,
    },

    organic: {
      resultCount: organicItems.length,
      firstResultDomain: firstOrganic?.domain || '',
    },

    difficulty: {
      serpScore: 0, // Will be calculated separately
      reasoning: '',
    },
  };
}

// =====================================================
// Caching Layer
// =====================================================

/**
 * Get cached SERP features from database
 */
async function getCachedSerpFeatures(
  keyword: string,
  locationId: string,
  device: 'desktop' | 'mobile'
): Promise<SerpAnalysisResult | null> {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  try {
    const keywordNormalized = keyword.toLowerCase().trim();

    const result = await pool.query(
      `
      SELECT *
      FROM keyword_serp_features
      WHERE keyword_normalized = $1
        AND location_id = $2
        AND device = $3
        AND expires_at > NOW()
      ORDER BY checked_at DESC
      LIMIT 1
      `,
      [keywordNormalized, locationId, device]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    const features: SerpFeatures = {
      keyword: keyword,
      locationId: locationId,
      device: 'desktop' as const,
      features: {
        featuredSnippet: row.has_featured_snippet,
        knowledgePanel: row.has_knowledge_panel,
        localPack: row.has_local_pack,
        peopleAlsoAsk: false, // Not stored in v1
        relatedSearches: false, // Not stored in v1
      },
      ads: {
        totalCount: row.total_ads_count,
        topCount: row.top_ads_count,
        bottomCount: (row.total_ads_count - row.top_ads_count),
        hasShoppingAds: false, // Not stored in v1
      },
      organic: {
        resultCount: row.organic_results_count,
        firstResultDomain: '',
      },
      difficulty: {
        serpScore: row.serp_difficulty,
        reasoning: '',
      },
    };

    const difficulty = classifySerpDifficulty(row.serp_difficulty);

    return {
      keyword: keyword,
      features: features,
      difficulty: {
        score: row.serp_difficulty,
        label: difficulty.label,
        color: difficulty.color,
        description: difficulty.description,
      },
      cached: true,
      checkedAt: row.checked_at,
    };
  } finally {
    await pool.end();
  }
}

/**
 * Cache SERP features in database
 */
async function cacheSerpFeatures(
  features: SerpFeatures,
  device: 'desktop' | 'mobile'
): Promise<void> {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  try {
    const keywordNormalized = features.keyword.toLowerCase().trim();
    const serpScore = calculateSerpDifficulty(features);

    await pool.query(
      `
      INSERT INTO keyword_serp_features (
        keyword_normalized,
        location_id,
        device,
        has_featured_snippet,
        has_knowledge_panel,
        has_local_pack,
        total_ads_count,
        top_ads_count,
        organic_results_count,
        serp_difficulty,
        checked_at,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW() + INTERVAL '30 days')
      ON CONFLICT (keyword_normalized, location_id, device)
      DO UPDATE SET
        has_featured_snippet = EXCLUDED.has_featured_snippet,
        has_knowledge_panel = EXCLUDED.has_knowledge_panel,
        has_local_pack = EXCLUDED.has_local_pack,
        total_ads_count = EXCLUDED.total_ads_count,
        top_ads_count = EXCLUDED.top_ads_count,
        organic_results_count = EXCLUDED.organic_results_count,
        serp_difficulty = EXCLUDED.serp_difficulty,
        checked_at = NOW(),
        expires_at = NOW() + INTERVAL '30 days'
      `,
      [
        keywordNormalized,
        features.locationId,
        device,
        features.features.featuredSnippet,
        features.features.knowledgePanel,
        features.features.localPack,
        features.ads.totalCount,
        features.ads.topCount,
        features.organic.resultCount,
        serpScore,
      ]
    );
  } finally {
    await pool.end();
  }
}

// =====================================================
// Main Analysis Function
// =====================================================

/**
 * Analyze SERP features for a keyword
 *
 * Checks cache first, then fetches from DataForSEO API if needed
 * Caches result for 30 days
 *
 * @param keyword - Keyword to analyze
 * @param options - Location, device, force refresh
 * @returns SERP analysis with features and difficulty score
 */
export async function analyzeSerpFeatures(
  keyword: string,
  options: {
    locationId?: string;
    device?: 'desktop' | 'mobile';
    forceRefresh?: boolean;
  } = {}
): Promise<SerpAnalysisResult> {
  const locationId = options.locationId || '2840'; // US
  const device = options.device || 'desktop';

  // Check cache first (unless force refresh)
  if (!options.forceRefresh) {
    const cached = await getCachedSerpFeatures(keyword, locationId, device);
    if (cached) {
      return cached;
    }
  }

  // Fetch from DataForSEO
  const serpData = await fetchDataForSeoSerp(keyword, locationId, device);

  if (!serpData) {
    // Return default/empty result if API unavailable
    const defaultFeatures: SerpFeatures = {
      keyword,
      locationId,
      device: device as any,
      features: {
        featuredSnippet: false,
        knowledgePanel: false,
        localPack: false,
        peopleAlsoAsk: false,
        relatedSearches: false,
      },
      ads: {
        totalCount: 0,
        topCount: 0,
        bottomCount: 0,
        hasShoppingAds: false,
      },
      organic: {
        resultCount: 0,
        firstResultDomain: '',
      },
      difficulty: {
        serpScore: 50, // Default medium difficulty
        reasoning: 'SERP data unavailable - using default',
      },
    };

    return {
      keyword,
      features: defaultFeatures,
      difficulty: {
        score: 50,
        label: 'Unknown',
        color: 'gray',
        description: 'SERP analysis unavailable - DataForSEO API not configured',
      },
      cached: false,
      checkedAt: new Date().toISOString(),
    };
  }

  // Parse response
  const features = parseDataForSeoResponse(serpData);
  const serpScore = calculateSerpDifficulty(features);
  features.difficulty.serpScore = serpScore;

  // Generate reasoning
  const featuresList: string[] = [];
  if (features.features.featuredSnippet) featuresList.push('featured snippet');
  if (features.features.knowledgePanel) featuresList.push('knowledge panel');
  if (features.features.localPack) featuresList.push('local pack');
  if (features.ads.totalCount > 0) featuresList.push(`${features.ads.totalCount} ads`);

  features.difficulty.reasoning =
    featuresList.length > 0
      ? `SERP includes: ${featuresList.join(', ')}`
      : 'Clean SERP with minimal features';

  // Cache result
  await cacheSerpFeatures(features, device);

  // Return structured result
  const difficulty = classifySerpDifficulty(serpScore);

  return {
    keyword,
    features,
    difficulty: {
      score: serpScore,
      label: difficulty.label,
      color: difficulty.color,
      description: difficulty.description,
    },
    cached: false,
    checkedAt: new Date().toISOString(),
  };
}

// =====================================================
// Batch Analysis
// =====================================================

/**
 * Analyze SERP features for multiple keywords
 *
 * Processes in batches to respect rate limits
 * Uses cache when possible to minimize API calls
 *
 * @param keywords - Keywords to analyze
 * @param options - Location, device, batch size
 * @returns Map of keyword -> SERP analysis
 */
export async function analyzeSerpFeaturesBatch(
  keywords: string[],
  options: {
    locationId?: string;
    device?: 'desktop' | 'mobile';
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<Map<string, SerpAnalysisResult>> {
  const results = new Map<string, SerpAnalysisResult>();
  const batchSize = options.batchSize || 10; // Process 10 at a time
  const locationId = options.locationId || '2840';
  const device = options.device || 'desktop';

  // Check cache for all keywords first
  const uncachedKeywords: string[] = [];

  for (const keyword of keywords) {
    const cached = await getCachedSerpFeatures(keyword, locationId, device);
    if (cached) {
      results.set(keyword.toLowerCase().trim(), cached);
    } else {
      uncachedKeywords.push(keyword);
    }
  }

  // Fetch uncached keywords in batches
  for (let i = 0; i < uncachedKeywords.length; i += batchSize) {
    const batch = uncachedKeywords.slice(i, i + batchSize);

    // Process batch in parallel
    const batchPromises = batch.map((keyword) =>
      analyzeSerpFeatures(keyword, { locationId, device, forceRefresh: false })
    );

    const batchResults = await Promise.all(batchPromises);

    // Add to results
    batchResults.forEach((result, idx) => {
      const keyword = batch[idx];
      results.set(keyword.toLowerCase().trim(), result);
    });

    // Report progress
    if (options.onProgress) {
      const processed = Math.min(results.size, keywords.length);
      options.onProgress(processed, keywords.length);
    }

    // Rate limiting: Wait 1 second between batches
    if (i + batchSize < uncachedKeywords.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// =====================================================
// Cost Estimation
// =====================================================

/**
 * Estimate cost for SERP analysis
 *
 * @param keywordCount - Number of keywords to analyze
 * @param cacheHitRate - Expected cache hit rate (0-1)
 * @returns Estimated cost in USD
 */
export function estimateSerpAnalysisCost(
  keywordCount: number,
  cacheHitRate: number = 0.7 // Assume 70% cache hit rate
): {
  totalKeywords: number;
  cachedKeywords: number;
  apiCalls: number;
  estimatedCost: number;
  costPerKeyword: number;
} {
  const costPerCall = 0.0075; // Average $0.0075 per SERP request

  const cachedKeywords = Math.round(keywordCount * cacheHitRate);
  const apiCalls = keywordCount - cachedKeywords;
  const estimatedCost = apiCalls * costPerCall;

  return {
    totalKeywords: keywordCount,
    cachedKeywords,
    apiCalls,
    estimatedCost: Number(estimatedCost.toFixed(2)),
    costPerKeyword: Number((estimatedCost / keywordCount).toFixed(4)),
  };
}
