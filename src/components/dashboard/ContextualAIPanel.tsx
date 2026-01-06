'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useContextualPrompts, buildContextString, type ContextData } from '@/hooks/useContextualPrompts';
import { useCampaignsStore } from '@/stores/campaigns-store';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStats } from '@/hooks/useCampaigns';

interface ContextualAIPanelProps {
  context?: Partial<ContextData>;
  compact?: boolean;
}

export default function ContextualAIPanel({ context, compact = false }: ContextualAIPanelProps) {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Get data from store for context
  const campaigns = useCampaignsStore(useShallow((state) => state.campaigns));
  const { totalSpend, totalConversions, wasterCount } = useDashboardStats();

  // Build full context
  const fullContext: ContextData = {
    view: context?.view || 'dashboard',
    campaign: context?.campaign,
    adGroupName: context?.adGroupName,
    campaigns,
    wasterCount,
    topPerformerCount: campaigns.filter(c => (c.aiScore ?? 0) >= 70).length,
    totalSpend,
    totalConversions,
  };

  const suggestedPrompts = useContextualPrompts(fullContext);

  // Build URL with context for Insight Hub
  const buildInsightHubUrl = useCallback((prompt?: string) => {
    const params = new URLSearchParams();
    if (prompt) params.set('q', prompt);
    params.set('ctx', fullContext.view);
    if (fullContext.campaign) params.set('cid', fullContext.campaign.id.toString());
    return `/command?${params.toString()}`;
  }, [fullContext]);

  const handlePromptClick = (prompt: string) => {
    // Navigate to Insight Hub with the prompt pre-filled
    window.location.href = buildInsightHubUrl(prompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      window.location.href = buildInsightHubUrl(input.trim());
    }
  };

  if (compact) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <h3 className="font-semibold text-text text-sm">AI Copilot</h3>
          </div>
          <Link
            href="/command"
            className="text-xs text-accent hover:underline"
          >
            Open Hub →
          </Link>
        </div>

        {/* Suggested prompts */}
        <div className="space-y-2">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handlePromptClick(prompt.text)}
              className="w-full flex items-center gap-2 p-2 rounded-lg bg-surface2 hover:bg-divider transition-colors text-left group"
            >
              <span className="text-sm">{prompt.icon}</span>
              <span className="text-xs text-text2 group-hover:text-text flex-1 truncate">
                {prompt.text}
              </span>
              <svg className="w-3 h-3 text-text3 group-hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-divider bg-gradient-to-r from-accent/5 to-indigo-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-indigo-500 flex items-center justify-center">
              <span className="text-white text-sm">🧠</span>
            </div>
            <div>
              <h3 className="font-semibold text-text">AI Copilot</h3>
              <p className="text-xs text-text3">Ask anything about your campaigns</p>
            </div>
          </div>
          <Link
            href="/command"
            className="px-3 py-1.5 bg-accent/10 text-accent text-xs font-medium rounded-full hover:bg-accent/20 transition-colors"
          >
            Full Hub →
          </Link>
        </div>
      </div>

      {/* Context indicator */}
      {fullContext.campaign && (
        <div className="px-4 py-2 bg-surface2/50 border-b border-divider flex items-center gap-2">
          <span className="text-xs text-text3">Context:</span>
          <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full">
            {fullContext.campaign.name}
          </span>
        </div>
      )}

      {/* Suggested prompts */}
      <div className="p-4 space-y-2">
        <p className="text-xs text-text3 mb-3">Suggested questions:</p>
        {suggestedPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handlePromptClick(prompt.text)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface2 hover:bg-divider transition-colors text-left group"
          >
            <span className="text-lg">{prompt.icon}</span>
            <span className="text-sm text-text2 group-hover:text-text flex-1">
              {prompt.text}
            </span>
            <svg className="w-4 h-4 text-text3 group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        ))}
      </div>

      {/* Quick input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-divider bg-surface2/30">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Or type your own question..."
            className="flex-1 px-3 py-2 bg-surface border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
