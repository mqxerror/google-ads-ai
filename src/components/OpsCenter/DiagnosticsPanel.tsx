'use client';

/**
 * Diagnostics Panel - Cache & Queue Status for Ops Center
 *
 * Shows:
 * - Redis connection status with test button
 * - DB cache stats (actual row counts from MetricsFact)
 * - Queue stats (waiting/active/failed)
 * - Recent jobs with status
 * - "Refresh now" button with inline fallback when queue unavailable
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { formatDistanceToNow } from 'date-fns';

interface DiagnosticsData {
  timestamp: string;
  redis: {
    available: boolean;
    status: string;
    host: string;
    port: number;
    error?: string;
  };
  queue: {
    ready: boolean;
    stats: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: boolean;
    } | null;
  };
  worker: {
    workerId: string;
    lastSeen: string;
    jobsProcessed: number;
    status: 'active' | 'stale' | 'dead';
    ageSeconds: number;
  } | null;
  database: {
    totalRows: number;
    customerIds: number;
    oldestSync: string | null;
    newestSync: string | null;
    byEntityType: Record<string, number>;
    forCurrentQuery?: {
      rows: number;
      oldestDate: string | null;
      newestDate: string | null;
      lastSyncedAt: string | null;
      totalCostMicros: string;
    };
  } | null;
  dbError?: string | null;
  recentJobs: Array<{
    id: string;
    jobType: string;
    customerId: string;
    status: string;
    entityCount: number | null;
    durationMs: number | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
  metrics: {
    hits: number;
    misses: number;
    staleRefreshes: number;
    backgroundRefreshes: number;
    backgroundRefreshErrors: number;
  } | null;
  ttlConfig: {
    freshMinutes: number;
    staleMinutes: number;
    expiredMinutes: number;
  };
  entityCoverageError?: string | null;
  mismatchHistoryError?: string | null;
}

// Error details for better debugging
interface DiagnosticsError {
  message: string;
  status?: number;
  code?: string;
  guidance: string;
}

function parseError(err: unknown, status?: number): DiagnosticsError {
  const message = err instanceof Error ? err.message : String(err);

  // Determine error type and guidance
  if (status === 401 || message.includes('Unauthorized') || message.includes('401')) {
    return {
      message: 'Authentication Required (401)',
      status: 401,
      code: 'AUTH_REQUIRED',
      guidance: 'You need to be signed in. Try refreshing the page or signing in again.',
    };
  }

  if (status === 403 || message.includes('Forbidden') || message.includes('403')) {
    return {
      message: 'Access Denied (403)',
      status: 403,
      code: 'ACCESS_DENIED',
      guidance: 'Diagnostics may require admin access. Check ADMIN_EMAILS in your environment.',
    };
  }

  if (status === 500 || message.includes('500') || message.includes('Internal')) {
    return {
      message: 'Server Error (500)',
      status: 500,
      code: 'SERVER_ERROR',
      guidance: 'Check server logs. This could be a database connection issue or missing env vars.',
    };
  }

  if (message.includes('timeout') || message.includes('Timeout') || message.includes('ETIMEDOUT')) {
    return {
      message: 'Request Timeout',
      status: 408,
      code: 'TIMEOUT',
      guidance: 'The server took too long to respond. Database might be slow or unreachable.',
    };
  }

  if (message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch')) {
    return {
      message: 'Network Error',
      status: 0,
      code: 'NETWORK_ERROR',
      guidance: 'Check your internet connection. The server might be down.',
    };
  }

  return {
    message: message || 'Unknown Error',
    status,
    code: 'UNKNOWN',
    guidance: 'Check browser console and server logs for more details.',
  };
}

export default function DiagnosticsPanel() {
  const { currentAccount } = useAccount();
  const { dateRange, lastSyncedAt, syncStatus, dataCompleteness } = useCampaignsData();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DiagnosticsError | null>(null);
  const [testingRedis, setTestingRedis] = useState(false);
  const [redisTestResult, setRedisTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [prewarmData, setPrewarmData] = useState<{
    enabled: boolean;
    activePrewarms: number;
    customerProgress: {
      totalCampaigns: number;
      queued: string[];
      running: string[];
      completed: string[];
      failed: string[];
      percentComplete: number;
      estimatedRemainingSeconds: number;
    } | null;
  } | null>(null);
  const [triggeringPrewarm, setTriggeringPrewarm] = useState(false);

  const fetchDiagnostics = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (currentAccount?.googleAccountId) {
        params.set('customerId', currentAccount.googleAccountId);
      }
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);

      const res = await fetch(`/api/admin/diagnostics?${params}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { message: errorData.error || `HTTP ${res.status}`, status: res.status };
      }

      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      setError(parseError(err, status));
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.googleAccountId, dateRange.startDate, dateRange.endDate]);

  // Copy debug bundle to clipboard
  const copyDebugBundle = useCallback(async () => {
    const bundle = {
      timestamp: new Date().toISOString(),
      account: {
        id: currentAccount?.id || 'none',
        googleAccountId: currentAccount?.googleAccountId || 'none',
        name: currentAccount?.accountName || 'none',
      },
      dateRange: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        preset: dateRange.preset,
      },
      cache: {
        syncStatus: syncStatus,
        lastSynced: lastSyncedAt?.toISOString() || 'never',
        completeness: dataCompleteness,
        // From diagnostics data if available
        dbCoverage: data?.database?.forCurrentQuery?.rows || 0,
        source: data?.database?.forCurrentQuery ? 'DB Cache' : 'unknown',
      },
      diagnostics: data ? {
        redisConnected: data.redis?.available || false,
        redisHost: data.redis?.host || 'unknown',
        queueReady: data.queue?.ready || false,
        workerStatus: data.worker?.status || 'unknown',
        dbRows: data.database?.totalRows || 0,
        lastJobStatus: data.recentJobs?.[0]?.status || 'none',
        lastJobError: data.recentJobs?.[0]?.errorMessage || null,
      } : {
        error: error?.code || 'FETCH_FAILED',
        message: error?.message || 'Unknown',
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [currentAccount, dateRange, lastSyncedAt, syncStatus, dataCompleteness, data, error]);

  // Fetch prewarm progress
  const fetchPrewarmProgress = useCallback(async () => {
    if (!currentAccount?.googleAccountId) return;

    try {
      const params = new URLSearchParams({
        customerId: currentAccount.googleAccountId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/admin/prewarm?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPrewarmData(data);
      }
    } catch (err) {
      console.warn('[Diagnostics] Failed to fetch prewarm progress:', err);
    }
  }, [currentAccount?.googleAccountId, dateRange.startDate, dateRange.endDate]);

  // Trigger manual prewarm
  const triggerPrewarm = async () => {
    if (!currentAccount?.id || !currentAccount?.googleAccountId) return;

    setTriggeringPrewarm(true);
    try {
      const res = await fetch('/api/admin/prewarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount.id,
          customerId: currentAccount.googleAccountId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      });
      const result = await res.json();
      console.log('[Diagnostics] Prewarm triggered:', result);
      // Refresh prewarm progress
      setTimeout(fetchPrewarmProgress, 1000);
    } catch (err) {
      console.error('[Diagnostics] Failed to trigger prewarm:', err);
    } finally {
      setTriggeringPrewarm(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    fetchPrewarmProgress();
    const interval = setInterval(() => {
      fetchDiagnostics();
      fetchPrewarmProgress();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchDiagnostics, fetchPrewarmProgress]);

  const testRedisConnection = async () => {
    setTestingRedis(true);
    setRedisTestResult(null);
    try {
      const res = await fetch('/api/admin/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_redis' }),
      });
      const result = await res.json();
      setRedisTestResult({
        success: result.success,
        message: result.message,
      });
    } catch (err) {
      setRedisTestResult({
        success: false,
        message: (err as Error).message,
      });
    } finally {
      setTestingRedis(false);
    }
  };

  // Clear ALL cache (localStorage + DB) and reload
  const handleClearAllCache = async () => {
    setClearingCache(true);
    try {
      // 1. Clear localStorage (frontend cache)
      if (typeof window !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('gads-cache-')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`[DiagnosticsPanel] Cleared ${keysToRemove.length} localStorage entries`);
      }

      // 2. Clear DB cache via API (if account is selected)
      if (currentAccount?.googleAccountId) {
        const res = await fetch('/api/admin/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'invalidate-metrics',
            customerId: currentAccount.googleAccountId,
            entityType: 'all',
            startDate: '2020-01-01',
            endDate: '2030-12-31',
          }),
        });
        const result = await res.json();
        console.log(`[DiagnosticsPanel] Cleared ${result.deletedCount || 0} DB rows`);
      }

      // 3. Force page reload to pick up fresh state
      window.location.reload();
    } catch (err) {
      console.error('[DiagnosticsPanel] Clear cache failed:', err);
      setClearingCache(false);
    }
  };

  const handleRefreshNow = async () => {
    if (!currentAccount?.googleAccountId) return;

    setRefreshing(true);
    try {
      // Try to enqueue via queue first
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

      const result = await res.json();

      if (!res.ok) {
        // If queue unavailable, do inline refresh by calling campaigns API directly
        if (result.error?.includes('Queue not available')) {
          // Force refresh by calling API with cache bust
          const apiRes = await fetch(
            `/api/google-ads/campaigns?accountId=${currentAccount.id}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&forceRefresh=true`
          );
          if (!apiRes.ok) {
            throw new Error('Inline refresh failed');
          }
        } else {
          throw new Error(result.error || 'Refresh failed');
        }
      }

      // Refetch diagnostics
      await fetchDiagnostics();
    } catch (err) {
      console.error('[Diagnostics] Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const getCacheState = () => {
    if (!data?.database?.forCurrentQuery?.lastSyncedAt) return 'missing';
    const ageMs = Date.now() - new Date(data.database.forCurrentQuery.lastSyncedAt).getTime();
    const ageMinutes = ageMs / 60000;
    if (ageMinutes < data.ttlConfig.freshMinutes) return 'fresh';
    if (ageMinutes < data.ttlConfig.staleMinutes) return 'stale';
    return 'expired';
  };

  const getCacheStateColor = (state: string) => {
    switch (state) {
      case 'fresh': return 'bg-green-100 text-green-700';
      case 'stale': return 'bg-yellow-100 text-yellow-700';
      case 'expired': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCost = (micros: string) => {
    const dollars = parseInt(micros) / 1_000_000;
    return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      <div className="space-y-4">
        {/* Health Status Card */}
        <div className="rounded-lg border-2 border-red-200 bg-red-50 overflow-hidden">
          <div className="px-4 py-3 bg-red-100 border-b border-red-200 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-red-800 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Diagnostics API: Failed
            </h4>
            <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-mono rounded">
              {error.code}
            </span>
          </div>

          <div className="p-4 space-y-3">
            {/* Error Message */}
            <div>
              <p className="text-sm font-medium text-red-800">{error.message}</p>
              {error.status && (
                <p className="text-xs text-red-600 mt-0.5">HTTP Status: {error.status}</p>
              )}
            </div>

            {/* Guidance */}
            <div className="rounded bg-white/60 border border-red-200 p-3">
              <p className="text-xs font-medium text-red-700 mb-1">What to check:</p>
              <p className="text-xs text-red-600">{error.guidance}</p>
            </div>

            {/* Configuration hint for auth errors */}
            {(error.code === 'AUTH_REQUIRED' || error.code === 'ACCESS_DENIED') && (
              <div className="rounded bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-medium text-amber-800">Configuration Required</p>
                <p className="text-xs text-amber-700 mt-1">
                  For production: Set <code className="bg-amber-100 px-1 rounded">ADMIN_EMAILS</code> env var
                  with comma-separated admin emails.
                </p>
              </div>
            )}

            {/* Retry button */}
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="w-full py-2 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Retrying...' : 'Retry Connection'}
            </button>
          </div>
        </div>

        {/* Copy Debug Bundle - Always available */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700">Debug Bundle</h4>
            <button
              onClick={copyDebugBundle}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Copy diagnostic info for support: account, date range, cache status, error details.
          </p>
        </div>

        {/* Quick health checks */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-700">Quick Health Check</h4>
          </div>
          <div className="p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Diagnostics API</span>
              <span className="flex items-center gap-1.5 text-red-600">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                Unreachable
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Account</span>
              <span className="font-mono">{currentAccount?.googleAccountId || 'Not selected'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Date Range</span>
              <span>{dateRange.startDate} → {dateRange.endDate}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cacheState = getCacheState();
  const queryStats = data?.database?.forCurrentQuery;

  return (
    <div className="space-y-5">
      {/* Health Summary Card - Quick status at a glance */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            System Health
          </h4>
          <button
            onClick={copyDebugBundle}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy Debug Info'}
          </button>
        </div>
        <div className="px-4 pb-3 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${data?.redis?.available ? 'bg-green-500' : 'bg-red-500'}`} />
            Redis
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${data?.queue?.ready ? 'bg-green-500' : 'bg-yellow-500'}`} />
            Queue
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              data?.worker?.status === 'active' ? 'bg-green-500' :
              data?.worker?.status === 'stale' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            Worker
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${(data?.database?.totalRows || 0) > 0 ? 'bg-green-500' : 'bg-yellow-500'}`} />
            DB ({data?.database?.totalRows?.toLocaleString() || 0} rows)
          </span>
        </div>
      </div>

      {/* Partial Error Warnings - Show when some sections failed but API returned data */}
      {(data?.dbError || data?.entityCoverageError || data?.mismatchHistoryError) && (
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-amber-800">Partial Data Available</h5>
              <p className="text-xs text-amber-700 mt-1">
                Some diagnostics sections failed. Core status (Redis, Queue, Worker) is shown above.
              </p>
              <div className="mt-2 space-y-1 text-xs">
                {data.dbError && (
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-medium">DB Stats:</span>
                    <span className="text-amber-700 font-mono text-[10px] break-all">
                      {data.dbError.length > 100 ? data.dbError.substring(0, 100) + '...' : data.dbError}
                    </span>
                  </div>
                )}
                {data.mismatchHistoryError && (
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-medium">Mismatch History:</span>
                    <span className="text-amber-700 font-mono text-[10px]">
                      {data.mismatchHistoryError}
                    </span>
                  </div>
                )}
                {data.entityCoverageError && (
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-medium">Entity Coverage:</span>
                    <span className="text-amber-700 font-mono text-[10px]">
                      {data.entityCoverageError.length > 100 ? data.entityCoverageError.substring(0, 100) + '...' : data.entityCoverageError}
                    </span>
                  </div>
                )}
              </div>
              {data.mismatchHistoryError?.includes('prisma db push') && (
                <div className="mt-2 p-2 rounded bg-amber-100 border border-amber-300">
                  <p className="text-xs text-amber-800">
                    <strong>Action:</strong> Run <code className="bg-amber-200 px-1 rounded">npx prisma db push</code> to create missing tables.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Data Freshness Card - Most Important */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Data Freshness</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAllCache}
              disabled={clearingCache}
              className="px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {clearingCache ? 'Clearing...' : 'Clear All Cache'}
            </button>
            <button
              onClick={handleRefreshNow}
              disabled={refreshing}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getCacheStateColor(cacheState)}`}>
              {cacheState.toUpperCase()}
            </span>
            {queryStats?.lastSyncedAt && (
              <span className="text-sm text-slate-600">
                Last updated {formatDistanceToNow(new Date(queryStats.lastSyncedAt), { addSuffix: true })}
              </span>
            )}
          </div>

          {queryStats ? (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Source</span>
                  <span className="font-medium">{queryStats.rows > 0 ? 'DB Cache' : 'No Data'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cached Rows</span>
                  <span className="font-mono font-medium">{queryStats.rows.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Spend</span>
                  <span className="font-medium">{formatCost(queryStats.totalCostMicros)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date Range</span>
                  <span className="font-medium">{queryStats.oldestDate} - {queryStats.newestDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account</span>
                  <span className="font-mono font-medium">{currentAccount?.googleAccountId || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Query Range</span>
                  <span className="font-medium">{dateRange.startDate} - {dateRange.endDate}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No cache data for current query</p>
          )}

          {/* TTL Info */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
            TTL Policy: Fresh &lt;{data?.ttlConfig.freshMinutes}m | Stale &lt;{data?.ttlConfig.staleMinutes}m | Expired &gt;{data?.ttlConfig.staleMinutes}m
          </div>
        </div>
      </div>

      {/* Pre-warm Progress Card */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            🔥 Smart Pre-warm
            {prewarmData?.customerProgress && prewarmData.customerProgress.queued.length + prewarmData.customerProgress.running.length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded animate-pulse">
                WARMING
              </span>
            )}
            {!prewarmData?.enabled && (
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded">
                DISABLED
              </span>
            )}
          </h4>
          <button
            onClick={triggerPrewarm}
            disabled={triggeringPrewarm || !prewarmData?.enabled}
            className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {triggeringPrewarm ? 'Triggering...' : 'Warm Top 10'}
          </button>
        </div>
        <div className="p-4">
          {!prewarmData?.enabled ? (
            <div className="text-center py-2">
              <p className="text-sm text-slate-500">Pre-warm is disabled</p>
              <p className="text-xs text-slate-400 mt-1">
                Set <code className="bg-slate-100 px-1 rounded">FF_SMART_PREWARM=true</code> to enable
              </p>
            </div>
          ) : prewarmData?.customerProgress ? (
            <div className="space-y-3">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Progress</span>
                  <span>{prewarmData.customerProgress.percentComplete}% ({prewarmData.customerProgress.completed.length}/{prewarmData.customerProgress.totalCampaigns})</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${prewarmData.customerProgress.percentComplete}%` }}
                  />
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-50 rounded">
                  <p className="text-lg font-bold text-slate-400">{prewarmData.customerProgress.queued.length}</p>
                  <p className="text-slate-500">Queued</p>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <p className="text-lg font-bold text-blue-600">{prewarmData.customerProgress.running.length}</p>
                  <p className="text-slate-500">Running</p>
                </div>
                <div className="p-2 bg-green-50 rounded">
                  <p className="text-lg font-bold text-green-600">{prewarmData.customerProgress.completed.length}</p>
                  <p className="text-slate-500">Done</p>
                </div>
                <div className="p-2 bg-red-50 rounded">
                  <p className="text-lg font-bold text-red-600">{prewarmData.customerProgress.failed.length}</p>
                  <p className="text-slate-500">Failed</p>
                </div>
              </div>

              {/* Estimated Time */}
              {prewarmData.customerProgress.estimatedRemainingSeconds > 0 && (
                <div className="text-center text-xs text-slate-500">
                  Est. remaining: ~{prewarmData.customerProgress.estimatedRemainingSeconds}s
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-slate-500">No active pre-warm</p>
              <p className="text-xs text-slate-400 mt-1">
                Click &quot;Warm Top 10&quot; to pre-warm ad groups for top campaigns
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Redis Status - With Test Button */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            Redis Status
            <span className={`w-2 h-2 rounded-full ${data?.redis.available ? 'bg-green-500' : 'bg-red-500'}`} />
          </h4>
          <button
            onClick={testRedisConnection}
            disabled={testingRedis}
            className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50"
          >
            {testingRedis ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Status</span>
              <p className={`font-medium ${data?.redis.available ? 'text-green-600' : 'text-red-600'}`}>
                {data?.redis.available ? 'Connected' : 'Disconnected'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Host</span>
              <p className="font-mono font-medium">{data?.redis.host}</p>
            </div>
            <div>
              <span className="text-slate-500">Port</span>
              <p className="font-mono font-medium">{data?.redis.port}</p>
            </div>
          </div>

          {/* Test Result */}
          {redisTestResult && (
            <div className={`mt-3 rounded px-3 py-2 text-xs ${
              redisTestResult.success
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {redisTestResult.message}
            </div>
          )}

          {/* Warning if not connected */}
          {!data?.redis.available && (
            <div className="mt-3 rounded bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
              <strong>Queue disabled.</strong> Background refresh won&apos;t work. Data will refresh via blocking API calls when expired.
              <br />
              <span className="text-yellow-600">Set REDIS_URL environment variable to enable queue.</span>
            </div>
          )}
        </div>
      </div>

      {/* Queue Stats */}
      {data?.redis.available && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              Queue Status
              {data?.queue.stats?.paused && (
                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded">PAUSED</span>
              )}
            </h4>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-slate-900">{data?.queue.stats?.active || 0}</p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{data?.queue.stats?.waiting || 0}</p>
                <p className="text-xs text-slate-500">Waiting</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{data?.queue.stats?.delayed || 0}</p>
                <p className="text-xs text-slate-500">Delayed</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${(data?.queue.stats?.failed || 0) > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {data?.queue.stats?.failed || 0}
                </p>
                <p className="text-xs text-slate-500">Failed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Worker Status */}
      {data?.redis.available && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              Worker Status
              <span className={`w-2 h-2 rounded-full ${
                data?.worker?.status === 'active' ? 'bg-green-500' :
                data?.worker?.status === 'stale' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
            </h4>
            {data?.worker && (
              <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                data.worker.status === 'active' ? 'bg-green-100 text-green-700' :
                data.worker.status === 'stale' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {data.worker.status.toUpperCase()}
              </span>
            )}
          </div>
          <div className="p-4">
            {data?.worker ? (
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Worker ID</span>
                  <p className="font-mono font-medium">{data.worker.workerId}</p>
                </div>
                <div>
                  <span className="text-slate-500">Last Seen</span>
                  <p className="font-medium">
                    {data.worker.ageSeconds < 60
                      ? `${data.worker.ageSeconds}s ago`
                      : formatDistanceToNow(new Date(data.worker.lastSeen), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Jobs Processed</span>
                  <p className="font-medium">{data.worker.jobsProcessed}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-red-600 font-medium">No Worker Running</p>
                <p className="text-xs text-slate-500 mt-1">
                  Start the worker process: <code className="bg-slate-100 px-1 rounded">npm run worker</code>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DB Cache Overview */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-700">Database Cache Overview</h4>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-2xl font-bold text-slate-900">{data?.database?.totalRows.toLocaleString() || 0}</p>
              <p className="text-xs text-slate-500">Total Rows</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{data?.database?.customerIds || 0}</p>
              <p className="text-xs text-slate-500">Accounts</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {data?.database?.byEntityType?.CAMPAIGN || 0}
              </p>
              <p className="text-xs text-slate-500">Campaign Rows</p>
            </div>
          </div>

          {data?.database?.newestSync && (
            <div className="text-xs text-slate-500 border-t border-slate-100 pt-3">
              Most recent sync: {formatDistanceToNow(new Date(data.database.newestSync), { addSuffix: true })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-700">Recent Refresh Jobs</h4>
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
                  <th className="px-3 py-2 text-left text-slate-600 font-medium">Rows</th>
                  <th className="px-3 py-2 text-left text-slate-600 font-medium">Duration</th>
                  <th className="px-3 py-2 text-left text-slate-600 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentJobs?.map((job) => (
                  <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono">{job.jobType.replace('refresh:', '')}</td>
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
                    <td className="px-3 py-2 text-slate-600">{job.entityCount ?? '-'}</td>
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

      {/* Cache Metrics */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-700">Cache Metrics (This Session)</h4>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center text-xs">
            <div>
              <p className="text-lg font-bold text-green-600">{data?.metrics?.hits || 0}</p>
              <p className="text-slate-500">Cache Hits</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">{data?.metrics?.misses || 0}</p>
              <p className="text-slate-500">Cache Misses</p>
            </div>
            <div>
              <p className="text-lg font-bold text-yellow-600">{data?.metrics?.staleRefreshes || 0}</p>
              <p className="text-slate-500">Stale Refreshes</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-600">{data?.metrics?.backgroundRefreshes || 0}</p>
              <p className="text-slate-500">Background Jobs</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Auto-refreshes every 15 seconds | {data?.timestamp && `Last: ${new Date(data.timestamp).toLocaleTimeString()}`}
      </p>
    </div>
  );
}
