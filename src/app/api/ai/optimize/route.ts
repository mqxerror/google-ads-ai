import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateOptimizationPlan, suggestBidAdjustment } from '@/lib/llm/optimization-engine';
import { getUserConfiguredProviders, getUserApiKey } from '@/lib/llm/settings';
import { getConfiguredProviders, CampaignData, LLMProvider } from '@/lib/llm';

// POST /api/ai/optimize - Generate optimization plan
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

    // Get LLM configuration
    const userProviders = await getUserConfiguredProviders(user.id);
    const configuredProviders = userProviders.length > 0 ? userProviders : getConfiguredProviders();

    if (configuredProviders.length === 0) {
      return NextResponse.json(
        { error: 'No AI provider configured. Please add API keys in Settings.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      type = 'plan',
      campaigns,
      entity,
      targetMetric = 'conversions',
      constraints,
      targetCpa,
      provider,
    } = body as {
      type: 'plan' | 'bid';
      campaigns?: CampaignData[];
      entity?: {
        type: 'campaign' | 'ad_group' | 'keyword';
        id: string;
        name: string;
        currentBid?: number;
        spend: number;
        clicks: number;
        conversions: number;
        ctr: number;
        qualityScore?: number;
      };
      targetMetric?: 'conversions' | 'roas' | 'cpa' | 'efficiency';
      constraints?: {
        maxBudgetChange?: number;
        preserveCampaigns?: string[];
        aggressiveness?: 'conservative' | 'moderate' | 'aggressive';
      };
      targetCpa?: number;
      provider?: LLMProvider;
    };

    const selectedProvider = provider || configuredProviders[0];
    let apiKey: string | undefined;
    if (userProviders.includes(selectedProvider)) {
      apiKey = (await getUserApiKey(user.id, selectedProvider)) || undefined;
    }

    const config = { provider: selectedProvider, apiKey };

    if (type === 'plan') {
      if (!campaigns || campaigns.length === 0) {
        return NextResponse.json({ error: 'No campaign data provided' }, { status: 400 });
      }

      const plan = await generateOptimizationPlan(campaigns, targetMetric, constraints, config);

      return NextResponse.json({
        success: true,
        type: 'optimization_plan',
        plan,
        provider: selectedProvider,
      });
    } else if (type === 'bid') {
      if (!entity) {
        return NextResponse.json({ error: 'No entity data provided' }, { status: 400 });
      }

      const recommendation = await suggestBidAdjustment(entity, targetCpa, config);

      return NextResponse.json({
        success: true,
        type: 'bid_recommendation',
        recommendation,
        provider: selectedProvider,
      });
    }

    return NextResponse.json({ error: 'Invalid optimization type' }, { status: 400 });
  } catch (error) {
    console.error('Error in AI optimization:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Optimization failed' },
      { status: 500 }
    );
  }
}
