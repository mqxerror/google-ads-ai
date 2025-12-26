/**
 * Data Sync API Endpoint
 *
 * POST /api/sync - Trigger manual data sync
 * GET /api/sync - Get sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  syncCampaignData,
  getLastSyncStatus,
  upsertUser,
  syncUserAccounts,
  getCampaignsFromDB,
  canSync,
} from '@/lib/data-sync';

// POST: Trigger manual sync
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.refreshToken || !session.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required or missing refresh token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { customerId, syncType = 'incremental' } = body;

    if (!customerId || customerId === 'demo') {
      return NextResponse.json(
        { error: 'Valid customer ID required (not demo mode)' },
        { status: 400 }
      );
    }

    // Check rate limits to avoid API abuse
    const forceSync = body.forceSync === true;
    if (!forceSync) {
      const syncCheck = await canSync(customerId, true);
      if (!syncCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: syncCheck.reason,
            nextSyncAt: syncCheck.nextSyncAt,
            lastSyncedAt: syncCheck.lastSyncedAt,
            rateLimited: true,
          },
          { status: 429 } // Too Many Requests
        );
      }
    }

    // Ensure user exists in database
    const userId = await upsertUser(
      session.user.email,
      session.user.name || undefined,
      session.refreshToken
    );

    // Sync user's Google Ads accounts first (requires refresh token)
    await syncUserAccounts(userId, session.refreshToken);

    // Get account ID from database
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const accountResult = await pool.query(
      `SELECT id FROM google_ads_accounts WHERE customer_id = $1 AND user_id = $2`,
      [customerId, userId]
    );
    await pool.end();

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Account not found or not accessible' },
        { status: 404 }
      );
    }

    // Trigger sync (Google Ads API requires refresh token)
    const result = await syncCampaignData({
      accountId: accountResult.rows[0].id,
      customerId,
      refreshToken: session.refreshToken,
      loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      syncType,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Sync completed successfully',
        jobId: result.jobId,
        stats: {
          campaignsUpdated: result.campaignsUpdated,
          metricsInserted: result.metricsInserted,
          duration: `${result.duration}ms`,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          jobId: result.jobId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Sync API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

// GET: Get sync status and cached campaigns
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const includeData = searchParams.get('includeData') === 'true';

    if (!session?.refreshToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!customerId || customerId === 'demo') {
      return NextResponse.json({
        isDemo: true,
        message: 'Demo mode - no sync status available',
        lastSyncedAt: null,
      });
    }

    // Get sync status
    const syncStatus = await getLastSyncStatus(customerId);

    const response: {
      customerId: string;
      lastSyncedAt: string | null;
      lastJobStatus: string | null;
      lastJobError: string | null;
      canSync: boolean;
      campaigns?: unknown[];
    } = {
      customerId,
      ...syncStatus,
      canSync: true,
    };

    // Optionally include cached campaign data
    if (includeData) {
      const campaigns = await getCampaignsFromDB(customerId);
      response.campaigns = campaigns;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Sync Status API] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get status',
      },
      { status: 500 }
    );
  }
}
