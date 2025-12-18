'use client';

import { DiagnosticEvidence, MetricChange, SearchQueryEvidence } from '@/types/health';

interface EvidencePanelProps {
  evidence: DiagnosticEvidence;
}

function formatValue(value: number, format: MetricChange['format']): string {
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'number':
    default:
      return value.toLocaleString('en-US');
  }
}

function MetricCard({ metric }: { metric: MetricChange }) {
  const directionIcon = {
    up: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    down: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    stable: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  };

  // Determine color based on whether the change is good
  const getChangeColor = () => {
    if (metric.direction === 'stable') return 'text-slate-500 bg-slate-100';
    if (metric.isGood === true) return 'text-emerald-600 bg-emerald-100';
    if (metric.isGood === false) return 'text-rose-600 bg-rose-100';
    // Default based on direction if isGood not specified
    return metric.direction === 'up'
      ? 'text-emerald-600 bg-emerald-100'
      : 'text-rose-600 bg-rose-100';
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {metric.label}
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
            {formatValue(metric.current, metric.format)}
          </p>
        </div>
        {metric.changePercent !== undefined && metric.changePercent !== 0 && (
          <div className={`flex items-center gap-1 rounded-md px-2 py-0.5 ${getChangeColor()}`}>
            {directionIcon[metric.direction]}
            <span className="text-xs font-semibold tabular-nums">
              {metric.changePercent > 0 ? '+' : ''}{metric.changePercent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      {metric.previous !== undefined && (
        <p className="mt-1 text-xs text-slate-500">
          Previously: {formatValue(metric.previous, metric.format)}
        </p>
      )}
    </div>
  );
}

// Search Query Table Component
function SearchQueryTable({ queries }: { queries: SearchQueryEvidence[] }) {
  const formatCurrency = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getRecommendationBadge = (rec: SearchQueryEvidence['recommendation']) => {
    switch (rec) {
      case 'add_negative':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Block
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Review
          </span>
        );
      case 'keep':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Keep
          </span>
        );
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Search Queries Driving Issues
          </span>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {queries.map((query, index) => (
          <div key={index} className="px-3 py-2.5 hover:bg-slate-50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900 truncate" title={query.query}>
                  &ldquo;{query.query}&rdquo;
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span>{query.clicks} clicks</span>
                  <span className="text-slate-300">•</span>
                  <span className={query.conversions === 0 ? 'text-red-600 font-medium' : ''}>
                    {query.conversions} conv
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-slate-700">{formatCurrency(query.spend)}</span>
                </div>
              </div>
              {getRecommendationBadge(query.recommendation)}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-slate-50 px-3 py-2 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          Total: {formatCurrency(queries.reduce((sum, q) => sum + q.spend, 0))} wasted on {queries.filter(q => q.conversions === 0).length} non-converting queries
        </p>
      </div>
    </div>
  );
}

export default function EvidencePanel({ evidence }: EvidencePanelProps) {
  return (
    <div className="space-y-4">
      {/* Search Queries Evidence */}
      {evidence.searchQueries && evidence.searchQueries.length > 0 && (
        <SearchQueryTable queries={evidence.searchQueries} />
      )}

      {/* Metrics Grid */}
      {evidence.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {evidence.metrics.map((metric, index) => (
            <MetricCard key={`${metric.name}-${index}`} metric={metric} />
          ))}
        </div>
      )}

      {/* Timeline and Context */}
      <div className="flex flex-wrap gap-3">
        {evidence.timeline && (
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium text-slate-600">
              {evidence.timeline}
            </span>
          </div>
        )}
        {evidence.benchmark && (
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs font-medium text-slate-600">
              {evidence.benchmark}
            </span>
          </div>
        )}
        {evidence.dataPoints && (
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <span className="text-xs font-medium text-slate-600">
              {evidence.dataPoints} days analyzed
            </span>
          </div>
        )}
        {evidence.anomalyDetected && (
          <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5">
            <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs font-medium text-amber-700">
              Anomaly detected
            </span>
          </div>
        )}
      </div>

      {/* Related Changes */}
      {evidence.relatedChanges && evidence.relatedChanges.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Recent Changes That May Have Caused This
          </p>
          <ul className="mt-2 space-y-1">
            {evidence.relatedChanges.map((change, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-amber-800">
                <svg className="mt-0.5 h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="3" />
                </svg>
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
