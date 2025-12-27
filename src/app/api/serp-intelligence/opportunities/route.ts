/**
 * SERP Intelligence Opportunities API
 *
 * Manage AI-generated PPC recommendations based on SERP data:
 * - GET: List active opportunities
 * - POST: Create new opportunity (internal use)
 *
 * Use case: Display actionable PPC recommendations in dashboard sidebar
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getSerpOpportunities,
  createSerpOpportunity,
  expireOldOpportunities,
  getUserIdFromEmail,
} from '@/lib/database/serp-intelligence';

/**
 * GET /api/serp-intelligence/opportunities
 * List PPC opportunities for authenticated user
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Expire old opportunities before fetching
    await expireOldOpportunities();

    // Fetch opportunities
    const opportunities = await getSerpOpportunities(userId, {
      status,
      priority: priority || undefined,
      limit,
    });

    // Group by priority for dashboard UI
    const grouped = {
      high: opportunities.filter((o) => o.priority === 'high'),
      medium: opportunities.filter((o) => o.priority === 'medium'),
      low: opportunities.filter((o) => o.priority === 'low'),
    };

    return NextResponse.json({
      opportunities,
      grouped,
      stats: {
        total: opportunities.length,
        high: grouped.high.length,
        medium: grouped.medium.length,
        low: grouped.low.length,
      },
    });
  } catch (error) {
    console.error('[SERP Intelligence API] Error fetching opportunities:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch opportunities',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/serp-intelligence/opportunities
 * Create new PPC opportunity (internal use - called by position check logic)
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
    const {
      trackedKeywordId,
      opportunityType,
      priority,
      recommendationText,
      suggestedAction,
      estimatedImpact,
      relatedCampaignId,
      suggestedBidAmountMicros,
    } = body;

    // Validate required fields
    if (!trackedKeywordId || !opportunityType || !priority || !recommendationText || !suggestedAction) {
      return NextResponse.json(
        {
          error: 'Missing required fields: trackedKeywordId, opportunityType, priority, recommendationText, suggestedAction',
        },
        { status: 400 }
      );
    }

    // Validate enums
    const validOpportunityTypes = ['weak_organic', 'high_competition', 'serp_feature', 'position_drop', 'new_competitor_ads'];
    const validPriorities = ['high', 'medium', 'low'];
    const validActions = ['create_campaign', 'adjust_bids', 'add_to_existing', 'create_shopping_campaign', 'monitor', 'pause_ads'];

    if (!validOpportunityTypes.includes(opportunityType)) {
      return NextResponse.json(
        { error: `Invalid opportunityType. Must be one of: ${validOpportunityTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validActions.includes(suggestedAction)) {
      return NextResponse.json(
        { error: `Invalid suggestedAction. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Create opportunity
    const opportunity = await createSerpOpportunity(userId, trackedKeywordId, {
      opportunityType,
      priority,
      recommendationText,
      suggestedAction,
      estimatedImpact,
      relatedCampaignId,
      suggestedBidAmountMicros,
    });

    console.log(
      `[SERP Intelligence] Created ${priority} priority opportunity: ${recommendationText.substring(0, 50)}...`
    );

    return NextResponse.json({
      success: true,
      opportunity,
    });
  } catch (error) {
    console.error('[SERP Intelligence API] Error creating opportunity:', error);
    return NextResponse.json(
      {
        error: 'Failed to create opportunity',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
