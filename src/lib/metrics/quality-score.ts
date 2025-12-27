/**
 * Quality Score Prediction
 * Heuristic-based estimation of Google Ads Quality Score (1-10)
 *
 * Components:
 * - Expected CTR (50% weight)
 * - Ad Relevance (30% weight)
 * - Landing Page Experience (20% weight)
 */

import type { QualityScorePrediction } from '../database/types';

// =====================================================
// Expected CTR Estimation
// =====================================================

function estimateExpectedCtr(
  keyword: string,
  options: {
    matchType?: 'EXACT' | 'PHRASE' | 'BROAD';
    intent?: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
    competition?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    serpAdsCount?: number;
    isBrandKeyword?: boolean;
    avgPosition?: number;
  }
): number {
  let baseCtr = 2.0; // Industry average 2%

  // Match type adjustment (exact match performs best)
  if (options.matchType === 'EXACT') {
    baseCtr *= 1.3; // +30% for exact match
  } else if (options.matchType === 'PHRASE') {
    baseCtr *= 1.1; // +10% for phrase match
  }
  // BROAD uses baseline

  // Intent adjustment (transactional keywords have highest CTR)
  if (options.intent === 'transactional') {
    baseCtr *= 1.4; // +40% for buy intent
  } else if (options.intent === 'commercial') {
    baseCtr *= 1.2; // +20% for commercial investigation
  } else if (options.intent === 'navigational') {
    baseCtr *= 1.1; // +10% for navigational
  }
  // informational uses baseline

  // Brand vs non-brand (brand keywords get 2.5x CTR)
  if (options.isBrandKeyword) {
    baseCtr *= 2.5;
  }

  // Competition reduces CTR (more advertisers = lower individual CTR)
  if (options.competition === 'HIGH') {
    baseCtr *= 0.7; // -30%
  } else if (options.competition === 'LOW') {
    baseCtr *= 1.2; // +20%
  }

  // SERP ads reduce CTR (more ads above = less organic clicks)
  if (options.serpAdsCount !== undefined) {
    baseCtr *= Math.max(0.5, 1 - options.serpAdsCount * 0.05);
  }

  // Ad position adjustment (higher position = higher CTR)
  if (options.avgPosition !== undefined) {
    if (options.avgPosition <= 1.5) {
      baseCtr *= 1.3; // Top position
    } else if (options.avgPosition <= 3) {
      baseCtr *= 1.1; // Second or third
    } else if (options.avgPosition > 5) {
      baseCtr *= 0.7; // Lower positions
    }
  }

  // Clamp to realistic range (0.5% - 15%)
  return Math.max(0.5, Math.min(15, baseCtr));
}

function ctrToQualityScore(ctr: number): number {
  // Convert CTR % to 1-10 scale
  if (ctr < 1) return 1;
  if (ctr < 1.5) return 2;
  if (ctr < 2) return 3;
  if (ctr < 2.5) return 4;
  if (ctr < 3) return 5;
  if (ctr < 4) return 6;
  if (ctr < 5) return 7;
  if (ctr < 7) return 8;
  if (ctr < 10) return 9;
  return 10;
}

// =====================================================
// Ad Relevance Estimation
// =====================================================

function estimateAdRelevance(
  keyword: string,
  options: {
    matchType?: 'EXACT' | 'PHRASE' | 'BROAD';
    intent?: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
    keywordLength?: number; // word count
  }
): number {
  let relevance = 0.7; // Baseline 70% assumption

  // High intent keywords likely have better ad relevance
  if (options.intent === 'transactional') {
    relevance = 0.9; // Ads typically well-aligned with buy intent
  } else if (options.intent === 'commercial') {
    relevance = 0.8; // Good alignment with product/service ads
  } else if (options.intent === 'navigational') {
    relevance = 0.75; // Moderate alignment
  }
  // informational uses baseline or lower

  // Exact match keywords likely have better relevance
  if (options.matchType === 'EXACT') {
    relevance += 0.1;
  }

  // Long-tail keywords (3+ words) often have better relevance
  const wordCount = options.keywordLength || keyword.split(' ').length;
  if (wordCount >= 3) {
    relevance += 0.05;
  } else if (wordCount === 1) {
    relevance -= 0.05; // Single-word keywords harder to match
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, relevance));
}

function relevanceToQualityScore(relevance: number): number {
  // Convert 0-1 relevance to 1-10 scale
  return Math.max(1, Math.min(10, Math.round(relevance * 10)));
}

// =====================================================
// Landing Page Experience Estimation
// =====================================================

function estimateLandingPageExperience(
  options: {
    hasLandingPage?: boolean;
    pageLoadTime?: number; // seconds
    mobileOptimized?: boolean;
    intent?: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
  }
): number {
  // Default assumption: Average landing page (7/10)
  let lpScore = 0.7;

  // If we know there's no dedicated landing page, lower score
  if (options.hasLandingPage === false) {
    lpScore = 0.5;
  }

  // Page load time adjustment
  if (options.pageLoadTime !== undefined) {
    if (options.pageLoadTime < 2) {
      lpScore += 0.15; // Fast load
    } else if (options.pageLoadTime > 4) {
      lpScore -= 0.15; // Slow load
    }
  }

  // Mobile optimization
  if (options.mobileOptimized === true) {
    lpScore += 0.1;
  } else if (options.mobileOptimized === false) {
    lpScore -= 0.1;
  }

  // Intent alignment (transactional keywords need transactional pages)
  if (options.intent === 'transactional') {
    // Assume most advertisers have good product pages
    lpScore += 0.05;
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, lpScore));
}

function landingPageToQualityScore(lpScore: number): number {
  return Math.max(1, Math.min(10, Math.round(lpScore * 10)));
}

// =====================================================
// Main Quality Score Prediction
// =====================================================

export function predictQualityScore(
  keyword: string,
  options: {
    // Keyword characteristics
    matchType?: 'EXACT' | 'PHRASE' | 'BROAD';
    intent?: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
    competition?: 'HIGH' | 'MEDIUM' | 'LOW' | null;

    // Account/Campaign data (if available)
    actualCtr?: number; // If we have actual CTR data, use it
    avgPosition?: number;
    historicalQualityScore?: number; // Use historical if available

    // SERP data
    serpAdsCount?: number;

    // Landing page data
    hasLandingPage?: boolean;
    pageLoadTime?: number;
    mobileOptimized?: boolean;

    // Brand
    isBrandKeyword?: boolean;
  }
): QualityScorePrediction {
  // If we have actual historical Quality Score, use it with high confidence
  if (options.historicalQualityScore) {
    return {
      predictedScore: options.historicalQualityScore,
      confidence: 0.95, // Very high confidence
      components: {
        expectedCtr: {
          value: options.actualCtr || 2.0,
          score: options.historicalQualityScore, // Approximate
          weight: 0.5,
        },
        adRelevance: {
          value: 0.8, // Estimate
          score: options.historicalQualityScore,
          weight: 0.3,
        },
        landingPageExperience: {
          value: 0.7, // Estimate
          score: options.historicalQualityScore,
          weight: 0.2,
        },
      },
      recommendations: [
        'Using actual Quality Score from account - this is accurate',
      ],
    };
  }

  // Component 1: Expected CTR (50% weight)
  const ctr = options.actualCtr ?? estimateExpectedCtr(keyword, options);
  const ctrScore = ctrToQualityScore(ctr);

  // Component 2: Ad Relevance (30% weight)
  const adRel = estimateAdRelevance(keyword, options);
  const adRelScore = relevanceToQualityScore(adRel);

  // Component 3: Landing Page Experience (20% weight)
  const lpExp = estimateLandingPageExperience(options);
  const lpScore = landingPageToQualityScore(lpExp);

  // Calculate weighted Quality Score
  const weightedScore = ctrScore * 0.5 + adRelScore * 0.3 + lpScore * 0.2;
  const predictedScore = Math.round(weightedScore);

  // Determine confidence level
  let confidence = 0.6; // Base confidence for estimates

  if (options.actualCtr !== undefined) confidence += 0.2; // Actual CTR data
  if (options.avgPosition !== undefined) confidence += 0.1; // Position data
  if (options.intent) confidence += 0.05; // Intent data
  if (options.matchType) confidence += 0.05; // Match type specified

  confidence = Math.min(0.95, confidence);

  // Generate recommendations
  const recommendations: string[] = [];

  if (ctrScore < 5) {
    recommendations.push(
      `Low expected CTR (${ctr.toFixed(1)}%) - consider using exact match and improving ad copy`
    );
  }

  if (adRelScore < 6) {
    recommendations.push(
      'Ad relevance may be low - ensure keywords appear in ad headlines and descriptions'
    );
  }

  if (lpScore < 6) {
    recommendations.push(
      'Landing page experience needs improvement - optimize load time and mobile experience'
    );
  }

  if (options.matchType === 'BROAD') {
    recommendations.push(
      'Broad match may reduce Quality Score - consider using phrase or exact match'
    );
  }

  if (predictedScore >= 8) {
    recommendations.push(
      'Excellent predicted Quality Score - this keyword should perform well'
    );
  } else if (predictedScore <= 4) {
    recommendations.push(
      'Low predicted Quality Score - may result in higher CPCs and lower ad positions'
    );
  }

  return {
    predictedScore,
    confidence,
    components: {
      expectedCtr: {
        value: ctr,
        score: ctrScore,
        weight: 0.5,
      },
      adRelevance: {
        value: adRel,
        score: adRelScore,
        weight: 0.3,
      },
      landingPageExperience: {
        value: lpExp,
        score: lpScore,
        weight: 0.2,
      },
    },
    recommendations,
  };
}

// =====================================================
// Batch Quality Score Prediction
// =====================================================

export function predictQualityScoreBatch(
  keywords: Array<{
    keyword: string;
    matchType?: 'EXACT' | 'PHRASE' | 'BROAD';
    intent?: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
    competition?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    serpAdsCount?: number;
  }>
): Map<string, QualityScorePrediction> {
  const results = new Map<string, QualityScorePrediction>();

  for (const kw of keywords) {
    const prediction = predictQualityScore(kw.keyword, kw);
    results.set(kw.keyword.toLowerCase().trim(), prediction);
  }

  return results;
}
