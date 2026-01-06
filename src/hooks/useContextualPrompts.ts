'use client';

import { useMemo } from 'react';
import { Campaign } from '@/types/campaign';

export type ViewContext =
  | 'dashboard'
  | 'campaign_detail'
  | 'ad_group'
  | 'keywords'
  | 'spend_shield'
  | 'keyword_factory';

export interface ContextData {
  view: ViewContext;
  campaign?: Campaign | null;
  adGroupName?: string;
  campaigns?: Campaign[];
  wasterCount?: number;
  topPerformerCount?: number;
  totalSpend?: number;
  totalConversions?: number;
}

export interface SuggestedPrompt {
  text: string;
  icon: string;
  priority: number;
}

// Generate contextual prompts based on current view and data
export function useContextualPrompts(context: ContextData): SuggestedPrompt[] {
  return useMemo(() => {
    const prompts: SuggestedPrompt[] = [];

    switch (context.view) {
      case 'dashboard':
        // Dashboard-level prompts
        if (context.wasterCount && context.wasterCount > 0) {
          prompts.push({
            text: `Why are ${context.wasterCount} campaigns underperforming?`,
            icon: '🔍',
            priority: 1,
          });
          prompts.push({
            text: 'What keywords should I add as negatives?',
            icon: '🚫',
            priority: 2,
          });
        }

        if (context.totalSpend && context.totalSpend > 0) {
          prompts.push({
            text: 'Where is my budget being wasted?',
            icon: '💸',
            priority: 3,
          });
          prompts.push({
            text: 'How can I improve my ROAS?',
            icon: '📈',
            priority: 4,
          });
        }

        if (context.topPerformerCount && context.topPerformerCount > 0) {
          prompts.push({
            text: 'What makes my top campaigns successful?',
            icon: '⭐',
            priority: 5,
          });
        }

        prompts.push({
          text: 'Give me a daily performance summary',
          icon: '📊',
          priority: 6,
        });
        break;

      case 'campaign_detail':
        if (context.campaign) {
          const c = context.campaign;
          prompts.push({
            text: `Why is "${c.name}" ${(c.aiScore ?? 100) < 40 ? 'underperforming' : 'performing well'}?`,
            icon: '🔍',
            priority: 1,
          });

          if ((c.aiScore ?? 100) < 60) {
            prompts.push({
              text: `How can I improve "${c.name}"'s score?`,
              icon: '📈',
              priority: 2,
            });
          }

          prompts.push({
            text: `What search terms triggered "${c.name}"?`,
            icon: '🔎',
            priority: 3,
          });

          if (c.spend && c.spend > 0) {
            prompts.push({
              text: `Is "${c.name}"'s budget optimal?`,
              icon: '💰',
              priority: 4,
            });
          }
        }
        break;

      case 'ad_group':
        if (context.adGroupName) {
          prompts.push({
            text: `Analyze "${context.adGroupName}" performance`,
            icon: '📊',
            priority: 1,
          });
          prompts.push({
            text: `Suggest keywords for "${context.adGroupName}"`,
            icon: '🔑',
            priority: 2,
          });
          prompts.push({
            text: `What negatives should I add to "${context.adGroupName}"?`,
            icon: '🚫',
            priority: 3,
          });
        }
        break;

      case 'keywords':
        prompts.push({
          text: 'Which keywords have low quality scores?',
          icon: '⚠️',
          priority: 1,
        });
        prompts.push({
          text: 'Find keywords with high CPA',
          icon: '💸',
          priority: 2,
        });
        prompts.push({
          text: 'Suggest match type changes',
          icon: '🎯',
          priority: 3,
        });
        break;

      case 'spend_shield':
        prompts.push({
          text: 'Explain each waste category',
          icon: '📚',
          priority: 1,
        });
        prompts.push({
          text: 'Prioritize which wasters to fix first',
          icon: '🎯',
          priority: 2,
        });
        prompts.push({
          text: 'Create a waste reduction plan',
          icon: '📋',
          priority: 3,
        });
        break;

      case 'keyword_factory':
        prompts.push({
          text: 'Generate keyword ideas for my top campaign',
          icon: '💡',
          priority: 1,
        });
        prompts.push({
          text: 'Find competitor keywords I\'m missing',
          icon: '🔍',
          priority: 2,
        });
        prompts.push({
          text: 'Suggest long-tail keyword variations',
          icon: '📝',
          priority: 3,
        });
        break;
    }

    // Sort by priority and return top 3
    return prompts.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }, [context]);
}

// Build context string for AI API
export function buildContextString(context: ContextData): string {
  const parts: string[] = [];

  parts.push(`User is viewing: ${context.view.replace('_', ' ')}`);

  if (context.campaign) {
    parts.push(`Selected campaign: "${context.campaign.name}" (Status: ${context.campaign.status}, AI Score: ${context.campaign.aiScore ?? 'N/A'}, Spend: $${context.campaign.spend?.toFixed(2) ?? 0})`);
  }

  if (context.adGroupName) {
    parts.push(`Ad Group: "${context.adGroupName}"`);
  }

  if (context.campaigns && context.campaigns.length > 0) {
    const enabled = context.campaigns.filter(c => c.status === 'ENABLED').length;
    const wasters = context.campaigns.filter(c => (c.aiScore ?? 100) < 40).length;
    parts.push(`Account has ${context.campaigns.length} campaigns (${enabled} active, ${wasters} underperforming)`);
  }

  if (context.totalSpend) {
    parts.push(`Total spend: $${context.totalSpend.toLocaleString()}`);
  }

  if (context.totalConversions) {
    parts.push(`Total conversions: ${context.totalConversions}`);
  }

  return parts.join('\n');
}
