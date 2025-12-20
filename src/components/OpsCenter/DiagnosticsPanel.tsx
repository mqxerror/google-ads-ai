'use client';

/**
 * Diagnostics Panel - Cache & Queue Status for Ops Center
 *
 * Shows:
 * - Cache status banner (source, age, refreshing)
 * - DB cache stats (row counts, oldest/newest dates)
 * - Queue stats (waiting/active/failed)
 * - Recent jobs with status
 * - "Refresh now" button
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { formatDistanceToNow } from 'date-fns';

interface DiagnosticsData {
  cache: {
    source: 'cache' | 'api' | 'unknown';
    ageSeconds: number | null;
    lastSyncedAt: string | null;
    refreshing: boolean;
    rowCount: number;
    oldestDate: string | null;
    newestDate: string | null;
  };
  queue: {
    ready: boolean;
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
    paused: boolean;
    successRate24h: number | null;
    jobsLast24h: number;
  };
  recentJobs: Array<{
    id: string;
    type: string;
    status: string;
    durationMs: number | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
  backoff: {
    inBackoff: boolean;
    backoffRemaining: number | null;
  };
}

export default function DiagnosticsPanel() {
  const { currentAccount } = useAccount();
  const { dateRange } = useCampaignsData();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDiagnostics = useCallback(async () => {
    if (!currentAccount?.googleAccountId) return;

    try {
      setLoading(true);

      // Fetch cache status for current account/date range
      const cacheParams = new URLSearchParams({
        customerId: currentAccount.googleAccountId,
        entityType: 'campaigns',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const [cacheRes, queueRes] = await Promise.all([
        fetch(`/api/admin/cache?${cacheParams}`).catch(() => null),
        fetch('/api/admin/queue?includeDbLogs=true&limit=10').catch(() => null),
      ]);

      // Parse responses (handle auth failures gracefully)
      const cacheData = cacheRes?.ok ? await cacheRes.json() : null;
      const queueData = queueRes?.ok ? await queueRes.json() : null;

      setData({
        cache: {
          source: cacheData?.exists ? 'cache' : 'unknown',
          ageSeconds: cacheData?.age ? Math.round(cacheData.age / 1000) : null,
          lastSyncedAt: cacheData?.lastUpdatedAt || null,
          refreshing: cacheData?.refreshRunning || false,
          rowCount: 0, // Would need additional query
          oldestDate: null,
          newestDate: null,
        },
        queue: {
          ready: queueData?.queueReady || false,
          waiting: queueData?.stats?.waiting || 0,
          active: queueData?.stats?.active || 0,
          failed: queueData?.stats?.failed || 0,
          delayed: queueData?.stats?.delayed || 0,
          paused: queueData?.stats?.paused || false,
          successRate24h: queueData?.successRate24h,
          jobsLast24h: queueData?.jobsLast24h || 0,
        },
        recentJobs: (queueData?.dbJobLogs || []).map((job: {
          id: string;
          jobType: string;
          status: string;
          durationMs: number | null;
          errorMessage: string | null;
          createdAt: string;
        }) => ({
          id: job.id,
          type: job.jobType.replace('refresh:', ''),
          status: job.status,
          durationMs: job.durationMs,
          errorMessage: job.errorMessage,
          createdAt: job.createdAt,
        })),
        backoff: {
          inBackoff: cacheData?.inBackoff || false,
          backoffRemaining: cacheData?.backoffRemaining || null,
        },
      });
      setError(null);
    } catch (err) {
      setError('Failed to load diagnostics');
      console.error('[Diagnostics] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.googleAccountId, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [fetchDiagnostics]);

  const handleRefreshNow = async () => {
    if (!currentAccount?.googleAccountId) return;

    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refresh',
          customerId: currentAccount.googleAccountId,
          entityType: 'campaigns',
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Refresh failed');
      }

      // Refetch diagnostics after enqueue
      await fetchDiagnostics();
    } catch (err) {
      console.error('[Diagnostics] Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const getCacheStateColor = (ageSeconds: number | null) => {
    if (ageSeconds === null) return 'bg-gray-100 text-gray-600';
    if (ageSeconds < 300) return 'bg-green-100 text-green-700'; // Fresh <5m
    if (ageSeconds < 3600) return 'bg-yellow-100 text-yellow-700'; // Stale 5m-1h
    return 'bg-red-100 text-red-700'; // Expired >1h
  };

  const getCacheStateLabel = (ageSeconds: number | null) => {
    if (ageSeconds === null) return 'Unknown';
    if (ageSeconds < 300) return 'Fresh';
    if (ageSeconds < 3600) return 'Stale';
    return 'Expired';
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-slate-100 rounded-lg" />
        <div className="h-32 bg-slate-100 rounded-lg" />
        <div className="h-48 bg-slate-100 rounded-lg" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <p className="text-sm text-red-700 font-medium">Diagnostics Unavailable</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <p className="text-xs text-slate-500 mt-2">
          This may be due to missing permissions. Contact admin if this persists.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cache Status Banner */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Cache Status</h4>
          <button
            onClick={handleRefreshNow}
            disabled={refreshing || data?.cache.refreshing}
            className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {refreshing || data?.cache.refreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3">
            {/* State Badge */}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getCacheStateColor(data?.cache.ageSeconds ?? null)}`}>
              {getCacheStateLabel(data?.cache.ageSeconds ?? null)}
            </span>

            {/* Age */}
            {data?.cache.lastSyncedAt && (
              <span className="text-sm text-slate-600">
                Updated {formatDistanceToNow(new Date(data.cache.lastSyncedAt), { addSuffix: true })}
              </span>
            )}

            {/* Refreshing indicator */}
            {data?.cache.refreshing && (
              <span className="flex items-center gap-1 text-xs text-blue-600">
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Background refresh in progress
              </span>
            )}
          </div>

          {/* Details Row */}
          <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Source</span>
              <p className="font-medium text-slate-700">{data?.cache.source || 'N/A'}</p>
            </div>
            <div>
              <span className="text-slate-500">Account</span>
              <p className="font-mono font-medium text-slate-700">{currentAccount?.googleAccountId || 'None'}</p>
            </div>
            <div>
              <span className="text-slate-500">Date Range</span>
              <p className="font-medium text-slate-700">{dateRange.startDate} - {dateRange.endDate}</p>
            </div>
          </div>

          {/* Backoff Warning */}
          {data?.backoff.inBackoff && (
            <div className="mt-3 rounded bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
              Rate limited - next refresh in {Math.round((data.backoff.backoffRemaining || 0) / 1000)}s
            </div>
          )}
        </div>
      </div>

      {/* Queue Stats */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            Queue Status
            {data?.queue.ready ? (
              <span className="w-2 h-2 rounded-full bg-green-500" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </h4>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{data?.queue.active || 0}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{data?.queue.waiting || 0}</p>
              <p className="text-xs text-slate-500">Waiting</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{data?.queue.delayed || 0}</p>
              <p className="text-xs text-slate-500">Delayed</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${(data?.queue.failed || 0) > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {data?.queue.failed || 0}
              </p>
              <p className="text-xs text-slate-500">Failed</p>
            </div>
          </div>

          {/* Success Rate */}
          <div className="mt-4 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
            <span className="text-slate-500">24h Success Rate</span>
            <span className="font-semibold text-slate-700">
              {data?.queue.successRate24h != null ? `${data.queue.successRate24h}%` : 'N/A'}
              <span className="font-normal text-slate-500 ml-1">
                ({data?.queue.jobsLast24h || 0} jobs)
              </span>
            </span>
          </div>

          {/* Queue Paused Warning */}
          {data?.queue.paused && (
            <div className="mt-3 rounded bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
              Queue is paused - jobs will not process
            </div>
          )}

          {/* Queue Not Ready Warning */}
          {!data?.queue.ready && (
            <div className="mt-3 rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
              Queue not connected - Redis may be unavailable
            </div>
          )}
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-700">Recent Jobs</h4>
        </div>
        <div className="max-h-48 overflow-auto">
          {(data?.recentJobs?.length || 0) === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              No job history yet
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-600 font-medium">Type</th>
                  <th className="px-3 py-2 text-left text-slate-600 font-medium">Status</th>
                  <th className="px-3 py-2 text-left text-slate-600 font-medium">Duration</th>
                  <th className="px-3 py-2 text-left text-slate-600 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentJobs?.map((job) => (
                  <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono">{job.type}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        job.status === 'completed' ? 'bg-green-100 text-green-700' :
                        job.status === 'failed' ? 'bg-red-100 text-red-700' :
                        job.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDuration(job.durationMs)}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Footer Note */}
      <p className="text-[10px] text-slate-400 text-center">
        Auto-refreshes every 15 seconds
      </p>
    </div>
  );
}
