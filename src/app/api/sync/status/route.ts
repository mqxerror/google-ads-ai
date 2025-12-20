import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { syncService } from '@/lib/services/sync-service';

/**
 * GET /api/sync/status?accountId=xxx
 *
 * Get sync status for an account
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Demo mode - return mock sync status
  if (isDemoMode) {
    return NextResponse.json({
      status: {
        campaign: 'COMPLETED',
        adGroup: 'COMPLETED',
        keyword: 'COMPLETED',
        lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        nextSync: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      },
      isBackfilling: false,
      progress: 100,
      daysRemaining: 0,
    });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  try {
    // Verify user owns this account
    const account = await prisma.googleAdsAccount.findFirst({
      where: {
        id: accountId,
        user: { email: session.user.email },
      },
      select: {
        id: true,
        googleAccountId: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get sync status
    const syncStatus = await syncService.getSyncStatus(account.googleAccountId);
    const backfillProgress = await syncService.getBackfillProgress(account.googleAccountId);
    const needsSync = await syncService.needsSync(account.googleAccountId);

    return NextResponse.json({
      status: {
        campaign: syncStatus.campaign,
        adGroup: syncStatus.adGroup,
        keyword: syncStatus.keyword,
        lastSync: syncStatus.lastSync?.toISOString() || null,
        nextSync: syncStatus.nextSync?.toISOString() || null,
      },
      isBackfilling: backfillProgress.isBackfilling,
      progress: backfillProgress.progress,
      daysRemaining: backfillProgress.daysRemaining,
      needsSync,
    });
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
