// Force Node.js runtime (not Edge) for Prisma compatibility
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { auth, isDemoMode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DEMO_ACCOUNT } from '@/lib/demo-data';

// GET /api/accounts - List all connected Google Ads accounts
export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Demo mode - return mock account
  if (isDemoMode) {
    return NextResponse.json({ accounts: [DEMO_ACCOUNT] });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      googleAdsAccounts: {
        select: {
          id: true,
          googleAccountId: true,
          accountName: true,
          status: true,
          isManager: true,
          parentManagerId: true,
          lastSyncAt: true,
          createdAt: true,
        },
        orderBy: [
          { isManager: 'desc' }, // Show manager accounts first
          { parentManagerId: 'asc' }, // Group by parent
          { accountName: 'asc' }, // Then by name
        ],
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ accounts: user.googleAdsAccounts });
}

// Maximum number of Google Ads accounts per user
const MAX_ACCOUNTS_PER_USER = 50;

// POST /api/accounts - Connect a new Google Ads account
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { googleAccountId, accountName, accessToken, refreshToken, tokenExpiresAt } = body;

  if (!googleAccountId || !accountName || !accessToken || !refreshToken) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      _count: {
        select: { googleAdsAccounts: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if account already connected
  const existingAccount = await prisma.googleAdsAccount.findFirst({
    where: {
      userId: user.id,
      googleAccountId,
    },
  });

  // Enforce 1-50 account limit (only for new accounts)
  if (!existingAccount && user._count.googleAdsAccounts >= MAX_ACCOUNTS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_ACCOUNTS_PER_USER} accounts allowed per user` },
      { status: 400 }
    );
  }

  if (existingAccount) {
    // Update existing account
    const updated = await prisma.googleAdsAccount.update({
      where: { id: existingAccount.id },
      data: {
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(tokenExpiresAt),
        status: 'connected',
      },
    });

    return NextResponse.json({ account: updated, updated: true });
  }

  // Create new account
  const account = await prisma.googleAdsAccount.create({
    data: {
      userId: user.id,
      googleAccountId,
      accountName,
      accessToken,
      refreshToken,
      tokenExpiresAt: new Date(tokenExpiresAt),
      status: 'connected',
    },
  });

  return NextResponse.json({ account, created: true }, { status: 201 });
}

// DELETE /api/accounts - Delete all connected Google Ads accounts (for re-sync)
export async function DELETE() {
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

  // Delete all Google Ads accounts for this user
  const deleted = await prisma.googleAdsAccount.deleteMany({
    where: { userId: user.id },
  });

  return NextResponse.json({ deleted: deleted.count });
}
