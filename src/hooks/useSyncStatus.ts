'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SyncStatusData {
  status: {
    campaign: string;
    adGroup: string;
    keyword: string;
    lastSync: string | null;
    nextSync: string | null;
  };
  isBackfilling: boolean;
  progress: number;
  daysRemaining: number;
  needsSync: boolean;
}

export interface UseSyncStatusReturn {
  data: SyncStatusData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  triggerSync: (options?: {
    startDate?: string;
    endDate?: string;
    includeToday?: boolean;
    forceRefresh?: boolean;
  }) => Promise<{ success: boolean; message: string }>;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncProgress: number;
}

/**
 * Hook to fetch and manage sync status for a Google Ads account
 *
 * @param accountId - The Google Ads account ID
 * @param options - Configuration options
 * @returns Sync status data and control functions
 */
export function useSyncStatus(
  accountId: string | null,
  options: {
    pollInterval?: number; // in ms, default 30 seconds
    enabled?: boolean;
  } = {}
): UseSyncStatusReturn {
  const { pollInterval = 30000, enabled = true } = options;

  const [data, setData] = useState<SyncStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch sync status
  const fetchStatus = useCallback(async () => {
    if (!accountId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sync/status?accountId=${accountId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch sync status');
      }

      const statusData: SyncStatusData = await response.json();
      setData(statusData);

      // Check if any entity type is syncing
      const isCurrentlySyncing =
        statusData.status.campaign === 'IN_PROGRESS' ||
        statusData.status.adGroup === 'IN_PROGRESS' ||
        statusData.status.keyword === 'IN_PROGRESS' ||
        statusData.isBackfilling;

      setIsSyncing(isCurrentlySyncing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [accountId, enabled]);

  // Trigger manual sync
  const triggerSync = useCallback(
    async (syncOptions: {
      startDate?: string;
      endDate?: string;
      includeToday?: boolean;
      forceRefresh?: boolean;
    } = {}): Promise<{ success: boolean; message: string }> => {
      if (!accountId) {
        return { success: false, message: 'No account selected' };
      }

      try {
        const response = await fetch('/api/sync/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            ...syncOptions,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to trigger sync');
        }

        setIsSyncing(true);

        // Refresh status after triggering
        setTimeout(fetchStatus, 2000);

        return { success: true, message: result.message };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    [accountId, fetchStatus]
  );

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling for updates
  useEffect(() => {
    if (!enabled || !accountId) return;

    const interval = setInterval(fetchStatus, pollInterval);

    return () => clearInterval(interval);
  }, [enabled, accountId, pollInterval, fetchStatus]);

  // Parse lastSync date
  const lastSyncedAt = data?.status.lastSync
    ? new Date(data.status.lastSync)
    : null;

  // Calculate sync progress (average of entity types)
  const syncProgress = data?.isBackfilling ? data.progress : 100;

  return {
    data,
    isLoading,
    error,
    refresh: fetchStatus,
    triggerSync,
    isSyncing,
    lastSyncedAt,
    syncProgress,
  };
}
