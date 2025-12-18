// LLM Provider Manager
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import {
  LLMProvider,
  LLMConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  ILLMProvider,
  DEFAULT_MODELS,
  PROVIDER_NAMES,
  AVAILABLE_MODELS,
  CampaignData,
  CampaignInsight,
  AccountAnalysis,
} from './types';

export * from './types';

// Provider factory
function createProvider(config: LLMConfig): ILLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model);
    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// Get configured providers from environment (Anthropic is always first/default)
export function getConfiguredProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  // Check for non-empty API keys (Anthropic is the preferred/default provider)
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  if (anthropicKey && anthropicKey.length > 0) {
    providers.push('anthropic');
  }
  if (openaiKey && openaiKey.length > 0) {
    providers.push('openai');
  }

  // If both are configured, ensure Anthropic is first
  if (providers.includes('anthropic') && providers.includes('openai')) {
    return ['anthropic', 'openai'];
  }

  return providers;
}

// Get default provider (first configured one)
export function getDefaultProvider(): LLMProvider | null {
  const configured = getConfiguredProviders();
  return configured[0] || null;
}

// LLM Service class
export class LLMService {
  private provider: ILLMProvider;
  private config: LLMConfig;

  constructor(config?: Partial<LLMConfig>) {
    const defaultProvider = getDefaultProvider();
    if (!defaultProvider && !config?.provider) {
      throw new Error('No LLM provider configured. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
    }

    const provider = config?.provider || defaultProvider!;
    this.config = {
      provider,
      model: config?.model || DEFAULT_MODELS[provider],
      apiKey: config?.apiKey,
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 4096,
    };

    this.provider = createProvider(this.config);
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    return this.provider.complete({
      ...request,
      temperature: request.temperature ?? this.config.temperature,
      maxTokens: request.maxTokens ?? this.config.maxTokens,
    });
  }

  async *streamComplete(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk> {
    if (!this.provider.streamComplete) {
      throw new Error('Streaming not supported by this provider');
    }
    yield* this.provider.streamComplete({
      ...request,
      temperature: request.temperature ?? this.config.temperature,
      maxTokens: request.maxTokens ?? this.config.maxTokens,
    });
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  getProviderName(): string {
    return PROVIDER_NAMES[this.config.provider];
  }

  getModel(): string {
    return this.config.model;
  }
}

// ============================================
// Campaign Analysis Functions
// ============================================

const CAMPAIGN_ANALYSIS_PROMPT = `You are an expert Google Ads analyst. Analyze the following campaign data and provide actionable insights.

For each insight, categorize it as:
- opportunity: Untapped potential for improvement
- warning: Issues that need attention
- success: Things that are working well
- info: General observations

Rate the impact as high, medium, or low based on potential revenue/efficiency impact.

Respond with valid JSON only, no markdown. Use this exact format:
{
  "summary": "Brief 1-2 sentence overview of account health",
  "overallHealth": "excellent" | "good" | "fair" | "poor",
  "insights": [
    {
      "type": "opportunity" | "warning" | "success" | "info",
      "title": "Brief title",
      "description": "Detailed explanation",
      "impact": "high" | "medium" | "low",
      "actionable": true | false,
      "suggestedAction": "What to do (if actionable)",
      "metrics": {"key": "value"}
    }
  ],
  "recommendations": ["Top priority recommendation 1", "..."],
  "topPerformers": ["Campaign name 1", "..."],
  "underperformers": ["Campaign name 1", "..."]
}`;

export async function analyzeCampaigns(
  campaigns: CampaignData[],
  config?: Partial<LLMConfig>
): Promise<AccountAnalysis> {
  const service = new LLMService(config);

  // Prepare campaign summary for analysis
  const campaignSummary = campaigns.map(c => ({
    name: c.name,
    status: c.status,
    type: c.type,
    spend: `$${c.spend.toFixed(2)}`,
    clicks: c.clicks,
    impressions: c.impressions,
    conversions: c.conversions,
    ctr: `${c.ctr.toFixed(2)}%`,
    cpa: c.cpa > 0 ? `$${c.cpa.toFixed(2)}` : 'N/A',
    roas: c.roas > 0 ? `${c.roas.toFixed(2)}x` : 'N/A',
    aiScore: c.aiScore,
  }));

  // Calculate account-level metrics
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

  const accountMetrics = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'ENABLED').length,
    pausedCampaigns: campaigns.filter(c => c.status === 'PAUSED').length,
    totalSpend: `$${totalSpend.toFixed(2)}`,
    totalConversions: totalConversions.toFixed(0),
    totalClicks,
    totalImpressions,
    avgCTR: `${avgCTR.toFixed(2)}%`,
    avgCPA: avgCPA > 0 ? `$${avgCPA.toFixed(2)}` : 'N/A',
  };

  const response = await service.complete({
    messages: [
      { role: 'system', content: CAMPAIGN_ANALYSIS_PROMPT },
      {
        role: 'user',
        content: `Account Overview:
${JSON.stringify(accountMetrics, null, 2)}

Campaign Data:
${JSON.stringify(campaignSummary, null, 2)}

Analyze this data and provide insights in JSON format.`,
      },
    ],
    temperature: 0.3, // Lower temperature for more consistent structured output
  });

  try {
    // Parse the JSON response
    const analysis: AccountAnalysis = JSON.parse(response.content);
    return analysis;
  } catch {
    // If parsing fails, return a default structure
    console.error('Failed to parse LLM response:', response.content);
    return {
      summary: 'Unable to analyze campaigns at this time.',
      overallHealth: 'fair',
      insights: [],
      recommendations: ['Please try again later or check your API configuration.'],
      topPerformers: [],
      underperformers: [],
    };
  }
}

// Generate a single campaign insight
export async function generateCampaignInsight(
  campaign: CampaignData,
  config?: Partial<LLMConfig>
): Promise<CampaignInsight[]> {
  const service = new LLMService(config);

  const prompt = `Analyze this Google Ads campaign and provide 2-3 actionable insights:

Campaign: ${campaign.name}
Status: ${campaign.status}
Type: ${campaign.type}
Spend: $${campaign.spend.toFixed(2)}
Clicks: ${campaign.clicks}
Impressions: ${campaign.impressions}
Conversions: ${campaign.conversions}
CTR: ${campaign.ctr.toFixed(2)}%
CPA: ${campaign.cpa > 0 ? `$${campaign.cpa.toFixed(2)}` : 'N/A'}
ROAS: ${campaign.roas > 0 ? `${campaign.roas.toFixed(2)}x` : 'N/A'}
AI Score: ${campaign.aiScore}/100

Respond with valid JSON only - an array of insights:
[{"type": "opportunity|warning|success|info", "title": "...", "description": "...", "impact": "high|medium|low", "actionable": true|false, "suggestedAction": "..."}]`;

  const response = await service.complete({
    messages: [
      { role: 'system', content: 'You are a Google Ads expert. Provide actionable insights in JSON format only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 1024,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Generate optimization suggestions
export async function generateOptimizationSuggestions(
  campaigns: CampaignData[],
  context?: string,
  config?: Partial<LLMConfig>
): Promise<string> {
  const service = new LLMService(config);

  const prompt = `Based on this Google Ads data, provide specific optimization recommendations.
${context ? `Additional context: ${context}` : ''}

Campaigns:
${campaigns.map(c => `- ${c.name}: $${c.spend.toFixed(2)} spend, ${c.conversions} conversions, ${c.ctr.toFixed(2)}% CTR, Score: ${c.aiScore}`).join('\n')}

Provide 3-5 specific, actionable recommendations. Be concise.`;

  const response = await service.complete({
    messages: [
      { role: 'system', content: 'You are a Google Ads optimization expert. Provide clear, actionable advice.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    maxTokens: 1024,
  });

  return response.content;
}
