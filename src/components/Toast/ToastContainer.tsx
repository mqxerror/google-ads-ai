'use client';

import { useEffect, useState } from 'react';
import { useToast, Toast } from './ToastProvider';

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleUndo = () => {
    if (toast.undoAction) {
      toast.undoAction();
    }
    handleClose();
  };

  const typeStyles = {
    success: {
      bg: 'bg-green-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-blue-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-amber-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-red-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const style = typeStyles[toast.type];

  return (
    <div
      className={`transform transition-all duration-300 ease-out ${
        isExiting
          ? 'translate-x-full opacity-0'
          : 'translate-x-0 opacity-100'
      }`}
    >
      <div
        className={`${style.bg} flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg min-w-[300px] max-w-[420px]`}
      >
        <span className="flex-shrink-0">{style.icon}</span>
        <span className="flex-1 text-sm font-medium">{toast.message}</span>

        {/* Undo button */}
        {toast.undoAction && (
          <button
            onClick={handleUndo}
            className="flex-shrink-0 rounded px-2 py-1 text-sm font-semibold hover:bg-white/20 transition-colors"
          >
            Undo
          </button>
        )}

        {/* Custom action button */}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleClose();
            }}
            className="flex-shrink-0 rounded px-2 py-1 text-sm font-semibold hover:bg-white/20 transition-colors"
          >
            {toast.action.label}
          </button>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 rounded p-1 hover:bg-white/20 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, queuedCount, removeToast } = useToast();

  // Position at bottom-right, above mobile nav on mobile
  return (
    <div className="fixed bottom-20 right-4 z-[200] flex flex-col gap-2 md:bottom-4">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
      {/* Show queued count badge */}
      {queuedCount > 0 && (
        <div className="flex items-center justify-end">
          <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-white shadow-lg">
            +{queuedCount} more notification{queuedCount > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
