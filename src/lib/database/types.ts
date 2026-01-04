/**
 * TypeScript types for Keyword Center database tables
 * Corresponds to migration 006_keyword_center.sql
 */

// =====================================================
// Keyword Lists
// =====================================================

export interface KeywordList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_favorite: boolean;

  // Denormalized metrics (auto-calculated by trigger)
  keyword_count: number;
  total_search_volume: bigint | null;
  avg_cpc: number | null;
  avg_opportunity_score: number | null;

  created_at: Date;
  updated_at: Date;
}

export interface KeywordListItem {
  id: string;
  list_id: string;
  keyword: string;
  keyword_normalized: string;
  position: number;

  // Snapshot metrics when added
  snapshot_search_volume: number | null;
  snapshot_cpc: number | null;
  snapshot_opportunity_score: number | null;
  notes: string | null;

  // Intent classification
  intent: 'commercial' | 'informational' | 'navigational' | 'transactional' | null;
  intent_confidence: number | null;
  intent_source: 'ollama' | 'embeddings' | 'rules' | 'openai' | null;
  intent_classified_at: Date | null;

  added_at: Date;
}

export interface CreateKeywordListInput {
  user_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_favorite?: boolean;
}

export interface UpdateKeywordListInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  is_favorite?: boolean;
}

export interface AddKeywordToListInput {
  keyword: string;
  notes?: string;
  snapshot_search_volume?: number;
  snapshot_cpc?: number;
  snapshot_opportunity_score?: number;
}

// =====================================================
// Keyword Tags
// =====================================================

export interface KeywordTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  description: string | null;
  keyword_count: number; // Auto-calculated by trigger
  created_at: Date;
}

export interface KeywordTagAssignment {
  id: string;
  keyword_normalized: string;
  tag_id: string;
  user_id: string;
  tagged_at: Date;
}

export interface CreateKeywordTagInput {
  user_id: string;
  name: string;
  color?: string;
  description?: string;
}

export interface AssignTagInput {
  tag_id: string;
  keywords: string[];
  user_id: string;
}

// =====================================================
// Google Ads Account Integration
// =====================================================

export interface KeywordAccountData {
  id: string;
  user_id: string;
  customer_id: string;

  keyword: string;
  keyword_normalized: string;

  campaign_id: string;
  campaign_name: string;
  ad_group_id: string | null;
  ad_group_name: string | null;
  match_type: 'EXACT' | 'PHRASE' | 'BROAD';
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';

  last_synced_at: Date;
}

export interface KeywordPerformanceHistory {
  id: string;
  user_id: string;
  customer_id: string;
  keyword_normalized: string;
  campaign_id: string;

  date: Date;

  impressions: number;
  clicks: number;
  conversions: number;
  cost_micros: bigint;
  ctr: number | null;
  quality_score: number | null; // 1-10

  synced_at: Date;
}

export interface AccountKeyword {
  keyword: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
}

export interface KeywordPerformanceData {
  keyword: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number; // In dollars
  conversions: number;
  ctr: number;
  qualityScore: number | null;
}

export interface SyncAccountOptions {
  customerId: string;
  campaignIds?: string[];
  includePerformance?: boolean;
  performanceDays?: number;
}

export interface SyncAccountResult {
  synced: {
    keywords: number;
    campaigns: number;
    newKeywords: number;
    updatedKeywords: number;
  };
  performance?: {
    keywordsWithData: number;
    daysImported: number;
  };
  duration: number; // milliseconds
}

// =====================================================
// SERP Features
// =====================================================

export interface KeywordSerpFeatures {
  id: string;
  keyword_normalized: string;
  location_id: string;
  device: 'desktop' | 'mobile' | 'tablet';

  has_featured_snippet: boolean;
  has_knowledge_panel: boolean;
  has_local_pack: boolean;
  total_ads_count: number;
  top_ads_count: number;
  organic_results_count: number;

  serp_difficulty: number | null; // 0-100

  checked_at: Date;
  expires_at: Date;
}

export interface SerpFeatures {
  keyword: string;
  locationId: string;
  device: 'desktop' | 'mobile' | 'tablet';

  features: {
    featuredSnippet: boolean;
    knowledgePanel: boolean;
    localPack: boolean;
    peopleAlsoAsk: boolean;
    relatedSearches: boolean;
  };

  ads: {
    totalCount: number;
    topCount: number;
    bottomCount: number;
    hasShoppingAds: boolean;
  };

  organic: {
    resultCount: number;
    firstResultDomain: string;
  };

  difficulty: {
    serpScore: number; // 0-100
    reasoning: string;
  };
}

export interface FetchSerpFeaturesInput {
  keywords: string[];
  locationId: string;
  device?: 'desktop' | 'mobile' | 'tablet';
}

export interface FetchSerpFeaturesResult {
  features: SerpFeatures[];
  cached: number;
  fetched: number;
  cost: number;
}

export interface SerpAnalysisResult {
  keyword: string;
  features: SerpFeatures;
  difficulty: {
    score: number;
    label: string;
    color: string;
    description: string;
  };
  cached: boolean;
  checkedAt: string;
}

// DataForSEO API Response Types
export interface DataForSeoSerpResponse {
  keyword?: string;
  location_code?: number;
  items?: Array<{
    type: string;
    rank_group?: number;
    domain?: string;
    url?: string;
    title?: string;
    description?: string;
  }>;
}

// =====================================================
// Keyword Trends
// =====================================================

export interface KeywordTrend {
  id: string;
  keyword_normalized: string;
  location_id: string;
  year: number;
  month: number; // 1-12
  search_volume: number;
  source: 'google_ads' | 'dataforseo' | 'google_trends';
  fetched_at: Date;
}

export interface TrendAnalysis {
  keyword: string;
  monthlyVolumes: Array<{
    year: number;
    month: number;
    volume: number;
    change: number; // % change from previous month
  }>;

  statistics: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
  };

  growth: {
    overallTrend: 'growing' | 'declining' | 'stable' | 'volatile';
    growthRate: number; // % YoY or MoM
    momentum: 'accelerating' | 'decelerating' | 'steady';
  };

  seasonality: {
    isHighlySeasonal: boolean;
    peakMonths: number[]; // [1-12]
    lowMonths: number[];
    seasonalityIndex: number; // 0-100 (coefficient of variation)
    pattern: string; // Description
  };
}

// =====================================================
// Enhanced Metrics
// =====================================================

export interface QualityScorePrediction {
  predictedScore: number; // 1-10
  confidence: number; // 0-1

  components: {
    expectedCtr: {
      value: number; // Estimated CTR %
      score: number; // 1-10
      weight: 0.5;
    };
    adRelevance: {
      value: number; // 0-1 relevance score
      score: number; // 1-10
      weight: 0.3;
    };
    landingPageExperience: {
      value: number; // 0-1 estimated score
      score: number; // 1-10
      weight: 0.2;
    };
  };

  recommendations: string[];
}

export interface RoiProjection {
  estimatedImpressions: number;
  estimatedClicks: number;
  estimatedConversions: number;
  estimatedCost: number;
  estimatedRevenue: number;
  roi: number; // % return on investment
  roas: number; // Return on ad spend (revenue / cost)
  cpa: number; // Cost per acquisition
}

export interface RoiEstimate {
  projections: RoiProjection;

  assumptions: {
    impressionShare: number; // 0-1
    ctr: number; // Click-through rate
    conversionRate: number; // % of clicks that convert
    avgOrderValue: number; // $
    profitMargin: number; // %
  };

  scenarios: {
    conservative: RoiProjection;
    realistic: RoiProjection;
    optimistic: RoiProjection;
  };
}

export interface UserAssumptions {
  ctr?: number;
  conversionRate?: number;
  avgOrderValue?: number;
  profitMargin?: number;
  budget?: number;
}

// =====================================================
// Strategic Insights
// =====================================================

export interface QuickWin {
  keyword: string;
  reasoning: string;
  action: string;
  estimatedImpact: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Opportunity {
  theme: string;
  keywords: string[];
  recommendation: string;
  estimatedVolume: number;
}

export interface Warning {
  keyword: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface StrategicInsights {
  quickWins: QuickWin[];
  opportunities: Opportunity[];
  warnings: Warning[];
}

export interface GenerateInsightsInput {
  keywords: string[];
  customerId?: string;
  userProfile?: UserAssumptions;
}

// =====================================================
// Background Jobs
// =====================================================

export interface BackgroundJob {
  id: string;
  user_id: string;
  type: 'account_sync' | 'serp_fetch' | 'performance_sync' | 'trend_fetch';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  metadata: Record<string, any>;
  result: Record<string, any> | null;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface BackgroundJobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: Record<string, any>;
  error?: string;
}
