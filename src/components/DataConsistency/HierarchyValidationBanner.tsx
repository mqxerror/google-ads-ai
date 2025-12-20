'use client';

import { useState } from 'react';
import { ValidationResult, MetricDiscrepancy } from '@/lib/validation/hierarchy-validator';

interface HierarchyValidationBannerProps {
  validation: ValidationResult | null;
  parentName: string;
  childrenName: string;
  isPartialData?: boolean;
}

export default function HierarchyValidationBanner({
  validation,
  parentName,
  childrenName,
  isPartialData = false,
}: HierarchyValidationBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show anything if no validation or no discrepancies
  if (!validation || validation.discrepancies.length === 0) {
    return null;
  }

  const hasErrors = validation.discrepancies.some(d => d.severity === 'error');
  const hasWarnings = validation.discrepancies.some(d => d.severity === 'warning');

  // Determine banner style based on severity
  const bannerStyle = hasErrors
    ? 'border-red-300 bg-red-50'
    : hasWarnings
    ? 'border-yellow-300 bg-yellow-50'
    : 'border-blue-300 bg-blue-50';

  const iconColor = hasErrors
    ? 'text-red-600'
    : hasWarnings
    ? 'text-yellow-600'
    : 'text-blue-600';

  const textColor = hasErrors
    ? 'text-red-800'
    : hasWarnings
    ? 'text-yellow-800'
    : 'text-blue-800';

  return (
    <div className={`mb-4 rounded-lg border p-3 ${bannerStyle}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${iconColor}`}>
          {hasErrors ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm font-medium ${textColor}`}>
              {hasErrors ? 'Data Consistency Issue' : 'Data Discrepancy Detected'}
            </h4>
            {isPartialData && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                Partial Data
              </span>
            )}
          </div>

          <p className={`mt-1 text-sm ${textColor} opacity-80`}>
            {validation.summary}
          </p>

          {/* Expandable details */}
          {validation.discrepancies.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`mt-2 text-xs font-medium ${textColor} hover:underline flex items-center gap-1`}
            >
              {isExpanded ? 'Hide details' : 'Show details'}
              <svg
                className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {isExpanded && (
            <div className="mt-3 space-y-2">
              {validation.discrepancies.map((discrepancy, index) => (
                <DiscrepancyRow
                  key={index}
                  discrepancy={discrepancy}
                  parentName={parentName}
                  childrenName={childrenName}
                />
              ))}

              {/* Explanation */}
              <div className={`mt-3 pt-3 border-t ${hasErrors ? 'border-red-200' : 'border-yellow-200'}`}>
                <p className={`text-xs ${textColor} opacity-70`}>
                  {hasErrors ? (
                    <>
                      <strong>Why this happens:</strong> This can occur due to different date filtering,
                      removed entities not fully processed, or API timing differences.
                      Try refreshing the data or verify the date range matches across all views.
                    </>
                  ) : (
                    <>
                      <strong>Note:</strong> Minor differences are normal due to rounding,
                      conversion attribution windows, or recently paused/removed entities.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscrepancyRow({
  discrepancy,
  parentName,
  childrenName,
}: {
  discrepancy: MetricDiscrepancy;
  parentName: string;
  childrenName: string;
}) {
  const severityStyle = {
    error: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
  }[discrepancy.severity];

  const metricLabel = discrepancy.metric === 'cost' ? 'Spend' :
    discrepancy.metric.charAt(0).toUpperCase() + discrepancy.metric.slice(1);

  const formatValue = (value: number) => {
    if (discrepancy.metric === 'cost' || discrepancy.metric === 'conversionsValue') {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (discrepancy.metric === 'conversions') {
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString('en-US');
  };

  return (
    <div className={`rounded-md px-3 py-2 text-xs ${severityStyle}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{metricLabel}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
          discrepancy.severity === 'error' ? 'bg-red-200' :
          discrepancy.severity === 'warning' ? 'bg-yellow-200' : 'bg-blue-200'
        }`}>
          {discrepancy.percentDiff > 0 ? '+' : ''}{discrepancy.percentDiff.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 flex gap-4 text-[11px] opacity-80">
        <span>{parentName}: {formatValue(discrepancy.parentValue)}</span>
        <span>{childrenName} sum: {formatValue(discrepancy.childSum)}</span>
      </div>
    </div>
  );
}
