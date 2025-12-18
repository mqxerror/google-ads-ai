import { CampaignHealth, BudgetPacing, LastChange, CampaignTrends } from './health';

export type CampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';

export type CampaignType =
  | 'SEARCH'
  | 'PERFORMANCE_MAX'
  | 'SHOPPING'
  | 'DISPLAY'
  | 'VIDEO'
  | 'DEMAND_GEN'
  | 'APP';

export interface AIScoreFactor {
  name: string;
  score: number;     // -25 to +25 contribution
  weight: number;    // Percentage weight
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export interface AIScoreBreakdown {
  totalScore: number;
  factors: AIScoreFactor[];
  topIssue?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  type: CampaignType;
  spend: number;
  budget?: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue?: number;
  ctr: number;
  cpa: number;
  roas: number;
  // Legacy AI score (backward compat)
  aiScore: number;
  aiScoreBreakdown?: AIScoreBreakdown;
  aiRecommendation?: string;
  // New Health System
  health?: CampaignHealth;
  budgetPacing?: BudgetPacing;
  lastChange?: LastChange;
  trends?: CampaignTrends;
}

export interface AdGroup {
  id: string;
  campaignId: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  clicks: number;
  conversions: number;
  cpa: number;
  spend: number;
}

// Quality Score component ratings
export type QualityScoreRating = 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE' | 'UNKNOWN';

export interface Keyword {
  id: string;
  adGroupId: string;
  text: string;
  matchType: 'BROAD' | 'PHRASE' | 'EXACT';
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  clicks: number;
  conversions: number;
  cpa: number;
  qualityScore: number;
  spend: number;
  // Quality Score breakdown components
  expectedCtr?: QualityScoreRating;
  adRelevance?: QualityScoreRating;
  landingPageExperience?: QualityScoreRating;
}

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  column: keyof Campaign;
  direction: SortDirection;
}

export interface FilterConfig {
  status?: CampaignStatus[];
  type?: CampaignType[];
  spendMin?: number;
  spendMax?: number;
  aiScoreMin?: number;
  aiScoreMax?: number;
  conversionsMin?: number;
  conversionsMax?: number;
  clicksMin?: number;
  clicksMax?: number;
  ctrMin?: number;
  ctrMax?: number;
  cpaMin?: number;
  cpaMax?: number;
}

export interface SavedView {
  id: string;
  name: string;
  filters: FilterConfig;
  sorting: SortConfig;
  isDefault?: boolean;
  isBuiltIn?: boolean;
}
