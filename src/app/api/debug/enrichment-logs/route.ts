/**
 * Debug API - Enrichment Logs
 *
 * Provides access to enrichment pipeline logs for debugging
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { enrichmentLogger } from '@/lib/enrichment-logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({
        error: 'Not authenticated',
        logs: [],
      }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const requestId = searchParams.get('requestId');

    // Get specific log or recent logs
    if (requestId) {
      const log = await enrichmentLogger.getLog(requestId);
      return NextResponse.json({
        success: true,
        log,
      });
    } else {
      const logs = await enrichmentLogger.getRecentLogs(limit);
      return NextResponse.json({
        success: true,
        logs,
      });
    }
  } catch (error: any) {
    console.error('[Debug API] Error fetching logs:', error);
    return NextResponse.json({
      error: error.message || 'Failed to fetch logs',
      logs: [],
    }, { status: 500 });
  }
}
