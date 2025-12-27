/**
 * ScrapingRobot API Client for SERP Intelligence
 *
 * Fetches Google SERP data to provide competitive intelligence for PPC campaigns:
 * - Organic positions for target domain
 * - Competitor ad counts and domains
 * - SERP features (Shopping Ads, Local Pack, Featured Snippets)
 * - Top organic competitors
 *
 * This is NOT an SEO tool - it's for PPC campaign optimization:
 * - Identify keywords where organic is weak → prioritize for paid campaigns
 * - Track competitor ad presence → inform bidding strategy
 * - Detect SERP features → choose campaign types (Shopping vs Search)
 *
 * API Documentation: https://docs.scrapingrobot.com/
 */

const SCRAPINGROBOT_API_KEY = 'ff1ca556-bdfc-497c-8f23-dab20cde8f66';
const SCRAPINGROBOT_API_URL = 'https://api.scrapingrobot.com/';

export interface SERPData {
  keyword: string;
  targetDomain: string;

  // Organic position tracking
  organicPosition: number | null; // 1-100, null if not in top 100
  organicUrl: string | null; // URL of the ranking page

  // SERP features (impact PPC strategy)
  featuredSnippet: boolean;
  localPackPresent: boolean;
  shoppingAdsPresent: boolean;
  peopleAlsoAskPresent: boolean;
  relatedSearchesPresent: boolean;

  // Competitive intelligence (PPC-focused)
  competitorAdsCount: number; // Total ads (top + bottom)
  topAdsCount: number; // Ads above organic results
  bottomAdsCount: number; // Ads below organic results
  topAdDomains: string[]; // Domains running top ads
  bottomAdDomains: string[]; // Domains running bottom ads

  // Organic competitive landscape
  organicCompetitors: string[]; // Top 10 organic result domains
  organicTop3Domains: string[]; // Top 3 organic results

  // Metadata
  fetchedAt: string;
  serpFeaturesRaw: any; // Full SERP features array for debugging
  totalResults: number; // Total organic results count
  apiCostCents: number; // Estimated cost in cents
}

export interface SERPCheckOptions {
  location?: string; // Country code (e.g., 'us', 'gb', 'ca')
  device?: 'desktop' | 'mobile';
  language?: string; // Language code (e.g., 'en', 'es')
  includeRawResponse?: boolean; // Include full API response for debugging
}

/**
 * Check SERP position and competitive data for a single keyword
 */
export async function checkSERPPosition(
  keyword: string,
  targetDomain: string,
  options: SERPCheckOptions = {}
): Promise<SERPData> {
  const {
    location = 'us',
    device = 'desktop',
    language = 'en',
    includeRawResponse = false,
  } = options;

  console.log(`[ScrapingRobot] Checking SERP for "${keyword}" (${location}, ${device})`);

  try {
    // Build Google Search URL
    const googleUrl = buildGoogleSearchUrl(keyword, location, language, device);

    // ScrapingRobot requires token as query parameter, not in body
    const apiUrl = `${SCRAPINGROBOT_API_URL}?token=${SCRAPINGROBOT_API_KEY}`;

    const requestBody = {
      url: googleUrl,
      module: 'HtmlRequestScraper', // Use standard HTML scraper for SERP data
    };

    console.log(`[ScrapingRobot] Request URL: ${googleUrl}`);
    console.log(`[ScrapingRobot] Request body:`, JSON.stringify(requestBody, null, 2));

    // Make API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Try to get error details from response body
      let errorDetails = '';
      try {
        const errorBody = await response.json();
        errorDetails = JSON.stringify(errorBody);
        console.error(`[ScrapingRobot] API Error Response:`, errorBody);
      } catch {
        // Response body might not be JSON
        try {
          errorDetails = await response.text();
          console.error(`[ScrapingRobot] API Error Text:`, errorDetails);
        } catch {
          errorDetails = 'Unable to read error response';
        }
      }
      throw new Error(`ScrapingRobot API error: ${response.status} ${response.statusText} - ${errorDetails}`);
    }

    const data = await response.json();

    // Log response structure to understand what we're getting
    console.log(`[ScrapingRobot] Response keys:`, Object.keys(data));
    console.log(`[ScrapingRobot] Response status:`, data.status);

    if (data.result) {
      const resultType = typeof data.result;
      if (resultType === 'string') {
        console.log(`[ScrapingRobot] Received HTML response (${data.result.length} chars)`);
        // Check if it's actually HTML
        if (data.result.includes('<html') || data.result.includes('<!DOCTYPE')) {
          console.log(`[ScrapingRobot] Confirmed: Response is HTML, need to parse it`);
        }
      } else if (resultType === 'object') {
        console.log(`[ScrapingRobot] Received object response with keys:`, Object.keys(data.result));
      }
    }

    if (data.organic_results || data.organic) {
      console.log(`[ScrapingRobot] Received structured SERP data`);
    }

    // Parse response and extract data
    // ScrapingRobot returns data in data.result field
    const serpData = parseSERPResponse(
      data.result || data,
      keyword,
      targetDomain,
      includeRawResponse
    );

    console.log(
      `[ScrapingRobot] ✓ "${keyword}" - Position: ${serpData.organicPosition || 'Not in top 100'}, ` +
        `Ads: ${serpData.competitorAdsCount}, Features: ${getSERPFeaturesSummary(serpData)}`
    );

    return serpData;
  } catch (error) {
    console.error(`[ScrapingRobot] Error checking SERP for "${keyword}":`, error);

    // Return empty result on error (graceful degradation)
    return {
      keyword,
      targetDomain,
      organicPosition: null,
      organicUrl: null,
      featuredSnippet: false,
      localPackPresent: false,
      shoppingAdsPresent: false,
      peopleAlsoAskPresent: false,
      relatedSearchesPresent: false,
      competitorAdsCount: 0,
      topAdsCount: 0,
      bottomAdsCount: 0,
      topAdDomains: [],
      bottomAdDomains: [],
      organicCompetitors: [],
      organicTop3Domains: [],
      fetchedAt: new Date().toISOString(),
      serpFeaturesRaw: null,
      totalResults: 0,
      apiCostCents: 0,
    };
  }
}

/**
 * Batch check SERP positions for multiple keywords with rate limiting
 */
export async function batchCheckPositions(
  keywords: Array<{ keyword: string; targetDomain: string }>,
  options: SERPCheckOptions & { delayMs?: number; maxConcurrent?: number } = {}
): Promise<Map<string, SERPData>> {
  const { delayMs = 2000, maxConcurrent = 1 } = options; // Conservative rate limiting

  console.log(`[ScrapingRobot] Batch checking ${keywords.length} keywords (${delayMs}ms delay between requests)`);

  const results = new Map<string, SERPData>();
  const errors: string[] = [];

  // Process keywords sequentially to respect rate limits
  for (let i = 0; i < keywords.length; i++) {
    const { keyword, targetDomain } = keywords[i];

    try {
      const serpData = await checkSERPPosition(keyword, targetDomain, options);
      results.set(keyword, serpData);
    } catch (error) {
      console.error(`[ScrapingRobot] Failed to check "${keyword}":`, error);
      errors.push(`${keyword}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Rate limiting delay (except for last item)
    if (i < keywords.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[ScrapingRobot] Batch complete: ${results.size}/${keywords.length} successful, ${errors.length} errors`);

  if (errors.length > 0) {
    console.error(`[ScrapingRobot] Errors:`, errors);
  }

  return results;
}

/**
 * Build Google Search URL with proper parameters
 */
function buildGoogleSearchUrl(
  keyword: string,
  location: string,
  language: string,
  device: 'desktop' | 'mobile'
): string {
  const params = new URLSearchParams({
    q: keyword,
    gl: location, // Geographic location (country code)
    hl: language, // Interface language
    num: '100', // Request 100 results
  });

  // Mobile-specific parameters
  if (device === 'mobile') {
    params.set('mobile', '1');
  }

  return `https://www.google.com/search?${params.toString()}`;
}

/**
 * Parse ScrapingRobot API response into structured SERP data
 */
function parseSERPResponse(
  apiResponse: any,
  keyword: string,
  targetDomain: string,
  includeRaw: boolean
): SERPData {
  // Extract organic results
  const organicResults = apiResponse.organic || apiResponse.organic_results || [];
  const adsTop = apiResponse.ads_top || apiResponse.top_ads || [];
  const adsBottom = apiResponse.ads_bottom || apiResponse.bottom_ads || [];
  const serpFeatures = apiResponse.serp_features || apiResponse.knowledge_graph_features || [];

  // Find target domain position in organic results
  const { position, url } = findDomainPosition(organicResults, targetDomain);

  // Extract SERP features
  const serpFeaturesDetected = detectSERPFeatures(apiResponse, serpFeatures);

  // Extract competitor ad domains
  const topAdDomains = extractAdDomains(adsTop);
  const bottomAdDomains = extractAdDomains(adsBottom);

  // Extract organic competitor domains
  const organicCompetitors = extractOrganicDomains(organicResults);
  const organicTop3Domains = organicCompetitors.slice(0, 3);

  // Estimate API cost (rough estimate based on request complexity)
  const apiCostCents = 1; // ~$0.01 per request

  return {
    keyword,
    targetDomain,
    organicPosition: position,
    organicUrl: url,
    featuredSnippet: serpFeaturesDetected.featuredSnippet,
    localPackPresent: serpFeaturesDetected.localPack,
    shoppingAdsPresent: serpFeaturesDetected.shoppingAds,
    peopleAlsoAskPresent: serpFeaturesDetected.peopleAlsoAsk,
    relatedSearchesPresent: serpFeaturesDetected.relatedSearches,
    competitorAdsCount: adsTop.length + adsBottom.length,
    topAdsCount: adsTop.length,
    bottomAdsCount: adsBottom.length,
    topAdDomains,
    bottomAdDomains,
    organicCompetitors,
    organicTop3Domains,
    fetchedAt: new Date().toISOString(),
    serpFeaturesRaw: includeRaw ? serpFeatures : null,
    totalResults: organicResults.length,
    apiCostCents,
  };
}

/**
 * Find target domain's position in organic results
 */
function findDomainPosition(
  organicResults: any[],
  targetDomain: string
): { position: number | null; url: string | null } {
  // Normalize target domain (remove www, protocol, trailing slash)
  const normalizedTarget = normalizeDomain(targetDomain);

  for (let i = 0; i < organicResults.length; i++) {
    const result = organicResults[i];
    const resultDomain = extractDomain(result.link || result.url || '');

    if (normalizedTarget === resultDomain) {
      return {
        position: result.position || i + 1,
        url: result.link || result.url,
      };
    }
  }

  return { position: null, url: null };
}

/**
 * Detect SERP features from API response
 */
function detectSERPFeatures(
  apiResponse: any,
  serpFeatures: any[]
): {
  featuredSnippet: boolean;
  localPack: boolean;
  shoppingAds: boolean;
  peopleAlsoAsk: boolean;
  relatedSearches: boolean;
} {
  // Check various API response fields for SERP features
  return {
    featuredSnippet: !!(
      apiResponse.featured_snippet ||
      apiResponse.answer_box ||
      serpFeatures.includes('featured_snippet') ||
      serpFeatures.includes('answer_box')
    ),
    localPack: !!(
      apiResponse.local_results ||
      apiResponse.local_pack ||
      serpFeatures.includes('local_pack') ||
      serpFeatures.includes('local_results')
    ),
    shoppingAds: !!(
      apiResponse.shopping_results ||
      apiResponse.shopping_ads ||
      serpFeatures.includes('shopping_results') ||
      serpFeatures.includes('shopping_ads')
    ),
    peopleAlsoAsk: !!(
      apiResponse.related_questions ||
      apiResponse.people_also_ask ||
      serpFeatures.includes('people_also_ask') ||
      serpFeatures.includes('related_questions')
    ),
    relatedSearches: !!(
      apiResponse.related_searches || serpFeatures.includes('related_searches')
    ),
  };
}

/**
 * Extract domains from ad results
 */
function extractAdDomains(ads: any[]): string[] {
  return ads
    .map((ad) => {
      const url = ad.link || ad.url || ad.display_link || '';
      return extractDomain(url);
    })
    .filter((domain) => domain !== '');
}

/**
 * Extract domains from organic results
 */
function extractOrganicDomains(organicResults: any[]): string[] {
  return organicResults
    .slice(0, 10) // Top 10 results only
    .map((result) => {
      const url = result.link || result.url || '';
      return extractDomain(url);
    })
    .filter((domain) => domain !== '');
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return normalizeDomain(urlObj.hostname);
  } catch {
    return '';
  }
}

/**
 * Normalize domain for comparison (remove www, lowercase)
 */
function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

/**
 * Get summary of SERP features for logging
 */
function getSERPFeaturesSummary(serpData: SERPData): string {
  const features: string[] = [];
  if (serpData.featuredSnippet) features.push('Snippet');
  if (serpData.shoppingAdsPresent) features.push('Shopping');
  if (serpData.localPackPresent) features.push('Local');
  if (serpData.peopleAlsoAskPresent) features.push('PAA');
  return features.length > 0 ? features.join(', ') : 'None';
}

/**
 * Estimate monthly cost for tracking N keywords daily
 */
export function estimateMonthlyCost(keywordCount: number, checksPerDay: number = 1): number {
  const costPerCheck = 0.01; // $0.01 per SERP check
  const checksPerMonth = keywordCount * checksPerDay * 30; // 30 days
  return Math.round(checksPerMonth * costPerCheck * 100) / 100; // Round to 2 decimals
}
