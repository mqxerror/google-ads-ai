import { prisma } from '@/lib/prisma';
import { LLMProvider } from './types';

export interface UserLLMSettings {
  anthropicApiKey: string | null;
  openaiApiKey: string | null;
  defaultLlmProvider: LLMProvider;
}

// Get user's LLM settings from database
export async function getUserLLMSettings(userId: string): Promise<UserLLMSettings | null> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    return null;
  }

  return {
    anthropicApiKey: settings.anthropicApiKey,
    openaiApiKey: settings.openaiApiKey,
    defaultLlmProvider: settings.defaultLlmProvider as LLMProvider,
  };
}

// Get user's configured providers (from database)
export async function getUserConfiguredProviders(userId: string): Promise<LLMProvider[]> {
  const settings = await getUserLLMSettings(userId);
  const providers: LLMProvider[] = [];

  if (settings?.anthropicApiKey?.trim()) {
    providers.push('anthropic');
  }
  if (settings?.openaiApiKey?.trim()) {
    providers.push('openai');
  }

  // Ensure default provider is first if both are configured
  if (providers.includes('anthropic') && providers.includes('openai')) {
    if (settings?.defaultLlmProvider === 'openai') {
      return ['openai', 'anthropic'];
    }
    return ['anthropic', 'openai'];
  }

  return providers;
}

// Get API key for a specific provider
export async function getUserApiKey(userId: string, provider: LLMProvider): Promise<string | null> {
  const settings = await getUserLLMSettings(userId);
  if (!settings) return null;

  return provider === 'anthropic' ? settings.anthropicApiKey : settings.openaiApiKey;
}
