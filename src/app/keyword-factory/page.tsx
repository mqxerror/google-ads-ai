'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BulkActionBar from './components/BulkActionBar';
import KeywordDetailModal from './components/KeywordDetailModal';
import KeywordTable from './components/KeywordTable';
import TrackRankingsModal from './components/TrackRankingsModal';
import TrackSuccessModal from './components/TrackSuccessModal';

interface GeneratedKeyword {
  keyword: string;
  type: 'seed' | 'variation' | 'synonym' | 'modifier' | 'long_tail';
  source: string;
  suggestedMatchType: 'EXACT' | 'PHRASE' | 'BROAD';
  estimatedIntent: 'transactional' | 'informational' | 'navigational' | 'commercial';
  negativeCandidate?: boolean;
  negativeReason?: string;
  // NEW: Real metrics
  metrics?: {
    searchVolume: number | null;
    cpc: number | null;
    competition: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    difficulty: number | null;
    organicCtr: number | null;
    dataSource: 'google_ads' | 'moz' | 'dataforseo' | 'cached' | 'unavailable';
    lastUpdated: string;
    cacheAge: number;
  };
  opportunityScore?: number;
}

interface KeywordCluster {
  theme: string;
  keywords: GeneratedKeyword[];
  suggestedAdGroup: string;
}

interface Campaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  type: 'SEARCH' | 'DISPLAY' | 'SHOPPING' | 'VIDEO' | 'PERFORMANCE_MAX';
}

interface FactoryStats {
  totalGenerated: number;
  byType: Record<string, number>;
  byIntent: Record<string, number>;
  byMatchType: Record<string, number>;
  negativesSuggested: number;
  clusters: number;
  // NEW: Enrichment stats
  enrichment?: {
    enriched: number;
    cached: number;
    googleFetched: number;
    mozFetched: number;
    dataForSeoFetched: number;
    failed: number;
    estimatedCost: number;
    warnings: string[];
  };
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  seed: { bg: 'bg-accent-light', text: 'text-accent' },
  variation: { bg: 'bg-blue-100', text: 'text-blue-600' },
  synonym: { bg: 'bg-purple-100', text: 'text-purple-600' },
  modifier: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  long_tail: { bg: 'bg-orange-100', text: 'text-orange-600' },
};

const SOURCE_BADGES: Record<string, { icon: string; label: string; color: string }> = {
  google_autocomplete: { icon: '🔍', label: 'Google Suggests', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  google_ads_suggestion: { icon: '🎯', label: 'Google Ads', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  user_input: { icon: '✏️', label: 'Manual', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
};

const INTENT_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  transactional: { bg: 'bg-success-light', text: 'text-success', icon: '💰' },
  commercial: { bg: 'bg-warning-light', text: 'text-warning', icon: '🔍' },
  informational: { bg: 'bg-blue-100', text: 'text-blue-600', icon: '📚' },
  navigational: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🧭' },
};

const MATCH_TYPE_ICONS: Record<string, string> = {
  EXACT: '[exact]',
  PHRASE: '"phrase"',
  BROAD: '+broad',
};

// Common target locations (Google Ads geoTargetConstants)
const TARGET_LOCATIONS = [
  { code: 'US', name: '🇺🇸 United States', geoCode: '2840' },
  { code: 'GB', name: '🇬🇧 United Kingdom', geoCode: '2826' },
  { code: 'CA', name: '🇨🇦 Canada', geoCode: '2124' },
  { code: 'AU', name: '🇦🇺 Australia', geoCode: '2036' },
  { code: 'DE', name: '🇩🇪 Germany', geoCode: '2276' },
  { code: 'FR', name: '🇫🇷 France', geoCode: '2250' },
  { code: 'ES', name: '🇪🇸 Spain', geoCode: '2724' },
  { code: 'IT', name: '🇮🇹 Italy', geoCode: '2380' },
  { code: 'PT', name: '🇵🇹 Portugal', geoCode: '2620' },
  { code: 'BR', name: '🇧🇷 Brazil', geoCode: '2076' },
  { code: 'IN', name: '🇮🇳 India', geoCode: '2356' },
  { code: 'SG', name: '🇸🇬 Singapore', geoCode: '2702' },
  { code: 'AE', name: '🇦🇪 UAE', geoCode: '2784' },
];

export default function KeywordFactoryPage() {
  const { data: session, status } = useSession();
  const [seedInput, setSeedInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [keywords, setKeywords] = useState<GeneratedKeyword[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<GeneratedKeyword[]>([]);
  const [clusters, setClusters] = useState<KeywordCluster[]>([]);
  const [stats, setStats] = useState<FactoryStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [intentFilter, setIntentFilter] = useState<string>('all');
  const [matchFilter, setMatchFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'clusters'>('list');

  // Selection for export
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

  // Options
  const [options, setOptions] = useState({
    generateVariations: true,
    generateSynonyms: true,
    suggestMatchTypes: true,
    includeNegatives: true,
    // NEW: Enrichment options
    enrichWithMetrics: false,
    metricsProviders: ['google_ads'] as ('google_ads' | 'moz' | 'dataforseo')[],
    maxKeywordsToEnrich: 50,
    minSearchVolume: 0,
    sortByMetrics: true,
    // NEW: Location targeting (GPT recommended)
    targetLocation: 'US', // Default to US, will use account location if available
  });

  // NEW: Enrichment UI states
  const [expandedSection, setExpandedSection] = useState<'enrichment' | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // SERP Intelligence tracking modals
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [trackingKeywordCount, setTrackingKeywordCount] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedKeywordForDetail, setSelectedKeywordForDetail] = useState<GeneratedKeyword | null>(null);

  // Campaigns for bulk actions
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const isAuthenticated = status === 'authenticated' && session?.user;

  // Check if user has seen enrichment onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('keyword-factory-enrichment-onboarding');
    if (!hasSeenOnboarding && isAuthenticated) {
      // Show immediately on first visit (no delay)
      setShowOnboardingModal(true);
    }
  }, [isAuthenticated]);

  // Keyboard shortcut: Cmd/Ctrl + E = Toggle enrichment section
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + E = Toggle enrichment expansion
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setExpandedSection(expandedSection === 'enrichment' ? null : 'enrichment');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [expandedSection]);

  // Fetch campaigns for bulk actions
  useEffect(() => {
    async function fetchCampaigns() {
      if (!session?.customerId) return;

      setLoadingCampaigns(true);
      try {
        const response = await fetch(`/api/google-ads/campaigns?customerId=${session.customerId}`);
        const data = await response.json();

        if (data.campaigns) {
          setCampaigns(data.campaigns);
        }
      } catch (error) {
        console.error('Failed to fetch campaigns:', error);
      } finally {
        setLoadingCampaigns(false);
      }
    }

    if (isAuthenticated) {
      fetchCampaigns();
    }
  }, [isAuthenticated, session?.customerId]);

  async function handleGenerate() {
    const seeds = seedInput
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (seeds.length === 0) return;

    setGenerating(true);
    setError(null);
    setWarnings([]);

    try {
      const res = await fetch('/api/keywords/factory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedKeywords: seeds, options }),
      });

      const data = await res.json();

      if (data.error && !data.keywords?.length) {
        setError(data.error);
      } else {
        setKeywords(data.keywords || []);
        setNegativeKeywords(data.negativeKeywords || []);
        setClusters(data.clusters || []);
        setStats(data.stats);
        setWarnings(data.warnings || []);
        setSelectedKeywords(new Set());
      }
    } catch (err) {
      setError('Failed to generate keywords. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function handleEnableEnrichment() {
    setOptions({ ...options, enrichWithMetrics: true });
    setShowOnboardingModal(false);
    // Only persist if user checked "don't show again"
    if (dontShowAgain) {
      localStorage.setItem('keyword-factory-enrichment-onboarding', 'true');
    }
  }

  function dismissOnboarding() {
    setShowOnboardingModal(false);
    // Only persist if user checked "don't show again"
    if (dontShowAgain) {
      localStorage.setItem('keyword-factory-enrichment-onboarding', 'true');
    }
  }

  function toggleKeyword(keyword: string) {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(keyword)) {
      newSelected.delete(keyword);
    } else {
      newSelected.add(keyword);
    }
    setSelectedKeywords(newSelected);
  }

  function selectAll() {
    setSelectedKeywords(new Set(filteredKeywords.map(k => k.keyword)));
  }

  function clearSelection() {
    setSelectedKeywords(new Set());
  }

  function copyToClipboard() {
    const text = Array.from(selectedKeywords).join('\n');
    navigator.clipboard.writeText(text);
  }

  function exportCSV() {
    const selected = keywords.filter(k => selectedKeywords.has(k.keyword));

    // Enhanced CSV with metrics
    const headers = ['Keyword', 'Type', 'Match Type', 'Intent'];
    if (options.enrichWithMetrics) {
      headers.push('Volume', 'CPC', 'Competition', 'Opportunity Score');
    }

    const csv = [
      headers.join(','),
      ...selected.map(k => {
        const row = [
          `"${k.keyword}"`,
          k.type,
          k.suggestedMatchType,
          k.estimatedIntent,
        ];

        if (options.enrichWithMetrics) {
          row.push(
            k.metrics?.searchVolume?.toString() || '0',
            k.metrics?.cpc?.toFixed(2) || '0.00',
            k.metrics?.competition || 'UNKNOWN',
            k.opportunityScore?.toString() || '0'
          );
        }

        return row.join(',');
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  async function handleAddToCampaign(campaignId: string) {
    const selected = keywords.filter(k => selectedKeywords.has(k.keyword));

    try {
      // TODO: Implement actual API call to add keywords to campaign
      const response = await fetch('/api/google-ads/add-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          keywords: selected.map(k => ({
            keyword: k.keyword,
            matchType: k.suggestedMatchType,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add keywords to campaign');
      }

      alert(`Successfully added ${selected.length} keywords to campaign`);
      setSelectedKeywords(new Set());
    } catch (error) {
      console.error('Error adding keywords:', error);
      alert('Failed to add keywords to campaign. Feature coming soon!');
    }
  }

  async function handleCreateCampaign() {
    const selected = keywords.filter(k => selectedKeywords.has(k.keyword));

    try {
      // TODO: Implement actual campaign creation flow
      const campaignName = prompt(`Create campaign with ${selected.length} keywords. Enter campaign name:`);

      if (!campaignName) {
        return; // User cancelled
      }

      const response = await fetch('/api/google-ads/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          keywords: selected.map(k => ({
            keyword: k.keyword,
            matchType: k.suggestedMatchType,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      alert(`Successfully created campaign "${campaignName}" with ${selected.length} keywords`);
      setSelectedKeywords(new Set());
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign. Feature coming soon!');
    }
  }

  async function handleTrackInSERP() {
    const selected = keywords.filter(k => selectedKeywords.has(k.keyword));

    if (selected.length === 0) {
      return;
    }

    // Max 100 keywords per request
    if (selected.length > 100) {
      setError('Maximum 100 keywords can be tracked at once. Please select fewer keywords.');
      return;
    }

    // Get customerId from localStorage
    const savedCustomerId = localStorage.getItem('quickads_customerId');
    if (!savedCustomerId || savedCustomerId === 'demo') {
      setError('Please connect a Google Ads account first.');
      return;
    }

    // Show modal
    setTrackingKeywordCount(selected.length);
    setShowTrackModal(true);
  }

  async function confirmTrackInSERP(targetDomain: string) {
    const selected = keywords.filter(k => selectedKeywords.has(k.keyword));
    const savedCustomerId = localStorage.getItem('quickads_customerId');

    const response = await fetch('/api/serp-intelligence/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: savedCustomerId,
        keywords: selected.map(k => k.keyword),
        targetDomain,
        locationCode: options.targetLocation,
        device: 'desktop',
        language: 'en',
        projectName: 'Keyword Factory',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to track keywords');
    }

    // Clear selection and show success modal
    setSelectedKeywords(new Set());
    setShowSuccessModal(true);
  }

  function handleViewDashboard() {
    window.location.href = '/serp-intelligence';
  }

  // Filter keywords
  const filteredKeywords = keywords.filter(k => {
    if (typeFilter !== 'all' && k.type !== typeFilter) return false;
    if (intentFilter !== 'all' && k.estimatedIntent !== intentFilter) return false;
    if (matchFilter !== 'all' && k.suggestedMatchType !== matchFilter) return false;
    return true;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text mb-2">Google Ads Keyword Generator</h1>
          <p className="text-text2 mb-6">Sign in to generate Google Ads keywords with real search volume and CPC data</p>
          <Link href="/login" className="btn-primary">Sign In with Google</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-divider sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-text2 hover:text-text transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold text-text">Google Ads Keyword Generator</h1>
                    {/* Show active location when enrichment enabled */}
                    {options.enrichWithMetrics && (
                      <span className="px-3 py-1 text-sm font-normal bg-surface2 rounded-full flex items-center gap-1">
                        <span>
                          {TARGET_LOCATIONS.find(l => l.code === options.targetLocation)?.name.split(' ')[0]}
                        </span>
                        <span className="text-text3">
                          {TARGET_LOCATIONS.find(l => l.code === options.targetLocation)?.name.split(' ').slice(1).join(' ')}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text3">Generate keyword variations, synonyms, match types, and negative keywords for PPC campaigns</p>
                </div>
              </div>
            </div>

            {/* Export Actions */}
            {selectedKeywords.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text2">{selectedKeywords.size} selected</span>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 text-sm bg-surface2 rounded-lg hover:bg-surface3 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
                <button
                  onClick={exportCSV}
                  className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Input */}
          <div className="lg:col-span-1 space-y-4">
            {/* Seed Keywords Card */}
            <div className="card p-6">
              <h2 className="font-semibold text-text mb-4">Seed Keywords</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="seed-keywords" className="sr-only">Seed Keywords</label>
                  <textarea
                    id="seed-keywords"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    placeholder="Enter seed keywords for your Google Ads campaign&#10;e.g., running shoes&#10;athletic footwear&#10;sports sneakers"
                    rows={5}
                    className="w-full px-4 py-3 bg-surface2 rounded-xl text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    aria-label="Enter seed keywords for your Google Ads campaign"
                  />
                  <p className="text-xs text-text3 mt-1">Separate with commas or new lines (max 20)</p>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-text">Options</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.generateVariations}
                      onChange={(e) => setOptions({ ...options, generateVariations: e.target.checked })}
                      className="w-4 h-4 rounded"
                      aria-label="Generate keyword variations and match types"
                    />
                    <span className="text-sm text-text2">Generate keyword variations & match types</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.generateSynonyms}
                      onChange={(e) => setOptions({ ...options, generateSynonyms: e.target.checked })}
                      className="w-4 h-4 rounded"
                      aria-label="Generate semantic keyword synonyms"
                    />
                    <span className="text-sm text-text2">Generate semantic keyword synonyms</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeNegatives}
                      onChange={(e) => setOptions({ ...options, includeNegatives: e.target.checked })}
                      className="w-4 h-4 rounded"
                      aria-label="Suggest negative keywords for Google Ads"
                    />
                    <span className="text-sm text-text2">Suggest negative keywords for Google Ads</span>
                  </label>
                </div>

                {/* Collapsible Enrichment Section */}
                <div className="pt-4 border-t border-divider">
                  <button
                    onClick={() => setExpandedSection(
                      expandedSection === 'enrichment' ? null : 'enrichment'
                    )}
                    className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 sm:gap-0 bg-surface2 rounded-lg hover:bg-surface3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text">
                            Get Real Keyword Data
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded" aria-label="New feature">
                            NEW
                          </span>
                        </div>
                        <p className="text-xs text-text3">
                          Add search volume, CPC, competition, and keyword difficulty from Google Ads Keyword Planner
                        </p>
                      </div>
                    </div>
                    <svg className={`w-5 h-5 text-text3 transition-transform flex-shrink-0 ${expandedSection === 'enrichment' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expandedSection === 'enrichment' && (
                    <div className="mt-3 p-4 space-y-4 border-l-2 border-accent/30">
                      {/* Location Targeting - FIRST and PROMINENT */}
                      <div className="p-3 bg-accent/5 rounded-lg border border-accent/20">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">📍</span>
                          <label className="text-sm font-medium text-text">
                            Target Location
                          </label>
                          <div className="group relative">
                            <svg className="w-4 h-4 text-text3 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                              Metrics vary drastically by location. Example: "golden visa" has 10K/mo in US vs 500/mo in Portugal
                            </div>
                          </div>
                        </div>
                        <select
                          value={options.targetLocation}
                          onChange={(e) => setOptions({ ...options, targetLocation: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-divider focus:ring-2 focus:ring-accent focus:outline-none"
                        >
                          {TARGET_LOCATIONS.map(loc => (
                            <option key={loc.code} value={loc.code}>{loc.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Enable Toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text">
                          Enable Keyword Enrichment
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={options.enrichWithMetrics}
                            onChange={(e) => setOptions({ ...options, enrichWithMetrics: e.target.checked })}
                            className="sr-only peer"
                            aria-label="Enable keyword enrichment to get real search volume, CPC, and competition data"
                          />
                          <div className="w-11 h-6 bg-surface3 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                        </label>
                      </div>

                      {/* Rest of enrichment options (only when enabled) */}
                      {options.enrichWithMetrics && (
                        <div className="space-y-3 pt-3 border-t border-divider">
                          {/* Data Sources */}
                          <div>
                            <p className="text-xs font-medium text-text mb-2">Data Sources</p>
                            <div className="space-y-1.5">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={true}
                                  disabled
                                  className="w-3.5 h-3.5 rounded"
                                />
                                <span className="text-xs text-text">
                                  Google Ads <span className="text-success font-medium">✓ Free</span>
                                </span>
                              </label>
                            </div>

                            {/* Premium Metrics Teaser */}
                            <div className="mt-3 p-3 bg-gradient-to-r from-accent/10 to-purple-500/10 border border-accent/20 rounded-lg">
                              <div className="flex items-start gap-2">
                                <div className="text-lg">✨</div>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-text mb-1">Premium Metrics Coming Soon</p>
                                  <p className="text-xs text-text3 leading-relaxed">
                                    Keyword difficulty, SERP features, intent scoring, and competitor analysis with pay-per-use tokens
                                  </p>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-text3">
                                    <span className="opacity-60">🎯 Moz Difficulty</span>
                                    <span className="opacity-60">•</span>
                                    <span className="opacity-60">📊 SERP Analysis</span>
                                    <span className="opacity-60">•</span>
                                    <span className="opacity-60">🧠 AI Intent</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Max Keywords Slider */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-medium text-text">Max Keywords</label>
                              <span className="text-xs text-accent font-medium">{options.maxKeywordsToEnrich}</span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              step="10"
                              value={options.maxKeywordsToEnrich}
                              onChange={(e) => setOptions({ ...options, maxKeywordsToEnrich: parseInt(e.target.value) })}
                              className="w-full h-2 bg-surface3 rounded-lg appearance-none cursor-pointer accent-accent"
                            />
                            <p className="text-xs text-text3 mt-1">Limit enrichment to top keywords</p>
                          </div>

                          {/* Min Volume Filter */}
                          <div>
                            <label className="text-xs font-medium text-text block mb-1">Min Search Volume</label>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={options.minSearchVolume}
                              onChange={(e) => setOptions({ ...options, minSearchVolume: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-1.5 text-sm bg-surface2 rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
                              placeholder="e.g., 100"
                            />
                            <p className="text-xs text-text3 mt-1">Filter keywords below this volume</p>
                          </div>

                          {/* Sort Toggle */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={options.sortByMetrics}
                              onChange={(e) => setOptions({ ...options, sortByMetrics: e.target.checked })}
                              className="w-3.5 h-3.5 rounded"
                            />
                            <span className="text-xs text-text2">Sort by opportunity score</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generating || !seedInput.trim()}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate Google Ads Keywords
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Stats Card */}
            {stats && (
              <div className="card p-4">
                <h3 className="text-sm font-medium text-text mb-3">Generation Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface2 rounded-lg text-center">
                    <p className="text-2xl font-bold text-text">{stats.totalGenerated}</p>
                    <p className="text-xs text-text3">Total Keywords</p>
                  </div>
                  <div className="p-3 bg-surface2 rounded-lg text-center">
                    <p className="text-2xl font-bold text-text">{stats.clusters}</p>
                    <p className="text-xs text-text3">Clusters</p>
                  </div>
                  <div className="p-3 bg-success-light rounded-lg text-center">
                    <p className="text-2xl font-bold text-success">{stats.byIntent.transactional}</p>
                    <p className="text-xs text-text3">Transactional</p>
                  </div>
                  <div className="p-3 bg-warning-light rounded-lg text-center">
                    <p className="text-2xl font-bold text-warning">{stats.byIntent.commercial}</p>
                    <p className="text-xs text-text3">Commercial</p>
                  </div>
                </div>

                {/* NEW: Enrichment Stats */}
                {stats.enrichment && (
                  <div className="mt-4 pt-4 border-t border-divider">
                    <h4 className="text-xs font-medium text-text mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      Enrichment Stats
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text3">Enriched:</span>
                        <span className="font-medium text-text">{stats.enrichment.enriched} keywords</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text3">From cache:</span>
                        <span className="font-medium text-emerald-600">{stats.enrichment.cached}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text3">Google Ads:</span>
                        <span className="font-medium text-text">{stats.enrichment.googleFetched}</span>
                      </div>
                      {stats.enrichment.mozFetched > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text3">Moz:</span>
                          <span className="font-medium text-text">{stats.enrichment.mozFetched}</span>
                        </div>
                      )}
                      {stats.enrichment.dataForSeoFetched > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text3">DataForSEO:</span>
                          <span className="font-medium text-text">{stats.enrichment.dataForSeoFetched}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-divider">
                        <span className="text-text3">Est. Cost:</span>
                        <span className="font-semibold text-accent">${stats.enrichment.estimatedCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Negative Suggestions */}
            {negativeKeywords.length > 0 && (
              <div className="card p-4 border-danger/20 bg-danger-light/30">
                <h3 className="text-sm font-medium text-danger mb-3">Suggested Negatives</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {negativeKeywords.slice(0, 10).map((kw, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-text">{kw.keyword}</span>
                      <span className="text-xs text-text3 truncate max-w-[150px]" title={kw.negativeReason}>
                        {kw.negativeReason?.split(' - ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="card p-4 bg-accent-light border-accent/20">
              <h3 className="text-sm font-medium text-accent mb-2">Tips</h3>
              <ul className="text-xs text-text2 space-y-1">
                <li>Start with 3-5 broad seed keywords</li>
                <li>Enable enrichment for real search volume & CPC data</li>
                <li>Use transactional keywords for higher conversion</li>
                <li>Group by clusters for better ad groups</li>
                <li>Export CSV and import to Google Ads Editor</li>
              </ul>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2">
            {error && (
              <div className="card p-6 border-2 border-danger/20 bg-danger-light mb-4">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-danger">Error</h3>
                    <p className="text-sm text-text2">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {keywords.length === 0 && !generating && (
              <div className="card p-12 text-center">
                <div className="w-20 h-20 rounded-2xl bg-surface2 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-text mb-2">Enter Seed Keywords to Generate Google Ads Keywords</h2>
                <p className="text-text2 max-w-md mx-auto mb-4">
                  We'll generate keyword variations, synonyms, match types, and negative keyword suggestions for your Google Ads campaigns.
                </p>

                {/* Enrichment teaser */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-lg text-sm text-accent">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span>
                    Try enabling <strong>Get Real Keyword Data</strong> for real metrics!
                  </span>
                </div>
              </div>
            )}

            {generating && (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 rounded-full border-4 border-accent border-t-transparent animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-text mb-2">Generating Google Ads Keywords...</h2>
                <p className="text-text2">Creating keyword variations, synonyms, match types, and negative keyword suggestions</p>
              </div>
            )}

            {keywords.length > 0 && !generating && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="card p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text2">View:</span>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${viewMode === 'list' ? 'bg-accent text-white' : 'bg-surface2 text-text2 hover:bg-surface3'}`}
                      >
                        List
                      </button>
                      <button
                        onClick={() => setViewMode('clusters')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${viewMode === 'clusters' ? 'bg-accent text-white' : 'bg-surface2 text-text2 hover:bg-surface3'}`}
                      >
                        Clusters
                      </button>
                    </div>

                    <div className="h-6 w-px bg-divider" />

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text2">Type:</span>
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-2 py-1 text-sm bg-surface2 rounded-lg text-text"
                      >
                        <option value="all">All</option>
                        <option value="seed">Seed</option>
                        <option value="variation">Variation</option>
                        <option value="synonym">Synonym</option>
                        <option value="modifier">Modifier</option>
                        <option value="long_tail">Long Tail</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text2">Intent:</span>
                      <select
                        value={intentFilter}
                        onChange={(e) => setIntentFilter(e.target.value)}
                        className="px-2 py-1 text-sm bg-surface2 rounded-lg text-text"
                      >
                        <option value="all">All</option>
                        <option value="transactional">Transactional</option>
                        <option value="commercial">Commercial</option>
                        <option value="informational">Informational</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text2">Match:</span>
                      <select
                        value={matchFilter}
                        onChange={(e) => setMatchFilter(e.target.value)}
                        className="px-2 py-1 text-sm bg-surface2 rounded-lg text-text"
                      >
                        <option value="all">All</option>
                        <option value="EXACT">Exact</option>
                        <option value="PHRASE">Phrase</option>
                        <option value="BROAD">Broad</option>
                      </select>
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-2">
                      <button onClick={selectAll} className="text-sm text-accent hover:underline">
                        Select All
                      </button>
                      <button onClick={clearSelection} className="text-sm text-text3 hover:underline">
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bulk Action Bar */}
                <BulkActionBar
                  selectedKeywords={keywords.filter(k => selectedKeywords.has(k.keyword))}
                  campaigns={campaigns}
                  loadingCampaigns={loadingCampaigns}
                  onAddToCampaign={handleAddToCampaign}
                  onCreateCampaign={handleCreateCampaign}
                  onExport={exportCSV}
                  onTrackInSERP={handleTrackInSERP}
                  onClearSelection={clearSelection}
                />

                {/* List View */}
                {viewMode === 'list' && (
                  <>
                    <KeywordTable
                      keywords={filteredKeywords}
                      selectedKeywords={selectedKeywords}
                      onToggleKeyword={toggleKeyword}
                      onToggleAll={() => selectedKeywords.size === filteredKeywords.length ? clearSelection() : selectAll()}
                      onKeywordDetail={setSelectedKeywordForDetail}
                      showMetrics={options.enrichWithMetrics}
                      targetLocation={options.targetLocation}
                    />
                    {filteredKeywords.length > 100 && (
                      <div className="p-3 bg-surface2 text-center text-sm text-text2 rounded-b-lg">
                        Showing first 100 of {filteredKeywords.length} keywords
                      </div>
                    )}
                  </>
                )}

                {/* Clusters View */}
                {viewMode === 'clusters' && (
                  <div className="space-y-4">
                    {clusters.map((cluster, i) => (
                      <div key={i} className="card overflow-hidden">
                        <div className="p-4 bg-surface2 flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-text capitalize">{cluster.theme}</h3>
                            <p className="text-xs text-text3">{cluster.keywords.length} keywords</p>
                          </div>
                          <span className="px-3 py-1 bg-accent-light text-accent text-sm rounded-lg">
                            {cluster.suggestedAdGroup}
                          </span>
                        </div>
                        <div className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {cluster.keywords.slice(0, 15).map((kw, j) => (
                              <button
                                key={j}
                                onClick={() => toggleKeyword(kw.keyword)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                  selectedKeywords.has(kw.keyword)
                                    ? 'bg-accent text-white'
                                    : 'bg-surface2 text-text hover:bg-surface3'
                                }`}
                              >
                                {kw.keyword}
                              </button>
                            ))}
                            {cluster.keywords.length > 15 && (
                              <span className="px-3 py-1.5 text-sm text-text3">
                                +{cluster.keywords.length - 15} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Onboarding Modal */}
      {showOnboardingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl max-w-2xl w-full p-8 shadow-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-text mb-2">Supercharge Your Keywords with Real Data</h2>
                <p className="text-text2">Get actual search volume, CPC, and competition metrics from Google Ads, Moz, and DataForSEO</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-surface2 rounded-xl">
                <div className="text-2xl mb-2">🎯</div>
                <h3 className="font-semibold text-text mb-1">Real Metrics</h3>
                <p className="text-sm text-text3">Search volume, CPC, competition, and difficulty scores</p>
              </div>
              <div className="p-4 bg-surface2 rounded-xl">
                <div className="text-2xl mb-2">💾</div>
                <h3 className="font-semibold text-text mb-1">Smart Caching</h3>
                <p className="text-sm text-text3">60-80% cache hit rate saves API costs automatically</p>
              </div>
              <div className="p-4 bg-surface2 rounded-xl">
                <div className="text-2xl mb-2">🎁</div>
                <h3 className="font-semibold text-text mb-1">Free with Google</h3>
                <p className="text-sm text-text3">Google Ads Keyword Planner is free with active campaigns</p>
              </div>
            </div>

            <div className="bg-accent-light border border-accent/20 rounded-xl p-4 mb-6">
              <h4 className="font-semibold text-accent mb-2">Pricing Transparency</h4>
              <ul className="space-y-1 text-sm text-text2">
                <li>• <strong>Google Ads:</strong> Free (with active campaigns)</li>
                <li>• <strong>Moz:</strong> 1 credit per keyword (bring your own API key)</li>
                <li>• <strong>DataForSEO:</strong> ~$0.002 per keyword</li>
              </ul>
            </div>

            {/* Don't show again checkbox */}
            <div className="flex items-center gap-2 mt-4 p-3 bg-surface2 rounded-lg">
              <input
                type="checkbox"
                id="dont-show-again"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="dont-show-again" className="text-sm text-text2 cursor-pointer">
                Don't show this again
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleEnableEnrichment}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Enable Metrics Enrichment
              </button>
              <button
                onClick={dismissOnboarding}
                className="px-6 py-3 bg-surface3 text-text2 rounded-xl hover:bg-surface3/80 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warnings Display */}
      {warnings.length > 0 && (
        <div className="fixed bottom-6 right-6 max-w-md z-40">
          <div className="bg-warning-light border-2 border-warning/30 rounded-xl p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h4 className="font-semibold text-warning mb-2">Quota Warnings</h4>
                <ul className="space-y-1 text-sm text-text2">
                  {warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setWarnings([])}
                className="text-text3 hover:text-text transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyword Detail Modal */}
      <KeywordDetailModal
        keyword={selectedKeywordForDetail}
        onClose={() => setSelectedKeywordForDetail(null)}
      />

      {/* Track Rankings Modal */}
      <TrackRankingsModal
        isOpen={showTrackModal}
        keywordCount={trackingKeywordCount}
        onClose={() => setShowTrackModal(false)}
        onConfirm={confirmTrackInSERP}
      />

      {/* Track Success Modal */}
      <TrackSuccessModal
        isOpen={showSuccessModal}
        keywordCount={trackingKeywordCount}
        onClose={() => setShowSuccessModal(false)}
        onViewDashboard={handleViewDashboard}
      />
    </div>
  );
}
