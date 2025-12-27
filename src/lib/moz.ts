/**
 * Moz API Integration
 *
 * Provides search intent classification and keyword metrics
 * API Docs: https://moz.com/help/links-api
 */

export type IntentType = 'informational' | 'navigational' | 'commercial' | 'transactional';

export interface MozIntentScore {
  label: IntentType;
  score: number;
}

export interface MozIntentResult {
  keyword: string;
  primaryIntent: IntentType | null;
  allIntents: MozIntentScore[];
  isTransactional: boolean; // commercial or transactional > 0.4
  isInformational: boolean; // informational > 0.4
  isNavigational: boolean; // navigational > 0.4
  shouldBlock: boolean; // Helper: low buying intent
  confidence: number; // Highest intent score
  error?: string;
}

export interface MozKeywordMetrics {
  keyword: string;
  volume: number;
  difficulty: number;
  organicCtr: number;
  priority: number;
  error?: string;
}

// Moz API cost tracking (credits per call)
const MOZ_CREDITS = {
  searchIntent: 1,
  keywordMetrics: 1,
  urlMetrics: 1,
};

/**
 * Get Moz API token from environment or user settings
 */
function getMozToken(): string | null {
  // First check environment
  if (process.env.MOZ_API_TOKEN) {
    return process.env.MOZ_API_TOKEN;
  }
  // Token can also be passed directly
  return null;
}

/**
 * Make a JSON-RPC request to Moz API
 */
async function mozRpcRequest(method: string, params: any, token?: string): Promise<any> {
  const apiToken = token || getMozToken();

  if (!apiToken) {
    throw new Error('Moz API token not configured');
  }

  const requestId = `quickads-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const response = await fetch('https://api.moz.com/jsonrpc', {
    method: 'POST',
    headers: {
      'x-moz-token': apiToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      method,
      params,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Moz API error');
  }

  return data.result;
}

/**
 * Fetch search intent for a single keyword
 */
export async function fetchSearchIntent(
  keyword: string,
  options: {
    locale?: string;
    engine?: string;
    device?: string;
    token?: string;
  } = {}
): Promise<MozIntentResult> {
  const {
    locale = 'en-US',
    engine = 'google',
    device = 'desktop',
    token,
  } = options;

  try {
    const result = await mozRpcRequest(
      'data.keyword.search.intent.fetch',
      {
        data: {
          serp_query: {
            keyword,
            locale,
            engine,
            device,
          },
        },
      },
      token
    );

    const intents = result.keyword_intent.all_intents as MozIntentScore[];
    const primaryIntent = result.keyword_intent.primary_intents[0] as IntentType;

    // Calculate helper flags
    const transactionalScore = intents.find(i => i.label === 'transactional')?.score || 0;
    const commercialScore = intents.find(i => i.label === 'commercial')?.score || 0;
    const informationalScore = intents.find(i => i.label === 'informational')?.score || 0;
    const navigationalScore = intents.find(i => i.label === 'navigational')?.score || 0;

    const isTransactional = (transactionalScore + commercialScore) > 0.4;
    const isInformational = informationalScore > 0.4;
    const isNavigational = navigationalScore > 0.4;

    // Should block if low buying intent (informational or navigational without commercial)
    const shouldBlock = !isTransactional && (isInformational || (isNavigational && commercialScore < 0.2));

    // Confidence is the highest score
    const confidence = Math.max(...intents.map(i => i.score));

    return {
      keyword,
      primaryIntent,
      allIntents: intents,
      isTransactional,
      isInformational,
      isNavigational,
      shouldBlock,
      confidence,
    };
  } catch (error) {
    // Return null result for keywords not in Moz database
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not found')) {
      return {
        keyword,
        primaryIntent: null,
        allIntents: [],
        isTransactional: false,
        isInformational: false,
        isNavigational: false,
        shouldBlock: false, // Can't determine, don't block
        confidence: 0,
        error: 'Intent data not available for this keyword',
      };
    }

    return {
      keyword,
      primaryIntent: null,
      allIntents: [],
      isTransactional: false,
      isInformational: false,
      isNavigational: false,
      shouldBlock: false,
      confidence: 0,
      error: errorMessage,
    };
  }
}

/**
 * Fetch search intent for multiple keywords (with rate limiting)
 */
export async function fetchSearchIntentBatch(
  keywords: string[],
  options: {
    locale?: string;
    engine?: string;
    device?: string;
    token?: string;
    concurrency?: number;
    delayMs?: number;
  } = {}
): Promise<MozIntentResult[]> {
  const { concurrency = 5, delayMs = 100, ...fetchOptions } = options;

  const results: MozIntentResult[] = [];

  // Process in batches with concurrency limit
  for (let i = 0; i < keywords.length; i += concurrency) {
    const batch = keywords.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(keyword => fetchSearchIntent(keyword, fetchOptions))
    );

    results.push(...batchResults);

    // Rate limiting delay between batches
    if (i + concurrency < keywords.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Fetch keyword metrics (volume, difficulty, etc.)
 */
export async function fetchKeywordMetrics(
  keyword: string,
  options: {
    locale?: string;
    engine?: string;
    device?: string;
    token?: string;
  } = {}
): Promise<MozKeywordMetrics> {
  const {
    locale = 'en-US',
    engine = 'google',
    device = 'desktop',
    token,
  } = options;

  try {
    const result = await mozRpcRequest(
      'data.keyword.metrics.fetch',
      {
        data: {
          serp_query: {
            keyword,
            locale,
            engine,
            device,
          },
        },
      },
      token
    );

    return {
      keyword,
      volume: result.keyword_metrics.volume,
      difficulty: result.keyword_metrics.difficulty,
      organicCtr: result.keyword_metrics.organic_ctr,
      priority: result.keyword_metrics.priority,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      keyword,
      volume: 0,
      difficulty: 0,
      organicCtr: 0,
      priority: 0,
      error: errorMessage,
    };
  }
}

/**
 * Fetch URL metrics (Domain Authority, Page Authority, Spam Score)
 */
export async function fetchUrlMetrics(
  targets: string[],
  token?: string
): Promise<any[]> {
  const apiToken = token || getMozToken();

  if (!apiToken) {
    throw new Error('Moz API token not configured');
  }

  const response = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targets }),
  });

  const data = await response.json();
  return data.results || [];
}

/**
 * Analyze keywords and return those that should be blocked based on intent
 */
export async function analyzeKeywordsForBlocking(
  keywords: string[],
  options: {
    token?: string;
    minCostThreshold?: number; // Only check keywords with cost above this
  } = {}
): Promise<{
  shouldBlock: MozIntentResult[];
  shouldKeep: MozIntentResult[];
  noData: MozIntentResult[];
  totalCreditsUsed: number;
}> {
  const results = await fetchSearchIntentBatch(keywords, { token: options.token });

  const shouldBlock = results.filter(r => r.shouldBlock && !r.error);
  const shouldKeep = results.filter(r => !r.shouldBlock && !r.error && r.primaryIntent);
  const noData = results.filter(r => r.error || !r.primaryIntent);

  return {
    shouldBlock,
    shouldKeep,
    noData,
    totalCreditsUsed: keywords.length * MOZ_CREDITS.searchIntent,
  };
}
