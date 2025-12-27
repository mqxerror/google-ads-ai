/**
 * ROI/CPA Calculator
 * Estimates potential return on investment and cost per acquisition
 *
 * Calculates multi-scenario projections based on:
 * - Search volume
 * - CPC
 * - Competition/Difficulty
 * - User's conversion rate and order value
 */

import type {
  RoiEstimate,
  RoiProjection,
  UserAssumptions,
} from '../database/types';

// =====================================================
// Impression Share Estimation
// =====================================================

function estimateImpressionShare(
  difficulty: number | null,
  competition: 'HIGH' | 'MEDIUM' | 'LOW' | null,
  qualityScore?: number
): number {
  let impressionShare = 0.5; // Default 50%

  // Difficulty-based adjustment (0-100 scale)
  if (difficulty !== null) {
    if (difficulty < 30) {
      impressionShare = 0.7; // Easy keywords = high share
    } else if (difficulty < 50) {
      impressionShare = 0.6; // Moderate
    } else if (difficulty < 70) {
      impressionShare = 0.4; // Difficult
    } else {
      impressionShare = 0.2; // Very difficult
    }
  }

  // Competition adjustment
  if (competition === 'LOW') {
    impressionShare *= 1.2;
  } else if (competition === 'HIGH') {
    impressionShare *= 0.8;
  }

  // Quality Score boost (higher QS = more impressions)
  if (qualityScore !== undefined) {
    if (qualityScore >= 8) {
      impressionShare *= 1.2;
    } else if (qualityScore <= 4) {
      impressionShare *= 0.8;
    }
  }

  // Clamp to 0-1 (max 100% impression share)
  return Math.max(0.05, Math.min(1, impressionShare));
}

// =====================================================
// CTR Estimation
// =====================================================

function estimateClickThroughRate(
  intent: 'informational' | 'navigational' | 'commercial' | 'transactional' | null,
  competition: 'HIGH' | 'MEDIUM' | 'LOW' | null,
  qualityScore?: number,
  avgPosition?: number
): number {
  let baseCtr = 0.02; // 2% baseline

  // Intent adjustment
  if (intent === 'transactional') {
    baseCtr = 0.035; // 3.5% for buy intent
  } else if (intent === 'commercial') {
    baseCtr = 0.028; // 2.8% for research intent
  } else if (intent === 'navigational') {
    baseCtr = 0.025; // 2.5%
  }
  // informational stays at 2%

  // Competition reduces CTR
  if (competition === 'HIGH') {
    baseCtr *= 0.85;
  } else if (competition === 'LOW') {
    baseCtr *= 1.15;
  }

  // Quality Score affects CTR (higher QS = better ad position = higher CTR)
  if (qualityScore !== undefined) {
    if (qualityScore >= 8) {
      baseCtr *= 1.3;
    } else if (qualityScore >= 6) {
      baseCtr *= 1.1;
    } else if (qualityScore <= 4) {
      baseCtr *= 0.8;
    }
  }

  // Ad position affects CTR dramatically
  if (avgPosition !== undefined) {
    if (avgPosition <= 1.5) {
      baseCtr *= 1.4; // Position 1
    } else if (avgPosition <= 2.5) {
      baseCtr *= 1.2; // Position 2
    } else if (avgPosition <= 3.5) {
      baseCtr *= 1.0; // Position 3
    } else if (avgPosition > 5) {
      baseCtr *= 0.6; // Position 5+
    }
  }

  return Math.max(0.005, Math.min(0.15, baseCtr)); // 0.5% - 15% range
}

// =====================================================
// Single Scenario Calculation
// =====================================================

function calculateProjection(
  searchVolume: number,
  cpc: number,
  impressionShare: number,
  ctr: number,
  conversionRate: number,
  avgOrderValue: number,
  profitMargin: number
): RoiProjection {
  const estimatedImpressions = Math.round(searchVolume * impressionShare);
  const estimatedClicks = Math.round(estimatedImpressions * ctr);
  const estimatedCost = Number((estimatedClicks * cpc).toFixed(2));
  const estimatedConversions = Number(
    (estimatedClicks * conversionRate).toFixed(2)
  );
  const estimatedRevenue = Number(
    (estimatedConversions * avgOrderValue).toFixed(2)
  );

  const profit = estimatedRevenue * profitMargin;
  const roi =
    estimatedCost > 0 ? ((profit - estimatedCost) / estimatedCost) * 100 : 0;
  const roas = estimatedCost > 0 ? estimatedRevenue / estimatedCost : 0;
  const cpa =
    estimatedConversions > 0 ? estimatedCost / estimatedConversions : 0;

  return {
    estimatedImpressions,
    estimatedClicks,
    estimatedConversions,
    estimatedCost,
    estimatedRevenue,
    roi: Number(roi.toFixed(1)),
    roas: Number(roas.toFixed(2)),
    cpa: Number(cpa.toFixed(2)),
  };
}

// =====================================================
// Main ROI Calculation
// =====================================================

export function calculateRoi(
  keyword: {
    keyword: string;
    searchVolume: number | null;
    cpc: number | null;
    difficulty: number | null;
    competition: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    intent: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
    qualityScore?: number;
  },
  userAssumptions: UserAssumptions
): RoiEstimate {
  const searchVolume = keyword.searchVolume || 0;
  const cpc = keyword.cpc || 1.0;

  // Estimate impression share based on difficulty
  const impressionShare = estimateImpressionShare(
    keyword.difficulty,
    keyword.competition,
    keyword.qualityScore
  );

  // Estimate CTR
  const estimatedCtr = userAssumptions.ctr || estimateClickThroughRate(
    keyword.intent,
    keyword.competition,
    keyword.qualityScore
  );

  // User assumptions with defaults
  const conversionRate = userAssumptions.conversionRate || 0.02; // 2% default
  const avgOrderValue = userAssumptions.avgOrderValue || 100; // $100 default
  const profitMargin = userAssumptions.profitMargin || 0.3; // 30% default

  // Calculate realistic scenario
  const realistic = calculateProjection(
    searchVolume,
    cpc,
    impressionShare,
    estimatedCtr,
    conversionRate,
    avgOrderValue,
    profitMargin
  );

  // Calculate conservative scenario (lower performance)
  const conservative = calculateProjection(
    searchVolume,
    cpc,
    impressionShare * 0.7, // 70% of realistic impression share
    estimatedCtr * 0.8, // 80% of realistic CTR
    conversionRate * 0.7, // 70% of realistic conversion rate
    avgOrderValue,
    profitMargin
  );

  // Calculate optimistic scenario (higher performance)
  const optimistic = calculateProjection(
    searchVolume,
    cpc,
    Math.min(1, impressionShare * 1.3), // 130% of realistic (capped at 100%)
    Math.min(0.15, estimatedCtr * 1.2), // 120% of realistic (capped at 15%)
    conversionRate * 1.3, // 130% of realistic conversion rate
    avgOrderValue,
    profitMargin
  );

  return {
    projections: realistic,
    assumptions: {
      impressionShare,
      ctr: estimatedCtr,
      conversionRate,
      avgOrderValue,
      profitMargin,
    },
    scenarios: {
      conservative,
      realistic,
      optimistic,
    },
  };
}

// =====================================================
// Batch ROI Calculation
// =====================================================

export function calculateRoiBatch(
  keywords: Array<{
    keyword: string;
    searchVolume: number | null;
    cpc: number | null;
    difficulty: number | null;
    competition: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    intent: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
    qualityScore?: number;
  }>,
  userAssumptions: UserAssumptions
): Map<string, RoiEstimate> {
  const results = new Map<string, RoiEstimate>();

  for (const kw of keywords) {
    const estimate = calculateRoi(kw, userAssumptions);
    results.set(kw.keyword.toLowerCase().trim(), estimate);
  }

  return results;
}

// =====================================================
// ROI Classification
// =====================================================

export function classifyRoi(estimate: RoiEstimate): {
  label: string;
  color: string;
  recommendation: string;
} {
  const { roi, roas, cpa } = estimate.projections;

  if (roi > 200) {
    return {
      label: 'Excellent ROI',
      color: 'green',
      recommendation:
        'Very strong potential - prioritize this keyword in your campaigns',
    };
  }

  if (roi > 100) {
    return {
      label: 'Great ROI',
      color: 'emerald',
      recommendation: 'Good investment opportunity - allocate significant budget',
    };
  }

  if (roi > 50) {
    return {
      label: 'Good ROI',
      color: 'blue',
      recommendation: 'Positive returns expected - worth including in campaigns',
    };
  }

  if (roi > 0) {
    return {
      label: 'Marginal ROI',
      color: 'yellow',
      recommendation:
        'Small profit margin - monitor closely and optimize for better performance',
    };
  }

  if (roi > -50) {
    return {
      label: 'Break-even',
      color: 'orange',
      recommendation:
        'Close to break-even - focus on conversion rate optimization before scaling',
    };
  }

  return {
    label: 'Negative ROI',
    color: 'red',
    recommendation:
      'Likely unprofitable - avoid or test with very small budget first',
  };
}

// =====================================================
// Budget Recommendation
// =====================================================

export function recommendBudget(
  estimate: RoiEstimate,
  totalBudget: number
): {
  recommendedBudget: number;
  reasoning: string;
  monthlySpend: number;
  expectedRevenue: number;
  expectedProfit: number;
} {
  const { roi, estimatedCost, estimatedRevenue } = estimate.projections;

  // Allocate budget based on ROI performance
  let budgetPercentage = 0;

  if (roi > 200) {
    budgetPercentage = 0.25; // 25% of total budget for excellent ROI
  } else if (roi > 100) {
    budgetPercentage = 0.15; // 15% for great ROI
  } else if (roi > 50) {
    budgetPercentage = 0.10; // 10% for good ROI
  } else if (roi > 0) {
    budgetPercentage = 0.05; // 5% for marginal ROI
  } else {
    budgetPercentage = 0.01; // 1% for testing only
  }

  const recommendedBudget = Math.round(totalBudget * budgetPercentage);

  // Calculate expected outcomes
  const multiplier = recommendedBudget / Math.max(1, estimatedCost);
  const expectedRevenue = estimatedRevenue * multiplier;
  const expectedProfit =
    expectedRevenue * estimate.assumptions.profitMargin - recommendedBudget;

  let reasoning = '';
  if (roi > 100) {
    reasoning = `Strong ROI (${roi.toFixed(0)}%) justifies ${(budgetPercentage * 100).toFixed(0)}% budget allocation`;
  } else if (roi > 0) {
    reasoning = `Positive but modest ROI (${roi.toFixed(0)}%) suggests cautious ${(budgetPercentage * 100).toFixed(0)}% allocation`;
  } else {
    reasoning = `Negative ROI (${roi.toFixed(0)}%) - minimal budget for testing only`;
  }

  return {
    recommendedBudget,
    reasoning,
    monthlySpend: recommendedBudget,
    expectedRevenue: Number(expectedRevenue.toFixed(2)),
    expectedProfit: Number(expectedProfit.toFixed(2)),
  };
}
