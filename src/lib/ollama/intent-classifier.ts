/**
 * Ollama Intent Classifier
 *
 * Uses local LLM (phi-3-mini or llama3.2:3b) to classify search intent.
 * Falls back to OpenAI embeddings, then rules-based classification.
 *
 * Priority:
 * 1. Ollama (FREE, local LLM) - Best accuracy
 * 2. OpenAI Embeddings (~FREE, $0.00002/1K tokens) - Good accuracy
 * 3. Rules-based (FREE) - Decent accuracy
 *
 * Intent types:
 * - transactional: User wants to buy/purchase (buy, price, order, shop)
 * - commercial: User is researching before buying (best, review, compare, vs)
 * - informational: User wants to learn (how to, what is, guide, tutorial)
 * - navigational: User wants to find a specific site (brand names, login)
 */

import { generateEmbeddings, cosineSimilarity } from '@/lib/embeddings';

export type SearchIntent = 'transactional' | 'commercial' | 'informational' | 'navigational';

export interface IntentClassification {
  keyword: string;
  intent: SearchIntent;
  confidence: number; // 0-1
  source: 'ollama' | 'embeddings' | 'rules';
}

// Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3:mini'; // or llama3.2:3b
const BATCH_SIZE = 10; // Classify 10 keywords at once

// Rules-based patterns (fallback)
const INTENT_PATTERNS = {
  transactional: [
    'buy', 'purchase', 'order', 'shop', 'price', 'pricing', 'cost',
    'cheap', 'cheapest', 'discount', 'deal', 'sale', 'coupon',
    'subscribe', 'download', 'get', 'hire', 'book', 'reserve',
    'for sale', 'near me', 'delivery', 'shipping', 'checkout',
  ],
  commercial: [
    'best', 'top', 'review', 'reviews', 'compare', 'comparison', 'vs',
    'versus', 'alternative', 'alternatives', 'which', 'recommend',
    'rated', 'ranking', 'pros and cons', 'worth it', 'should i',
  ],
  informational: [
    'how to', 'how do', 'what is', 'what are', 'why', 'when',
    'guide', 'tutorial', 'learn', 'example', 'examples', 'definition',
    'meaning', 'tips', 'ideas', 'ways to', 'steps', 'process',
    'difference between', 'benefits', 'advantages', 'history',
  ],
  navigational: [
    'login', 'log in', 'sign in', 'signin', 'website', 'official',
    'homepage', 'contact', 'support', 'customer service', 'phone number',
    'address', 'location', 'hours', 'account', 'dashboard',
  ],
};

/**
 * Check if Ollama is available
 */
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Classify intent using rules-based patterns (fast fallback)
 */
function classifyWithRules(keyword: string): IntentClassification {
  const lowerKeyword = keyword.toLowerCase();

  // Check each intent pattern
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerKeyword.includes(pattern)) {
        return {
          keyword,
          intent: intent as SearchIntent,
          confidence: 0.7, // Rules are ~70% confident
          source: 'rules',
        };
      }
    }
  }

  // Default to informational if no patterns match
  return {
    keyword,
    intent: 'informational',
    confidence: 0.5,
    source: 'rules',
  };
}

// Reference phrases for each intent (used for embedding similarity)
const INTENT_REFERENCE_PHRASES: Record<SearchIntent, string[]> = {
  transactional: [
    'buy now online',
    'purchase order checkout',
    'shop for sale discount',
    'get price cost cheap',
    'subscribe download deal',
  ],
  commercial: [
    'best top rated review',
    'compare vs alternative',
    'which should I choose',
    'pros and cons comparison',
    'recommendation ranking',
  ],
  informational: [
    'how to guide tutorial',
    'what is definition meaning',
    'learn understand explain',
    'tips examples steps',
    'why when history',
  ],
  navigational: [
    'login sign in account',
    'official website homepage',
    'contact support help',
    'customer service phone',
    'company address location',
  ],
};

// Cached reference embeddings
let referenceEmbeddings: Map<SearchIntent, number[][]> | null = null;

/**
 * Get or generate reference embeddings for intent classification
 */
async function getReferenceEmbeddings(): Promise<Map<SearchIntent, number[][]>> {
  if (referenceEmbeddings) {
    return referenceEmbeddings;
  }

  console.log('[Intent] Generating reference embeddings for intent classification...');

  referenceEmbeddings = new Map();

  for (const [intent, phrases] of Object.entries(INTENT_REFERENCE_PHRASES)) {
    const embeddings = await generateEmbeddings(phrases);
    referenceEmbeddings.set(intent as SearchIntent, embeddings);
  }

  console.log('[Intent] Reference embeddings generated');
  return referenceEmbeddings;
}

/**
 * Classify intent using OpenAI embeddings (secondary fallback)
 */
async function classifyWithEmbeddings(keywords: string[]): Promise<IntentClassification[]> {
  try {
    // Get reference embeddings
    const references = await getReferenceEmbeddings();

    // Generate embeddings for keywords
    const keywordEmbeddings = await generateEmbeddings(keywords);

    // Classify each keyword
    return keywordEmbeddings.map((embedding, index) => {
      let bestIntent: SearchIntent = 'informational';
      let bestScore = -1;

      // Compare against each intent's reference embeddings
      for (const [intent, refEmbeddings] of references.entries()) {
        // Calculate average similarity to all reference phrases
        const similarities = refEmbeddings.map(ref => cosineSimilarity(embedding, ref));
        const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
        const maxSimilarity = Math.max(...similarities);

        // Use weighted combination of avg and max
        const score = avgSimilarity * 0.4 + maxSimilarity * 0.6;

        if (score > bestScore) {
          bestScore = score;
          bestIntent = intent;
        }
      }

      return {
        keyword: keywords[index],
        intent: bestIntent,
        confidence: Math.min(0.95, bestScore), // Cap at 0.95
        source: 'embeddings' as const,
      };
    });
  } catch (error) {
    console.error('[Intent] Embeddings classification error:', error);
    // Fallback to rules for all keywords
    return keywords.map(classifyWithRules);
  }
}

/**
 * Classify intent using Ollama LLM (batch)
 */
async function classifyWithOllama(keywords: string[]): Promise<IntentClassification[]> {
  const prompt = `Classify the search intent of each keyword. Respond ONLY with a JSON array.

Intent types:
- transactional: User wants to buy/purchase
- commercial: User is researching before buying
- informational: User wants to learn/understand
- navigational: User wants to find a specific website

Keywords:
${keywords.map((k, i) => `${i + 1}. "${k}"`).join('\n')}

Respond with JSON array only, no explanation:
[{"keyword": "...", "intent": "transactional|commercial|informational|navigational", "confidence": 0.0-1.0}, ...]`;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for consistent classification
          num_predict: 500, // Limit response length
        },
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.response || '';

    // Extract JSON from response (Ollama sometimes adds explanation)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array in response');
    }

    // Try to parse JSON, with repair attempts for common LLM issues
    let results: Array<{ keyword: string; intent: string; confidence: number }>;
    try {
      results = JSON.parse(jsonMatch[0]);
    } catch {
      // Try to repair common JSON issues from LLMs
      let cleanedJson = jsonMatch[0]
        .replace(/,\s*}/g, '}')  // Remove trailing commas before }
        .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
        .replace(/'/g, '"')       // Replace single quotes with double quotes
        .replace(/(\w+):/g, '"$1":') // Quote unquoted keys
        .replace(/""/g, '"');     // Fix double quotes

      try {
        results = JSON.parse(cleanedJson);
      } catch {
        // If still fails, fall back to rules for this batch
        console.error('[Ollama] Could not parse JSON even after repair, using rules fallback');
        return keywords.map(classifyWithRules);
      }
    }

    return results.map(r => ({
      keyword: r.keyword,
      intent: (r.intent as SearchIntent) || 'informational',
      confidence: Math.min(1, Math.max(0, r.confidence || 0.8)),
      source: 'ollama' as const,
    }));
  } catch (error) {
    console.error('[Ollama] Classification error:', error);
    // Fallback to rules for this batch
    return keywords.map(classifyWithRules);
  }
}

/**
 * Classify search intent for multiple keywords
 * Priority: Rules-based (instant, reliable) → OpenAI Embeddings (better accuracy) → Ollama (if available)
 *
 * Changed default to rules-based because Ollama/embeddings are unreliable
 */
export async function classifySearchIntent(keywords: string[]): Promise<IntentClassification[]> {
  if (keywords.length === 0) {
    return [];
  }

  // Use rules-based classification by default (fast and reliable)
  console.log(`[Intent] Classifying ${keywords.length} keywords with rules-based method`);
  const rulesResults = keywords.map(classifyWithRules);

  // Try to enhance with OpenAI embeddings for keywords where rules gave low confidence
  const lowConfidenceKeywords = rulesResults.filter(r => r.confidence < 0.6);

  if (lowConfidenceKeywords.length > 0 && process.env.OPENAI_API_KEY) {
    console.log(`[Intent] Enhancing ${lowConfidenceKeywords.length} low-confidence keywords with embeddings`);
    try {
      const enhancedResults = await classifyWithEmbeddings(lowConfidenceKeywords.map(r => r.keyword));

      // Merge enhanced results back
      const enhancedMap = new Map(enhancedResults.map(r => [r.keyword, r]));
      return rulesResults.map(r => {
        const enhanced = enhancedMap.get(r.keyword);
        if (enhanced && enhanced.confidence > r.confidence) {
          return enhanced;
        }
        return r;
      });
    } catch (error) {
      console.error('[Intent] Embeddings enhancement failed, using rules only:', error);
    }
  }

  console.log(`[Intent] Classified ${rulesResults.length} keywords via rules`);
  return rulesResults;
}

/**
 * Classify a single keyword (uses rules for instant response)
 */
export function classifySearchIntentSync(keyword: string): IntentClassification {
  return classifyWithRules(keyword);
}

/**
 * Get intent icon for display
 */
export function getIntentIcon(intent: SearchIntent): string {
  switch (intent) {
    case 'transactional':
      return '🛒'; // Shopping cart
    case 'commercial':
      return '🔍'; // Magnifying glass
    case 'informational':
      return '📚'; // Books
    case 'navigational':
      return '🧭'; // Compass
    default:
      return '❓';
  }
}

/**
 * Get intent label for display
 */
export function getIntentLabel(intent: SearchIntent): string {
  switch (intent) {
    case 'transactional':
      return 'Buy';
    case 'commercial':
      return 'Research';
    case 'informational':
      return 'Learn';
    case 'navigational':
      return 'Navigate';
    default:
      return 'Unknown';
  }
}

/**
 * Get intent color for UI
 */
export function getIntentColor(intent: SearchIntent): { bg: string; text: string } {
  switch (intent) {
    case 'transactional':
      return { bg: 'bg-green-100', text: 'text-green-700' };
    case 'commercial':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    case 'informational':
      return { bg: 'bg-blue-100', text: 'text-blue-700' };
    case 'navigational':
      return { bg: 'bg-gray-100', text: 'text-gray-700' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-500' };
  }
}
