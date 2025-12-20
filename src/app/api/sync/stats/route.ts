import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import { getQueueStats, isRedisConnected } from '@/lib/sync';

/**
 * GET /api/sync/stats
 *
 * Get queue statistics for monitoring
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Demo mode - return mock stats
  if (isDemoMode) {
    return NextResponse.json({
      redisConnected: false,
      queues: {
        syncQueue: { waiting: 0, active: 0, completed: 10, failed: 0 },
        backfillQueue: { waiting: 0, active: 0, completed: 5, failed: 0 },
      },
    });
  }

  try {
    const redisConnected = isRedisConnected();

    if (!redisConnected) {
      return NextResponse.json({
        redisConnected: false,
        queues: null,
        message: 'Redis not connected. Background sync unavailable.',
      });
    }

    const stats = await getQueueStats();

    return NextResponse.json({
      redisConnected: true,
      queues: stats,
    });
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return NextResponse.json(
      { error: 'Failed to get queue stats' },
      { status: 500 }
    );
  }
}
