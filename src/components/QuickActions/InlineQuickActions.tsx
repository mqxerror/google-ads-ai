'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void | Promise<void>;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
}

interface InlineQuickActionsProps {
  actions: QuickAction[];
  visible?: boolean;
  position?: 'left' | 'right';
  compact?: boolean;
}

// Loading spinner component
const LoadingSpinner = ({ size = 'default' }: { size?: 'compact' | 'default' }) => (
  <svg
    className={`animate-spin ${size === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default function InlineQuickActions({
  actions,
  visible = true,
  position = 'right',
  compact = false,
}: InlineQuickActionsProps) {
  const [showMore, setShowMore] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  // Show first 3 actions, rest in dropdown
  const primaryActions = actions.slice(0, 3);
  const overflowActions = actions.slice(3);

  // Handle action click with loading state
  const handleActionClick = useCallback(async (action: QuickAction, e: React.MouseEvent) => {
    e.stopPropagation();

    // If action provides its own loading state, just call onClick
    if (action.loading !== undefined) {
      action.onClick();
      return;
    }

    // Otherwise, manage loading state internally
    setLoadingStates((prev) => ({ ...prev, [action.id]: true }));
    try {
      await action.onClick();
    } finally {
      setLoadingStates((prev) => ({ ...prev, [action.id]: false }));
    }
  }, []);

  // Check if action is loading (either from prop or internal state)
  const isActionLoading = useCallback((action: QuickAction) => {
    return action.loading ?? loadingStates[action.id] ?? false;
  }, [loadingStates]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!visible || actions.length === 0) return null;

  const getVariantClasses = (variant: QuickAction['variant']) => {
    switch (variant) {
      case 'success':
        return 'text-green-600 hover:bg-green-50 hover:text-green-700';
      case 'warning':
        return 'text-amber-600 hover:bg-amber-50 hover:text-amber-700';
      case 'danger':
        return 'text-red-600 hover:bg-red-50 hover:text-red-700';
      default:
        return 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';
    }
  };

  return (
    <div
      className={`flex items-center gap-1 ${
        position === 'left' ? 'justify-start' : 'justify-end'
      }`}
    >
      {primaryActions.map((action) => {
        const loading = isActionLoading(action);
        return (
          <div key={action.id} className="group relative">
            <button
              onClick={(e) => handleActionClick(action, e)}
              disabled={action.disabled || loading}
              aria-busy={loading}
              aria-label={loading ? `${action.label} loading` : action.label}
              className={`${
                compact ? 'p-1' : 'p-1.5'
              } rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${getVariantClasses(
                action.variant
              )}`}
            >
              <span className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}>
                {loading ? <LoadingSpinner size={compact ? 'compact' : 'default'} /> : action.icon}
              </span>
            </button>
            {/* Tooltip */}
            {action.tooltip && !loading && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block pointer-events-none z-50">
                <div className="rounded bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap">
                  {action.tooltip}
                </div>
              </div>
            )}
            {/* Loading tooltip */}
            {loading && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block pointer-events-none z-50">
                <div className="rounded bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap">
                  Loading...
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Overflow Menu */}
      {overflowActions.length > 0 && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMore(!showMore);
            }}
            className={`${
              compact ? 'p-1' : 'p-1.5'
            } rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors`}
          >
            <svg className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>

          {showMore && (
            <div
              className={`absolute ${
                position === 'left' ? 'left-0' : 'right-0'
              } top-full mt-1 z-50 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg`}
              role="menu"
              aria-label="More actions"
            >
              {overflowActions.map((action) => {
                const loading = isActionLoading(action);
                return (
                  <button
                    key={action.id}
                    role="menuitem"
                    onClick={async (e) => {
                      await handleActionClick(action, e);
                      if (!loading) setShowMore(false);
                    }}
                    disabled={action.disabled || loading}
                    aria-busy={loading}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:opacity-40 disabled:cursor-not-allowed ${getVariantClasses(
                      action.variant
                    )}`}
                  >
                    <span className="h-4 w-4">
                      {loading ? <LoadingSpinner /> : action.icon}
                    </span>
                    <span>{loading ? `${action.label}...` : action.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
