'use client';

import { useState } from 'react';
import { Campaign } from '@/types/campaign';
import {
  CampaignIssue,
  RecommendedFix,
  ISSUE_CATEGORY_META,
  getSeverityColor,
  getConfidenceColor,
} from '@/types/health';
import EvidencePanel from './EvidencePanel';
import FixCard from './FixCard';

interface AIDiagnosisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  issue: CampaignIssue | null;
  onApplyFix?: (fix: RecommendedFix, campaign: Campaign) => void;
  onQueueFix?: (fix: RecommendedFix, campaign: Campaign) => void;
}

export default function AIDiagnosisDrawer({
  isOpen,
  onClose,
  campaign,
  issue,
  onApplyFix,
  onQueueFix,
}: AIDiagnosisDrawerProps) {
  const [selectedFix, setSelectedFix] = useState<RecommendedFix | null>(null);
  const [showAllIssues, setShowAllIssues] = useState(false);

  if (!isOpen || !campaign || !issue) return null;

  const categoryMeta = ISSUE_CATEGORY_META[issue.category];
  const allIssues = campaign.health?.issues || [issue];
  const otherIssues = allIssues.filter((i) => i.id !== issue.id);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer - Right side */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg transform overflow-hidden bg-white shadow-2xl transition-transform sm:max-w-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${getSeverityColor(
                  issue.severity
                )}`}
              >
                {issue.severity === 'critical' && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                {issue.label}
              </span>
              <span
                className={`text-xs ${getConfidenceColor(issue.confidence)}`}
                title="AI confidence level"
              >
                {issue.confidence} confidence
              </span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 truncate">
              {campaign.name}
            </h2>
            <p className="text-sm text-slate-500">
              {campaign.type} Campaign
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(100%-8rem)] flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* AI Summary */}
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 rounded-full bg-indigo-100 p-2">
                  <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">AI Diagnosis</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {issue.summary}
                  </p>
                  {issue.fullExplanation && (
                    <p className="mt-2 text-sm text-slate-500">
                      {issue.fullExplanation}
                    </p>
                  )}
                </div>
              </div>

              {/* Impact estimate */}
              <div className="mt-4 flex items-center gap-4 rounded-lg bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Estimated Impact
                  </p>
                  <p className="text-lg font-bold text-slate-900">
                    {issue.impactEstimate}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Category
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    {categoryMeta?.label || issue.category}
                  </p>
                </div>
              </div>
            </div>

            {/* Evidence */}
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Evidence
              </h3>
              <EvidencePanel evidence={issue.evidence} />
            </div>

            {/* Recommended Fixes */}
            <div className="px-6 py-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Recommended Fixes
              </h3>
              {issue.fixes.length === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  No automated fixes available. Manual review recommended.
                </p>
              ) : (
                <div className="space-y-3">
                  {issue.fixes.map((fix, index) => (
                    <FixCard
                      key={fix.id}
                      fix={fix}
                      isSelected={selectedFix?.id === fix.id}
                      onClick={() => setSelectedFix(selectedFix?.id === fix.id ? null : fix)}
                      onApply={() => onApplyFix?.(fix, campaign)}
                      onQueue={() => onQueueFix?.(fix, campaign)}
                      rank={index + 1}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Other Issues */}
            {otherIssues.length > 0 && (
              <div className="border-t border-slate-200 px-6 py-4">
                <button
                  onClick={() => setShowAllIssues(!showAllIssues)}
                  className="flex w-full items-center justify-between text-sm text-slate-600 hover:text-slate-900"
                >
                  <span>
                    {otherIssues.length} other issue{otherIssues.length !== 1 ? 's' : ''} on this campaign
                  </span>
                  <svg
                    className={`h-4 w-4 transition-transform ${showAllIssues ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAllIssues && (
                  <div className="mt-3 space-y-2">
                    {otherIssues.map((otherIssue) => (
                      <div
                        key={otherIssue.id}
                        className="rounded-lg border border-slate-200 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${getSeverityColor(otherIssue.severity)} rounded px-1.5 py-0.5`}>
                            {otherIssue.label}
                          </span>
                          <span className="text-xs text-slate-500">{otherIssue.impactEstimate}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{otherIssue.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
            <div className="flex items-center gap-2">
              {selectedFix && (
                <>
                  <button
                    onClick={() => onQueueFix?.(selectedFix, campaign)}
                    className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    Add to Queue
                  </button>
                  <button
                    onClick={() => onApplyFix?.(selectedFix, campaign)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Apply Fix
                  </button>
                </>
              )}
              {!selectedFix && issue.fixes.length > 0 && (
                <p className="text-sm text-slate-500">
                  Select a fix to apply
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
