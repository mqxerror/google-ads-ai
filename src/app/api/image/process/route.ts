/**
 * Image Processing API - Proxy for imaginary
 * POST /api/image/process - Process a local image with imaginary
 *
 * Supports: resize, crop, smartcrop, rotate, embed
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';

const IMAGINARY_URL = process.env.IMAGINARY_URL || 'https://imaginary.pixelcraftedmedia.com';

const VALID_OPERATIONS = ['resize', 'crop', 'smartcrop', 'rotate', 'embed', 'fit', 'thumbnail'];

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imagePath, operation, params } = body;

    if (!imagePath || !operation) {
      return NextResponse.json(
        { error: 'Missing required fields: imagePath, operation' },
        { status: 400 }
      );
    }

    if (!VALID_OPERATIONS.includes(operation)) {
      return NextResponse.json(
        { error: `Invalid operation. Valid operations: ${VALID_OPERATIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Build the local file path
    const publicDir = path.join(process.cwd(), 'public');
    const fullPath = path.join(publicDir, imagePath);

    // Security check - ensure path is within public directory
    if (!fullPath.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read the file
    const fileBuffer = await readFile(fullPath);

    // Determine mime type from extension
    const ext = path.extname(fullPath).toLowerCase().slice(1);
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    // Create form data for imaginary
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, path.basename(fullPath));

    // Build imaginary URL with operation and params
    const urlParams = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          urlParams.append(key, String(value));
        }
      }
    }

    const imaginaryUrl = `${IMAGINARY_URL}/${operation}?${urlParams.toString()}`;

    // Call imaginary
    const response = await fetch(imaginaryUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Imaginary error:', errorText);
      return NextResponse.json(
        { error: 'Image processing failed', details: errorText },
        { status: 500 }
      );
    }

    // Get the processed image
    const processedBuffer = Buffer.from(await response.arrayBuffer());

    // Save to a new file
    const outputDir = path.join(publicDir, 'uploads', 'processed');
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    const hash = crypto.createHash('md5').update(processedBuffer).digest('hex').slice(0, 12);
    const outputFilename = `${hash}_${Date.now()}.${params?.type || 'jpg'}`;
    const outputPath = path.join(outputDir, outputFilename);

    await writeFile(outputPath, processedBuffer);

    const outputUrl = `/uploads/processed/${outputFilename}`;

    console.log(`[Image Process] ${operation}: ${imagePath} -> ${outputUrl}`);

    return NextResponse.json({
      success: true,
      url: outputUrl,
      operation,
    });
  } catch (error) {
    console.error('[Image Process] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
