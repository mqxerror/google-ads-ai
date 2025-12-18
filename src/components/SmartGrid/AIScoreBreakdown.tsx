'use client';

import { useState, useRef, useEffect } from 'react';
import { AIScoreBreakdown as AIScoreBreakdownType } from '@/types/campaign';

interface AIScoreBreakdownProps {
  score: number;
  breakdown?: AIScoreBreakdownType;
}

export default function AIScoreBreakdown({ score, breakdown }: AIScoreBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Score badge colors with dark mode support
  let bgColor = 'bg-slate-100';
  let textColor = 'text-slate-500';
  let ringColor = 'ring-slate-200';
  let barColor = 'bg-slate-400';

  if (score >= 75) {
    bgColor = 'bg-emerald-100';
    textColor = 'text-emerald-700';
    ringColor = 'ring-emerald-300';
    barColor = 'bg-emerald-500';
  } else if (score >= 50) {
    bgColor = 'bg-amber-100';
    textColor = 'text-amber-700';
    ringColor = 'ring-amber-300';
    barColor = 'bg-amber-500';
  } else if (score > 0) {
    bgColor = 'bg-rose-100';
    textColor = 'text-rose-700';
    ringColor = 'ring-rose-300';
    barColor = 'bg-rose-500';
  }

  if (score === 0) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${bgColor} ${textColor} hover:ring-2 ${ringColor} transition-all cursor-pointer`}
      >
        {score}
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {isOpen && breakdown && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-semibold text-slate-900">AI Health Score</h4>
            <div className={`rounded-full px-3 py-1 text-lg font-bold ${bgColor} ${textColor}`}>
              {score}/100
            </div>
          </div>

          {/* Score Bar */}
          <div className="mb-4">
            <div className="h-2.5 w-full rounded-full bg-slate-200">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {/* Factor Breakdown */}
          <div className="space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score Factors</h5>
            {breakdown.factors.map((factor, idx) => (
              <div key={idx} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          factor.status === 'good'
                            ? 'bg-emerald-500'
                            : factor.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span className="text-sm font-medium text-slate-900">{factor.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{factor.description}</p>
                  </div>
                  <div
                    className={`ml-2 rounded-md px-2 py-0.5 text-xs font-semibold ${
                      factor.score > 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : factor.score < 0
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {factor.score > 0 ? '+' : ''}
                    {factor.score}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Top Issue */}
          {breakdown.topIssue && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">Top Issue</p>
                  <p className="text-xs text-amber-700">{breakdown.topIssue}</p>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Good
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Warning
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Critical
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
