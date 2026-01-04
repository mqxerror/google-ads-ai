export interface MonthlySearchVolume {
  year: number;
  month: number;
  volume: number;
}

export interface GeneratedKeyword {
  keyword: string;
  type: 'seed' | 'variation' | 'synonym' | 'modifier' | 'long_tail';
  source: string;
  suggestedMatchType: 'EXACT' | 'PHRASE' | 'BROAD';
  estimatedIntent: 'transactional' | 'informational' | 'navigational' | 'commercial';
  negativeCandidate?: boolean;
  negativeReason?: string;
  metrics?: {
    searchVolume: number | null;
    cpc: number | null;
    competition: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    difficulty: number | null;
    organicCtr: number | null;
    dataSource: 'google_ads' | 'moz' | 'dataforseo' | 'cached' | 'unavailable';
    lastUpdated: string;
    cacheAge: number;
    // NEW: Enhanced metrics from Google Ads
    lowBidMicros?: number;
    highBidMicros?: number;
    monthlySearchVolumes?: MonthlySearchVolume[];
    threeMonthChange?: number | null;
    yearOverYearChange?: number | null;
    // NEW: Intent source
    intentSource?: 'dataforseo' | 'ollama' | 'rules' | 'embeddings';
    intentConfidence?: number;
  };
  opportunityScore?: number;
  googleApisData?: {
    keyword: string;
    trends?: {
      direction: 'rising' | 'declining' | 'stable' | 'breakout';
      interestScore: number;
      trendingScore: number;
      peakMonth?: string;
    };
    youtube?: {
      videoCount: number;
      avgViews: number;
      topTags: string[];
      contentGap: boolean;
      gapScore: number;
    };
    nlp?: {
      intent: 'transactional' | 'informational' | 'commercial' | 'navigational';
      intentConfidence: number;
      entities: Array<{ name: string; type: string }>;
    };
  };
}

export interface KeywordCluster {
  theme: string;
  keywords: GeneratedKeyword[];
  suggestedAdGroup: string;
}

export interface FactoryStats {
  totalGenerated: number;
  byType: Record<string, number>;
  byIntent: Record<string, number>;
  byMatchType: Record<string, number>;
  negativesSuggested: number;
  clusters: number;
  enrichment?: {
    enriched: number;
    cached: number;
    googleFetched: number;
    mozFetched: number;
    dataForSeoFetched: number;
    failed: number;
    estimatedCost: number;
    warnings: string[];
  };
}

export interface FilterState {
  type: string;
  intent: string;
  match: string;
}

export interface GenerationOptions {
  generateVariations: boolean;
  generateSynonyms: boolean;
  suggestNegatives: boolean;
  enrichWithMetrics: boolean;
  targetLocation: string;
  maxKeywords: number;
}
