import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Fetch all saved views for user/account
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const entityType = searchParams.get('entityType') || 'campaign';

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    const savedViews = await prisma.savedView.findMany({
      where: {
        userId: user.id,
        accountId,
        entityType,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ views: savedViews });
  } catch (error) {
    console.error('Error fetching saved views:', error);
    return NextResponse.json({ error: 'Failed to fetch views' }, { status: 500 });
  }
}

// POST - Create a new saved view
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { accountId, name, entityType, filters, sorting, columns } = body;

    if (!accountId || !name) {
      return NextResponse.json({ error: 'Account ID and name required' }, { status: 400 });
    }

    const savedView = await prisma.savedView.create({
      data: {
        userId: user.id,
        accountId,
        name,
        entityType: entityType || 'campaign',
        filters: filters || {},
        sorting: sorting || { column: 'spend', direction: 'desc' },
        columns: columns || [],
        isDefault: false,
      },
    });

    return NextResponse.json({ view: savedView }, { status: 201 });
  } catch (error) {
    console.error('Error creating saved view:', error);
    return NextResponse.json({ error: 'Failed to create view' }, { status: 500 });
  }
}

// PUT - Update a saved view
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { id, name, filters, sorting, columns, isDefault } = body;

    if (!id) {
      return NextResponse.json({ error: 'View ID required' }, { status: 400 });
    }

    // Verify ownership
    const existingView = await prisma.savedView.findFirst({
      where: { id, userId: user.id },
    });

    if (!existingView) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults for same account/entityType
    if (isDefault) {
      await prisma.savedView.updateMany({
        where: {
          userId: user.id,
          accountId: existingView.accountId,
          entityType: existingView.entityType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const updatedView = await prisma.savedView.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(filters !== undefined && { filters }),
        ...(sorting !== undefined && { sorting }),
        ...(columns !== undefined && { columns }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return NextResponse.json({ view: updatedView });
  } catch (error) {
    console.error('Error updating saved view:', error);
    return NextResponse.json({ error: 'Failed to update view' }, { status: 500 });
  }
}

// DELETE - Delete a saved view
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'View ID required' }, { status: 400 });
    }

    // Verify ownership
    const existingView = await prisma.savedView.findFirst({
      where: { id, userId: user.id },
    });

    if (!existingView) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 });
    }

    await prisma.savedView.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved view:', error);
    return NextResponse.json({ error: 'Failed to delete view' }, { status: 500 });
  }
}
