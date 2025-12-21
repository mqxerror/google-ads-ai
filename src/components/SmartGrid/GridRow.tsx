'use client';

import React, { useState, useRef } from 'react';
import { Campaign, CampaignType } from '@/types/campaign';
import { CampaignIssue } from '@/types/health';
import ScoreBreakdownPopover from './ScoreBreakdownPopover';
import { FixDrawer } from '@/components/FixDrawer';
import { formatCurrency, formatNumber } from '@/lib/format';

interface GridRowProps {
  campaign: Campaign;
  isSelected: boolean;
  onSelect: () => void;
  onClick?: () => void;
  onViewDetails?: (e: React.MouseEvent) => void;
  onManageBudget?: (e: React.MouseEvent) => void;
  onUpdateCampaign?: (id: string, updates: Partial<Campaign>) => void;
  onIssueClick?: (campaign: Campaign, issue: CampaignIssue) => void;
  lastSyncedAt?: string | null;
}

// Format relative time like "3m ago", "2h ago", "1d ago"
function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return '-';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return 'now';

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Apple-style type badge - minimal, neutral
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

  return (
    <span className="text-[13px] text-[var(--text2)]">
      {labels[type]}
    </span>
  );
}

// Apple-style Health Badge - dot + softer label + score
function AppleHealthBadge({
  score,
  onClick,
}: {
  score: number;
  onClick?: () => void;
}) {
  // Softer labels per Apple design guidelines
  const getHealthStatus = (s: number) => {
    if (s >= 75) return { label: 'Healthy', dotClass: 'bg-[var(--success)]' };
    if (s >= 50) return { label: 'Needs attention', dotClass: 'bg-[var(--warning)]' };
    return { label: 'At risk', dotClass: 'bg-[var(--danger)]' };
  };

  const { label, dotClass } = getHealthStatus(score);

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--surface2)] rounded-full hover:bg-[var(--surface3)] cursor-pointer transition-colors"
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
      <span className="text-[13px] text-[var(--text2)]">{label}</span>
      <span className="text-[14px] font-semibold text-[var(--text)] tabular-nums">{score}</span>
    </button>
  );
}

// Apple-style Issue Pill - neutral with left border accent
function AppleIssuePill({
  issue,
  additionalCount,
  onClick,
}: {
  issue: CampaignIssue;
  additionalCount?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const borderColor = issue.severity === 'critical'
    ? 'border-l-[var(--danger)]'
    : issue.severity === 'warning'
      ? 'border-l-[var(--warning)]'
      : 'border-l-[var(--accent)]';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface2)] rounded-lg border-l-2 ${borderColor} text-[12px] font-medium text-[var(--text2)] hover:bg-[var(--surface3)] cursor-pointer transition-colors`}
    >
      <span>{issue.label || issue.category}</span>
      {additionalCount && additionalCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[var(--surface3)] rounded-full text-[11px] font-semibold">
          +{additionalCount}
        </span>
      )}
    </button>
  );
}

export default function GridRow({
  campaign,
  isSelected,
  onSelect,
  onClick,
  onViewDetails,
  onManageBudget,
  onUpdateCampaign,
  onIssueClick,
  lastSyncedAt,
}: GridRowProps) {
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showFixDrawer, setShowFixDrawer] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<CampaignIssue | null>(null);
  const healthBadgeRef = useRef<HTMLDivElement>(null);

  // Get the top issue for unified display
  const topIssue = campaign.health?.topIssue || campaign.health?.issues?.[0] || null;
  const additionalIssues = (campaign.health?.issues?.length || 0) - 1;
  const healthScore = campaign.health?.score || campaign.aiScore;

  // Handle Fix button click
  const handleFixClick = (e: React.MouseEvent, issue?: CampaignIssue) => {
    e.stopPropagation();
    setSelectedIssue(issue || topIssue);
    setShowFixDrawer(true);
  };

  // Handle issue pill click
  const handleIssuePillClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onIssueClick && topIssue) {
      onIssueClick(campaign, topIssue);
    } else {
      handleFixClick(e, topIssue || undefined);
    }
  };

  // Use centralized formatters for exact values (2 decimal places for currency)

  return (
    <tr
      className={`border-b border-[var(--divider)] bg-[var(--surface)] hover:bg-[var(--surface2)] cursor-pointer group transition-colors ${isSelected ? 'bg-[var(--accent-light)]' : ''}`}
      style={{ height: '56px' }}
      onClick={onClick}
    >
      {/* Checkbox */}
      <td className="w-12 px-4" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="h-4 w-4 rounded border-[var(--divider)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0"
        />
      </td>

      {/* Campaign Name - clickable for drill-down */}
      <td className="px-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          className="text-left text-[14px] font-medium text-[var(--text)] hover:text-[var(--accent)] transition-colors"
        >
          {campaign.name}
        </button>
      </td>

      {/* Type */}
      <td className="px-4">
        <TypeBadge type={campaign.type} />
      </td>

      {/* Spend */}
      <td className="px-4 text-right">
        <span className="text-[14px] font-semibold text-[var(--text)] tabular-nums">
          {formatCurrency(campaign.spend)}
        </span>
      </td>

      {/* Conversions */}
      <td className="px-4 text-right">
        <span className="text-[14px] text-[var(--text)] tabular-nums">
          {formatNumber(campaign.conversions)}
        </span>
      </td>

      {/* CPA (Pro mode shows more metrics) */}
      <td className="px-4 text-right">
        <span className="text-[14px] text-[var(--text2)] tabular-nums">
          {campaign.cpa > 0 ? formatCurrency(campaign.cpa) : '-'}
        </span>
      </td>

      {/* Health Badge */}
      <td className="px-4" onClick={(e) => e.stopPropagation()}>
        <div ref={healthBadgeRef} className="flex justify-end">
          <AppleHealthBadge
            score={healthScore}
            onClick={() => setShowScoreBreakdown(true)}
          />
          {/* Score Breakdown Popover */}
          {campaign.health && (
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
          )}
        </div>
      </td>

      {/* Primary Issue + Hover Actions */}
      <td className="px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {/* Issue Pill */}
          {topIssue ? (
            <AppleIssuePill
              issue={topIssue}
              additionalCount={additionalIssues > 0 ? additionalIssues : undefined}
              onClick={handleIssuePillClick}
            />
          ) : (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--success)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
              Healthy
            </span>
          )}

          {/* Hover Actions - appear on row hover */}
          <div className="row-actions flex items-center gap-1 ml-auto">
            {/* AI Actions (lightning bolt) */}
            {topIssue && (
              <button
                onClick={(e) => handleFixClick(e)}
                className="btn-icon"
                title="AI Actions"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
            {/* More actions (ellipsis) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.(e);
              }}
              className="btn-icon"
              title="More actions"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Fix Drawer - renders as portal */}
        {showFixDrawer && selectedIssue && (
          <FixDrawer
            isOpen={showFixDrawer}
            onClose={() => {
              setShowFixDrawer(false);
              setSelectedIssue(null);
            }}
            campaign={campaign}
            issue={selectedIssue}
          />
        )}
      </td>

      {/* Last Synced */}
      <td className="px-4 text-right w-24">
        <span className="text-[12px] text-[var(--text3)] tabular-nums">
          {formatRelativeTime(lastSyncedAt)}
        </span>
      </td>
    </tr>
  );
}
