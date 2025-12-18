'use client';

import { useState } from 'react';
import { AITask } from './AIInbox';
import { ISSUE_CATEGORY_META, getSeverityColor, getConfidenceColor } from '@/types/health';

interface AIInboxTaskProps {
  task: AITask;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApply: () => void;
  onSchedule: (date: Date) => void;
  onRequestApproval: () => void;
  onDismiss: (reason?: string) => void;
  onViewDetails: () => void;
}

export default function AIInboxTask({
  task,
  isExpanded,
  onToggleExpand,
  onApply,
  onSchedule,
  onRequestApproval,
  onDismiss,
  onViewDetails,
}: AIInboxTaskProps) {
  const [showDismissReason, setShowDismissReason] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  const categoryMeta = ISSUE_CATEGORY_META[task.issue.category];
  const isHighPriority = task.priority >= 75;
  const isQuickWin = task.estimatedTimeMinutes <= 5;

  // Priority color
  const getPriorityColor = () => {
    if (task.priority >= 80) return 'bg-rose-500';
    if (task.priority >= 60) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  // Format time estimate
  const formatTimeEstimate = (minutes: number) => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.round(minutes / 60)}h`;
  };

  // Format impact
  const formatImpact = () => {
    const { min, max, metric } = task.recommendedFix.impactRange;
    if (metric === 'savings') {
      return `Save $${min.toFixed(0)}-${max.toFixed(0)}`;
    }
    if (metric === 'conversions') {
      return `+${min.toFixed(0)}-${max.toFixed(0)} conv`;
    }
    return task.recommendedFix.expectedImpact;
  };

  return (
    <div
      className={`rounded-lg border transition-all ${
        isExpanded
          ? 'border-indigo-300 bg-indigo-50/50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {/* Main Row */}
      <div
        className="flex cursor-pointer items-start gap-3 p-4"
        onClick={onToggleExpand}
      >
        {/* Priority Indicator */}
        <div className="flex-shrink-0 pt-1">
          <div className={`h-2 w-2 rounded-full ${getPriorityColor()}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-slate-900">
                {task.issue.label}
              </h4>
              <p className="text-sm text-slate-600 truncate">
                {task.campaignName}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isHighPriority && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  HIGH
                </span>
              )}
              {isQuickWin && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  QUICK
                </span>
              )}
            </div>
          </div>

          {/* Meta Row */}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTimeEstimate(task.estimatedTimeMinutes)}
            </span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {formatImpact()}
            </span>
            <span className={`${getConfidenceColor(task.recommendedFix.confidence)}`}>
              {task.recommendedFix.confidence} conf.
            </span>
          </div>
        </div>

        {/* Expand Icon */}
        <svg
          className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-200">
          {/* Summary */}
          <div className="px-4 py-3 bg-slate-50">
            <p className="text-sm text-slate-600">
              {task.issue.summary}
            </p>
          </div>

          {/* Fix Details */}
          <div className="px-4 py-3">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Recommended Action
            </h5>
            <p className="text-sm font-medium text-slate-900">
              {task.recommendedFix.action}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {task.recommendedFix.description}
            </p>

            {/* Assumptions */}
            {task.recommendedFix.assumptions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500 mb-1">
                  Assumptions:
                </p>
                <ul className="text-xs text-slate-500 space-y-0.5">
                  {task.recommendedFix.assumptions.map((assumption, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-slate-400">•</span>
                      {assumption}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Dismiss Reason Input */}
          {showDismissReason && (
            <div className="px-4 py-3 border-t border-slate-200">
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Why are you dismissing this? (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows={2}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setShowDismissReason(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDismiss(dismissReason || undefined);
                    setShowDismissReason(false);
                    setDismissReason('');
                  }}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Confirm Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showDismissReason && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDismissReason(true);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Dismiss
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  View Details
                </button>
              </div>
              <div className="flex items-center gap-2">
                {task.recommendedFix.risk !== 'low' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestApproval();
                    }}
                    className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    Request Approval
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApply();
                  }}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Apply Now
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
