/**
 * Negative Keywords AI Suggest API
 *
 * POST: Analyze search terms and suggest negative keywords
 * Uses tiered approach:
 * 1. Rules (free) - exact/partial text matching
 * 2. Embeddings ($0.00002/1K tokens) - semantic similarity
 * 3. Moz (optional) - validate with real search intent data
 * 4. AI (optional) - Claude/DeepSeek for complex cases
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddings, cosineSimilarity } from '@/lib/embeddings';
import { fetchSearchIntentBatch, MozIntentResult } from '@/lib/moz';

// Moz API cost (estimated credits per keyword)
const MOZ_COST_PER_KEYWORD = 0.001; // ~$0.001 per keyword intent lookup

// Embedding cost: text-embedding-3-small = $0.00002 per 1K tokens
// Avg search term ~3-5 tokens, pattern ~2-3 tokens
const EMBEDDING_COST_PER_1K_TOKENS = 0.00002;
const AVG_TOKENS_PER_TERM = 4;

// Expanded negative keyword patterns (16 categories)
const NEGATIVE_PATTERNS = {
  // Original 6 categories
  free: ['free', 'gratis', 'no cost', 'complimentary', 'freebie', 'giveaway', 'free trial', 'free download'],
  jobs: ['jobs', 'careers', 'hiring', 'employment', 'salary', 'resume', 'cv', 'job opening', 'work from home jobs', 'internship', 'vacancy'],
  diy: ['diy', 'how to', 'tutorial', 'guide', 'instructions', 'make your own', 'homemade', 'self made', 'step by step'],
  cheap: ['cheap', 'cheapest', 'budget', 'discount', 'clearance', 'sale', 'bargain', 'low cost', 'affordable'],
  informational: ['what is', 'define', 'meaning', 'definition', 'wiki', 'wikipedia', 'examples', 'vs', 'versus', 'difference between'],
  competitors: ['amazon', 'ebay', 'walmart', 'alibaba', 'craigslist', 'etsy', 'wish'],
  // New 8 categories
  reviews: ['review', 'reviews', 'rating', 'ratings', 'complaint', 'complaints', 'scam', 'legit', 'reddit', 'trustpilot'],
  support: ['support', 'help', 'customer service', 'contact', 'phone number', 'email', 'chat', 'troubleshoot'],
  login: ['login', 'log in', 'sign in', 'signin', 'account', 'password', 'forgot password', 'reset password'],
  refund: ['refund', 'return', 'cancel', 'cancellation', 'money back', 'chargeback', 'dispute'],
  legal: ['lawsuit', 'sue', 'legal', 'attorney', 'lawyer', 'court', 'class action'],
  education: ['course', 'class', 'training', 'certification', 'degree', 'learn', 'school', 'university', 'pdf', 'ebook'],
  location: ['near me', 'nearby', 'local', 'in my area', 'closest', 'directions to'],
  wholesale: ['wholesale', 'bulk', 'resale', 'reseller', 'distributor', 'supplier', 'manufacturer'],
};

interface SearchTerm {
  searchTerm: string;
  cost: number;
  conversions: number;
  clicks: number;
  impressions: number;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
}

interface NegativeSuggestion {
  searchTerm: string;
  reason: string;
  category: string;
  confidence: number;
  cost: number;
  potentialSavings: number;
  similarTo?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  // Traceability fields
  analysisMethod: 'rule' | 'embedding' | 'claude' | 'deepseek' | 'moz';
  analysisCost: number; // Cost in USD for this analysis
}

// Track analysis costs
interface AnalysisCosts {
  rules: number;
  embeddings: number;
  ai: number;
  total: number;
  breakdown: { method: string; count: number; cost: number }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      searchTerms,
      threshold = 0.75,
      useMoz = false,
      mozMinCost = 2, // Only check with Moz if term cost > this amount
    } = body as {
      searchTerms: SearchTerm[];
      threshold?: number;
      useMoz?: boolean;
      mozMinCost?: number;
    };

    if (!searchTerms || !Array.isArray(searchTerms)) {
      return NextResponse.json({
        error: 'searchTerms array is required',
      }, { status: 400 });
    }

    // Filter to potential wasters (cost > 0, no conversions)
    const wasters = searchTerms.filter(st => st.cost > 0 && st.conversions === 0);

    if (wasters.length === 0) {
      return NextResponse.json({
        suggestions: [],
        summary: {
          analyzed: searchTerms.length,
          wastersFound: 0,
          potentialSavings: 0,
        },
        message: 'No wasteful search terms found. Your campaigns look efficient!',
      });
    }

    // Generate embeddings for waster search terms
    const wasterTexts = wasters.map(w => w.searchTerm);
    const wasterEmbeddings = await generateEmbeddings(wasterTexts);

    // Generate embeddings for negative patterns
    const allPatterns = Object.entries(NEGATIVE_PATTERNS).flatMap(([category, patterns]) =>
      patterns.map(p => ({ pattern: p, category }))
    );
    const patternTexts = allPatterns.map(p => p.pattern);
    const patternEmbeddings = await generateEmbeddings(patternTexts);

    // Find matches and track costs
    const suggestions: NegativeSuggestion[] = [];
    let ruleMatches = 0;
    let embeddingMatches = 0;

    // Calculate embedding cost upfront (we generated embeddings for all wasters + patterns)
    const totalTokensForEmbeddings = (wasters.length + patternTexts.length) * AVG_TOKENS_PER_TERM;
    const embeddingGenerationCost = (totalTokensForEmbeddings / 1000) * EMBEDDING_COST_PER_1K_TOKENS;

    for (let i = 0; i < wasters.length; i++) {
      const waster = wasters[i];
      const wasterEmb = wasterEmbeddings[i];

      let bestMatch = {
        pattern: '',
        category: '',
        similarity: 0,
      };

      // Find most similar pattern
      for (let j = 0; j < patternEmbeddings.length; j++) {
        const similarity = cosineSimilarity(wasterEmb, patternEmbeddings[j]);
        if (similarity > bestMatch.similarity) {
          bestMatch = {
            pattern: allPatterns[j].pattern,
            category: allPatterns[j].category,
            similarity,
          };
        }
      }

      // Also check for exact/partial matches in text
      const lowerTerm = waster.searchTerm.toLowerCase();
      let textMatchCategory = '';
      let textMatchPattern = '';

      for (const [category, patterns] of Object.entries(NEGATIVE_PATTERNS)) {
        for (const pattern of patterns) {
          if (lowerTerm.includes(pattern.toLowerCase())) {
            textMatchCategory = category;
            textMatchPattern = pattern;
            break;
          }
        }
        if (textMatchCategory) break;
      }

      // Determine reason, confidence, and analysis method
      let reason = '';
      let category = '';
      let confidence = 0;
      let similarTo = '';
      let analysisMethod: 'rule' | 'embedding' | 'claude' | 'deepseek' | 'moz' = 'rule';
      let analysisCost = 0;

      if (textMatchCategory) {
        // Exact text match - high confidence, FREE (rule-based)
        reason = `Contains "${textMatchPattern}" - likely ${textMatchCategory} intent`;
        category = textMatchCategory;
        confidence = 0.95;
        similarTo = textMatchPattern;
        analysisMethod = 'rule';
        analysisCost = 0; // Rules are free
        ruleMatches++;
      } else if (bestMatch.similarity >= threshold) {
        // Semantic match - costs embedding tokens
        reason = `Semantically similar to ${bestMatch.category} keywords`;
        category = bestMatch.category;
        confidence = bestMatch.similarity;
        similarTo = bestMatch.pattern;
        analysisMethod = 'embedding';
        // Cost: ~4 tokens per term at $0.00002/1K tokens
        analysisCost = (AVG_TOKENS_PER_TERM / 1000) * EMBEDDING_COST_PER_1K_TOKENS;
        embeddingMatches++;
      } else if (waster.clicks > 10 && waster.conversions === 0) {
        // High clicks, no conversions - rule-based metric analysis
        reason = 'High clicks but zero conversions - poor intent match';
        category = 'low_intent';
        confidence = 0.7;
        analysisMethod = 'rule';
        analysisCost = 0;
        ruleMatches++;
      } else if (waster.cost > 20 && waster.conversions === 0) {
        // High cost waster - rule-based metric analysis
        reason = 'High spend with no conversions';
        category = 'expensive_waster';
        confidence = 0.65;
        analysisMethod = 'rule';
        analysisCost = 0;
        ruleMatches++;
      }

      if (reason) {
        suggestions.push({
          searchTerm: waster.searchTerm,
          reason,
          category,
          confidence,
          cost: waster.cost,
          potentialSavings: waster.cost * 0.9, // Assume 90% savings if blocked
          similarTo,
          campaignId: waster.campaignId,
          campaignName: waster.campaignName,
          adGroupId: waster.adGroupId,
          adGroupName: waster.adGroupName,
          analysisMethod,
          analysisCost,
        });
      }
    }

    // Optional: Validate with Moz intent data
    let mozValidations = 0;
    let mozFalsePositives = 0;
    let mozCost = 0;
    const mozResults: Map<string, MozIntentResult> = new Map();

    if (useMoz && process.env.MOZ_API_TOKEN) {
      // Only validate high-cost suggestions to save API calls
      const toValidate = suggestions.filter(s => s.cost >= mozMinCost);

      if (toValidate.length > 0) {
        console.log(`[Negative Suggest] Validating ${toValidate.length} terms with Moz...`);

        const mozIntents = await fetchSearchIntentBatch(
          toValidate.map(s => s.searchTerm),
          { token: process.env.MOZ_API_TOKEN, concurrency: 5, delayMs: 100 }
        );

        // Store results and identify false positives
        for (let i = 0; i < toValidate.length; i++) {
          const suggestion = toValidate[i];
          const intent = mozIntents[i];
          mozResults.set(suggestion.searchTerm, intent);
          mozValidations++;

          // If Moz says it's transactional/commercial, it's a false positive
          if (intent.isTransactional && !intent.error) {
            console.log(`[Moz] False positive: "${suggestion.searchTerm}" is ${intent.primaryIntent} (${Math.round(intent.confidence * 100)}%)`);
            mozFalsePositives++;
          }
        }

        mozCost = toValidate.length * MOZ_COST_PER_KEYWORD;
      }
    }

    // Filter out Moz-validated false positives and update analysis method
    const validatedSuggestions = suggestions.map(s => {
      const mozResult = mozResults.get(s.searchTerm);
      if (mozResult && !mozResult.error) {
        // Update with Moz validation
        if (mozResult.isTransactional) {
          // This is a false positive - mark for removal
          return null;
        }
        // Update confidence and method
        return {
          ...s,
          analysisMethod: 'moz' as const,
          analysisCost: s.analysisCost + MOZ_COST_PER_KEYWORD,
          confidence: Math.max(s.confidence, mozResult.confidence),
          reason: `${s.reason} (Moz: ${mozResult.primaryIntent} intent)`,
        };
      }
      return s;
    }).filter((s): s is NegativeSuggestion => s !== null);

    // Sort by potential savings (highest first)
    validatedSuggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);

    // Calculate totals
    const totalSavings = validatedSuggestions.reduce((sum, s) => sum + s.potentialSavings, 0);
    const totalAnalysisCost = validatedSuggestions.reduce((sum, s) => sum + s.analysisCost, 0) + embeddingGenerationCost + mozCost;

    // Group by category for summary
    const byCategory: Record<string, { count: number; savings: number }> = {};
    for (const s of validatedSuggestions) {
      if (!byCategory[s.category]) {
        byCategory[s.category] = { count: 0, savings: 0 };
      }
      byCategory[s.category].count++;
      byCategory[s.category].savings += s.potentialSavings;
    }

    // Count Moz-validated suggestions
    const mozMatchCount = validatedSuggestions.filter(s => s.analysisMethod === 'moz').length;

    // Group by analysis method for cost breakdown
    const byMethod: Record<string, { count: number; cost: number }> = {
      rule: { count: ruleMatches, cost: 0 },
      embedding: { count: embeddingMatches, cost: embeddingGenerationCost },
      moz: { count: mozMatchCount, cost: mozCost },
    };

    // Build cost breakdown
    const analysisCosts: AnalysisCosts = {
      rules: 0,
      embeddings: embeddingGenerationCost,
      ai: mozCost, // Moz is external API cost
      total: totalAnalysisCost,
      breakdown: [
        { method: 'Rules (pattern matching)', count: ruleMatches, cost: 0 },
        { method: 'Embeddings (semantic)', count: embeddingMatches, cost: embeddingGenerationCost },
        ...(useMoz ? [{ method: 'Moz (intent validation)', count: mozValidations, cost: mozCost }] : []),
      ],
    };

    return NextResponse.json({
      suggestions: validatedSuggestions.slice(0, 50), // Top 50
      summary: {
        analyzed: searchTerms.length,
        wastersFound: wasters.length,
        suggestionsCount: validatedSuggestions.length,
        potentialSavings: totalSavings,
        byCategory,
        byMethod,
        // Moz validation stats
        ...(useMoz && {
          mozValidation: {
            checked: mozValidations,
            falsePositivesRemoved: mozFalsePositives,
            cost: mozCost,
          },
        }),
      },
      analysisCosts,
    });

  } catch (error) {
    console.error('[Negative Suggest API] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to analyze search terms',
    }, { status: 500 });
  }
}
