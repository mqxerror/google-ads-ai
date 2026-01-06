/**
 * AI Model Configuration
 * Centralized configuration for all AI model usage across the app
 */

export const AI_MODELS = {
  // Claude Opus 4.5 - Most capable, best for complex analysis
  OPUS_4_5: 'claude-opus-4-5-20251101',

  // Claude Sonnet 4 - Balanced performance and cost
  SONNET_4: 'claude-sonnet-4-20250514',

  // Claude Haiku 3.5 - Fast and cost-effective
  HAIKU_3_5: 'claude-3-5-haiku-latest',

  // Legacy models
  SONNET_3_5: 'claude-3-5-sonnet-20241022',
} as const;

export type AIModelId = typeof AI_MODELS[keyof typeof AI_MODELS];

// Default model for different use cases
export const DEFAULT_MODELS = {
  // Insight Hub chat - uses most capable model for complex analysis
  INSIGHT_HUB_CHAT: AI_MODELS.OPUS_4_5,

  // Ad copy generation
  AD_COPY_GENERATION: AI_MODELS.SONNET_4,

  // Quick tasks (keyword clustering, simple analysis)
  QUICK_TASKS: AI_MODELS.HAIKU_3_5,
} as const;

// Model metadata for UI display
export const MODEL_INFO: Record<AIModelId, { name: string; description: string; costTier: 'high' | 'medium' | 'low' }> = {
  [AI_MODELS.OPUS_4_5]: {
    name: 'Claude Opus 4.5',
    description: 'Most capable model for complex analysis and reasoning',
    costTier: 'high',
  },
  [AI_MODELS.SONNET_4]: {
    name: 'Claude Sonnet 4',
    description: 'Balanced performance and cost',
    costTier: 'medium',
  },
  [AI_MODELS.HAIKU_3_5]: {
    name: 'Claude Haiku 3.5',
    description: 'Fast and cost-effective for simple tasks',
    costTier: 'low',
  },
  [AI_MODELS.SONNET_3_5]: {
    name: 'Claude Sonnet 3.5 (Legacy)',
    description: 'Previous generation Sonnet',
    costTier: 'medium',
  },
};

// Anthropic API configuration
export const ANTHROPIC_CONFIG = {
  baseUrl: 'https://api.anthropic.com/v1/messages',
  version: '2023-06-01',
  defaultMaxTokens: 2048,
} as const;
