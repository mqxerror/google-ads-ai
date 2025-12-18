import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/settings - Get user settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    // Return settings with masked API keys
    return NextResponse.json({
      success: true,
      settings: settings ? {
        anthropicApiKey: settings.anthropicApiKey ? maskApiKey(settings.anthropicApiKey) : null,
        openaiApiKey: settings.openaiApiKey ? maskApiKey(settings.openaiApiKey) : null,
        defaultLlmProvider: settings.defaultLlmProvider,
        hasAnthropicKey: !!settings.anthropicApiKey,
        hasOpenaiKey: !!settings.openaiApiKey,
      } : {
        anthropicApiKey: null,
        openaiApiKey: null,
        defaultLlmProvider: 'anthropic',
        hasAnthropicKey: false,
        hasOpenaiKey: false,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST /api/settings - Update user settings
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { anthropicApiKey, openaiApiKey, defaultLlmProvider } = body;

    // Build update data - only update fields that are provided
    const updateData: {
      anthropicApiKey?: string | null;
      openaiApiKey?: string | null;
      defaultLlmProvider?: string;
    } = {};

    // Only update API key if explicitly provided (not undefined)
    // Empty string means clear the key, undefined means don't change
    if (anthropicApiKey !== undefined) {
      updateData.anthropicApiKey = anthropicApiKey || null;
    }
    if (openaiApiKey !== undefined) {
      updateData.openaiApiKey = openaiApiKey || null;
    }
    if (defaultLlmProvider) {
      updateData.defaultLlmProvider = defaultLlmProvider;
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        anthropicApiKey: anthropicApiKey || null,
        openaiApiKey: openaiApiKey || null,
        defaultLlmProvider: defaultLlmProvider || 'anthropic',
      },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      settings: {
        anthropicApiKey: settings.anthropicApiKey ? maskApiKey(settings.anthropicApiKey) : null,
        openaiApiKey: settings.openaiApiKey ? maskApiKey(settings.openaiApiKey) : null,
        defaultLlmProvider: settings.defaultLlmProvider,
        hasAnthropicKey: !!settings.anthropicApiKey,
        hasOpenaiKey: !!settings.openaiApiKey,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
}

// Helper to mask API keys for display
function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}
