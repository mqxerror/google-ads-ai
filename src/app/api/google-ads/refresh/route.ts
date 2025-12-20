/**
 * Manual Refresh API
 *
 * POST /api/google-ads/refresh - Trigger high-priority background refresh
 *
 * Supports refreshing specific entity types with priority queue placement.
 * Use this when users click "Refresh Now" in the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { format, subDays } from 'date-fns';
import {
  enqueueCampaignRefresh,
  enqueueAdGroupRefresh,
  enqueueKeywordRefresh,
  enqueueAdRefresh,
  enqueueReportRefresh,
  initRefreshQueue,
  isQueueReady,
  getQueueStats,
} from '@/lib/queue';

interface RefreshRequest {
  accountId: string;
  entityType: 'campaigns' | 'ad-groups' | 'keywords' | 'ads' | 'reports';
  parentEntityId?: string; // campaignId for ad-groups, adGroupId for keywords/ads
  startDate?: string;
  endDate?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RefreshRequest = await request.json();
    const { accountId, entityType, parentEntityId, startDate, endDate } = body;

    if (!accountId || !entityType) {
      return NextResponse.json(
        { error: 'accountId and entityType are required' },
        { status: 400 }
      );
    }

    // Validate entity type
    const validTypes = ['campaigns', 'ad-groups', 'keywords', 'ads', 'reports'];
    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate parent entity for child types
    if (['ad-groups'].includes(entityType) && !parentEntityId) {
      return NextResponse.json(
        { error: 'parentEntityId (campaignId) required for ad-groups' },
        { status: 400 }
      );
    }

    if (['keywords', 'ads'].includes(entityType) && !parentEntityId) {
      return NextResponse.json(
        { error: 'parentEntityId (adGroupId) required for keywords/ads' },
        { status: 400 }
      );
    }

    // Get account with tokens
    const account = await prisma.googleAdsAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
      include: {
        user: {
          include: {
            authAccounts: {
              where: { provider: 'google' },
            },
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const googleAuth = account.user.authAccounts[0];
    if (!googleAuth?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found' },
        { status: 401 }
      );
    }

    // Ensure queue is ready
    if (!isQueueReady()) {
      const initialized = await initRefreshQueue();
      if (!initialized) {
        return NextResponse.json(
          { error: 'Refresh queue unavailable. Please try again later.' },
          { status: 503 }
        );
      }
    }

    // Default date range: last 30 days
    const computedEndDate = endDate || format(new Date(), 'yyyy-MM-dd');
    const computedStartDate = startDate || format(subDays(new Date(), 30), 'yyyy-MM-dd');

    const baseParams = {
      refreshToken: googleAuth.refresh_token,
      accountId: account.id,
      customerId: account.googleAccountId,
      parentManagerId: account.parentManagerId || undefined,
      startDate: computedStartDate,
      endDate: computedEndDate,
      requestId: `manual-${Date.now()}`,
    };

    let result: string | 'duplicate' | 'rate-limited' | null;

    switch (entityType) {
      case 'campaigns':
        result = await enqueueCampaignRefresh(baseParams, 'high');
        break;

      case 'ad-groups':
        result = await enqueueAdGroupRefresh(
          { ...baseParams, campaignId: parentEntityId! },
          'high'
        );
        break;

      case 'keywords':
        result = await enqueueKeywordRefresh(
          { ...baseParams, adGroupId: parentEntityId! },
          'high'
        );
        break;

      case 'ads':
        result = await enqueueAdRefresh(
          { ...baseParams, adGroupId: parentEntityId! },
          'high'
        );
        break;

      case 'reports':
        result = await enqueueReportRefresh(baseParams, 'high');
        break;

      default:
        return NextResponse.json({ error: 'Unknown entity type' }, { status: 400 });
    }

    if (result === null) {
      return NextResponse.json(
        { error: 'Failed to enqueue refresh job' },
        { status: 500 }
      );
    }

    if (result === 'duplicate') {
      return NextResponse.json({
        status: 'already_pending',
        message: 'A refresh job for this entity is already in the queue',
      });
    }

    if (result === 'rate-limited') {
      return NextResponse.json({
        status: 'rate_limited',
        message: 'Please wait a moment before requesting another refresh',
      });
    }

    // Get queue position
    const stats = await getQueueStats();

    return NextResponse.json({
      status: 'queued',
      jobId: result,
      entityType,
      parentEntityId,
      dateRange: {
        start: computedStartDate,
        end: computedEndDate,
      },
      queuePosition: stats?.waiting || 0,
      message: 'High-priority refresh job queued successfully',
    });
  } catch (error) {
    console.error('[Manual Refresh] Error:', error);
    return NextResponse.json(
      { error: 'Failed to queue refresh job' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/google-ads/refresh?accountId=xxx
 * Get last refresh times for an account
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    // Verify account ownership
    const account = await prisma.googleAdsAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
      select: {
        id: true,
        googleAccountId: true,
        lastSyncAt: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get recent job logs for this account
    const recentJobs = await prisma.refreshJobLog.findMany({
      where: {
        customerId: account.googleAccountId,
        status: 'completed',
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: {
        jobType: true,
        parentEntityId: true,
        completedAt: true,
        entityCount: true,
        durationMs: true,
      },
    });

    // Build last refresh map
    const lastRefresh: Record<string, { at: string; count: number; durationMs: number }> = {};

    for (const job of recentJobs) {
      const key = job.parentEntityId
        ? `${job.jobType}:${job.parentEntityId}`
        : job.jobType;

      if (!lastRefresh[key] && job.completedAt) {
        lastRefresh[key] = {
          at: job.completedAt.toISOString(),
          count: job.entityCount || 0,
          durationMs: job.durationMs || 0,
        };
      }
    }

    return NextResponse.json({
      accountId,
      customerId: account.googleAccountId,
      lastSyncAt: account.lastSyncAt?.toISOString() || null,
      lastRefresh,
    });
  } catch (error) {
    console.error('[Manual Refresh] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get refresh status' },
      { status: 500 }
    );
  }
}
