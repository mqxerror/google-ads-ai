// LLM Provider Types

export type LLMProvider = 'anthropic' | 'openai';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string; // Optional - can use env vars
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

// Campaign Analysis Types
export interface CampaignData {
  id: string;
  name: string;
  status: string;
  type: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
  aiScore: number;
}

export interface CampaignInsight {
  type: 'opportunity' | 'warning' | 'success' | 'info';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestedAction?: string;
  metrics?: Record<string, number | string>;
}

export interface AccountAnalysis {
  summary: string;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  insights: CampaignInsight[];
  recommendations: string[];
  topPerformers: string[];
  underperformers: string[];
}

// Provider Interface
export interface ILLMProvider {
  name: LLMProvider;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  streamComplete?(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk>;
  isConfigured(): boolean;
}

// Task complexity levels for smart model routing
export type TaskComplexity = 'simple' | 'moderate' | 'complex';

// Task types for automatic model selection
export type TaskType =
  | 'formatting'        // Simple text formatting, JSON parsing
  | 'summarization'     // Summarizing data
  | 'classification'    // Categorizing/classifying items
  | 'analysis'          // Analyzing campaign data
  | 'recommendation'    // Generating recommendations
  | 'strategy'          // Strategic planning
  | 'conversation';     // Chat/conversation

// Map task types to complexity
export const TASK_COMPLEXITY_MAP: Record<TaskType, TaskComplexity> = {
  formatting: 'simple',
  summarization: 'simple',
  classification: 'simple',
  analysis: 'moderate',
  recommendation: 'moderate',
  strategy: 'complex',
  conversation: 'moderate',
};

// Default models
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
};

// Models by complexity - use cheaper models for simpler tasks
export const MODELS_BY_COMPLEXITY: Record<LLMProvider, Record<TaskComplexity, string>> = {
  anthropic: {
    simple: 'claude-3-5-haiku-20241022',    // Fast & cheap for simple tasks
    moderate: 'claude-sonnet-4-20250514',    // Balanced for analysis
    complex: 'claude-opus-4-20250514',       // Most capable for strategy
  },
  openai: {
    simple: 'gpt-4o-mini',                   // Fast & cheap for simple tasks
    moderate: 'gpt-4o',                      // Balanced for analysis
    complex: 'gpt-4o',                       // Best available for complex tasks
  },
};

// Provider display names
export const PROVIDER_NAMES: Record<LLMProvider, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI GPT',
};

// Available models per provider
export const AVAILABLE_MODELS: Record<LLMProvider, { id: string; name: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
};

/**
 * Get the appropriate model for a task type
 */
export function getModelForTask(provider: LLMProvider, taskType: TaskType): string {
  const complexity = TASK_COMPLEXITY_MAP[taskType];
  return MODELS_BY_COMPLEXITY[provider][complexity];
}

/**
 * Get the appropriate model for a complexity level
 */
export function getModelForComplexity(provider: LLMProvider, complexity: TaskComplexity): string {
  return MODELS_BY_COMPLEXITY[provider][complexity];
}
