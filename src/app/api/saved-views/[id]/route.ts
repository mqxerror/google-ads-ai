/**
 * Saved Views API - Individual View Operations
 *
 * GET /api/saved-views/[id] - Get a specific saved view
 * PUT /api/saved-views/[id] - Update a saved view
 * DELETE /api/saved-views/[id] - Delete a saved view
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET: Get a specific saved view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const view = await prisma.savedView.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!view) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    // Handle legacy data that may use 'field' instead of 'column'
    const rawSorting = view.sorting as { column?: string; field?: string; direction: 'asc' | 'desc' };
    const sorting = {
      column: rawSorting.column || rawSorting.field || 'spend',
      direction: rawSorting.direction || 'desc',
    };

    return NextResponse.json({
      view: {
        id: view.id,
        name: view.name,
        entityType: view.entityType,
        filters: view.filters,
        sorting,
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
    return NextResponse.json(
      { error: 'Failed to fetch saved view', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT: Update a saved view
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      filters,
      sorting,
      columns,
      datePreset,
      isDefault,
      isPinned,
      icon,
      color,
    } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const existingView = await prisma.savedView.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingView) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault && !existingView.isDefault) {
      await prisma.savedView.updateMany({
        where: {
          userId: user.id,
          entityType: existingView.entityType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (filters !== undefined) updateData.filters = filters;
    if (sorting !== undefined) updateData.sorting = sorting;
    if (columns !== undefined) updateData.columns = columns;
    if (datePreset !== undefined) updateData.datePreset = datePreset;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;

    const view = await prisma.savedView.update({
      where: { id },
      data: updateData,
    });

    // Handle legacy data that may use 'field' instead of 'column'
    const rawSorting = view.sorting as { column?: string; field?: string; direction: 'asc' | 'desc' };
    const normalizedSorting = {
      column: rawSorting.column || rawSorting.field || 'spend',
      direction: rawSorting.direction || 'desc',
    };

    return NextResponse.json({
      view: {
        id: view.id,
        name: view.name,
        entityType: view.entityType,
        filters: view.filters,
        sorting: normalizedSorting,
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
    return NextResponse.json(
      { error: 'Failed to update saved view', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Delete a saved view
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const existingView = await prisma.savedView.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingView) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    await prisma.savedView.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SavedViews] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete saved view', details: String(error) },
      { status: 500 }
    );
  }
}
