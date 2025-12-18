'use client';

import { Campaign, CampaignStatus, CampaignType } from '@/types/campaign';
import { getTopRecommendation, getImpactColor, Recommendation } from '@/lib/recommendations';

interface MobileCardViewProps {
  campaigns: Campaign[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onClick?: (campaign: Campaign) => void;
  onViewDetails?: (campaign: Campaign) => void;
  onManageBudget?: (campaign: Campaign) => void;
  onRecommendationAction?: (recommendation: Recommendation, campaign: Campaign) => void;
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
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
      role="status"
      aria-label={`Campaign status: ${labels[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dotStyles[status]}`}
        aria-hidden="true"
      />
      {labels[status]}
    </span>
  );
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
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}

function AIScoreBadge({ score }: { score: number }) {
  let colorClass = 'bg-slate-100 text-slate-600';
  let performanceLevel = 'Poor';
  if (score >= 75) {
    colorClass = 'bg-emerald-100 text-emerald-700';
    performanceLevel = 'Excellent';
  } else if (score >= 50) {
    colorClass = 'bg-amber-100 text-amber-700';
    performanceLevel = 'Good';
  } else if (score > 0) {
    colorClass = 'bg-rose-100 text-rose-700';
    performanceLevel = 'Needs Attention';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${colorClass}`}
      role="status"
      aria-label={`AI Score: ${score} out of 100, ${performanceLevel}`}
    >
      <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      {score}
    </span>
  );
}

function CampaignCard({
  campaign,
  isSelected,
  onSelect,
  onClick,
  onViewDetails,
  onManageBudget,
  onRecommendationAction,
}: {
  campaign: Campaign;
  isSelected: boolean;
  onSelect: () => void;
  onClick?: () => void;
  onViewDetails?: () => void;
  onManageBudget?: () => void;
  onRecommendationAction?: (recommendation: Recommendation) => void;
}) {
  const topRecommendation = getTopRecommendation(campaign);

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

  return (
    <article
      aria-label={`Campaign: ${campaign.name}`}
      className={`rounded-xl border p-4 transition-all focus-within:ring-2 focus-within:ring-indigo-500 ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Checkbox with 44x44 touch target */}
        <div className="flex h-11 w-11 items-center justify-center -ml-1.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            aria-label={`Select campaign ${campaign.name}`}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick?.();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`View details for ${campaign.name}`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">
              {campaign.name}
            </h3>
            <AIScoreBadge score={campaign.aiScore} />
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <StatusBadge status={campaign.status} />
            <TypeBadge type={campaign.type} />
          </div>
        </div>
        {/* Drill-in button with 44x44 touch target */}
        <button
          onClick={onClick}
          aria-label={`Drill into ${campaign.name}`}
          className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-xs font-medium text-slate-500">Spend</p>
          <p className="text-sm font-bold text-slate-900">{formatCurrency(campaign.spend)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-medium text-slate-500">
            <abbr title="Conversions" className="no-underline">Conv.</abbr>
          </p>
          <p className="text-sm font-bold text-slate-900">{formatNumber(campaign.conversions)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-medium text-slate-500">
            <abbr title="Click-Through Rate" className="no-underline">CTR</abbr>
          </p>
          <p className="text-sm font-bold text-slate-900">{formatPercent(campaign.ctr)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-xs font-medium text-slate-500">Clicks</p>
          <p className="text-sm font-semibold text-slate-700">{formatNumber(campaign.clicks)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-medium text-slate-500">
            <abbr title="Cost Per Acquisition" className="no-underline">CPA</abbr>
          </p>
          <p className="text-sm font-semibold text-slate-700">{formatCurrency(campaign.cpa)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-medium text-slate-500">
            <abbr title="Return On Ad Spend" className="no-underline">ROAS</abbr>
          </p>
          <p className="text-sm font-semibold text-slate-700">{campaign.roas?.toFixed(2) || '-'}</p>
        </div>
      </div>

      {/* Recommendation */}
      {topRecommendation && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <div className="flex items-start gap-2">
            <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${getImpactColor(topRecommendation.impact)}`}>
              {topRecommendation.impact === 'high' ? '!' : topRecommendation.impact === 'medium' ? '~' : '-'}
            </span>
            <p className="flex-1 text-xs text-slate-600">{topRecommendation.issue}</p>
            {onRecommendationAction && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRecommendationAction(topRecommendation);
                }}
                className="flex-shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors min-h-[36px]"
              >
                Fix
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions - with minimum 44px touch targets */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onManageBudget?.();
          }}
          className="flex-1 flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 min-h-[44px] text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          Budget
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails?.();
          }}
          className="flex-1 flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 min-h-[44px] text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
        >
          Details
        </button>
      </div>
    </article>
  );
}

export default function MobileCardView({
  campaigns,
  selectedIds,
  onSelect,
  onClick,
  onViewDetails,
  onManageBudget,
  onRecommendationAction,
}: MobileCardViewProps) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No campaigns found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Create a campaign to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:hidden">
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          isSelected={selectedIds.has(campaign.id)}
          onSelect={() => onSelect(campaign.id)}
          onClick={() => onClick?.(campaign)}
          onViewDetails={() => onViewDetails?.(campaign)}
          onManageBudget={() => onManageBudget?.(campaign)}
          onRecommendationAction={
            onRecommendationAction
              ? (rec) => onRecommendationAction(rec, campaign)
              : undefined
          }
        />
      ))}
    </div>
  );
}
