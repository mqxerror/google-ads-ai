'use client';

import { useState, useMemo } from 'react';
import { useActionQueue } from '@/contexts/ActionQueueContext';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { QueuedAction, getActionLabel, getRiskColor } from '@/types/action-queue';
import { generateAITasks, getTaskStats, getTopTasks, getQuickWins } from '@/lib/ai/task-generator';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/format';

interface OpsCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'action_plan' | 'queue' | 'history';

function ActionItem({ action, onApprove, onReject, onRemove, compact = false }: {
  action: QueuedAction;
  onApprove: () => void;
  onReject: () => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  const formatValue = (value: string | number | boolean) => {
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Paused';
    if (typeof value === 'number') return `$${value.toLocaleString()}`;
    return value;
  };

  const statusStyles = {
    pending: 'border-l-4 border-l-amber-400 bg-amber-50',
    approved: 'border-l-4 border-l-emerald-400 bg-emerald-50',
    rejected: 'border-l-4 border-l-slate-400 bg-slate-50 opacity-60',
    executing: 'border-l-4 border-l-blue-400 bg-blue-50',
    completed: 'border-l-4 border-l-emerald-500 bg-emerald-50',
    failed: 'border-l-4 border-l-rose-500 bg-rose-50',
  };

  return (
    <div className={`rounded-lg p-3 ${statusStyles[action.status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getRiskColor(action.riskLevel)}`}>
              {action.riskLevel}
            </span>
            <span className="text-sm font-medium text-slate-900 truncate">
              {getActionLabel(action.actionType)}
            </span>
          </div>
          <p className="text-sm text-slate-700 truncate">{action.entityName}</p>
          {!compact && (
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span>{formatValue(action.currentValue)}</span>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="font-medium text-slate-700">{formatValue(action.newValue)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {action.status === 'pending' && (
            <>
              <button
                onClick={onApprove}
                className="rounded p-1.5 text-emerald-600 hover:bg-emerald-100"
                title="Approve"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={onReject}
                className="rounded p-1.5 text-rose-600 hover:bg-rose-100"
                title="Reject"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
          {action.status === 'executing' && (
            <svg className="h-4 w-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {action.status === 'completed' && (
            <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OpsCenter({ isOpen, onClose }: OpsCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>('action_plan');
  const { campaigns } = useCampaignsData();
  const {
    actions,
    pendingCount,
    isExecuting,
    approveAction,
    rejectAction,
    removeAction,
    approveAll,
    clearCompleted,
    executeApproved,
  } = useActionQueue();

  // Generate AI tasks from campaigns
  const aiTasks = useMemo(() => generateAITasks(campaigns), [campaigns]);
  const taskStats = useMemo(() => getTaskStats(aiTasks), [aiTasks]);
  const topTasks = useMemo(() => getTopTasks(aiTasks, 5), [aiTasks]);
  const quickWins = useMemo(() => getQuickWins(aiTasks), [aiTasks]);

  const approvedCount = actions.filter(a => a.status === 'approved').length;
  const pendingActions = actions.filter(a => a.status === 'pending');
  const approvedActions = actions.filter(a => a.status === 'approved');
  const executingActions = actions.filter(a => a.status === 'executing');
  const completedActions = actions.filter(a => a.status === 'completed' || a.status === 'failed');

  if (!isOpen) return null;

  const tabs = [
    { id: 'action_plan' as const, label: 'AI Action Plan', count: taskStats.total },
    { id: 'queue' as const, label: 'Queue', count: pendingCount + approvedCount },
    { id: 'history' as const, label: 'History', count: completedActions.length },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer - Right side, larger than AI Inbox */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl transform overflow-hidden bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Ops Center</h2>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              AI-powered operations hub
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    activeTab === tab.id
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ height: 'calc(100vh - 180px)' }}>
          {/* Action Plan Tab */}
          {activeTab === 'action_plan' && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Total Tasks
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {taskStats.total}
                  </p>
                </div>
                <div className="rounded-lg bg-rose-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-rose-600">
                    High Priority
                  </p>
                  <p className="mt-1 text-2xl font-bold text-rose-700">
                    {taskStats.highPriority}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                    Est. Impact
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    {formatCurrency(taskStats.totalEstimatedImpact, { compact: true })}
                  </p>
                </div>
              </div>

              {/* Today's Action Plan */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">
                    Today's Action Plan
                  </h3>
                  <span className="text-xs text-slate-500">
                    ~{taskStats.totalEstimatedTimeMinutes} min total
                  </span>
                </div>

                {topTasks.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                      <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="mt-3 font-medium text-slate-900">All caught up!</p>
                    <p className="mt-1 text-sm text-slate-500">
                      No urgent optimizations needed
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topTasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          task.priority >= 80
                            ? 'bg-rose-100 text-rose-700'
                            : task.priority >= 60
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">
                            {task.issue.label}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {task.campaignName}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-xs">
                            <span className="text-slate-500">
                              ~{task.estimatedTimeMinutes} min
                            </span>
                            <span className="text-emerald-600 font-medium">
                              {task.recommendedFix.expectedImpact}
                            </span>
                          </div>
                        </div>
                        <button className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                          Fix
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Wins */}
              {quickWins.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        QUICK WINS
                      </span>
                      Low risk, high impact
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {quickWins.slice(0, 3).map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg bg-emerald-50 p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-emerald-900">
                            {task.issue.label}
                          </p>
                          <p className="text-xs text-emerald-700">
                            {task.recommendedFix.expectedImpact}
                          </p>
                        </div>
                        <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Queue Tab */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              {/* Executing */}
              {executingActions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">
                    Executing...
                  </h4>
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

              {/* Pending */}
              {pendingActions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                      Pending Review ({pendingActions.length})
                    </h4>
                    <button
                      onClick={approveAll}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
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

              {/* Approved */}
              {approvedActions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                    Ready to Execute ({approvedActions.length})
                  </h4>
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

              {/* Empty State */}
              {actions.filter(a => ['pending', 'approved', 'executing'].includes(a.status)).length === 0 && (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                    <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-900">Queue Empty</h3>
                  <p className="mt-2 max-w-xs text-sm text-slate-500">
                    Queue actions from the campaign grid or AI recommendations
                  </p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {completedActions.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      {completedActions.length} completed actions
                    </span>
                    <button
                      onClick={clearCompleted}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      Clear All
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
                        compact
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                    <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-900">No History</h3>
                  <p className="mt-2 max-w-xs text-sm text-slate-500">
                    Completed actions will appear here
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Execute button for Queue tab */}
        {activeTab === 'queue' && approvedCount > 0 && (
          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              onClick={executeApproved}
              disabled={isExecuting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isExecuting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Executing...
                </span>
              ) : (
                `Execute ${approvedCount} Action${approvedCount > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
