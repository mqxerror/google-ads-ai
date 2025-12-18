'use client';

import { useState, useEffect, useCallback } from 'react';
import { getActionLabel } from '@/types/action-queue';

interface AuditLog {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  entityName: string;
  beforeValue: unknown;
  afterValue: unknown;
  status: 'success' | 'failed';
  errorMessage?: string;
  source: string;
  createdAt: string;
  account?: {
    accountName: string;
    googleAccountId: string;
  };
}

interface ActivityLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

export default function ActivityLogPanel({ isOpen, onClose, accountId }: ActivityLogPanelProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterEntityType, setFilterEntityType] = useState<string>('');
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [rollbackSuccess, setRollbackSuccess] = useState<string | null>(null);

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (accountId) params.set('accountId', accountId);
      if (filterStatus) params.set('status', filterStatus);
      if (filterEntityType) params.set('entityType', filterEntityType);
      params.set('limit', '20');
      params.set('offset', reset ? '0' : offset.toString());

      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();

      if (reset) {
        setLogs(data.logs);
        setOffset(data.logs.length);
      } else {
        setLogs(prev => [...prev, ...data.logs]);
        setOffset(prev => prev + data.logs.length);
      }
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [accountId, filterStatus, filterEntityType, offset]);

  useEffect(() => {
    if (isOpen) {
      setOffset(0);
      fetchLogs(true);
    }
  }, [isOpen, accountId, filterStatus, filterEntityType]);

  const handleRollback = useCallback(async (logId: string) => {
    setRollingBack(logId);
    setError(null);
    setRollbackSuccess(null);

    try {
      const response = await fetch('/api/actions/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditLogId: logId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Rollback failed');
      }

      setRollbackSuccess(logId);
      // Refresh logs after rollback
      setTimeout(() => {
        fetchLogs(true);
        setRollbackSuccess(null);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setRollingBack(null);
    }
  }, [fetchLogs]);

  const canRollback = (log: AuditLog): boolean => {
    // Can only rollback successful actions that aren't already rollbacks
    if (log.status !== 'success') return false;
    if (log.actionType.startsWith('rollback_')) return false;
    // Keywords are harder to rollback (need ad group context)
    if (log.actionType.includes('keyword')) return false;
    return true;
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    // Less than 1 hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    // Less than 24 hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    // Otherwise show date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
            <div className="flex items-center gap-2">
              <a
                href="/activity"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                View Full Log
              </a>
              <button
                onClick={onClose}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 border-b px-4 py-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filterEntityType}
              onChange={(e) => setFilterEntityType(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="">All Types</option>
              <option value="campaign">Campaign</option>
              <option value="ad_group">Ad Group</option>
              <option value="keyword">Keyword</option>
            </select>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {logs.length === 0 && !loading ? (
              <div className="py-12 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2">No activity yet</p>
                <p className="text-sm text-gray-400">Actions you take will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-lg border p-3 ${
                      log.status === 'failed' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                            log.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {log.status === 'success' ? 'Success' : 'Failed'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 font-medium text-gray-900">
                          {getActionLabel(log.actionType as Parameters<typeof getActionLabel>[0]) || log.actionType}
                        </p>
                        <p className="text-sm text-gray-600">{log.entityName}</p>
                        {log.account && (
                          <p className="text-xs text-gray-400">
                            {log.account.accountName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Value change */}
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{formatValue(log.beforeValue)}</span>
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="font-medium text-gray-900">{formatValue(log.afterValue)}</span>
                    </div>

                    {/* Error message */}
                    {log.errorMessage && (
                      <div className="mt-2 rounded bg-red-100 px-2 py-1 text-xs text-red-700">
                        {log.errorMessage}
                      </div>
                    )}

                    {/* Rollback button */}
                    {canRollback(log) && (
                      <div className="mt-3 flex items-center justify-end border-t pt-2">
                        {rollbackSuccess === log.id ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Rolled back!
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRollback(log.id)}
                            disabled={rollingBack === log.id}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                          >
                            {rollingBack === log.id ? (
                              <>
                                <div className="h-3 w-3 animate-spin rounded-full border border-blue-600 border-t-transparent" />
                                Rolling back...
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                Undo
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Load more */}
                {hasMore && (
                  <button
                    onClick={() => fetchLogs(false)}
                    disabled={loading}
                    className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </div>
            )}

            {loading && logs.length === 0 && (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
