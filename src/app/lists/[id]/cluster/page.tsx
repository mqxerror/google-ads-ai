'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface KeywordList {
  id: string;
  name: string;
  color: string;
  icon: string;
  keyword_count: number;
}

interface ClusterKeyword {
  keyword: string;
  volume: number | null;
  cpc: number | null;
}

interface Cluster {
  id: number;
  name: string;
  keywords: ClusterKeyword[];
  totalVolume: number;
  avgCpc: number;
  color: string;
}

interface ClusterStats {
  totalKeywords: number;
  clusteredKeywords: number;
  clusterCount: number;
  method: string;
}

export default function ClusterStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [list, setList] = useState<KeywordList | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [unclustered, setUnclustered] = useState<ClusterKeyword[]>([]);
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clustering settings
  const [method, setMethod] = useState<'semantic' | 'ngram'>('semantic');
  const [sensitivity, setSensitivity] = useState(0.5);
  const [minClusterSize, setMinClusterSize] = useState(2);
  const [targetClusters, setTargetClusters] = useState<string>('auto');
  const [fastMode, setFastMode] = useState(true); // Skip AI naming for speed

  // Expanded clusters
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set());

  // Edit cluster name
  const [editingCluster, setEditingCluster] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const isAuthenticated = status === 'authenticated' && session?.user;

  // Fetch list info
  useEffect(() => {
    if (isAuthenticated) {
      fetchList();
    }
  }, [isAuthenticated, resolvedParams.id]);

  async function fetchList() {
    try {
      const res = await fetch(`/api/lists/${resolvedParams.id}`);
      if (!res.ok) throw new Error('List not found');

      const data = await res.json();
      setList(data.list);
      setLoading(false);

      // Auto-cluster on load if list has keywords
      if (data.keywords?.length > 0) {
        await runClustering();
      }
    } catch (err) {
      console.error('Error fetching list:', err);
      setError('Failed to load list');
      setLoading(false);
    }
  }

  async function runClustering() {
    try {
      setClustering(true);
      setError(null);

      const res = await fetch(`/api/lists/${resolvedParams.id}/cluster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          sensitivity,
          minClusterSize,
          targetClusters,
          skipAiNaming: fastMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cluster');
      }

      const data = await res.json();
      setClusters(data.clusters || []);
      setUnclustered(data.unclustered || []);
      setStats(data.stats || null);

      // Expand first 3 clusters by default
      setExpandedClusters(new Set(data.clusters?.slice(0, 3).map((c: Cluster) => c.id) || []));
    } catch (err: any) {
      console.error('Error clustering:', err);
      setError(err.message || 'Failed to cluster keywords');
    } finally {
      setClustering(false);
    }
  }

  function toggleClusterExpand(clusterId: number) {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  }

  function handleEditClusterName(cluster: Cluster) {
    setEditingCluster(cluster.id);
    setEditName(cluster.name);
  }

  function saveClusterName(clusterId: number) {
    setClusters(prev => prev.map(c =>
      c.id === clusterId ? { ...c, name: editName } : c
    ));
    setEditingCluster(null);
  }

  function formatNumber(num: number | string | null): string {
    if (num === null || num === undefined) return '-';
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '-';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  }

  function formatCurrency(num: number | string | null): string {
    if (num === null || num === undefined) return '-';
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '-';
    return `$${n.toFixed(2)}`;
  }

  async function handleCreateCampaign() {
    // Store clusters in sessionStorage and navigate to campaign wizard
    const campaignData = {
      fromClusters: true,
      listId: resolvedParams.id,
      listName: list?.name,
      adGroups: clusters.map(c => ({
        name: c.name,
        keywords: c.keywords.map(k => k.keyword),
        totalVolume: c.totalVolume,
        avgCpc: c.avgCpc,
      })),
    };

    sessionStorage.setItem('campaign-wizard-data', JSON.stringify(campaignData));
    router.push('/campaigns/create');
  }

  function exportToCSV() {
    const rows = [['Cluster', 'Keyword', 'Volume', 'CPC']];

    const formatCpcForExport = (cpc: number | string | null): string => {
      if (cpc === null || cpc === undefined) return '0.00';
      const n = typeof cpc === 'string' ? parseFloat(cpc) : cpc;
      return isNaN(n) ? '0.00' : n.toFixed(2);
    };

    clusters.forEach(cluster => {
      cluster.keywords.forEach(kw => {
        rows.push([
          cluster.name,
          kw.keyword,
          (kw.volume || 0).toString(),
          formatCpcForExport(kw.cpc),
        ]);
      });
    });

    if (unclustered.length > 0) {
      unclustered.forEach(kw => {
        rows.push([
          'Unclustered',
          kw.keyword,
          (kw.volume || 0).toString(),
          formatCpcForExport(kw.cpc),
        ]);
      });
    }

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${list?.name || 'clusters'}-clustered.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Save clusters state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{ lists: number; keywords: number } | null>(null);

  async function handleSaveClusters(mode: 'separate' | 'single') {
    if (clusters.length === 0) return;

    setSaving(true);
    setSaveSuccess(null);

    try {
      const response = await fetch(`/api/lists/${resolvedParams.id}/cluster/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusters: clusters.map(c => ({
            name: c.name,
            keywords: c.keywords,
            color: c.color,
          })),
          saveMode: mode,
          parentListName: list?.name,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save clusters');
      }

      const data = await response.json();
      setSaveSuccess({
        lists: data.savedLists.length,
        keywords: data.savedLists.reduce((sum: number, l: any) => sum + l.keywordCount, 0),
      });

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save clusters');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Please sign in</h2>
          <Link href="/auth/signin" className="mt-4 inline-block text-blue-600 hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">404</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">List not found</h2>
          <Link href="/lists" className="text-blue-600 hover:underline">
            Back to Lists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href={`/lists/${resolvedParams.id}`} className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${list.color}20` }}
                >
                  {list.icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Cluster Studio</h1>
                  <p className="text-sm text-gray-500">{list.name}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Save Dropdown */}
              <div className="relative group">
                <button
                  disabled={clusters.length === 0 || saving}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save as Lists
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 hidden group-hover:block z-20">
                  <button
                    onClick={() => handleSaveClusters('separate')}
                    disabled={saving}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
                  >
                    <div className="font-medium text-gray-900">Save as Separate Lists</div>
                    <div className="text-xs text-gray-500">Each cluster becomes a new list</div>
                  </button>
                  <button
                    onClick={() => handleSaveClusters('single')}
                    disabled={saving}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
                  >
                    <div className="font-medium text-gray-900">Save as Single List</div>
                    <div className="text-xs text-gray-500">All clusters in one list with notes</div>
                  </button>
                </div>
              </div>
              <button
                onClick={exportToCSV}
                disabled={clusters.length === 0}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              >
                Export CSV
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={clusters.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Create Campaign
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 pb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Method:</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'semantic' | 'ngram')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="semantic">Semantic (AI)</option>
                <option value="ngram">N-gram (Fast)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Sensitivity:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-gray-700 w-8">{sensitivity.toFixed(1)}</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Min Size:</label>
              <select
                value={minClusterSize}
                onChange={(e) => setMinClusterSize(parseInt(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                {[2, 3, 4, 5, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Clusters:</label>
              <select
                value={targetClusters}
                onChange={(e) => setTargetClusters(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="auto">Auto</option>
                {[3, 5, 8, 10, 15, 20].map(n => (
                  <option key={n} value={n.toString()}>{n}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fastMode}
                onChange={(e) => setFastMode(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-600">Fast Mode</span>
            </label>

            <button
              onClick={runClustering}
              disabled={clustering}
              className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 transition disabled:opacity-50"
            >
              {clustering ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Clustering...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-cluster
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-6 text-sm">
              <span className="text-gray-500">
                <span className="font-semibold text-gray-900">{stats.clusterCount}</span> Clusters
              </span>
              <span className="text-gray-500">
                <span className="font-semibold text-gray-900">{stats.clusteredKeywords}</span> Keywords
              </span>
              <span className="text-gray-500">
                Avg <span className="font-semibold text-gray-900">{Math.round(stats.clusteredKeywords / stats.clusterCount)}</span> per group
              </span>
              {unclustered.length > 0 && (
                <span className="text-yellow-600">
                  {unclustered.length} unclustered
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>
                Saved {saveSuccess.lists} list{saveSuccess.lists > 1 ? 's' : ''} with {saveSuccess.keywords} keywords!
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/lists" className="text-green-800 hover:text-green-900 underline font-medium">
                View Lists
              </Link>
              <button onClick={() => setSaveSuccess(null)} className="text-green-600 hover:text-green-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {clustering ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Generating semantic clusters with AI...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
          </div>
        ) : clusters.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Ready to cluster</h3>
            <p className="text-gray-500 mb-6">Click "Re-cluster" to group your keywords by meaning</p>
          </div>
        ) : (
          <div className="space-y-4">
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Cluster Header */}
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleClusterExpand(cluster.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: cluster.color }}
                    />
                    {editingCluster === cluster.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => saveClusterName(cluster.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveClusterName(cluster.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-lg font-semibold border-b-2 border-purple-500 focus:outline-none bg-transparent"
                        autoFocus
                      />
                    ) : (
                      <h3
                        className="text-lg font-semibold text-gray-900 hover:text-purple-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClusterName(cluster);
                        }}
                      >
                        {cluster.name}
                      </h3>
                    )}
                    <span className="text-sm text-gray-500">
                      ({cluster.keywords.length} keywords)
                    </span>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right text-sm">
                      <span className="text-gray-500">Vol: </span>
                      <span className="font-semibold text-gray-900">{formatNumber(cluster.totalVolume)}</span>
                    </div>
                    <div className="text-right text-sm">
                      <span className="text-gray-500">Avg CPC: </span>
                      <span className="font-semibold text-gray-900">{formatCurrency(cluster.avgCpc)}</span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${expandedClusters.has(cluster.id) ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Cluster Keywords */}
                {expandedClusters.has(cluster.id) && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2 mt-3">
                      {cluster.keywords.map((kw, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 bg-gray-100 rounded-full text-sm flex items-center gap-2 hover:bg-gray-200"
                          title={`Vol: ${formatNumber(kw.volume)} | CPC: ${formatCurrency(kw.cpc)}`}
                        >
                          <span>{kw.keyword}</span>
                          {kw.volume && kw.volume > 0 && (
                            <span className="text-xs text-gray-500">
                              {formatNumber(kw.volume)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Unclustered Keywords */}
            {unclustered.length > 0 && (
              <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-5">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3">
                  Unclustered ({unclustered.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {unclustered.map((kw, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 bg-yellow-100 rounded-full text-sm"
                    >
                      {kw.keyword}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
