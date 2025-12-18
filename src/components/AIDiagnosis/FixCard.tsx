'use client';

import { RecommendedFix, getConfidenceColor } from '@/types/health';

interface FixCardProps {
  fix: RecommendedFix;
  isSelected: boolean;
  onClick: () => void;
  onApply: () => void;
  onQueue: () => void;
  rank?: number;
}

function EffortBadge({ effort }: { effort: RecommendedFix['effort'] }) {
  const styles = {
    quick: 'bg-emerald-100 text-emerald-700',
    moderate: 'bg-amber-100 text-amber-700',
    complex: 'bg-rose-100 text-rose-700',
  };

  const labels = {
    quick: '< 5 min',
    moderate: '15-30 min',
    complex: '1+ hour',
  };

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[effort]}`}>
      {labels[effort]}
    </span>
  );
}

function RiskBadge({ risk }: { risk: RecommendedFix['risk'] }) {
  const styles = {
    low: 'text-emerald-600',
    medium: 'text-amber-600',
    high: 'text-rose-600',
  };

  return (
    <span className={`text-[10px] font-medium ${styles[risk]}`}>
      {risk} risk
    </span>
  );
}

export default function FixCard({
  fix,
  isSelected,
  onClick,
  onApply,
  onQueue,
  rank,
}: FixCardProps) {
  const formatImpactRange = () => {
    const { min, max, metric } = fix.impactRange;
    const formatValue = (val: number) => {
      if (metric === 'savings' || metric === 'cpa') {
        return `$${val.toFixed(0)}`;
      }
      if (metric === 'ctr') {
        return `${val.toFixed(2)}%`;
      }
      return val.toFixed(0);
    };

    if (min === max) {
      return formatValue(min);
    }
    return `${formatValue(min)} - ${formatValue(max)}`;
  };

  const getImpactLabel = () => {
    switch (fix.impactRange.metric) {
      case 'savings':
        return 'est. savings';
      case 'conversions':
        return 'est. conversions';
      case 'ctr':
        return 'CTR improvement';
      case 'cpa':
        return 'CPA reduction';
      default:
        return 'impact';
    }
  };

  return (
    <div
      className={`rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {rank && (
          <div className="flex-shrink-0">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              rank === 1
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {rank}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-slate-900">
              {fix.action}
            </h4>
            <div className="flex items-center gap-2 flex-shrink-0">
              <EffortBadge effort={fix.effort} />
              <RiskBadge risk={fix.risk} />
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {fix.description}
          </p>

          {/* Impact Range */}
          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-sm font-semibold text-slate-900">
                {formatImpactRange()}
              </span>
              <span className="text-xs text-slate-500">
                {getImpactLabel()}
              </span>
            </div>
            <span className={`text-xs ${getConfidenceColor(fix.confidence)}`}>
              {fix.confidence} confidence
            </span>
          </div>
        </div>
      </div>

      {/* Assumptions (collapsed by default, show when selected) */}
      {isSelected && fix.assumptions.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Assumptions
          </p>
          <ul className="space-y-1">
            {fix.assumptions.map((assumption, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-slate-600">
                <svg className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="2" />
                </svg>
                {assumption}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions (show when selected) */}
      {isSelected && (
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQueue();
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Add to Queue
          </button>
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
      )}
    </div>
  );
}
