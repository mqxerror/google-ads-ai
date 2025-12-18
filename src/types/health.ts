// Health System Types for AI-First Google Ads OS

// Health label categories
export type HealthLabel = 'Healthy' | 'Watch' | 'Action Needed';

// Issue categories for classification
export type IssueCategory =
  | 'tracking'
  | 'budget_pacing'
  | 'wasted_spend'
  | 'low_conv_rate'
  | 'high_cpa'
  | 'low_ctr'
  | 'quality'
  | 'targeting'
  | 'bid_strategy'
  | 'ad_strength';

// Severity levels
export type IssueSeverity = 'critical' | 'warning' | 'info';

// Confidence levels for AI predictions
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Action types for recommended fixes
export type FixActionType =
  | 'pause_campaign'
  | 'enable_campaign'
  | 'adjust_budget'
  | 'adjust_bid'
  | 'add_negatives'
  | 'improve_ads'
  | 'review_targeting'
  | 'fix_tracking'
  | 'review_keywords'
  | 'scale_budget';

// Metric change tracking
export interface MetricChange {
  name: string;
  label: string;
  current: number;
  previous?: number;
  change?: number;
  changePercent?: number;
  direction: 'up' | 'down' | 'stable';
  format: 'currency' | 'percent' | 'number';
  isGood?: boolean; // Whether direction is favorable
}

// Evidence supporting the diagnosis
export interface DiagnosticEvidence {
  metrics: MetricChange[];
  timeline?: string; // "Changed 3 days ago"
  benchmark?: string; // "vs industry avg"
  dataPoints?: number; // Days of data analyzed
  anomalyDetected?: boolean;
  relatedChanges?: string[]; // Recent changes that might have caused this
}

// Recommended fix with impact estimation
export interface RecommendedFix {
  id: string;
  action: string; // Human readable action
  actionType: FixActionType;
  description: string;
  expectedImpact: string; // "Save $X/week" or "+Y conversions"
  impactRange: {
    min: number;
    max: number;
    metric: string; // "savings" | "conversions" | "ctr"
  };
  assumptions: string[];
  confidence: ConfidenceLevel;
  effort: 'quick' | 'moderate' | 'complex';
  risk: 'low' | 'medium' | 'high';
  // For action queue integration
  actionPayload?: {
    entityType: string;
    entityId: string;
    currentValue?: string | number;
    newValue?: string | number;
  };
}

// Individual campaign issue
export interface CampaignIssue {
  id: string;
  category: IssueCategory;
  label: string; // "Wasted Spend", "Low CTR", etc.
  icon: string; // Icon identifier for UI
  severity: IssueSeverity;
  impactEstimate: string; // "$X/mo recoverable" or "+Y conversions est."
  impactValue: number; // Numeric value for sorting
  impactMetric: 'savings' | 'conversions' | 'ctr' | 'cpa';
  confidence: ConfidenceLevel;
  summary: string; // 1-2 line explanation
  fullExplanation?: string; // Detailed explanation for drawer
  evidence: DiagnosticEvidence;
  fixes: RecommendedFix[];
  createdAt: Date;
  acknowledgedAt?: Date; // User dismissed/acknowledged
}

// Positive opportunity (not just issues)
export interface CampaignOpportunity {
  id: string;
  category: 'scale' | 'efficiency' | 'expansion' | 'optimization';
  label: string;
  description: string;
  potentialImpact: string;
  impactValue: number;
  confidence: ConfidenceLevel;
  requirements?: string[]; // What needs to be true for this
  actions: RecommendedFix[];
}

// Overall campaign health assessment
export interface CampaignHealth {
  score: number; // 0-100
  label: HealthLabel;
  trend: 'improving' | 'stable' | 'declining';
  trendChange?: number; // Score change from previous period
  issues: CampaignIssue[];
  opportunities: CampaignOpportunity[];
  topIssue?: CampaignIssue; // Most critical issue
  issueCount: {
    critical: number;
    warning: number;
    info: number;
  };
  lastCalculated: Date;
  dataQuality: 'good' | 'limited' | 'insufficient';
}

// Budget pacing status
export type BudgetPacingStatus = 'on_track' | 'overspend' | 'underspend' | 'limited';

export interface BudgetPacing {
  status: BudgetPacingStatus;
  percentUsed: number; // 0-100+ (can overspend)
  daysRemaining: number;
  projectedSpend: number;
  budget: number;
  recommendation?: string;
}

// Last change tracking
export interface LastChange {
  who: string; // User name or "AI" or "System"
  what: string; // Brief description
  field?: string; // Specific field changed
  oldValue?: string | number;
  newValue?: string | number;
  when: Date;
  source: 'user' | 'ai' | 'system' | 'api';
}

// Trend data for sparklines
export interface TrendData {
  values: number[];
  dates: string[];
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
}

// Campaign trends bundle
export interface CampaignTrends {
  spend: TrendData;
  conversions: TrendData;
  ctr: TrendData;
  cpa: TrendData;
  impressions?: TrendData;
  clicks?: TrendData;
}

// Issue category metadata for UI
export const ISSUE_CATEGORY_META: Record<
  IssueCategory,
  { label: string; icon: string; color: string }
> = {
  tracking: { label: 'Tracking', icon: 'chart-bar', color: 'purple' },
  budget_pacing: { label: 'Budget', icon: 'currency-dollar', color: 'blue' },
  wasted_spend: { label: 'Waste', icon: 'trash', color: 'red' },
  low_conv_rate: { label: 'Conv Rate', icon: 'arrow-trending-down', color: 'orange' },
  high_cpa: { label: 'High CPA', icon: 'arrow-trending-up', color: 'red' },
  low_ctr: { label: 'Low CTR', icon: 'cursor-arrow-rays', color: 'amber' },
  quality: { label: 'Quality', icon: 'star', color: 'yellow' },
  targeting: { label: 'Targeting', icon: 'user-group', color: 'indigo' },
  bid_strategy: { label: 'Bidding', icon: 'adjustments-horizontal', color: 'cyan' },
  ad_strength: { label: 'Ad Strength', icon: 'document-text', color: 'green' },
};

// Health score thresholds
export const HEALTH_THRESHOLDS = {
  HEALTHY: 75,
  WATCH: 50,
  // Below 50 = Action Needed
};

// Get health label from score
export function getHealthLabel(score: number): HealthLabel {
  if (score >= HEALTH_THRESHOLDS.HEALTHY) return 'Healthy';
  if (score >= HEALTH_THRESHOLDS.WATCH) return 'Watch';
  return 'Action Needed';
}

// Get health color class
export function getHealthColor(label: HealthLabel): string {
  switch (label) {
    case 'Healthy':
      return 'text-emerald-600 bg-emerald-50';
    case 'Watch':
      return 'text-amber-600 bg-amber-50';
    case 'Action Needed':
      return 'text-red-600 bg-red-50';
  }
}

// Get severity color class
export function getSeverityColor(severity: IssueSeverity): string {
  switch (severity) {
    case 'critical':
      return 'text-red-600 bg-red-100';
    case 'warning':
      return 'text-amber-600 bg-amber-100';
    case 'info':
      return 'text-blue-600 bg-blue-100';
  }
}

// Get confidence color
export function getConfidenceColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return 'text-emerald-600';
    case 'medium':
      return 'text-amber-600';
    case 'low':
      return 'text-gray-500';
  }
}
