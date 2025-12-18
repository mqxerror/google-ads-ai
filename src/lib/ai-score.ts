import { AIScoreBreakdown, AIScoreFactor, CampaignType } from '@/types/campaign';

// Industry benchmarks by campaign type
const CTR_BENCHMARKS: Record<CampaignType, { good: number; warning: number }> = {
  SEARCH: { good: 3.17, warning: 2.0 },
  DISPLAY: { good: 0.46, warning: 0.3 },
  SHOPPING: { good: 0.86, warning: 0.5 },
  VIDEO: { good: 0.4, warning: 0.2 },
  PERFORMANCE_MAX: { good: 2.0, warning: 1.0 },
  DEMAND_GEN: { good: 1.5, warning: 0.8 },
  APP: { good: 1.0, warning: 0.5 },
};

const CPA_BENCHMARKS: Record<CampaignType, { good: number; warning: number }> = {
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
  qualityScore?: number; // For Search campaigns
}

export function calculateAIScoreWithBreakdown(metrics: CampaignMetrics): AIScoreBreakdown {
  const factors: AIScoreFactor[] = [];
  const { spend, clicks, impressions, conversions, ctr, cpa, roas, type, qualityScore } = metrics;

  // Base score starts at 50
  let baseScore = 50;

  // Factor 1: CTR vs Benchmark (25% weight)
  const ctrBenchmark = CTR_BENCHMARKS[type] || CTR_BENCHMARKS.SEARCH;
  const ctrFactor = calculateCTRFactor(ctr, ctrBenchmark, impressions);
  factors.push(ctrFactor);
  baseScore += ctrFactor.score;

  // Factor 2: Conversion Rate / CPA (25% weight)
  const cpaBenchmark = CPA_BENCHMARKS[type] || CPA_BENCHMARKS.SEARCH;
  const conversionFactor = calculateConversionFactor(spend, conversions, cpa, cpaBenchmark);
  factors.push(conversionFactor);
  baseScore += conversionFactor.score;

  // Factor 3: Wasted Spend (25% weight)
  const wastedSpendFactor = calculateWastedSpendFactor(spend, conversions, clicks);
  factors.push(wastedSpendFactor);
  baseScore += wastedSpendFactor.score;

  // Factor 4: ROAS / Volume (15% weight)
  const roasFactor = calculateROASFactor(roas, conversions);
  factors.push(roasFactor);
  baseScore += roasFactor.score;

  // Factor 5: Quality Score (10% weight, Search only)
  if (type === 'SEARCH' && qualityScore !== undefined) {
    const qsFactor = calculateQualityScoreFactor(qualityScore);
    factors.push(qsFactor);
    baseScore += qsFactor.score;
  }

  const totalScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Determine top issue
  const criticalFactors = factors.filter(f => f.status === 'critical');
  const warningFactors = factors.filter(f => f.status === 'warning');

  let topIssue: string | undefined;
  if (criticalFactors.length > 0) {
    // Find the factor with lowest score
    const worstFactor = criticalFactors.reduce((a, b) => a.score < b.score ? a : b);
    topIssue = worstFactor.description;
  } else if (warningFactors.length > 0) {
    const worstFactor = warningFactors.reduce((a, b) => a.score < b.score ? a : b);
    topIssue = worstFactor.description;
  }

  return {
    totalScore,
    factors,
    topIssue,
  };
}

function calculateCTRFactor(
  ctr: number,
  benchmark: { good: number; warning: number },
  impressions: number
): AIScoreFactor {
  let score = 0;
  let status: AIScoreFactor['status'] = 'good';
  let description = '';

  if (impressions < 100) {
    return {
      name: 'CTR Performance',
      score: 0,
      weight: 25,
      status: 'warning',
      description: 'Not enough impressions to evaluate CTR',
    };
  }

  if (ctr >= benchmark.good) {
    score = 15;
    status = 'good';
    description = `CTR ${ctr.toFixed(2)}% is above benchmark (${benchmark.good}%)`;
  } else if (ctr >= benchmark.warning) {
    score = 5;
    status = 'warning';
    description = `CTR ${ctr.toFixed(2)}% is below benchmark (${benchmark.good}%)`;
  } else {
    score = -10;
    status = 'critical';
    description = `CTR ${ctr.toFixed(2)}% is significantly below benchmark (${benchmark.good}%)`;
  }

  return {
    name: 'CTR Performance',
    score,
    weight: 25,
    status,
    description,
  };
}

function calculateConversionFactor(
  spend: number,
  conversions: number,
  cpa: number,
  benchmark: { good: number; warning: number }
): AIScoreFactor {
  let score = 0;
  let status: AIScoreFactor['status'] = 'good';
  let description = '';

  if (spend < 10) {
    return {
      name: 'Conversion Efficiency',
      score: 0,
      weight: 25,
      status: 'warning',
      description: 'Not enough spend to evaluate conversion efficiency',
    };
  }

  if (conversions === 0) {
    if (spend > 100) {
      score = -20;
      status = 'critical';
      description = `$${spend.toFixed(0)} spent with no conversions`;
    } else {
      score = -5;
      status = 'warning';
      description = 'No conversions yet';
    }
  } else if (cpa <= benchmark.good) {
    score = 20;
    status = 'good';
    description = `CPA $${cpa.toFixed(2)} is excellent (target: $${benchmark.good})`;
  } else if (cpa <= benchmark.warning) {
    score = 5;
    status = 'warning';
    description = `CPA $${cpa.toFixed(2)} is above target ($${benchmark.good})`;
  } else {
    score = -15;
    status = 'critical';
    description = `CPA $${cpa.toFixed(2)} is too high (target: $${benchmark.good})`;
  }

  return {
    name: 'Conversion Efficiency',
    score,
    weight: 25,
    status,
    description,
  };
}

function calculateWastedSpendFactor(
  spend: number,
  conversions: number,
  clicks: number
): AIScoreFactor {
  let score = 0;
  let status: AIScoreFactor['status'] = 'good';
  let description = '';

  if (spend < 10) {
    return {
      name: 'Wasted Spend',
      score: 0,
      weight: 25,
      status: 'good',
      description: 'Minimal spend - no waste detected',
    };
  }

  // Calculate wasted spend percentage (spend with no conversions)
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
  const hasSignificantSpend = spend > 100;

  if (conversions === 0 && hasSignificantSpend) {
    score = -25;
    status = 'critical';
    description = `$${spend.toFixed(0)} potential wasted spend (0 conversions)`;
  } else if (conversions === 0 && spend > 50) {
    score = -15;
    status = 'warning';
    description = `$${spend.toFixed(0)} spent without conversions - monitor closely`;
  } else if (conversionRate < 1 && hasSignificantSpend) {
    score = -10;
    status = 'warning';
    description = `Low conversion rate (${conversionRate.toFixed(2)}%) suggests inefficiency`;
  } else if (conversions > 0) {
    score = 15;
    status = 'good';
    description = 'Spend is generating conversions efficiently';
  } else {
    score = 0;
    status = 'good';
    description = 'No significant waste detected';
  }

  return {
    name: 'Wasted Spend',
    score,
    weight: 25,
    status,
    description,
  };
}

function calculateROASFactor(roas: number, conversions: number): AIScoreFactor {
  let score = 0;
  let status: AIScoreFactor['status'] = 'good';
  let description = '';

  if (conversions === 0) {
    return {
      name: 'Return on Ad Spend',
      score: 0,
      weight: 15,
      status: 'warning',
      description: 'No conversion value data available',
    };
  }

  if (roas >= 4) {
    score = 10;
    status = 'good';
    description = `ROAS ${roas.toFixed(1)}x is excellent (>4x target)`;
  } else if (roas >= 2) {
    score = 5;
    status = 'good';
    description = `ROAS ${roas.toFixed(1)}x is profitable (>2x)`;
  } else if (roas >= 1) {
    score = 0;
    status = 'warning';
    description = `ROAS ${roas.toFixed(1)}x is break-even - needs improvement`;
  } else if (roas > 0) {
    score = -5;
    status = 'critical';
    description = `ROAS ${roas.toFixed(1)}x is unprofitable (<1x)`;
  } else {
    score = 0;
    status = 'warning';
    description = 'No ROAS data available';
  }

  return {
    name: 'Return on Ad Spend',
    score,
    weight: 15,
    status,
    description,
  };
}

function calculateQualityScoreFactor(qualityScore: number): AIScoreFactor {
  let score = 0;
  let status: AIScoreFactor['status'] = 'good';
  let description = '';

  if (qualityScore >= 7) {
    score = 5;
    status = 'good';
    description = `Quality Score ${qualityScore}/10 is above average`;
  } else if (qualityScore >= 5) {
    score = 0;
    status = 'warning';
    description = `Quality Score ${qualityScore}/10 needs improvement`;
  } else if (qualityScore > 0) {
    score = -5;
    status = 'critical';
    description = `Quality Score ${qualityScore}/10 is hurting ad rank`;
  } else {
    score = 0;
    status = 'warning';
    description = 'Quality Score not available';
  }

  return {
    name: 'Quality Score',
    score,
    weight: 10,
    status,
    description,
  };
}

// Simple score calculation (backwards compatible)
export function calculateSimpleAIScore(
  spend: number,
  conversions: number,
  clicks: number,
  impressions: number
): number {
  const breakdown = calculateAIScoreWithBreakdown({
    spend,
    clicks,
    impressions,
    conversions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: 0,
    type: 'SEARCH',
  });
  return breakdown.totalScore;
}
