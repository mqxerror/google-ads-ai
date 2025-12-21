/**
 * Pre-warm Progress API
 *
 * GET /api/admin/prewarm?customerId=xxx - Get pre-warm progress
 * POST /api/admin/prewarm - Trigger manual pre-warm
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getProgress,
  getAllProgress,
  getPrewarmStatus,
  smartPrewarmAdGroups,
  PREWARM_CONFIG,
  Campaign,
} from '@/lib/cache/smart-prewarm';
import { isEnabled } from '@/lib/feature-flags';
import prisma from '@/lib/prisma';

// GET: Fetch pre-warm progress
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    // Get all active pre-warm progress
    const allProgress = getAllProgress();

    // If customerId specified, get detailed status
    let customerProgress = null;
    let cacheStatus: Record<string, string> | null = null;

    if (customerId) {
      customerProgress = getProgress(customerId);

      // If we have date range, check cache status for campaigns
      if (startDate && endDate) {
        // Get campaign IDs to check
        const campaigns = await prisma.entityHierarchy.findMany({
          where: {
            customerId,
            entityType: 'CAMPAIGN',
          },
          select: { entityId: true },
          take: 20,
        });

        if (campaigns.length > 0) {
          const statusMap = await getPrewarmStatus(
            customerId,
            campaigns.map(c => c.entityId),
            startDate,
            endDate
          );
          cacheStatus = Object.fromEntries(statusMap);
        }
      }
    }

    return NextResponse.json({
      enabled: isEnabled('SMART_PREWARM'),
      config: {
        maxCampaignsPerBatch: PREWARM_CONFIG.MAX_CAMPAIGNS_PER_BATCH,
        maxJobsPerMinute: PREWARM_CONFIG.MAX_JOBS_PER_MINUTE,
        cacheFreshThresholdMinutes: PREWARM_CONFIG.CACHE_FRESH_THRESHOLD_MS / 60000,
      },
      activePrewarms: allProgress.length,
      allProgress: allProgress.map(p => ({
        customerId: p.customerId,
        startedAt: p.startedAt,
        totalCampaigns: p.totalCampaigns,
        queued: p.queued.length,
        running: p.running.length,
        completed: p.completed.length,
        failed: p.failed.length,
        estimatedRemainingSeconds: Math.ceil(p.estimatedRemainingMs / 1000),
        lastUpdated: p.lastUpdated,
      })),
      customerProgress: customerProgress ? {
        customerId: customerProgress.customerId,
        startedAt: customerProgress.startedAt,
        totalCampaigns: customerProgress.totalCampaigns,
        queued: customerProgress.queued,
        running: customerProgress.running,
        completed: customerProgress.completed,
        failed: customerProgress.failed,
        estimatedRemainingSeconds: Math.ceil(customerProgress.estimatedRemainingMs / 1000),
        lastUpdated: customerProgress.lastUpdated,
        percentComplete: customerProgress.totalCampaigns > 0
          ? Math.round((customerProgress.completed.length / customerProgress.totalCampaigns) * 100)
          : 0,
      } : null,
      cacheStatus,
    });
  } catch (error) {
    console.error('[PrewarmAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get pre-warm progress', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: Trigger manual pre-warm
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isEnabled('SMART_PREWARM')) {
    return NextResponse.json(
      { error: 'Smart pre-warm is disabled. Set FF_SMART_PREWARM=true to enable.' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { accountId, customerId, campaignIds, startDate, endDate } = body;

    if (!accountId || !customerId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'accountId, customerId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Get user's refresh token
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        authAccounts: {
          where: { provider: 'google' },
          select: { refresh_token: true },
        },
        googleAdsAccounts: {
          where: { id: accountId },
          select: {
            id: true,
            googleAccountId: true,
            parentManagerId: true,
          },
        },
      },
    });

    if (!user?.authAccounts[0]?.refresh_token) {
      return NextResponse.json(
        { error: 'No OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const account = user.googleAdsAccounts[0];
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Build campaign list for pre-warm
    let campaigns: Campaign[] = [];

    if (campaignIds && campaignIds.length > 0) {
      // Use specified campaigns
      const entities = await prisma.entityHierarchy.findMany({
        where: {
          customerId,
          entityType: 'CAMPAIGN',
          entityId: { in: campaignIds },
        },
        select: { entityId: true, entityName: true, status: true },
      });

      campaigns = entities.map(e => ({
        id: e.entityId,
        name: e.entityName,
        spend: 100, // Placeholder - all manual triggers are eligible
        status: e.status || 'ENABLED',
      }));
    } else {
      // Get top campaigns by recent metrics
      const recentMetrics = await prisma.metricsFact.groupBy({
        by: ['entityId'],
        where: {
          customerId,
          entityType: 'CAMPAIGN',
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        _sum: { costMicros: true },
        orderBy: { _sum: { costMicros: 'desc' } },
        take: 10,
      });

      const entityIds = recentMetrics.map(m => m.entityId);
      const entities = await prisma.entityHierarchy.findMany({
        where: {
          customerId,
          entityType: 'CAMPAIGN',
          entityId: { in: entityIds },
        },
        select: { entityId: true, entityName: true, status: true },
      });

      const entityMap = new Map(entities.map(e => [e.entityId, e]));

      campaigns = recentMetrics.map(m => ({
        id: m.entityId,
        name: entityMap.get(m.entityId)?.entityName || `Campaign ${m.entityId}`,
        spend: Number(m._sum.costMicros || 0) / 1_000_000,
        status: entityMap.get(m.entityId)?.status || 'ENABLED',
      }));
    }

    if (campaigns.length === 0) {
      return NextResponse.json(
        { error: 'No campaigns found to pre-warm' },
        { status: 400 }
      );
    }

    // Trigger pre-warm
    const result = await smartPrewarmAdGroups(campaigns, {
      refreshToken: user.authAccounts[0].refresh_token,
      accountId: account.id,
      customerId,
      parentManagerId: account.parentManagerId || undefined,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: result.triggered,
      ...result,
    });
  } catch (error) {
    console.error('[PrewarmAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger pre-warm', details: String(error) },
      { status: 500 }
    );
  }
}
