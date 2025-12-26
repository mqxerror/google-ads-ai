/**
 * Embeddings API Endpoint
 *
 * POST: Generate embeddings for texts
 * - Single text: { text: "string" }
 * - Multiple texts: { texts: ["string", ...] }
 *
 * Returns embedding vectors for vector store operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding, generateEmbeddings, EMBEDDING_MODEL, EMBEDDING_DIMENSION, getEmbeddingMetadata } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Single text embedding
    if (body.text && typeof body.text === 'string') {
      const embedding = await generateEmbedding(body.text);
      const metadata = getEmbeddingMetadata();

      return NextResponse.json({
        success: true,
        embedding,
        ...metadata,
      });
    }

    // Batch embeddings
    if (body.texts && Array.isArray(body.texts)) {
      if (body.texts.length === 0) {
        return NextResponse.json({
          success: true,
          embeddings: [],
          count: 0,
        });
      }

      if (body.texts.length > 2048) {
        return NextResponse.json(
          { error: 'Maximum 2048 texts per request' },
          { status: 400 }
        );
      }

      const embeddings = await generateEmbeddings(body.texts);
      const metadata = getEmbeddingMetadata();

      return NextResponse.json({
        success: true,
        embeddings,
        count: embeddings.length,
        ...metadata,
      });
    }

    return NextResponse.json(
      { error: 'Request must include "text" (string) or "texts" (array)' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[Embeddings API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate embeddings',
      },
      { status: 500 }
    );
  }
}

// GET: Return embedding configuration
export async function GET() {
  return NextResponse.json({
    service: 'Quick Ads AI Embeddings',
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSION,
    maxBatchSize: 2048,
    usage: {
      single: {
        method: 'POST',
        body: { text: 'your text here' },
      },
      batch: {
        method: 'POST',
        body: { texts: ['text1', 'text2', '...'] },
      },
    },
  });
}
