/**
 * Cache Inspector API
 *
 * GET /api/admin/cache - Inspect cache state for a key
 * POST /api/admin/cache - Enqueue refresh or invalidate cache
 *
 * Query params:
 * - customerId: Google Ads customer ID
 * - entityType: campaigns | ad-groups | keywords | ads | reports
 * - entityId: Optional specific entity ID
 * - parentEntityId: Optional parent entity (e.g., campaignId for ad-groups)
 * - startDate: Optional date range start
 * - endDate: Optional date range end
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  createCacheKey,
  inspectCacheKey,
  forceReleaseLock,
  getLockStatus,
  getMetrics,
  getBlockingFetchStatus,
} from '@/lib/refresh-lock';
import { enqueueRefreshJob, isQueueReady } from '@/lib/queue';

// Reuse admin auth from queue route
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const OPS_TOKEN = process.env.OPS_TOKEN;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function checkAdminAuth(
  request: NextRequest,
  email: string | null | undefined
): { authorized: boolean; reason?: string } {
  const userEmail = email?.toLowerCase();
  const providedToken = request.headers.get('x-ops-token');
  const hasValidOpsToken = OPS_TOKEN && providedToken === OPS_TOKEN;
  const isAdminEmail = userEmail && ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(userEmail);

  if (isAdminEmail || hasValidOpsToken) {
    return { authorized: true };
  }

  if (ADMIN_EMAILS.length === 0 && !IS_PRODUCTION) {
    return { authorized: true };
  }

  return { authorized: false, reason: 'Not authorized for admin access' };
}

// Entity type to Prisma model mapping
const ENTITY_TABLE_MAP: Record<string, string> = {
  campaigns: 'cachedCampaign',
  'ad-groups': 'cachedAdGroup',
  keywords: 'cachedKeyword',
  ads: 'cachedAd',
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = checkAdminAuth(request, session.user.email);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.reason }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const parentEntityId = searchParams.get('parentEntityId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // If no params, return overview
    if (!customerId || !entityType) {
      const lockStatus = getLockStatus();
      const metrics = getMetrics();
      const blockingFetches = getBlockingFetchStatus();

      return NextResponse.json({
        overview: true,
        metrics,
        activeLocks: lockStatus.locks,
        activeBackoffs: lockStatus.backoffs,
        blockingFetchThrottles: blockingFetches,
        queueReady: isQueueReady(),
      });
    }

    // Generate cache key
    const cacheKey = createCacheKey({
      customerId,
      entityType,
      entityId: entityId || undefined,
      parentEntityId: parentEntityId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    // Look up cache data in database
    let cacheData: { updatedAt: Date } | null = null;
    const tableName = ENTITY_TABLE_MAP[entityType];

    if (tableName && !entityId) {
      // Get most recent cache entry for this customer/entity type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (prisma as any)[tableName];
      if (model) {
        const whereClause: Record<string, string> = { customerId };
        if (parentEntityId) {
          if (entityType === 'ad-groups') {
            whereClause.campaignId = parentEntityId;
          } else if (entityType === 'keywords' || entityType === 'ads') {
            whereClause.adGroupId = parentEntityId;
          }
        }

        const record = await model.findFirst({
          where: whereClause,
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        });

        if (record) {
          cacheData = { updatedAt: record.updatedAt };
        }
      }
    }

    // Get last refresh job log
    const lastJobLog = await prisma.refreshJobLog.findFirst({
      where: {
        customerId,
        jobType: `refresh:${entityType}`,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        entityCount: true,
        durationMs: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    // Inspect cache state
    const inspection = inspectCacheKey(cacheKey, cacheData);

    return NextResponse.json({
      ...inspection,
      customerId,
      entityType,
      entityId,
      parentEntityId,
      dateRange: startDate && endDate ? `${startDate} - ${endDate}` : null,
      lastRefreshJob: lastJobLog,
      queueReady: isQueueReady(),
    });
  } catch (error) {
    console.error('[Cache Inspector] GET error:', error);
    return NextResponse.json({ error: 'Failed to inspect cache' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = checkAdminAuth(request, session.user.email);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.reason }, { status: 403 });
    }

    const body = await request.json();
    const { action, customerId, entityType, parentEntityId, startDate, endDate } = body;

    if (!customerId || !entityType) {
      return NextResponse.json({ error: 'customerId and entityType required' }, { status: 400 });
    }

    const cacheKey = createCacheKey({
      customerId,
      entityType,
      parentEntityId,
      startDate,
      endDate,
    });

    console.log(`[Cache Inspector] Action: ${action} by ${session.user.email} on ${cacheKey}`);

    switch (action) {
      case 'refresh': {
        if (!isQueueReady()) {
          return NextResponse.json({ error: 'Queue not available' }, { status: 503 });
        }

        // Get refresh token from account
        const account = await prisma.googleAdsAccount.findFirst({
          where: { googleAccountId: customerId },
          select: { id: true, refreshToken: true, parentManagerId: true },
        });

        if (!account?.refreshToken) {
          return NextResponse.json({ error: 'Account not found or no refresh token' }, { status: 404 });
        }

        const jobId = await enqueueRefreshJob({
          type: `refresh:${entityType}` as 'refresh:campaigns' | 'refresh:ad-groups' | 'refresh:keywords' | 'refresh:ads' | 'refresh:reports',
          refreshToken: account.refreshToken,
          accountId: account.id,
          customerId,
          parentManagerId: account.parentManagerId || undefined,
          parentEntityId,
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
        }, 'high');

        return NextResponse.json({
          success: true,
          action: 'refresh_enqueued',
          jobId,
          cacheKey,
        });
      }

      case 'invalidate': {
        // Clear lock for this key
        forceReleaseLock(cacheKey);

        // Delete cached data from DB
        const tableName = ENTITY_TABLE_MAP[entityType];
        if (tableName) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const model = (prisma as any)[tableName];
          if (model) {
            const whereClause: Record<string, string> = { customerId };
            if (parentEntityId) {
              if (entityType === 'ad-groups') {
                whereClause.campaignId = parentEntityId;
              } else if (entityType === 'keywords' || entityType === 'ads') {
                whereClause.adGroupId = parentEntityId;
              }
            }

            const deleted = await model.deleteMany({ where: whereClause });
            return NextResponse.json({
              success: true,
              action: 'invalidated',
              cacheKey,
              deletedCount: deleted.count,
            });
          }
        }

        return NextResponse.json({
          success: true,
          action: 'lock_released',
          cacheKey,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use: refresh, invalidate' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Cache Inspector] POST error:', error);
    return NextResponse.json({ error: 'Cache action failed' }, { status: 500 });
  }
}
