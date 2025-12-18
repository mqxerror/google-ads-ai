'use client';

import { GuardrailResult } from '@/lib/guardrails';

interface GuardrailWarningDialogProps {
  isOpen: boolean;
  result: GuardrailResult;
  onConfirm: () => void;
  onCancel: () => void;
  actionDescription: string;
}

export default function GuardrailWarningDialog({
  isOpen,
  result,
  onConfirm,
  onCancel,
  actionDescription,
}: GuardrailWarningDialogProps) {
  if (!isOpen) return null;

  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onCancel} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
              hasErrors ? 'bg-red-100' : 'bg-yellow-100'
            }`}
          >
            {hasErrors ? (
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {hasErrors ? 'Action Blocked' : 'Proceed with Caution'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">{actionDescription}</p>
          </div>
        </div>

        {/* Errors */}
        {hasErrors && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <h4 className="mb-2 text-sm font-medium text-red-800">Blocked:</h4>
            <ul className="space-y-1">
              {result.errors.map((error, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <h4 className="mb-2 text-sm font-medium text-yellow-800">Warnings:</h4>
            <ul className="space-y-1">
              {result.warnings.map((warning, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-yellow-700">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01"
                    />
                  </svg>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risk Level Badge */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-500">Risk Level:</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              result.riskLevel === 'high'
                ? 'bg-red-100 text-red-700'
                : result.riskLevel === 'medium'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
            }`}
          >
            {result.riskLevel.toUpperCase()}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          {!hasErrors && (
            <button
              onClick={onConfirm}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                result.riskLevel === 'high'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              Proceed Anyway
            </button>
          )}
        </div>
      </div>
    </>
  );
}
