/**
 * Single List API - GET, PUT, DELETE operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getKeywordListById,
  updateKeywordList,
  deleteKeywordList,
  getListItems,
} from '@/lib/database/lists';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/lists/[id] - Get a single list with its keywords
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const list = await getKeywordListById(id, session.user.email);

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Also fetch keywords in this list
    const keywords = await getListItems(id, session.user.email);

    return NextResponse.json({ list, keywords });
  } catch (error) {
    console.error('[Lists API] GET [id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch list' },
      { status: 500 }
    );
  }
}

// PUT /api/lists/[id] - Update a list
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, description, color, icon, is_favorite } = body;

    const list = await updateKeywordList(id, session.user.email, {
      name: name?.trim(),
      description: description?.trim(),
      color,
      icon,
      is_favorite,
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    return NextResponse.json({ list });
  } catch (error) {
    console.error('[Lists API] PUT [id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update list' },
      { status: 500 }
    );
  }
}

// DELETE /api/lists/[id] - Delete a list
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const deleted = await deleteKeywordList(id, session.user.email);

    if (deleted === 0) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Lists API] DELETE [id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    );
  }
}
