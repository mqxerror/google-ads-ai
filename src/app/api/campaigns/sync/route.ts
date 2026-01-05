/**
 * Campaign Sync API - Sync local campaigns to Google Ads
 * POST /api/campaigns/sync - Sync a campaign to Google Ads
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { syncCampaignToGoogleAds } from '@/lib/google-ads-visual';
import { getCampaignWithRelations, updateCampaign, updateCampaignGoogleId } from '@/lib/database/campaigns';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Google Ads tokens from session
    const refreshToken = (session as any).refreshToken;
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Google Ads not connected. Please reconnect your account.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { campaignId, customerId, loginCustomerId } = body;

    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
    }

    const userId = session.user.email;

    // Get campaign from database
    const campaign = await getCampaignWithRelations(campaignId, userId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check campaign type
    const supportedTypes = ['PMAX', 'DISPLAY', 'DEMAND_GEN'];
    if (!supportedTypes.includes(campaign.type)) {
      return NextResponse.json(
        { error: `Campaign type ${campaign.type} not supported for visual sync. Use regular campaign creation.` },
        { status: 400 }
      );
    }

    console.log(`[Campaign Sync] Syncing campaign ${campaignId} to Google Ads...`);

    // Campaign object with optional fields (type assertion for visual campaign properties)
    const campaignData = campaign as any;

    // Build asset groups from campaign data
    // Note: The database stores assets as linked assets (ag.assets) with fieldType and content
    // We need to extract headlines, descriptions, etc. from these linked assets
    const assetGroups = (campaignData.assetGroups || []).map((ag: any) => {
      const assets = ag.assets || [];

      // Extract text content from linked assets by field type
      const headlines = assets
        .filter((a: any) => a.fieldType === 'HEADLINE')
        .map((a: any) => a.asset?.content || a.content || '')
        .filter((h: string) => h.trim());

      const longHeadlines = assets
        .filter((a: any) => a.fieldType === 'LONG_HEADLINE')
        .map((a: any) => a.asset?.content || a.content || '')
        .filter((h: string) => h.trim());

      const descriptions = assets
        .filter((a: any) => a.fieldType === 'DESCRIPTION')
        .map((a: any) => a.asset?.content || a.content || '')
        .filter((d: string) => d.trim());

      const businessNameAsset = assets.find((a: any) => a.fieldType === 'BUSINESS_NAME');
      const businessName = businessNameAsset?.asset?.content || businessNameAsset?.content || '';

      // Extract image assets - include fieldType for proper categorization
      const images = assets
        .filter((a: any) => a.fieldType === 'MARKETING_IMAGE' || a.fieldType === 'SQUARE_MARKETING_IMAGE')
        .map((a: any) => ({
          url: a.asset?.fileUrl || a.fileUrl || '',
          aspectRatio: a.fieldType === 'SQUARE_MARKETING_IMAGE' ? '1:1' : (a.asset?.aspectRatio || a.aspectRatio || '1.91:1'),
          fieldType: a.fieldType, // Pass field type for exact categorization
        }))
        .filter((img: any) => img.url);

      // Extract logo assets
      const logos = assets
        .filter((a: any) => a.fieldType === 'LOGO')
        .map((a: any) => ({
          url: a.asset?.fileUrl || a.fileUrl || '',
        }))
        .filter((logo: any) => logo.url);

      // Extract video assets
      const videos = assets
        .filter((a: any) => a.fieldType === 'YOUTUBE_VIDEO')
        .map((a: any) => ({
          youtubeVideoId: a.asset?.youtubeVideoId || a.youtubeVideoId || '',
        }))
        .filter((v: any) => v.youtubeVideoId);

      console.log(`[Campaign Sync] Asset group ${ag.name}:`);
      console.log(`  - Headlines: ${headlines.length}`);
      console.log(`  - Long Headlines: ${longHeadlines.length}`);
      console.log(`  - Descriptions: ${descriptions.length}`);
      console.log(`  - Business Name: "${businessName}"`);
      console.log(`  - Images: ${images.length}`, images.map((i: any) => i.url).slice(0, 3));
      console.log(`  - Logos: ${logos.length}`, logos.map((l: any) => l.url).slice(0, 3));
      console.log(`  - Videos: ${videos.length}`);

      return {
        name: ag.name,
        finalUrl: ag.finalUrl || campaign.finalUrl || '',
        headlines,
        longHeadlines,
        descriptions,
        businessName,
        callToAction: ag.callToAction,
        images,
        logos,
        videos,
        path1: ag.path1,
        path2: ag.path2,
      };
    });

    // Sync to Google Ads
    const result = await syncCampaignToGoogleAds(
      refreshToken,
      customerId,
      {
        type: campaign.type as 'PMAX' | 'DISPLAY' | 'DEMAND_GEN',
        name: campaign.name,
        dailyBudget: campaign.dailyBudget || 50,
        biddingStrategy: campaign.biddingStrategy || 'MAXIMIZE_CONVERSIONS',
        targetCpa: campaign.targetCpa,
        targetRoas: campaign.targetRoas,
        finalUrl: campaign.finalUrl || '',
        assetGroups,
        headlines: campaignData.headlines,
        longHeadline: campaignData.longHeadline,
        descriptions: campaignData.descriptions,
        businessName: campaignData.businessName,
        images: campaignData.images,
        logos: campaignData.logos,
        targetLocations: campaign.targetLocations,
        targetLanguages: campaign.targetLanguages,
      },
      loginCustomerId
    );

    if (!result.success) {
      console.error(`[Campaign Sync] Failed:`, result.error);
      return NextResponse.json(
        {
          error: 'Failed to sync campaign',
          details: result.error,
          googleAdsError: result.details,
        },
        { status: 500 }
      );
    }

    // Update local campaign with Google Ads IDs and mark as SYNCED
    if (result.campaignId) {
      await updateCampaignGoogleId(campaignId, result.campaignId);
    }
    await updateCampaign(campaignId, userId, {
      status: 'SYNCED', // Synced to Google Ads - no longer a draft
    } as any);

    console.log(`[Campaign Sync] Success! Google Campaign ID: ${result.campaignId}`);
    console.log(`[Campaign Sync] Local campaign status updated to SYNCED`);

    return NextResponse.json({
      success: true,
      googleCampaignId: result.campaignId,
      assetGroupIds: result.assetGroupIds,
      message: result.details || 'Campaign synced successfully',
    });

  } catch (error) {
    console.error('[Campaign Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync campaign', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
