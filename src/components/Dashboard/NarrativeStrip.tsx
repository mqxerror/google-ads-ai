'use client';

import { useMemo, useState } from 'react';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { Campaign } from '@/types/campaign';
import { formatCurrency, formatPercent, formatDelta } from '@/lib/format';

interface NarrativeStripProps {
  onViewIssues?: () => void;
  onViewTasks?: () => void;
}

interface NarrativeInsight {
  type: 'positive' | 'negative' | 'neutral' | 'action';
  text: string;
  metric?: string;
  link?: string;
}

export default function NarrativeStrip({ onViewIssues, onViewTasks }: NarrativeStripProps) {
  const { campaigns, dailyMetrics } = useCampaignsData();
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate narrative insights from campaign data
  const insights = useMemo(() => {
    if (!campaigns.length) return [];

    const result: NarrativeInsight[] = [];

    // Calculate aggregate metrics
    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // Simulate previous period for comparison (in production, this comes from API)
    const prevSpend = totalSpend * 0.88;
    const prevConversions = totalConversions * 0.95;
    const prevCPA = prevConversions > 0 ? prevSpend / prevConversions : avgCPA * 0.85;

    const spendDelta = formatDelta(totalSpend, prevSpend, { format: 'currency' });
    const convDelta = formatDelta(totalConversions, prevConversions);
    const cpaDelta = formatDelta(avgCPA, prevCPA, { format: 'currency' });

    // Spend trend insight
    if (spendDelta.direction !== 'neutral') {
      result.push({
        type: spendDelta.direction === 'up' ? 'neutral' : 'positive',
        text: `Spend ${spendDelta.formattedPercent} to ${formatCurrency(totalSpend, { compact: true })}`,
        metric: 'spend',
      });
    }

    // CPA insight (lower is better)
    if (cpaDelta.direction === 'up' && cpaDelta.percentChange > 10) {
      result.push({
        type: 'negative',
        text: `CPA rising ${cpaDelta.formattedPercent} to ${formatCurrency(avgCPA)}`,
        metric: 'cpa',
      });
    } else if (cpaDelta.direction === 'down' && Math.abs(cpaDelta.percentChange) > 5) {
      result.push({
        type: 'positive',
        text: `CPA improved ${Math.abs(cpaDelta.percentChange).toFixed(0)}% to ${formatCurrency(avgCPA)}`,
        metric: 'cpa',
      });
    }

    // Conversions insight
    if (convDelta.direction !== 'neutral') {
      result.push({
        type: convDelta.direction === 'up' ? 'positive' : 'negative',
        text: `Conversions ${convDelta.formattedPercent} (${totalConversions} total)`,
        metric: 'conversions',
      });
    }

    // Find issues in campaigns
    const campaignsWithIssues = campaigns.filter(c => c.health?.issues?.length);
    const criticalIssues = campaigns.reduce((count, c) => {
      return count + (c.health?.issues?.filter(i => i.severity === 'critical').length || 0);
    }, 0);
    const warningIssues = campaigns.reduce((count, c) => {
      return count + (c.health?.issues?.filter(i => i.severity === 'warning').length || 0);
    }, 0);

    if (criticalIssues > 0) {
      result.push({
        type: 'action',
        text: `${criticalIssues} critical issue${criticalIssues > 1 ? 's' : ''} need attention`,
        link: 'issues',
      });
    } else if (warningIssues > 0) {
      result.push({
        type: 'action',
        text: `${warningIssues} optimization${warningIssues > 1 ? 's' : ''} available`,
        link: 'tasks',
      });
    }

    // Find top performers and underperformers
    const sortedByCPA = [...campaigns]
      .filter(c => c.conversions > 0)
      .sort((a, b) => (a.cpa || Infinity) - (b.cpa || Infinity));

    if (sortedByCPA.length >= 2) {
      const bestCampaign = sortedByCPA[0];
      const worstCampaign = sortedByCPA[sortedByCPA.length - 1];

      if (bestCampaign.cpa && worstCampaign.cpa && worstCampaign.cpa > bestCampaign.cpa * 2) {
        result.push({
          type: 'neutral',
          text: `"${truncate(worstCampaign.name, 20)}" CPA is ${(worstCampaign.cpa / bestCampaign.cpa).toFixed(1)}x higher than best`,
          metric: 'efficiency',
        });
      }
    }

    // Check for low CTR campaigns
    const lowCTRCampaigns = campaigns.filter(c => {
      const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
      return ctr < 1 && c.impressions > 1000;
    });

    if (lowCTRCampaigns.length > 0) {
      result.push({
        type: 'negative',
        text: `${lowCTRCampaigns.length} campaign${lowCTRCampaigns.length > 1 ? 's' : ''} with CTR < 1%`,
        metric: 'ctr',
      });
    }

    return result;
  }, [campaigns]);

  // Helper to truncate text
  function truncate(str: string, n: number) {
    return str.length > n ? str.substring(0, n) + '...' : str;
  }

  // Get primary narrative (most important insight)
  const primaryInsight = insights[0];
  const secondaryInsights = insights.slice(1, 3);
  const hasActionableInsights = insights.some(i => i.type === 'action');

  if (!campaigns.length || !insights.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* AI Icon */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
            <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>

          {/* Narrative Text */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {insights.slice(0, isExpanded ? insights.length : 3).map((insight, idx) => (
              <span key={idx} className="flex items-center">
                {idx > 0 && <span className="mx-1.5 text-slate-400">•</span>}
                <span
                  className={
                    insight.type === 'positive'
                      ? 'text-emerald-700'
                      : insight.type === 'negative'
                      ? 'text-rose-700'
                      : insight.type === 'action'
                      ? 'font-medium text-indigo-700'
                      : 'text-slate-700'
                  }
                >
                  {insight.text}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {insights.length > 3 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {isExpanded ? 'Less' : `+${insights.length - 3} more`}
            </button>
          )}
          {hasActionableInsights && onViewTasks && (
            <button
              onClick={onViewTasks}
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              View Tasks
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
