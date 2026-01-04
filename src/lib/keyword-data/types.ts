/**
 * Shared TypeScript types for Keyword Data module
 */

// =====================================================
// API Response Types
// =====================================================

export interface MonthlySearchVolume {
  year: number;
  month: number;
  volume: number;
}

export interface GoogleAdsKeywordMetrics {
  keyword: string;
  monthlySearchVolume: number;
  avgCpcMicros: number;
  lowBidMicros: number;
  highBidMicros: number;
  competition: 'LOW' | 'MEDIUM' | 'HIGH';
  competitionIndex: number; // 0-100
  // NEW: Monthly volumes for sparkline
  monthlySearchVolumes: MonthlySearchVolume[];
  // NEW: Calculated trend metrics
  threeMonthChange: number | null; // Percentage change over 3 months
  yearOverYearChange: number | null; // YoY percentage change
}

export interface MozKeywordMetrics {
  keyword: string;
  volume: number;
  difficulty: number; // 0-100
  organicCtr: number; // 0-1
  priority: number; // 0-100
  primaryIntent: 'informational' | 'navigational' | 'commercial' | 'transactional';
  intentScores: Record<string, number>;
}

export interface DataForSEOKeywordMetrics {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number; // 0-1
  trends: Record<string, number>; // Monthly trends
}

// =====================================================
// Enrichment Options
// =====================================================

export interface EnrichmentOptions {
  locale?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  providers?: ('google_ads' | 'moz' | 'dataforseo')[];
  useCache?: boolean;
  forceRefresh?: boolean;
  maxRetries?: number;
}

// =====================================================
// Enrichment Results
// =====================================================

export interface EnrichedKeyword {
  keyword: string;
  metrics: {
    searchVolume: number | null;
    cpc: number | null;
    competition: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    difficulty: number | null; // 0-100
    organicCtr: number | null; // 0-1
    priority: number | null; // 0-100
    intent: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
    intentScores: Record<string, number> | null;
    dataSource: 'google_ads' | 'moz' | 'dataforseo' | 'cached' | 'unavailable';
    lastUpdated: string;
    cacheAge: number; // days
    // NEW: Bid ranges from Google Ads
    lowBidMicros?: number | null;
    highBidMicros?: number | null;
    // NEW: Monthly volumes for trend sparkline
    monthlySearchVolumes?: MonthlySearchVolume[] | null;
    // NEW: Calculated trend metrics
    threeMonthChange?: number | null; // Percentage change over 3 months
    yearOverYearChange?: number | null; // YoY percentage change
  } | null;
  opportunityScore?: number; // 0-100
}

export interface EnrichmentResult {
  enriched: Map<string, EnrichedKeyword>;
  stats: {
    totalRequested: number;
    cached: number;
    googleFetched: number;
    mozFetched: number;
    dataForSeoFetched: number;
    failed: number;
    creditsUsed: number;
    errors: Array<{
      keyword: string;
      provider: string;
      error: string;
    }>;
  };
}

// =====================================================
// Quota Tracking
// =====================================================

export interface QuotaUsage {
  provider: 'google_ads' | 'moz' | 'dataforseo';
  used: number;
  limit: number;
  resetAt: Date;
  costPerUnit?: number;
}

export interface QuotaStatus {
  googleAds: QuotaUsage;
  moz: QuotaUsage;
  dataForSeo: QuotaUsage;
  totalEstimatedCost: number;
}

// =====================================================
// Background Refresh
// =====================================================

export interface RefreshJob {
  id: string;
  keywords: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date | null;
  completedAt: Date | null;
  refreshedCount: number;
  failedCount: number;
  errors: string[];
}
