/**
 * Quota Tracking System
 *
 * Tracks API usage and costs across all providers:
 * - Google Ads: Free with active campaigns, 10,000 requests/month
 * - Moz: 1 credit per keyword
 * - DataForSEO: Pay-per-use, track balance
 *
 * Provides:
 * - Usage tracking
 * - Cost estimation
 * - Quota warnings
 * - Monthly reset tracking
 */

import { getSupabaseClient } from '../supabase';
import { getDataForSEOAccountInfo } from './dataforseo';
import type { QuotaUsage, QuotaStatus } from './types';

// Quota limits
const GOOGLE_ADS_MONTHLY_LIMIT = 10000; // requests per month
const MOZ_COST_PER_KEYWORD = 1; // credits per keyword
const DATAFORSEO_COST_PER_KEYWORD = 0.002; // estimated $0.002 per keyword

/**
 * Get current quota status for all providers
 */
export async function getQuotaStatus(): Promise<QuotaStatus> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Google Ads quota
  const googleAdsUsage = await getMonthlyUsage('google_ads', monthStart, monthEnd);
  const googleAdsQuota: QuotaUsage = {
    provider: 'google_ads',
    used: googleAdsUsage,
    limit: GOOGLE_ADS_MONTHLY_LIMIT,
    resetAt: monthEnd,
    costPerUnit: 0, // Free with active campaigns
  };

  // Moz quota
  const mozUsage = await getMonthlyUsage('moz', monthStart, monthEnd);
  const mozQuota: QuotaUsage = {
    provider: 'moz',
    used: mozUsage,
    limit: Infinity, // No hard limit, but costs credits
    resetAt: monthEnd,
    costPerUnit: MOZ_COST_PER_KEYWORD,
  };

  // DataForSEO quota (check account balance)
  let dataForSeoBalance = 0;
  try {
    const accountInfo = await getDataForSEOAccountInfo();
    if (accountInfo.success && accountInfo.balance) {
      dataForSeoBalance = accountInfo.balance;
    }
  } catch (error) {
    console.error('[QuotaTracker] Error fetching DataForSEO balance:', error);
  }

  const dataForSeoUsage = await getMonthlyUsage('dataforseo', monthStart, monthEnd);
  const dataForSeoQuota: QuotaUsage = {
    provider: 'dataforseo',
    used: dataForSeoUsage,
    limit: dataForSeoBalance / DATAFORSEO_COST_PER_KEYWORD, // Estimated keywords available
    resetAt: new Date(9999, 0, 1), // No monthly reset, balance-based
    costPerUnit: DATAFORSEO_COST_PER_KEYWORD,
  };

  // Calculate total estimated cost for the month
  const totalEstimatedCost =
    mozUsage * MOZ_COST_PER_KEYWORD +
    dataForSeoUsage * DATAFORSEO_COST_PER_KEYWORD;

  return {
    googleAds: googleAdsQuota,
    moz: mozQuota,
    dataForSeo: dataForSeoQuota,
    totalEstimatedCost,
  };
}

/**
 * Get monthly usage for a specific provider
 * Counts keywords fetched from cache that originated from this provider
 */
async function getMonthlyUsage(
  provider: 'google_ads' | 'moz' | 'dataforseo',
  monthStart: Date,
  monthEnd: Date
): Promise<number> {
  const client = getSupabaseClient();

  try {
    let statusField: string;
    switch (provider) {
      case 'google_ads':
        statusField = 'gads_status';
        break;
      case 'moz':
        statusField = 'moz_status';
        break;
      case 'dataforseo':
        statusField = 'dataforseo_status';
        break;
    }

    // Count keywords that were successfully fetched from this provider this month
    const { count, error } = await client
      .from('keyword_metrics')
      .select('*', { count: 'exact', head: true })
      .eq(statusField, 'success')
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString());

    if (error) {
      console.error(`[QuotaTracker] Error counting ${provider} usage:`, error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error(`[QuotaTracker] Unexpected error counting ${provider} usage:`, error);
    return 0;
  }
}

/**
 * Estimate cost for enriching a batch of keywords
 */
export function estimateCost(
  keywordCount: number,
  providers: ('google_ads' | 'moz' | 'dataforseo')[]
): {
  googleAds: number;
  moz: number;
  dataForSeo: number;
  total: number;
  breakdown: string;
} {
  const googleAdsCost = providers.includes('google_ads') ? 0 : 0; // Free
  const mozCost = providers.includes('moz') ? keywordCount * MOZ_COST_PER_KEYWORD : 0;
  const dataForSeoCost = providers.includes('dataforseo') ? keywordCount * DATAFORSEO_COST_PER_KEYWORD : 0;

  const total = googleAdsCost + mozCost + dataForSeoCost;

  const breakdownParts: string[] = [];
  if (providers.includes('google_ads')) {
    breakdownParts.push('Google Ads: Free');
  }
  if (providers.includes('moz')) {
    breakdownParts.push(`Moz: ${mozCost} credits`);
  }
  if (providers.includes('dataforseo')) {
    breakdownParts.push(`DataForSEO: $${dataForSeoCost.toFixed(2)}`);
  }

  return {
    googleAds: googleAdsCost,
    moz: mozCost,
    dataForSeo: dataForSeoCost,
    total,
    breakdown: breakdownParts.join(', '),
  };
}

/**
 * Check if quota is available for a request
 * Returns warnings if approaching limits
 */
export async function checkQuotaAvailability(
  keywordCount: number,
  providers: ('google_ads' | 'moz' | 'dataforseo')[]
): Promise<{
  canProceed: boolean;
  warnings: string[];
  estimatedCost: number;
}> {
  const warnings: string[] = [];
  let canProceed = true;

  const quotaStatus = await getQuotaStatus();
  const costEstimate = estimateCost(keywordCount, providers);

  // Check Google Ads quota (if used)
  if (providers.includes('google_ads')) {
    const remaining = quotaStatus.googleAds.limit - quotaStatus.googleAds.used;
    const percentUsed = (quotaStatus.googleAds.used / quotaStatus.googleAds.limit) * 100;

    if (keywordCount > remaining) {
      warnings.push(`Google Ads: Insufficient quota (${remaining}/${quotaStatus.googleAds.limit} remaining). Request would exceed limit.`);
      canProceed = false;
    } else if (percentUsed > 80) {
      warnings.push(`Google Ads: ${percentUsed.toFixed(0)}% of monthly quota used (${quotaStatus.googleAds.used}/${quotaStatus.googleAds.limit})`);
    }
  }

  // Check DataForSEO balance (if used)
  if (providers.includes('dataforseo')) {
    const estimatedKeywordsAvailable = quotaStatus.dataForSeo.limit;

    if (keywordCount > estimatedKeywordsAvailable) {
      warnings.push(`DataForSEO: Insufficient balance. Estimated ${estimatedKeywordsAvailable} keywords available, but ${keywordCount} requested.`);
      canProceed = false;
    } else if (estimatedKeywordsAvailable < 100) {
      warnings.push(`DataForSEO: Low balance. Only ~${Math.floor(estimatedKeywordsAvailable)} keywords remaining.`);
    }
  }

  // Moz has no hard limit, but warn about cost
  if (providers.includes('moz') && keywordCount > 100) {
    warnings.push(`Moz: High credit usage. This request will use ${costEstimate.moz} credits.`);
  }

  return {
    canProceed,
    warnings,
    estimatedCost: costEstimate.total,
  };
}

/**
 * Log API usage (for tracking)
 * Called after successful API calls to track quota consumption
 */
export async function logApiUsage(
  provider: 'google_ads' | 'moz' | 'dataforseo',
  keywordCount: number,
  success: boolean,
  cost: number = 0
): Promise<void> {
  // For now, this is tracked implicitly via keyword_metrics table
  // (created_at, gads_status, moz_status, dataforseo_status)
  // Future: Could create a separate api_usage_log table for detailed tracking

  console.log(`[QuotaTracker] ${provider}: ${keywordCount} keywords, success: ${success}, cost: $${cost.toFixed(3)}`);
}

/**
 * Get quota usage summary for display
 */
export async function getQuotaSummary(): Promise<{
  googleAds: { used: number; limit: number; percentage: number };
  moz: { used: number; cost: number };
  dataForSeo: { used: number; cost: number; balance: number };
  totalCost: number;
  warnings: string[];
}> {
  const quotaStatus = await getQuotaStatus();

  const googleAdsPercentage = (quotaStatus.googleAds.used / quotaStatus.googleAds.limit) * 100;
  const mozCost = quotaStatus.moz.used * MOZ_COST_PER_KEYWORD;
  const dataForSeoCost = quotaStatus.dataForSeo.used * DATAFORSEO_COST_PER_KEYWORD;

  const warnings: string[] = [];

  // Generate warnings
  if (googleAdsPercentage > 90) {
    warnings.push('Google Ads quota >90% used');
  }
  if (quotaStatus.dataForSeo.limit < 100) {
    warnings.push('DataForSEO balance low (<100 keywords remaining)');
  }
  if (quotaStatus.totalEstimatedCost > 100) {
    warnings.push(`High monthly cost: $${quotaStatus.totalEstimatedCost.toFixed(2)}`);
  }

  return {
    googleAds: {
      used: quotaStatus.googleAds.used,
      limit: quotaStatus.googleAds.limit,
      percentage: googleAdsPercentage,
    },
    moz: {
      used: quotaStatus.moz.used,
      cost: mozCost,
    },
    dataForSeo: {
      used: quotaStatus.dataForSeo.used,
      cost: dataForSeoCost,
      balance: quotaStatus.dataForSeo.limit * DATAFORSEO_COST_PER_KEYWORD,
    },
    totalCost: quotaStatus.totalEstimatedCost,
    warnings,
  };
}
