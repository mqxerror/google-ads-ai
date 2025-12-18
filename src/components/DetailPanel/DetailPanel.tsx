'use client';

import { useEffect, useRef, useState } from 'react';
import { Campaign, AdGroup, Keyword, QualityScoreRating } from '@/types/campaign';
import { useActionQueue } from '@/contexts/ActionQueueContext';
import { useAccount } from '@/contexts/AccountContext';
import { MatchTypeSimulator } from '@/components/MatchTypeSimulator';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Campaign | AdGroup | Keyword | null;
  entityType: 'campaign' | 'adGroup' | 'keyword';
}

export default function DetailPanel({ isOpen, onClose, entity, entityType }: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      setTimeout(() => document.addEventListener('click', handleClickOutside), 100);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !entity) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 transition-opacity" />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-lg transform bg-white shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {entityType === 'campaign' ? 'Campaign' : entityType === 'adGroup' ? 'Ad Group' : 'Keyword'}
            </span>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              {entityType === 'keyword' ? (entity as Keyword).text : (entity as Campaign | AdGroup).name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ height: 'calc(100% - 73px)' }}>
          {entityType === 'campaign' && <CampaignDetail campaign={entity as Campaign} />}
          {entityType === 'adGroup' && <AdGroupDetail adGroup={entity as AdGroup} />}
          {entityType === 'keyword' && <KeywordDetail keyword={entity as Keyword} />}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, subValue, trend }: { label: string; value: string; subValue?: string; trend?: 'up' | 'down' | 'neutral' }) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {subValue && (
        <p className={`mt-1 text-sm ${trend ? trendColors[trend] : 'text-gray-500'}`}>
          {trend === 'up' && '↑ '}
          {trend === 'down' && '↓ '}
          {subValue}
        </p>
      )}
    </div>
  );
}

function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const { addAction, actions: queuedActions } = useActionQueue();
  const { currentAccount } = useAccount();
  const [actionAdded, setActionAdded] = useState<string | null>(null);

  const formatCurrency = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const formatNumber = (value: number) => value.toLocaleString('en-US');
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  const statusColors = {
    ENABLED: 'bg-green-100 text-green-800',
    PAUSED: 'bg-yellow-100 text-yellow-800',
    REMOVED: 'bg-red-100 text-red-800',
  };

  const typeLabels: Record<string, string> = {
    SEARCH: 'Search',
    PERFORMANCE_MAX: 'Performance Max',
    SHOPPING: 'Shopping',
    DISPLAY: 'Display',
    VIDEO: 'Video',
    DEMAND_GEN: 'Demand Gen',
    APP: 'App',
  };

  // Check if this campaign has pending actions in the queue
  const pendingActions = queuedActions.filter(
    a => a.entityId === campaign.id && a.status === 'pending'
  );

  const handleQueueStatusChange = (newStatus: 'ENABLED' | 'PAUSED') => {
    if (!currentAccount?.id) return;

    addAction({
      accountId: currentAccount.id,
      actionType: newStatus === 'PAUSED' ? 'pause_campaign' : 'enable_campaign',
      entityType: 'campaign',
      entityId: campaign.id,
      entityName: campaign.name,
      currentValue: campaign.status,
      newValue: newStatus,
      aiScore: campaign.aiScore,
    });

    setActionAdded(newStatus === 'PAUSED' ? 'pause' : 'enable');
    setTimeout(() => setActionAdded(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Status & Type */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColors[campaign.status]}`}>
          {campaign.status === 'ENABLED' ? 'Active' : campaign.status === 'PAUSED' ? 'Paused' : 'Removed'}
        </span>
        <span className="inline-flex items-center rounded-md bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
          {typeLabels[campaign.type] || campaign.type}
        </span>
        {pendingActions.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
            <svg className="h-3 w-3 animate-pulse" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="4" />
            </svg>
            {pendingActions.length} Pending Action{pendingActions.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Pending Actions Alert */}
      {pendingActions.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <p className="text-sm font-medium text-orange-800">
            Pending Actions in Queue:
          </p>
          <ul className="mt-1 text-sm text-orange-700">
            {pendingActions.map(action => (
              <li key={action.id}>
                • {action.actionType}: {action.currentValue} → {action.newValue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Score */}
      {campaign.aiScore > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">AI Health Score</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{campaign.aiScore}</p>
            </div>
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
              campaign.aiScore >= 75 ? 'bg-green-100' : campaign.aiScore >= 50 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              <span className="text-2xl">
                {campaign.aiScore >= 75 ? '🟢' : campaign.aiScore >= 50 ? '🟡' : '🔴'}
              </span>
            </div>
          </div>
          {campaign.aiRecommendation && (
            <p className="mt-3 text-sm text-gray-600">{campaign.aiRecommendation}</p>
          )}
        </div>
      )}

      {/* Performance Metrics */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Performance</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Spend" value={formatCurrency(campaign.spend)} />
          <StatCard label="Clicks" value={formatNumber(campaign.clicks)} />
          <StatCard label="Conversions" value={formatNumber(campaign.conversions)} />
          <StatCard label="CTR" value={formatPercent(campaign.ctr)} />
          <StatCard label="CPA" value={campaign.cpa > 0 ? formatCurrency(campaign.cpa) : '-'} />
          <StatCard label="ROAS" value={campaign.roas > 0 ? `${campaign.roas.toFixed(2)}x` : '-'} />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Quick Actions</h3>
        <div className="space-y-2">
          <button
            onClick={() => handleQueueStatusChange(campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED')}
            disabled={campaign.status === 'REMOVED'}
            className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
              actionAdded
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:bg-gray-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {actionAdded ? (
              <>
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-700">Added to Queue!</span>
              </>
            ) : campaign.status === 'ENABLED' ? (
              <>
                <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="font-medium text-gray-700">Pause Campaign</span>
                  <span className="ml-2 text-xs text-gray-500">(adds to queue)</span>
                </div>
              </>
            ) : (
              <>
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="font-medium text-gray-700">Enable Campaign</span>
                  <span className="ml-2 text-xs text-gray-500">(adds to queue)</span>
                </div>
              </>
            )}
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50">
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="font-medium text-gray-700">Get AI Recommendations</span>
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50">
            <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-gray-700">Adjust Budget</span>
          </button>
        </div>
      </div>

      {/* Campaign ID */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-xs text-gray-400">Campaign ID: {campaign.id}</p>
      </div>
    </div>
  );
}

function AdGroupDetail({ adGroup }: { adGroup: AdGroup }) {
  const formatCurrency = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const formatNumber = (value: number) => value.toLocaleString('en-US');

  const statusColors = {
    ENABLED: 'bg-green-100 text-green-800',
    PAUSED: 'bg-yellow-100 text-yellow-800',
    REMOVED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColors[adGroup.status]}`}>
          {adGroup.status === 'ENABLED' ? 'Active' : adGroup.status === 'PAUSED' ? 'Paused' : 'Removed'}
        </span>
      </div>

      {/* Performance Metrics */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Performance</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Spend" value={formatCurrency(adGroup.spend)} />
          <StatCard label="Clicks" value={formatNumber(adGroup.clicks)} />
          <StatCard label="Conversions" value={adGroup.conversions.toFixed(1)} />
          <StatCard label="CPA" value={adGroup.cpa > 0 ? formatCurrency(adGroup.cpa) : '-'} />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Quick Actions</h3>
        <div className="space-y-2">
          <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="font-medium text-gray-700">Edit Ad Group</span>
          </button>
          <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50">
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="font-medium text-gray-700">Add Keywords</span>
          </button>
        </div>
      </div>

      {/* Ad Group ID */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-xs text-gray-400">Ad Group ID: {adGroup.id}</p>
      </div>
    </div>
  );
}

// Quality Score component breakdown display
function QualityScoreBreakdown({ keyword }: { keyword: Keyword }) {
  const getRatingStyle = (rating?: QualityScoreRating) => {
    switch (rating) {
      case 'ABOVE_AVERAGE':
        return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '✓', label: 'Above Average' };
      case 'AVERAGE':
        return { bg: 'bg-amber-100', text: 'text-amber-700', icon: '—', label: 'Average' };
      case 'BELOW_AVERAGE':
        return { bg: 'bg-red-100', text: 'text-red-700', icon: '✗', label: 'Below Average' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-500', icon: '?', label: 'Unknown' };
    }
  };

  const getRatingProgress = (rating?: QualityScoreRating) => {
    switch (rating) {
      case 'ABOVE_AVERAGE': return 100;
      case 'AVERAGE': return 66;
      case 'BELOW_AVERAGE': return 33;
      default: return 0;
    }
  };

  const components = [
    { key: 'expectedCtr', label: 'Expected CTR', rating: keyword.expectedCtr, icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ), description: 'How likely users are to click your ad' },
    { key: 'adRelevance', label: 'Ad Relevance', rating: keyword.adRelevance, icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ), description: 'How closely your ad matches the keyword' },
    { key: 'landingPageExperience', label: 'Landing Page', rating: keyword.landingPageExperience, icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
    ), description: 'User experience on your landing page' },
  ];

  // Count issues for summary
  const belowAverageCount = [keyword.expectedCtr, keyword.adRelevance, keyword.landingPageExperience]
    .filter(r => r === 'BELOW_AVERAGE').length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header with overall score */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Quality Score</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-gray-900">{keyword.qualityScore}</span>
              <span className="text-lg text-gray-500">/10</span>
            </div>
          </div>
          <div className="h-16 w-16">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-200"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={keyword.qualityScore >= 7 ? 'text-emerald-500' : keyword.qualityScore >= 5 ? 'text-amber-500' : 'text-red-500'}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${(keyword.qualityScore / 10) * 100}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
        {belowAverageCount > 0 && (
          <p className="mt-2 text-sm text-red-600">
            {belowAverageCount} component{belowAverageCount > 1 ? 's' : ''} below average — fix to improve score
          </p>
        )}
      </div>

      {/* Component breakdown */}
      <div className="divide-y divide-gray-100">
        {components.map((component) => {
          const style = getRatingStyle(component.rating);
          const progress = getRatingProgress(component.rating);

          return (
            <div key={component.key} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${style.bg} ${style.text}`}>
                  {component.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm">{component.label}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                      <span>{style.icon}</span>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{component.description}</p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        component.rating === 'ABOVE_AVERAGE' ? 'bg-emerald-500' :
                        component.rating === 'AVERAGE' ? 'bg-amber-500' :
                        component.rating === 'BELOW_AVERAGE' ? 'bg-red-500' :
                        'bg-gray-300'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Improvement tips */}
      {belowAverageCount > 0 && (
        <div className="bg-amber-50 border-t border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Improvement Tips
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {keyword.expectedCtr === 'BELOW_AVERAGE' && (
              <li>• Add keyword to ad headlines for better CTR</li>
            )}
            {keyword.adRelevance === 'BELOW_AVERAGE' && (
              <li>• Create tightly themed ad groups with related keywords</li>
            )}
            {keyword.landingPageExperience === 'BELOW_AVERAGE' && (
              <li>• Improve page load speed and mobile experience</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function KeywordDetail({ keyword }: { keyword: Keyword }) {
  const formatCurrency = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const formatNumber = (value: number) => value.toLocaleString('en-US');

  const statusColors = {
    ENABLED: 'bg-green-100 text-green-800',
    PAUSED: 'bg-yellow-100 text-yellow-800',
    REMOVED: 'bg-red-100 text-red-800',
  };

  const matchTypeLabels = {
    EXACT: '[exact]',
    PHRASE: '"phrase"',
    BROAD: 'broad',
  };

  const matchTypeColors = {
    EXACT: 'bg-purple-100 text-purple-800',
    PHRASE: 'bg-blue-100 text-blue-800',
    BROAD: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      {/* Status & Match Type */}
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColors[keyword.status]}`}>
          {keyword.status === 'ENABLED' ? 'Active' : keyword.status === 'PAUSED' ? 'Paused' : 'Removed'}
        </span>
        <span className={`inline-flex items-center rounded-md px-3 py-1 font-mono text-sm ${matchTypeColors[keyword.matchType as keyof typeof matchTypeColors] || 'bg-gray-100 text-gray-800'}`}>
          {matchTypeLabels[keyword.matchType as keyof typeof matchTypeLabels] || keyword.matchType}
        </span>
      </div>

      {/* Quality Score Breakdown */}
      {keyword.qualityScore > 0 && <QualityScoreBreakdown keyword={keyword} />}

      {/* Match Type Simulator */}
      <MatchTypeSimulator keyword={keyword} />

      {/* Performance Metrics */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Performance</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Spend" value={formatCurrency(keyword.spend)} />
          <StatCard label="Clicks" value={formatNumber(keyword.clicks)} />
          <StatCard label="Conversions" value={keyword.conversions.toFixed(1)} />
          <StatCard label="CPA" value={keyword.cpa > 0 ? formatCurrency(keyword.cpa) : '-'} />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Quick Actions</h3>
        <div className="space-y-2">
          <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="font-medium text-gray-700">Edit Keyword</span>
          </button>
          <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50">
            <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="font-medium text-gray-700">Change Match Type</span>
          </button>
          <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50">
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="font-medium text-gray-700">Add as Negative</span>
          </button>
        </div>
      </div>

      {/* Keyword ID */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-xs text-gray-400">Keyword ID: {keyword.id}</p>
      </div>
    </div>
  );
}
