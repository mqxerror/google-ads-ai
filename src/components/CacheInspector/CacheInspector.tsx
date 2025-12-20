'use client';

/**
 * Cache Inspector - Debug cache state and trigger refreshes
 *
 * Shows:
 * - Cache key, age, state
 * - Refresh status (running, backoff)
 * - Last refresh outcome
 * - Actions: enqueue refresh, invalidate
 */

import { useState, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';

interface CacheInspection {
  key: string;
  exists: boolean;
  age: number | null;
  state: 'fresh' | 'stale' | 'expired' | 'missing';
  lastUpdatedAt: string | null;
  refreshRunning: boolean;
  refreshAge: number | null;
  inBackoff: boolean;
  backoffRemaining: number | null;
  blockingFetchThrottled: boolean;
  blockingFetchCooldown: number | null;
  customerId: string;
  entityType: string;
  entityId: string | null;
  parentEntityId: string | null;
  dateRange: string | null;
  lastRefreshJob: {
    id: string;
    status: string;
    entityCount: number | null;
    durationMs: number | null;
    errorMessage: string | null;
    createdAt: string;
  } | null;
  queueReady: boolean;
}

interface CacheOverview {
  overview: true;
  metrics: {
    hits: number;
    misses: number;
    staleRefreshes: number;
    lockContentions: number;
    throttleEvents: number;
    backgroundRefreshes: number;
    backgroundRefreshErrors: number;
    activeLocks: number;
    activeBackoffs: number;
  };
  activeLocks: Array<{ key: string; owner: string; age: number; expiresIn: number }>;
  activeBackoffs: Array<{ key: string; expiresIn: number }>;
  blockingFetchThrottles: Array<{ key: string; cooldownRemaining: number }>;
  queueReady: boolean;
}

type InspectionResult = CacheInspection | CacheOverview;

function isOverview(data: InspectionResult): data is CacheOverview {
  return 'overview' in data && data.overview === true;
}

export default function CacheInspector() {
  const [customerId, setCustomerId] = useState('');
  const [entityType, setEntityType] = useState<string>('campaigns');
  const [parentEntityId, setParentEntityId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [result, setResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [opsToken, setOpsToken] = useState('');

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (opsToken) {
      headers['x-ops-token'] = opsToken;
    }
    return headers;
  }, [opsToken]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/cache', { headers: getHeaders() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  const inspectCache = useCallback(async () => {
    if (!customerId) {
      setError('Customer ID is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        customerId,
        entityType,
      });
      if (parentEntityId) params.set('parentEntityId', parentEntityId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/admin/cache?${params}`, { headers: getHeaders() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [customerId, entityType, parentEntityId, startDate, endDate, getHeaders]);

  const performAction = useCallback(async (action: 'refresh' | 'invalidate') => {
    if (!customerId) {
      setError('Customer ID is required');
      return;
    }

    setActionLoading(action);
    try {
      const res = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({
          action,
          customerId,
          entityType,
          parentEntityId: parentEntityId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      alert(`Success: ${JSON.stringify(data)}`);

      // Re-inspect after action
      await inspectCache();
    } catch (err) {
      alert(`Action failed: ${err}`);
    } finally {
      setActionLoading(null);
    }
  }, [customerId, entityType, parentEntityId, startDate, endDate, getHeaders, inspectCache]);

  const getStateColor = (state: string) => {
    switch (state) {
      case 'fresh':
        return 'bg-green-100 text-green-800';
      case 'stale':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'missing':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cache Inspector</h2>
          <p className="text-sm text-gray-500">Debug cache state and trigger refreshes</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={opsToken}
            onChange={(e) => setOpsToken(e.target.value)}
            className="border rounded px-3 py-1.5 w-40 text-sm"
            placeholder="OPS Token"
          />
          <button
            onClick={fetchOverview}
            className="px-3 py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200"
          >
            Overview
          </button>
        </div>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="123-456-7890"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="campaigns">Campaigns</option>
              <option value="ad-groups">Ad Groups</option>
              <option value="keywords">Keywords</option>
              <option value="ads">Ads</option>
              <option value="reports">Reports</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Entity ID</label>
            <input
              type="text"
              value={parentEntityId}
              onChange={(e) => setParentEntityId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-2 py-2 text-sm"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-2 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={inspectCache}
              disabled={loading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Inspecting...' : 'Inspect'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Overview Result */}
      {result && isOverview(result) && (
        <div className="space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Cache Hit Rate</div>
              <div className="text-2xl font-bold">
                {result.metrics.hits + result.metrics.misses > 0
                  ? `${Math.round((result.metrics.hits / (result.metrics.hits + result.metrics.misses)) * 100)}%`
                  : 'N/A'}
              </div>
              <div className="text-xs text-gray-400">
                {result.metrics.hits} hits / {result.metrics.misses} misses
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Background Refreshes</div>
              <div className="text-2xl font-bold">{result.metrics.backgroundRefreshes}</div>
              <div className="text-xs text-gray-400">
                {result.metrics.backgroundRefreshErrors} errors
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Active Locks</div>
              <div className="text-2xl font-bold">{result.metrics.activeLocks}</div>
              <div className="text-xs text-gray-400">
                {result.metrics.lockContentions} contentions
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Throttle Events</div>
              <div className="text-2xl font-bold">{result.metrics.throttleEvents}</div>
              <div className="text-xs text-gray-400">
                {result.activeBackoffs.length} active backoffs
              </div>
            </div>
          </div>

          {/* Active Locks */}
          {result.activeLocks.length > 0 && (
            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b">
                <h3 className="font-medium">Active Locks</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Key</th>
                    <th className="px-4 py-2 text-left">Age</th>
                    <th className="px-4 py-2 text-left">Expires In</th>
                  </tr>
                </thead>
                <tbody>
                  {result.activeLocks.map((lock, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{lock.key}</td>
                      <td className="px-4 py-2">{formatMs(lock.age)}</td>
                      <td className="px-4 py-2">{formatMs(lock.expiresIn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Blocking Fetch Throttles */}
          {result.blockingFetchThrottles.length > 0 && (
            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b">
                <h3 className="font-medium">Blocking Fetch Cooldowns</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Key</th>
                    <th className="px-4 py-2 text-left">Cooldown Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {result.blockingFetchThrottles.map((t, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{t.key}</td>
                      <td className="px-4 py-2">{formatMs(t.cooldownRemaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inspection Result */}
      {result && !isOverview(result) && (
        <div className="space-y-4">
          {/* Status Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500 mb-1">Cache State</div>
              <span className={`px-3 py-1 rounded text-sm font-medium ${getStateColor(result.state)}`}>
                {result.state.toUpperCase()}
              </span>
              {result.exists && result.age && (
                <div className="text-xs text-gray-400 mt-2">
                  Age: {formatMs(result.age)}
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500 mb-1">Last Updated</div>
              <div className="font-medium">
                {result.lastUpdatedAt
                  ? formatDistanceToNow(new Date(result.lastUpdatedAt), { addSuffix: true })
                  : 'Never'}
              </div>
              {result.lastUpdatedAt && (
                <div className="text-xs text-gray-400">
                  {format(new Date(result.lastUpdatedAt), 'MMM d, HH:mm:ss')}
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500 mb-1">Refresh Status</div>
              <div className="font-medium">
                {result.refreshRunning ? (
                  <span className="text-blue-600">Running ({formatMs(result.refreshAge || 0)})</span>
                ) : result.inBackoff ? (
                  <span className="text-yellow-600">Backoff ({formatMs(result.backoffRemaining || 0)})</span>
                ) : (
                  <span className="text-gray-600">Idle</span>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500 mb-1">Blocking Fetch</div>
              <div className="font-medium">
                {result.blockingFetchThrottled ? (
                  <span className="text-orange-600">Throttled ({formatMs(result.blockingFetchCooldown || 0)})</span>
                ) : (
                  <span className="text-green-600">Available</span>
                )}
              </div>
            </div>
          </div>

          {/* Cache Key */}
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500 mb-1">Cache Key</div>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded block overflow-x-auto">
              {result.key}
            </code>
          </div>

          {/* Last Refresh Job */}
          {result.lastRefreshJob && (
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Last Refresh Job</div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className={`px-2 py-0.5 rounded ${
                    result.lastRefreshJob.status === 'completed' ? 'bg-green-100 text-green-800' :
                    result.lastRefreshJob.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {result.lastRefreshJob.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Entities:</span>{' '}
                  {result.lastRefreshJob.entityCount ?? '-'}
                </div>
                <div>
                  <span className="text-gray-500">Duration:</span>{' '}
                  {result.lastRefreshJob.durationMs ? formatMs(result.lastRefreshJob.durationMs) : '-'}
                </div>
                <div>
                  <span className="text-gray-500">Time:</span>{' '}
                  {format(new Date(result.lastRefreshJob.createdAt), 'HH:mm:ss')}
                </div>
              </div>
              {result.lastRefreshJob.errorMessage && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                  {result.lastRefreshJob.errorMessage}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm font-medium text-gray-700 mb-3">Actions</div>
            <div className="flex gap-2">
              <button
                onClick={() => performAction('refresh')}
                disabled={actionLoading !== null || !result.queueReady}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200 disabled:opacity-50"
              >
                {actionLoading === 'refresh' ? 'Enqueueing...' : 'Enqueue Refresh'}
              </button>
              <button
                onClick={() => performAction('invalidate')}
                disabled={actionLoading !== null}
                className="px-4 py-2 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200 disabled:opacity-50"
              >
                {actionLoading === 'invalidate' ? 'Invalidating...' : 'Invalidate Cache'}
              </button>
            </div>
            {!result.queueReady && (
              <p className="text-xs text-yellow-600 mt-2">Queue not available - refresh disabled</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
