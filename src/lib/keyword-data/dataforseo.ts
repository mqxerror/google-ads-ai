/**
 * DataForSEO Keywords Data API Client
 *
 * Provides keyword metrics as a fallback/supplement to Google Ads:
 * - Search volume
 * - CPC estimates
 * - Competition scores (0-1)
 * - Monthly trend data
 *
 * Docs: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/
 */

import { getDataForSeoCircuitBreaker } from './circuit-breaker';
import type { DataForSEOKeywordMetrics } from './types';

// DataForSEO API configuration
const DATAFORSEO_API_BASE = 'https://api.dataforseo.com/v3';
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

// Rate limits: 2000 requests/min, batch up to 100 keywords
const BATCH_SIZE = 100;
const REQUEST_DELAY_MS = 1000; // 1 req/sec to be conservative

interface DataForSEORequest {
  keywords: string[];
  location_code?: number; // 2840 = United States
  language_code?: string; // 'en'
  include_serp_info?: boolean;
  include_clickstream_data?: boolean;
}

interface DataForSEOResponse {
  status_code: number;
  status_message: string;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    result?: Array<{
      keyword: string;
      location_code: number;
      language_code: string;
      search_partners: boolean;
      competition: number; // 0-1
      competition_level: 'LOW' | 'MEDIUM' | 'HIGH';
      cpc: number; // USD
      search_volume: number;
      monthly_searches?: Array<{
        year: number;
        month: number;
        search_volume: number;
      }>;
    }>;
  }>;
}

/**
 * Fetch keyword metrics from DataForSEO
 * Uses circuit breaker for fault tolerance
 */
export async function fetchDataForSEOMetrics(
  keywords: string[],
  locationCode: number = 2840, // US
  languageCode: string = 'en'
): Promise<DataForSEOKeywordMetrics[]> {
  if (keywords.length === 0) {
    return [];
  }

  // Check credentials
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    console.warn('[DataForSEO] API credentials not configured (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD)');
    return keywords.map(keyword => createNullMetrics(keyword));
  }

  // Batch keywords (max 100 per request)
  const batches: string[][] = [];
  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    batches.push(keywords.slice(i, i + BATCH_SIZE));
  }

  const breaker = getDataForSeoCircuitBreaker();
  const allResults: DataForSEOKeywordMetrics[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      // Rate limiting: delay between batches
      if (i > 0) {
        await delay(REQUEST_DELAY_MS);
      }

      const batchResults = await breaker.execute(async () => {
        const requestBody: DataForSEORequest[] = [{
          keywords: batch,
          location_code: locationCode,
          language_code: languageCode,
          include_serp_info: false,
          include_clickstream_data: false,
        }];

        const response = await fetch(`${DATAFORSEO_API_BASE}/keywords_data/google_ads/search_volume/live`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
        }

        const data: DataForSEOResponse = await response.json();

        if (data.status_code !== 20000) {
          throw new Error(`DataForSEO error: ${data.status_message}`);
        }

        // Extract results from first task
        const taskResults = data.tasks[0]?.result || [];

        return taskResults.map(item => ({
          keyword: item.keyword,
          searchVolume: item.search_volume || 0,
          cpc: item.cpc || 0,
          competition: item.competition || 0,
          trends: extractMonthlyTrends(item.monthly_searches),
        }));
      });

      allResults.push(...batchResults);
      console.log(`[DataForSEO] Fetched metrics for ${batchResults.length} keywords (batch ${i + 1}/${batches.length})`);
    } catch (error) {
      console.error(`[DataForSEO] Error fetching batch ${i + 1}:`, error);

      // Graceful degradation: return null metrics for failed keywords
      batch.forEach(keyword => {
        allResults.push(createNullMetrics(keyword));
      });
    }
  }

  return allResults;
}

/**
 * Create null metrics for a keyword (fallback when API fails)
 */
function createNullMetrics(keyword: string): DataForSEOKeywordMetrics {
  return {
    keyword,
    searchVolume: 0,
    cpc: 0,
    competition: 0,
    trends: {},
  };
}

/**
 * Extract monthly trends from DataForSEO monthly_searches array
 * Returns object with 'YYYY-MM' keys
 */
function extractMonthlyTrends(
  monthlySearches?: Array<{ year: number; month: number; search_volume: number }>
): Record<string, number> {
  if (!monthlySearches || monthlySearches.length === 0) {
    return {};
  }

  const trends: Record<string, number> = {};

  monthlySearches.forEach(item => {
    const monthKey = `${item.year}-${String(item.month).padStart(2, '0')}`;
    trends[monthKey] = item.search_volume;
  });

  return trends;
}

/**
 * Delay utility for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================================
// DataForSEO Labs - Keyword Difficulty API
// =====================================================

/**
 * Keyword Difficulty result from DataForSEO Labs
 *
 * NOTE: The bulk_keyword_difficulty endpoint ONLY returns:
 * - keyword
 * - keyword_difficulty (0-100)
 * - se_type
 *
 * It does NOT return volume, CPC, or competition.
 * Use Google Ads API for those metrics (more accurate for PPC).
 */
export interface KeywordDifficultyResult {
  keyword: string;
  difficulty: number | null; // 0-100 keyword difficulty score
  error?: string;
}

/**
 * Fetch Keyword Difficulty from DataForSEO Labs API
 *
 * This endpoint ONLY returns KD (Keyword Difficulty) score.
 * For volume, CPC, competition - use Google Ads API (more accurate for PPC).
 *
 * Cost: ~$0.0003 per keyword ($0.30 per 1000 keywords)
 *
 * @param keywords - Array of keywords to check (max 1000 per request)
 * @param locationCode - DataForSEO location code (default: 2840 = US)
 * @param languageCode - Language code (default: 'en')
 * @returns Array of keyword difficulty results
 */
export async function fetchKeywordDifficulty(
  keywords: string[],
  locationCode: number = 2840,
  languageCode: string = 'en'
): Promise<KeywordDifficultyResult[]> {
  if (keywords.length === 0) {
    return [];
  }

  // Check credentials
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    console.warn('[DataForSEO KD] API credentials not configured');
    return keywords.map(keyword => ({
      keyword,
      difficulty: null,
      error: 'API credentials not configured',
    }));
  }

  console.log(`[DataForSEO KD] Fetching difficulty for ${keywords.length} keywords...`);

  // DataForSEO allows up to 1000 keywords per request
  const maxPerRequest = 1000;
  const batches: string[][] = [];
  for (let i = 0; i < keywords.length; i += maxPerRequest) {
    batches.push(keywords.slice(i, i + maxPerRequest));
  }

  const allResults: KeywordDifficultyResult[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      // Rate limiting: delay between batches
      if (i > 0) {
        await delay(REQUEST_DELAY_MS);
      }

      const requestBody = [
        {
          keywords: batch,
          location_code: locationCode,
          language_code: languageCode,
        },
      ];

      console.log(`[DataForSEO KD] Batch ${i + 1}/${batches.length}: ${batch.length} keywords`);

      const response = await fetch(`${DATAFORSEO_API_BASE}/dataforseo_labs/google/bulk_keyword_difficulty/live`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DataForSEO KD] API error: ${response.status} - ${errorText}`);
        throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[DataForSEO KD] Response status: ${data.status_code}, message: ${data.status_message}`);

      if (data.status_code !== 20000) {
        console.error(`[DataForSEO KD] Task error:`, data.status_message);
        throw new Error(`DataForSEO error: ${data.status_message}`);
      }

      // Parse results - structure: tasks[0].result[0].items[]
      const taskResult = data.tasks?.[0]?.result?.[0];
      const items = taskResult?.items || [];

      console.log(`[DataForSEO KD] Got ${items.length} items in response`);

      // Build result map
      const resultMap = new Map<string, number>();
      for (const item of items) {
        if (item && item.keyword && item.keyword_difficulty !== undefined) {
          resultMap.set(item.keyword.toLowerCase(), item.keyword_difficulty);
        }
      }

      // Match back to original keywords (preserving case)
      for (const kw of batch) {
        const difficulty = resultMap.get(kw.toLowerCase());
        allResults.push({
          keyword: kw,
          difficulty: difficulty ?? null,
        });
      }

      console.log(`[DataForSEO KD] Batch ${i + 1}/${batches.length}: ${resultMap.size} keywords with KD`);
    } catch (error) {
      console.error(`[DataForSEO KD] Error fetching batch ${i + 1}:`, error);

      // Graceful degradation: return null for failed keywords
      for (const kw of batch) {
        allResults.push({
          keyword: kw,
          difficulty: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // Calculate stats
  const withKD = allResults.filter(r => r.difficulty !== null).length;
  const estimatedCost = (allResults.length * 0.0003).toFixed(4);
  console.log(`[DataForSEO KD] Complete: ${withKD}/${allResults.length} with KD, est. cost: $${estimatedCost}`);

  return allResults;
}

/**
 * Get DataForSEO account info (for quota tracking)
 */
export async function getDataForSEOAccountInfo(): Promise<{
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    return {
      success: false,
      error: 'DataForSEO credentials not configured',
    };
  }

  try {
    const response = await fetch(`${DATAFORSEO_API_BASE}/user/info`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API error: ${response.status}`,
      };
    }

    const data: any = await response.json();

    if (data.status_code !== 20000) {
      return {
        success: false,
        error: data.status_message,
      };
    }

    const userInfo = data.tasks[0]?.result[0] || {};

    return {
      success: true,
      balance: userInfo.money?.balance || 0,
      currency: userInfo.money?.currency || 'USD',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// DataForSEO Labs - Search Intent API
// =====================================================

/**
 * Search Intent types from DataForSEO
 */
export type SearchIntent = 'commercial' | 'informational' | 'navigational' | 'transactional';

/**
 * Search Intent result from DataForSEO Labs
 */
export interface SearchIntentResult {
  keyword: string;
  intent: SearchIntent | null;
  probability: number | null; // 0-1 confidence score
  secondaryIntents?: Array<{ intent: SearchIntent; probability: number }>;
  error?: string;
}

/**
 * Fetch Search Intent from DataForSEO Labs API
 *
 * Classifies keywords into: commercial, informational, navigational, transactional
 * Cost: ~$0.00002 per keyword (~$0.02 per 1000 keywords) - VERY CHEAP!
 *
 * @param keywords - Array of keywords to classify (max 1000 per request)
 * @param languageCode - Language code (default: 'en')
 * @returns Array of search intent results
 */
export async function fetchSearchIntent(
  keywords: string[],
  languageCode: string = 'en'
): Promise<SearchIntentResult[]> {
  if (keywords.length === 0) {
    return [];
  }

  // Check credentials
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    console.warn('[DataForSEO Intent] API credentials not configured');
    return keywords.map(keyword => ({
      keyword,
      intent: null,
      probability: null,
      error: 'API credentials not configured',
    }));
  }

  console.log(`[DataForSEO Intent] Classifying ${keywords.length} keywords...`);

  // DataForSEO allows up to 1000 keywords per request
  const maxPerRequest = 1000;
  const batches: string[][] = [];
  for (let i = 0; i < keywords.length; i += maxPerRequest) {
    batches.push(keywords.slice(i, i + maxPerRequest));
  }

  const allResults: SearchIntentResult[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      // Rate limiting: delay between batches
      if (i > 0) {
        await delay(REQUEST_DELAY_MS);
      }

      const requestBody = [
        {
          keywords: batch,
          language_code: languageCode,
        },
      ];

      console.log(`[DataForSEO Intent] Batch ${i + 1}/${batches.length}: ${batch.length} keywords`);

      const response = await fetch(`${DATAFORSEO_API_BASE}/dataforseo_labs/google/search_intent/live`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DataForSEO Intent] API error: ${response.status} - ${errorText}`);
        throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[DataForSEO Intent] Response status: ${data.status_code}, message: ${data.status_message}`);

      if (data.status_code !== 20000) {
        console.error(`[DataForSEO Intent] Task error:`, data.status_message);
        throw new Error(`DataForSEO error: ${data.status_message}`);
      }

      // Parse results - structure: tasks[0].result[0].items[]
      const taskResult = data.tasks?.[0]?.result?.[0];
      const items = taskResult?.items || [];

      console.log(`[DataForSEO Intent] Got ${items.length} items in response`);

      // Build result map
      const resultMap = new Map<string, { intent: SearchIntent; probability: number; secondary?: Array<{ intent: SearchIntent; probability: number }> }>();

      for (const item of items) {
        if (item && item.keyword && item.keyword_intent) {
          // Primary intent
          const primaryIntent = item.keyword_intent.label?.toLowerCase() as SearchIntent;
          const probability = item.keyword_intent.probability || 0;

          // Secondary intents (if available)
          const secondary: Array<{ intent: SearchIntent; probability: number }> = [];
          if (item.secondary_keyword_intents && Array.isArray(item.secondary_keyword_intents)) {
            for (const sec of item.secondary_keyword_intents) {
              if (sec.label && sec.probability) {
                secondary.push({
                  intent: sec.label.toLowerCase() as SearchIntent,
                  probability: sec.probability,
                });
              }
            }
          }

          resultMap.set(item.keyword.toLowerCase(), {
            intent: primaryIntent,
            probability,
            secondary: secondary.length > 0 ? secondary : undefined,
          });
        }
      }

      // Match back to original keywords (preserving case)
      for (const kw of batch) {
        const result = resultMap.get(kw.toLowerCase());
        if (result) {
          allResults.push({
            keyword: kw,
            intent: result.intent,
            probability: result.probability,
            secondaryIntents: result.secondary,
          });
        } else {
          allResults.push({
            keyword: kw,
            intent: null,
            probability: null,
          });
        }
      }

      console.log(`[DataForSEO Intent] Batch ${i + 1}/${batches.length}: ${resultMap.size} keywords classified`);
    } catch (error) {
      console.error(`[DataForSEO Intent] Error fetching batch ${i + 1}:`, error);

      // Graceful degradation: return null for failed keywords
      for (const kw of batch) {
        allResults.push({
          keyword: kw,
          intent: null,
          probability: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // Calculate stats
  const withIntent = allResults.filter(r => r.intent !== null).length;
  const estimatedCost = (allResults.length * 0.00002).toFixed(5);
  console.log(`[DataForSEO Intent] Complete: ${withIntent}/${allResults.length} classified, est. cost: $${estimatedCost}`);

  return allResults;
}
