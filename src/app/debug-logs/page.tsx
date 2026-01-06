'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'google_ads' | 'mcp' | 'ai' | 'api' | 'sync';
  message: string;
  data?: Record<string, unknown>;
  duration?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  google_ads: 'bg-blue-100 text-blue-800',
  mcp: 'bg-purple-100 text-purple-800',
  ai: 'bg-green-100 text-green-800',
  api: 'bg-gray-100 text-gray-800',
  sync: 'bg-yellow-100 text-yellow-800',
};

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-blue-600',
  warn: 'text-yellow-600',
  error: 'text-red-600',
  debug: 'text-gray-500',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedLevel !== 'all') params.append('level', selectedLevel);

      const res = await fetch(`/api/debug-logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, selectedLevel]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleClearLogs = async () => {
    if (!confirm('Clear all logs?')) return;
    await fetch('/api/debug-logs', { method: 'DELETE' });
    setLogs([]);
  };

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-lg font-semibold text-gray-900">API Logs</h1>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {logs.length} entries
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              >
                <option value="all">All Categories</option>
                <option value="google_ads">Google Ads</option>
                <option value="mcp">MCP</option>
                <option value="ai">AI</option>
                <option value="api">API</option>
                <option value="sync">Sync</option>
              </select>

              {/* Level Filter */}
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
              </select>

              {/* Auto-refresh toggle */}
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Auto-refresh
              </label>

              {/* Refresh button */}
              <button
                onClick={fetchLogs}
                className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Refresh
              </button>

              {/* Clear button */}
              <button
                onClick={handleClearLogs}
                className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Logs List */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No logs yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Logs will appear when API calls are made
            </p>
          </div>
        ) : (
          <div className="space-y-1 font-mono text-xs">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-white border border-gray-200 rounded overflow-hidden"
              >
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                  onClick={() => log.data && toggleExpand(log.id)}
                >
                  {/* Timestamp */}
                  <span className="text-gray-400 w-20 shrink-0">
                    {formatTime(log.timestamp)}
                  </span>

                  {/* Category Badge */}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${CATEGORY_COLORS[log.category] || 'bg-gray-100'}`}>
                    {log.category}
                  </span>

                  {/* Level */}
                  <span className={`w-12 ${LEVEL_COLORS[log.level] || 'text-gray-600'}`}>
                    [{log.level}]
                  </span>

                  {/* Message */}
                  <span className="flex-1 text-gray-800 truncate">
                    {log.message}
                  </span>

                  {/* Duration */}
                  {log.duration !== undefined && (
                    <span className="text-gray-400">
                      {log.duration}ms
                    </span>
                  )}

                  {/* Expand indicator */}
                  {log.data && (
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedLogs.has(log.id) ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>

                {/* Expanded Data */}
                {log.data && expandedLogs.has(log.id) && (
                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                    <pre className="text-[11px] text-gray-600 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <h3 className="font-medium mb-2">How to use this page</h3>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Logs are stored in memory and reset when the server restarts</li>
            <li>Enable auto-refresh to see real-time updates</li>
            <li>Click on a log entry to expand and see detailed data</li>
            <li>Filter by category or level to find specific logs</li>
            <li>Go to <Link href="/command" className="underline">Insight Hub</Link> and make queries to see API logs</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
