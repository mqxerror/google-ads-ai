'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface EnrichmentLog {
  id: number;
  created_at: string;
  request_id: string;
  user_id: string;
  keywords: string[];
  seed_keyword: string;
  locale: string;
  device: string;
  location_id: string;
  selected_providers: string[];
  quota_check_result: any;
  provider: string;
  api_endpoint: string;
  api_request: any;
  api_response: any;
  api_error: any;
  api_duration_ms: number;
  cache_hits: number;
  cache_misses: number;
  cached_data: any;
  enriched_keywords: any;
  status: 'pending' | 'success' | 'partial' | 'failed';
  error_message: string;
}

export default function DebugPage() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<EnrichmentLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<EnrichmentLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/enrichment-logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
    setLoading(false);
  };

  const selectLog = (log: EnrichmentLog) => {
    setSelectedLog(log);
    setActiveTab('detail');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-success';
      case 'partial':
        return 'text-warning';
      case 'failed':
        return 'text-danger';
      default:
        return 'text-text3';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'partial':
        return '⚠';
      case 'failed':
        return '✗';
      default:
        return '⏳';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text mb-2">Enrichment Debug Panel</h1>
        <p className="text-text2">
          Track keyword enrichment requests, API calls, and data transformation
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-divider mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'list'
                ? 'border-accent text-accent'
                : 'border-transparent text-text2 hover:text-text'
            }`}
          >
            📋 Enrichment Logs
          </button>
          {selectedLog && (
            <button
              onClick={() => setActiveTab('detail')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'detail'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text2 hover:text-text'
              }`}
            >
              🔍 Log Detail ({selectedLog.request_id.substring(0, 8)})
            </button>
          )}
        </div>
      </div>

      {/* List View */}
      {activeTab === 'list' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-text2">
              Showing {logs.length} enrichment requests
            </div>
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded text-sm transition-colors"
            >
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin text-4xl">⏳</div>
              <span className="ml-3 text-text2">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-text2">No enrichment logs yet</div>
              <div className="text-sm text-text3 mt-1">
                Generate some keywords in the Keyword Factory to see logs here
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => selectLog(log)}
                  className="card p-4 hover:bg-surface3 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-lg ${getStatusColor(log.status)}`}>
                          {getStatusIcon(log.status)}
                        </span>
                        <span className="font-mono text-sm text-text3">
                          {log.request_id.substring(0, 8)}...
                        </span>
                        <span className="text-sm text-text2">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-text">
                          <strong>{log.keywords.length}</strong> keywords
                        </span>
                        <span className="text-text2">
                          Seed: <strong className="text-text">{log.seed_keyword}</strong>
                        </span>
                        <span className="text-text2">
                          Providers: {log.selected_providers.join(', ')}
                        </span>
                        {log.cache_hits !== null && (
                          <span className="text-text2">
                            Cache: {log.cache_hits} hits, {log.cache_misses} misses
                          </span>
                        )}
                      </div>
                      {log.error_message && (
                        <div className="mt-2 text-sm text-danger">
                          Error: {log.error_message}
                        </div>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
                      {log.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail View */}
      {activeTab === 'detail' && selectedLog && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('list')}
            className="text-sm text-text2 hover:text-text transition-colors mb-4"
          >
            ← Back to list
          </button>

          {/* Overview */}
          <div className="card p-6">
            <h2 className="text-xl font-bold text-text mb-4">Request Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-text3 mb-1">Status</div>
                <div className={`font-medium ${getStatusColor(selectedLog.status)}`}>
                  {getStatusIcon(selectedLog.status)} {selectedLog.status.toUpperCase()}
                </div>
              </div>
              <div>
                <div className="text-xs text-text3 mb-1">Keywords</div>
                <div className="font-medium text-text">{selectedLog.keywords.length}</div>
              </div>
              <div>
                <div className="text-xs text-text3 mb-1">Cache Hits</div>
                <div className="font-medium text-text">{selectedLog.cache_hits || 0}</div>
              </div>
              <div>
                <div className="text-xs text-text3 mb-1">Cache Misses</div>
                <div className="font-medium text-text">{selectedLog.cache_misses || 0}</div>
              </div>
            </div>
          </div>

          {/* Request Parameters */}
          <div className="card p-6">
            <h3 className="font-semibold text-text mb-3">Request Parameters</h3>
            <pre className="bg-surface3 p-4 rounded text-xs overflow-x-auto">
              {JSON.stringify(
                {
                  keywords: selectedLog.keywords,
                  seedKeyword: selectedLog.seed_keyword,
                  locale: selectedLog.locale,
                  device: selectedLog.device,
                  locationId: selectedLog.location_id,
                  selectedProviders: selectedLog.selected_providers,
                },
                null,
                2
              )}
            </pre>
          </div>

          {/* Quota Check Result */}
          {selectedLog.quota_check_result && (
            <div className="card p-6">
              <h3 className="font-semibold text-text mb-3">Quota Check Result</h3>
              <pre className="bg-surface3 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(selectedLog.quota_check_result, null, 2)}
              </pre>
            </div>
          )}

          {/* API Error */}
          {selectedLog.api_error && (
            <div className="card p-6 border-2 border-danger">
              <h3 className="font-semibold text-danger mb-3">API Error</h3>
              <pre className="bg-surface3 p-4 rounded text-xs overflow-x-auto text-danger">
                {JSON.stringify(selectedLog.api_error, null, 2)}
              </pre>
            </div>
          )}

          {/* Error Message */}
          {selectedLog.error_message && (
            <div className="card p-6 border-2 border-danger">
              <h3 className="font-semibold text-danger mb-3">Error Message</h3>
              <div className="text-sm text-danger">{selectedLog.error_message}</div>
            </div>
          )}

          {/* Enriched Keywords */}
          {selectedLog.enriched_keywords && selectedLog.enriched_keywords.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold text-text mb-3">
                Enriched Keywords ({selectedLog.enriched_keywords.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-divider">
                      <th className="text-left py-2 px-2 text-text3">Keyword</th>
                      <th className="text-right py-2 px-2 text-text3">Volume</th>
                      <th className="text-right py-2 px-2 text-text3">CPC</th>
                      <th className="text-center py-2 px-2 text-text3">Competition</th>
                      <th className="text-right py-2 px-2 text-text3">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLog.enriched_keywords.map((kw: any, i: number) => (
                      <tr key={i} className="border-b border-divider hover:bg-surface3">
                        <td className="py-2 px-2 text-text">{kw.keyword}</td>
                        <td className="py-2 px-2 text-right text-text">
                          {kw.metrics?.searchVolume?.toLocaleString() || '-'}
                        </td>
                        <td className="py-2 px-2 text-right text-text">
                          ${kw.metrics?.cpc?.toFixed(2) || '0.00'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              kw.metrics?.competition === 'HIGH'
                                ? 'bg-danger/20 text-danger'
                                : kw.metrics?.competition === 'MEDIUM'
                                ? 'bg-warning/20 text-warning'
                                : 'bg-success/20 text-success'
                            }`}
                          >
                            {kw.metrics?.competition || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-text">
                          {kw.opportunityScore || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
