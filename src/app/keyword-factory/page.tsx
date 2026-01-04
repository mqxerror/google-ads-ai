'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import KeywordDetailModal from './components/KeywordDetailModal';
import CampaignWizard from '@/components/campaigns/CampaignWizard';
import { GeneratedKeyword, FactoryStats } from './types';

// Compact target locations
const TARGET_LOCATIONS = [
  { code: 'US', flag: '🇺🇸', name: 'United States' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal' },
];

const INTENT_COLORS: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  transactional: { bg: 'bg-green-100', text: 'text-green-700', icon: '🛒', label: 'Transactional' },
  commercial: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🔎', label: 'Commercial' },
  informational: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '💡', label: 'Informational' },
  navigational: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🧭', label: 'Navigational' },
};

const MATCH_TYPE_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  EXACT: { label: 'Exact', color: 'bg-purple-100 text-purple-700', desc: 'Precise targeting' },
  PHRASE: { label: 'Phrase', color: 'bg-blue-100 text-blue-700', desc: 'Flexible match' },
  BROAD: { label: 'Broad', color: 'bg-gray-100 text-gray-600', desc: 'Wide reach' },
};

const COMPETITION_COLORS: Record<string, string> = {
  HIGH: 'text-red-600 bg-red-50',
  MEDIUM: 'text-yellow-600 bg-yellow-50',
  LOW: 'text-green-600 bg-green-50',
};

// Search history item type
interface SearchHistoryItem {
  id: string;
  seedKeywords: string[];
  targetLocation: string;
  keywordCount: number;
  timestamp: Date;
  keywords: GeneratedKeyword[];
}

export default function KeywordFactoryPage() {
  const { data: session, status } = useSession();
  const [seedInput, setSeedInput] = useState('');
  const [targetLocation, setTargetLocation] = useState('US');
  const [generating, setGenerating] = useState(false);
  const [keywords, setKeywords] = useState<GeneratedKeyword[]>([]);
  const [stats, setStats] = useState<FactoryStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selection
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

  // Expanded row for details
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Enrichment states
  const [enrichingVolume, setEnrichingVolume] = useState(false);
  const [enrichingIntent, setEnrichingIntent] = useState(false);
  const [enrichedKeywords, setEnrichedKeywords] = useState<Set<string>>(new Set());

  // Filters - Default sort by volume DESC (highest first)
  const [sortBy, setSortBy] = useState<'keyword' | 'volume' | 'cpc' | 'competition' | 'trend'>('volume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [intentFilter, setIntentFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Search History
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  // Modal
  const [selectedKeywordForDetail, setSelectedKeywordForDetail] = useState<GeneratedKeyword | null>(null);
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);

  // Save to List
  const [showSaveToListModal, setShowSaveToListModal] = useState(false);
  const [lists, setLists] = useState<Array<{ id: string; name: string; icon: string; color: string; keyword_count: number }>>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [savingToList, setSavingToList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingNewList, setCreatingNewList] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{ added: number; duplicates: number; listName: string } | null>(null);
  const [enrichSuccess, setEnrichSuccess] = useState<{ type: string; count: number; cached?: number; cost?: string } | null>(null);

  const isAuthenticated = status === 'authenticated' && session?.user;

  // Load search history from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('keyword-factory-history');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSearchHistory(parsed.map((h: any) => ({
            ...h,
            timestamp: new Date(h.timestamp),
          })));
        } catch (e) {
          console.error('Failed to parse search history');
        }
      }
    }
  }, []);

  // Save search history to localStorage
  function saveToHistory(seeds: string[], location: string, keywords: GeneratedKeyword[]) {
    const newItem: SearchHistoryItem = {
      id: Date.now().toString(),
      seedKeywords: seeds,
      targetLocation: location,
      keywordCount: keywords.length,
      timestamp: new Date(),
      keywords,
    };

    setSearchHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 20); // Keep last 20
      localStorage.setItem('keyword-factory-history', JSON.stringify(updated));
      return updated;
    });
  }

  // Load keywords from history
  function loadFromHistory(item: SearchHistoryItem) {
    setKeywords(item.keywords);
    setSeedInput(item.seedKeywords.join(', '));
    setTargetLocation(item.targetLocation);
    setSelectedKeywords(new Set());
    setExpandedRow(null);
    setEnrichedKeywords(new Set());
  }

  // Delete history item
  function deleteHistoryItem(id: string) {
    setSearchHistory(prev => {
      const updated = prev.filter(h => h.id !== id);
      localStorage.setItem('keyword-factory-history', JSON.stringify(updated));
      return updated;
    });
  }

  // Clear all history
  function clearHistory() {
    setSearchHistory([]);
    localStorage.removeItem('keyword-factory-history');
  }

  // Enrichment loading state
  const [enrichmentProgress, setEnrichmentProgress] = useState<string | null>(null);

  // Generate keywords then auto-fetch Google Ads metrics
  async function handleGenerate(inputKeywords?: string[]) {
    const seeds = inputKeywords || seedInput
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (seeds.length === 0) return;

    setGenerating(true);
    setError(null);
    setExpandedRow(null);
    setEnrichedKeywords(new Set());
    setEnrichmentProgress(null);

    try {
      // Step 1: Generate keywords (fast - autocomplete only)
      const res = await fetch('/api/keywords/factory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedKeywords: seeds,
          options: {
            generateVariations: true,
            generateSynonyms: true,
            includeNegatives: true,
            enrichWithMetrics: false,
            targetLocation,
          },
        }),
      });

      const data = await res.json();

      if (data.error && !data.keywords?.length) {
        setError(data.error);
        setGenerating(false);
        return;
      }

      // Show keywords immediately - they now come WITH metrics from Google Ads Keyword Planner
      const generatedKeywords = data.keywords || [];
      setKeywords(generatedKeywords);
      setStats(data.stats);
      setSelectedKeywords(new Set());
      setGenerating(false);

      // Count how many keywords already have metrics
      const withMetrics = generatedKeywords.filter((k: GeneratedKeyword) => k.metrics?.searchVolume != null).length;
      console.log(`[Keyword Factory] Received ${generatedKeywords.length} keywords, ${withMetrics} with metrics`);

      // Mark keywords with metrics as enriched
      if (withMetrics > 0) {
        setEnrichedKeywords(new Set(
          generatedKeywords
            .filter((k: GeneratedKeyword) => k.metrics?.searchVolume != null)
            .map((k: GeneratedKeyword) => k.keyword)
        ));
      }

      // Save to history
      saveToHistory(seeds, targetLocation, generatedKeywords);

    } catch (err) {
      setError('Failed to generate keywords');
      setGenerating(false);
    }
  }

  // Import from CSV file
  function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        // Parse CSV - extract first column (keywords)
        const lines = text.split('\n');
        const keywords: string[] = [];

        lines.forEach((line, i) => {
          // Skip header row if it looks like a header
          if (i === 0 && (line.toLowerCase().includes('keyword') || line.toLowerCase().includes('term'))) {
            return;
          }
          const cols = line.split(',');
          const kw = cols[0]?.trim().replace(/^["']|["']$/g, '');
          if (kw && kw.length > 0) {
            keywords.push(kw);
          }
        });

        if (keywords.length > 0) {
          setSeedInput(keywords.slice(0, 50).join('\n')); // Limit to 50
          handleGenerate(keywords.slice(0, 50));
        }
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Paste from clipboard
  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Parse pasted text - one keyword per line or comma separated
        const keywords = text
          .split(/[,\n]/)
          .map(s => s.trim().replace(/^["']|["']$/g, ''))
          .filter(s => s.length > 0 && s.length < 100)
          .slice(0, 50);

        if (keywords.length > 0) {
          setSeedInput(keywords.join('\n'));
          setShowImportModal(false);
        }
      }
    } catch (err) {
      setError('Failed to read clipboard. Please paste manually.');
    }
  }

  // Import from text modal
  function handleImportFromText() {
    if (!importText.trim()) return;

    const keywords = importText
      .split(/[,\n]/)
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(s => s.length > 0 && s.length < 100)
      .slice(0, 50);

    if (keywords.length > 0) {
      setSeedInput(keywords.join('\n'));
      setShowImportModal(false);
      setImportText('');
    }
  }

  // ON-DEMAND: Enrich selected keywords with Volume/CPC
  async function handleEnrichVolume() {
    const toEnrich = selectedKeywords.size > 0
      ? keywords.filter(k => selectedKeywords.has(k.keyword))
      : keywords.slice(0, 50);

    if (toEnrich.length === 0) return;

    setEnrichingVolume(true);

    try {
      const res = await fetch('/api/keywords/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: toEnrich.map(k => k.keyword),
          targetLocation,
          providers: ['google_ads'],
        }),
      });

      const data = await res.json();

      // Show error message if present
      if (data.error) {
        setError(data.error);
      }

      if (data.enriched && Object.keys(data.enriched).length > 0) {
        setKeywords(prev => prev.map(kw => {
          const enriched = data.enriched[kw.keyword];
          if (enriched) {
            const newKw: GeneratedKeyword = {
              ...kw,
              metrics: {
                searchVolume: enriched.searchVolume ?? null,
                cpc: enriched.cpc ?? null,
                competition: enriched.competition ?? null,
                difficulty: kw.metrics?.difficulty ?? null,
                organicCtr: kw.metrics?.organicCtr ?? null,
                dataSource: 'google_ads',
                lastUpdated: new Date().toISOString(),
                cacheAge: 0,
                lowBidMicros: enriched.lowBidMicros,
                highBidMicros: enriched.highBidMicros,
                monthlySearchVolumes: enriched.monthlySearchVolumes,
                threeMonthChange: enriched.threeMonthChange,
                yearOverYearChange: enriched.yearOverYearChange,
              },
            };
            return newKw;
          }
          return kw;
        }));

        setEnrichedKeywords(prev => {
          const next = new Set(prev);
          toEnrich.forEach(k => next.add(k.keyword));
          return next;
        });
      }
    } catch (err) {
      setError('Failed to enrich keywords');
    } finally {
      setEnrichingVolume(false);
    }
  }

  // ON-DEMAND: Classify intent using DataForSEO
  async function handleClassifyIntent() {
    const toClassify = selectedKeywords.size > 0
      ? keywords.filter(k => selectedKeywords.has(k.keyword))
      : keywords.slice(0, 1000); // Limit to 1000 for DataForSEO

    if (toClassify.length === 0) return;

    setEnrichingIntent(true);

    try {
      const res = await fetch('/api/keywords/classify-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: toClassify.map(k => k.keyword),
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error + (data.details ? `: ${data.details}` : ''));
        return;
      }

      if (data.results) {
        setKeywords(prev => prev.map(kw => {
          const result = data.results[kw.keyword];
          if (result && result.intent) {
            const newKw: GeneratedKeyword = {
              ...kw,
              estimatedIntent: result.intent,
              metrics: kw.metrics ? {
                ...kw.metrics,
                intentSource: 'dataforseo',
                intentConfidence: result.confidence,
              } : {
                searchVolume: null,
                cpc: null,
                competition: null,
                difficulty: null,
                organicCtr: null,
                dataSource: 'unavailable' as const,
                lastUpdated: new Date().toISOString(),
                cacheAge: 0,
                intentSource: 'dataforseo' as const,
                intentConfidence: result.confidence,
              },
            };
            return newKw;
          }
          return kw;
        }));

        // Show success notification
        if (data.stats) {
          setEnrichSuccess({
            type: 'Intent',
            count: data.stats.withIntent || 0,
            cached: data.stats.cached || 0,
            cost: data.stats.estimatedCost,
          });
          setTimeout(() => setEnrichSuccess(null), 5000);
        }
      }
    } catch (err) {
      console.error('[Intent] Error:', err);
      setError('Failed to classify intent');
    } finally {
      setEnrichingIntent(false);
    }
  }

  // Toggle keyword selection
  function toggleKeyword(keyword: string) {
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

  // Toggle row expansion
  function toggleRowExpand(keyword: string) {
    setExpandedRow(prev => prev === keyword ? null : keyword);
  }

  // Select all visible keywords
  function selectAll() {
    setSelectedKeywords(new Set(sortedKeywords.map(k => k.keyword)));
  }

  // Clear selection
  function clearSelection() {
    setSelectedKeywords(new Set());
  }

  // Sort and filter keywords
  const filteredKeywords = [...keywords]
    .filter(k => intentFilter === 'all' || k.estimatedIntent === intentFilter)
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'volume':
          comparison = (a.metrics?.searchVolume || 0) - (b.metrics?.searchVolume || 0);
          break;
        case 'cpc':
          comparison = (a.metrics?.cpc || 0) - (b.metrics?.cpc || 0);
          break;
        case 'competition':
          const compOrder: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
          comparison = (compOrder[a.metrics?.competition || 'LOW'] || 0) - (compOrder[b.metrics?.competition || 'LOW'] || 0);
          break;
        case 'trend':
          comparison = (a.metrics?.threeMonthChange || 0) - (b.metrics?.threeMonthChange || 0);
          break;
        default:
          comparison = a.keyword.localeCompare(b.keyword);
      }
      return sortDir === 'desc' ? -comparison : comparison;
    });

  // Pagination
  const totalPages = Math.ceil(filteredKeywords.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const sortedKeywords = filteredKeywords.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [intentFilter, pageSize, keywords.length]);

  // Export CSV
  function exportCSV() {
    const selected = selectedKeywords.size > 0
      ? keywords.filter(k => selectedKeywords.has(k.keyword))
      : keywords;

    const csv = [
      'Keyword,Volume,CPC,Competition,Intent,Match Type',
      ...selected.map(k =>
        `"${k.keyword}",${k.metrics?.searchVolume || ''},${k.metrics?.cpc?.toFixed(2) || ''},${k.metrics?.competition || ''},${k.estimatedIntent},${k.suggestedMatchType}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  // Copy to clipboard
  function copyToClipboard() {
    const selected = selectedKeywords.size > 0
      ? Array.from(selectedKeywords)
      : keywords.map(k => k.keyword);
    navigator.clipboard.writeText(selected.join('\n'));
  }

  // Fetch lists for Save to List modal
  async function fetchLists() {
    try {
      setListsLoading(true);
      const res = await fetch('/api/lists');
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
      }
    } catch (err) {
      console.error('Error fetching lists:', err);
    } finally {
      setListsLoading(false);
    }
  }

  // Open Save to List modal
  function openSaveToListModal() {
    setShowSaveToListModal(true);
    fetchLists();
  }

  // Save selected keywords to a list
  async function saveToList(listId: string, listName?: string) {
    const keywordsToSave = selectedKeywords.size > 0
      ? keywords.filter(k => selectedKeywords.has(k.keyword))
      : keywords;

    if (keywordsToSave.length === 0) return;

    try {
      setSavingToList(true);
      const res = await fetch(`/api/lists/${listId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywordsToSave.map(k => ({
            keyword: k.keyword,
            searchVolume: k.metrics?.searchVolume,
            cpc: k.metrics?.cpc,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      const data = await res.json();
      setShowSaveToListModal(false);
      // Show success toast
      setSaveSuccess({
        added: data.added,
        duplicates: data.duplicates,
        listName: listName || 'list'
      });
      // Auto-hide after 4 seconds
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      console.error('Error saving to list:', err);
      setError('Failed to save keywords to list');
    } finally {
      setSavingToList(false);
    }
  }

  // Create new list and save keywords
  async function createListAndSave() {
    if (!newListName.trim()) return;

    const listNameToCreate = newListName.trim();

    try {
      setCreatingNewList(true);

      // Create list
      const createRes = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: listNameToCreate }),
      });

      if (!createRes.ok) throw new Error('Failed to create list');

      const { list } = await createRes.json();

      // Save keywords to the new list
      await saveToList(list.id, listNameToCreate);
      setNewListName('');
    } catch (err) {
      console.error('Error creating list:', err);
      setError('Failed to create list');
    } finally {
      setCreatingNewList(false);
    }
  }

  // Handle sort click
  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  }

  // Format micros to dollars
  function formatBid(micros: number | null | undefined): string {
    if (!micros) return '—';
    return `$${(micros / 1000000).toFixed(2)}`;
  }

  // Format date
  function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text mb-2">Keyword Factory</h1>
          <p className="text-text2 mb-6">Sign in to research keywords with real metrics</p>
          <Link href="/login" className="btn-primary">Sign In with Google</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".csv,.txt"
        className="hidden"
      />

      {/* Compact Header Bar */}
      <header className="bg-surface border-b border-divider sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </Link>

            {/* Search Input */}
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1 max-w-xl">
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  placeholder="Enter keywords (comma separated)..."
                  className="w-full pl-4 pr-10 py-2 bg-surface2 rounded-lg text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
                {seedInput && (
                  <button
                    onClick={() => setSeedInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Location */}
              <select
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                className="px-2 py-2 bg-surface2 rounded-lg text-sm text-text focus:outline-none"
              >
                {TARGET_LOCATIONS.map(loc => (
                  <option key={loc.code} value={loc.code}>{loc.flag} {loc.code}</option>
                ))}
              </select>

              {/* Generate */}
              <button
                onClick={() => handleGenerate()}
                disabled={generating || !seedInput.trim()}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                <span className="hidden sm:inline">{generating ? 'Searching...' : 'Search'}</span>
              </button>

              <div className="h-6 w-px bg-divider" />

              {/* Import Options */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 text-sm bg-surface2 rounded-lg hover:bg-surface3 flex items-center gap-1.5"
                title="Import from CSV"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="hidden md:inline">CSV</span>
              </button>

              <button
                onClick={handlePasteFromClipboard}
                className="px-3 py-2 text-sm bg-surface2 rounded-lg hover:bg-surface3 flex items-center gap-1.5"
                title="Paste from clipboard"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="hidden md:inline">Paste</span>
              </button>

              <button
                onClick={() => setShowImportModal(true)}
                className="px-3 py-2 text-sm bg-surface2 rounded-lg hover:bg-surface3 flex items-center gap-1.5"
                title="Bulk import"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
                <span className="hidden md:inline">Bulk</span>
              </button>

              <div className="h-6 w-px bg-divider" />

              {/* Lists Shortcut */}
              <Link
                href="/lists"
                className="px-3 py-2 text-sm bg-orange-500/10 text-orange-600 rounded-lg hover:bg-orange-500/20 flex items-center gap-1.5"
                title="My Keyword Lists"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="hidden md:inline">Lists</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout - History Sidebar + Results */}
      <div className="flex-1 flex overflow-hidden">
        {/* History Sidebar */}
        <aside className={`${showHistory ? 'w-64' : 'w-0'} flex-shrink-0 bg-surface border-r border-divider transition-all overflow-hidden`}>
          <div className="w-64 h-full flex flex-col">
            <div className="p-3 border-b border-divider flex items-center justify-between">
              <span className="font-medium text-text text-sm">Search History</span>
              {searchHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-text3 hover:text-red-500"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {searchHistory.length === 0 ? (
                <div className="p-4 text-center text-text3 text-sm">
                  No searches yet
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {searchHistory.map(item => (
                    <div
                      key={item.id}
                      className="p-3 hover:bg-surface2 cursor-pointer group"
                      onClick={() => loadFromHistory(item)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text truncate">
                            {item.seedKeywords.slice(0, 2).join(', ')}
                            {item.seedKeywords.length > 2 && ` +${item.seedKeywords.length - 2}`}
                          </p>
                          <p className="text-xs text-text3 mt-0.5">
                            {item.keywordCount} keywords • {item.targetLocation} • {formatDate(item.timestamp)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHistoryItem(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-text3 hover:text-red-500"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Toggle History Button */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-surface2 p-1 rounded-r-lg border border-l-0 border-divider hover:bg-surface3"
          style={{ marginLeft: showHistory ? '256px' : '0' }}
        >
          <svg className={`w-4 h-4 text-text3 transition-transform ${showHistory ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Empty State */}
          {keywords.length === 0 && !generating && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-lg">
                <div className="w-20 h-20 rounded-2xl bg-surface2 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-text mb-2">Start Your Keyword Research</h2>
                <p className="text-text2 mb-6">
                  Enter seed keywords above, import a CSV, or paste from clipboard
                </p>
                <div className="flex flex-wrap gap-2 justify-center text-sm mb-6">
                  <span className="px-3 py-1.5 bg-surface2 rounded-lg text-text3">portugal golden visa</span>
                  <span className="px-3 py-1.5 bg-surface2 rounded-lg text-text3">best crm software</span>
                  <span className="px-3 py-1.5 bg-surface2 rounded-lg text-text3">running shoes</span>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-surface2 rounded-lg hover:bg-surface3 text-text flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Import CSV
                  </button>
                  <button
                    onClick={handlePasteFromClipboard}
                    className="px-4 py-2 bg-surface2 rounded-lg hover:bg-surface3 text-text flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Paste Keywords
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {generating && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text2">Generating keywords...</p>
              </div>
            </div>
          )}

          {/* Results */}
          {keywords.length > 0 && !generating && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Toolbar */}
              <div className="bg-surface border-b border-divider px-4 py-2 flex-shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-text font-medium">{filteredKeywords.length} keywords</span>

                  {/* Enrichment Progress */}
                  {enrichmentProgress && (
                    <span className="text-sm text-accent flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      {enrichmentProgress}
                    </span>
                  )}

                  <div className="h-4 w-px bg-divider" />

                  {/* Page Size */}
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1.5 text-sm bg-surface2 rounded-lg"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>

                  <div className="h-4 w-px bg-divider" />

                  {/* Enrich Actions */}
                  <button
                    onClick={handleEnrichVolume}
                    disabled={enrichingVolume || keywords.length === 0}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {enrichingVolume && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    📊 Get Volume {selectedKeywords.size > 0 ? `(${selectedKeywords.size})` : keywords.length > 0 ? `(${Math.min(keywords.length, 100)})` : ''}
                  </button>

                  <button
                    onClick={handleClassifyIntent}
                    disabled={enrichingIntent || keywords.length === 0}
                    className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {enrichingIntent && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    🧠 Classify Intent {selectedKeywords.size > 0 ? `(${selectedKeywords.size})` : keywords.length > 0 ? `(${Math.min(keywords.length, 1000)})` : ''}
                  </button>

                  <div className="flex-1" />

                  {/* Filter */}
                  <select
                    value={intentFilter}
                    onChange={(e) => setIntentFilter(e.target.value)}
                    className="px-2 py-1.5 text-sm bg-surface2 rounded-lg"
                  >
                    <option value="all">All Intents</option>
                    <option value="transactional">Transactional</option>
                    <option value="commercial">Commercial</option>
                    <option value="informational">Informational</option>
                  </select>

                  {/* Actions */}
                  {selectedKeywords.size > 0 && (
                    <>
                      <span className="text-sm text-text2">{selectedKeywords.size} selected</span>
                      <button onClick={copyToClipboard} className="px-2 py-1.5 text-sm bg-surface2 rounded-lg hover:bg-surface3">Copy</button>
                      <button onClick={exportCSV} className="px-2 py-1.5 text-sm bg-accent text-white rounded-lg">Export</button>
                      <button onClick={openSaveToListModal} className="px-2 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        Save to List
                      </button>
                      <button onClick={() => setShowCampaignWizard(true)} className="px-2 py-1.5 text-sm bg-emerald-500 text-white rounded-lg">+ Campaign</button>
                    </>
                  )}
                  <button onClick={selectAll} className="text-sm text-accent hover:underline">Select All</button>
                  {selectedKeywords.size > 0 && <button onClick={clearSelection} className="text-sm text-text3 hover:underline">Clear</button>}
                </div>
              </div>

              {/* Table - All KPIs visible */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface2 sticky top-0 z-10">
                    <tr>
                      <th className="w-8 p-2">
                        <input
                          type="checkbox"
                          checked={selectedKeywords.size === sortedKeywords.length && sortedKeywords.length > 0}
                          onChange={() => selectedKeywords.size === sortedKeywords.length ? clearSelection() : selectAll()}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="p-2 text-left font-medium text-text2 cursor-pointer min-w-[200px]" onClick={() => handleSort('keyword')}>
                        Keyword {sortBy === 'keyword' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="p-2 text-right font-medium text-text2 w-20 cursor-pointer" onClick={() => handleSort('volume')}>
                        Volume {sortBy === 'volume' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="p-2 text-right font-medium text-text2 w-16 cursor-pointer" onClick={() => handleSort('cpc')}>
                        CPC {sortBy === 'cpc' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="p-2 text-right font-medium text-text2 w-20" title="Low Bid - High Bid">Bid Range</th>
                      <th className="p-2 text-center font-medium text-text2 w-12 cursor-pointer" onClick={() => handleSort('competition')}>
                        Comp {sortBy === 'competition' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="p-2 text-right font-medium text-text2 w-14 cursor-pointer" onClick={() => handleSort('trend')} title="3 Month Change">
                        3M% {sortBy === 'trend' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="p-2 text-right font-medium text-text2 w-14" title="Year over Year Change">YoY%</th>
                      <th className="p-2 text-center font-medium text-text2 w-28">Intent</th>
                      <th className="p-2 text-center font-medium text-text2 w-20">Match Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedKeywords.map((kw) => (
                      <tr
                        key={kw.keyword}
                        className={`border-t border-divider hover:bg-surface2/50 ${selectedKeywords.has(kw.keyword) ? 'bg-accent/5' : ''}`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedKeywords.has(kw.keyword)}
                            onChange={() => toggleKeyword(kw.keyword)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="p-2 font-medium text-text">{kw.keyword}</td>
                        <td className="p-2 text-right tabular-nums">
                          {kw.metrics?.searchVolume ? kw.metrics.searchVolume.toLocaleString() : <span className="text-text3">—</span>}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {kw.metrics?.cpc ? `$${kw.metrics.cpc.toFixed(2)}` : <span className="text-text3">—</span>}
                        </td>
                        <td className="p-2 text-right text-xs tabular-nums text-text2">
                          {kw.metrics?.lowBidMicros ? (
                            <span>{formatBid(kw.metrics.lowBidMicros)}-{formatBid(kw.metrics.highBidMicros)}</span>
                          ) : <span className="text-text3">—</span>}
                        </td>
                        <td className="p-2 text-center">
                          {kw.metrics?.competition ? (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${COMPETITION_COLORS[kw.metrics.competition]}`}>
                              {kw.metrics.competition === 'HIGH' ? 'High' : kw.metrics.competition === 'MEDIUM' ? 'Medium' : 'Low'}
                            </span>
                          ) : <span className="text-text3">—</span>}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {kw.metrics?.threeMonthChange != null ? (
                            <span className={`text-xs font-medium ${kw.metrics.threeMonthChange > 0 ? 'text-green-600' : kw.metrics.threeMonthChange < 0 ? 'text-red-500' : 'text-text3'}`}>
                              {kw.metrics.threeMonthChange > 0 ? '+' : ''}{kw.metrics.threeMonthChange}%
                            </span>
                          ) : <span className="text-text3">—</span>}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {kw.metrics?.yearOverYearChange != null ? (
                            <span className={`text-xs font-medium ${kw.metrics.yearOverYearChange > 0 ? 'text-green-600' : kw.metrics.yearOverYearChange < 0 ? 'text-red-500' : 'text-text3'}`}>
                              {kw.metrics.yearOverYearChange > 0 ? '+' : ''}{kw.metrics.yearOverYearChange}%
                            </span>
                          ) : <span className="text-text3">—</span>}
                        </td>
                        <td className="p-2 text-center">
                          {/* Show intent from any source (rules, embeddings, ollama) */}
                          {kw.estimatedIntent && INTENT_COLORS[kw.estimatedIntent] ? (
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${INTENT_COLORS[kw.estimatedIntent].bg} ${INTENT_COLORS[kw.estimatedIntent].text}`}
                              title={`${kw.estimatedIntent}${kw.metrics?.intentSource ? ` (${kw.metrics.intentSource})` : ''}`}
                            >
                              {INTENT_COLORS[kw.estimatedIntent].icon} {INTENT_COLORS[kw.estimatedIntent].label}
                            </span>
                          ) : <span className="text-text3 text-xs">—</span>}
                        </td>
                        <td className="p-2 text-center">
                          {kw.suggestedMatchType && MATCH_TYPE_LABELS[kw.suggestedMatchType] ? (
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${MATCH_TYPE_LABELS[kw.suggestedMatchType].color}`}
                              title={MATCH_TYPE_LABELS[kw.suggestedMatchType].desc}
                            >
                              {MATCH_TYPE_LABELS[kw.suggestedMatchType].label}
                            </span>
                          ) : <span className="text-text3 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="bg-surface border-t border-divider px-4 py-2 flex items-center justify-between flex-shrink-0">
                  <span className="text-sm text-text2">
                    Showing {startIndex + 1}-{Math.min(startIndex + pageSize, filteredKeywords.length)} of {filteredKeywords.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm bg-surface2 rounded hover:bg-surface3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ««
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm bg-surface2 rounded hover:bg-surface3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      «
                    </button>
                    <span className="px-3 py-1 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-sm bg-surface2 rounded hover:bg-surface3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      »
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-sm bg-surface2 rounded hover:bg-surface3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      »»
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-text mb-4">Bulk Import Keywords</h3>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste keywords here (one per line or comma separated)"
              rows={8}
              className="w-full p-3 bg-surface2 rounded-lg text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
            <p className="text-xs text-text3 mt-2">Max 50 keywords</p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowImportModal(false)} className="flex-1 py-2 bg-surface2 rounded-lg hover:bg-surface3">Cancel</button>
              <button onClick={handleImportFromText} className="flex-1 py-2 bg-accent text-white rounded-lg hover:bg-accent/90">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Save to List Modal */}
      {showSaveToListModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-divider">
              <h2 className="text-lg font-semibold text-text">Save to List</h2>
              <p className="text-sm text-text2 mt-1">
                {selectedKeywords.size > 0
                  ? `Save ${selectedKeywords.size} selected keywords`
                  : `Save all ${keywords.length} keywords`}
              </p>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {/* Create New List */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="New list name..."
                    className="flex-1 px-3 py-2 bg-surface2 rounded-lg text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    onClick={createListAndSave}
                    disabled={!newListName.trim() || creatingNewList}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {creatingNewList ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    Create
                  </button>
                </div>
              </div>

              {/* Existing Lists */}
              {listsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : lists.length === 0 ? (
                <div className="text-center py-8 text-text3">
                  <p>No lists yet</p>
                  <p className="text-sm mt-1">Create your first list above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-text3 uppercase tracking-wider mb-2">Or add to existing list</p>
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => saveToList(list.id, list.name)}
                      disabled={savingToList}
                      className="w-full flex items-center gap-3 p-3 bg-surface2 hover:bg-surface3 rounded-lg text-left transition disabled:opacity-50"
                    >
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-sm"
                        style={{ backgroundColor: `${list.color}20` }}
                      >
                        {list.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text truncate">{list.name}</p>
                        <p className="text-xs text-text3">{list.keyword_count} keywords</p>
                      </div>
                      {savingToList ? (
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-divider flex justify-between items-center">
              <Link
                href="/lists"
                className="text-sm text-accent hover:underline"
              >
                Manage Lists
              </Link>
              <button
                onClick={() => setShowSaveToListModal(false)}
                className="px-4 py-2 bg-surface2 rounded-lg hover:bg-surface3 text-text"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay for Intent/Volume */}
      {(enrichingIntent || enrichingVolume) && (
        <div className="fixed bottom-20 right-4 bg-surface border border-divider rounded-xl shadow-xl p-4 z-50 min-w-[280px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <p className="font-medium text-text">
                {enrichingIntent && 'Classifying Intent...'}
                {enrichingVolume && 'Getting Search Volume...'}
              </p>
              <p className="text-sm text-text2">
                {enrichingIntent && 'DataForSEO Search Intent (~$0.02/1000 kw)'}
                {enrichingVolume && 'Google Ads Keyword Planner'}
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-surface2 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span>{error}</span>
          <button onClick={() => setError(null)}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
      )}

      {/* Success Toast */}
      {saveSuccess && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-bottom-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-medium">Saved to "{saveSuccess.listName}"</p>
            <p className="text-sm text-emerald-100">
              {saveSuccess.added} added{saveSuccess.duplicates > 0 ? `, ${saveSuccess.duplicates} duplicates skipped` : ''}
            </p>
          </div>
          <Link
            href="/lists"
            className="ml-2 px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30 transition"
          >
            View Lists
          </Link>
          <button onClick={() => setSaveSuccess(null)} className="ml-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Enrichment Success Toast */}
      {enrichSuccess && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-bottom-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-medium">Intent Classified</p>
            <p className="text-sm text-blue-100">
              {enrichSuccess.count} keywords classified
              {enrichSuccess.cached ? ` (${enrichSuccess.cached} cached)` : ''}
              {enrichSuccess.cost ? ` • Cost: ${enrichSuccess.cost}` : ''}
            </p>
          </div>
          <button onClick={() => setEnrichSuccess(null)} className="ml-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Modals */}
      <KeywordDetailModal keyword={selectedKeywordForDetail} onClose={() => setSelectedKeywordForDetail(null)} />
      <CampaignWizard isOpen={showCampaignWizard} onClose={() => { setShowCampaignWizard(false); setSelectedKeywords(new Set()); }} preSelectedKeywords={keywords.filter(k => selectedKeywords.has(k.keyword))} />
    </div>
  );
}
