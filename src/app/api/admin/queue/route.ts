/**
 * Admin Queue Monitoring API
 *
 * GET /api/admin/queue - Get queue statistics and recent jobs
 * POST /api/admin/queue - Queue control (pause/resume/drain)
 *
 * SECURITY:
 * - Requires authenticated session
 * - Requires admin email (ADMIN_EMAILS env var) OR OPS_TOKEN header
 * - POST actions (pause/resume/drain) require both in production
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getQueueStats,
  getRecentJobs,
  getLastRefreshTimes,
  pauseQueue,
  resumeQueue,
  drainQueue,
  isQueueReady,
  initRefreshQueue,
} from '@/lib/queue';
import prisma from '@/lib/prisma';

// ============================================
// Admin Authorization
// ============================================

// Comma-separated list of admin emails (set in env)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Secret token for ops access (set in env, required for POST in production)
const OPS_TOKEN = process.env.OPS_TOKEN;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Check if the request has admin authorization
 * Returns { authorized, email, reason }
 */
function checkAdminAuth(
  request: NextRequest,
  email: string | null | undefined,
  requireOpsToken: boolean = false
): { authorized: boolean; reason?: string } {
  const userEmail = email?.toLowerCase();

  // Check OPS_TOKEN header
  const providedToken = request.headers.get('x-ops-token');
  const hasValidOpsToken = OPS_TOKEN && providedToken === OPS_TOKEN;

  // Check admin email
  const isAdminEmail = userEmail && ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(userEmail);

  // In production, require both for destructive actions
  if (requireOpsToken && IS_PRODUCTION) {
    if (!hasValidOpsToken) {
      return { authorized: false, reason: 'OPS_TOKEN required for this action in production' };
    }
    if (!isAdminEmail && ADMIN_EMAILS.length > 0) {
      return { authorized: false, reason: 'Admin email required' };
    }
    return { authorized: true };
  }

  // For read-only, accept either admin email OR valid ops token
  if (isAdminEmail || hasValidOpsToken) {
    return { authorized: true };
  }

  // If no ADMIN_EMAILS configured, allow any authenticated user (development)
  if (ADMIN_EMAILS.length === 0 && !IS_PRODUCTION) {
    console.warn('[Admin] No ADMIN_EMAILS configured - allowing any authenticated user');
    return { authorized: true };
  }

  return { authorized: false, reason: 'Not authorized for admin access' };
}

// ============================================
// API Handlers
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin authorization
    const authCheck = checkAdminAuth(request, session.user.email, false);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const includeJobs = searchParams.get('includeJobs') !== 'false';
    const includeDbLogs = searchParams.get('includeDbLogs') === 'true';
    const jobLimit = parseInt(searchParams.get('limit') || '20', 10);

    // Ensure queue is initialized
    if (!isQueueReady()) {
      await initRefreshQueue();
    }

    // Get queue stats
    const stats = await getQueueStats();

    // Get recent jobs from BullMQ
    const recentJobs = includeJobs ? await getRecentJobs(jobLimit) : [];

    // Get last refresh times if customerId provided
    const lastRefreshTimes = customerId
      ? await getLastRefreshTimes(customerId)
      : {};

    // Get recent job logs from database if requested
    let dbJobLogs: Array<{
      id: string;
      jobType: string;
      customerId: string;
      status: string;
      entityCount: number | null;
      durationMs: number | null;
      errorMessage: string | null;
      createdAt: Date;
    }> = [];

    if (includeDbLogs) {
      dbJobLogs = await prisma.refreshJobLog.findMany({
        where: customerId ? { customerId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: jobLimit,
        select: {
          id: true,
          jobType: true,
          customerId: true,
          status: true,
          entityCount: true,
          durationMs: true,
          errorMessage: true,
          createdAt: true,
        },
      });
    }

    // Calculate success rate from DB logs
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [successCount, totalCount] = await Promise.all([
      prisma.refreshJobLog.count({
        where: {
          status: 'completed',
          createdAt: { gte: last24h },
          ...(customerId ? { customerId } : {}),
        },
      }),
      prisma.refreshJobLog.count({
        where: {
          createdAt: { gte: last24h },
          ...(customerId ? { customerId } : {}),
        },
      }),
    ]);

    const successRate = totalCount > 0
      ? Math.round((successCount / totalCount) * 100)
      : null;

    return NextResponse.json({
      queueReady: isQueueReady(),
      stats,
      successRate24h: successRate,
      jobsLast24h: totalCount,
      recentJobs,
      lastRefreshTimes,
      dbJobLogs: includeDbLogs ? dbJobLogs : undefined,
    });
  } catch (error) {
    console.error('[Admin Queue] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue stats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin authorization with OPS_TOKEN required for destructive actions
    const authCheck = checkAdminAuth(request, session.user.email, true);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!isQueueReady()) {
      return NextResponse.json(
        { error: 'Queue not available' },
        { status: 503 }
      );
    }

    // Log admin action for audit trail
    console.log(`[Admin Queue] Action: ${action} by ${session.user.email}`);

    switch (action) {
      case 'pause':
        await pauseQueue();
        return NextResponse.json({ success: true, action: 'paused' });

      case 'resume':
        await resumeQueue();
        return NextResponse.json({ success: true, action: 'resumed' });

      case 'drain':
        await drainQueue();
        return NextResponse.json({ success: true, action: 'drained' });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: pause, resume, drain' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Admin Queue] POST error:', error);
    return NextResponse.json(
      { error: 'Queue control failed' },
      { status: 500 }
    );
  }
}
