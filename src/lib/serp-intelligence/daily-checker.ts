/**
 * SERP Intelligence Daily Position Checker
 *
 * Automatically checks SERP positions for all active tracked keywords
 * Runs once per day (scheduled via cron or Vercel Cron)
 *
 * Process:
 * 1. Fetch all active tracked keywords
 * 2. Group by user/customer to manage rate limits
 * 3. Check positions via DataForSEO API
 * 4. Store snapshots in database
 * 5. Generate PPC opportunities
 *
 * Cost Management:
 * - ~$0.01 per keyword check
 * - 100 keywords/day = ~$1/day = $30/month
 * - Rate limit: 1 req/second to DataForSEO
 */

import { pool } from '@/lib/database/serp-intelligence';
import { batchCheckPositions, mapGoogleAdsLocationToDataForSEO } from '@/lib/dataforseo';
import { storeSerpSnapshot } from '@/lib/database/serp-intelligence';
import { autoGenerateOpportunitiesAfterCheck } from './opportunity-generator';

interface TrackedKeyword {
  id: string;
  user_id: string;
  customer_id: string;
  keyword: string;
  target_domain: string;
  location_code: string;
  device: string;
  language: string;
}

interface CheckResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  costCents: number;
  duration: number;
}

/**
 * Main daily checker function
 * Call this from cron job or background task
 */
export async function runDailyPositionCheck(): Promise<CheckResult> {
  const startTime = Date.now();

  console.log('[SERP Daily Check] Starting daily position check...');

  // Stats
  let totalKeywords = 0;
  let successfulChecks = 0;
  let failedChecks = 0;
  let skippedChecks = 0;
  let totalCostCents = 0;

  try {
    // 1. Fetch all active tracked keywords
    const result = await pool.query<TrackedKeyword>(
      `
      SELECT
        id,
        user_id,
        customer_id,
        keyword,
        target_domain,
        location_code,
        device,
        language
      FROM tracked_keywords
      WHERE is_active = true
      ORDER BY user_id, customer_id, location_code, device, language
      `
    );

    const allKeywords = result.rows;
    totalKeywords = allKeywords.length;

    if (totalKeywords === 0) {
      console.log('[SERP Daily Check] No active keywords to check');
      return {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        costCents: 0,
        duration: Date.now() - startTime,
      };
    }

    console.log(`[SERP Daily Check] Found ${totalKeywords} active keywords`);

    // 2. Group keywords by user/customer to manage rate limits and costs per account
    const keywordsByAccount = groupKeywordsByAccount(allKeywords);

    console.log(`[SERP Daily Check] Processing ${keywordsByAccount.length} accounts`);

    // 3. Process each account's keywords
    for (const account of keywordsByAccount) {
      console.log(
        `[SERP Daily Check] Checking ${account.keywords.length} keywords for ` +
          `user ${account.userId.slice(0, 8)}... / customer ${account.customerId}`
      );

      // Group by location/device/language for efficient batching
      const settingsGroups = groupKeywordsBySettings(account.keywords);

      for (const group of settingsGroups) {
        try {
          console.log(
            `[SERP Daily Check]   - Group: ${group.keywords.length} keywords ` +
              `(location: ${group.locationCode}, device: ${group.device})`
          );

          // Batch check positions via DataForSEO
          const serpResults = await batchCheckPositions(
            group.keywords.map((k) => ({
              keyword: k.keyword,
              targetDomain: k.target_domain,
            })),
            {
              locationCode: mapGoogleAdsLocationToDataForSEO(group.locationCode),
              device: group.device as 'desktop' | 'mobile',
              languageCode: group.language,
              delayMs: 1000, // 1 second between requests
            }
          );

          // Store snapshots
          for (const kw of group.keywords) {
            const serpData = serpResults.get(kw.keyword);

            if (serpData) {
              try {
                await storeSerpSnapshot(kw.id, {
                  organicPosition: serpData.organicPosition,
                  featuredSnippet: serpData.featuredSnippet,
                  localPackPresent: serpData.localPackPresent,
                  shoppingAdsPresent: serpData.shoppingAdsPresent,
                  peopleAlsoAskPresent: serpData.peopleAlsoAskPresent,
                  relatedSearchesPresent: serpData.relatedSearchesPresent,
                  competitorAdsCount: serpData.competitorAdsCount,
                  topAdsCount: serpData.topAdsCount,
                  bottomAdsCount: serpData.bottomAdsCount,
                  topAdDomains: serpData.topAdDomains,
                  bottomAdDomains: serpData.bottomAdDomains,
                  organicCompetitors: serpData.organicCompetitors,
                  organicTop3Domains: serpData.organicTop3Domains,
                  serpFeaturesRaw: serpData.serpFeaturesRaw,
                  snapshotDate: new Date(),
                  scrapingrobotStatus: 'success',
                  apiCostCents: serpData.apiCostCents,
                });

                successfulChecks++;
                totalCostCents += serpData.apiCostCents;
              } catch (error) {
                console.error(
                  `[SERP Daily Check] Error storing snapshot for "${kw.keyword}":`,
                  error
                );
                failedChecks++;
              }
            } else {
              console.warn(
                `[SERP Daily Check] No SERP data for "${kw.keyword}" - skipping`
              );
              skippedChecks++;
            }
          }

          // Rate limiting: small delay between groups
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(
            `[SERP Daily Check] Error checking keyword group:`,
            error
          );
          failedChecks += group.keywords.length;
        }
      }

      // Generate PPC opportunities for this account
      if (successfulChecks > 0) {
        try {
          console.log(
            `[SERP Daily Check] Generating opportunities for user ${account.userId.slice(0, 8)}...`
          );
          await autoGenerateOpportunitiesAfterCheck(
            account.userId,
            account.customerId
          );
        } catch (error) {
          console.error(
            `[SERP Daily Check] Failed to generate opportunities:`,
            error
          );
          // Don't fail the whole check if opportunity generation fails
        }
      }

      // Rate limiting: delay between accounts
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 seconds
    }

    const duration = Date.now() - startTime;

    console.log(
      `[SERP Daily Check] ✓ Complete: ${successfulChecks}/${totalKeywords} successful, ` +
        `${failedChecks} failed, ${skippedChecks} skipped, ` +
        `cost: $${(totalCostCents / 100).toFixed(2)}, ` +
        `duration: ${Math.round(duration / 1000)}s`
    );

    return {
      total: totalKeywords,
      successful: successfulChecks,
      failed: failedChecks,
      skipped: skippedChecks,
      costCents: totalCostCents,
      duration,
    };
  } catch (error) {
    console.error('[SERP Daily Check] Fatal error:', error);
    throw error;
  }
}

/**
 * Group keywords by user/customer account
 */
function groupKeywordsByAccount(keywords: TrackedKeyword[]): Array<{
  userId: string;
  customerId: string;
  keywords: TrackedKeyword[];
}> {
  const groups = new Map<string, TrackedKeyword[]>();

  for (const kw of keywords) {
    const key = `${kw.user_id}_${kw.customer_id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(kw);
  }

  return Array.from(groups.entries()).map(([key, keywords]) => ({
    userId: keywords[0].user_id,
    customerId: keywords[0].customer_id,
    keywords,
  }));
}

/**
 * Group keywords by SERP settings (location/device/language)
 */
function groupKeywordsBySettings(keywords: TrackedKeyword[]): Array<{
  locationCode: string;
  device: string;
  language: string;
  keywords: TrackedKeyword[];
}> {
  const groups = new Map<string, TrackedKeyword[]>();

  for (const kw of keywords) {
    const key = `${kw.location_code}_${kw.device}_${kw.language}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(kw);
  }

  return Array.from(groups.entries()).map(([key, keywords]) => ({
    locationCode: keywords[0].location_code,
    device: keywords[0].device,
    language: keywords[0].language,
    keywords,
  }));
}

/**
 * Get recommended cron schedule
 * Run once per day during off-peak hours (3 AM UTC)
 */
export const RECOMMENDED_CRON_SCHEDULE = '0 3 * * *'; // Daily at 3 AM UTC

/**
 * Estimate monthly cost for current active keywords
 */
export async function estimateMonthlyCost(): Promise<{
  activeKeywords: number;
  estimatedMonthlyCostCents: number;
  estimatedMonthlyCostDollars: number;
}> {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM tracked_keywords WHERE is_active = true'
  );

  const activeKeywords = parseInt(result.rows[0].count);
  const costPerCheckCents = 1; // $0.01 per keyword check
  const checksPerMonth = 30; // Daily checks for 30 days

  const estimatedMonthlyCostCents = activeKeywords * costPerCheckCents * checksPerMonth;

  return {
    activeKeywords,
    estimatedMonthlyCostCents,
    estimatedMonthlyCostDollars: estimatedMonthlyCostCents / 100,
  };
}
