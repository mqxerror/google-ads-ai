/**
 * Keyword Factory API
 *
 * Generates keyword variations, synonyms, and match type suggestions
 * for Google Ads campaigns
 *
 * NEW: Optionally enriches keywords with real metrics from external APIs
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { enrichKeywordsWithMetrics } from '@/lib/keyword-data';
import { estimateCost, checkQuotaAvailability } from '@/lib/keyword-data/quota-tracker';
import { enrichmentLogger } from '@/lib/enrichment-logger';

// Location code to Google Ads geoTargetConstant mapping
const LOCATION_GEO_CODES: Record<string, string> = {
  'US': '2840',
  'GB': '2826',
  'CA': '2124',
  'AU': '2036',
  'DE': '2276',
  'FR': '2250',
  'ES': '2724',
  'IT': '2380',
  'PT': '2620',
  'BR': '2076',
  'IN': '2356',
  'SG': '2702',
  'AE': '2784',
};

interface KeywordFactoryRequest {
  seedKeywords: string[];
  options?: {
    generateVariations?: boolean;
    generateSynonyms?: boolean;
    suggestMatchTypes?: boolean;
    includeNegatives?: boolean;
    industry?: string;
    language?: string;
    // NEW: Metrics enrichment options
    enrichWithMetrics?: boolean;
    metricsProviders?: ('google_ads' | 'moz' | 'dataforseo')[];
    maxKeywordsToEnrich?: number;
    minSearchVolume?: number;
    sortByMetrics?: boolean;
    targetLocation?: string; // NEW: Location code (e.g., 'US', 'GB', 'PT')
  };
}

interface GeneratedKeyword {
  keyword: string;
  type: 'seed' | 'variation' | 'synonym' | 'modifier' | 'long_tail';
  source: string;
  suggestedMatchType: 'EXACT' | 'PHRASE' | 'BROAD';
  estimatedIntent: 'transactional' | 'informational' | 'navigational' | 'commercial';
  negativeCandidate?: boolean;
  negativeReason?: string;
  // NEW: Real metrics from APIs
  metrics?: {
    searchVolume: number | null;
    cpc: number | null;
    competition: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    difficulty: number | null;
    organicCtr: number | null;
    dataSource: 'google_ads' | 'moz' | 'dataforseo' | 'cached' | 'unavailable';
    lastUpdated: string;
    cacheAge: number;
  };
  opportunityScore?: number;
}

interface KeywordCluster {
  theme: string;
  keywords: GeneratedKeyword[];
  suggestedAdGroup: string;
}

// Common modifiers for different intents
const MODIFIERS = {
  transactional: ['buy', 'purchase', 'order', 'shop', 'get', 'deal', 'discount', 'cheap', 'affordable', 'price', 'cost', 'sale'],
  informational: ['how to', 'what is', 'guide', 'tutorial', 'learn', 'tips', 'best practices', 'examples'],
  commercial: ['best', 'top', 'review', 'compare', 'vs', 'alternative', 'comparison', 'pros cons'],
  local: ['near me', 'nearby', 'local', 'in [city]', 'closest'],
};

// Common negative keyword indicators
const NEGATIVE_INDICATORS = {
  job_seekers: ['jobs', 'careers', 'hiring', 'salary', 'interview', 'resume', 'cv', 'employment'],
  diy_learners: ['diy', 'how to make', 'tutorial', 'free template', 'download free'],
  wrong_intent: ['login', 'sign in', 'support', 'complaint', 'refund', 'return'],
  competitors: [], // Would be populated based on industry
};

// Synonym mappings for common terms
const SYNONYM_MAP: Record<string, string[]> = {
  'buy': ['purchase', 'order', 'get', 'shop for'],
  'cheap': ['affordable', 'budget', 'low cost', 'inexpensive', 'economical'],
  'best': ['top', 'leading', 'premium', 'quality', 'excellent'],
  'fast': ['quick', 'rapid', 'speedy', 'express', 'instant'],
  'online': ['digital', 'virtual', 'internet', 'web'],
  'service': ['services', 'solution', 'solutions', 'provider'],
  'software': ['tool', 'platform', 'app', 'application', 'system'],
  'agency': ['company', 'firm', 'consultant', 'consultancy'],
  'marketing': ['advertising', 'promotion', 'ads'],
  'seo': ['search engine optimization', 'organic search', 'search optimization'],
  'ppc': ['pay per click', 'paid search', 'sem', 'google ads'],
};

function generateVariations(keyword: string): string[] {
  const variations: string[] = [];
  const words = keyword.toLowerCase().trim().split(/\s+/);

  // Plural/singular variations
  words.forEach((word, index) => {
    if (word.endsWith('s') && word.length > 3) {
      const newWords = [...words];
      newWords[index] = word.slice(0, -1);
      variations.push(newWords.join(' '));
    } else if (!word.endsWith('s') && word.length > 2) {
      const newWords = [...words];
      newWords[index] = word + 's';
      variations.push(newWords.join(' '));
    }
  });

  // Word order variations for multi-word keywords
  if (words.length >= 2 && words.length <= 4) {
    // Reverse two-word phrases
    if (words.length === 2) {
      variations.push(`${words[1]} ${words[0]}`);
    }
    // Move adjective to end
    if (words.length >= 2) {
      const adjectives = ['best', 'top', 'cheap', 'fast', 'professional', 'quality', 'premium'];
      if (adjectives.includes(words[0])) {
        variations.push([...words.slice(1), words[0]].join(' '));
      }
    }
  }

  return [...new Set(variations)].filter(v => v !== keyword);
}

function generateSynonyms(keyword: string): string[] {
  const synonyms: string[] = [];
  const words = keyword.toLowerCase().trim().split(/\s+/);

  words.forEach((word, index) => {
    if (SYNONYM_MAP[word]) {
      SYNONYM_MAP[word].forEach(syn => {
        const newWords = [...words];
        newWords[index] = syn;
        synonyms.push(newWords.join(' '));
      });
    }
  });

  return [...new Set(synonyms)].filter(s => s !== keyword);
}

function addModifiers(keyword: string): GeneratedKeyword[] {
  const results: GeneratedKeyword[] = [];
  const base = keyword.toLowerCase().trim();

  // Transactional modifiers
  MODIFIERS.transactional.slice(0, 5).forEach(mod => {
    results.push({
      keyword: `${mod} ${base}`,
      type: 'modifier',
      source: 'transactional_modifier',
      suggestedMatchType: 'PHRASE',
      estimatedIntent: 'transactional',
    });
  });

  // Commercial investigation modifiers
  MODIFIERS.commercial.slice(0, 3).forEach(mod => {
    results.push({
      keyword: `${mod} ${base}`,
      type: 'modifier',
      source: 'commercial_modifier',
      suggestedMatchType: 'PHRASE',
      estimatedIntent: 'commercial',
    });
  });

  // Local modifiers
  results.push({
    keyword: `${base} near me`,
    type: 'modifier',
    source: 'local_modifier',
    suggestedMatchType: 'PHRASE',
    estimatedIntent: 'transactional',
  });

  return results;
}

function generateLongTail(keyword: string): GeneratedKeyword[] {
  const results: GeneratedKeyword[] = [];
  const base = keyword.toLowerCase().trim();

  // Common long-tail patterns
  const patterns = [
    { template: `${base} for small business`, intent: 'commercial' as const },
    { template: `${base} for beginners`, intent: 'informational' as const },
    { template: `professional ${base}`, intent: 'commercial' as const },
    { template: `${base} pricing`, intent: 'commercial' as const },
    { template: `${base} free trial`, intent: 'transactional' as const },
    { template: `${base} reviews`, intent: 'commercial' as const },
    { template: `${base} examples`, intent: 'informational' as const },
    { template: `affordable ${base}`, intent: 'transactional' as const },
  ];

  patterns.forEach(({ template, intent }) => {
    results.push({
      keyword: template,
      type: 'long_tail',
      source: 'long_tail_pattern',
      suggestedMatchType: intent === 'transactional' ? 'PHRASE' : 'BROAD',
      estimatedIntent: intent,
    });
  });

  return results;
}

function suggestNegatives(keyword: string): GeneratedKeyword[] {
  const results: GeneratedKeyword[] = [];

  // Job seeker negatives
  NEGATIVE_INDICATORS.job_seekers.forEach(neg => {
    results.push({
      keyword: neg,
      type: 'variation',
      source: 'negative_suggestion',
      suggestedMatchType: 'PHRASE',
      estimatedIntent: 'informational',
      negativeCandidate: true,
      negativeReason: 'Job seeker traffic - unlikely to convert',
    });
  });

  // DIY/free seekers
  NEGATIVE_INDICATORS.diy_learners.forEach(neg => {
    results.push({
      keyword: neg,
      type: 'variation',
      source: 'negative_suggestion',
      suggestedMatchType: 'PHRASE',
      estimatedIntent: 'informational',
      negativeCandidate: true,
      negativeReason: 'DIY/free seekers - low purchase intent',
    });
  });

  // Wrong intent
  NEGATIVE_INDICATORS.wrong_intent.forEach(neg => {
    results.push({
      keyword: neg,
      type: 'variation',
      source: 'negative_suggestion',
      suggestedMatchType: 'PHRASE',
      estimatedIntent: 'navigational',
      negativeCandidate: true,
      negativeReason: 'Existing customer or wrong intent',
    });
  });

  return results;
}

function suggestMatchType(keyword: string): 'EXACT' | 'PHRASE' | 'BROAD' {
  const words = keyword.split(/\s+/);

  // Short, high-intent keywords = EXACT
  if (words.length <= 2 && words.some(w =>
    ['buy', 'purchase', 'order', 'price', 'cost'].includes(w.toLowerCase())
  )) {
    return 'EXACT';
  }

  // Brand or specific product = EXACT
  if (words.length === 1) {
    return 'EXACT';
  }

  // Long-tail (4+ words) = BROAD
  if (words.length >= 4) {
    return 'BROAD';
  }

  // Default to PHRASE for most keywords
  return 'PHRASE';
}

function estimateIntent(keyword: string): 'transactional' | 'informational' | 'navigational' | 'commercial' {
  const lower = keyword.toLowerCase();

  // Transactional signals
  if (MODIFIERS.transactional.some(m => lower.includes(m))) {
    return 'transactional';
  }

  // Informational signals
  if (MODIFIERS.informational.some(m => lower.includes(m))) {
    return 'informational';
  }

  // Commercial investigation signals
  if (MODIFIERS.commercial.some(m => lower.includes(m))) {
    return 'commercial';
  }

  // Navigational (brand/login/support)
  if (['login', 'sign in', 'account', 'support'].some(m => lower.includes(m))) {
    return 'navigational';
  }

  // Default to commercial (research phase)
  return 'commercial';
}

function clusterKeywords(keywords: GeneratedKeyword[]): KeywordCluster[] {
  const clusters: Map<string, GeneratedKeyword[]> = new Map();

  keywords.forEach(kw => {
    // Simple clustering by first significant word or intent
    let theme: string = kw.estimatedIntent;

    // Try to extract a theme from the keyword
    const words = kw.keyword.split(/\s+/);
    const significantWord = words.find(w =>
      w.length > 3 && !['best', 'top', 'cheap', 'free', 'online'].includes(w.toLowerCase())
    );

    if (significantWord) {
      theme = significantWord.toLowerCase();
    }

    if (!clusters.has(theme)) {
      clusters.set(theme, []);
    }
    clusters.get(theme)!.push(kw);
  });

  return Array.from(clusters.entries()).map(([theme, keywords]) => ({
    theme,
    keywords,
    suggestedAdGroup: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Keywords`,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({
        error: 'Not authenticated',
        keywords: [],
      }, { status: 401 });
    }

    const body: KeywordFactoryRequest = await request.json();
    const { seedKeywords, options = {} } = body;

    if (!seedKeywords || seedKeywords.length === 0) {
      return NextResponse.json({
        error: 'At least one seed keyword is required',
        keywords: [],
      }, { status: 400 });
    }

    const {
      generateVariations: doVariations = true,
      generateSynonyms: doSynonyms = true,
      suggestMatchTypes: doMatchTypes = true,
      includeNegatives: doNegatives = true,
      // NEW: Metrics enrichment options
      enrichWithMetrics = false,
      metricsProviders = ['google_ads'],
      maxKeywordsToEnrich = 50,
      minSearchVolume = 0,
      sortByMetrics = true,
    } = options;

    console.log(`[Keyword Factory] Processing ${seedKeywords.length} seed keywords`);

    const allKeywords: GeneratedKeyword[] = [];
    const negativeKeywords: GeneratedKeyword[] = [];

    // Process each seed keyword
    for (const seed of seedKeywords.slice(0, 20)) { // Limit to 20 seeds
      const cleanSeed = seed.toLowerCase().trim();
      if (!cleanSeed) continue;

      // Add the seed itself
      allKeywords.push({
        keyword: cleanSeed,
        type: 'seed',
        source: 'user_input',
        suggestedMatchType: suggestMatchType(cleanSeed),
        estimatedIntent: estimateIntent(cleanSeed),
      });

      // Generate variations
      if (doVariations) {
        const variations = generateVariations(cleanSeed);
        variations.forEach(v => {
          allKeywords.push({
            keyword: v,
            type: 'variation',
            source: 'variation_generator',
            suggestedMatchType: suggestMatchType(v),
            estimatedIntent: estimateIntent(v),
          });
        });
      }

      // Generate synonyms
      if (doSynonyms) {
        const synonyms = generateSynonyms(cleanSeed);
        synonyms.forEach(s => {
          allKeywords.push({
            keyword: s,
            type: 'synonym',
            source: 'synonym_generator',
            suggestedMatchType: suggestMatchType(s),
            estimatedIntent: estimateIntent(s),
          });
        });
      }

      // Add modifiers
      const modifierKeywords = addModifiers(cleanSeed);
      allKeywords.push(...modifierKeywords);

      // Generate long-tail variations
      const longTailKeywords = generateLongTail(cleanSeed);
      allKeywords.push(...longTailKeywords);
    }

    // Add negative keyword suggestions
    if (doNegatives && seedKeywords.length > 0) {
      const negatives = suggestNegatives(seedKeywords[0]);
      negativeKeywords.push(...negatives);
    }

    // Deduplicate
    let uniqueKeywords = Array.from(
      new Map(allKeywords.map(k => [k.keyword, k])).values()
    );

    // NEW: Expand with Google Autocomplete suggestions
    if (doVariations || doSynonyms) {
      console.log('[Keyword Factory] Fetching Google Autocomplete suggestions for seed keywords...');

      try {
        const { getExpandedAutocompleteSuggestions, cleanSuggestions } = await import('@/lib/google-apis/autocomplete');

        // Fetch autocomplete for all seed keywords
        for (const seed of seedKeywords.slice(0, 5)) { // Limit to first 5 seeds to avoid rate limits
          const autocompleteSuggestions = await getExpandedAutocompleteSuggestions(seed, {
            language: options.language || 'en',
            country: options.targetLocation?.toLowerCase() || 'us',
            includeQuestions: true,
            includeModifiers: true,
          });

          // Add all unique suggestions as keywords
          const allSuggestions = cleanSuggestions(
            Array.from(autocompleteSuggestions.values()).flat()
          );

          console.log(`[Keyword Factory] Autocomplete found ${allSuggestions.length} suggestions for "${seed}"`);

          allSuggestions.forEach(suggestion => {
            // Don't add if already exists
            if (!uniqueKeywords.some(k => k.keyword.toLowerCase() === suggestion.toLowerCase())) {
              uniqueKeywords.push({
                keyword: suggestion,
                type: 'variation',
                source: 'google_autocomplete',
                suggestedMatchType: suggestMatchType(suggestion),
                estimatedIntent: estimateIntent(suggestion),
              });
            }
          });
        }

        console.log(`[Keyword Factory] Total keywords after autocomplete: ${uniqueKeywords.length}`);
      } catch (error) {
        console.error('[Keyword Factory] Autocomplete error:', error);
        // Continue without autocomplete rather than failing
      }
    }

    // NEW: Enrich keywords with real metrics if requested
    let enrichmentStats = {
      enriched: 0,
      cached: 0,
      googleFetched: 0,
      mozFetched: 0,
      dataForSeoFetched: 0,
      failed: 0,
      estimatedCost: 0,
      warnings: [] as string[],
      autocompleteSuggestions: 0, // NEW: Track autocomplete additions
    };

    // NEW: Start enrichment logging
    let enrichmentRequestId: string | null = null;

    if (enrichWithMetrics) {
      console.log('[Keyword Factory] Enriching keywords with metrics...');

      // Prioritize keywords for enrichment
      // 1. Seeds first
      // 2. Transactional intent
      // 3. Commercial intent
      const prioritized = uniqueKeywords
        .filter(k => !k.negativeCandidate)
        .sort((a, b) => {
          // Seeds first
          if (a.type === 'seed' && b.type !== 'seed') return -1;
          if (a.type !== 'seed' && b.type === 'seed') return 1;

          // Then by intent priority
          const intentPriority = { transactional: 3, commercial: 2, informational: 1, navigational: 0 };
          return intentPriority[b.estimatedIntent] - intentPriority[a.estimatedIntent];
        })
        .slice(0, maxKeywordsToEnrich);

      const keywordsToEnrich = prioritized.map(k => k.keyword);

      // Get location geoCode for logging
      const locationCode = options.targetLocation || 'US';
      const geoTargetCode = LOCATION_GEO_CODES[locationCode] || '2840';

      // Start enrichment log
      enrichmentRequestId = await enrichmentLogger.start({
        userId: session.user.id,
        keywords: keywordsToEnrich,
        seedKeyword: seedKeywords[0],
        locale: options.language || 'en-US',
        device: 'desktop',
        locationId: geoTargetCode,
        selectedProviders: metricsProviders,
      });

      // Check quota availability
      const quotaCheck = await checkQuotaAvailability(keywordsToEnrich.length, metricsProviders);
      enrichmentStats.warnings = quotaCheck.warnings;

      // Log quota check result
      await enrichmentLogger.update(enrichmentRequestId, {
        quotaCheckResult: quotaCheck,
      });

      if (!quotaCheck.canProceed) {
        console.warn('[Keyword Factory] Quota check failed:', quotaCheck.warnings);

        // Log failure
        await enrichmentLogger.update(enrichmentRequestId, {
          status: 'failed',
          errorMessage: `Quota check failed: ${quotaCheck.warnings.join(', ')}`,
        });

        return NextResponse.json({
          error: 'Insufficient quota for enrichment',
          warnings: quotaCheck.warnings,
          keywords: [],
        }, { status: 429 });
      }

      try {
        // Get user tokens for API calls
        const refreshToken = (session as any).refreshToken;
        const customerId = (session as any).customerId;
        const loginCustomerId = (session as any).loginCustomerId;

        // DEBUG: Log session data to diagnose enrichment issue
        console.log('[Keyword Factory] Session data:', {
          hasRefreshToken: !!refreshToken,
          hasCustomerId: !!customerId,
          hasLoginCustomerId: !!loginCustomerId,
          refreshTokenLength: refreshToken?.length,
          customerId: customerId,
        });

        // Get location geoCode
        const locationCode = options.targetLocation || 'US';
        const geoTargetCode = LOCATION_GEO_CODES[locationCode] || '2840'; // Default to US

        // Enrich keywords
        const enrichmentResult = await enrichKeywordsWithMetrics(keywordsToEnrich, {
          locale: options.language || 'en-US',
          device: 'desktop',
          providers: metricsProviders,
          useCache: true,
          forceRefresh: false,
          refreshToken,
          customerId,
          loginCustomerId,
          locationId: geoTargetCode, // NEW: Pass location for accurate metrics
        });

        enrichmentStats.cached = enrichmentResult.stats.cached;
        enrichmentStats.googleFetched = enrichmentResult.stats.googleFetched;
        enrichmentStats.mozFetched = enrichmentResult.stats.mozFetched;
        enrichmentStats.dataForSeoFetched = enrichmentResult.stats.dataForSeoFetched;
        enrichmentStats.failed = enrichmentResult.stats.failed;
        enrichmentStats.estimatedCost = quotaCheck.estimatedCost;

        // Log cache statistics
        if (enrichmentRequestId) {
          await enrichmentLogger.update(enrichmentRequestId, {
            cacheHits: enrichmentResult.stats.cached,
            cacheMisses: enrichmentResult.stats.googleFetched + enrichmentResult.stats.mozFetched + enrichmentResult.stats.dataForSeoFetched,
          });
        }

        // Merge metrics into generated keywords
        uniqueKeywords = uniqueKeywords.map(kw => {
          const enriched = enrichmentResult.enriched.get(kw.keyword);
          if (enriched && enriched.metrics) {
            enrichmentStats.enriched++;
            return {
              ...kw,
              metrics: enriched.metrics,
              opportunityScore: enriched.opportunityScore,
              // Include Google APIs data (Trends, YouTube, NLP)
              googleApisData: (enriched as any).googleApisData,
            };
          }
          return kw;
        });

        // IMPORTANT: Add Google Ads keyword suggestions that weren't in our generated list
        // Google expands queries with related keywords we should include
        const existingKeywordSet = new Set(uniqueKeywords.map(k => k.keyword.toLowerCase()));
        for (const [keyword, enriched] of enrichmentResult.enriched) {
          if (!existingKeywordSet.has(keyword.toLowerCase()) && enriched.metrics) {
            // This is a Google Ads suggestion we didn't generate locally
            uniqueKeywords.push({
              keyword,
              type: 'seed', // Mark as seed since it's from Google's expansion
              source: 'google_ads_suggestion',
              suggestedMatchType: suggestMatchType(keyword),
              estimatedIntent: estimateIntent(keyword),
              metrics: enriched.metrics,
              opportunityScore: enriched.opportunityScore,
              // Include Google APIs data (Trends, YouTube, NLP)
              googleApisData: (enriched as any).googleApisData,
            });
            enrichmentStats.enriched++;
          }
        }

        console.log(`[Keyword Factory] Added ${enrichmentResult.enriched.size - uniqueKeywords.length + enrichmentResult.enriched.size} Google Ads suggestions to results`);

        // Filter by minimum search volume if specified
        if (minSearchVolume > 0) {
          const beforeFilter = uniqueKeywords.length;
          uniqueKeywords = uniqueKeywords.filter(kw => {
            if (!kw.metrics || kw.metrics.searchVolume === null) return true; // Keep non-enriched
            return kw.metrics.searchVolume >= minSearchVolume;
          });
          console.log(`[Keyword Factory] Filtered ${beforeFilter - uniqueKeywords.length} keywords below volume threshold`);
        }

        // Sort by metrics if requested
        if (sortByMetrics) {
          uniqueKeywords.sort((a, b) => {
            // Sort enriched keywords by opportunity score
            if (a.opportunityScore && b.opportunityScore) {
              return b.opportunityScore - a.opportunityScore;
            }
            // Enriched keywords before non-enriched
            if (a.opportunityScore && !b.opportunityScore) return -1;
            if (!a.opportunityScore && b.opportunityScore) return 1;
            // Keep original order for non-enriched
            return 0;
          });
        }

        console.log(`[Keyword Factory] Enriched ${enrichmentStats.enriched} keywords (${enrichmentStats.cached} from cache)`);

        // Log successful enrichment
        if (enrichmentRequestId) {
          await enrichmentLogger.update(enrichmentRequestId, {
            enrichedKeywords: uniqueKeywords.filter(kw => kw.metrics).map(kw => ({
              keyword: kw.keyword,
              metrics: kw.metrics,
              opportunityScore: kw.opportunityScore,
            })),
            status: enrichmentStats.enriched > 0 ? 'success' : 'partial',
          });
        }
      } catch (error: any) {
        console.error('[Keyword Factory] Enrichment error:', error);
        enrichmentStats.warnings.push(`Enrichment failed: ${error.message}`);

        // Log failure
        if (enrichmentRequestId) {
          await enrichmentLogger.update(enrichmentRequestId, {
            status: 'failed',
            errorMessage: error.message,
            apiError: {
              message: error.message,
              stack: error.stack,
            },
          });
        }

        // Continue without metrics rather than failing completely
      }
    }

    // Cluster keywords
    const clusters = clusterKeywords(uniqueKeywords.filter(k => !k.negativeCandidate));

    // Summary stats
    const autocompleteCount = uniqueKeywords.filter(k => k.source === 'google_autocomplete').length;
    const googleAdsCount = uniqueKeywords.filter(k => k.source === 'google_ads_suggestion').length;

    const stats = {
      totalGenerated: uniqueKeywords.length,
      byType: {
        seed: uniqueKeywords.filter(k => k.type === 'seed').length,
        variation: uniqueKeywords.filter(k => k.type === 'variation').length,
        synonym: uniqueKeywords.filter(k => k.type === 'synonym').length,
        modifier: uniqueKeywords.filter(k => k.type === 'modifier').length,
        long_tail: uniqueKeywords.filter(k => k.type === 'long_tail').length,
      },
      bySource: {
        local: uniqueKeywords.filter(k => k.source && !k.source.includes('google')).length,
        google_autocomplete: autocompleteCount,
        google_ads: googleAdsCount,
        user_input: uniqueKeywords.filter(k => k.source === 'user_input').length,
      },
      byIntent: {
        transactional: uniqueKeywords.filter(k => k.estimatedIntent === 'transactional').length,
        commercial: uniqueKeywords.filter(k => k.estimatedIntent === 'commercial').length,
        informational: uniqueKeywords.filter(k => k.estimatedIntent === 'informational').length,
        navigational: uniqueKeywords.filter(k => k.estimatedIntent === 'navigational').length,
      },
      byMatchType: {
        EXACT: uniqueKeywords.filter(k => k.suggestedMatchType === 'EXACT').length,
        PHRASE: uniqueKeywords.filter(k => k.suggestedMatchType === 'PHRASE').length,
        BROAD: uniqueKeywords.filter(k => k.suggestedMatchType === 'BROAD').length,
      },
      negativesSuggested: negativeKeywords.length,
      clusters: clusters.length,
      // NEW: Enrichment stats
      enrichment: enrichWithMetrics ? enrichmentStats : null,
    };

    console.log(`[Keyword Factory] Generated ${stats.totalGenerated} keywords in ${clusters.length} clusters`);
    console.log(`[Keyword Factory] Sources: ${autocompleteCount} from Google Autocomplete, ${googleAdsCount} from Google Ads suggestions`);
    if (enrichWithMetrics) {
      console.log(`[Keyword Factory] Enrichment: ${enrichmentStats.enriched} enriched, ${enrichmentStats.cached} cached, $${enrichmentStats.estimatedCost.toFixed(2)} estimated cost`);
    }

    return NextResponse.json({
      success: true,
      keywords: uniqueKeywords,
      negativeKeywords,
      clusters,
      stats,
      warnings: enrichmentStats.warnings.length > 0 ? enrichmentStats.warnings : undefined,
    });

  } catch (error: any) {
    console.error('[Keyword Factory] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate keywords',
      keywords: [],
    }, { status: 500 });
  }
}

// GET: Provide info about the factory capabilities
export async function GET() {
  return NextResponse.json({
    name: 'Keyword Factory',
    description: 'Generate keyword variations, synonyms, and match type suggestions with optional real-world metrics',
    capabilities: [
      'Plural/singular variations',
      'Synonym expansion',
      'Modifier additions (buy, best, cheap, etc.)',
      'Long-tail keyword generation',
      'Match type suggestions',
      'Intent classification',
      'Keyword clustering',
      'Negative keyword suggestions',
      // NEW
      'Real metrics enrichment (search volume, CPC, competition)',
      'Opportunity score calculation',
      'Smart caching with dynamic TTL',
      'Multi-provider support (Google Ads, Moz, DataForSEO)',
    ],
    limits: {
      maxSeedKeywords: 20,
      maxOutputPerSeed: 50,
      maxKeywordsToEnrich: 50,
    },
    enrichmentProviders: [
      {
        name: 'Google Ads Keyword Planner',
        id: 'google_ads',
        metrics: ['search_volume', 'cpc', 'competition'],
        cost: 'Free with active campaigns',
      },
      {
        name: 'Moz',
        id: 'moz',
        metrics: ['difficulty', 'organic_ctr', 'priority'],
        cost: '1 credit per keyword',
      },
      {
        name: 'DataForSEO',
        id: 'dataforseo',
        metrics: ['search_volume', 'cpc', 'competition'],
        cost: '~$0.002 per keyword',
      },
    ],
  });
}
