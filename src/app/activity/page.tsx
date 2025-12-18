'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/contexts/AccountContext';
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

export default function ActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { currentAccount, accounts } = useAccount();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterEntityType, setFilterEntityType] = useState<string>('');
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [rollbackSuccess, setRollbackSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterAccountId) params.set('accountId', filterAccountId);
      else if (currentAccount) params.set('accountId', currentAccount.id);
      if (filterStatus) params.set('status', filterStatus);
      if (filterEntityType) params.set('entityType', filterEntityType);
      params.set('limit', '50');
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
  }, [currentAccount, filterStatus, filterEntityType, filterAccountId, offset]);

  useEffect(() => {
    if (session) {
      setOffset(0);
      fetchLogs(true);
    }
  }, [session, filterStatus, filterEntityType, filterAccountId]);

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
    if (log.status !== 'success') return false;
    if (log.actionType.startsWith('rollback_')) return false;
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
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('pause')) {
      return (
        <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (actionType.includes('enable')) {
      return (
        <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (actionType.includes('budget')) {
      return (
        <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return (
      <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Activity Log</h1>
              <p className="text-sm text-gray-500">
                View all changes made to your Google Ads accounts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          {accounts.length > 1 && (
            <select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.accountName}</option>
              ))}
            </select>
          )}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={filterEntityType}
            onChange={(e) => setFilterEntityType(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="campaign">Campaign</option>
            <option value="ad_group">Ad Group</option>
            <option value="keyword">Keyword</option>
          </select>
          <button
            onClick={() => {
              setFilterAccountId('');
              setFilterStatus('');
              setFilterEntityType('');
            }}
            className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600">
            {error}
          </div>
        )}

        {logs.length === 0 && !loading ? (
          <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No activity yet</h3>
            <p className="mt-2 text-gray-500">
              Actions you take in Google Ads Manager will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`rounded-lg border bg-white p-4 shadow-sm ${
                  log.status === 'failed'
                    ? 'border-red-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getActionIcon(log.actionType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        log.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(log.createdAt)}
                      </span>
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {log.entityType}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-gray-900">
                      {getActionLabel(log.actionType as Parameters<typeof getActionLabel>[0]) || log.actionType}
                    </p>
                    <p className="text-sm text-gray-600">{log.entityName}</p>
                    {log.account && (
                      <p className="text-xs text-gray-400">
                        Account: {log.account.accountName}
                      </p>
                    )}

                    {/* Value change */}
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="rounded bg-gray-100 px-2 py-1 text-gray-600">
                        {formatValue(log.beforeValue)}
                      </span>
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="rounded bg-blue-100 px-2 py-1 font-medium text-blue-700">
                        {formatValue(log.afterValue)}
                      </span>
                    </div>

                    {log.errorMessage && (
                      <div className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                        {log.errorMessage}
                      </div>
                    )}
                  </div>

                  {/* Rollback button */}
                  {canRollback(log) && (
                    <div className="flex-shrink-0">
                      {rollbackSuccess === log.id ? (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Rolled back
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRollback(log.id)}
                          disabled={rollingBack === log.id}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {rollingBack === log.id ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                              Rolling back...
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => fetchLogs(false)}
                  disabled={loading}
                  className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}

        {loading && logs.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
