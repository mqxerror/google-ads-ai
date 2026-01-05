/**
 * File Upload API - Local Storage
 * POST /api/upload - Upload a file to local storage
 *
 * Supports: images (jpg, png, gif, webp), videos (mp4, webm)
 * Files are stored in /public/uploads/{images|videos}/
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';

// Max file sizes
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 256 * 1024 * 1024; // 256MB

// Accepted MIME types
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// Get file extension from MIME type
function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  return mimeToExt[mimeType] || 'bin';
}

// Generate unique filename
function generateFilename(userId: string, originalName: string, mimeType: string): string {
  const ext = getExtensionFromMime(mimeType);
  const timestamp = Date.now();
  const randomPart = crypto.randomBytes(8).toString('hex');
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  return `${sanitizedUserId}_${timestamp}_${randomPart}.${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const assetType = formData.get('assetType') as string || 'image';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const mimeType = file.type;
    const fileSize = file.size;

    // Determine if image or video
    const isImage = ACCEPTED_IMAGE_TYPES.includes(mimeType);
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(mimeType);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: `Invalid file type: ${mimeType}. Accepted: ${[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(', ')}` },
        { status: 400 }
      );
    }

    // Check file size
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (fileSize > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Determine upload directory
    const uploadType = isImage ? 'images' : 'videos';
    const publicDir = path.join(process.cwd(), 'public', 'uploads', uploadType);

    // Ensure directory exists
    if (!existsSync(publicDir)) {
      await mkdir(publicDir, { recursive: true });
    }

    // Generate unique filename
    const filename = generateFilename(userId, file.name, mimeType);
    const filePath = path.join(publicDir, filename);

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Write file to disk
    await writeFile(filePath, buffer);

    // Generate public URL
    const fileUrl = `/uploads/${uploadType}/${filename}`;

    // Get image dimensions if it's an image
    let width: number | undefined;
    let height: number | undefined;
    let aspectRatio: string | undefined;

    if (isImage) {
      // Use sharp for image dimensions if available, otherwise skip
      try {
        const sharp = await import('sharp').then(m => m.default).catch(() => null);
        if (sharp) {
          const metadata = await sharp(buffer).metadata();
          width = metadata.width;
          height = metadata.height;
          if (width && height) {
            aspectRatio = detectAspectRatio(width, height);
          }
        }
      } catch (e) {
        console.warn('Could not read image dimensions:', e);
      }
    }

    console.log(`[Upload API] File uploaded: ${fileUrl} (${fileSize} bytes)`);

    return NextResponse.json({
      success: true,
      file: {
        url: fileUrl,
        fileName: file.name,
        fileSize,
        mimeType,
        width,
        height,
        aspectRatio,
      },
    });
  } catch (error) {
    console.error('[Upload API] Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Detect aspect ratio from dimensions
function detectAspectRatio(width: number, height: number): string | undefined {
  const ratio = width / height;

  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 1.91) < 0.15) return '1.91:1';
  if (Math.abs(ratio - 0.8) < 0.1) return '4:5';
  if (Math.abs(ratio - 1.78) < 0.1) return '16:9';
  if (Math.abs(ratio - 0.5625) < 0.1) return '9:16';

  return undefined;
}
