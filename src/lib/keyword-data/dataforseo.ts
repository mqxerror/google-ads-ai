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
