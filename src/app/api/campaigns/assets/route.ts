/**
 * Campaign Assets API - Asset Library Management
 * GET /api/campaigns/assets - List user's assets
 * POST /api/campaigns/assets - Create/upload new asset
 * DELETE /api/campaigns/assets - Delete asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAsset, getAssetsByUser, deleteAsset, getAssetById } from '@/lib/database';
import type { AssetType, AspectRatio } from '@/types/campaign';
import crypto from 'crypto';

export const runtime = 'nodejs';

// GET - List user's assets
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as AssetType | null;

    const assets = await getAssetsByUser(session.user.email, type || undefined);

    return NextResponse.json({
      success: true,
      assets,
      totalCount: assets.length,
    });
  } catch (error) {
    console.error('[Assets API] Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create new asset (text or reference to uploaded file)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.email;

    // Validate required fields
    if (!body.type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      );
    }

    // For text assets, require content
    const isTextAsset = ['HEADLINE', 'DESCRIPTION', 'LONG_HEADLINE', 'BUSINESS_NAME', 'CALL_TO_ACTION'].includes(body.type);
    if (isTextAsset && !body.content) {
      return NextResponse.json(
        { error: 'Text assets require content' },
        { status: 400 }
      );
    }

    // For media assets, require fileUrl or youtubeVideoId
    const isMediaAsset = ['IMAGE', 'VIDEO', 'LOGO'].includes(body.type);
    if (isMediaAsset && !body.fileUrl && !body.youtubeVideoId) {
      return NextResponse.json(
        { error: 'Media assets require fileUrl or youtubeVideoId' },
        { status: 400 }
      );
    }

    // Generate content hash for deduplication
    let contentHash: string;
    if (body.content) {
      contentHash = crypto.createHash('md5').update(body.content).digest('hex');
    } else if (body.fileUrl) {
      contentHash = crypto.createHash('md5').update(body.fileUrl).digest('hex');
    } else if (body.youtubeVideoId) {
      contentHash = crypto.createHash('md5').update(`yt:${body.youtubeVideoId}`).digest('hex');
    } else {
      contentHash = crypto.createHash('md5').update(Date.now().toString()).digest('hex');
    }

    const asset = await createAsset({
      userId,
      type: body.type as AssetType,
      content: body.content,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      width: body.width,
      height: body.height,
      aspectRatio: body.aspectRatio as AspectRatio,
      durationSeconds: body.durationSeconds,
      youtubeVideoId: body.youtubeVideoId,
      contentHash,
    });

    console.log(`[Assets API] Created asset: ${asset.id} (${asset.type})`);

    return NextResponse.json({
      success: true,
      asset,
      message: 'Asset created successfully',
    });
  } catch (error) {
    console.error('[Assets API] Error creating asset:', error);

    // Handle duplicate asset (content hash conflict)
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Asset already exists', details: 'An identical asset already exists in your library' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create asset', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete asset by ID (via query param)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing asset ID' }, { status: 400 });
    }

    // Verify asset exists
    const existing = await getAssetById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Verify ownership
    if (existing.userId !== session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const deleted = await deleteAsset(id, session.user.email);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
    }

    console.log(`[Assets API] Deleted asset: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Asset deleted successfully',
    });
  } catch (error) {
    console.error('[Assets API] Error deleting asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
