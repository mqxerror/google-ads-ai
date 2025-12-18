'use client';

import { DiagnosticEvidence, MetricChange } from '@/types/health';

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

export default function EvidencePanel({ evidence }: EvidencePanelProps) {
  return (
    <div className="space-y-4">
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
