/**
 * Vercel Cron API Route: Daily SERP Position Checks
 *
 * This route is called automatically by Vercel Cron once per day
 * to check SERP positions for all active tracked keywords.
 *
 * Vercel Cron Configuration (add to vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/serp-daily-check",
 *     "schedule": "0 3 * * *"
 *   }]
 * }
 *
 * Schedule: "0 3 * * *" = Daily at 3 AM UTC (off-peak hours)
 *
 * Security:
 * - Protected by CRON_SECRET environment variable
 * - Only Vercel Cron can call this endpoint
 *
 * Monitoring:
 * - Logs are visible in Vercel Dashboard
 * - Returns stats for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyPositionCheck } from '@/lib/serp-intelligence/daily-checker';

export const maxDuration = 300; // 5 minutes max execution time
export const dynamic = 'force-dynamic'; // Always run dynamically, never cache

/**
 * GET /api/cron/serp-daily-check
 * Triggered by Vercel Cron
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[SERP Cron] Unauthorized cron request attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[SERP Cron] Starting daily SERP position check...');
    const startTime = Date.now();

    // Run the daily position check
    const result = await runDailyPositionCheck();

    const duration = Date.now() - startTime;

    console.log(
      `[SERP Cron] ✓ Complete in ${Math.round(duration / 1000)}s: ` +
        `${result.successful}/${result.total} successful, ` +
        `${result.failed} failed, ` +
        `cost: $${(result.costCents / 100).toFixed(2)}`
    );

    // Return success response with stats
    return NextResponse.json({
      success: true,
      message: 'Daily SERP position check completed',
      stats: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        costCents: result.costCents,
        costDollars: result.costCents / 100,
        durationMs: result.duration,
        durationSeconds: Math.round(result.duration / 1000),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SERP Cron] Fatal error:', error);

    // Return error response but with 200 status
    // (so Vercel doesn't retry and waste API calls)
    return NextResponse.json({
      success: false,
      error: 'Daily SERP check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/cron/serp-daily-check
 * Manual trigger endpoint (for testing)
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized - requires CRON_SECRET' },
        { status: 401 }
      );
    }

    console.log('[SERP Cron] Manual trigger requested...');

    const result = await runDailyPositionCheck();

    return NextResponse.json({
      success: true,
      message: 'Manual SERP position check completed',
      stats: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        costCents: result.costCents,
        costDollars: result.costCents / 100,
        durationMs: result.duration,
        durationSeconds: Math.round(result.duration / 1000),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SERP Cron] Manual trigger error:', error);

    return NextResponse.json(
      {
        error: 'Manual trigger failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
