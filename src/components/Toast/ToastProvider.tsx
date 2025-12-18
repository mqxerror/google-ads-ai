'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
  action?: ToastAction;
  undoAction?: () => void;
}

interface ToastContextType {
  toasts: Toast[];
  queuedCount: number;
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => string;
  error: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => string;
  warning: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => string;
  info: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_VISIBLE_TOASTS = 3;
let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [allToasts, setAllToasts] = useState<Toast[]>([]);

  // Only show the first MAX_VISIBLE_TOASTS
  const visibleToasts = allToasts.slice(0, MAX_VISIBLE_TOASTS);
  const queuedCount = Math.max(0, allToasts.length - MAX_VISIBLE_TOASTS);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++toastId}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    setAllToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration (unless duration is 0 for persistent toasts)
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setAllToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) =>
      addToast({ message, type: 'success', ...options }),
    [addToast]
  );

  const error = useCallback(
    (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) =>
      addToast({ message, type: 'error', duration: 8000, ...options }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) =>
      addToast({ message, type: 'warning', ...options }),
    [addToast]
  );

  const info = useCallback(
    (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) =>
      addToast({ message, type: 'info', ...options }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts: visibleToasts, queuedCount, addToast, removeToast, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
