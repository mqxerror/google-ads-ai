/**
 * API Route: /api/keywords/account-sync
 * Sync keywords from Google Ads account to keyword_account_data table
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchAllCampaignKeywords,
  fetchKeywordPerformance,
} from '@/lib/google-ads';
import {
  upsertKeywordAccountData,
  upsertKeywordPerformance,
} from '@/lib/database/account-data';
import type { SyncAccountResult } from '@/lib/database/types';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized - no access token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      customerId,
      campaignIds,
      includePerformance = false,
      performanceDays = 30,
    } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    const userId = session.user?.email || 'anonymous';
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

    console.log('[Account Sync] Starting sync for customer:', customerId);
    const startTime = Date.now();

    // Step 1: Fetch all campaign keywords
    console.log('[Account Sync] Fetching campaign keywords...');
    const keywords = await fetchAllCampaignKeywords(
      session.accessToken,
      customerId,
      {
        campaignIds,
        includeRemoved: false,
        loginCustomerId,
      }
    );

    console.log(`[Account Sync] Found ${keywords.length} keywords`);

    // Step 2: Upsert keywords to database
    console.log('[Account Sync] Syncing to database...');
    const syncResult = await upsertKeywordAccountData(
      userId,
      customerId,
      keywords
    );

    console.log(
      `[Account Sync] Inserted ${syncResult.inserted}, Updated ${syncResult.updated}`
    );

    // Get unique campaigns
    const uniqueCampaigns = new Set(keywords.map((k) => k.campaignId));

    const result: SyncAccountResult = {
      synced: {
        keywords: keywords.length,
        campaigns: uniqueCampaigns.size,
        newKeywords: syncResult.inserted,
        updatedKeywords: syncResult.updated,
      },
      duration: Date.now() - startTime,
    };

    // Step 3: Optionally fetch performance data
    if (includePerformance && keywords.length > 0) {
      console.log('[Account Sync] Fetching performance data...');

      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(
        Date.now() - performanceDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0];

      try {
        // Fetch performance in batches of 1000 keywords
        const batchSize = 1000;
        let totalPerformanceRecords = 0;
        const uniqueKeywords = Array.from(
          new Set(keywords.map((k) => k.keyword))
        );

        for (let i = 0; i < uniqueKeywords.length; i += batchSize) {
          const batch = uniqueKeywords.slice(i, i + batchSize);

          const performanceData = await fetchKeywordPerformance(
            session.accessToken,
            customerId,
            {
              keywords: batch,
              startDate,
              endDate,
              campaignIds,
              loginCustomerId,
            }
          );

          console.log(
            `[Account Sync] Batch ${Math.floor(i / batchSize) + 1}: ${performanceData.length} performance records`
          );

          // Store performance data
          if (performanceData.length > 0) {
            // Map to database format
            const performanceRecords = performanceData.map((perf) => {
              // Find campaign ID for this keyword
              const keywordData = keywords.find(
                (k) => k.keyword === perf.keyword
              );

              return {
                keyword: perf.keyword,
                campaignId: keywordData?.campaignId || '',
                date: perf.date,
                impressions: perf.impressions,
                clicks: perf.clicks,
                conversions: perf.conversions,
                costMicros: Math.round(perf.cost * 1_000_000),
                ctr: perf.ctr,
                qualityScore: perf.qualityScore,
              };
            });

            const perfResult = await upsertKeywordPerformance(
              userId,
              customerId,
              performanceRecords
            );

            totalPerformanceRecords +=
              perfResult.inserted + perfResult.updated;
          }
        }

        result.performance = {
          keywordsWithData: uniqueKeywords.length,
          daysImported: performanceDays,
        };

        console.log(
          `[Account Sync] Stored ${totalPerformanceRecords} performance records`
        );
      } catch (perfError) {
        console.error(
          '[Account Sync] Error fetching performance data:',
          perfError
        );
        // Don't fail the whole sync if performance fetch fails
      }
    }

    result.duration = Date.now() - startTime;

    console.log(
      `[Account Sync] Completed in ${result.duration}ms:`,
      result
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Account Sync] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync account',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    const {
      getLastSyncTime,
      getAccountKeywordCount,
      getCampaignKeywordCounts,
    } = await import('@/lib/database/account-data');

    const userId = session.user.email;

    const [lastSyncTime, keywordCount, campaignCounts] = await Promise.all([
      getLastSyncTime(userId, customerId),
      getAccountKeywordCount(userId, customerId),
      getCampaignKeywordCounts(userId, customerId),
    ]);

    return NextResponse.json({
      lastSyncTime,
      keywordCount,
      campaignCounts,
      needsSync: !lastSyncTime || Date.now() - lastSyncTime.getTime() > 24 * 60 * 60 * 1000, // Older than 1 day
    });
  } catch (error: any) {
    console.error('[Account Sync] Error checking status:', error);
    return NextResponse.json(
      { error: 'Failed to check sync status', details: error.message },
      { status: 500 }
    );
  }
}
