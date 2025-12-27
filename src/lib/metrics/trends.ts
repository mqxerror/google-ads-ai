/**
 * Keyword Trends Analysis
 * Analyzes search volume trends, growth patterns, and seasonality
 */

import type { TrendAnalysis, KeywordTrend } from '../database/types';

// =====================================================
// Helper Functions
// =====================================================

function calculateStatistics(values: number[]): {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
} {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const median =
    values.length % 2 === 0
      ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
      : sorted[Math.floor(values.length / 2)];

  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const min = Math.min(...values);
  const max = Math.max(...values);

  return { mean, median, stdDev, min, max };
}

function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function detectSeasonality(volumes: number[]): {
  isHighlySeasonal: boolean;
  peakMonths: number[];
  lowMonths: number[];
  seasonalityIndex: number;
  pattern: string;
} {
  if (volumes.length < 12) {
    return {
      isHighlySeasonal: false,
      peakMonths: [],
      lowMonths: [],
      seasonalityIndex: 0,
      pattern: 'Insufficient data for seasonality detection (need 12+ months)',
    };
  }

  const mean = volumes.reduce((a, b) => a + b) / volumes.length;
  const stdDev = Math.sqrt(
    volumes.reduce((sum, vol) => sum + Math.pow(vol - mean, 2), 0) /
      volumes.length
  );
  const cv = mean > 0 ? stdDev / mean : 0; // Coefficient of variation

  // Highly seasonal if CV > 0.25 (25% volatility)
  const isHighlySeasonal = cv > 0.25;

  // Detect peak months (volume >1.2x mean)
  const peakMonths: number[] = [];
  const lowMonths: number[] = [];

  // Use last 12 months for month detection
  const last12Months = volumes.slice(-12);

  last12Months.forEach((vol, idx) => {
    const month = (new Date().getMonth() - 12 + idx + 1 + 12) % 12 || 12;
    if (vol > mean * 1.2) {
      peakMonths.push(month);
    } else if (vol < mean * 0.8) {
      lowMonths.push(month);
    }
  });

  // Generate pattern description
  let pattern = '';
  if (isHighlySeasonal) {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    if (peakMonths.length > 0) {
      const peakNames = peakMonths.map((m) => monthNames[m - 1]).join(', ');
      pattern = `Highly seasonal - peaks in ${peakNames}`;
    } else {
      pattern = 'Highly seasonal with irregular pattern';
    }

    if (lowMonths.length > 0) {
      const lowNames = lowMonths.map((m) => monthNames[m - 1]).join(', ');
      pattern += ` | Low months: ${lowNames}`;
    }
  } else {
    pattern = cv > 0.15 ? 'Moderate seasonality' : 'Stable year-round';
  }

  return {
    isHighlySeasonal,
    peakMonths,
    lowMonths,
    seasonalityIndex: Math.min(100, Math.round(cv * 100)),
    pattern,
  };
}

function detectGrowthTrend(
  monthlyVolumes: Array<{ year: number; month: number; volume: number }>
): {
  overallTrend: 'growing' | 'declining' | 'stable' | 'volatile';
  growthRate: number;
  momentum: 'accelerating' | 'decelerating' | 'steady';
} {
  if (monthlyVolumes.length < 3) {
    return {
      overallTrend: 'stable',
      growthRate: 0,
      momentum: 'steady',
    };
  }

  // Calculate month-over-month changes
  const changes: number[] = [];
  for (let i = 1; i < monthlyVolumes.length; i++) {
    const change = calculatePercentChange(
      monthlyVolumes[i].volume,
      monthlyVolumes[i - 1].volume
    );
    changes.push(change);
  }

  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

  // Determine overall trend
  let overallTrend: 'growing' | 'declining' | 'stable' | 'volatile';

  if (Math.abs(avgChange) < 5) {
    overallTrend = 'stable';
  } else if (avgChange > 5) {
    overallTrend = 'growing';
  } else {
    overallTrend = 'declining';
  }

  // Check for volatility (high standard deviation in changes)
  const changeStdDev = Math.sqrt(
    changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) /
      changes.length
  );

  if (changeStdDev > 30) {
    overallTrend = 'volatile';
  }

  // Determine momentum (is growth accelerating or decelerating?)
  let momentum: 'accelerating' | 'decelerating' | 'steady' = 'steady';

  if (changes.length >= 6) {
    const firstHalfAvg =
      changes.slice(0, Math.floor(changes.length / 2)).reduce((a, b) => a + b) /
      Math.floor(changes.length / 2);
    const secondHalfAvg =
      changes.slice(Math.floor(changes.length / 2)).reduce((a, b) => a + b) /
      Math.ceil(changes.length / 2);

    if (secondHalfAvg > firstHalfAvg + 5) {
      momentum = 'accelerating';
    } else if (secondHalfAvg < firstHalfAvg - 5) {
      momentum = 'decelerating';
    }
  }

  // Calculate annualized growth rate (YoY if we have 12+ months)
  let growthRate = avgChange;

  if (monthlyVolumes.length >= 12) {
    const firstYear = monthlyVolumes.slice(0, 12);
    const lastYear = monthlyVolumes.slice(-12);

    const firstYearAvg =
      firstYear.reduce((sum, m) => sum + m.volume, 0) / 12;
    const lastYearAvg = lastYear.reduce((sum, m) => sum + m.volume, 0) / 12;

    growthRate = calculatePercentChange(lastYearAvg, firstYearAvg);
  }

  return {
    overallTrend,
    growthRate: Math.round(growthRate * 10) / 10,
    momentum,
  };
}

// =====================================================
// Main Analysis Function
// =====================================================

export function analyzeTrends(
  keyword: string,
  trendData: KeywordTrend[]
): TrendAnalysis {
  // Sort by date
  const sorted = [...trendData].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  // Build monthly volumes with changes
  const monthlyVolumes = sorted.map((trend, idx) => {
    const change =
      idx > 0
        ? calculatePercentChange(trend.search_volume, sorted[idx - 1].search_volume)
        : 0;

    return {
      year: trend.year,
      month: trend.month,
      volume: trend.search_volume,
      change,
    };
  });

  // Calculate statistics
  const volumes = sorted.map((t) => t.search_volume);
  const statistics = calculateStatistics(volumes);

  // Detect growth trend
  const growth = detectGrowthTrend(monthlyVolumes);

  // Detect seasonality
  const seasonality = detectSeasonality(volumes);

  return {
    keyword,
    monthlyVolumes,
    statistics,
    growth,
    seasonality,
  };
}

// =====================================================
// Fetching Trends from Database
// =====================================================

export async function getTrendsForKeyword(
  keyword: string,
  locationId: string,
  months: number = 24
): Promise<TrendAnalysis | null> {
  const { Pool } = await import('pg');

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '38.97.60.181',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: process.env.POSTGRES_DATABASE || 'postgres',
  });

  try {
    const keywordNormalized = keyword.toLowerCase().trim();

    const result = await pool.query<KeywordTrend>(
      `
      SELECT *
      FROM keyword_trends
      WHERE keyword_normalized = $1
        AND location_id = $2
        AND (year * 12 + month) >= (EXTRACT(YEAR FROM CURRENT_DATE) * 12 + EXTRACT(MONTH FROM CURRENT_DATE) - $3)
      ORDER BY year DESC, month DESC
      LIMIT $3
      `,
      [keywordNormalized, locationId, months]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return analyzeTrends(keyword, result.rows);
  } finally {
    await pool.end();
  }
}

// =====================================================
// Trend Classification Helpers
// =====================================================

export function classifyTrend(analysis: TrendAnalysis): {
  label: string;
  color: string;
  recommendation: string;
} {
  const { growth, seasonality } = analysis;

  if (growth.overallTrend === 'growing' && growth.momentum === 'accelerating') {
    return {
      label: 'Rising Star',
      color: 'green',
      recommendation:
        'Strong upward trend with acceleration - prioritize immediately',
    };
  }

  if (growth.overallTrend === 'growing') {
    return {
      label: 'Growing',
      color: 'emerald',
      recommendation: 'Positive growth trend - good opportunity',
    };
  }

  if (growth.overallTrend === 'stable' && !seasonality.isHighlySeasonal) {
    return {
      label: 'Stable',
      color: 'blue',
      recommendation: 'Consistent demand - reliable long-term keyword',
    };
  }

  if (seasonality.isHighlySeasonal) {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const peakStr = seasonality.peakMonths
      .map((m) => monthNames[m - 1])
      .join(', ');

    return {
      label: 'Seasonal',
      color: 'yellow',
      recommendation: `Highly seasonal - focus budget during peak months: ${peakStr}`,
    };
  }

  if (growth.overallTrend === 'declining' && growth.momentum === 'accelerating') {
    return {
      label: 'Declining Fast',
      color: 'red',
      recommendation:
        'Accelerating decline - consider pausing or shifting budget',
    };
  }

  if (growth.overallTrend === 'declining') {
    return {
      label: 'Declining',
      color: 'orange',
      recommendation: 'Downward trend - monitor closely and consider alternatives',
    };
  }

  if (growth.overallTrend === 'volatile') {
    return {
      label: 'Volatile',
      color: 'purple',
      recommendation:
        'High volatility - use cautiously with flexible budgets',
    };
  }

  return {
    label: 'Unknown',
    color: 'gray',
    recommendation: 'Insufficient data for reliable recommendation',
  };
}
