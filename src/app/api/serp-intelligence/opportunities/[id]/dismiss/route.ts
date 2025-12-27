/**
 * Dismiss SERP Intelligence Opportunity
 *
 * POST /api/serp-intelligence/opportunities/[id]/dismiss
 * User can dismiss opportunities they don't want to act on
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateSerpOpportunityStatus, getUserIdFromEmail } from '@/lib/database/serp-intelligence';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: opportunityId } = await params;

    // Parse optional reason from body
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'User dismissed';

    // Update opportunity status
    const updated = await updateSerpOpportunityStatus(
      opportunityId,
      userId,
      'dismissed',
      reason
    );

    if (!updated) {
      return NextResponse.json(
        { error: 'Opportunity not found or unauthorized' },
        { status: 404 }
      );
    }

    console.log(`[SERP Intelligence] User ${userId} dismissed opportunity ${opportunityId}`);

    return NextResponse.json({
      success: true,
      message: 'Opportunity dismissed',
      opportunity: updated,
    });
  } catch (error) {
    console.error('[SERP Intelligence API] Error dismissing opportunity:', error);
    return NextResponse.json(
      {
        error: 'Failed to dismiss opportunity',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
