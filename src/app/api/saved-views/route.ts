/**
 * Saved Views API
 *
 * GET /api/saved-views - List all saved views for current user
 * POST /api/saved-views - Create a new saved view
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export interface SavedViewData {
  id: string;
  name: string;
  entityType: string;
  filters: Record<string, unknown>;
  sorting: { column: string; direction: 'asc' | 'desc' };
  columns: string[];
  datePreset: string | null;
  isDefault: boolean;
  isPinned: boolean;
  icon: string | null;
  color: string | null;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
}

// GET: List saved views
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entityType') || 'campaign';
  const accountId = searchParams.get('accountId');

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get views that are either global (accountId=null) or for the specific account
    const views = await prisma.savedView.findMany({
      where: {
        userId: user.id,
        entityType,
        OR: [
          { accountId: null },
          { accountId: accountId || undefined },
        ],
      },
      orderBy: [
        { isPinned: 'desc' },
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    const formattedViews: SavedViewData[] = views.map(v => {
      // Handle legacy data that may use 'field' instead of 'column'
      const rawSorting = v.sorting as { column?: string; field?: string; direction: 'asc' | 'desc' };
      const sorting = {
        column: rawSorting.column || rawSorting.field || 'spend',
        direction: rawSorting.direction || 'desc',
      };
      return {
        id: v.id,
        name: v.name,
        entityType: v.entityType,
        filters: v.filters as Record<string, unknown>,
        sorting,
        columns: v.columns as string[],
        datePreset: v.datePreset,
        isDefault: v.isDefault,
        isPinned: v.isPinned,
        icon: v.icon,
        color: v.color,
        accountId: v.accountId,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ views: formattedViews });
  } catch (error) {
    console.error('[SavedViews] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved views', details: String(error) },
      { status: 500 }
    );
  }
}

// POST: Create a new saved view
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      entityType = 'campaign',
      filters = {},
      sorting = { column: 'spend', direction: 'desc' },
      columns = ['name', 'status', 'spend', 'conversions', 'cpa'],
      datePreset,
      isDefault = false,
      isPinned = false,
      icon,
      color,
      accountId,
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults for this entity type
    if (isDefault) {
      await prisma.savedView.updateMany({
        where: {
          userId: user.id,
          entityType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const view = await prisma.savedView.create({
      data: {
        userId: user.id,
        accountId: accountId || null,
        name: name.trim(),
        entityType,
        filters,
        sorting,
        columns,
        datePreset: datePreset || null,
        isDefault,
        isPinned,
        icon: icon || null,
        color: color || null,
      },
    });

    return NextResponse.json({
      view: {
        id: view.id,
        name: view.name,
        entityType: view.entityType,
        filters: view.filters,
        sorting: view.sorting,
        columns: view.columns,
        datePreset: view.datePreset,
        isDefault: view.isDefault,
        isPinned: view.isPinned,
        icon: view.icon,
        color: view.color,
        accountId: view.accountId,
        createdAt: view.createdAt.toISOString(),
        updatedAt: view.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[SavedViews] Error:', error);

    // Check for unique constraint violation
    if (String(error).includes('Unique constraint failed')) {
      return NextResponse.json(
        { error: 'A view with this name already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create saved view', details: String(error) },
      { status: 500 }
    );
  }
}
