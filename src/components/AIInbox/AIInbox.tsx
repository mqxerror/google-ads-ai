'use client';

import { useState } from 'react';
import { CampaignIssue, RecommendedFix, ConfidenceLevel } from '@/types/health';
import AIInboxTask from './AIInboxTask';

export interface AITask {
  id: string;
  campaignId: string;
  campaignName: string;
  issue: CampaignIssue;
  recommendedFix: RecommendedFix;
  priority: number; // 1-100, higher = more urgent
  estimatedTimeMinutes: number;
  createdAt: Date;
  status: 'pending' | 'applied' | 'scheduled' | 'dismissed' | 'needs_approval';
}

interface AIInboxProps {
  tasks: AITask[];
  isOpen: boolean;
  onClose: () => void;
  onApplyTask?: (task: AITask) => void;
  onScheduleTask?: (task: AITask, scheduleDate: Date) => void;
  onRequestApproval?: (task: AITask) => void;
  onDismissTask?: (task: AITask, reason?: string) => void;
  onViewDetails?: (task: AITask) => void;
}

export default function AIInbox({
  tasks,
  isOpen,
  onClose,
  onApplyTask,
  onScheduleTask,
  onRequestApproval,
  onDismissTask,
  onViewDetails,
}: AIInboxProps) {
  const [filter, setFilter] = useState<'all' | 'high' | 'quick'>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filter === 'high') return task.priority >= 75;
    if (filter === 'quick') return task.estimatedTimeMinutes <= 5;
    return task.status === 'pending';
  });

  // Sort by priority
  const sortedTasks = [...filteredTasks].sort((a, b) => b.priority - a.priority);

  // Stats
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const highPriorityCount = tasks.filter((t) => t.status === 'pending' && t.priority >= 75).length;
  const totalImpact = tasks
    .filter((t) => t.status === 'pending')
    .reduce((sum, t) => sum + (t.recommendedFix.impactRange.max || 0), 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer - Right side */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md transform overflow-hidden bg-white shadow-2xl transition-transform sm:max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">AI Inbox</h2>
              {pendingCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {pendingCount}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              AI-generated recommendations
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

        {/* Stats Bar */}
        <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Pending
            </p>
            <p className="text-lg font-bold text-slate-900">{pendingCount}</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              High Priority
            </p>
            <p className="text-lg font-bold text-rose-600">{highPriorityCount}</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Est. Impact
            </p>
            <p className="text-lg font-bold text-emerald-600">
              ${totalImpact.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 px-6 py-2">
          {[
            { id: 'all', label: 'All Pending' },
            { id: 'high', label: 'High Priority' },
            { id: 'quick', label: 'Quick Wins' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4" style={{ height: 'calc(100vh - 280px)' }}>
          {sortedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">All caught up!</h3>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                No pending AI recommendations. Check back later for new optimization opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <AIInboxTask
                  key={task.id}
                  task={task}
                  isExpanded={expandedTaskId === task.id}
                  onToggleExpand={() =>
                    setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
                  }
                  onApply={() => onApplyTask?.(task)}
                  onSchedule={(date) => onScheduleTask?.(task, date)}
                  onRequestApproval={() => onRequestApproval?.(task)}
                  onDismiss={(reason) => onDismissTask?.(task, reason)}
                  onViewDetails={() => onViewDetails?.(task)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                // Apply all quick wins
                sortedTasks
                  .filter((t) => t.estimatedTimeMinutes <= 5 && t.recommendedFix.risk === 'low')
                  .forEach((t) => onApplyTask?.(t));
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Apply All Quick Wins
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
