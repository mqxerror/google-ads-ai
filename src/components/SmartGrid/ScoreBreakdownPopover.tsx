'use client';

import { useState, useRef, useEffect } from 'react';
import { CampaignHealth, CampaignIssue, HealthLabel, getHealthLabel } from '@/types/health';

interface ScoreBreakdownPopoverProps {
  health: CampaignHealth;
  campaignName: string;
  isOpen: boolean;
  onClose: () => void;
  onViewIssue?: (issue: CampaignIssue) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

interface ScoreDriver {
  label: string;
  pointsLost: number;
  severity: 'critical' | 'warning' | 'info';
  evidence: string;
  issueId?: string;
  fixLabel?: string;
}

export default function ScoreBreakdownPopover({
  health,
  campaignName,
  isOpen,
  onClose,
  onViewIssue,
  anchorRef,
}: ScoreBreakdownPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position based on anchor
  useEffect(() => {
    if (isOpen && anchorRef.current && popoverRef.current) {
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();

      // Position below and aligned to the right of the anchor
      let top = anchorRect.bottom + 8;
      let left = anchorRect.left;

      // Adjust if would overflow right edge
      if (left + popoverRect.width > window.innerWidth - 16) {
        left = window.innerWidth - popoverRect.width - 16;
      }

      // Adjust if would overflow bottom
      if (top + popoverRect.height > window.innerHeight - 16) {
        top = anchorRect.top - popoverRect.height - 8;
      }

      // Defer state update to avoid React 19 lint warning
      const timeoutId = setTimeout(() => setPosition({ top, left }), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, anchorRef]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  // Calculate score drivers from issues
  const drivers: ScoreDriver[] = (health.issues || [])
    .filter(issue => !issue.acknowledgedAt)
    .map(issue => {
      // Calculate points lost based on severity
      let pointsLost = 0;
      switch (issue.severity) {
        case 'critical':
          pointsLost = Math.round(20 + (issue.impactValue / 1000) * 5);
          break;
        case 'warning':
          pointsLost = Math.round(10 + (issue.impactValue / 2000) * 5);
          break;
        case 'info':
          pointsLost = Math.round(3 + (issue.impactValue / 5000) * 2);
          break;
      }
      pointsLost = Math.min(pointsLost, 40); // Cap at 40 points per issue

      // Generate evidence text from issue data
      let evidence = issue.summary;

      // Try to build more specific evidence from metrics
      const topMetric = issue.evidence?.metrics?.[0];
      if (topMetric) {
        if (issue.impactMetric === 'savings') {
          evidence = `$${issue.impactValue.toFixed(0)} potential waste identified`;
        } else if (issue.impactMetric === 'cpa' && topMetric.current) {
          evidence = `CPA at $${topMetric.current.toFixed(2)}${topMetric.previous ? ` (was $${topMetric.previous.toFixed(2)})` : ''}`;
        } else if (issue.impactMetric === 'ctr' && topMetric.current) {
          evidence = `CTR at ${topMetric.current.toFixed(2)}%${topMetric.previous ? ` (was ${topMetric.previous.toFixed(2)}%)` : ''}`;
        }
      } else if (issue.impactValue > 0) {
        evidence = `${issue.impactEstimate}`;
      }

      return {
        label: issue.label,
        pointsLost,
        severity: issue.severity,
        evidence,
        issueId: issue.id,
        fixLabel: issue.fixes[0]?.action,
      };
    })
    .sort((a, b) => b.pointsLost - a.pointsLost);

  // Calculate total points lost
  const totalPointsLost = drivers.reduce((sum, d) => sum + d.pointsLost, 0);
  const baseScore = 100;
  const calculatedScore = Math.max(0, baseScore - totalPointsLost);

  // Get color for severity
  const getSeverityColor = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical':
        return 'text-rose-600';
      case 'warning':
        return 'text-amber-600';
      case 'info':
        return 'text-slate-500';
    }
  };

  const getSeverityBg = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-50';
      case 'warning':
        return 'bg-amber-50';
      case 'info':
        return 'bg-slate-50';
    }
  };

  // Health label for final score
  const healthLabel = getHealthLabel(health.score);
  const labelColor = healthLabel === 'Healthy'
    ? 'text-emerald-600'
    : healthLabel === 'Watch'
    ? 'text-amber-600'
    : 'text-rose-600';

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              AI Score Breakdown
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 truncate max-w-[200px]">
              {campaignName}
            </p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold tabular-nums ${labelColor}`}>
              {health.score}
            </span>
            <p className={`text-xs font-medium ${labelColor}`}>{healthLabel}</p>
          </div>
        </div>
      </div>

      {/* Score Drivers */}
      <div className="max-h-64 overflow-y-auto p-2">
        {drivers.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="mt-2 text-sm font-medium text-slate-900">
              No issues detected
            </p>
            <p className="mt-1 text-xs text-slate-500">
              This campaign is performing well
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Factors lowering score
            </p>
            {drivers.map((driver, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-2 ${getSeverityBg(driver.severity)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${getSeverityColor(driver.severity)}`}>
                      {driver.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">
                      {driver.evidence}
                    </p>
                  </div>
                  <span className="flex-shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-700">
                    -{driver.pointsLost}
                  </span>
                </div>
                {driver.fixLabel && onViewIssue && (
                  <button
                    onClick={() => {
                      const issue = health.issues?.find(i => i.id === driver.issueId);
                      if (issue) onViewIssue(issue);
                    }}
                    className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    <span>Fix: {driver.fixLabel}</span>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-4 py-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">
            Base: 100 | Lost: -{totalPointsLost} | Final: {calculatedScore}
          </span>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
