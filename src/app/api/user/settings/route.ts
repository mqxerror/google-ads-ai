import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/settings - Get user settings
export async function GET() {
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

    // Get settings from separate UserSettings table
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    // Return settings (mask API keys)
    return NextResponse.json({
      success: true,
      settings: settings ? {
        llmProvider: settings.defaultLlmProvider,
        anthropicApiKey: settings.anthropicApiKey ? maskApiKey(settings.anthropicApiKey) : null,
        openaiApiKey: settings.openaiApiKey ? maskApiKey(settings.openaiApiKey) : null,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/user/settings - Update user settings
export async function PATCH(request: NextRequest) {
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
    const {
      llmProvider,
      anthropicApiKey,
      openaiApiKey,
    } = body;

    // Build update data - only include non-masked API keys
    const updateData: {
      defaultLlmProvider?: string;
      anthropicApiKey?: string | null;
      openaiApiKey?: string | null;
    } = {};

    if (llmProvider !== undefined) updateData.defaultLlmProvider = llmProvider;

    // Only update API keys if they're not masked
    if (anthropicApiKey !== undefined && !anthropicApiKey.includes('••••')) {
      updateData.anthropicApiKey = anthropicApiKey || null;
    }
    if (openaiApiKey !== undefined && !openaiApiKey.includes('••••')) {
      updateData.openaiApiKey = openaiApiKey || null;
    }

    // Upsert settings
    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      settings: {
        llmProvider: settings.defaultLlmProvider,
      },
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
}

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}
