/**
 * Google Autocomplete API Integration
 *
 * Fetches keyword suggestions from Google's autocomplete service
 * - Unlimited requests (rate limited)
 * - No API key required
 * - Real-time user search suggestions
 * - Long-tail keyword discovery
 */

export interface AutocompleteResult {
  keyword: string;
  suggestions: string[];
  totalSuggestions: number;
  fetchedAt: string;
  source: 'google_autocomplete';
}

/**
 * Fetch autocomplete suggestions from Google
 * Uses the same API that powers google.com search box
 */
export async function getGoogleAutocompleteSuggestions(
  keyword: string,
  options: {
    language?: string;
    country?: string; // e.g., 'us', 'gb', 'pt'
    limit?: number;
  } = {}
): Promise<AutocompleteResult> {
  const {
    language = 'en',
    country = 'us',
    limit = 10,
  } = options;

  try {
    // Google Autocomplete API endpoint
    // client=firefox returns JSON (chrome returns JSONP)
    const url = new URL('https://suggestqueries.google.com/complete/search');
    url.searchParams.set('client', 'firefox');
    url.searchParams.set('q', keyword);
    url.searchParams.set('hl', language);
    url.searchParams.set('gl', country);

    console.log(`[Autocomplete] Fetching suggestions for: "${keyword}"`);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KeywordResearch/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Autocomplete API error: ${response.status}`);
    }

    // Response format: [query, [suggestions], {...}, {...}]
    const data = await response.json();
    const suggestions: string[] = Array.isArray(data[1]) ? data[1] : [];

    console.log(`[Autocomplete] ✓ Found ${suggestions.length} suggestions for "${keyword}"`);

    return {
      keyword,
      suggestions: suggestions.slice(0, limit),
      totalSuggestions: suggestions.length,
      fetchedAt: new Date().toISOString(),
      source: 'google_autocomplete',
    };
  } catch (error) {
    console.error('[Autocomplete] Error fetching suggestions:', error);
    return {
      keyword,
      suggestions: [],
      totalSuggestions: 0,
      fetchedAt: new Date().toISOString(),
      source: 'google_autocomplete',
    };
  }
}

/**
 * Fetch autocomplete suggestions with modifier prefixes
 * Expands keyword with common question words and modifiers
 */
export async function getExpandedAutocompleteSuggestions(
  keyword: string,
  options: {
    language?: string;
    country?: string;
    includeQuestions?: boolean;
    includeModifiers?: boolean;
  } = {}
): Promise<Map<string, string[]>> {
  const {
    language = 'en',
    country = 'us',
    includeQuestions = true,
    includeModifiers = true,
  } = options;

  const allSuggestions = new Map<string, string[]>();

  // Queries to expand
  const queries: string[] = [keyword];

  // Add question modifiers
  if (includeQuestions) {
    queries.push(
      `how to ${keyword}`,
      `what is ${keyword}`,
      `why ${keyword}`,
      `when ${keyword}`,
      `where ${keyword}`,
      `who ${keyword}`,
      `which ${keyword}`
    );
  }

  // Add commercial modifiers
  if (includeModifiers) {
    queries.push(
      `best ${keyword}`,
      `top ${keyword}`,
      `cheap ${keyword}`,
      `buy ${keyword}`,
      `${keyword} price`,
      `${keyword} cost`,
      `${keyword} review`,
      `${keyword} vs`,
      `${keyword} near me`
    );
  }

  // Fetch all in parallel (with rate limiting)
  const batchSize = 5; // Don't overwhelm the API
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(q => getGoogleAutocompleteSuggestions(q, { language, country, limit: 10 }))
    );

    results.forEach(result => {
      if (result.suggestions.length > 0) {
        allSuggestions.set(result.keyword, result.suggestions);
      }
    });

    // Rate limiting: small delay between batches
    if (i + batchSize < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[Autocomplete] Expanded "${keyword}" into ${allSuggestions.size} query variations with ${Array.from(allSuggestions.values()).flat().length} total suggestions`);

  return allSuggestions;
}

/**
 * Get alphabet soup suggestions (keyword + a, keyword + b, etc.)
 * Great for discovering long-tail variations
 */
export async function getAlphabetSoupSuggestions(
  keyword: string,
  options: {
    language?: string;
    country?: string;
  } = {}
): Promise<Map<string, string[]>> {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  const suggestions = new Map<string, string[]>();

  // Fetch in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < alphabet.length; i += batchSize) {
    const batch = alphabet.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(letter =>
        getGoogleAutocompleteSuggestions(`${keyword} ${letter}`, options)
      )
    );

    results.forEach(result => {
      if (result.suggestions.length > 0) {
        suggestions.set(result.keyword, result.suggestions);
      }
    });

    // Small delay between batches
    if (i + batchSize < alphabet.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const totalSuggestions = Array.from(suggestions.values()).flat().length;
  console.log(`[Autocomplete] Alphabet soup for "${keyword}": ${suggestions.size} letters found ${totalSuggestions} suggestions`);

  return suggestions;
}

/**
 * Deduplicate and clean suggestions
 */
export function cleanSuggestions(suggestions: string[]): string[] {
  return Array.from(new Set(
    suggestions
      .map(s => s.toLowerCase().trim())
      .filter(s => s.length > 0)
  ));
}

/**
 * Get autocomplete suggestions with caching
 */
export async function getCachedAutocompleteSuggestions(
  keyword: string,
  options: {
    language?: string;
    country?: string;
    useCache?: boolean;
  } = {}
): Promise<AutocompleteResult> {
  // TODO: Implement caching with PostgreSQL
  // For now, fetch directly
  return getGoogleAutocompleteSuggestions(keyword, options);
}
