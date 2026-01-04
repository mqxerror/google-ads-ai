/**
 * List Keywords API - Add/Remove keywords from a list
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  addKeywordsToList,
  removeKeywordsFromList,
} from '@/lib/database/lists';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/lists/[id]/keywords - Add keywords to a list
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { keywords } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      );
    }

    // Transform keywords to the expected format
    const keywordInputs = keywords.map((kw: any) => {
      if (typeof kw === 'string') {
        return { keyword: kw };
      }
      return {
        keyword: kw.keyword || kw.term,
        snapshot_search_volume: kw.searchVolume || kw.volume || null,
        snapshot_cpc: kw.cpc || null,
        notes: kw.notes || null,
      };
    });

    const result = await addKeywordsToList(id, session.user.email, keywordInputs);

    return NextResponse.json({
      success: true,
      added: result.added,
      duplicates: result.duplicates,
    });
  } catch (error: any) {
    console.error('[Lists API] POST keywords error:', error);

    if (error.message === 'List not found or access denied') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to add keywords' },
      { status: 500 }
    );
  }
}

// DELETE /api/lists/[id]/keywords - Remove keywords from a list
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { keywords } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      );
    }

    const removed = await removeKeywordsFromList(id, session.user.email, keywords);

    return NextResponse.json({
      success: true,
      removed,
    });
  } catch (error: any) {
    console.error('[Lists API] DELETE keywords error:', error);

    if (error.message === 'List not found or access denied') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to remove keywords' },
      { status: 500 }
    );
  }
}
