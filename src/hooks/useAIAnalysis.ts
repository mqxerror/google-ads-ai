'use client';

import { useState, useCallback } from 'react';
import { CampaignData, AccountAnalysis, CampaignInsight, LLMProvider } from '@/lib/llm/types';

interface AIAnalysisState {
  isLoading: boolean;
  error: string | null;
  configuredProviders: LLMProvider[];
}

interface AccountAnalysisResult extends AIAnalysisState {
  analysis: AccountAnalysis | null;
}

interface CampaignInsightResult extends AIAnalysisState {
  insights: CampaignInsight[];
}

interface SuggestionsResult extends AIAnalysisState {
  suggestions: string | null;
}

export function useAIAnalysis() {
  const [state, setState] = useState<AIAnalysisState>({
    isLoading: false,
    error: null,
    configuredProviders: [],
  });

  // Check if AI is configured
  const checkConfiguration = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/analyze');
      const data = await response.json();

      if (data.configuredProviders) {
        setState(prev => ({
          ...prev,
          configuredProviders: data.configuredProviders,
        }));
        return data.configuredProviders.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Analyze account campaigns
  const analyzeAccount = useCallback(async (
    campaigns: CampaignData[],
    options?: { provider?: LLMProvider; model?: string }
  ): Promise<AccountAnalysis | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'account',
          campaigns,
          ...options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return data.analysis;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      return null;
    }
  }, []);

  // Analyze single campaign
  const analyzeCampaign = useCallback(async (
    campaign: CampaignData,
    options?: { provider?: LLMProvider; model?: string }
  ): Promise<CampaignInsight[]> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'campaign',
          campaign,
          ...options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return data.insights || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      return [];
    }
  }, []);

  // Get optimization suggestions
  const getSuggestions = useCallback(async (
    campaigns: CampaignData[],
    context?: string,
    options?: { provider?: LLMProvider; model?: string }
  ): Promise<string | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'suggestions',
          campaigns,
          context,
          ...options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get suggestions');
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return data.suggestions;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get suggestions';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      return null;
    }
  }, []);

  return {
    ...state,
    checkConfiguration,
    analyzeAccount,
    analyzeCampaign,
    getSuggestions,
  };
}

// Simpler hooks for specific use cases
export function useAccountAnalysis(campaigns: CampaignData[]): AccountAnalysisResult {
  const [analysis, setAnalysis] = useState<AccountAnalysis | null>(null);
  const { analyzeAccount, isLoading, error, configuredProviders } = useAIAnalysis();

  const analyze = useCallback(async () => {
    const result = await analyzeAccount(campaigns);
    setAnalysis(result);
  }, [campaigns, analyzeAccount]);

  return {
    analysis,
    isLoading,
    error,
    configuredProviders,
    analyze,
  } as AccountAnalysisResult & { analyze: () => Promise<void> };
}

export function useCampaignInsights(campaign: CampaignData): CampaignInsightResult {
  const [insights, setInsights] = useState<CampaignInsight[]>([]);
  const { analyzeCampaign, isLoading, error, configuredProviders } = useAIAnalysis();

  const analyze = useCallback(async () => {
    const result = await analyzeCampaign(campaign);
    setInsights(result);
  }, [campaign, analyzeCampaign]);

  return {
    insights,
    isLoading,
    error,
    configuredProviders,
    analyze,
  } as CampaignInsightResult & { analyze: () => Promise<void> };
}
