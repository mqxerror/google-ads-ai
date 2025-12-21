'use client';

/**
 * Data Freshness Strip - User-facing trust indicator
 *
 * Shows data freshness in a clean, agency-friendly way:
 * - Last updated timestamp (human readable)
 * - Refreshing state with subtle animation
 * - Source label (simplified for client presentations)
 *
 * Designed to build trust when agencies show dashboards to clients.
 */

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface DataFreshnessStripProps {
  /** When the data was last updated */
  lastUpdated?: Date | string | null;
  /** Whether data is currently being refreshed */
  isRefreshing?: boolean;
  /** Number of pending refresh jobs */
  pendingJobs?: number;
  /** Data source (simplified: 'live' | 'cached' | 'partial') */
  dataSource?: 'live' | 'cached' | 'partial';
  /** Coverage percentage (only shown when partial) */
  coveragePercent?: number;
  /** Show simplified labels for client presentations */
  clientMode?: boolean;
  /** Optional class name */
  className?: string;
}

export default function DataFreshnessStrip({
  lastUpdated,
  isRefreshing = false,
  pendingJobs = 0,
  dataSource = 'cached',
  coveragePercent,
  clientMode = false,
  className = '',
}: DataFreshnessStripProps) {
  const [, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Update every minute to keep time display fresh
  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Parse date
  const updatedDate = lastUpdated
    ? typeof lastUpdated === 'string'
      ? new Date(lastUpdated)
      : lastUpdated
    : null;

  // Format for display (only after mount to avoid hydration issues)
  const timeAgo = mounted && updatedDate
    ? formatDistanceToNow(updatedDate, { addSuffix: true })
    : null;

  // Determine status color
  const getStatusColor = () => {
    if (isRefreshing) return 'text-blue-600';
    if (!updatedDate) return 'text-gray-400';

    const ageMinutes = (Date.now() - updatedDate.getTime()) / 60000;
    if (ageMinutes < 5) return 'text-green-600';
    if (ageMinutes < 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusDot = () => {
    if (isRefreshing) return 'bg-blue-500';
    if (!updatedDate) return 'bg-gray-300';

    const ageMinutes = (Date.now() - updatedDate.getTime()) / 60000;
    if (ageMinutes < 5) return 'bg-green-500';
    if (ageMinutes < 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Get user-friendly source label
  const getSourceLabel = () => {
    if (clientMode) {
      // Simplified labels for client presentations
      return 'Live Data';
    }
    switch (dataSource) {
      case 'live':
        return 'Live from Google Ads';
      case 'partial':
        return coveragePercent
          ? `${coveragePercent}% cached, ${100 - coveragePercent}% live`
          : 'Partial refresh';
      case 'cached':
      default:
        return 'From cache';
    }
  };

  // Show skeleton during SSR
  if (!mounted) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-400 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 text-xs ${className}`}>
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${getStatusDot()} ${isRefreshing ? 'animate-pulse' : ''}`}
        />
        <span className={getStatusColor()}>
          {isRefreshing ? (
            <span className="flex items-center gap-1">
              <span>Refreshing</span>
              {pendingJobs > 0 && (
                <span className="text-gray-400">({pendingJobs} pending)</span>
              )}
              <LoadingDots />
            </span>
          ) : timeAgo ? (
            `Updated ${timeAgo}`
          ) : (
            'No data yet'
          )}
        </span>
      </div>

      {/* Source indicator (hidden in client mode) */}
      {!clientMode && dataSource !== 'cached' && !isRefreshing && (
        <span className="text-gray-400 border-l border-gray-200 pl-3">
          {getSourceLabel()}
        </span>
      )}
    </div>
  );
}

// Animated loading dots
function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-0.5">
      <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

// Export hook for easy consumption
export function useDataFreshness(cacheMeta?: {
  lastSyncedAt: string | null;
  refreshing: boolean;
  source?: 'cache' | 'api' | 'hybrid';
  coverage?: { percentCached: number } | null;
  pendingApiChunks?: number;
}): DataFreshnessStripProps {
  if (!cacheMeta) {
    return {
      lastUpdated: null,
      isRefreshing: false,
      dataSource: 'cached',
    };
  }

  let dataSource: 'live' | 'cached' | 'partial' = 'cached';
  if (cacheMeta.source === 'api') {
    dataSource = 'live';
  } else if (cacheMeta.source === 'hybrid') {
    dataSource = 'partial';
  }

  return {
    lastUpdated: cacheMeta.lastSyncedAt,
    isRefreshing: cacheMeta.refreshing,
    pendingJobs: cacheMeta.pendingApiChunks || 0,
    dataSource,
    coveragePercent: cacheMeta.coverage?.percentCached,
  };
}
