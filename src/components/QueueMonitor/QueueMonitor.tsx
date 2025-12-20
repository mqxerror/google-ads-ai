'use client';

/**
 * Queue Monitor - BullMQ Queue & Cache Monitoring
 *
 * Shows:
 * - Redis/Queue connection status
 * - Queue counts (waiting/active/delayed/failed)
 * - Success rate (last 24h)
 * - Recent RefreshJobLog entries
 */

import { useEffect, useState, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  pendingInMemory: number;
}

interface JobLog {
  id: string;
  jobType: string;
  customerId: string;
  status: string;
  entityCount: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface RecentJob {
  id: string;
  type: string;
  customerId: string;
  parentEntityId?: string;
  dateRange: string;
  priority: string;
  state: string;
  progress: number;
  attemptsMade: number;
  enqueuedAt: string;
  processedOn: string | null;
  finishedOn: string | null;
  failedReason: string | null;
}

interface QueueData {
  queueReady: boolean;
  stats: QueueStats | null;
  successRate24h: number | null;
  jobsLast24h: number;
  recentJobs: RecentJob[];
  dbJobLogs: JobLog[];
}

export default function QueueMonitor() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [opsToken, setOpsToken] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (opsToken) {
        headers['x-ops-token'] = opsToken;
      }

      const res = await fetch('/api/admin/queue?includeJobs=true&includeDbLogs=true&limit=20', {
        headers,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [opsToken]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAction = async (action: 'pause' | 'resume' | 'drain') => {
    if (!confirm(`Are you sure you want to ${action} the queue?`)) return;

    setActionLoading(action);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (opsToken) {
        headers['x-ops-token'] = opsToken;
      }

      const res = await fetch('/api/admin/queue', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      await fetchData();
    } catch (err) {
      alert(`Action failed: ${err}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'processing':
      case 'active':
        return 'text-blue-600 bg-blue-50';
      case 'retrying':
        return 'text-yellow-600 bg-yellow-50';
      case 'waiting':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Access Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="password"
              value={opsToken}
              onChange={(e) => setOpsToken(e.target.value)}
              className="border rounded px-3 py-2 w-64 text-sm"
              placeholder="Enter OPS_TOKEN"
            />
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Token Input */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Queue Monitor</h2>
          <p className="text-sm text-gray-500">Background refresh job status</p>
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
            onClick={fetchData}
            className="px-3 py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Queue Status */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Queue Status</div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                data?.queueReady ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="font-medium text-gray-900">
              {data?.queueReady ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {data?.stats?.paused && (
            <div className="text-yellow-600 text-xs mt-1">Paused</div>
          )}
        </div>

        {/* Active / Waiting */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Active / Waiting</div>
          <div className="text-2xl font-bold text-gray-900">
            {data?.stats?.active ?? 0} / {data?.stats?.waiting ?? 0}
          </div>
          <div className="text-xs text-gray-400">
            Delayed: {data?.stats?.delayed ?? 0}
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Success Rate (24h)</div>
          <div className="text-2xl font-bold text-gray-900">
            {data?.successRate24h != null ? `${data.successRate24h}%` : 'N/A'}
          </div>
          <div className="text-xs text-gray-400">
            {data?.jobsLast24h ?? 0} jobs
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Failed (Total)</div>
          <div className={`text-2xl font-bold ${(data?.stats?.failed ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {data?.stats?.failed ?? 0}
          </div>
          <div className="text-xs text-gray-400">
            Completed: {data?.stats?.completed ?? 0}
          </div>
        </div>
      </div>

      {/* Queue Controls */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-3">Queue Controls</div>
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('pause')}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-yellow-100 text-yellow-800 text-sm rounded hover:bg-yellow-200 disabled:opacity-50"
          >
            {actionLoading === 'pause' ? 'Pausing...' : 'Pause'}
          </button>
          <button
            onClick={() => handleAction('resume')}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200 disabled:opacity-50"
          >
            {actionLoading === 'resume' ? 'Resuming...' : 'Resume'}
          </button>
          <button
            onClick={() => handleAction('drain')}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200 disabled:opacity-50"
          >
            {actionLoading === 'drain' ? 'Draining...' : 'Drain All'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Destructive actions require OPS_TOKEN in production.
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Active Queue Jobs */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Active Queue Jobs</h3>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600">Type</th>
                  <th className="px-4 py-2 text-left text-gray-600">State</th>
                  <th className="px-4 py-2 text-left text-gray-600">Enqueued</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentJobs?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                      No jobs in queue
                    </td>
                  </tr>
                )}
                {data?.recentJobs?.map((job) => (
                  <tr key={job.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">
                      {job.type.replace('refresh:', '')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(job.state)}`}>
                        {job.state}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {formatDistanceToNow(new Date(job.enqueuedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Job Logs */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Recent Job Logs</h3>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600">Type</th>
                  <th className="px-4 py-2 text-left text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left text-gray-600">Duration</th>
                  <th className="px-4 py-2 text-left text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.dbJobLogs?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No job logs yet
                    </td>
                  </tr>
                )}
                {data?.dbJobLogs?.map((log) => (
                  <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">
                      {log.jobType.replace('refresh:', '')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">
                      {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {format(new Date(log.createdAt), 'HH:mm:ss')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400">
        Auto-refreshes every 10 seconds
      </div>
    </div>
  );
}
