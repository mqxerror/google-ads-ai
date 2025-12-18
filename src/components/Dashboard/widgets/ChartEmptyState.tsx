'use client';

interface ChartEmptyStateProps {
  metric: 'spend' | 'conversions' | 'ctr' | 'cpa';
  hasAggregatedData: boolean;
  onRetrySync?: () => void;
  onChangeGranularity?: () => void;
}

export default function ChartEmptyState({
  metric,
  hasAggregatedData,
  onRetrySync,
  onChangeGranularity,
}: ChartEmptyStateProps) {
  // Determine the reason based on context
  const reason = hasAggregatedData
    ? 'Daily breakdown unavailable'
    : 'No data for selected period';

  const explanation = hasAggregatedData
    ? 'Totals are available but daily granularity requires additional sync'
    : 'Try adjusting your date range or check campaign status';

  const metricLabels = {
    spend: 'Spend',
    conversions: 'Conversions',
    ctr: 'CTR',
    cpa: 'CPA',
  };

  const metricIcons = {
    spend: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
    conversions: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    ctr: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
      </svg>
    ),
    cpa: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    ),
  };

  return (
    <div className="flex h-48 flex-col items-center justify-center rounded-lg bg-slate-50">
      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {metricIcons[metric]}
      </div>

      {/* Status */}
      <div className="mt-3 text-center">
        <p className="text-sm font-medium text-slate-600">
          {reason}
        </p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          {explanation}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        {hasAggregatedData && onRetrySync && (
          <button
            onClick={onRetrySync}
            className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Sync
          </button>
        )}
        {onChangeGranularity && (
          <button
            onClick={onChangeGranularity}
            className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Adjust Date Range
          </button>
        )}
      </div>

      {/* Data Health Indicator */}
      {hasAggregatedData && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-600">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {metricLabels[metric]} totals available via KPI cards above
        </div>
      )}
    </div>
  );
}
