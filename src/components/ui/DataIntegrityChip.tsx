'use client';

/**
 * Data Integrity Chip - Displays hierarchy validation warnings
 *
 * Shows when sampled hierarchy validation detects issues like:
 * - Campaign spend != SUM(ad group spend)
 * - Click/impression discrepancies
 *
 * Links to diagnostics for detailed investigation.
 */

import { useState } from 'react';
import { HierarchyValidationSummary } from '@/lib/cache/hybrid-fetch';

interface DataIntegrityChipProps {
  validation?: HierarchyValidationSummary;
  customerId?: string;
  className?: string;
}

export default function DataIntegrityChip({
  validation,
  customerId,
  className = '',
}: DataIntegrityChipProps) {
  const [showPopover, setShowPopover] = useState(false);

  // Don't render if no validation or no issues
  if (!validation || !validation.hasIssues) {
    return null;
  }

  const severityStyles = {
    ok: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    error: 'bg-red-100 text-red-700 border-red-200',
  };

  const severityIcons = {
    ok: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    warning: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    error: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const handleChipClick = () => {
    setShowPopover(!showPopover);
  };

  const handleViewDiagnostics = () => {
    // Navigate to diagnostics with customerId pre-filled
    const url = customerId
      ? `/admin/diagnostics?customerId=${customerId}`
      : '/admin/diagnostics';
    window.open(url, '_blank');
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Chip Button */}
      <button
        onClick={handleChipClick}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium
          rounded-full border cursor-pointer transition-all
          hover:shadow-sm
          ${severityStyles[validation.severity]}
        `}
        title="Data integrity check"
      >
        {severityIcons[validation.severity]}
        <span>Verify Data</span>
      </button>

      {/* Popover */}
      {showPopover && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
          />

          {/* Popover content */}
          <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            {/* Header */}
            <div className="flex items-start gap-2 mb-3">
              <div className={`flex-shrink-0 p-1 rounded ${
                validation.severity === 'error' ? 'bg-red-100' : 'bg-yellow-100'
              }`}>
                {severityIcons[validation.severity]}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  Data Consistency Check
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sampled {validation.sampledEntities} campaigns
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-600">Issues found:</span>
                <span className={`font-medium ${
                  validation.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                }`}>
                  {validation.issueCount}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Max variance:</span>
                <span className="font-medium text-gray-900">
                  {validation.worstVariance.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Sample mismatches */}
            {validation.sampleMismatches.length > 0 && (
              <div className="mb-3">
                <h5 className="text-xs font-medium text-gray-700 mb-2">
                  Sample discrepancies:
                </h5>
                <ul className="space-y-1.5">
                  {validation.sampleMismatches.map((mismatch, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-gray-600 flex items-start gap-1.5"
                    >
                      <span className="text-gray-400">•</span>
                      <span>
                        <span className="font-medium">{mismatch.entityName.slice(0, 20)}...</span>
                        {' '}({mismatch.metric}: {mismatch.variance.toFixed(1)}% off)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Help text */}
            <p className="text-xs text-gray-500 mb-3">
              Small variances are normal due to attribution timing.
              Large variances may indicate sync issues.
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleViewDiagnostics}
                className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-700 py-1.5 px-3 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                View Diagnostics
              </button>
              <button
                onClick={() => setShowPopover(false)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 py-1.5 px-3 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
