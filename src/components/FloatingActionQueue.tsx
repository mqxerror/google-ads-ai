'use client';

import { useState } from 'react';
import { useActionQueue } from '@/contexts/ActionQueueContext';
import ActionQueueDrawer from './ActionQueueDrawer';

export default function FloatingActionQueue() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { actions, pendingCount, isExecuting } = useActionQueue();

  const approvedCount = actions.filter(a => a.status === 'approved').length;
  const highRiskCount = actions.filter(a =>
    (a.status === 'pending' || a.status === 'approved') && a.riskLevel === 'high'
  ).length;

  const totalActive = pendingCount + approvedCount;

  // Don't show if no actions
  if (actions.length === 0) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full shadow-lg transition-all hover:scale-105 ${
          isExecuting
            ? 'bg-blue-600 text-white'
            : highRiskCount > 0
            ? 'bg-amber-500 text-white'
            : totalActive > 0
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-600 text-white'
        } px-4 py-3`}
      >
        {isExecuting ? (
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        )}
        <span className="font-medium">
          {isExecuting ? 'Executing...' : `${totalActive} Action${totalActive !== 1 ? 's' : ''}`}
        </span>
        {highRiskCount > 0 && !isExecuting && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
            !
          </span>
        )}
      </button>

      {/* Mini Preview (shows on hover) */}
      {totalActive > 0 && !isDrawerOpen && (
        <div className="fixed bottom-20 right-6 z-30 w-72 rounded-lg border border-gray-200 bg-white shadow-xl opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Quick Preview</p>
          </div>
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
            {actions
              .filter(a => a.status === 'pending' || a.status === 'approved')
              .slice(0, 3)
              .map(action => (
                <div key={action.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${
                    action.status === 'approved' ? 'bg-green-500' : 'bg-orange-500'
                  }`} />
                  <span className="text-gray-900 truncate flex-1">{action.entityName}</span>
                  <span className="text-gray-500 text-xs">{action.actionType.replace('_', ' ')}</span>
                </div>
              ))}
            {totalActive > 3 && (
              <p className="text-xs text-gray-500 text-center">+{totalActive - 3} more</p>
            )}
          </div>
          <div className="p-2 bg-gray-50 border-t border-gray-100 text-center">
            <span className="text-xs text-indigo-600 font-medium">Click to review</span>
          </div>
        </div>
      )}

      {/* Action Queue Drawer */}
      <ActionQueueDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}
