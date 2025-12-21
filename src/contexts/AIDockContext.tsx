/**
 * AI Dock Context
 *
 * Event-driven context for the AI Assistant dock.
 * Responds to events like issue clicks, health badge hovers,
 * and surfaces context-aware AI assistance.
 */

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Campaign } from '@/types/campaign';
import { CampaignIssue } from '@/types/health';

// Event types for dock triggers
export type DockTrigger =
  | 'manual' // User clicked AI button
  | 'issue_click' // User clicked on an issue
  | 'health_badge' // User interacted with health badge
  | 'what_changed' // User clicked on a change item
  | 'compare_mode' // User wants explanation of comparison
  | 'wasted_spend' // Wasted spend alert
  | 'opportunity'; // Scaling opportunity

// Dock modes
export type DockMode = 'full' | 'mini' | 'hidden';

// Context for what triggered the dock
export interface DockContext {
  trigger: DockTrigger;
  campaign?: Campaign | null;
  issue?: CampaignIssue | null;
  campaigns?: Campaign[];
  customPrompt?: string;
  metadata?: Record<string, unknown>;
}

interface AIDockContextType {
  // Dock state
  isOpen: boolean;
  mode: DockMode;
  context: DockContext | null;

  // Actions
  openDock: (ctx: DockContext) => void;
  closeDock: () => void;
  setMode: (mode: DockMode) => void;

  // Event handlers for specific triggers
  triggerFromIssue: (campaign: Campaign, issue: CampaignIssue) => void;
  triggerFromHealthBadge: (campaign: Campaign) => void;
  triggerFromChange: (campaign: Campaign, changeInfo: string) => void;
  triggerFromOpportunity: (campaign: Campaign, opportunityInfo: string) => void;

  // Mini dock headline (shown in collapsed state)
  headline: string | null;
  setHeadline: (headline: string | null) => void;
}

const AIDockContext = createContext<AIDockContextType | undefined>(undefined);

export function AIDockProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<DockMode>('hidden');
  const [context, setContext] = useState<DockContext | null>(null);
  const [headline, setHeadline] = useState<string | null>(null);

  const openDock = useCallback((ctx: DockContext) => {
    setContext(ctx);
    setIsOpen(true);
    setMode('full');

    // Set headline based on trigger
    if (ctx.issue) {
      setHeadline(`${ctx.issue.severity === 'critical' ? '🔴' : '🟡'} ${ctx.issue.label || ctx.issue.category}`);
    } else if (ctx.campaign) {
      const score = ctx.campaign.health?.score || ctx.campaign.aiScore;
      setHeadline(`${ctx.campaign.name} • Score: ${score}`);
    } else {
      setHeadline('AI Assistant');
    }
  }, []);

  const closeDock = useCallback(() => {
    setIsOpen(false);
    setMode('hidden');
    // Keep context for potential re-open
  }, []);

  const triggerFromIssue = useCallback((campaign: Campaign, issue: CampaignIssue) => {
    openDock({
      trigger: 'issue_click',
      campaign,
      issue,
    });
  }, [openDock]);

  const triggerFromHealthBadge = useCallback((campaign: Campaign) => {
    const topIssue = campaign.health?.topIssue || campaign.health?.issues?.[0];
    openDock({
      trigger: 'health_badge',
      campaign,
      issue: topIssue,
    });
  }, [openDock]);

  const triggerFromChange = useCallback((campaign: Campaign, changeInfo: string) => {
    openDock({
      trigger: 'what_changed',
      campaign,
      customPrompt: `Analyze this change: ${changeInfo}`,
    });
  }, [openDock]);

  const triggerFromOpportunity = useCallback((campaign: Campaign, opportunityInfo: string) => {
    openDock({
      trigger: 'opportunity',
      campaign,
      customPrompt: `Analyze this opportunity: ${opportunityInfo}`,
    });
  }, [openDock]);

  return (
    <AIDockContext.Provider
      value={{
        isOpen,
        mode,
        context,
        openDock,
        closeDock,
        setMode,
        triggerFromIssue,
        triggerFromHealthBadge,
        triggerFromChange,
        triggerFromOpportunity,
        headline,
        setHeadline,
      }}
    >
      {children}
    </AIDockContext.Provider>
  );
}

export function useAIDock() {
  const context = useContext(AIDockContext);
  if (!context) {
    throw new Error('useAIDock must be used within an AIDockProvider');
  }
  return context;
}
