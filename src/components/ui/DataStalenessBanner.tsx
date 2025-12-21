'use client';

/**
 * DataStalenessBanner - Shows when data is stale or expired
 *
 * Displays a dismissible banner with:
 * - Clear indication of data freshness state
 * - How old the data is
 * - Refresh button
 * - Auto-hides for fresh data
 */

import { useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface DataStalenessBannerProps {
  cacheState: 'fresh' | 'stale' | 'expired' | 'unknown';
  lastSyncedAt: string | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  entityType?: 'campaigns' | 'ad groups' | 'keywords';
}

export default function DataStalenessBanner({
  cacheState,
  lastSyncedAt,
  isRefreshing,
  onRefresh,
  entityType = 'campaigns',
}: DataStalenessBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    // Auto-restore after 5 minutes
    setTimeout(() => setIsDismissed(false), 5 * 60 * 1000);
  }, []);

  // Don't show for fresh data or if dismissed
  if (cacheState === 'fresh' || isDismissed) {
    return null;
  }

  const formatAge = () => {
    if (!lastSyncedAt) return 'unknown time';
    try {
      return formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true });
    } catch {
      return 'unknown time';
    }
  };

  const isExpired = cacheState === 'expired';
  const isUnknown = cacheState === 'unknown';

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 text-sm border-b ${
        isExpired
          ? 'bg-red-50 border-red-200 text-red-800'
          : isUnknown
          ? 'bg-slate-50 border-slate-200 text-slate-700'
          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Icon */}
        {isExpired || isUnknown ? (
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        ) : (
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}

        {/* Message */}
        <span>
          {isExpired ? (
            <>
              <strong>Data expired.</strong> {entityType.charAt(0).toUpperCase() + entityType.slice(1)} data was last updated{' '}
              {formatAge()}. Refresh recommended.
            </>
          ) : isUnknown ? (
            <>
              <strong>Data freshness unknown.</strong> Unable to determine when {entityType} were last synced.
            </>
          ) : (
            <>
              <strong>Data may be stale.</strong> {entityType.charAt(0).toUpperCase() + entityType.slice(1)} data was last updated{' '}
              {formatAge()}.
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              isExpired
                ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                : 'bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50'
            }`}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        )}

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="p-1 rounded hover:bg-black/10 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
