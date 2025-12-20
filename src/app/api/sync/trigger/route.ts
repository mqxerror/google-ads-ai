import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { syncService } from '@/lib/services/sync-service';

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

    // Trigger sync (in production, this would queue a background job)
    // For now, we just return success - the actual sync will be implemented
    // when we set up BullMQ in Phase C

    console.log(`[Sync] Triggered for account ${googleAdsAccount.googleAccountId}`, {
      startDate,
      endDate,
      includeToday,
      forceRefresh,
    });

    return NextResponse.json({
      success: true,
      message: 'Sync queued successfully',
      syncId: `sync-${accountId}-${Date.now()}`,
      options: {
        startDate: startDate || 'auto (90 days)',
        endDate: endDate || 'auto (yesterday)',
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
