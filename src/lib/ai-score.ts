import { AIScoreBreakdown, AIScoreFactor, CampaignType } from '@/types/campaign';

// Industry benchmarks by campaign type
const CTR_BENCHMARKS: Record<CampaignType, { good: number; warning: number }> = {
  SEARCH: { good: 3.17, warning: 2.0 },
  DISPLAY: { good: 0.46, warning: 0.3 },
  SHOPPING: { good: 0.86, warning: 0.5 },
  VIDEO: { good: 0.4, warning: 0.2 },
  PERFORMANCE_MAX: { good: 2.0, warning: 1.0 },
  PMAX: { good: 2.0, warning: 1.0 }, // Alias for PERFORMANCE_MAX
  DEMAND_GEN: { good: 1.5, warning: 0.8 },
  APP: { good: 1.0, warning: 0.5 },
};

const CPA_BENCHMARKS: Record<CampaignType, { good: number; warning: number }> = {
  SEARCH: { good: 40, warning: 80 },
  DISPLAY: { good: 60, warning: 120 },
  SHOPPING: { good: 30, warning: 60 },
  VIDEO: { good: 50, warning: 100 },
  PERFORMANCE_MAX: { good: 35, warning: 70 },
  PMAX: { good: 35, warning: 70 }, // Alias for PERFORMANCE_MAX
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
}

export function calculateAIScoreWithBreakdown(metrics: CampaignMetrics): AIScoreBreakdown {
  const factors: AIScoreFactor[] = [];
  const { spend, clicks, impressions, conversions, ctr, cpa, roas, type } = metrics;

  let baseScore = 50;

  // Factor 1: CTR Performance
  const ctrBenchmark = CTR_BENCHMARKS[type] || CTR_BENCHMARKS.SEARCH;
  const ctrFactor = calculateCTRFactor(ctr, ctrBenchmark, impressions);
  factors.push(ctrFactor);
  baseScore += ctrFactor.score;

  // Factor 2: Conversion Efficiency
  const cpaBenchmark = CPA_BENCHMARKS[type] || CPA_BENCHMARKS.SEARCH;
  const conversionFactor = calculateConversionFactor(spend, conversions, cpa, cpaBenchmark);
  factors.push(conversionFactor);
  baseScore += conversionFactor.score;

  // Factor 3: Wasted Spend
  const wastedSpendFactor = calculateWastedSpendFactor(spend, conversions, clicks);
  factors.push(wastedSpendFactor);
  baseScore += wastedSpendFactor.score;

  // Factor 4: ROAS
  const roasFactor = calculateROASFactor(roas, conversions);
  factors.push(roasFactor);
  baseScore += roasFactor.score;

  const totalScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  const criticalFactors = factors.filter(f => f.status === 'critical');
  const warningFactors = factors.filter(f => f.status === 'warning');

  let topIssue: string | undefined;
  if (criticalFactors.length > 0) {
    const worstFactor = criticalFactors.reduce((a, b) => a.score < b.score ? a : b);
    topIssue = worstFactor.description;
  } else if (warningFactors.length > 0) {
    const worstFactor = warningFactors.reduce((a, b) => a.score < b.score ? a : b);
    topIssue = worstFactor.description;
  }

  return { totalScore, factors, topIssue };
}

function calculateCTRFactor(
  ctr: number,
  benchmark: { good: number; warning: number },
  impressions: number
): AIScoreFactor {
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
    return {
      name: 'CTR Performance',
      score: 15,
      weight: 25,
      status: 'good',
      description: `CTR ${ctr.toFixed(2)}% is above benchmark`,
    };
  } else if (ctr >= benchmark.warning) {
    return {
      name: 'CTR Performance',
      score: 5,
      weight: 25,
      status: 'warning',
      description: `CTR ${ctr.toFixed(2)}% is below benchmark`,
    };
  } else {
    return {
      name: 'CTR Performance',
      score: -10,
      weight: 25,
      status: 'critical',
      description: `CTR ${ctr.toFixed(2)}% is significantly below benchmark`,
    };
  }
}

function calculateConversionFactor(
  spend: number,
  conversions: number,
  cpa: number,
  benchmark: { good: number; warning: number }
): AIScoreFactor {
  if (spend < 10) {
    return {
      name: 'Conversion Efficiency',
      score: 0,
      weight: 25,
      status: 'warning',
      description: 'Not enough spend to evaluate',
    };
  }

  if (conversions === 0) {
    return {
      name: 'Conversion Efficiency',
      score: spend > 100 ? -20 : -5,
      weight: 25,
      status: spend > 100 ? 'critical' : 'warning',
      description: conversions === 0 && spend > 100
        ? `$${spend.toFixed(0)} spent with no conversions`
        : 'No conversions yet',
    };
  }

  if (cpa <= benchmark.good) {
    return {
      name: 'Conversion Efficiency',
      score: 20,
      weight: 25,
      status: 'good',
      description: `CPA $${cpa.toFixed(2)} is excellent`,
    };
  } else if (cpa <= benchmark.warning) {
    return {
      name: 'Conversion Efficiency',
      score: 5,
      weight: 25,
      status: 'warning',
      description: `CPA $${cpa.toFixed(2)} is above target`,
    };
  } else {
    return {
      name: 'Conversion Efficiency',
      score: -15,
      weight: 25,
      status: 'critical',
      description: `CPA $${cpa.toFixed(2)} is too high`,
    };
  }
}

function calculateWastedSpendFactor(
  spend: number,
  conversions: number,
  clicks: number
): AIScoreFactor {
  if (spend < 10) {
    return {
      name: 'Wasted Spend',
      score: 0,
      weight: 25,
      status: 'good',
      description: 'Minimal spend',
    };
  }

  if (conversions === 0 && spend > 100) {
    return {
      name: 'Wasted Spend',
      score: -25,
      weight: 25,
      status: 'critical',
      description: `$${spend.toFixed(0)} potential wasted spend`,
    };
  }

  if (conversions > 0) {
    return {
      name: 'Wasted Spend',
      score: 15,
      weight: 25,
      status: 'good',
      description: 'Spend is generating conversions',
    };
  }

  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
  if (conversionRate < 1 && spend > 100) {
    return {
      name: 'Wasted Spend',
      score: -10,
      weight: 25,
      status: 'warning',
      description: 'Low conversion rate suggests inefficiency',
    };
  }

  return {
    name: 'Wasted Spend',
    score: 0,
    weight: 25,
    status: 'good',
    description: 'No significant waste detected',
  };
}

function calculateROASFactor(roas: number, conversions: number): AIScoreFactor {
  if (conversions === 0) {
    return {
      name: 'Return on Ad Spend',
      score: 0,
      weight: 15,
      status: 'warning',
      description: 'No conversion value data',
    };
  }

  if (roas >= 4) {
    return {
      name: 'Return on Ad Spend',
      score: 10,
      weight: 15,
      status: 'good',
      description: `ROAS ${roas.toFixed(1)}x is excellent`,
    };
  } else if (roas >= 2) {
    return {
      name: 'Return on Ad Spend',
      score: 5,
      weight: 15,
      status: 'good',
      description: `ROAS ${roas.toFixed(1)}x is profitable`,
    };
  } else if (roas >= 1) {
    return {
      name: 'Return on Ad Spend',
      score: 0,
      weight: 15,
      status: 'warning',
      description: `ROAS ${roas.toFixed(1)}x is break-even`,
    };
  } else if (roas > 0) {
    return {
      name: 'Return on Ad Spend',
      score: -5,
      weight: 15,
      status: 'critical',
      description: `ROAS ${roas.toFixed(1)}x is unprofitable`,
    };
  }

  return {
    name: 'Return on Ad Spend',
    score: 0,
    weight: 15,
    status: 'warning',
    description: 'No ROAS data available',
  };
}
