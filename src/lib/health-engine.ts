// Health Engine - AI-First Campaign Health Assessment
// Builds upon ai-score.ts with richer diagnostics and actionable issues

import {
  CampaignHealth,
  CampaignIssue,
  CampaignOpportunity,
  RecommendedFix,
  DiagnosticEvidence,
  MetricChange,
  IssueCategory,
  IssueSeverity,
  ConfidenceLevel,
  HealthLabel,
  BudgetPacing,
  getHealthLabel,
  HEALTH_THRESHOLDS,
} from '@/types/health';
import { CampaignType, Campaign } from '@/types/campaign';

// Re-export benchmarks from ai-score for consistency
export const CTR_BENCHMARKS: Record<CampaignType, { good: number; warning: number }> = {
  SEARCH: { good: 3.17, warning: 2.0 },
  DISPLAY: { good: 0.46, warning: 0.3 },
  SHOPPING: { good: 0.86, warning: 0.5 },
  VIDEO: { good: 0.4, warning: 0.2 },
  PERFORMANCE_MAX: { good: 2.0, warning: 1.0 },
  DEMAND_GEN: { good: 1.5, warning: 0.8 },
  APP: { good: 1.0, warning: 0.5 },
};

export const CPA_BENCHMARKS: Record<CampaignType, { good: number; warning: number }> = {
  SEARCH: { good: 40, warning: 80 },
  DISPLAY: { good: 60, warning: 120 },
  SHOPPING: { good: 30, warning: 60 },
  VIDEO: { good: 50, warning: 100 },
  PERFORMANCE_MAX: { good: 35, warning: 70 },
  DEMAND_GEN: { good: 45, warning: 90 },
  APP: { good: 25, warning: 50 },
};

interface CampaignMetrics {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
  type: CampaignType;
  qualityScore?: number;
  budget?: number;
  // Trend data (optional)
  previousSpend?: number;
  previousConversions?: number;
  previousCtr?: number;
  previousCpa?: number;
}

/**
 * Calculate comprehensive campaign health with issues and opportunities
 */
export function calculateCampaignHealth(
  campaign: Campaign,
  metrics?: Partial<CampaignMetrics>
): CampaignHealth {
  const m: CampaignMetrics = {
    spend: metrics?.spend ?? campaign.spend ?? 0,
    clicks: metrics?.clicks ?? campaign.clicks ?? 0,
    impressions: metrics?.impressions ?? campaign.impressions ?? 0,
    conversions: metrics?.conversions ?? campaign.conversions ?? 0,
    ctr: metrics?.ctr ?? campaign.ctr ?? 0,
    cpa: metrics?.cpa ?? campaign.cpa ?? 0,
    roas: metrics?.roas ?? campaign.roas ?? 0,
    type: (campaign.type as CampaignType) || 'SEARCH',
    qualityScore: metrics?.qualityScore,
    budget: metrics?.budget,
    previousSpend: metrics?.previousSpend,
    previousConversions: metrics?.previousConversions,
    previousCtr: metrics?.previousCtr,
    previousCpa: metrics?.previousCpa,
  };

  const issues: CampaignIssue[] = [];
  const opportunities: CampaignOpportunity[] = [];
  let baseScore = 50;

  // Analyze each health dimension and generate issues
  const wastedSpendResult = analyzeWastedSpend(m, campaign);
  if (wastedSpendResult.issue) issues.push(wastedSpendResult.issue);
  baseScore += wastedSpendResult.scoreAdjustment;

  const ctrResult = analyzeCTR(m, campaign);
  if (ctrResult.issue) issues.push(ctrResult.issue);
  baseScore += ctrResult.scoreAdjustment;

  const cpaResult = analyzeCPA(m, campaign);
  if (cpaResult.issue) issues.push(cpaResult.issue);
  baseScore += cpaResult.scoreAdjustment;

  const roasResult = analyzeROAS(m, campaign);
  if (roasResult.issue) issues.push(roasResult.issue);
  baseScore += roasResult.scoreAdjustment;

  const conversionResult = analyzeConversions(m, campaign);
  if (conversionResult.issue) issues.push(conversionResult.issue);
  baseScore += conversionResult.scoreAdjustment;

  // Check for opportunities (positive signals)
  const scalingOpp = checkScalingOpportunity(m, campaign, baseScore);
  if (scalingOpp) opportunities.push(scalingOpp);

  // Clamp score
  const totalScore = Math.max(0, Math.min(100, Math.round(baseScore)));
  const label = getHealthLabel(totalScore);

  // Sort issues by severity and impact
  issues.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.impactValue - a.impactValue;
  });

  // Determine trend
  const trend = determineTrend(m);

  return {
    score: totalScore,
    label,
    trend,
    issues,
    opportunities,
    topIssue: issues[0] || undefined,
    issueCount: {
      critical: issues.filter((i) => i.severity === 'critical').length,
      warning: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length,
    },
    lastCalculated: new Date(),
    dataQuality: determineDataQuality(m),
  };
}

// ============================================
// Issue Analysis Functions
// ============================================

interface AnalysisResult {
  issue?: CampaignIssue;
  scoreAdjustment: number;
}

function analyzeWastedSpend(m: CampaignMetrics, campaign: Campaign): AnalysisResult {
  if (m.spend < 10) {
    return { scoreAdjustment: 0 };
  }

  const hasSignificantSpend = m.spend > 100;
  const conversionRate = m.clicks > 0 ? (m.conversions / m.clicks) * 100 : 0;

  // Critical: High spend with zero conversions
  if (m.conversions === 0 && hasSignificantSpend) {
    const weeklyWaste = (m.spend / 7) * 30; // Estimate monthly
    return {
      scoreAdjustment: -25,
      issue: createIssue({
        category: 'wasted_spend',
        label: 'Wasted Spend',
        severity: 'critical',
        impactEstimate: `$${Math.round(weeklyWaste)}/mo recoverable`,
        impactValue: weeklyWaste,
        impactMetric: 'savings',
        confidence: 'high',
        summary: `$${m.spend.toFixed(0)} spent with 0 conversions. This spend is not generating results.`,
        evidence: {
          metrics: [
            createMetricChange('Spend', m.spend, undefined, 'currency'),
            createMetricChange('Conversions', m.conversions, undefined, 'number'),
            createMetricChange('Clicks', m.clicks, undefined, 'number'),
          ],
          benchmark: 'Expected at least 1 conversion per $100 spend',
        },
        fixes: [
          createFix({
            action: 'Pause this campaign',
            actionType: 'pause_campaign',
            description: 'Stop spending until the issue is diagnosed',
            expectedImpact: `Save $${Math.round(m.spend)}/week`,
            impactRange: { min: m.spend * 0.8, max: m.spend, metric: 'savings' },
            confidence: 'high',
            effort: 'quick',
            risk: 'medium',
            entityType: 'campaign',
            entityId: campaign.id,
          }),
          createFix({
            action: 'Review conversion tracking',
            actionType: 'fix_tracking',
            description: 'Verify conversion tracking is set up correctly',
            expectedImpact: 'May reveal tracking issues hiding conversions',
            impactRange: { min: 0, max: m.spend * 0.5, metric: 'savings' },
            confidence: 'medium',
            effort: 'moderate',
            risk: 'low',
          }),
        ],
      }),
    };
  }

  // Warning: Moderate spend with no conversions
  if (m.conversions === 0 && m.spend > 50) {
    return {
      scoreAdjustment: -15,
      issue: createIssue({
        category: 'wasted_spend',
        label: 'No Conversions',
        severity: 'warning',
        impactEstimate: `$${Math.round(m.spend)}/week at risk`,
        impactValue: m.spend,
        impactMetric: 'savings',
        confidence: 'medium',
        summary: `$${m.spend.toFixed(0)} spent without conversions. Monitor closely.`,
        evidence: {
          metrics: [
            createMetricChange('Spend', m.spend, undefined, 'currency'),
            createMetricChange('Conversions', 0, undefined, 'number'),
          ],
        },
        fixes: [
          createFix({
            action: 'Add negative keywords',
            actionType: 'add_negatives',
            description: 'Review search terms and add negatives for irrelevant queries',
            expectedImpact: 'Reduce wasted clicks by 10-30%',
            impactRange: { min: m.spend * 0.1, max: m.spend * 0.3, metric: 'savings' },
            confidence: 'medium',
            effort: 'moderate',
            risk: 'low',
          }),
        ],
      }),
    };
  }

  // Warning: Low conversion rate
  if (conversionRate < 1 && hasSignificantSpend && m.conversions > 0) {
    return {
      scoreAdjustment: -10,
      issue: createIssue({
        category: 'low_conv_rate',
        label: 'Low Conv Rate',
        severity: 'warning',
        impactEstimate: `+${Math.round(m.clicks * 0.02 - m.conversions)} conversions possible`,
        impactValue: m.clicks * 0.02 - m.conversions,
        impactMetric: 'conversions',
        confidence: 'medium',
        summary: `${conversionRate.toFixed(2)}% conversion rate is below average. Industry avg is ~2%.`,
        evidence: {
          metrics: [
            createMetricChange('Conv Rate', conversionRate, 2, 'percent'),
            createMetricChange('Clicks', m.clicks, undefined, 'number'),
          ],
          benchmark: 'Industry average: 2%',
        },
        fixes: [
          createFix({
            action: 'Improve landing pages',
            actionType: 'improve_ads',
            description: 'Review landing page relevance and load speed',
            expectedImpact: '+50% conversion rate improvement possible',
            impactRange: { min: m.conversions * 0.2, max: m.conversions * 0.5, metric: 'conversions' },
            confidence: 'medium',
            effort: 'complex',
            risk: 'low',
          }),
        ],
      }),
    };
  }

  // Good performance
  if (m.conversions > 0) {
    return { scoreAdjustment: 15 };
  }

  return { scoreAdjustment: 0 };
}

function analyzeCTR(m: CampaignMetrics, campaign: Campaign): AnalysisResult {
  if (m.impressions < 100) {
    return { scoreAdjustment: 0 };
  }

  const benchmark = CTR_BENCHMARKS[m.type] || CTR_BENCHMARKS.SEARCH;

  // Critical: CTR far below benchmark
  if (m.ctr < benchmark.warning) {
    const ctrGap = benchmark.good - m.ctr;
    const potentialClicks = Math.round((ctrGap / 100) * m.impressions);

    return {
      scoreAdjustment: -10,
      issue: createIssue({
        category: 'low_ctr',
        label: 'Low CTR',
        severity: 'critical',
        impactEstimate: `+${potentialClicks} clicks possible`,
        impactValue: potentialClicks,
        impactMetric: 'ctr',
        confidence: 'high',
        summary: `CTR ${m.ctr.toFixed(2)}% is significantly below the ${benchmark.good}% benchmark for ${m.type} campaigns.`,
        evidence: {
          metrics: [
            createMetricChange('CTR', m.ctr, benchmark.good, 'percent', false),
            createMetricChange('Impressions', m.impressions, undefined, 'number'),
          ],
          benchmark: `${m.type} benchmark: ${benchmark.good}%`,
        },
        fixes: [
          createFix({
            action: 'Improve ad copy',
            actionType: 'improve_ads',
            description: 'Rewrite headlines and descriptions with stronger CTAs',
            expectedImpact: `+${Math.round(ctrGap * 10)}% CTR improvement`,
            impactRange: { min: ctrGap * 0.3, max: ctrGap * 0.7, metric: 'ctr' },
            confidence: 'medium',
            effort: 'moderate',
            risk: 'low',
          }),
          createFix({
            action: 'Review targeting',
            actionType: 'review_targeting',
            description: 'Ensure ads are reaching the right audience',
            expectedImpact: 'Better audience alignment improves CTR',
            impactRange: { min: ctrGap * 0.2, max: ctrGap * 0.5, metric: 'ctr' },
            confidence: 'medium',
            effort: 'moderate',
            risk: 'low',
          }),
        ],
      }),
    };
  }

  // Warning: CTR below good threshold
  if (m.ctr < benchmark.good) {
    return {
      scoreAdjustment: 5,
      issue: createIssue({
        category: 'low_ctr',
        label: 'CTR Below Avg',
        severity: 'warning',
        impactEstimate: `Room to improve from ${m.ctr.toFixed(1)}% to ${benchmark.good}%`,
        impactValue: benchmark.good - m.ctr,
        impactMetric: 'ctr',
        confidence: 'medium',
        summary: `CTR ${m.ctr.toFixed(2)}% is below the ${benchmark.good}% benchmark but not critical.`,
        evidence: {
          metrics: [createMetricChange('CTR', m.ctr, benchmark.good, 'percent')],
          benchmark: `Target: ${benchmark.good}%`,
        },
        fixes: [
          createFix({
            action: 'A/B test ad variations',
            actionType: 'improve_ads',
            description: 'Create 2-3 ad variations to test different messages',
            expectedImpact: '+10-20% CTR with winning variation',
            impactRange: { min: 0.1, max: 0.2, metric: 'ctr' },
            confidence: 'medium',
            effort: 'moderate',
            risk: 'low',
          }),
        ],
      }),
    };
  }

  // Good CTR
  return { scoreAdjustment: 15 };
}

function analyzeCPA(m: CampaignMetrics, campaign: Campaign): AnalysisResult {
  if (m.spend < 10 || m.conversions === 0) {
    return { scoreAdjustment: 0 };
  }

  const benchmark = CPA_BENCHMARKS[m.type] || CPA_BENCHMARKS.SEARCH;

  // Critical: CPA way above target
  if (m.cpa > benchmark.warning) {
    const excessCost = m.cpa - benchmark.good;
    const monthlySavings = excessCost * m.conversions * 4; // Weekly to monthly

    return {
      scoreAdjustment: -15,
      issue: createIssue({
        category: 'high_cpa',
        label: 'High CPA',
        severity: 'critical',
        impactEstimate: `$${Math.round(monthlySavings)}/mo savings possible`,
        impactValue: monthlySavings,
        impactMetric: 'cpa',
        confidence: 'high',
        summary: `CPA $${m.cpa.toFixed(2)} is ${((m.cpa / benchmark.good - 1) * 100).toFixed(0)}% above target ($${benchmark.good}).`,
        evidence: {
          metrics: [
            createMetricChange('CPA', m.cpa, benchmark.good, 'currency', false),
            createMetricChange('Conversions', m.conversions, undefined, 'number'),
          ],
          benchmark: `Target CPA: $${benchmark.good}`,
        },
        fixes: [
          createFix({
            action: 'Lower bids',
            actionType: 'adjust_bid',
            description: 'Reduce bids to improve efficiency',
            expectedImpact: `-${Math.round((m.cpa - benchmark.good) / m.cpa * 100)}% CPA reduction`,
            impactRange: { min: monthlySavings * 0.3, max: monthlySavings * 0.6, metric: 'savings' },
            confidence: 'medium',
            effort: 'quick',
            risk: 'medium',
          }),
          createFix({
            action: 'Pause low-performing keywords',
            actionType: 'review_keywords',
            description: 'Identify and pause keywords with CPA > $' + benchmark.warning,
            expectedImpact: 'Focus budget on efficient keywords',
            impactRange: { min: monthlySavings * 0.2, max: monthlySavings * 0.4, metric: 'savings' },
            confidence: 'medium',
            effort: 'moderate',
            risk: 'low',
          }),
        ],
      }),
    };
  }

  // Warning: CPA above good but below warning
  if (m.cpa > benchmark.good) {
    return {
      scoreAdjustment: 5,
      issue: createIssue({
        category: 'high_cpa',
        label: 'CPA Above Target',
        severity: 'warning',
        impactEstimate: `Target: $${benchmark.good}, Current: $${m.cpa.toFixed(0)}`,
        impactValue: m.cpa - benchmark.good,
        impactMetric: 'cpa',
        confidence: 'medium',
        summary: `CPA $${m.cpa.toFixed(2)} is above target but manageable.`,
        evidence: {
          metrics: [createMetricChange('CPA', m.cpa, benchmark.good, 'currency')],
        },
        fixes: [
          createFix({
            action: 'Optimize bid strategy',
            actionType: 'adjust_bid',
            description: 'Consider switching to Target CPA bidding',
            expectedImpact: 'Automated optimization towards target',
            impactRange: { min: 0, max: m.cpa - benchmark.good, metric: 'cpa' },
            confidence: 'medium',
            effort: 'quick',
            risk: 'low',
          }),
        ],
      }),
    };
  }

  // Good CPA
  return { scoreAdjustment: 20 };
}

function analyzeROAS(m: CampaignMetrics, campaign: Campaign): AnalysisResult {
  if (m.conversions === 0 || m.roas === 0) {
    return { scoreAdjustment: 0 };
  }

  // Critical: Unprofitable
  if (m.roas < 1) {
    return {
      scoreAdjustment: -5,
      issue: createIssue({
        category: 'wasted_spend',
        label: 'Unprofitable',
        severity: 'critical',
        impactEstimate: `${m.roas.toFixed(1)}x ROAS = losing money`,
        impactValue: m.spend * (1 - m.roas),
        impactMetric: 'savings',
        confidence: 'high',
        summary: `ROAS ${m.roas.toFixed(2)}x means you're losing $${((1 - m.roas) * m.spend).toFixed(0)} for every $${m.spend.toFixed(0)} spent.`,
        evidence: {
          metrics: [
            createMetricChange('ROAS', m.roas, 1, 'number', false),
            createMetricChange('Spend', m.spend, undefined, 'currency'),
          ],
          benchmark: 'Breakeven: 1.0x ROAS',
        },
        fixes: [
          createFix({
            action: 'Reduce budget significantly',
            actionType: 'adjust_budget',
            description: 'Cut budget by 50% while optimizing',
            expectedImpact: 'Stop the bleeding immediately',
            impactRange: { min: m.spend * 0.3, max: m.spend * 0.5, metric: 'savings' },
            confidence: 'high',
            effort: 'quick',
            risk: 'medium',
          }),
        ],
      }),
    };
  }

  // Warning: Break-even
  if (m.roas < 2) {
    return {
      scoreAdjustment: 0,
      issue: createIssue({
        category: 'wasted_spend',
        label: 'Low ROAS',
        severity: 'warning',
        impactEstimate: `${m.roas.toFixed(1)}x ROAS - room to improve`,
        impactValue: m.spend,
        impactMetric: 'savings',
        confidence: 'medium',
        summary: `ROAS ${m.roas.toFixed(2)}x is marginal. Target 2x+ for healthy profitability.`,
        evidence: {
          metrics: [createMetricChange('ROAS', m.roas, 2, 'number')],
          benchmark: 'Target: 2.0x+ ROAS',
        },
        fixes: [],
      }),
    };
  }

  // Good ROAS
  if (m.roas >= 4) {
    return { scoreAdjustment: 10 };
  }
  return { scoreAdjustment: 5 };
}

function analyzeConversions(m: CampaignMetrics, campaign: Campaign): AnalysisResult {
  // Check for conversion tracking anomalies
  if (m.clicks > 100 && m.conversions === 0) {
    return {
      scoreAdjustment: -5,
      issue: createIssue({
        category: 'tracking',
        label: 'Tracking Issue?',
        severity: 'warning',
        impactEstimate: 'Possible missing conversions',
        impactValue: 50, // Estimated impact
        impactMetric: 'conversions',
        confidence: 'medium',
        summary: `${m.clicks} clicks but 0 conversions may indicate tracking issues.`,
        evidence: {
          metrics: [
            createMetricChange('Clicks', m.clicks, undefined, 'number'),
            createMetricChange('Conversions', 0, undefined, 'number'),
          ],
          anomalyDetected: true,
        },
        fixes: [
          createFix({
            action: 'Verify conversion tracking',
            actionType: 'fix_tracking',
            description: 'Check that conversion tags are firing correctly',
            expectedImpact: 'May reveal hidden conversions',
            impactRange: { min: 0, max: m.clicks * 0.02, metric: 'conversions' },
            confidence: 'medium',
            effort: 'moderate',
            risk: 'low',
          }),
        ],
      }),
    };
  }

  return { scoreAdjustment: 0 };
}

// ============================================
// Opportunity Detection
// ============================================

function checkScalingOpportunity(
  m: CampaignMetrics,
  campaign: Campaign,
  currentScore: number
): CampaignOpportunity | null {
  // High performer that could scale
  if (currentScore >= HEALTH_THRESHOLDS.HEALTHY && m.conversions > 5 && m.cpa < CPA_BENCHMARKS[m.type]?.good) {
    return {
      id: `opp-scale-${campaign.id}`,
      category: 'scale',
      label: 'Ready to Scale',
      description: `Strong performance with ${m.conversions} conversions at $${m.cpa.toFixed(0)} CPA.`,
      potentialImpact: `+${Math.round(m.conversions * 0.3)} conversions with 30% budget increase`,
      impactValue: m.conversions * 0.3,
      confidence: 'medium',
      requirements: ['Sufficient budget headroom', 'Stable CPA over past 7 days'],
      actions: [
        createFix({
          action: 'Increase budget 20%',
          actionType: 'scale_budget',
          description: 'Gradually scale budget to capture more conversions',
          expectedImpact: `+${Math.round(m.conversions * 0.2)} conversions/week`,
          impactRange: { min: m.conversions * 0.1, max: m.conversions * 0.3, metric: 'conversions' },
          confidence: 'medium',
          effort: 'quick',
          risk: 'low',
        }),
      ],
    };
  }

  return null;
}

// ============================================
// Helper Functions
// ============================================

function createIssue(params: {
  category: IssueCategory;
  label: string;
  severity: IssueSeverity;
  impactEstimate: string;
  impactValue: number;
  impactMetric: 'savings' | 'conversions' | 'ctr' | 'cpa';
  confidence: ConfidenceLevel;
  summary: string;
  evidence: Partial<DiagnosticEvidence>;
  fixes: RecommendedFix[];
}): CampaignIssue {
  return {
    id: `issue-${params.category}-${Date.now()}`,
    category: params.category,
    label: params.label,
    icon: getIconForCategory(params.category),
    severity: params.severity,
    impactEstimate: params.impactEstimate,
    impactValue: params.impactValue,
    impactMetric: params.impactMetric,
    confidence: params.confidence,
    summary: params.summary,
    evidence: {
      metrics: params.evidence.metrics || [],
      benchmark: params.evidence.benchmark,
      anomalyDetected: params.evidence.anomalyDetected,
      timeline: params.evidence.timeline,
    },
    fixes: params.fixes,
    createdAt: new Date(),
  };
}

function createFix(params: {
  action: string;
  actionType: RecommendedFix['actionType'];
  description: string;
  expectedImpact: string;
  impactRange: RecommendedFix['impactRange'];
  confidence: ConfidenceLevel;
  effort: RecommendedFix['effort'];
  risk: RecommendedFix['risk'];
  entityType?: string;
  entityId?: string;
}): RecommendedFix {
  return {
    id: `fix-${params.actionType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action: params.action,
    actionType: params.actionType,
    description: params.description,
    expectedImpact: params.expectedImpact,
    impactRange: params.impactRange,
    assumptions: [],
    confidence: params.confidence,
    effort: params.effort,
    risk: params.risk,
    actionPayload: params.entityType
      ? {
          entityType: params.entityType,
          entityId: params.entityId || '',
        }
      : undefined,
  };
}

function createMetricChange(
  name: string,
  current: number,
  previous: number | undefined,
  format: MetricChange['format'],
  isGood?: boolean
): MetricChange {
  const change = previous !== undefined ? current - previous : undefined;
  const changePercent = previous !== undefined && previous !== 0 ? ((current - previous) / previous) * 100 : undefined;
  const direction: MetricChange['direction'] =
    change === undefined ? 'stable' : change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

  return {
    name,
    label: name,
    current,
    previous,
    change,
    changePercent,
    direction,
    format,
    isGood,
  };
}

function getIconForCategory(category: IssueCategory): string {
  const icons: Record<IssueCategory, string> = {
    tracking: 'chart-bar',
    budget_pacing: 'currency-dollar',
    wasted_spend: 'trash',
    low_conv_rate: 'arrow-trending-down',
    high_cpa: 'arrow-trending-up',
    low_ctr: 'cursor-arrow-rays',
    quality: 'star',
    targeting: 'user-group',
    bid_strategy: 'adjustments-horizontal',
    ad_strength: 'document-text',
  };
  return icons[category] || 'exclamation-circle';
}

function determineTrend(m: CampaignMetrics): CampaignHealth['trend'] {
  if (!m.previousConversions && !m.previousCpa) return 'stable';

  let improvementCount = 0;
  let declineCount = 0;

  if (m.previousConversions !== undefined) {
    if (m.conversions > m.previousConversions) improvementCount++;
    else if (m.conversions < m.previousConversions) declineCount++;
  }

  if (m.previousCpa !== undefined && m.cpa > 0) {
    if (m.cpa < m.previousCpa) improvementCount++;
    else if (m.cpa > m.previousCpa) declineCount++;
  }

  if (improvementCount > declineCount) return 'improving';
  if (declineCount > improvementCount) return 'declining';
  return 'stable';
}

function determineDataQuality(m: CampaignMetrics): CampaignHealth['dataQuality'] {
  if (m.impressions >= 1000 && m.clicks >= 100) return 'good';
  if (m.impressions >= 100 && m.clicks >= 10) return 'limited';
  return 'insufficient';
}

// ============================================
// Budget Pacing
// ============================================

export function calculateBudgetPacing(
  spend: number,
  budget: number,
  daysElapsed: number,
  daysInPeriod: number = 30
): BudgetPacing {
  const daysRemaining = Math.max(0, daysInPeriod - daysElapsed);
  const expectedSpend = (budget / daysInPeriod) * daysElapsed;
  const projectedSpend = daysRemaining > 0 ? (spend / daysElapsed) * daysInPeriod : spend;
  const percentUsed = budget > 0 ? (spend / budget) * 100 : 0;

  let status: BudgetPacing['status'];
  let recommendation: string | undefined;

  const pacingRatio = spend / expectedSpend;

  if (pacingRatio > 1.2) {
    status = 'overspend';
    recommendation = 'Campaign is spending faster than planned. Consider reducing daily budget.';
  } else if (pacingRatio < 0.8) {
    status = 'underspend';
    recommendation = 'Campaign is underspending. Check for limited reach or low bids.';
  } else if (budget > 0 && spend >= budget * 0.9) {
    status = 'limited';
    recommendation = 'Budget nearly exhausted. Consider increasing if performance is good.';
  } else {
    status = 'on_track';
  }

  return {
    status,
    percentUsed,
    daysRemaining,
    projectedSpend,
    budget,
    recommendation,
  };
}
