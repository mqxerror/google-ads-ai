'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface KeywordList {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_favorite: boolean;
  keyword_count: number;
  total_search_volume: number | null;
  avg_cpc: number | null;
  created_at: string;
  updated_at: string;
}

interface KeywordListItem {
  id: string;
  list_id: string;
  keyword: string;
  keyword_normalized: string;
  position: number;
  snapshot_search_volume: number | null;
  snapshot_cpc: number | null;
  snapshot_opportunity_score: number | null;
  notes: string | null;
  added_at: string;
}

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [list, setList] = useState<KeywordList | null>(null);
  const [keywords, setKeywords] = useState<KeywordListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

  // Sorting
  const [sortBy, setSortBy] = useState<'keyword' | 'volume' | 'cpc' | 'added'>('volume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Edit mode
  const [editingList, setEditingList] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Add keywords modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addKeywordsText, setAddKeywordsText] = useState('');
  const [adding, setAdding] = useState(false);

  const isAuthenticated = status === 'authenticated' && session?.user;

  // Fetch list and keywords
  useEffect(() => {
    if (isAuthenticated) {
      fetchList();
    }
  }, [isAuthenticated, resolvedParams.id]);

  async function fetchList() {
    try {
      setLoading(true);
      const res = await fetch(`/api/lists/${resolvedParams.id}`);

      if (!res.ok) {
        if (res.status === 404) {
          setError('List not found');
        } else {
          throw new Error('Failed to fetch list');
        }
        return;
      }

      const data = await res.json();
      setList(data.list);
      setKeywords(data.keywords || []);
      setEditName(data.list.name);
      setEditDescription(data.list.description || '');
      setError(null);
    } catch (err) {
      console.error('Error fetching list:', err);
      setError('Failed to load list');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateList() {
    if (!list || !editName.trim()) return;

    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      const data = await res.json();
      setList(data.list);
      setEditingList(false);
    } catch (err) {
      console.error('Error updating list:', err);
      setError('Failed to update list');
    }
  }

  async function handleAddKeywords() {
    if (!addKeywordsText.trim()) return;

    try {
      setAdding(true);
      const keywordsToAdd = addKeywordsText
        .split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const res = await fetch(`/api/lists/${resolvedParams.id}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordsToAdd }),
      });

      if (!res.ok) throw new Error('Failed to add keywords');

      const data = await res.json();
      setShowAddModal(false);
      setAddKeywordsText('');
      await fetchList(); // Refresh the list
    } catch (err) {
      console.error('Error adding keywords:', err);
      setError('Failed to add keywords');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveSelected() {
    if (selectedKeywords.size === 0) return;

    try {
      const keywordsToRemove = Array.from(selectedKeywords);
      const res = await fetch(`/api/lists/${resolvedParams.id}/keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordsToRemove }),
      });

      if (!res.ok) throw new Error('Failed to remove keywords');

      setKeywords(prev => prev.filter(kw => !selectedKeywords.has(kw.keyword)));
      setSelectedKeywords(new Set());
    } catch (err) {
      console.error('Error removing keywords:', err);
      setError('Failed to remove keywords');
    }
  }

  function toggleKeywordSelection(keyword: string) {
    setSelectedKeywords(prev => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedKeywords.size === filteredKeywords.length) {
      setSelectedKeywords(new Set());
    } else {
      setSelectedKeywords(new Set(filteredKeywords.map(kw => kw.keyword)));
    }
  }

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
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

  // Filter and sort keywords
  const filteredKeywords = keywords
    .filter(kw =>
      searchQuery === '' ||
      kw.keyword.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'keyword':
          aVal = a.keyword.toLowerCase();
          bVal = b.keyword.toLowerCase();
          break;
        case 'volume':
          aVal = a.snapshot_search_volume || 0;
          bVal = b.snapshot_search_volume || 0;
          break;
        case 'cpc':
          aVal = a.snapshot_cpc || 0;
          bVal = b.snapshot_cpc || 0;
          break;
        case 'added':
          aVal = new Date(a.added_at).getTime();
          bVal = new Date(b.added_at).getTime();
          break;
        default:
          return 0;
      }
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Please sign in to access your keyword lists</h2>
          <Link href="/auth/signin" className="mt-4 inline-block text-blue-600 hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'List not found') {
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

  if (!list) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/lists" className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>

            {editingList ? (
              <div className="flex-1 flex items-center gap-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-2xl font-bold border-b-2 border-blue-500 focus:outline-none bg-transparent"
                  autoFocus
                />
                <button
                  onClick={handleUpdateList}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingList(false);
                    setEditName(list.name);
                    setEditDescription(list.description || '');
                  }}
                  className="px-3 py-1 text-gray-600 hover:text-gray-800 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${list.color}20` }}
                >
                  {list.icon}
                </div>
                <div>
                  <h1
                    className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600"
                    onClick={() => setEditingList(true)}
                  >
                    {list.name}
                  </h1>
                  {list.description && (
                    <p className="text-sm text-gray-500">{list.description}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Link
                href={`/lists/${list.id}/cluster`}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Cluster
              </Link>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Keywords
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Keywords:</span>
              <span className="font-semibold text-gray-900">{keywords.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Total Volume:</span>
              <span className="font-semibold text-gray-900">{formatNumber(list.total_search_volume)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Avg CPC:</span>
              <span className="font-semibold text-gray-900">{formatCurrency(list.avg_cpc)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full max-w-md pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {selectedKeywords.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedKeywords.size} selected
                </span>
                <button
                  onClick={handleRemoveSelected}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  Remove Selected
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && error !== 'List not found' && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {keywords.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No keywords yet</h3>
            <p className="text-gray-500 mb-6">Add keywords to this list to get started</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Add Keywords
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedKeywords.size === filteredKeywords.length && filteredKeywords.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('keyword')}
                  >
                    <div className="flex items-center gap-1">
                      Keyword
                      {sortBy === 'keyword' && (
                        <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('volume')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Volume
                      {sortBy === 'volume' && (
                        <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('cpc')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      CPC
                      {sortBy === 'cpc' && (
                        <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('added')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Added
                      {sortBy === 'added' && (
                        <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredKeywords.map((kw) => (
                  <tr
                    key={kw.id}
                    className={`hover:bg-gray-50 ${selectedKeywords.has(kw.keyword) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedKeywords.has(kw.keyword)}
                        onChange={() => toggleKeywordSelection(kw.keyword)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{kw.keyword}</span>
                      {kw.notes && (
                        <span className="ml-2 text-xs text-gray-500" title={kw.notes}>
                          📝
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {formatNumber(kw.snapshot_search_volume)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {formatCurrency(kw.snapshot_cpc)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {new Date(kw.added_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedKeywords(new Set([kw.keyword]));
                          handleRemoveSelected();
                        }}
                        className="text-gray-400 hover:text-red-500"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Keywords Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add Keywords</h2>
              <p className="text-sm text-gray-500 mt-1">Enter one keyword per line</p>
            </div>
            <div className="p-6">
              <textarea
                value={addKeywordsText}
                onChange={(e) => setAddKeywordsText(e.target.value)}
                placeholder="portugal golden visa&#10;golden visa cost&#10;portugal investment visa"
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                autoFocus
              />
              <p className="text-sm text-gray-500 mt-2">
                {addKeywordsText.split('\n').filter(k => k.trim()).length} keywords to add
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddKeywordsText('');
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddKeywords}
                disabled={!addKeywordsText.trim() || adding}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {adding ? 'Adding...' : 'Add Keywords'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
