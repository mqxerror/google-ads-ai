/**
 * DataForSEO API Client for SERP Intelligence
 *
 * Provides structured Google SERP data for PPC campaign optimization:
 * - Organic positions for target domain
 * - Competitor ad counts and domains
 * - SERP features (Shopping Ads, Local Pack, Featured Snippets)
 * - Top organic competitors
 *
 * API Documentation: https://docs.dataforseo.com/v3/serp-google-organic-overview/
 *
 * Authentication: Basic Auth (login:password in Base64)
 * Get credentials from: https://app.dataforseo.com/api-dashboard
 */

const DATAFORSEO_API_URL = 'https://api.dataforseo.com/v3';

// TODO: Add your DataForSEO credentials here
// Get them from: https://app.dataforseo.com/api-dashboard
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN || '';
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD || '';

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
  locationCode?: number; // DataForSEO location code (e.g., 2840 for US)
  device?: 'desktop' | 'mobile';
  languageCode?: string; // Language code (e.g., 'en', 'es')
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
    locationCode = 2840, // Default: United States
    device = 'desktop',
    languageCode = 'en',
  } = options;

  console.log(`[DataForSEO] Checking SERP for "${keyword}" (location: ${locationCode}, ${device})`);

  try {
    // Create Basic Auth header
    const credentials = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

    // Build request body (DataForSEO expects array of tasks)
    const requestBody = [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        device: device === 'mobile' ? 'mobile' : 'desktop',
        os: device === 'mobile' ? 'android' : undefined,
        depth: 100, // Get up to 100 results
        calculate_rectangles: false, // Don't need visual positioning (saves cost)
      },
    ];

    console.log(`[DataForSEO] Request:`, JSON.stringify(requestBody, null, 2));

    // Make API request
    const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/organic/live/advanced`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
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
        console.error(`[DataForSEO] API Error Response:`, errorBody);
      } catch {
        try {
          errorDetails = await response.text();
          console.error(`[DataForSEO] API Error Text:`, errorDetails);
        } catch {
          errorDetails = 'Unable to read error response';
        }
      }
      throw new Error(`DataForSEO API error: ${response.status} ${response.statusText} - ${errorDetails}`);
    }

    const data = await response.json();

    // DataForSEO returns array of task results
    console.log(`[DataForSEO] Response status code:`, data.status_code);
    console.log(`[DataForSEO] Response status message:`, data.status_message);
    console.log(`[DataForSEO] Tasks count:`, data.tasks?.length || 0);

    if (!data.tasks || data.tasks.length === 0) {
      throw new Error('No tasks returned from DataForSEO API');
    }

    const task = data.tasks[0];
    if (task.status_code !== 20000) {
      throw new Error(`DataForSEO task error: ${task.status_message}`);
    }

    const result = task.result?.[0];
    if (!result) {
      throw new Error('No result data in DataForSEO response');
    }

    console.log(`[DataForSEO] Items in result:`, result.items?.length || 0);

    // Parse response and extract data
    const serpData = parseDataForSEOResponse(result, keyword, targetDomain);

    console.log(
      `[DataForSEO] ✓ "${keyword}" - Position: ${serpData.organicPosition || 'Not in top 100'}, ` +
        `Ads: ${serpData.competitorAdsCount}, Features: ${getSERPFeaturesSummary(serpData)}`
    );

    return serpData;
  } catch (error) {
    console.error(`[DataForSEO] Error checking SERP for "${keyword}":`, error);

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
  options: SERPCheckOptions & { delayMs?: number } = {}
): Promise<Map<string, SERPData>> {
  const { delayMs = 1000 } = options; // 1 second delay between requests

  console.log(`[DataForSEO] Batch checking ${keywords.length} keywords (${delayMs}ms delay between requests)`);

  const results = new Map<string, SERPData>();
  const errors: string[] = [];

  // Process keywords sequentially to respect rate limits
  for (let i = 0; i < keywords.length; i++) {
    const { keyword, targetDomain } = keywords[i];

    try {
      const serpData = await checkSERPPosition(keyword, targetDomain, options);
      results.set(keyword, serpData);
    } catch (error) {
      console.error(`[DataForSEO] Failed to check "${keyword}":`, error);
      errors.push(`${keyword}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Rate limiting delay (except for last item)
    if (i < keywords.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[DataForSEO] Batch complete: ${results.size}/${keywords.length} successful, ${errors.length} errors`);

  if (errors.length > 0) {
    console.error(`[DataForSEO] Errors:`, errors);
  }

  return results;
}

/**
 * Parse DataForSEO API response into structured SERP data
 */
function parseDataForSEOResponse(
  result: any,
  keyword: string,
  targetDomain: string
): SERPData {
  const items = result.items || [];

  // Separate different result types
  const organicResults: any[] = [];
  const paidResults: any[] = [];
  const serpFeatures: any[] = [];

  for (const item of items) {
    if (item.type === 'organic') {
      organicResults.push(item);
    } else if (item.type === 'paid') {
      paidResults.push(item);
    } else {
      serpFeatures.push(item);
    }
  }

  console.log(`[DataForSEO] Organic: ${organicResults.length}, Paid: ${paidResults.length}, Features: ${serpFeatures.length}`);

  // Find target domain position in organic results
  const { position, url } = findDomainPosition(organicResults, targetDomain);

  // Detect SERP features
  const serpFeaturesDetected = detectSERPFeatures(serpFeatures);

  // Extract competitor ad domains
  const topAdDomains = extractAdDomains(paidResults.filter(ad => ad.position?.startsWith('ad_top')));
  const bottomAdDomains = extractAdDomains(paidResults.filter(ad => ad.position?.startsWith('ad_bottom')));

  // Extract organic competitor domains
  const organicCompetitors = extractOrganicDomains(organicResults);
  const organicTop3Domains = organicCompetitors.slice(0, 3);

  // Estimate API cost (rough estimate based on DataForSEO pricing)
  const apiCostCents = 3; // ~$0.025 per SERP request (rounded to 3 cents)

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
    competitorAdsCount: paidResults.length,
    topAdsCount: topAdDomains.length,
    bottomAdsCount: bottomAdDomains.length,
    topAdDomains,
    bottomAdDomains,
    organicCompetitors,
    organicTop3Domains,
    fetchedAt: new Date().toISOString(),
    serpFeaturesRaw: serpFeatures,
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
    const resultDomain = extractDomain(result.url || '');

    if (normalizedTarget === resultDomain) {
      return {
        position: result.rank_absolute || i + 1,
        url: result.url,
      };
    }
  }

  return { position: null, url: null };
}

/**
 * Detect SERP features from DataForSEO items
 */
function detectSERPFeatures(serpFeatures: any[]): {
  featuredSnippet: boolean;
  localPack: boolean;
  shoppingAds: boolean;
  peopleAlsoAsk: boolean;
  relatedSearches: boolean;
} {
  const featureTypes = new Set(serpFeatures.map(f => f.type));

  return {
    featuredSnippet: featureTypes.has('featured_snippet') || featureTypes.has('answer_box'),
    localPack: featureTypes.has('local_pack') || featureTypes.has('map'),
    shoppingAds: featureTypes.has('shopping') || featureTypes.has('shopping_carousel'),
    peopleAlsoAsk: featureTypes.has('people_also_ask') || featureTypes.has('related_questions'),
    relatedSearches: featureTypes.has('related_searches'),
  };
}

/**
 * Extract domains from paid ad results
 */
function extractAdDomains(ads: any[]): string[] {
  return ads
    .map((ad) => {
      const url = ad.url || ad.website_link || '';
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
      const url = result.url || '';
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
  const costPerCheck = 0.025; // $0.025 per SERP check
  const checksPerMonth = keywordCount * checksPerDay * 30; // 30 days
  return Math.round(checksPerMonth * costPerCheck * 100) / 100; // Round to 2 decimals
}

/**
 * Map Google Ads location code to DataForSEO location code
 * Most are the same, but this provides a mapping layer if needed
 */
export function mapGoogleAdsLocationToDataForSEO(googleAdsLocationCode: string): number {
  // Most Google Ads geo codes match DataForSEO location codes
  // Just convert to number
  return parseInt(googleAdsLocationCode) || 2840; // Default to US
}
