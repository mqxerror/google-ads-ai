/**
 * API Route: /api/keywords/serp-features
 * Fetch SERP (Search Engine Results Page) features analysis
 *
 * POST /api/keywords/serp-features
 * Request Body:
 * {
 *   keywords: string[];
 *   locationId?: string;  // Default: '2840' (US)
 *   device?: 'desktop' | 'mobile';  // Default: 'desktop'
 *   forceRefresh?: boolean;  // Default: false (use cache)
 * }
 *
 * Response:
 * {
 *   results: SerpAnalysisResult[];
 *   summary: {
 *     totalKeywords: number;
 *     cached: number;
 *     fetched: number;
 *     estimatedCost: number;
 *     avgDifficulty: number;
 *   }
 * }
 *
 * Rate Limits:
 * - Free tier: 100 requests/day
 * - Paid tier: Unlimited (pay-as-you-go)
 *
 * Cost:
 * - ~$0.005-0.0075 per keyword (DataForSEO API)
 * - Cache TTL: 30 days (minimize costs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  analyzeSerpFeatures,
  analyzeSerpFeaturesBatch,
  estimateSerpAnalysisCost,
} from '@/lib/metrics/serp-features';
import type { SerpAnalysisResult } from '@/lib/database/types';

// Maximum keywords per request to prevent abuse
const MAX_KEYWORDS_PER_REQUEST = 100;

// Rate limiting: Track requests per user
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userLimit = requestCounts.get(userId);

  // Reset daily (24 hours)
  if (!userLimit || now > userLimit.resetAt) {
    requestCounts.set(userId, {
      count: 1,
      resetAt: now + 24 * 60 * 60 * 1000,
    });
    return { allowed: true, remaining: 99 };
  }

  // Free tier: 100 requests/day
  const FREE_TIER_LIMIT = 100;

  if (userLimit.count >= FREE_TIER_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: FREE_TIER_LIMIT - userLimit.count };
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    const userId = session.user.email;

    // Parse request body
    const body = await request.json();
    const {
      keywords = [],
      locationId = '2840',
      device = 'desktop',
      forceRefresh = false,
    } = body;

    // Validation
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (keywords.length > MAX_KEYWORDS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many keywords. Maximum ${MAX_KEYWORDS_PER_REQUEST} keywords per request.`,
        },
        { status: 400 }
      );
    }

    if (!['desktop', 'mobile'].includes(device)) {
      return NextResponse.json(
        { error: 'Device must be either "desktop" or "mobile"' },
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Free tier allows 100 SERP requests per day.',
          remaining: 0,
          resetAt: requestCounts.get(userId)?.resetAt,
        },
        { status: 429 }
      );
    }

    // Check if DataForSEO is configured
    if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
      return NextResponse.json(
        {
          error: 'SERP analysis unavailable - DataForSEO API not configured',
          hint: 'Contact support to enable SERP features analysis',
        },
        { status: 503 }
      );
    }

    // Estimate cost before proceeding
    const costEstimate = estimateSerpAnalysisCost(keywords.length, forceRefresh ? 0 : 0.7);

    // Process keywords
    const startTime = Date.now();
    let results: SerpAnalysisResult[];
    let cachedCount = 0;
    let fetchedCount = 0;

    if (keywords.length === 1) {
      // Single keyword - simple path
      const result = await analyzeSerpFeatures(keywords[0], {
        locationId,
        device,
        forceRefresh,
      });
      results = [result];
      cachedCount = result.cached ? 1 : 0;
      fetchedCount = result.cached ? 0 : 1;
    } else {
      // Multiple keywords - batch processing
      const progressTracker = {
        processed: 0,
        total: keywords.length,
      };

      const resultsMap = await analyzeSerpFeaturesBatch(keywords, {
        locationId,
        device,
        batchSize: 10,
        onProgress: (processed, total) => {
          progressTracker.processed = processed;
          progressTracker.total = total;
          console.log(`SERP analysis progress: ${processed}/${total}`);
        },
      });

      results = Array.from(resultsMap.values());
      cachedCount = results.filter((r) => r.cached).length;
      fetchedCount = results.filter((r) => !r.cached).length;
    }

    const duration = Date.now() - startTime;

    // Calculate statistics
    const totalDifficulty = results.reduce((sum, r) => sum + r.difficulty.score, 0);
    const avgDifficulty = results.length > 0 ? totalDifficulty / results.length : 0;

    // Actual cost (only charged for fetched keywords)
    const actualCost = fetchedCount * 0.0075;

    // Response
    return NextResponse.json(
      {
        results: results.map((r) => ({
          keyword: r.keyword,
          features: r.features,
          difficulty: r.difficulty,
          cached: r.cached,
          checkedAt: r.checkedAt,
        })),
        summary: {
          totalKeywords: keywords.length,
          cached: cachedCount,
          fetched: fetchedCount,
          estimatedCost: Number(actualCost.toFixed(2)),
          avgDifficulty: Number(avgDifficulty.toFixed(1)),
          duration,
        },
        rateLimit: {
          remaining: rateLimit.remaining,
          resetAt: requestCounts.get(userId)?.resetAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('SERP features API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to analyze SERP features',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for cost estimation without actually fetching
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keywordCount = parseInt(searchParams.get('count') || '10');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    if (keywordCount < 1 || keywordCount > MAX_KEYWORDS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Keyword count must be between 1 and ${MAX_KEYWORDS_PER_REQUEST}` },
        { status: 400 }
      );
    }

    // Estimate cost
    const estimate = estimateSerpAnalysisCost(keywordCount, forceRefresh ? 0 : 0.7);

    return NextResponse.json({
      estimate,
      info: {
        cacheTtl: '30 days',
        costPerKeyword: '$0.005-0.0075',
        freetierLimit: '100 requests/day',
      },
    });
  } catch (error) {
    console.error('Cost estimation error:', error);

    return NextResponse.json(
      { error: 'Failed to estimate cost' },
      { status: 500 }
    );
  }
}
