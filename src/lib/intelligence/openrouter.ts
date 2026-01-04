/**
 * OpenRouter AI Integration
 *
 * Unified API gateway for multiple AI models (Claude, GPT-4, Llama, etc.)
 * Compatible with OpenAI SDK format
 *
 * Pricing (as of Jan 2026):
 * - anthropic/claude-3.5-sonnet: $3/M input, $15/M output
 * - anthropic/claude-3-haiku: $0.25/M input, $1.25/M output
 * - openai/gpt-4o: $2.5/M input, $10/M output
 * - openai/gpt-4o-mini: $0.15/M input, $0.60/M output
 */

export type OpenRouterModel =
  | 'anthropic/claude-3.5-sonnet'
  | 'anthropic/claude-3-haiku'
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'perplexity/llama-3.1-sonar-large-128k-online'  // For web search
  | 'google/gemini-pro-1.5';

interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
}

const MODEL_PRICING: Record<OpenRouterModel, ModelPricing> = {
  'anthropic/claude-3.5-sonnet': { inputPerM: 3, outputPerM: 15 },
  'anthropic/claude-3-haiku': { inputPerM: 0.25, outputPerM: 1.25 },
  'openai/gpt-4o': { inputPerM: 2.5, outputPerM: 10 },
  'openai/gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.60 },
  'perplexity/llama-3.1-sonar-large-128k-online': { inputPerM: 1, outputPerM: 1 },
  'google/gemini-pro-1.5': { inputPerM: 1.25, outputPerM: 5 },
};

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionOptions {
  model?: OpenRouterModel;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

class OpenRouterClient {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private defaultModel: OpenRouterModel;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.defaultModel = (process.env.OPENROUTER_DEFAULT_MODEL as OpenRouterModel) || 'anthropic/claude-3.5-sonnet';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async chat(options: ChatCompletionOptions): Promise<ChatResult> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.local');
    }

    const model = options.model || this.defaultModel;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'Quick Ads AI - Intelligence',
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data: OpenRouterResponse = await response.json();

    const pricing = MODEL_PRICING[model as OpenRouterModel] || { inputPerM: 3, outputPerM: 15 };
    const estimatedCost =
      (data.usage.prompt_tokens / 1_000_000) * pricing.inputPerM +
      (data.usage.completion_tokens / 1_000_000) * pricing.outputPerM;

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        estimatedCost,
      },
    };
  }

  // Quick helper for simple prompts
  async complete(prompt: string, options?: Partial<ChatCompletionOptions>): Promise<ChatResult> {
    return this.chat({
      messages: [{ role: 'user', content: prompt }],
      ...options,
    });
  }

  // Use Haiku for cheap extraction tasks
  async extractWithHaiku(prompt: string): Promise<ChatResult> {
    return this.chat({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
  }

  // Use Sonnet for complex synthesis
  async synthesizeWithSonnet(systemPrompt: string, userPrompt: string): Promise<ChatResult> {
    return this.chat({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });
  }

  // Calculate estimated cost for a task
  estimateCost(inputTokens: number, outputTokens: number, model: OpenRouterModel = 'anthropic/claude-3.5-sonnet'): number {
    const pricing = MODEL_PRICING[model];
    return (inputTokens / 1_000_000) * pricing.inputPerM +
           (outputTokens / 1_000_000) * pricing.outputPerM;
  }
}

// Singleton instance
export const openrouter = new OpenRouterClient();

// Helper function for structured JSON responses
export async function getStructuredResponse<T>(
  prompt: string,
  schema: string,
  model: OpenRouterModel = 'anthropic/claude-3.5-sonnet'
): Promise<{ data: T; usage: ChatResult['usage'] }> {
  const result = await openrouter.chat({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant that responds ONLY with valid JSON matching this schema:\n${schema}\n\nDo not include any text before or after the JSON.`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  });

  try {
    // Clean response - remove markdown code blocks if present
    let jsonStr = result.content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }

    const data = JSON.parse(jsonStr.trim()) as T;
    return { data, usage: result.usage };
  } catch (e) {
    throw new Error(`Failed to parse JSON response: ${result.content}`);
  }
}
