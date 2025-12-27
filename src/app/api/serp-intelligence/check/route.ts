/**
 * SERP Intelligence Position Check API
 *
 * Trigger manual SERP position checks for tracked keywords
 * - POST: Check positions now (rate limited to prevent abuse)
 *
 * Use case: User clicks "Check Now" button to get latest SERP data
 * Rate limit: 1 manual check per 6 hours to manage API costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getTrackedKeywordsByIds,
  storeSerpSnapshot,
  getLastManualCheckTime,
  recordManualCheck,
  getUserIdFromEmail,
} from '@/lib/database/serp-intelligence';
import { batchCheckPositions, mapGoogleAdsLocationToDataForSEO } from '@/lib/dataforseo';
import { autoGenerateOpportunitiesAfterCheck } from '@/lib/serp-intelligence/opportunity-generator';

// Rate limit: 6 hours between manual checks
const MANUAL_CHECK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * POST /api/serp-intelligence/check
 * Trigger immediate SERP position checks for selected keywords
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user UUID from email
    const userId = await getUserIdFromEmail(session.user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { keywordIds, customerId } = body;

    // Validate required fields
    if (!keywordIds || !Array.isArray(keywordIds) || keywordIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: keywordIds[]' },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Missing required field: customerId' },
        { status: 400 }
      );
    }

    // Limit: max 50 keywords per manual check (cost control)
    if (keywordIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 keywords per manual check' },
        { status: 400 }
      );
    }

    // Rate limit check: Prevent abuse of manual checks
    const lastCheckTime = await getLastManualCheckTime(userId, customerId);
    if (lastCheckTime) {
      const timeSinceLastCheck = Date.now() - lastCheckTime.getTime();
      if (timeSinceLastCheck < MANUAL_CHECK_COOLDOWN_MS) {
        const remainingMs = MANUAL_CHECK_COOLDOWN_MS - timeSinceLastCheck;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));

        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: `Please wait ${remainingHours} hours before next manual check`,
            remainingMs,
          },
          { status: 429 }
        );
      }
    }

    // Fetch tracked keywords
    const keywords = await getTrackedKeywordsByIds(keywordIds, userId);

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: 'No tracked keywords found for given IDs' },
        { status: 404 }
      );
    }

    console.log(
      `[SERP Intelligence] User ${userId} checking ${keywords.length} keywords...`
    );

    // Group keywords by location/device/language for efficient batching
    const keywordGroups = groupKeywordsBySettings(keywords);

    const allResults: Array<{ keyword: string; success: boolean; error?: string }> = [];
    let totalChecked = 0;
    let totalErrors = 0;

    // Process each group separately (different SERP settings)
    for (const group of keywordGroups) {
      try {
        console.log(
          `[SERP Intelligence] Checking ${group.keywords.length} keywords ` +
            `(${group.locationCode}, ${group.device})...`
        );

        // Batch check positions via DataForSEO
        const results = await batchCheckPositions(
          group.keywords.map((k) => ({
            keyword: k.keyword,
            targetDomain: k.target_domain,
          })),
          {
            locationCode: mapGoogleAdsLocationToDataForSEO(group.locationCode),
            device: group.device as 'desktop' | 'mobile',
            languageCode: group.language,
            delayMs: 1000, // 1 second between requests (DataForSEO is faster)
          }
        );

        // Store snapshots in database
        for (const kw of group.keywords) {
          const serpData = results.get(kw.keyword);

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
                snapshotDate: new Date(), // Current date for snapshot
                scrapingrobotStatus: 'success',
                apiCostCents: serpData.apiCostCents,
              });

              totalChecked++;
              allResults.push({ keyword: kw.keyword, success: true });
            } catch (error) {
              console.error(
                `[SERP Intelligence] Error storing snapshot for "${kw.keyword}":`,
                error
              );
              totalErrors++;
              allResults.push({
                keyword: kw.keyword,
                success: false,
                error: error instanceof Error ? error.message : 'Storage error',
              });
            }
          } else {
            // No SERP data returned (likely API error)
            totalErrors++;
            allResults.push({
              keyword: kw.keyword,
              success: false,
              error: 'No SERP data returned',
            });
          }
        }
      } catch (error) {
        console.error(`[SERP Intelligence] Error checking keyword group:`, error);
        totalErrors += group.keywords.length;

        for (const kw of group.keywords) {
          allResults.push({
            keyword: kw.keyword,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // Record this manual check timestamp
    await recordManualCheck(userId, customerId);

    console.log(
      `[SERP Intelligence] Manual check complete: ${totalChecked} successful, ${totalErrors} errors`
    );

    // Auto-generate PPC opportunities based on new SERP data
    if (totalChecked > 0) {
      console.log('[SERP Intelligence] Generating PPC opportunities...');
      autoGenerateOpportunitiesAfterCheck(userId, customerId).catch((err) => {
        console.error('[SERP Intelligence] Failed to generate opportunities:', err);
        // Don't fail the request if opportunity generation fails
      });
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${totalChecked} keywords successfully`,
      stats: {
        total: keywords.length,
        successful: totalChecked,
        errors: totalErrors,
      },
      results: allResults,
      nextCheckAvailableAt: new Date(Date.now() + MANUAL_CHECK_COOLDOWN_MS).toISOString(),
    });
  } catch (error) {
    console.error('[SERP Intelligence API] Error checking positions:', error);
    return NextResponse.json(
      {
        error: 'Failed to check SERP positions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface KeywordGroup {
  locationCode: string;
  device: string;
  language: string;
  keywords: Array<{
    id: string;
    keyword: string;
    target_domain: string;
  }>;
}

/**
 * Group keywords by location/device/language for efficient batching
 * Keywords with same settings can be checked together
 */
function groupKeywordsBySettings(keywords: any[]): KeywordGroup[] {
  const groups = new Map<string, KeywordGroup>();

  for (const kw of keywords) {
    const groupKey = `${kw.location_code}_${kw.device}_${kw.language}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        locationCode: kw.location_code,
        device: kw.device,
        language: kw.language,
        keywords: [],
      });
    }

    groups.get(groupKey)!.keywords.push({
      id: kw.id,
      keyword: kw.keyword,
      target_domain: kw.target_domain,
    });
  }

  return Array.from(groups.values());
}

// Removed: mapLocationCodeToCountry (no longer needed with DataForSEO)
// DataForSEO uses the same location codes as Google Ads
