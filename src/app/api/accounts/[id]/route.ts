import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/accounts/[id] - Get a specific Google Ads account
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const account = await prisma.googleAdsAccount.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  return NextResponse.json({ account });
}

// DELETE /api/accounts/[id] - Disconnect a Google Ads account
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if account belongs to user
  const account = await prisma.googleAdsAccount.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  // Delete account (cascade will handle related data)
  await prisma.googleAdsAccount.delete({
    where: { id },
  });

  return NextResponse.json({ success: true, message: 'Account disconnected' });
}

// PATCH /api/accounts/[id] - Update account status
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { status, accessToken, refreshToken, tokenExpiresAt } = body;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const account = await prisma.googleAdsAccount.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (accessToken) updateData.accessToken = accessToken;
  if (refreshToken) updateData.refreshToken = refreshToken;
  if (tokenExpiresAt) updateData.tokenExpiresAt = new Date(tokenExpiresAt);

  const updated = await prisma.googleAdsAccount.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ account: updated });
}
