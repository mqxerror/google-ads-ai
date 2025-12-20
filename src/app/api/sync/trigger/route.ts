import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { syncService } from '@/lib/services/sync-service';
import { enqueueSyncJob, isRedisConnected } from '@/lib/sync';
import { EntityType } from '@prisma/client';
import { format, subDays } from 'date-fns';

/**
 * POST /api/sync/trigger
 *
 * Trigger a manual sync for an account
 *
 * Body:
 * {
 *   accountId: string;
 *   startDate?: string;  // YYYY-MM-DD, defaults to 90 days ago
 *   endDate?: string;    // YYYY-MM-DD, defaults to yesterday
 *   includeToday?: boolean;
 *   forceRefresh?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Demo mode - return mock response
  if (isDemoMode) {
    return NextResponse.json({
      success: true,
      message: 'Sync triggered (demo mode)',
      syncId: 'demo-sync-' + Date.now(),
    });
  }

  try {
    const body = await request.json();
    const { accountId, startDate, endDate, includeToday, forceRefresh } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Verify user owns this account and get tokens
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
            isManager: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const googleOAuthAccount = user.authAccounts[0];
    if (!googleOAuthAccount?.refresh_token) {
      return NextResponse.json(
        { error: 'No Google OAuth token found. Please re-authenticate.' },
        { status: 400 }
      );
    }

    const googleAdsAccount = user.googleAdsAccounts[0];
    if (!googleAdsAccount) {
      return NextResponse.json({ error: 'Google Ads account not found' }, { status: 404 });
    }

    if (googleAdsAccount.isManager) {
      return NextResponse.json(
        { error: 'Cannot sync a manager account. Please select a client account.' },
        { status: 400 }
      );
    }

    // Check if already syncing
    const currentStatus = await syncService.getSyncStatus(googleAdsAccount.googleAccountId);
    if (
      currentStatus.campaign === 'IN_PROGRESS' ||
      currentStatus.adGroup === 'IN_PROGRESS' ||
      currentStatus.keyword === 'IN_PROGRESS'
    ) {
      return NextResponse.json({
        success: false,
        message: 'Sync already in progress',
        status: currentStatus,
      });
    }

    // Calculate date range
    const effectiveEndDate = endDate
      ? endDate
      : includeToday
        ? format(new Date(), 'yyyy-MM-dd')
        : format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const effectiveStartDate = startDate
      ? startDate
      : format(subDays(new Date(), 90), 'yyyy-MM-dd');

    console.log(`[Sync] Triggered for account ${googleAdsAccount.googleAccountId}`, {
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      includeToday,
      forceRefresh,
    });

    // Try to queue background jobs if Redis is available
    const redisAvailable = isRedisConnected();
    const queuedJobs: string[] = [];

    if (redisAvailable) {
      // Queue sync jobs for each entity type
      const entityTypes = [EntityType.CAMPAIGN, EntityType.AD_GROUP, EntityType.KEYWORD];

      for (const entityType of entityTypes) {
        const job = await enqueueSyncJob({
          accountId: googleAdsAccount.id,
          customerId: googleAdsAccount.googleAccountId,
          refreshToken: googleOAuthAccount.refresh_token!,
          entityType,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          priority: 'high',
        });

        if (job) {
          queuedJobs.push(job.id || `${entityType}-job`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: redisAvailable
        ? `Sync queued successfully (${queuedJobs.length} jobs)`
        : 'Sync request received (Redis unavailable, will process on next API call)',
      syncId: `sync-${accountId}-${Date.now()}`,
      queuedJobs,
      redisAvailable,
      options: {
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        includeToday: includeToday || false,
        forceRefresh: forceRefresh || false,
      },
    });
  } catch (error) {
    console.error('Failed to trigger sync:', error);
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}
