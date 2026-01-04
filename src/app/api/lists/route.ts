/**
 * Lists API - CRUD operations for keyword lists
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  createKeywordList,
  getKeywordLists,
  searchLists,
} from '@/lib/database/lists';

// GET /api/lists - Get all lists for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    let lists;
    if (query) {
      lists = await searchLists(session.user.email, query);
    } else {
      lists = await getKeywordLists(session.user.email);
    }

    return NextResponse.json({ lists });
  } catch (error) {
    console.error('[Lists API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lists' },
      { status: 500 }
    );
  }
}

// POST /api/lists - Create a new list
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, color, icon, is_favorite } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'List name is required' },
        { status: 400 }
      );
    }

    const list = await createKeywordList({
      user_id: session.user.email,
      name: name.trim(),
      description: description?.trim() || undefined,
      color: color || '#3B82F6',
      icon: icon || '📁',
      is_favorite: is_favorite || false,
    });

    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    console.error('[Lists API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create list' },
      { status: 500 }
    );
  }
}
