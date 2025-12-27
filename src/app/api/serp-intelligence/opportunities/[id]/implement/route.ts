/**
 * Implement SERP Intelligence Opportunity
 *
 * POST /api/serp-intelligence/opportunities/[id]/implement
 * User marks opportunity as implemented (e.g., created campaign, adjusted bids)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateSerpOpportunityStatus, getUserIdFromEmail } from '@/lib/database/serp-intelligence';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const opportunityId = params.id;

    // Update opportunity status
    const updated = await updateSerpOpportunityStatus(
      opportunityId,
      userId,
      'implemented'
    );

    if (!updated) {
      return NextResponse.json(
        { error: 'Opportunity not found or unauthorized' },
        { status: 404 }
      );
    }

    console.log(`[SERP Intelligence] User ${userId} implemented opportunity ${opportunityId}`);

    return NextResponse.json({
      success: true,
      message: 'Opportunity marked as implemented',
      opportunity: updated,
    });
  } catch (error) {
    console.error('[SERP Intelligence API] Error implementing opportunity:', error);
    return NextResponse.json(
      {
        error: 'Failed to mark opportunity as implemented',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
