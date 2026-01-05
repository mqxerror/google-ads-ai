/**
 * Campaigns API - List and Create
 * GET /api/campaigns - List all campaigns for user
 * POST /api/campaigns - Create a new campaign (local only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  createCampaign as dbCreateCampaign,
  getCampaigns,
  createAdGroup,
  createCampaignKeywordsBulk,
  createNegativeKeywordsBulk,
  createAssetGroup,
  createAsset,
  createAssetLink,
} from '@/lib/database';
import type {
  CampaignType,
  BiddingStrategy,
  MatchType,
  AssetType,
  AssetFieldType,
} from '@/types/campaign';

export const runtime = 'nodejs';

// GET - List campaigns
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as CampaignType | null;

    const campaigns = await getCampaigns(session.user.email, type || undefined);

    return NextResponse.json({
      success: true,
      campaigns,
      totalCount: campaigns.length,
    });
  } catch (error) {
    console.error('[Campaigns API] Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create new campaign
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.email;

    // Validate required fields
    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: name and type are required' },
        { status: 400 }
      );
    }

    console.log(`[Campaigns API] Creating campaign: ${body.name} (${body.type})`);

    // Create campaign
    const campaign = await dbCreateCampaign({
      userId,
      name: body.name,
      type: body.type as CampaignType,
      status: body.status || 'DRAFT',
      targetLocations: body.targetLocations || [],
      targetLanguages: body.targetLanguages || ['en'],
      dailyBudget: body.dailyBudget,
      biddingStrategy: body.biddingStrategy as BiddingStrategy,
      targetCpa: body.targetCpa,
      targetRoas: body.targetRoas,
      startDate: body.startDate,
      endDate: body.endDate,
      includeSearchPartners: body.includeSearchPartners,
      includeDisplayNetwork: body.includeDisplayNetwork,
      finalUrl: body.finalUrl,
      trackingTemplate: body.trackingTemplate,
      intelligenceProjectId: body.intelligenceProjectId,
    });

    console.log(`[Campaigns API] Campaign created with ID: ${campaign.id}`);

    // Handle ad groups (for Search/Display campaigns)
    if (body.adGroups && Array.isArray(body.adGroups)) {
      for (const agData of body.adGroups) {
        const adGroup = await createAdGroup({
          campaignId: campaign.id,
          name: agData.name,
          cpcBid: agData.cpcBid,
          targetingType: agData.targetingType,
        });

        console.log(`[Campaigns API] Created ad group: ${adGroup.name}`);

        // Add keywords
        if (agData.keywords && Array.isArray(agData.keywords)) {
          const keywordsToAdd = agData.keywords.map((kw: any) => ({
            keyword: typeof kw === 'string' ? kw : kw.keyword,
            matchType: (typeof kw === 'string' ? 'BROAD' : kw.matchType) as MatchType,
            cpcBid: typeof kw === 'object' ? kw.cpcBid : undefined,
          }));

          if (keywordsToAdd.length > 0) {
            await createCampaignKeywordsBulk(adGroup.id, keywordsToAdd);
            console.log(`[Campaigns API] Added ${keywordsToAdd.length} keywords to ${adGroup.name}`);
          }
        }
      }
    }

    // Handle negative keywords
    if (body.negativeKeywords && Array.isArray(body.negativeKeywords) && body.negativeKeywords.length > 0) {
      await createNegativeKeywordsBulk(
        campaign.id,
        body.negativeKeywords,
        (body.negativeKeywordMatchType || 'BROAD') as MatchType
      );
      console.log(`[Campaigns API] Added ${body.negativeKeywords.length} negative keywords`);
    }

    // Handle asset groups (for PMax/Demand Gen campaigns)
    if (body.assetGroups && Array.isArray(body.assetGroups)) {
      for (const assetGroupData of body.assetGroups) {
        const assetGroup = await createAssetGroup({
          campaignId: campaign.id,
          name: assetGroupData.name,
          finalUrl: assetGroupData.finalUrl || body.finalUrl,
          path1: assetGroupData.path1,
          path2: assetGroupData.path2,
        });

        console.log(`[Campaigns API] Created asset group: ${assetGroup.name}`);

        // Add text assets (headlines, descriptions)
        const textAssets: Array<{ type: AssetType; content: string; fieldType: AssetFieldType }> = [];

        if (assetGroupData.headlines) {
          assetGroupData.headlines.forEach((headline: string) => {
            textAssets.push({ type: 'HEADLINE', content: headline, fieldType: 'HEADLINE' });
          });
        }

        if (assetGroupData.longHeadlines) {
          assetGroupData.longHeadlines.forEach((headline: string) => {
            textAssets.push({ type: 'LONG_HEADLINE', content: headline, fieldType: 'LONG_HEADLINE' });
          });
        }

        if (assetGroupData.descriptions) {
          assetGroupData.descriptions.forEach((desc: string) => {
            textAssets.push({ type: 'DESCRIPTION', content: desc, fieldType: 'DESCRIPTION' });
          });
        }

        if (assetGroupData.businessName) {
          textAssets.push({
            type: 'BUSINESS_NAME',
            content: assetGroupData.businessName,
            fieldType: 'BUSINESS_NAME',
          });
        }

        // Create and link text assets
        for (let i = 0; i < textAssets.length; i++) {
          const ta = textAssets[i];
          const asset = await createAsset({
            userId,
            type: ta.type,
            content: ta.content,
            contentHash: `${ta.type}:${ta.content}`.substring(0, 255),
          });

          await createAssetLink({
            assetId: asset.id,
            assetGroupId: assetGroup.id,
            fieldType: ta.fieldType,
            position: i,
          });
        }

        console.log(`[Campaigns API] Added ${textAssets.length} text assets to ${assetGroup.name}`);

        // Create and link image assets (for Google Ads upload later)
        if (assetGroupData.images && Array.isArray(assetGroupData.images)) {
          for (let i = 0; i < assetGroupData.images.length; i++) {
            const img = assetGroupData.images[i];
            const fieldType: AssetFieldType = img.aspectRatio === '1:1'
              ? 'SQUARE_MARKETING_IMAGE'
              : 'MARKETING_IMAGE';

            const asset = await createAsset({
              userId,
              type: 'IMAGE',
              fileUrl: img.fileUrl,
              fileName: img.fileName,
              width: img.width,
              height: img.height,
              aspectRatio: img.aspectRatio,
              mimeType: img.mimeType,
              contentHash: `IMAGE:${img.fileUrl}`.substring(0, 255),
            });

            await createAssetLink({
              assetId: asset.id,
              assetGroupId: assetGroup.id,
              fieldType,
              position: i,
            });
          }
          console.log(`[Campaigns API] Added ${assetGroupData.images.length} image assets to ${assetGroup.name}`);
        }

        // Create and link logo assets
        if (assetGroupData.logos && Array.isArray(assetGroupData.logos)) {
          for (let i = 0; i < assetGroupData.logos.length; i++) {
            const logo = assetGroupData.logos[i];

            const asset = await createAsset({
              userId,
              type: 'IMAGE',
              fileUrl: logo.fileUrl,
              fileName: logo.fileName,
              width: logo.width,
              height: logo.height,
              aspectRatio: logo.aspectRatio,
              mimeType: logo.mimeType,
              contentHash: `LOGO:${logo.fileUrl}`.substring(0, 255),
            });

            await createAssetLink({
              assetId: asset.id,
              assetGroupId: assetGroup.id,
              fieldType: 'LOGO' as AssetFieldType,
              position: i,
            });
          }
          console.log(`[Campaigns API] Added ${assetGroupData.logos.length} logo assets to ${assetGroup.name}`);
        }

        // Create and link video assets
        if (assetGroupData.videos && Array.isArray(assetGroupData.videos)) {
          for (let i = 0; i < assetGroupData.videos.length; i++) {
            const video = assetGroupData.videos[i];

            const asset = await createAsset({
              userId,
              type: 'VIDEO',
              fileUrl: video.fileUrl,
              fileName: video.fileName,
              youtubeVideoId: video.youtubeVideoId,
              contentHash: `VIDEO:${video.youtubeVideoId || video.fileUrl}`.substring(0, 255),
            });

            await createAssetLink({
              assetId: asset.id,
              assetGroupId: assetGroup.id,
              fieldType: 'YOUTUBE_VIDEO' as AssetFieldType,
              position: i,
            });
          }
          console.log(`[Campaigns API] Added ${assetGroupData.videos.length} video assets to ${assetGroup.name}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      campaign,
      message: 'Campaign created successfully',
    });
  } catch (error) {
    console.error('[Campaigns API] Error creating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
