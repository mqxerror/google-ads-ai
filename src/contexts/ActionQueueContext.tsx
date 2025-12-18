'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  QueuedAction,
  ActionType,
  EntityType,
  ActionStatus,
  calculateRiskLevel,
} from '@/types/action-queue';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface ActionQueueContextType {
  actions: QueuedAction[];
  pendingCount: number;
  isExecuting: boolean;
  toasts: ToastMessage[];
  addAction: (action: Omit<QueuedAction, 'id' | 'status' | 'createdAt' | 'riskLevel'> & { aiScore?: number }) => void;
  removeAction: (id: string) => void;
  approveAction: (id: string) => void;
  rejectAction: (id: string) => void;
  approveAll: () => void;
  rejectAll: () => void;
  clearCompleted: () => void;
  clearAll: () => void;
  executeApproved: () => Promise<void>;
  dismissToast: (id: string) => void;
}

const ActionQueueContext = createContext<ActionQueueContextType | undefined>(undefined);

export function ActionQueueProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<QueuedAction[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pendingCount = actions.filter(a => a.status === 'pending' || a.status === 'approved').length;

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addAction = useCallback((
    action: Omit<QueuedAction, 'id' | 'status' | 'createdAt' | 'riskLevel'> & { aiScore?: number }
  ) => {
    const riskLevel = calculateRiskLevel(
      action.actionType,
      action.entityType,
      action.currentValue,
      action.newValue,
      action.aiScore
    );

    const newAction: QueuedAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: new Date(),
      riskLevel,
    };

    setActions(prev => {
      const newActions = [...prev, newAction];
      const pendingCount = newActions.filter(a => a.status === 'pending').length;
      showToast(`Action added to queue (${pendingCount} pending)`, riskLevel === 'high' ? 'warning' : 'info');
      return newActions;
    });
  }, [showToast]);

  const removeAction = useCallback((id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
  }, []);

  const updateActionStatus = useCallback((id: string, status: ActionStatus) => {
    setActions(prev => prev.map(a =>
      a.id === id ? { ...a, status } : a
    ));
  }, []);

  const approveAction = useCallback((id: string) => {
    updateActionStatus(id, 'approved');
  }, [updateActionStatus]);

  const rejectAction = useCallback((id: string) => {
    updateActionStatus(id, 'rejected');
  }, [updateActionStatus]);

  const approveAll = useCallback(() => {
    setActions(prev => prev.map(a =>
      a.status === 'pending' ? { ...a, status: 'approved' } : a
    ));
  }, []);

  const rejectAll = useCallback(() => {
    setActions(prev => prev.map(a =>
      a.status === 'pending' ? { ...a, status: 'rejected' } : a
    ));
  }, []);

  const clearCompleted = useCallback(() => {
    setActions(prev => prev.filter(a =>
      a.status !== 'completed' && a.status !== 'rejected' && a.status !== 'failed'
    ));
  }, []);

  const clearAll = useCallback(() => {
    setActions([]);
  }, []);

  const executeApproved = useCallback(async () => {
    const approvedActions = actions.filter(a => a.status === 'approved');
    if (approvedActions.length === 0) return;

    setIsExecuting(true);

    // Mark all approved as executing
    setActions(prev => prev.map(a =>
      a.status === 'approved' ? { ...a, status: 'executing' } : a
    ));

    // Execute each action sequentially
    for (const action of approvedActions) {
      try {
        // Call the API to execute the action
        const response = await fetch('/api/actions/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Execution failed');
        }

        // Mark as completed
        setActions(prev => prev.map(a =>
          a.id === action.id ? { ...a, status: 'completed', executedAt: new Date() } : a
        ));
      } catch (error) {
        // Mark as failed
        setActions(prev => prev.map(a =>
          a.id === action.id ? {
            ...a,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          } : a
        ));
      }
    }

    setIsExecuting(false);
  }, [actions]);

  return (
    <ActionQueueContext.Provider value={{
      actions,
      pendingCount,
      isExecuting,
      toasts,
      addAction,
      removeAction,
      approveAction,
      rejectAction,
      approveAll,
      rejectAll,
      clearCompleted,
      clearAll,
      executeApproved,
      dismissToast,
    }}>
      {children}
    </ActionQueueContext.Provider>
  );
}

export function useActionQueue() {
  const context = useContext(ActionQueueContext);
  if (context === undefined) {
    throw new Error('useActionQueue must be used within an ActionQueueProvider');
  }
  return context;
}
