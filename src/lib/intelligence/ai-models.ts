/**
 * AI Model Configuration
 *
 * Centralized configuration for AI models used across Intelligence features.
 * Easily switch between providers (OpenRouter, Anthropic, OpenAI) and models.
 */

export interface AIModel {
  id: string;
  name: string;
  provider: 'openrouter' | 'anthropic' | 'openai';
  modelId: string;
  inputCostPer1M: number;  // Cost per 1M input tokens
  outputCostPer1M: number; // Cost per 1M output tokens
  maxTokens: number;
  description: string;
}

// Available models
export const AI_MODELS: Record<string, AIModel> = {
  // OpenRouter models (cheaper)
  'opus-4.5-openrouter': {
    id: 'opus-4.5-openrouter',
    name: 'Claude Opus 4.5 (OpenRouter)',
    provider: 'openrouter',
    modelId: 'anthropic/claude-opus-4',
    inputCostPer1M: 15,
    outputCostPer1M: 75,
    maxTokens: 8000,
    description: 'Most capable model via OpenRouter - best for complex analysis',
  },
  'sonnet-4-openrouter': {
    id: 'sonnet-4-openrouter',
    name: 'Claude Sonnet 4 (OpenRouter)',
    provider: 'openrouter',
    modelId: 'anthropic/claude-sonnet-4',
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    maxTokens: 8000,
    description: 'Fast and capable via OpenRouter',
  },
  'haiku-openrouter': {
    id: 'haiku-openrouter',
    name: 'Claude Haiku (OpenRouter)',
    provider: 'openrouter',
    modelId: 'anthropic/claude-3-haiku',
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    maxTokens: 4000,
    description: 'Fast and cheap for simple tasks',
  },
  // Direct Anthropic models
  'sonnet-4-anthropic': {
    id: 'sonnet-4-anthropic',
    name: 'Claude Sonnet 4 (Direct)',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    maxTokens: 8000,
    description: 'Direct Anthropic API',
  },
};

// Default models for each task type
export const DEFAULT_MODELS = {
  brandDna: 'opus-4.5-openrouter',      // Use Opus for comprehensive brand analysis
  audienceDna: 'opus-4.5-openrouter',   // Use Opus for detailed persona generation
  competitorDna: 'sonnet-4-openrouter', // Sonnet is good enough for competitor analysis
  adCopy: 'sonnet-4-openrouter',        // Sonnet for ad copy generation
  keywords: 'haiku-openrouter',         // Haiku for quick keyword tasks
};

// Get model configuration
export function getModel(modelId: string): AIModel {
  const model = AI_MODELS[modelId];
  if (!model) {
    console.warn(`[AI Models] Unknown model: ${modelId}, falling back to sonnet-4-openrouter`);
    return AI_MODELS['sonnet-4-openrouter'];
  }
  return model;
}

// Get default model for a task
export function getDefaultModel(taskType: keyof typeof DEFAULT_MODELS): AIModel {
  const modelId = DEFAULT_MODELS[taskType];
  return getModel(modelId);
}

// Calculate cost from token usage
export function calculateCost(model: AIModel, inputTokens: number, outputTokens: number): number {
  return (inputTokens * model.inputCostPer1M + outputTokens * model.outputCostPer1M) / 1_000_000;
}

/**
 * Call AI model via appropriate provider
 */
export async function callAI(
  modelId: string,
  prompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}> {
  const model = getModel(modelId);
  const maxTokens = options.maxTokens || model.maxTokens;

  if (model.provider === 'openrouter') {
    return callOpenRouter(model, prompt, maxTokens);
  } else if (model.provider === 'anthropic') {
    return callAnthropic(model, prompt, maxTokens);
  } else {
    throw new Error(`Unsupported provider: ${model.provider}`);
  }
}

// OpenRouter API call
async function callOpenRouter(
  model: AIModel,
  prompt: string,
  maxTokens: number
): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  console.log(`[AI Models] Calling OpenRouter with model: ${model.modelId}`);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
      'X-Title': 'Quick Ads AI Intelligence',
    },
    body: JSON.stringify({
      model: model.modelId,
      max_tokens: maxTokens,
      messages: [
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[AI Models] OpenRouter error:`, error);
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost = calculateCost(model, inputTokens, outputTokens);

  console.log(`[AI Models] Response received. Tokens: ${inputTokens} in, ${outputTokens} out. Cost: $${cost.toFixed(4)}`);

  return {
    text,
    inputTokens,
    outputTokens,
    cost,
    model: model.name,
  };
}

// Direct Anthropic API call
async function callAnthropic(
  model: AIModel,
  prompt: string,
  maxTokens: number
): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log(`[AI Models] Calling Anthropic with model: ${model.modelId}`);

  const response = await anthropic.messages.create({
    model: model.modelId,
    max_tokens: maxTokens,
    messages: [
      { role: 'user', content: prompt }
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const cost = calculateCost(model, inputTokens, outputTokens);

  console.log(`[AI Models] Response received. Tokens: ${inputTokens} in, ${outputTokens} out. Cost: $${cost.toFixed(4)}`);

  return {
    text,
    inputTokens,
    outputTokens,
    cost,
    model: model.name,
  };
}

// Check if OpenRouter is configured
export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

// Check if Anthropic is configured
export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
