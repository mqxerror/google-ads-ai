'use client';

import { useActionQueue } from '@/contexts/ActionQueueContext';
import { QueuedAction, getActionLabel, getRiskColor } from '@/types/action-queue';

interface ActionQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function ActionItem({ action, onApprove, onReject, onRemove }: {
  action: QueuedAction;
  onApprove: () => void;
  onReject: () => void;
  onRemove: () => void;
}) {
  const formatValue = (value: string | number | boolean) => {
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Paused';
    if (typeof value === 'number') return `$${value.toLocaleString()}`;
    return value;
  };

  const statusStyles = {
    pending: 'border-l-4 border-l-orange-400 bg-orange-50',
    approved: 'border-l-4 border-l-green-400 bg-green-50',
    rejected: 'border-l-4 border-l-gray-400 bg-gray-50 opacity-60',
    executing: 'border-l-4 border-l-blue-400 bg-blue-50',
    completed: 'border-l-4 border-l-green-500 bg-green-50',
    failed: 'border-l-4 border-l-red-500 bg-red-50',
  };

  return (
    <div className={`rounded-lg p-3 ${statusStyles[action.status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getRiskColor(action.riskLevel)}`}>
              {action.riskLevel}
            </span>
            <span className="text-sm font-medium text-gray-900 truncate">
              {getActionLabel(action.actionType)}
            </span>
          </div>
          <p className="text-sm text-gray-700 truncate">{action.entityName}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{formatValue(action.currentValue)}</span>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="font-medium text-gray-700">{formatValue(action.newValue)}</span>
          </div>
          {action.reason && (
            <p className="text-xs text-gray-500 mt-1 italic truncate">{action.reason}</p>
          )}
          {action.error && (
            <p className="text-xs text-red-600 mt-1">{action.error}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {action.status === 'pending' && (
            <>
              <button
                onClick={onApprove}
                className="rounded p-1.5 text-green-600 hover:bg-green-100"
                title="Approve"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={onReject}
                className="rounded p-1.5 text-red-600 hover:bg-red-100"
                title="Reject"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
          {action.status === 'approved' && (
            <span className="text-xs text-green-600 font-medium">Approved</span>
          )}
          {action.status === 'rejected' && (
            <button
              onClick={onRemove}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-200"
              title="Remove"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          {action.status === 'executing' && (
            <svg className="h-4 w-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {action.status === 'completed' && (
            <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {action.status === 'failed' && (
            <button
              onClick={onRemove}
              className="rounded p-1.5 text-red-600 hover:bg-red-100"
              title="Remove"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActionQueueDrawer({ isOpen, onClose }: ActionQueueDrawerProps) {
  const {
    actions,
    pendingCount,
    isExecuting,
    approveAction,
    rejectAction,
    removeAction,
    approveAll,
    clearAll,
    clearCompleted,
    executeApproved,
  } = useActionQueue();

  const approvedCount = actions.filter(a => a.status === 'approved').length;
  const completedCount = actions.filter(a => a.status === 'completed').length;
  const failedCount = actions.filter(a => a.status === 'failed').length;
  const pendingActions = actions.filter(a => a.status === 'pending');
  const approvedActions = actions.filter(a => a.status === 'approved');
  const executingActions = actions.filter(a => a.status === 'executing');
  const completedActions = actions.filter(a => a.status === 'completed' || a.status === 'failed' || a.status === 'rejected');

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-xl border-t border-gray-200 bg-white shadow-xl flex flex-col">
        {/* Handle */}
        <div className="flex justify-center py-2 flex-shrink-0">
          <div className="h-1 w-12 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <span className="font-medium text-gray-900">Action Queue</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                {pendingCount} pending
              </span>
            )}
            {approvedCount > 0 && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-600">
                {approvedCount} approved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">No Pending Actions</h3>
              <p className="max-w-sm text-sm text-gray-500">
                Actions you queue from the Smart Grid will appear here for review before execution.
                All changes require your approval.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Executing Actions */}
              {executingActions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2">Executing...</h4>
                  <div className="space-y-2">
                    {executingActions.map(action => (
                      <ActionItem
                        key={action.id}
                        action={action}
                        onApprove={() => {}}
                        onReject={() => {}}
                        onRemove={() => {}}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Actions */}
              {pendingActions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-orange-700 uppercase">Pending Review</h4>
                    <button
                      onClick={approveAll}
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      Approve All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {pendingActions.map(action => (
                      <ActionItem
                        key={action.id}
                        action={action}
                        onApprove={() => approveAction(action.id)}
                        onReject={() => rejectAction(action.id)}
                        onRemove={() => removeAction(action.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Actions */}
              {approvedActions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-green-700 uppercase mb-2">Ready to Execute</h4>
                  <div className="space-y-2">
                    {approvedActions.map(action => (
                      <ActionItem
                        key={action.id}
                        action={action}
                        onApprove={() => {}}
                        onReject={() => rejectAction(action.id)}
                        onRemove={() => removeAction(action.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed/Failed Actions */}
              {completedActions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase">History</h4>
                    <button
                      onClick={clearCompleted}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-2">
                    {completedActions.map(action => (
                      <ActionItem
                        key={action.id}
                        action={action}
                        onApprove={() => {}}
                        onReject={() => {}}
                        onRemove={() => removeAction(action.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 flex-shrink-0 bg-gray-50">
          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200"
              disabled={actions.length === 0 || isExecuting}
            >
              Clear All
            </button>
            {completedCount > 0 && (
              <span className="text-xs text-gray-500">
                {completedCount} completed
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-xs text-red-500">
                {failedCount} failed
              </span>
            )}
          </div>
          <button
            onClick={executeApproved}
            disabled={approvedCount === 0 || isExecuting}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors ${
              approvedCount > 0 && !isExecuting
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {isExecuting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Executing...
              </span>
            ) : (
              `Execute (${approvedCount})`
            )}
          </button>
        </div>
      </div>
    </>
  );
}
