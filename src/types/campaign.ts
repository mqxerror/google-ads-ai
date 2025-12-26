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
  score: number;
  weight: number;
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
  ctr: number;
  cpa: number;
  roas: number;
  aiScore: number;
  aiScoreBreakdown?: AIScoreBreakdown;
  aiRecommendation?: string;
}

export interface AdGroup {
  id: string;
  campaignId: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpa: number;
}

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
}

export interface Ad {
  id: string;
  adGroupId: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  type: string;
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  spend: number;
  conversions: number;
}
