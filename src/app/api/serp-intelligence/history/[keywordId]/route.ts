/**
 * SERP Intelligence Position History API
 *
 * Get historical position snapshots for a tracked keyword
 * GET: /api/serp-intelligence/history/[keywordId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/database/serp-intelligence';

export async function GET(
  request: NextRequest,
  { params }: { params: { keywordId: string } }
) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keywordId } = params;

    // Fetch position snapshots for this keyword (last 30 days)
    const result = await pool.query(
      `
      SELECT
        snapshot_date,
        organic_position,
        position_change,
        competitor_ads_count,
        featured_snippet,
        shopping_ads_present,
        local_pack_present,
        fetched_at
      FROM serp_snapshots
      WHERE tracked_keyword_id = $1
        AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY snapshot_date ASC
      `,
      [keywordId]
    );

    return NextResponse.json({
      keywordId,
      snapshots: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[SERP Intelligence History API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch position history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
