'use client';

import React, { useMemo, useState, useRef } from 'react';
import { Campaign, CampaignStatus, CampaignType } from '@/types/campaign';
import { CampaignIssue } from '@/types/health';
import { useMode } from '@/contexts/ModeContext';
import InlineEditableCell from './InlineEditableCell';
import AIScoreBreakdown from './AIScoreBreakdown';
import HealthBadge from './HealthBadge';
import IssueChips from './IssueChips';
import ScoreBreakdownPopover from './ScoreBreakdownPopover';
import { getTopRecommendation, getImpactColor, Recommendation } from '@/lib/recommendations';
import InlineQuickActions, { QuickAction } from '@/components/QuickActions/InlineQuickActions';

interface GridRowProps {
  campaign: Campaign;
  isSelected: boolean;
  onSelect: () => void;
  onClick?: () => void;
  onViewDetails?: (e: React.MouseEvent) => void;
  onManageBudget?: (e: React.MouseEvent) => void;
  onUpdateCampaign?: (id: string, updates: Partial<Campaign>) => void;
  onRecommendationAction?: (recommendation: Recommendation, campaign: Campaign) => void;
  onIssueClick?: (campaign: Campaign, issue: CampaignIssue) => void;
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const styles = {
    ENABLED: 'bg-emerald-100 text-emerald-700',
    PAUSED: 'bg-slate-100 text-slate-600',
    REMOVED: 'bg-rose-100 text-rose-700',
  };

  const dotStyles = {
    ENABLED: 'bg-emerald-500',
    PAUSED: 'bg-slate-400',
    REMOVED: 'bg-rose-500',
  };

  const labels = {
    ENABLED: 'Active',
    PAUSED: 'Paused',
    REMOVED: 'Removed',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[status]}`} />
      {labels[status]}
    </span>
  );
}

function CampaignTypeIcon({ type }: { type: CampaignType }) {
  const icons: Record<CampaignType, React.ReactElement> = {
    SEARCH: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    PERFORMANCE_MAX: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    SHOPPING: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    DISPLAY: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    VIDEO: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    DEMAND_GEN: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    APP: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  };

  return icons[type] || icons.SEARCH;
}

function TypeBadge({ type }: { type: CampaignType }) {
  const labels: Record<CampaignType, string> = {
    SEARCH: 'Search',
    PERFORMANCE_MAX: 'PMax',
    SHOPPING: 'Shopping',
    DISPLAY: 'Display',
    VIDEO: 'Video',
    DEMAND_GEN: 'Demand Gen',
    APP: 'App',
  };

  const colors: Record<CampaignType, string> = {
    SEARCH: 'bg-blue-50 text-blue-700',
    PERFORMANCE_MAX: 'bg-purple-50 text-purple-700',
    SHOPPING: 'bg-orange-50 text-orange-700',
    DISPLAY: 'bg-cyan-50 text-cyan-700',
    VIDEO: 'bg-red-50 text-red-700',
    DEMAND_GEN: 'bg-pink-50 text-pink-700',
    APP: 'bg-indigo-50 text-indigo-700',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${colors[type]}`}>
      <CampaignTypeIcon type={type} />
      {labels[type]}
    </span>
  );
}


export default function GridRow({ campaign, isSelected, onSelect, onClick, onViewDetails, onManageBudget, onUpdateCampaign, onRecommendationAction, onIssueClick }: GridRowProps) {
  const { isProMode } = useMode();
  const topRecommendation = getTopRecommendation(campaign);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const healthBadgeRef = useRef<HTMLDivElement>(null);

  // Generate AI brief from health issues
  const aiBrief = useMemo(() => {
    if (!campaign.health?.issues?.length) return null;

    const topIssue = campaign.health.topIssue || campaign.health.issues[0];
    if (!topIssue) return null;

    // Build brief based on issue type
    const brief = topIssue.summary;
    const hasFix = topIssue.fixes?.length > 0;
    const fixHint = hasFix ? ` ${topIssue.fixes[0].action}.` : '';

    // Truncate if too long
    const maxLen = 80;
    const fullBrief = brief + (hasFix && brief.length + fixHint.length <= maxLen ? fixHint : '');
    return fullBrief.length > maxLen ? fullBrief.substring(0, maxLen - 3) + '...' : fullBrief;
  }, [campaign.health]);

  // Quick actions for the row
  const quickActions: QuickAction[] = useMemo(() => [
    {
      id: 'view-details',
      label: 'View Details',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      onClick: () => onViewDetails?.({ stopPropagation: () => {} } as React.MouseEvent),
      tooltip: 'View campaign details',
    },
    {
      id: 'manage-budget',
      label: 'Manage Budget',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => onManageBudget?.({ stopPropagation: () => {} } as React.MouseEvent),
      variant: 'success',
      tooltip: 'Manage budget and bids',
    },
    {
      id: 'toggle-status',
      label: campaign.status === 'ENABLED' ? 'Pause' : 'Enable',
      icon: campaign.status === 'ENABLED' ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => onUpdateCampaign?.(campaign.id, {
        status: campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED'
      }),
      variant: campaign.status === 'ENABLED' ? 'warning' : 'success',
      tooltip: campaign.status === 'ENABLED' ? 'Pause campaign' : 'Enable campaign',
    },
    {
      id: 'drill-down',
      label: 'View Ad Groups',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      onClick: () => onClick?.(),
      tooltip: 'View ad groups in this campaign',
    },
  ], [campaign.id, campaign.status, onClick, onViewDetails, onManageBudget, onUpdateCampaign]);

  const formatCurrency = (value: number) => {
    if (value === 0) return '-';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (value: number) => {
    if (value === 0) return '-';
    return value.toLocaleString('en-US');
  };

  const formatPercent = (value: number) => {
    if (value === 0) return '-';
    return `${value.toFixed(2)}%`;
  };

  const handleNameChange = (newName: string) => {
    if (onUpdateCampaign && newName.trim()) {
      onUpdateCampaign(campaign.id, { name: newName.trim() });
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (onUpdateCampaign) {
      onUpdateCampaign(campaign.id, { status: newStatus as CampaignStatus });
    }
  };

  return (
    <tr
      className={`cursor-pointer group transition-colors ${
        isSelected
          ? 'bg-indigo-50'
          : 'hover:bg-slate-50'
      }`}
      onClick={onClick}
    >
      <td className="w-10 px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      </td>
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <InlineEditableCell
            value={campaign.name}
            onSave={handleNameChange}
            placeholder="Campaign name"
            className="font-medium text-slate-900"
          />
          <svg className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" onClick={onClick}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        {/* Inline AI Brief - shows top issue summary */}
        {aiBrief ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-indigo-600 flex items-center gap-1">
            <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {aiBrief}
          </p>
        ) : campaign.aiRecommendation ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{campaign.aiRecommendation}</p>
        ) : null}
      </td>
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <InlineEditableCell
          value={campaign.status}
          onSave={handleStatusChange}
          type="select"
          options={[
            { value: 'ENABLED', label: 'Active' },
            { value: 'PAUSED', label: 'Paused' },
          ]}
        />
      </td>
      <td className="px-4 py-3.5">
        <TypeBadge type={campaign.type} />
      </td>
      <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
        {formatCurrency(campaign.spend)}
      </td>
      {isProMode && (
        <td className="px-4 py-3.5 text-right text-slate-600">
          {formatNumber(campaign.clicks)}
        </td>
      )}
      <td className="px-4 py-3.5 text-right text-slate-600">
        {formatNumber(campaign.conversions)}
      </td>
      {isProMode && (
        <td className="px-4 py-3.5 text-right text-slate-600">
          {formatPercent(campaign.ctr)}
        </td>
      )}
      {isProMode && (
        <td className="px-4 py-3.5 text-right text-slate-600">
          {formatCurrency(campaign.cpa)}
        </td>
      )}
      {/* Health Score - shows HealthBadge if health data exists, falls back to AIScoreBreakdown */}
      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
        {campaign.health ? (
          <div ref={healthBadgeRef} className="inline-block">
            <HealthBadge
              health={campaign.health}
              showLabel={true}
              showTrend={isProMode}
              onClick={() => setShowScoreBreakdown(true)}
            />
            {/* Score Breakdown Popover */}
            <ScoreBreakdownPopover
              health={campaign.health}
              campaignName={campaign.name}
              isOpen={showScoreBreakdown}
              onClose={() => setShowScoreBreakdown(false)}
              onViewIssue={
                onIssueClick
                  ? (issue) => {
                      setShowScoreBreakdown(false);
                      onIssueClick(campaign, issue);
                    }
                  : undefined
              }
              anchorRef={healthBadgeRef}
            />
          </div>
        ) : (
          <AIScoreBreakdown score={campaign.aiScore} breakdown={campaign.aiScoreBreakdown} />
        )}
      </td>
      {/* Issues - shows IssueChips if health data exists, falls back to top recommendation */}
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        {campaign.health?.issues && campaign.health.issues.length > 0 ? (
          <IssueChips
            issues={campaign.health.issues}
            maxVisible={2}
            onIssueClick={onIssueClick ? (issue) => onIssueClick(campaign, issue) : undefined}
            size="sm"
          />
        ) : topRecommendation ? (
          <div className="flex items-center gap-2 max-w-xs" title={topRecommendation.description}>
            <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${getImpactColor(topRecommendation.impact)}`}>
              {topRecommendation.impact === 'high' ? '!' : topRecommendation.impact === 'medium' ? '~' : '-'}
            </span>
            <span className="text-xs text-slate-600 line-clamp-1 flex-1">{topRecommendation.issue}</span>
            {onRecommendationAction && (
              <button
                onClick={() => onRecommendationAction(topRecommendation, campaign)}
                className="flex-shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
              >
                Fix
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs font-medium text-emerald-600">No issues</span>
        )}
      </td>
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <InlineQuickActions actions={quickActions} compact />
        </div>
      </td>
    </tr>
  );
}
