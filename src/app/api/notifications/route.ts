import { NextRequest, NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// Demo notifications
const DEMO_NOTIFICATIONS = [
  {
    id: 'demo-notif-1',
    type: 'alert',
    title: 'High CPA Detected',
    message: 'Campaign "Non-Brand - Generic Terms" has CPA 35% above target',
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    account: { name: 'Demo E-Commerce Store', id: '123-456-7890' },
  },
  {
    id: 'demo-notif-2',
    type: 'success',
    title: 'Budget Optimization Applied',
    message: 'AI increased budget by 10% on "Brand - Search Campaign"',
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    account: { name: 'Demo E-Commerce Store', id: '123-456-7890' },
  },
  {
    id: 'demo-notif-3',
    type: 'info',
    title: 'Weekly Performance Report',
    message: 'Your weekly performance report is ready to view',
    read: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    account: null,
  },
];

// GET /api/notifications - Get all notifications for the current user
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  // Demo mode - return mock notifications
  if (isDemoMode) {
    const notifications = unreadOnly
      ? DEMO_NOTIFICATIONS.filter(n => !n.read)
      : DEMO_NOTIFICATIONS;
    const unreadCount = DEMO_NOTIFICATIONS.filter(n => !n.read).length;
    return NextResponse.json({ notifications, unreadCount });
  }

  const accountId = searchParams.get('accountId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const where: Record<string, unknown> = {
      userId: user.id,
    };

    if (unreadOnly) {
      where.read = false;
    }

    if (accountId) {
      where.accountId = accountId;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        account: {
          select: {
            accountName: true,
            googleAccountId: true,
          },
        },
      },
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        read: false,
      },
    });

    return NextResponse.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        metadata: n.metadata,
        createdAt: n.createdAt.toISOString(),
        account: n.account ? {
          name: n.account.accountName,
          id: n.account.googleAccountId,
        } : null,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Create a new notification
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, title, message, accountId, metadata } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'type, title, and message are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const notification = await prisma.notification.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        accountId: accountId || null,
        type,
        title,
        message,
        metadata: metadata || null,
      },
    });

    return NextResponse.json({
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { notificationIds, markAllRead } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (markAllRead) {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          read: false,
        },
        data: { read: true },
      });

      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: user.id,
        },
        data: { read: true },
      });

      return NextResponse.json({ success: true, message: `${notificationIds.length} notifications marked as read` });
    }

    return NextResponse.json(
      { error: 'Either notificationIds or markAllRead is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - Delete notifications
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const notificationId = searchParams.get('id');
  const deleteAll = searchParams.get('deleteAll') === 'true';

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (deleteAll) {
      await prisma.notification.deleteMany({
        where: { userId: user.id },
      });
      return NextResponse.json({ success: true, message: 'All notifications deleted' });
    }

    if (notificationId) {
      await prisma.notification.delete({
        where: {
          id: notificationId,
          userId: user.id,
        },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Either id or deleteAll is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification', details: String(error) },
      { status: 500 }
    );
  }
}
