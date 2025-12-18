import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  analyzeCampaigns,
  generateCampaignInsight,
  generateOptimizationSuggestions,
  getConfiguredProviders,
  LLMProvider,
  CampaignData,
} from '@/lib/llm';
import { getUserConfiguredProviders, getUserApiKey, getUserLLMSettings } from '@/lib/llm/settings';

// GET /api/ai/analyze?type=account|campaign|suggestions&accountId=xxx
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // First check user's database settings
    const userProviders = await getUserConfiguredProviders(user.id);

    // Fall back to environment variables if no user settings
    const configuredProviders = userProviders.length > 0 ? userProviders : getConfiguredProviders();

    if (configuredProviders.length === 0) {
      return NextResponse.json(
        {
          error: 'No AI provider configured',
          message: 'Please configure your API keys in Settings.',
          configuredProviders: [],
        },
        { status: 503 }
      );
    }

    // Return provider info
    return NextResponse.json({
      success: true,
      configuredProviders,
      defaultProvider: configuredProviders[0],
      message: 'AI analysis endpoint ready. Use POST to submit campaign data for analysis.',
    });
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI analysis failed' },
      { status: 500 }
    );
  }
}

// POST /api/ai/analyze - Submit campaign data for analysis
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's LLM settings from database
    const userSettings = await getUserLLMSettings(user.id);
    const userProviders = await getUserConfiguredProviders(user.id);

    // Fall back to environment variables if no user settings
    const configuredProviders = userProviders.length > 0 ? userProviders : getConfiguredProviders();

    if (configuredProviders.length === 0) {
      return NextResponse.json(
        {
          error: 'No AI provider configured',
          message: 'Please configure your API keys in Settings.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      type = 'account',
      campaigns,
      campaign,
      context,
      provider,
      model,
    } = body as {
      type: 'account' | 'campaign' | 'suggestions';
      campaigns?: CampaignData[];
      campaign?: CampaignData;
      context?: string;
      provider?: LLMProvider;
      model?: string;
    };

    // Determine which provider to use
    const selectedProvider = provider || configuredProviders[0];

    // Get API key - first from user settings, then from environment
    let apiKey: string | undefined;
    if (userProviders.includes(selectedProvider)) {
      apiKey = (await getUserApiKey(user.id, selectedProvider)) || undefined;
    }
    // If no user key, the LLMService will use environment variable

    const config = {
      provider: selectedProvider,
      model,
      apiKey,
    };

    switch (type) {
      case 'account': {
        if (!campaigns || campaigns.length === 0) {
          return NextResponse.json(
            { error: 'No campaign data provided' },
            { status: 400 }
          );
        }

        const analysis = await analyzeCampaigns(campaigns, config);
        return NextResponse.json({
          success: true,
          type: 'account',
          analysis,
          provider: config.provider,
        });
      }

      case 'campaign': {
        if (!campaign) {
          return NextResponse.json(
            { error: 'No campaign data provided' },
            { status: 400 }
          );
        }

        const insights = await generateCampaignInsight(campaign, config);
        return NextResponse.json({
          success: true,
          type: 'campaign',
          insights,
          provider: config.provider,
        });
      }

      case 'suggestions': {
        if (!campaigns || campaigns.length === 0) {
          return NextResponse.json(
            { error: 'No campaign data provided' },
            { status: 400 }
          );
        }

        const suggestions = await generateOptimizationSuggestions(campaigns, context, config);
        return NextResponse.json({
          success: true,
          type: 'suggestions',
          suggestions,
          provider: config.provider,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid analysis type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI analysis failed' },
      { status: 500 }
    );
  }
}
