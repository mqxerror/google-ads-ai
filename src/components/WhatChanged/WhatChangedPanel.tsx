/**
 * What Changed Panel
 *
 * The daily workflow surface that shows:
 * - Budget/bid/target changes
 * - Major metric deltas
 * - Anomalies / wasted spend
 * - Each with "Queue fix / Explain / Ignore" actions
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useActionQueue } from '@/contexts/ActionQueueContext';
import { ActionType } from '@/types/action-queue';
import {
  ChangeItem,
  ChangeSummary,
  WhatChangedResponse,
  ChangeCategory,
  ChangeSeverity,
} from '@/types/changes';
import {
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  CheckIcon,
  LightBulbIcon,
  ClockIcon,
  ArrowPathIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { FireIcon } from '@heroicons/react/24/solid';

interface WhatChangedPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhatChangedPanel({ isOpen, onClose }: WhatChangedPanelProps) {
  const { currentAccount } = useAccount();
  const { addAction } = useActionQueue();
  const [data, setData] = useState<WhatChangedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [explainLoadingId, setExplainLoadingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});

  const fetchChanges = useCallback(async () => {
    if (!currentAccount?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/changes?accountId=${currentAccount.id}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch changes');
      }
      const result: WhatChangedResponse = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch changes');
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount?.id]);

  useEffect(() => {
    if (isOpen && currentAccount?.id) {
      fetchChanges();
    }
  }, [isOpen, currentAccount?.id, fetchChanges]);

  const handleQueueFix = (change: ChangeItem) => {
    const action = change.availableActions.find((a) => a.type === 'queue_fix');
    if (action?.actionPayload) {
      // Map entity types to queue-compatible types
      const entityTypeMap: Record<string, 'campaign' | 'ad_group' | 'keyword'> = {
        campaign: 'campaign',
        adGroup: 'ad_group',
        ad_group: 'ad_group',
        keyword: 'keyword',
        ad: 'campaign', // Fallback ads to campaign level
      };
      const queueEntityType = entityTypeMap[action.actionPayload.entityType] || 'campaign';

      // Cast to ActionType from action-queue
      const actionType = action.actionPayload.actionType as ActionType;

      addAction({
        actionType,
        entityType: queueEntityType,
        entityId: action.actionPayload.entityId,
        entityName: change.entityName,
        currentValue: String(change.previousValue || change.currentMetricValue || ''),
        newValue: String(action.actionPayload.newValue),
        reason: change.title,
      });
    }
    // Mark as queued
    setIgnoredIds((prev) => new Set([...prev, change.id]));
  };

  const handleExplain = async (change: ChangeItem) => {
    setExplainLoadingId(change.id);
    setExpandedId(change.id);

    // Simulate AI explanation (in production, call AI API)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const explanation = generateExplanation(change);
    setExplanations((prev) => ({ ...prev, [change.id]: explanation }));
    setExplainLoadingId(null);
  };

  const handleIgnore = (change: ChangeItem) => {
    setIgnoredIds((prev) => new Set([...prev, change.id]));
  };

  const getCategoryIcon = (category: ChangeCategory, severity: ChangeSeverity) => {
    switch (category) {
      case 'wasted_spend':
        return <FireIcon className="w-5 h-5 text-red-500" />;
      case 'metric_spike':
        return severity === 'positive' ? (
          <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
        ) : (
          <ArrowTrendingUpIcon className="w-5 h-5 text-amber-500" />
        );
      case 'metric_drop':
        return severity === 'positive' ? (
          <ArrowTrendingDownIcon className="w-5 h-5 text-green-500" />
        ) : (
          <ArrowTrendingDownIcon className="w-5 h-5 text-red-500" />
        );
      case 'opportunity':
        return <SparklesIcon className="w-5 h-5 text-emerald-500" />;
      case 'budget':
        return <CurrencyDollarIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <ExclamationTriangleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityStyles = (severity: ChangeSeverity) => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-amber-200 bg-amber-50';
      case 'positive':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const visibleChanges = data?.changes.filter((c) => !ignoredIds.has(c.id)) || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-lg bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">What Changed</h2>
              {data?.summary && (
                <p className="text-xs text-gray-500">
                  {data.summary.currentPeriod.start} → {data.summary.currentPeriod.end} vs prior
                  week
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Bar */}
        {data?.summary && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
            {data.summary.criticalCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                <FireIcon className="w-3.5 h-3.5" />
                {data.summary.criticalCount} Critical
              </div>
            )}
            {data.summary.warningCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                {data.summary.warningCount} Warning
              </div>
            )}
            {data.summary.positiveCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
                {data.summary.positiveCount} Positive
              </div>
            )}
            <button
              onClick={fetchChanges}
              className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 rounded"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && !data ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex flex-col items-center gap-3">
                <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
                <p className="text-sm text-gray-500">Analyzing changes...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          ) : visibleChanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <CheckIcon className="w-12 h-12 text-green-400 mb-3" />
              <p className="text-lg font-medium text-gray-700">All caught up!</p>
              <p className="text-sm text-gray-500 mt-1">
                No significant changes detected in the last 7 days
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {visibleChanges.map((change) => (
                <div
                  key={change.id}
                  className={`border rounded-lg overflow-hidden transition-all ${getSeverityStyles(
                    change.severity
                  )}`}
                >
                  {/* Change Header */}
                  <div
                    className="flex items-start gap-3 p-3 cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === change.id ? null : change.id)
                    }
                  >
                    <div className="mt-0.5">{getCategoryIcon(change.category, change.severity)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {change.entityName}
                        </span>
                        <ChevronRightIcon
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            expandedId === change.id ? 'rotate-90' : ''
                          }`}
                        />
                      </div>
                      <p className="text-sm font-medium text-gray-700 mt-0.5">{change.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{change.description}</p>
                    </div>
                    {change.delta !== undefined && (
                      <div
                        className={`text-sm font-bold ${
                          change.severity === 'positive'
                            ? 'text-green-600'
                            : change.severity === 'critical'
                            ? 'text-red-600'
                            : change.severity === 'warning'
                            ? 'text-amber-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {change.delta > 0 ? '+' : ''}
                        {change.delta.toFixed(0)}%
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {expandedId === change.id && (
                    <div className="px-3 pb-3 border-t border-gray-100 bg-white/50">
                      {/* Explanation */}
                      {explanations[change.id] && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <LightBulbIcon className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-medium text-blue-700">AI Analysis</span>
                          </div>
                          <p className="text-sm text-blue-800">{explanations[change.id]}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-3 flex items-center gap-2">
                        {change.availableActions.map((action) => (
                          <button
                            key={action.type}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (action.type === 'queue_fix') {
                                handleQueueFix(change);
                              } else if (action.type === 'explain') {
                                handleExplain(change);
                              } else if (action.type === 'ignore') {
                                handleIgnore(change);
                              }
                            }}
                            disabled={
                              action.disabled || (action.type === 'explain' && explainLoadingId === change.id)
                            }
                            className={`
                              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                              transition-colors disabled:opacity-50
                              ${
                                action.type === 'queue_fix'
                                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                  : action.type === 'explain'
                                  ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }
                            `}
                          >
                            {action.type === 'explain' && explainLoadingId === change.id ? (
                              <>
                                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              action.label
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Time info */}
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                        <ClockIcon className="w-3.5 h-3.5" />
                        Detected {new Date(change.detectedAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {visibleChanges.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              {visibleChanges.length} change{visibleChanges.length !== 1 ? 's' : ''} detected •{' '}
              {ignoredIds.size > 0 && `${ignoredIds.size} dismissed`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Generate a simple explanation (in production, use AI)
function generateExplanation(change: ChangeItem): string {
  if (change.category === 'wasted_spend') {
    return `This campaign spent $${change.currentMetricValue?.toFixed(0)} without generating conversions. Common causes include: broad targeting, poor ad relevance, or landing page issues. Consider reviewing search terms for irrelevant queries and checking conversion tracking.`;
  }

  if (change.category === 'opportunity') {
    return `CPA improved significantly while maintaining conversion volume. This indicates strong performance and scaling potential. The campaign is efficiently converting at a lower cost - consider gradually increasing budget to capture more conversions at this improved efficiency.`;
  }

  if (change.metric === 'CPA' && change.delta && change.delta > 0) {
    return `CPA increased by ${change.delta.toFixed(0)}% week-over-week. Possible causes: increased competition, seasonal factors, or audience fatigue. Review search query report for new expensive terms, check auction insights for competitor activity.`;
  }

  if (change.metric === 'Conversions' && change.delta && change.delta < 0) {
    return `Conversions dropped ${Math.abs(change.delta).toFixed(0)}% compared to prior week. Check: 1) Conversion tracking - verify tags are firing, 2) Budget constraints - ensure not limited by budget, 3) Competition - review auction insights, 4) Seasonality - compare to same period last year.`;
  }

  if (change.metric === 'Spend' && change.delta && change.delta > 0) {
    return `Spend increased ${change.delta.toFixed(0)}% from prior period. If intentional (budget increase), verify ROAS/CPA remain acceptable. If unexpected, check for bid changes, new keywords, or audience expansion that may be driving higher costs.`;
  }

  return `Significant change detected in ${change.metric}. Review campaign settings and recent changes to understand the root cause.`;
}

export default WhatChangedPanel;
