'use client';

/**
 * Data Freshness Indicator
 *
 * Shows users when data was last updated and if a refresh is in progress.
 * Builds trust by making cache behavior transparent.
 *
 * Usage:
 * <DataFreshnessIndicator
 *   lastUpdated={new Date()}
 *   isRefreshing={false}
 *   cacheState="fresh" | "stale" | "expired"
 * />
 */

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface DataFreshnessIndicatorProps {
  /** When the data was last updated */
  lastUpdated?: Date | string | null;
  /** Whether a background refresh is in progress */
  isRefreshing?: boolean;
  /** Cache state for styling */
  cacheState?: 'fresh' | 'stale' | 'expired' | 'unknown';
  /** Source label (e.g., "DB Cache", "Hybrid (80% DB, 20% API)") */
  sourceLabel?: string;
  /** Pending API chunks being fetched */
  pendingApiChunks?: number;
  /** Coverage percentage from cache */
  coveragePercent?: number;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

export default function DataFreshnessIndicator({
  lastUpdated,
  isRefreshing = false,
  cacheState = 'unknown',
  sourceLabel,
  pendingApiChunks,
  coveragePercent,
  compact = false,
  className = '',
}: DataFreshnessIndicatorProps) {
  const [, setTick] = useState(0);

  // Update every minute to keep "X minutes ago" fresh
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Parse date if string
  const updatedDate = lastUpdated
    ? typeof lastUpdated === 'string'
      ? new Date(lastUpdated)
      : lastUpdated
    : null;

  // Format the time ago string
  const timeAgo = updatedDate
    ? formatDistanceToNow(updatedDate, { addSuffix: true })
    : null;

  // Get state-based styles
  const getStateStyles = () => {
    switch (cacheState) {
      case 'fresh':
        return 'text-green-600';
      case 'stale':
        return 'text-yellow-600';
      case 'expired':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const getStateDot = () => {
    switch (cacheState) {
      case 'fresh':
        return 'bg-green-500';
      case 'stale':
        return 'bg-yellow-500';
      case 'expired':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 text-xs ${className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : getStateDot()}`} />
        {isRefreshing ? (
          <span className="text-blue-600">
            Refreshing{pendingApiChunks ? ` (${pendingApiChunks} chunks)` : '...'}
          </span>
        ) : timeAgo ? (
          <span className={getStateStyles()}>{timeAgo}</span>
        ) : (
          <span className="text-gray-400">No data</span>
        )}
        {sourceLabel && !isRefreshing && (
          <span className="text-gray-400 border-l border-gray-200 pl-1.5">{sourceLabel}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : getStateDot()}`} />
        {isRefreshing ? (
          <span className="text-blue-600 font-medium">
            Refreshing data{pendingApiChunks ? ` (${pendingApiChunks} API chunks)` : '...'}
          </span>
        ) : (
          <span className={`${getStateStyles()}`}>
            {timeAgo ? `Updated ${timeAgo}` : 'No cached data'}
          </span>
        )}
      </div>

      {/* Source label */}
      {sourceLabel && !isRefreshing && (
        <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
          {sourceLabel}
        </span>
      )}

      {/* Coverage indicator for hybrid sources */}
      {coveragePercent !== undefined && coveragePercent < 100 && !isRefreshing && (
        <span className="text-blue-600 text-[10px] bg-blue-50 px-1.5 py-0.5 rounded">
          {coveragePercent}% from cache
        </span>
      )}

      {cacheState === 'stale' && !isRefreshing && (
        <span className="text-yellow-600 text-[10px] bg-yellow-50 px-1.5 py-0.5 rounded">
          Background refresh queued
        </span>
      )}
    </div>
  );
}
