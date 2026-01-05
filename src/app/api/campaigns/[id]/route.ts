/**
 * Campaign API - Individual Campaign Operations
 * GET /api/campaigns/[id] - Get campaign details with relations
 * PUT /api/campaigns/[id] - Update campaign
 * DELETE /api/campaigns/[id] - Delete campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getCampaignById,
  getCampaignWithRelations,
  updateCampaign,
  deleteCampaign,
  getNegativeKeywordsByCampaign,
} from '@/lib/database';
import type { CampaignType, BiddingStrategy } from '@/types/campaign';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Get campaign with full details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const includeRelations = searchParams.get('relations') !== 'false';

    let campaign;

    if (includeRelations) {
      campaign = await getCampaignWithRelations(id, session.user.email);
    } else {
      campaign = await getCampaignById(id, session.user.email);
    }

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch negative keywords separately
    const negativeKeywords = await getNegativeKeywordsByCampaign(id);

    return NextResponse.json({
      success: true,
      campaign,
      negativeKeywords,
    });
  } catch (error) {
    console.error('[Campaign API] Error fetching campaign:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update campaign
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Verify campaign exists and belongs to user
    const existing = await getCampaignById(id, session.user.email);
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Update campaign with allowed fields
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.type !== undefined) updateData.type = body.type as CampaignType;
    if (body.targetLocations !== undefined) updateData.targetLocations = body.targetLocations;
    if (body.targetLanguages !== undefined) updateData.targetLanguages = body.targetLanguages;
    if (body.dailyBudget !== undefined) updateData.dailyBudget = body.dailyBudget;
    if (body.biddingStrategy !== undefined) updateData.biddingStrategy = body.biddingStrategy as BiddingStrategy;
    if (body.targetCpa !== undefined) updateData.targetCpa = body.targetCpa;
    if (body.targetRoas !== undefined) updateData.targetRoas = body.targetRoas;
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.endDate !== undefined) updateData.endDate = body.endDate;
    if (body.includeSearchPartners !== undefined) updateData.includeSearchPartners = body.includeSearchPartners;
    if (body.includeDisplayNetwork !== undefined) updateData.includeDisplayNetwork = body.includeDisplayNetwork;
    if (body.finalUrl !== undefined) updateData.finalUrl = body.finalUrl;
    if (body.trackingTemplate !== undefined) updateData.trackingTemplate = body.trackingTemplate;
    if (body.intelligenceProjectId !== undefined) updateData.intelligenceProjectId = body.intelligenceProjectId;

    const campaign = await updateCampaign(id, session.user.email, updateData);

    if (!campaign) {
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }

    console.log(`[Campaign API] Updated campaign: ${campaign.id}`);

    return NextResponse.json({
      success: true,
      campaign,
      message: 'Campaign updated successfully',
    });
  } catch (error) {
    console.error('[Campaign API] Error updating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete campaign
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify campaign exists
    const existing = await getCampaignById(id, session.user.email);
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check if synced to Google - warn but allow deletion
    if (existing.googleCampaignId) {
      console.log(`[Campaign API] Warning: Deleting campaign ${id} that is synced to Google Ads (${existing.googleCampaignId})`);
    }

    const deleted = await deleteCampaign(id, session.user.email);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }

    console.log(`[Campaign API] Deleted campaign: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    console.error('[Campaign API] Error deleting campaign:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
