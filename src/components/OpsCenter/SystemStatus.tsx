/**
 * System Status Component
 *
 * Displays system configuration and feature flags for debugging.
 * Helps correlate bugs to specific releases and configurations.
 */

'use client';

import { useState, useEffect } from 'react';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { useAccount } from '@/contexts/AccountContext';

// Build info (set at build time or via env)
const BUILD_INFO = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
  buildId: process.env.NEXT_PUBLIC_BUILD_ID || 'dev',
  commitSha: process.env.NEXT_PUBLIC_GIT_SHA || 'local',
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Feature flags interface (matches server-side)
interface FeatureFlagState {
  enabled: boolean;
  envVar: string;
  description: string;
}

interface FeatureFlags {
  HYBRID_FETCH?: FeatureFlagState;
  QUEUE_REFRESH?: FeatureFlagState;
  HIERARCHY_VALIDATION?: FeatureFlagState;
  DATE_RANGE_ANALYSIS?: FeatureFlagState;
  INLINE_REFRESH?: FeatureFlagState;
  WORKER_HEARTBEAT?: FeatureFlagState;
}

export default function SystemStatus() {
  const { dateRange } = useCampaignsData();
  const { currentAccount } = useAccount();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [lastRefreshJob, setLastRefreshJob] = useState<{
    id: string;
    status: string;
    type: string;
    createdAt: string;
  } | null>(null);
  const [coverage, setCoverage] = useState<{ percentCached: number; percentMissing: number } | null>(null);
  const [invalidating, setInvalidating] = useState(false);
  const [invalidateResult, setInvalidateResult] = useState<{ success: boolean; deleted: number } | null>(null);
  const [clientCacheCleared, setClientCacheCleared] = useState(false);

  // Fetch feature flags and last job from diagnostics API
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true);

        // Fetch diagnostics which includes feature flags
        const params = new URLSearchParams({
          customerId: currentAccount?.googleAccountId || '',
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });

        const response = await fetch(`/api/admin/diagnostics?${params}`);
        if (response.ok) {
          const data = await response.json();

          // Extract feature flags if present
          if (data.featureFlags) {
            setFeatureFlags(data.featureFlags);
          }

          // Extract last refresh job if present
          if (data.recentJobs?.length > 0) {
            setLastRefreshJob(data.recentJobs[0]);
          }

          // Extract coverage if present
          if (data.coverage) {
            setCoverage(data.coverage);
          }
        }
      } catch (error) {
        console.error('[SystemStatus] Failed to fetch status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [currentAccount?.googleAccountId, dateRange.startDate, dateRange.endDate]);

  // Generate debug payload for clipboard
  const generateDebugPayload = () => {
    const payload = {
      timestamp: new Date().toISOString(),
      build: {
        sha: BUILD_INFO.commitSha.slice(0, 7),
        version: BUILD_INFO.version,
        env: BUILD_INFO.nodeEnv,
      },
      queryContext: {
        preset: dateRange.preset,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        conversionMode: 'default',
        includeToday: dateRange.preset === 'today' || dateRange.preset === 'thisMonth',
      },
      cacheMode: getCacheModeLabel(),
      coverage: coverage || { percentCached: 'unknown', percentMissing: 'unknown' },
      account: currentAccount?.googleAccountId || 'none',
      lastJob: lastRefreshJob ? {
        id: lastRefreshJob.id,
        status: lastRefreshJob.status,
        type: lastRefreshJob.type,
      } : null,
      validation: {
        yesterdayValid: dateRange.preset !== 'yesterday' || dateRange.startDate === dateRange.endDate,
        daysInRange: Math.abs(new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1,
      },
    };
    return JSON.stringify(payload, null, 2);
  };

  const copyDebugInfo = async () => {
    try {
      await navigator.clipboard.writeText(generateDebugPayload());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Clear frontend localStorage cache (all gads-cache-* entries)
  const clearClientCache = () => {
    if (typeof window === 'undefined') return;

    let cleared = 0;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('gads-cache-')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      cleared++;
    });

    console.log(`[SystemStatus] Cleared ${cleared} localStorage cache entries`);
    setClientCacheCleared(true);
    setTimeout(() => setClientCacheCleared(false), 3000);

    // Force page reload to pick up fresh data
    if (cleared > 0) {
      window.location.reload();
    }
  };

  // One-click cache invalidation for current query context
  const invalidateCache = async () => {
    if (!currentAccount?.googleAccountId) {
      console.error('[SystemStatus] No account selected');
      return;
    }

    setInvalidating(true);
    setInvalidateResult(null);

    try {
      const response = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invalidate-metrics',
          customerId: currentAccount.googleAccountId,
          entityType: 'campaigns',
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setInvalidateResult({ success: true, deleted: data.deletedCount || 0 });
        // Clear result after 5 seconds
        setTimeout(() => setInvalidateResult(null), 5000);
      } else {
        setInvalidateResult({ success: false, deleted: 0 });
        console.error('[SystemStatus] Cache invalidation failed:', data.error);
      }
    } catch (err) {
      console.error('[SystemStatus] Cache invalidation error:', err);
      setInvalidateResult({ success: false, deleted: 0 });
    } finally {
      setInvalidating(false);
    }
  };

  // Determine cache mode label
  const getCacheModeLabel = () => {
    if (!featureFlags) return 'Unknown';

    const hybridEnabled = featureFlags.HYBRID_FETCH?.enabled;
    const queueEnabled = featureFlags.QUEUE_REFRESH?.enabled;

    if (hybridEnabled && queueEnabled) {
      return 'Hybrid (DB + API + Queue)';
    } else if (hybridEnabled) {
      return 'Hybrid (DB + API)';
    } else if (queueEnabled) {
      return 'API-Only with Queue';
    } else {
      return 'API-Only';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={clearClientCache}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            clientCacheCleared
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-orange-600 text-white hover:bg-orange-700'
          }`}
        >
          {clientCacheCleared ? 'Cleared & Reloading...' : 'Clear Client Cache'}
        </button>
        <button
          onClick={invalidateCache}
          disabled={invalidating || !currentAccount?.googleAccountId}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            invalidateResult?.success
              ? 'bg-green-100 text-green-800 border border-green-200'
              : invalidateResult && !invalidateResult.success
              ? 'bg-red-100 text-red-800 border border-red-200'
              : invalidating
              ? 'bg-gray-100 text-gray-400 cursor-wait'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {invalidating
            ? 'Invalidating...'
            : invalidateResult?.success
            ? `Cleared ${invalidateResult.deleted} DB rows`
            : invalidateResult && !invalidateResult.success
            ? 'Failed'
            : 'Invalidate DB Cache'}
        </button>
        <button
          onClick={copyDebugInfo}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            copied
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {copied ? 'Copied!' : 'Copy Debug Info'}
        </button>
      </div>

      {/* Build Info Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Build Information</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Version</dt>
            <dd className="mt-1 text-sm font-mono text-gray-900">{BUILD_INFO.version}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Build ID</dt>
            <dd className="mt-1 text-sm font-mono text-gray-900">{BUILD_INFO.buildId.slice(0, 8)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Git SHA</dt>
            <dd className="mt-1 text-sm font-mono text-gray-900">{BUILD_INFO.commitSha.slice(0, 7)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Environment</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${
                BUILD_INFO.nodeEnv === 'production'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {BUILD_INFO.nodeEnv.toUpperCase()}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Cache Mode Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cache Configuration</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <dt className="text-xs font-medium text-gray-500 uppercase">Active Mode</dt>
            <dd className="mt-1 text-lg font-medium text-gray-900">{getCacheModeLabel()}</dd>
          </div>
          <div className="text-sm text-gray-500">
            {featureFlags?.HYBRID_FETCH?.enabled ? (
              <span className="text-green-600">DB-first with API fallback</span>
            ) : (
              <span className="text-yellow-600">Direct API calls only</span>
            )}
          </div>
        </div>
      </div>

      {/* Query Context Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Query Context</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Preset</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{dateRange.preset || 'custom'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Start Date</dt>
            <dd className="mt-1 text-sm font-mono text-gray-900">{dateRange.startDate}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">End Date</dt>
            <dd className="mt-1 text-sm font-mono text-gray-900">{dateRange.endDate}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Account</dt>
            <dd className="mt-1 text-sm font-mono text-gray-900 truncate" title={currentAccount?.googleAccountId}>
              {currentAccount?.googleAccountId || 'None'}
            </dd>
          </div>
        </dl>

        {/* Date range validation */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {dateRange.preset === 'yesterday' && dateRange.startDate === dateRange.endDate ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-sm text-green-700">Yesterday preset: Valid (1-day window)</span>
              </>
            ) : dateRange.preset === 'yesterday' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-sm text-red-700">
                  Yesterday preset: INVALID (expected 1 day, got {
                    Math.abs(new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1
                  } days)
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                <span className="text-sm text-gray-500">
                  Range: {Math.abs(new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1} days
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feature Flags Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Flags</h2>
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading feature flags...</div>
        ) : featureFlags ? (
          <div className="space-y-3">
            {Object.entries(featureFlags).map(([flag, state]) => (
              <div key={flag} className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${state.enabled ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-sm font-medium text-gray-900">{flag}</span>
                    <code className="text-xs text-gray-400">{state.envVar}</code>
                  </div>
                  <p className="mt-0.5 ml-4 text-xs text-gray-500">{state.description}</p>
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  state.enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {state.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Feature flags not available. Check diagnostics API.
          </div>
        )}
      </div>

      {/* Last Refresh Job Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Last Refresh Job</h2>
        {lastRefreshJob ? (
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Job ID</dt>
              <dd className="mt-1 text-sm font-mono text-gray-900 truncate" title={lastRefreshJob.id}>
                {lastRefreshJob.id.slice(0, 16)}...
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{lastRefreshJob.type}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${
                  lastRefreshJob.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : lastRefreshJob.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {lastRefreshJob.status.toUpperCase()}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Timestamp</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(lastRefreshJob.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="text-sm text-gray-500">
            No recent refresh jobs found for this account.
          </div>
        )}
      </div>

      {/* Debug Info Section */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
            Debug: Raw Context Data
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64 font-mono">
{JSON.stringify({
  buildInfo: BUILD_INFO,
  dateRange,
  accountId: currentAccount?.id,
  googleAccountId: currentAccount?.googleAccountId,
  featureFlags,
}, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
