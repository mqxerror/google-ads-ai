/**
 * SERP Intelligence Keywords API
 *
 * Manage keywords tracked for PPC campaign intelligence:
 * - GET: List tracked keywords with latest positions
 * - POST: Add keywords to track
 * - PATCH: Update keyword settings
 * - DELETE: Remove keyword from tracking
 *
 * Use case: Monitor organic positions and competitor ads to inform PPC strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  addTrackedKeywords,
  getTrackedKeywordsWithLatestSnapshot,
  updateTrackedKeyword,
  deleteTrackedKeyword,
  getUserIdFromEmail,
} from '@/lib/database/serp-intelligence';

/**
 * GET /api/serp-intelligence/keywords
 * List all tracked keywords for the authenticated user with latest snapshot data
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user UUID from email
    const userId = await getUserIdFromEmail(session.user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get customer ID from query params
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Missing customerId parameter' },
        { status: 400 }
      );
    }

    // Fetch tracked keywords with latest snapshots
    const keywords = await getTrackedKeywordsWithLatestSnapshot(
      userId,
      customerId
    );

    // Calculate summary stats
    const stats = {
      total: keywords.length,
      withPositions: keywords.filter((k) => k.latestSnapshot?.organic_position).length,
      avgPosition: calculateAvgPosition(keywords),
      avgCompetitorAds: calculateAvgCompetitorAds(keywords),
    };

    return NextResponse.json({
      keywords,
      stats,
    });
  } catch (error) {
    console.error('[SERP Intelligence API] Error fetching keywords:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tracked keywords',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/serp-intelligence/keywords
 * Add keywords to track for SERP intelligence
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user UUID from email
    const userId = await getUserIdFromEmail(session.user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { customerId, keywords, targetDomain, locationCode, device, language, projectName } = body;

    // Validate required fields
    if (!customerId || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: customerId, keywords[]' },
        { status: 400 }
      );
    }

    if (!targetDomain) {
      return NextResponse.json(
        { error: 'Missing targetDomain - specify your website to track positions for' },
        { status: 400 }
      );
    }

    // Limit: max 100 keywords per request
    if (keywords.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 keywords per request' },
        { status: 400 }
      );
    }

    // Add keywords to tracking
    const addedKeywords = await addTrackedKeywords(
      userId,
      customerId,
      keywords.map((keyword: string) => ({
        keyword,
        targetDomain,
        locationCode,
        device,
        language,
        projectName,
      }))
    );

    console.log(
      `[SERP Intelligence] User ${userId} added ${addedKeywords.length} keywords to track`
    );

    return NextResponse.json({
      success: true,
      keywords: addedKeywords,
      message: `Added ${addedKeywords.length} keywords to SERP Intelligence tracking`,
    });
  } catch (error) {
    console.error('[SERP Intelligence API] Error adding keywords:', error);
    return NextResponse.json(
      {
        error: 'Failed to add keywords',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/serp-intelligence/keywords
 * Update keyword tracking settings
 */
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user UUID from email
    const userId = await getUserIdFromEmail(session.user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing keyword ID' },
        { status: 400 }
      );
    }

    // Update keyword
    const updatedKeyword = await updateTrackedKeyword(id, userId, updates);

    if (!updatedKeyword) {
      return NextResponse.json(
        { error: 'Keyword not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      keyword: updatedKeyword,
    });
  } catch (error) {
    console.error('[SERP Intelligence API] Error updating keyword:', error);
    return NextResponse.json(
      {
        error: 'Failed to update keyword',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/serp-intelligence/keywords
 * Remove keyword from tracking (soft delete - sets is_active = false)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user UUID from email
    const userId = await getUserIdFromEmail(session.user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get keyword ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing keyword ID parameter' },
        { status: 400 }
      );
    }

    // Delete keyword
    const deleted = await deleteTrackedKeyword(id, userId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Keyword not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Keyword removed from tracking',
    });
  } catch (error) {
    console.error('[SERP Intelligence API] Error deleting keyword:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete keyword',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateAvgPosition(keywords: any[]): number {
  const positions = keywords
    .map((k) => k.latestSnapshot?.organic_position)
    .filter((p) => p !== null && p !== undefined);

  if (positions.length === 0) return 0;

  const sum = positions.reduce((acc, p) => acc + p, 0);
  return Math.round((sum / positions.length) * 10) / 10; // Round to 1 decimal
}

function calculateAvgCompetitorAds(keywords: any[]): number {
  const adCounts = keywords
    .map((k) => k.latestSnapshot?.competitor_ads_count)
    .filter((c) => c !== null && c !== undefined);

  if (adCounts.length === 0) return 0;

  const sum = adCounts.reduce((acc, c) => acc + c, 0);
  return Math.round((sum / adCounts.length) * 10) / 10; // Round to 1 decimal
}
