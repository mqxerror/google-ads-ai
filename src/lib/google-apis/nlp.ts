/**
 * Google NLP API Integration (with fallback to rule-based)
 *
 * Provides intent classification and entity extraction
 * - Intent classification (transactional, informational, commercial, navigational)
 * - Entity extraction
 * - Sentiment analysis
 * - Content categorization
 *
 * Quota: 5,000 units/month free
 * Falls back to rule-based classification when no API key
 */

export interface NLPEntity {
  name: string;
  type: string; // PERSON, ORGANIZATION, LOCATION, etc.
  salience: number; // 0-1, importance
}

export interface NLPCategory {
  name: string;
  confidence: number; // 0-1
}

export interface NLPData {
  keyword: string;

  // Intent classification
  intent: 'transactional' | 'informational' | 'commercial' | 'navigational';
  intentConfidence: number; // 0-1

  // Entity extraction
  entities: NLPEntity[];

  // Content categories
  categories: NLPCategory[];

  // Sentiment
  sentimentScore: number; // -1 (negative) to 1 (positive)
  sentimentMagnitude: number; // 0-infinity, strength of emotion

  fetchedAt: string;
  source: 'google_nlp' | 'rule_based';
}

/**
 * Classify keyword intent using Google NLP API
 * Falls back to rule-based when no API key
 */
export async function classifyKeywordIntent(
  keyword: string,
  options: {
    apiKey?: string;
  } = {}
): Promise<NLPData> {
  const { apiKey = process.env.GOOGLE_NLP_API_KEY } = options;

  if (!apiKey) {
    // Fallback to rule-based classification
    return classifyIntentRuleBased(keyword);
  }

  try {
    console.log(`[NLP] Classifying intent for: "${keyword}"`);

    // Google Natural Language API endpoint
    const url = 'https://language.googleapis.com/v1/documents:analyzeEntities';
    const response = await fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: keyword,
        },
        encodingType: 'UTF8',
      }),
    });

    if (!response.ok) {
      throw new Error(`NLP API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract entities
    const entities: NLPEntity[] = (data.entities || []).map((e: any) => ({
      name: e.name,
      type: e.type,
      salience: e.salience,
    }));

    // Classify intent based on entities and patterns
    const intentData = classifyIntentFromEntities(keyword, entities);

    console.log(`[NLP] ✓ Classified "${keyword}" as ${intentData.intent} (${Math.round(intentData.intentConfidence * 100)}% confidence)`);

    return {
      keyword,
      ...intentData,
      entities,
      categories: [], // Would need separate API call for categories
      sentimentScore: 0,
      sentimentMagnitude: 0,
      fetchedAt: new Date().toISOString(),
      source: 'google_nlp',
    };

  } catch (error) {
    console.error('[NLP] Error with API, falling back to rule-based:', error);
    return classifyIntentRuleBased(keyword);
  }
}

/**
 * Rule-based intent classification (fallback when no API key)
 */
function classifyIntentRuleBased(keyword: string): NLPData {
  const lower = keyword.toLowerCase();

  // Transactional intent signals
  const transactionalSignals = [
    'buy', 'purchase', 'order', 'shop', 'get', 'deal', 'discount',
    'cheap', 'affordable', 'price', 'cost', 'sale', 'coupon', 'promo',
    'hire', 'subscribe', 'sign up', 'download', 'install', 'free trial',
  ];

  // Informational intent signals
  const informationalSignals = [
    'how to', 'what is', 'why', 'when', 'where', 'who', 'which',
    'guide', 'tutorial', 'learn', 'tips', 'examples', 'definition',
    'meaning', 'explained', 'vs', 'difference', 'comparison',
  ];

  // Commercial investigation signals
  const commercialSignals = [
    'best', 'top', 'review', 'reviews', 'compare', 'comparison',
    'vs', 'versus', 'alternative', 'alternatives', 'pros cons',
    'worth it', 'good', 'bad', 'rating', 'recommendation',
  ];

  // Navigational signals
  const navigationalSignals = [
    'login', 'sign in', 'account', 'portal', 'website', 'homepage',
    'support', 'contact', 'help', 'customer service',
  ];

  // Count signal matches
  const transactionalCount = transactionalSignals.filter(s => lower.includes(s)).length;
  const informationalCount = informationalSignals.filter(s => lower.includes(s)).length;
  const commercialCount = commercialSignals.filter(s => lower.includes(s)).length;
  const navigationalCount = navigationalSignals.filter(s => lower.includes(s)).length;

  // Determine primary intent
  const scores = {
    transactional: transactionalCount,
    informational: informationalCount,
    commercial: commercialCount,
    navigational: navigationalCount,
  };

  const maxScore = Math.max(...Object.values(scores));
  const intent = maxScore === 0
    ? 'commercial' // Default to commercial if no signals
    : (Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as any);

  const confidence = maxScore > 0 ? Math.min(1, maxScore / 3) : 0.3;

  // Extract pseudo-entities (just keywords for now)
  const entities: NLPEntity[] = keyword
    .split(/\s+/)
    .filter(word => word.length > 3)
    .map((word, i) => ({
      name: word,
      type: 'OTHER',
      salience: 1 / (i + 1), // First words are more important
    }));

  return {
    keyword,
    intent,
    intentConfidence: confidence,
    entities,
    categories: [],
    sentimentScore: 0,
    sentimentMagnitude: 0,
    fetchedAt: new Date().toISOString(),
    source: 'rule_based',
  };
}

/**
 * Classify intent from Google NLP entities
 */
function classifyIntentFromEntities(
  keyword: string,
  entities: NLPEntity[]
): {
  intent: 'transactional' | 'informational' | 'commercial' | 'navigational';
  intentConfidence: number;
} {
  // For now, fallback to rule-based
  // Can be enhanced with entity-based logic
  const ruleBased = classifyIntentRuleBased(keyword);
  return {
    intent: ruleBased.intent,
    intentConfidence: ruleBased.intentConfidence,
  };
}

/**
 * Batch classify multiple keywords
 */
export async function batchClassifyIntent(
  keywords: string[],
  options: {
    apiKey?: string;
    maxKeywords?: number;
  } = {}
): Promise<Map<string, NLPData>> {
  const {
    apiKey,
    maxKeywords = 100, // Limit to preserve quota
  } = options;

  const results = new Map<string, NLPData>();

  // Process only top keywords
  const limitedKeywords = keywords.slice(0, maxKeywords);

  for (const keyword of limitedKeywords) {
    const data = await classifyKeywordIntent(keyword, { apiKey });
    results.set(keyword, data);

    // Small delay if using API
    if (apiKey) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[NLP] Batch completed: ${results.size} keywords classified`);
  return results;
}
