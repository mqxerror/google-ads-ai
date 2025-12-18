import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createCampaignFromPrompt,
  refineCampaign,
  generateAdVariations,
  generateKeywordIdeas,
  campaignAssistantChat,
  GeneratedCampaign,
  ChatMessage,
} from '@/lib/llm/campaign-creator';
import { getUserConfiguredProviders, getUserApiKey } from '@/lib/llm/settings';
import { getConfiguredProviders, LLMProvider } from '@/lib/llm';

// POST /api/ai/campaign-creator
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
    const { type, provider } = body as {
      type: 'create' | 'refine' | 'ads' | 'keywords' | 'chat';
      provider?: LLMProvider;
    };

    const selectedProvider = provider || configuredProviders[0];
    let apiKey: string | undefined;
    if (userProviders.includes(selectedProvider)) {
      apiKey = (await getUserApiKey(user.id, selectedProvider)) || undefined;
    }

    const config = { provider: selectedProvider, apiKey };

    switch (type) {
      case 'create': {
        const { prompt, accountId, existingCampaigns } = body as {
          prompt: string;
          accountId?: string;
          existingCampaigns?: Array<{ name: string; type: string }>;
        };

        if (!prompt) {
          return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
        }

        const result = await createCampaignFromPrompt(
          { userPrompt: prompt, accountId, existingCampaigns },
          config
        );

        return NextResponse.json({
          success: true,
          type: 'campaign_created',
          result,
          provider: selectedProvider,
        });
      }

      case 'refine': {
        const { campaign, feedback } = body as {
          campaign: GeneratedCampaign;
          feedback: string;
        };

        if (!campaign || !feedback) {
          return NextResponse.json(
            { error: 'Campaign and feedback are required' },
            { status: 400 }
          );
        }

        const result = await refineCampaign(campaign, feedback, config);

        return NextResponse.json({
          success: true,
          type: 'campaign_refined',
          result,
          provider: selectedProvider,
        });
      }

      case 'ads': {
        const { productOrService, landingPageUrl, existingAds, count } = body as {
          productOrService: string;
          landingPageUrl: string;
          existingAds?: Array<{
            headlines: string[];
            descriptions: string[];
            finalUrl: string;
          }>;
          count?: number;
        };

        if (!productOrService || !landingPageUrl) {
          return NextResponse.json(
            { error: 'Product/service and landing page URL are required' },
            { status: 400 }
          );
        }

        const ads = await generateAdVariations(
          productOrService,
          landingPageUrl,
          existingAds,
          count,
          config
        );

        return NextResponse.json({
          success: true,
          type: 'ads_generated',
          ads,
          provider: selectedProvider,
        });
      }

      case 'keywords': {
        const { topic, existingKeywords, count } = body as {
          topic: string;
          existingKeywords?: string[];
          count?: number;
        };

        if (!topic) {
          return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }

        const keywords = await generateKeywordIdeas(topic, existingKeywords, count, config);

        return NextResponse.json({
          success: true,
          type: 'keywords_generated',
          keywords,
          provider: selectedProvider,
        });
      }

      case 'chat': {
        const { messages, campaignContext } = body as {
          messages: ChatMessage[];
          campaignContext?: GeneratedCampaign;
        };

        if (!messages || messages.length === 0) {
          return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
        }

        const result = await campaignAssistantChat(messages, campaignContext, config);

        return NextResponse.json({
          success: true,
          type: 'chat_response',
          ...result,
          provider: selectedProvider,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in campaign creator:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Campaign creation failed' },
      { status: 500 }
    );
  }
}
