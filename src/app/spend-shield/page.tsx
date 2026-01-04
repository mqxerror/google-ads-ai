'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface SearchTerm {
  searchTerm: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  matchType: string;
  isWaster: boolean;
}

interface WasteSummary {
  totalTerms: number;
  totalCost: number;
  wasterCount: number;
  wasterCost: number;
  potentialSavings: number;
}

interface NegativeSuggestion {
  searchTerm: string;
  reason: string;
  category: string;
  confidence: number;
  cost: number;
  potentialSavings: number;
  similarTo?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  // KPI metrics
  clicks?: number;
  impressions?: number;
  ctr?: number;
  cpc?: number;
  conversions?: number;
  conversionRate?: number;
  // Traceability fields
  analysisMethod?: 'rule' | 'embedding' | 'claude' | 'deepseek' | 'moz';
  analysisCost?: number;
}

interface AnalysisCosts {
  rules: number;
  embeddings: number;
  ai: number;
  total: number;
  breakdown: { method: string; count: number; cost: number }[];
}

interface AISummary {
  analyzed: number;
  wastersFound: number;
  suggestionsCount: number;
  potentialSavings: number;
  byCategory: Record<string, { count: number; savings: number }>;
}

interface ExistingNegativeList {
  id: string;
  name: string;
  keywordCount: number;
}

interface Campaign {
  id: string;
  name: string;
}

interface AddModalState {
  isOpen: boolean;
  level: 'account' | 'campaign' | 'adgroup';
  newListName: string;
  existingListId: string;
  campaignId: string;
  adGroupId: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
}

type TabType = 'overview' | 'explorer' | 'ai-analysis' | 'lists';

const CATEGORY_LABELS: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  free: { label: 'Free Seekers', color: 'text-red-600', bgColor: 'bg-red-50', icon: '🆓' },
  jobs: { label: 'Job Seekers', color: 'text-orange-600', bgColor: 'bg-orange-50', icon: '💼' },
  diy: { label: 'DIY/How-To', color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: '🔧' },
  cheap: { label: 'Bargain Hunters', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: '💰' },
  informational: { label: 'Research Only', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: '📚' },
  competitors: { label: 'Competitors', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: '🏢' },
  low_intent: { label: 'Low Intent', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: '⚠️' },
  expensive_waster: { label: 'Expensive Waster', color: 'text-red-700', bgColor: 'bg-red-100', icon: '🔥' },
  // New categories
  reviews: { label: 'Reviews/Complaints', color: 'text-pink-600', bgColor: 'bg-pink-50', icon: '⭐' },
  support: { label: 'Support Seekers', color: 'text-teal-600', bgColor: 'bg-teal-50', icon: '🎧' },
  login: { label: 'Login/Account', color: 'text-indigo-600', bgColor: 'bg-indigo-50', icon: '🔑' },
  refund: { label: 'Refund/Return', color: 'text-rose-600', bgColor: 'bg-rose-50', icon: '💸' },
  legal: { label: 'Legal Intent', color: 'text-slate-600', bgColor: 'bg-slate-50', icon: '⚖️' },
  education: { label: 'Education', color: 'text-cyan-600', bgColor: 'bg-cyan-50', icon: '🎓' },
  location: { label: 'Location-Based', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: '📍' },
  wholesale: { label: 'Wholesale/B2B', color: 'text-violet-600', bgColor: 'bg-violet-50', icon: '📦' },
};

const METHOD_LABELS: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  rule: { label: 'Rule', color: 'text-green-700', bgColor: 'bg-green-100', icon: '📏' },
  embedding: { label: 'AI Embed', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: '🧬' },
  claude: { label: 'Claude', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: '🤖' },
  deepseek: { label: 'DeepSeek', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: '🚀' },
  moz: { label: 'Moz', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: '🔗' },
};

// Pre-built negative keyword lists
const PREBUILT_LISTS = [
  {
    id: 'free-seekers',
    name: 'Free Seekers',
    description: 'Block users looking for free alternatives',
    icon: '🆓',
    keywords: ['free', 'gratis', 'no cost', 'complimentary', 'freebie', 'giveaway', 'free trial', 'free download', 'free version'],
    color: 'bg-red-50 border-red-200',
  },
  {
    id: 'job-seekers',
    name: 'Job Seekers',
    description: 'Block employment-related searches',
    icon: '💼',
    keywords: ['jobs', 'careers', 'hiring', 'employment', 'salary', 'resume', 'cv', 'job opening', 'work from home jobs', 'remote jobs'],
    color: 'bg-orange-50 border-orange-200',
  },
  {
    id: 'diy-tutorials',
    name: 'DIY & Tutorials',
    description: 'Block how-to and self-help searches',
    icon: '🔧',
    keywords: ['diy', 'how to', 'tutorial', 'guide', 'instructions', 'make your own', 'homemade', 'self made', 'step by step'],
    color: 'bg-yellow-50 border-yellow-200',
  },
  {
    id: 'bargain-hunters',
    name: 'Bargain Hunters',
    description: 'Block discount-seeking searches',
    icon: '💰',
    keywords: ['cheap', 'cheapest', 'budget', 'discount', 'clearance', 'sale', 'bargain', 'coupon', 'promo code', 'deal'],
    color: 'bg-purple-50 border-purple-200',
  },
  {
    id: 'informational',
    name: 'Research Only',
    description: 'Block informational queries',
    icon: '📚',
    keywords: ['what is', 'define', 'meaning', 'definition', 'wiki', 'wikipedia', 'examples', 'vs', 'versus', 'compare'],
    color: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'competitors',
    name: 'Major Competitors',
    description: 'Block major marketplace searches',
    icon: '🏢',
    keywords: ['amazon', 'ebay', 'walmart', 'alibaba', 'craigslist', 'etsy', 'wish'],
    color: 'bg-gray-50 border-gray-200',
  },
];

export default function SpendShieldPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [customerId, setCustomerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [wasteSummary, setWasteSummary] = useState<WasteSummary | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<NegativeSuggestion[]>([]);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [analysisCosts, setAnalysisCosts] = useState<AnalysisCosts | null>(null);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [addingNegatives, setAddingNegatives] = useState(false);
  const [addResult, setAddResult] = useState<{ success: boolean; message: string } | null>(null);
  const [addedAsNegatives, setAddedAsNegatives] = useState<Map<string, { level: string; target: string; timestamp: number }>>(new Map());
  const [hideNegated, setHideNegated] = useState(false);
  const [existingLists, setExistingLists] = useState<ExistingNegativeList[]>([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [addModal, setAddModal] = useState<AddModalState>({
    isOpen: false,
    level: 'account',
    newListName: '',
    existingListId: '',
    campaignId: '',
    adGroupId: '',
    matchType: 'EXACT',
  });
  const [sortField, setSortField] = useState<keyof SearchTerm>('cost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchFilter, setSearchFilter] = useState('');
  const [showWastersOnly, setShowWastersOnly] = useState(false);
  const [dateRange, setDateRange] = useState<'7' | '30' | '60' | '90'>('30');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [useMoz, setUseMoz] = useState(false);
  const [mozMinCost, setMozMinCost] = useState(2);

  const isAuthenticated = status === 'authenticated' && session?.user;

  // Get unique campaigns for filter
  const uniqueCampaigns = Array.from(
    new Map(
      searchTerms
        .filter(t => t.campaignId && t.campaignName)
        .map(t => [t.campaignId, { id: t.campaignId, name: t.campaignName }])
    ).values()
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quickads_customerId');
      if (saved && saved !== 'demo') {
        setCustomerId(saved);
      }
    }
  }, []);

  useEffect(() => {
    if (customerId && customerId !== 'demo') {
      fetchData();
      fetchExistingLists();
    } else {
      setLoading(false);
    }
  }, [customerId, dateRange]);

  async function fetchExistingLists() {
    if (!customerId || customerId === 'demo') return;

    setLoadingLists(true);
    try {
      const res = await fetch(`/api/google-ads/negative-keywords?customerId=${customerId}`);
      const data = await res.json();
      if (data.lists) {
        setExistingLists(data.lists);
      }
      if (data.campaigns) {
        setAvailableCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error('Error fetching existing lists:', error);
    } finally {
      setLoadingLists(false);
    }
  }

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch search terms
      const searchRes = await fetch(`/api/google-ads/search-terms?customerId=${customerId}&days=${dateRange}`);
      const searchData = await searchRes.json();

      if (searchData.searchTerms) {
        setSearchTerms(searchData.searchTerms);
        setWasteSummary(searchData.summary);
      }

      // Fetch AI suggestions
      if (searchData.searchTerms && searchData.searchTerms.length > 0) {
        const suggestRes = await fetch('/api/keywords/negative-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchTerms: searchData.searchTerms,
            threshold: 0.75,
            useMoz,
            mozMinCost,
          }),
        });
        const suggestData = await suggestRes.json();
        setAiSuggestions(suggestData.suggestions || []);
        setAiSummary(suggestData.summary || null);
        setAnalysisCosts(suggestData.analysisCosts || null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleTermSelection(term: string) {
    const newSelected = new Set(selectedTerms);
    if (newSelected.has(term)) {
      newSelected.delete(term);
    } else {
      newSelected.add(term);
    }
    setSelectedTerms(newSelected);
  }

  function selectAllVisible() {
    const visible = getFilteredTerms();
    setSelectedTerms(new Set(visible.map(t => t.searchTerm)));
  }

  function clearSelection() {
    setSelectedTerms(new Set());
  }

  // Get source info from selected terms
  function getSelectedTermsContext() {
    const selectedData = [...searchTerms, ...aiSuggestions]
      .filter(t => selectedTerms.has(t.searchTerm))
      .map(t => ({
        searchTerm: t.searchTerm,
        campaignId: t.campaignId || '',
        campaignName: t.campaignName || '',
        adGroupId: t.adGroupId || '',
        adGroupName: t.adGroupName || '',
      }));

    // Group by campaign
    const byCampaign = new Map<string, { name: string; terms: number; adGroups: Map<string, { name: string; terms: number }> }>();
    for (const term of selectedData) {
      if (!term.campaignId) continue;
      if (!byCampaign.has(term.campaignId)) {
        byCampaign.set(term.campaignId, { name: term.campaignName, terms: 0, adGroups: new Map() });
      }
      const campaign = byCampaign.get(term.campaignId)!;
      campaign.terms++;
      if (term.adGroupId) {
        if (!campaign.adGroups.has(term.adGroupId)) {
          campaign.adGroups.set(term.adGroupId, { name: term.adGroupName, terms: 0 });
        }
        campaign.adGroups.get(term.adGroupId)!.terms++;
      }
    }

    return { selectedData, byCampaign };
  }

  function openAddModal() {
    if (selectedTerms.size === 0) return;

    const { byCampaign } = getSelectedTermsContext();

    // Smart defaults based on selection
    let defaultLevel: 'account' | 'campaign' | 'adgroup' = 'account';
    let defaultCampaignId = '';
    let defaultAdGroupId = '';

    // If all terms from same campaign, suggest campaign level
    if (byCampaign.size === 1) {
      const [campaignId, campaign] = [...byCampaign.entries()][0];
      defaultCampaignId = campaignId;
      defaultLevel = 'campaign';

      // If all from same ad group, suggest ad group level
      if (campaign.adGroups.size === 1) {
        const [adGroupId] = [...campaign.adGroups.keys()];
        defaultAdGroupId = adGroupId;
        defaultLevel = 'adgroup';
      }
    }

    setAddModal({
      isOpen: true,
      level: defaultLevel,
      newListName: `Quick Ads - Negatives ${new Date().toISOString().split('T')[0]}`,
      existingListId: '',
      campaignId: defaultCampaignId,
      adGroupId: defaultAdGroupId,
      matchType: 'EXACT',
    });
  }

  async function confirmAddNegatives() {
    if (selectedTerms.size === 0) return;

    setAddingNegatives(true);
    setAddResult(null);

    try {
      const body: any = {
        customerId,
        keywords: Array.from(selectedTerms),
        level: addModal.level,
        matchType: addModal.matchType,
      };

      // Add level-specific params
      if (addModal.level === 'account') {
        if (addModal.existingListId) {
          body.existingListId = addModal.existingListId;
        } else {
          body.listName = addModal.newListName;
        }
      } else if (addModal.level === 'campaign') {
        body.campaignId = addModal.campaignId;
      } else if (addModal.level === 'adgroup') {
        body.campaignId = addModal.campaignId;
        body.adGroupId = addModal.adGroupId;
      }

      const res = await fetch('/api/google-ads/negative-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      // Check both success flag AND that keywords were actually added
      if (data.success && (data.addedCount > 0 || data.linkedCampaigns)) {
        const levelLabel = addModal.level === 'account' ? 'shared list' :
                          addModal.level === 'campaign' ? 'campaign' : 'ad group';

        // Track which terms were added as negatives
        const targetName = addModal.level === 'account'
          ? (addModal.existingListId ? existingLists.find(l => l.id === addModal.existingListId)?.name : addModal.newListName)
          : addModal.level === 'campaign'
          ? availableCampaigns.find(c => c.id === addModal.campaignId)?.name || addModal.campaignId
          : `Ad Group ${addModal.adGroupId}`;

        const newAddedMap = new Map(addedAsNegatives);
        const addedTerms = Array.from(selectedTerms);
        for (const term of addedTerms) {
          newAddedMap.set(term, {
            level: addModal.level,
            target: targetName || levelLabel,
            timestamp: Date.now(),
          });
        }
        setAddedAsNegatives(newAddedMap);

        setAddResult({
          success: true,
          message: data.message || `Added ${data.addedCount} negative keywords to ${levelLabel}!`
        });
        setSelectedTerms(new Set());
        setAddModal(prev => ({ ...prev, isOpen: false }));
        // Refresh lists but keep table data to show visual feedback
        fetchExistingLists();
      } else {
        // Show error with helpful message
        const errorMsg = data.error || data.message || 'Failed to add negative keywords';
        setAddResult({
          success: false,
          message: errorMsg.includes('Unknown') || errorMsg.includes('rejected')
            ? `Failed to add keywords. Try using "Account List" instead - it's more reliable.`
            : errorMsg
        });
      }
    } catch (error) {
      setAddResult({ success: false, message: 'Failed to add negative keywords' });
    } finally {
      setAddingNegatives(false);
    }
  }

  async function applyPrebuiltList(listId: string) {
    const list = PREBUILT_LISTS.find(l => l.id === listId);
    if (!list) return;

    setAddingNegatives(true);
    setAddResult(null);

    try {
      const res = await fetch('/api/google-ads/negative-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          keywords: list.keywords,
          level: 'account',
          listName: list.name,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setAddResult({ success: true, message: `Applied "${list.name}" list with ${list.keywords.length} keywords!` });
      } else {
        setAddResult({ success: false, message: data.error || 'Failed to apply list' });
      }
    } catch (error) {
      setAddResult({ success: false, message: 'Failed to apply list' });
    } finally {
      setAddingNegatives(false);
    }
  }

  function getFilteredTerms(): SearchTerm[] {
    let filtered = [...searchTerms];

    // Filter by campaign
    if (campaignFilter !== 'all') {
      filtered = filtered.filter(t => t.campaignId === campaignFilter);
    }

    if (searchFilter) {
      filtered = filtered.filter(t =>
        t.searchTerm.toLowerCase().includes(searchFilter.toLowerCase()) ||
        t.campaignName.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }

    if (showWastersOnly) {
      filtered = filtered.filter(t => t.isWaster);
    }

    // Filter out already negated terms if option is enabled
    if (hideNegated) {
      filtered = filtered.filter(t => !addedAsNegatives.has(t.searchTerm));
    }

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return filtered;
  }

  // Get filtered AI suggestions based on campaign filter
  const filteredAiSuggestions = campaignFilter === 'all'
    ? aiSuggestions
    : aiSuggestions.filter(s => s.campaignId === campaignFilter);

  // Calculate filtered waste summary
  const filteredWasteSummary = campaignFilter === 'all'
    ? wasteSummary
    : {
        totalTerms: searchTerms.filter(t => t.campaignId === campaignFilter).length,
        totalCost: searchTerms.filter(t => t.campaignId === campaignFilter).reduce((sum, t) => sum + t.cost, 0),
        wasterCount: searchTerms.filter(t => t.campaignId === campaignFilter && t.isWaster).length,
        wasterCost: searchTerms.filter(t => t.campaignId === campaignFilter && t.isWaster).reduce((sum, t) => sum + t.cost, 0),
        potentialSavings: searchTerms.filter(t => t.campaignId === campaignFilter && t.isWaster).reduce((sum, t) => sum + t.cost, 0) * 0.8,
      };

  const filteredTerms = getFilteredTerms();
  const selectedSavings = searchTerms
    .filter(t => selectedTerms.has(t.searchTerm) && t.isWaster)
    .reduce((sum, t) => sum + t.cost, 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-indigo-400 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text mb-2">Spend Shield</h1>
          <p className="text-text2 mb-6">Sign in to protect your ad budget</p>
          <Link href="/login" className="btn-primary">
            Sign In with Google
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-divider sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-text2 hover:text-text transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-indigo-400 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-text">Spend Shield</h1>
                  <p className="text-xs text-text3">Eliminate wasted ad spend</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              {/* Campaign Filter */}
              {uniqueCampaigns.length > 0 && (
                <select
                  value={campaignFilter}
                  onChange={(e) => {
                    setCampaignFilter(e.target.value);
                    setSelectedTerms(new Set());
                  }}
                  className="bg-surface2 text-text text-sm rounded-lg px-3 py-2 border-none focus:outline-none focus:ring-2 focus:ring-accent max-w-[200px]"
                >
                  <option value="all">All Campaigns ({searchTerms.length})</option>
                  {uniqueCampaigns.map(campaign => {
                    const count = searchTerms.filter(t => t.campaignId === campaign.id).length;
                    return (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name.length > 25 ? campaign.name.slice(0, 25) + '...' : campaign.name} ({count})
                      </option>
                    );
                  })}
                </select>
              )}

              {/* Date Range Selector */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="bg-surface2 text-text text-sm rounded-lg px-3 py-2 border-none focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-surface2 text-text2 text-sm rounded-lg hover:bg-divider transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-1 mt-4">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'explorer', label: 'Search Terms', icon: '🔍' },
              { id: 'ai-analysis', label: 'AI Analysis', icon: '🤖' },
              { id: 'lists', label: 'Negative Lists', icon: '📋' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-white'
                    : 'text-text2 hover:bg-surface2'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Result Toast */}
      {addResult && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg ${
          addResult.success ? 'bg-success text-white' : 'bg-danger text-white'
        }`}>
          <div className="flex items-center gap-2">
            {addResult.success ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{addResult.message}</span>
            <button onClick={() => setAddResult(null)} className="ml-2 hover:opacity-70">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Add Negative Keywords Modal */}
      {addModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setAddModal(prev => ({ ...prev, isOpen: false }))}
          />
          <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-text">Add Negative Keywords</h2>
                    <p className="text-sm text-text2">{selectedTerms.size} keywords selected</p>
                  </div>
                </div>
                <button
                  onClick={() => setAddModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-2 hover:bg-surface2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-text2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Source Context Info */}
              {(() => {
                const { byCampaign } = getSelectedTermsContext();
                if (byCampaign.size === 0) return null;

                return (
                  <div className="p-3 bg-accent-light rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-accent">Source detected</span>
                    </div>
                    <div className="text-xs text-text2 space-y-1">
                      {[...byCampaign.entries()].slice(0, 3).map(([id, campaign]) => (
                        <div key={id} className="flex items-center gap-2">
                          <span className="font-medium">{campaign.name}</span>
                          <span className="text-text3">({campaign.terms} terms)</span>
                          {campaign.adGroups.size > 0 && (
                            <span className="text-text3">
                              → {[...campaign.adGroups.values()].map(ag => ag.name).slice(0, 2).join(', ')}
                              {campaign.adGroups.size > 2 && ` +${campaign.adGroups.size - 2}`}
                            </span>
                          )}
                        </div>
                      ))}
                      {byCampaign.size > 3 && (
                        <div className="text-text3">+{byCampaign.size - 3} more campaigns</div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Level Selection */}
              <div>
                <label className="block text-sm font-medium text-text mb-3">Add to:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'account', label: 'Account List', icon: '📋', desc: 'Recommended', recommended: true },
                    { value: 'campaign', label: 'Campaign', icon: '📁', desc: 'One campaign', recommended: false },
                    { value: 'adgroup', label: 'Ad Group', icon: '📂', desc: 'One ad group', recommended: false },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setAddModal(prev => ({ ...prev, level: option.value as any }))}
                      className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                        addModal.level === option.value
                          ? 'border-accent bg-accent-light'
                          : 'border-divider hover:border-accent/50'
                      }`}
                    >
                      {option.recommended && (
                        <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-success text-white text-[10px] font-bold rounded-full">
                          Best
                        </span>
                      )}
                      <span className="text-xl mb-1 block">{option.icon}</span>
                      <span className="text-sm font-medium text-text block">{option.label}</span>
                      <span className={`text-xs ${option.recommended ? 'text-success font-medium' : 'text-text3'}`}>
                        {option.desc}
                      </span>
                    </button>
                  ))}
                </div>
                {addModal.level !== 'account' && (
                  <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                    Tip: Shared Account Lists are recommended - they apply to all campaigns and are easier to manage.
                  </p>
                )}
              </div>

              {/* Account Level Options */}
              {addModal.level === 'account' && (
                <div className="space-y-4 p-4 bg-surface2 rounded-xl">
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">List Option:</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 bg-surface rounded-lg cursor-pointer hover:bg-divider transition-colors">
                        <input
                          type="radio"
                          name="listOption"
                          checked={!addModal.existingListId}
                          onChange={() => setAddModal(prev => ({ ...prev, existingListId: '' }))}
                          className="w-4 h-4 text-accent"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-text">Create New List</span>
                          <input
                            type="text"
                            value={addModal.newListName}
                            onChange={(e) => setAddModal(prev => ({ ...prev, newListName: e.target.value, existingListId: '' }))}
                            placeholder="List name..."
                            className="mt-2 w-full px-3 py-2 bg-surface2 rounded-lg text-sm text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                      </label>
                      {existingLists.length > 0 && (
                        <label className="flex items-start gap-3 p-3 bg-surface rounded-lg cursor-pointer hover:bg-divider transition-colors">
                          <input
                            type="radio"
                            name="listOption"
                            checked={!!addModal.existingListId}
                            onChange={() => setAddModal(prev => ({ ...prev, existingListId: existingLists[0]?.id || '' }))}
                            className="w-4 h-4 text-accent mt-1"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-text">Add to Existing List</span>
                            <select
                              value={addModal.existingListId}
                              onChange={(e) => setAddModal(prev => ({ ...prev, existingListId: e.target.value }))}
                              className="mt-2 w-full px-3 py-2 bg-surface2 rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="">Select a list...</option>
                              {existingLists.map(list => (
                                <option key={list.id} value={list.id}>
                                  {list.name} ({list.keywordCount} keywords)
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Campaign Level Options - Smart Selection */}
              {addModal.level === 'campaign' && (
                <div className="p-4 bg-surface2 rounded-xl">
                  <label className="block text-sm font-medium text-text mb-2">Select Campaign:</label>
                  {(() => {
                    const { byCampaign } = getSelectedTermsContext();
                    const sourceCampaigns = [...byCampaign.entries()];

                    // Show source campaigns first if any
                    if (sourceCampaigns.length > 0) {
                      return (
                        <div className="space-y-2">
                          {/* Source campaigns as quick picks */}
                          <div className="grid grid-cols-1 gap-2 mb-3">
                            {sourceCampaigns.map(([id, campaign]) => (
                              <button
                                key={id}
                                onClick={() => setAddModal(prev => ({ ...prev, campaignId: id }))}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                  addModal.campaignId === id
                                    ? 'border-accent bg-accent-light'
                                    : 'border-divider bg-surface hover:border-accent/50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-text text-sm">{campaign.name}</span>
                                  <span className="text-xs px-2 py-0.5 bg-success-light text-success rounded-full">
                                    {campaign.terms} terms from here
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                          {/* Or select other */}
                          <div className="pt-2 border-t border-divider">
                            <p className="text-xs text-text3 mb-2">Or select another campaign:</p>
                            <select
                              value={sourceCampaigns.some(([id]) => id === addModal.campaignId) ? '' : addModal.campaignId}
                              onChange={(e) => setAddModal(prev => ({ ...prev, campaignId: e.target.value }))}
                              className="w-full px-3 py-2 bg-surface rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="">Select a campaign...</option>
                              {availableCampaigns
                                .filter(c => !sourceCampaigns.some(([id]) => id === c.id))
                                .map(campaign => (
                                  <option key={campaign.id} value={campaign.id}>
                                    {campaign.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      );
                    }

                    // Fallback to regular dropdown
                    return (
                      <select
                        value={addModal.campaignId}
                        onChange={(e) => setAddModal(prev => ({ ...prev, campaignId: e.target.value }))}
                        className="w-full px-3 py-2 bg-surface rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">Select a campaign...</option>
                        {availableCampaigns.map(campaign => (
                          <option key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              )}

              {/* Ad Group Level Options - Smart Selection */}
              {addModal.level === 'adgroup' && (
                <div className="p-4 bg-surface2 rounded-xl space-y-4">
                  {(() => {
                    const { byCampaign } = getSelectedTermsContext();
                    const sourceCampaigns = [...byCampaign.entries()];
                    const selectedCampaign = sourceCampaigns.find(([id]) => id === addModal.campaignId);
                    const adGroups = selectedCampaign ? [...selectedCampaign[1].adGroups.entries()] : [];

                    return (
                      <>
                        {/* Campaign Selection */}
                        <div>
                          <label className="block text-sm font-medium text-text mb-2">Campaign:</label>
                          {sourceCampaigns.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                              {sourceCampaigns.map(([id, campaign]) => (
                                <button
                                  key={id}
                                  onClick={() => {
                                    const firstAdGroup = [...campaign.adGroups.keys()][0] || '';
                                    setAddModal(prev => ({ ...prev, campaignId: id, adGroupId: firstAdGroup }));
                                  }}
                                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                                    addModal.campaignId === id
                                      ? 'border-accent bg-accent-light'
                                      : 'border-divider bg-surface hover:border-accent/50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-text text-sm">{campaign.name}</span>
                                    <span className="text-xs text-text3">{campaign.adGroups.size} ad groups</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <select
                              value={addModal.campaignId}
                              onChange={(e) => setAddModal(prev => ({ ...prev, campaignId: e.target.value, adGroupId: '' }))}
                              className="w-full px-3 py-2 bg-surface rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="">Select a campaign...</option>
                              {availableCampaigns.map(campaign => (
                                <option key={campaign.id} value={campaign.id}>
                                  {campaign.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Ad Group Selection */}
                        {addModal.campaignId && (
                          <div>
                            <label className="block text-sm font-medium text-text mb-2">Ad Group:</label>
                            {adGroups.length > 0 ? (
                              <div className="grid grid-cols-1 gap-2">
                                {adGroups.map(([id, adGroup]) => (
                                  <button
                                    key={id}
                                    onClick={() => setAddModal(prev => ({ ...prev, adGroupId: id }))}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                                      addModal.adGroupId === id
                                        ? 'border-accent bg-accent-light'
                                        : 'border-divider bg-surface hover:border-accent/50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-text text-sm">{adGroup.name || `Ad Group ${id}`}</span>
                                      <span className="text-xs px-2 py-0.5 bg-success-light text-success rounded-full">
                                        {adGroup.terms} terms from here
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div>
                                <input
                                  type="text"
                                  value={addModal.adGroupId}
                                  onChange={(e) => setAddModal(prev => ({ ...prev, adGroupId: e.target.value }))}
                                  placeholder="Enter ad group ID..."
                                  className="w-full px-3 py-2 bg-surface rounded-lg text-sm text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                                <p className="mt-1 text-xs text-text3">Enter the ad group ID from Google Ads</p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Match Type Selection */}
              <div>
                <label className="block text-sm font-medium text-text mb-3">Match Type:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'EXACT', label: 'Exact', desc: '[keyword]' },
                    { value: 'PHRASE', label: 'Phrase', desc: '"keyword"' },
                    { value: 'BROAD', label: 'Broad', desc: 'keyword' },
                  ].map(match => (
                    <button
                      key={match.value}
                      onClick={() => setAddModal(prev => ({ ...prev, matchType: match.value as any }))}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        addModal.matchType === match.value
                          ? 'border-accent bg-accent-light'
                          : 'border-divider hover:border-accent/50'
                      }`}
                    >
                      <span className="text-sm font-medium text-text block">{match.label}</span>
                      <span className="text-xs text-text3 font-mono">{match.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">Preview ({selectedTerms.size} keywords):</label>
                <div className="max-h-32 overflow-y-auto p-3 bg-surface2 rounded-xl">
                  <div className="flex flex-wrap gap-1">
                    {Array.from(selectedTerms).slice(0, 20).map(term => (
                      <span key={term} className="px-2 py-1 bg-danger/10 text-danger text-xs rounded-lg font-mono">
                        {addModal.matchType === 'EXACT' ? `[${term}]` :
                         addModal.matchType === 'PHRASE' ? `"${term}"` : term}
                      </span>
                    ))}
                    {selectedTerms.size > 20 && (
                      <span className="px-2 py-1 bg-surface text-text3 text-xs rounded-lg">
                        +{selectedTerms.size - 20} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-divider flex items-center justify-between bg-surface2/50">
              <button
                onClick={() => setAddModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-text2 text-sm font-medium hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddNegatives}
                disabled={addingNegatives || (addModal.level === 'campaign' && !addModal.campaignId) || (addModal.level === 'adgroup' && (!addModal.campaignId || !addModal.adGroupId))}
                className="px-6 py-2 bg-danger text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {addingNegatives ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Add {selectedTerms.size} Negatives
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-text2">Analyzing your search terms...</p>
            </div>
          </div>
        ) : !customerId || customerId === 'demo' ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-surface2 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">No Account Selected</h2>
            <p className="text-text2 mb-4">Go to the dashboard and select a Google Ads account first.</p>
            <Link href="/" className="btn-primary">Go to Dashboard</Link>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Campaign Filter Indicator */}
                {campaignFilter !== 'all' && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-accent-light rounded-lg">
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span className="text-sm text-accent font-medium">
                      Filtered: {uniqueCampaigns.find(c => c.id === campaignFilter)?.name}
                    </span>
                    <button
                      onClick={() => setCampaignFilter('all')}
                      className="ml-auto text-accent hover:text-accent-hover"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="card p-6">
                    <p className="text-text3 text-sm mb-2">Total Search Terms</p>
                    <p className="text-3xl font-bold text-text">{filteredWasteSummary?.totalTerms || 0}</p>
                    <p className="text-xs text-text3 mt-1">Last {dateRange} days</p>
                  </div>
                  <div className="card p-6">
                    <p className="text-text3 text-sm mb-2">Total Spend</p>
                    <p className="text-3xl font-bold text-text">${(filteredWasteSummary?.totalCost || 0).toFixed(0)}</p>
                    <p className="text-xs text-text3 mt-1">From search terms</p>
                  </div>
                  <div className="card p-6 border-2 border-danger/20">
                    <p className="text-text3 text-sm mb-2">Wasted Spend</p>
                    <p className="text-3xl font-bold text-danger">${(filteredWasteSummary?.wasterCost || 0).toFixed(0)}</p>
                    <p className="text-xs text-text3 mt-1">{filteredWasteSummary?.wasterCount || 0} wasting terms</p>
                  </div>
                  <div className="card card-accent p-6">
                    <p className="text-white/70 text-sm mb-2">Potential Savings</p>
                    <p className="text-3xl font-bold text-white">${(filteredWasteSummary?.potentialSavings || 0).toFixed(0)}</p>
                    <p className="text-xs text-white/70 mt-1">If blocked today</p>
                  </div>
                </div>

                {/* Category Breakdown */}
                {aiSummary && aiSummary.byCategory && Object.keys(aiSummary.byCategory).length > 0 && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-text mb-4">Waste by Category</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(aiSummary.byCategory).map(([category, data]) => {
                        const info = CATEGORY_LABELS[category] || { label: category, color: 'text-gray-600', bgColor: 'bg-gray-50', icon: '❓' };
                        return (
                          <div key={category} className={`p-4 rounded-xl ${info.bgColor}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xl">{info.icon}</span>
                              <span className={`text-sm font-medium ${info.color}`}>{info.label}</span>
                            </div>
                            <p className="text-2xl font-bold text-text">{data.count}</p>
                            <p className="text-xs text-text2">${data.savings.toFixed(0)} potential savings</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Top Wasters */}
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-text">Top Wasters</h3>
                    <button
                      onClick={() => setActiveTab('explorer')}
                      className="text-sm text-accent hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(campaignFilter === 'all' ? searchTerms : searchTerms.filter(t => t.campaignId === campaignFilter))
                      .filter(t => t.isWaster)
                      .sort((a, b) => b.cost - a.cost)
                      .slice(0, 5)
                      .map((term, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-surface2 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-text">{term.searchTerm}</p>
                            <p className="text-xs text-text3">{term.campaignName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-danger">${term.cost.toFixed(2)}</p>
                            <p className="text-xs text-text3">{term.clicks} clicks, 0 conv</p>
                          </div>
                        </div>
                      ))}
                    {(campaignFilter === 'all' ? searchTerms : searchTerms.filter(t => t.campaignId === campaignFilter))
                      .filter(t => t.isWaster).length === 0 && (
                      <p className="text-center text-text3 py-4">No wasters found{campaignFilter !== 'all' ? ' in this campaign' : ''}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Search Terms Explorer Tab */}
            {activeTab === 'explorer' && (
              <div className="space-y-4">
                {/* Filters & Actions Bar */}
                <div className="card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="relative flex-1 max-w-md">
                        <svg className="w-4 h-4 text-text3 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search terms or campaigns..."
                          value={searchFilter}
                          onChange={(e) => setSearchFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-surface2 rounded-lg text-sm text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-text2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showWastersOnly}
                          onChange={(e) => setShowWastersOnly(e.target.checked)}
                          className="w-4 h-4 rounded border-divider text-accent focus:ring-accent"
                        />
                        Wasters only
                      </label>
                      {addedAsNegatives.size > 0 && (
                        <label className="flex items-center gap-2 text-sm text-success cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hideNegated}
                            onChange={(e) => setHideNegated(e.target.checked)}
                            className="w-4 h-4 rounded border-divider text-success focus:ring-success"
                          />
                          Hide negated ({addedAsNegatives.size})
                        </label>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Select All / Deselect All */}
                      <div className="flex items-center gap-1 border-r border-divider pr-3 mr-2">
                        <button
                          onClick={selectAllVisible}
                          className="text-sm text-accent hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-text3">|</span>
                        <button
                          onClick={clearSelection}
                          className="text-sm text-text2 hover:text-text"
                        >
                          Deselect All
                        </button>
                      </div>
                      <span className="text-sm text-text2">{selectedTerms.size} selected</span>
                      {selectedTerms.size > 0 && (
                        <>
                          <span className="text-sm text-success font-medium">(${selectedSavings.toFixed(0)} savings)</span>
                          <button
                            onClick={openAddModal}
                            disabled={addingNegatives}
                            className="px-4 py-2 bg-danger text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {addingNegatives ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            )}
                            Add as Negatives
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Data Table */}
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-surface2">
                        <tr>
                          <th className="w-10 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedTerms.size === filteredTerms.length && filteredTerms.length > 0}
                              onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
                              className="w-4 h-4 rounded border-divider text-accent focus:ring-accent"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text3 uppercase tracking-wider">Search Term</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text3 uppercase tracking-wider">Campaign / Ad Group</th>
                          <th
                            className="px-4 py-3 text-right text-xs font-medium text-text3 uppercase tracking-wider cursor-pointer hover:text-text"
                            onClick={() => { setSortField('cost'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}
                          >
                            Cost {sortField === 'cost' && (sortDir === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            className="px-4 py-3 text-right text-xs font-medium text-text3 uppercase tracking-wider cursor-pointer hover:text-text"
                            onClick={() => { setSortField('clicks'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}
                          >
                            Clicks {sortField === 'clicks' && (sortDir === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            className="px-4 py-3 text-right text-xs font-medium text-text3 uppercase tracking-wider cursor-pointer hover:text-text"
                            onClick={() => { setSortField('conversions'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}
                          >
                            Conv {sortField === 'conversions' && (sortDir === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-text3 uppercase tracking-wider">CPC</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-text3 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-divider">
                        {filteredTerms.slice(0, 100).map((term, i) => {
                          const negatedInfo = addedAsNegatives.get(term.searchTerm);
                          const isNegated = !!negatedInfo;

                          return (
                            <tr
                              key={i}
                              className={`hover:bg-surface2 transition-colors ${
                                isNegated ? 'bg-success/5' :
                                selectedTerms.has(term.searchTerm) ? 'bg-accent-light' : ''
                              }`}
                            >
                              <td className="px-4 py-3">
                                {isNegated ? (
                                  <div className="w-4 h-4 rounded bg-success flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={selectedTerms.has(term.searchTerm)}
                                    onChange={() => toggleTermSelection(term.searchTerm)}
                                    className="w-4 h-4 rounded border-divider text-accent focus:ring-accent"
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${isNegated ? 'text-text3 line-through' : 'text-text'}`}>
                                    {term.searchTerm}
                                  </span>
                                  {isNegated && (
                                    <span className="px-2 py-0.5 bg-success text-white text-xs font-medium rounded-full flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      </svg>
                                      Negated
                                    </span>
                                  )}
                                </div>
                                {isNegated && (
                                  <p className="text-xs text-success mt-0.5">
                                    Added to {negatedInfo.target}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className={`text-sm ${isNegated ? 'text-text3' : 'text-text'}`}>{term.campaignName}</p>
                                <p className="text-xs text-text3">{term.adGroupName}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-medium ${
                                  isNegated ? 'text-success line-through' :
                                  term.isWaster ? 'text-danger' : 'text-text'
                                }`}>
                                  ${term.cost.toFixed(2)}
                                </span>
                                {isNegated && (
                                  <p className="text-xs text-success">Saved!</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-text">{term.clicks}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={term.conversions > 0 ? 'text-success font-medium' : 'text-text3'}>
                                  {term.conversions}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-text2">${term.cpc.toFixed(2)}</td>
                              <td className="px-4 py-3 text-center">
                                {isNegated ? (
                                  <span className="px-2 py-1 bg-success text-white text-xs font-medium rounded-full">
                                    Blocked
                                  </span>
                                ) : term.isWaster ? (
                                  <span className="px-2 py-1 bg-danger-light text-danger text-xs font-medium rounded-full">
                                    Waster
                                  </span>
                                ) : term.conversions > 0 ? (
                                  <span className="px-2 py-1 bg-success-light text-success text-xs font-medium rounded-full">
                                    Converting
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-surface2 text-text3 text-xs font-medium rounded-full">
                                    Neutral
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredTerms.length > 100 && (
                    <div className="p-4 text-center text-text3 text-sm border-t border-divider">
                      Showing 100 of {filteredTerms.length} terms. Use filters to narrow down.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Analysis Tab */}
            {activeTab === 'ai-analysis' && (
              <div className="space-y-6">
                {/* Campaign Filter Indicator */}
                {campaignFilter !== 'all' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-accent-light rounded-lg">
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span className="text-sm text-accent font-medium">
                      Filtered: {uniqueCampaigns.find(c => c.id === campaignFilter)?.name}
                    </span>
                    <button
                      onClick={() => setCampaignFilter('all')}
                      className="ml-auto text-accent hover:text-accent-hover"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Moz Intent Validation Toggle */}
                <div className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <span className="text-lg">🔗</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-text">Moz Intent Validation</h3>
                        <p className="text-xs text-text3">Use Moz API to catch false positives (e.g., "free shipping" = transactional, not bad)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-text2">Min cost:</label>
                        <select
                          value={mozMinCost}
                          onChange={(e) => setMozMinCost(Number(e.target.value))}
                          disabled={!useMoz}
                          className="px-2 py-1 bg-surface2 rounded text-sm text-text disabled:opacity-50"
                        >
                          <option value="1">$1+</option>
                          <option value="2">$2+</option>
                          <option value="5">$5+</option>
                          <option value="10">$10+</option>
                        </select>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useMoz}
                          onChange={(e) => setUseMoz(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-surface2 peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                      </label>
                    </div>
                  </div>
                  {useMoz && (
                    <div className="mt-3 pt-3 border-t border-divider">
                      <p className="text-xs text-text2">
                        Moz will check high-cost suggestions and remove false positives.
                        Terms with commercial/transactional intent will be excluded from suggestions.
                      </p>
                      <button
                        onClick={fetchData}
                        disabled={loading}
                        className="mt-2 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover disabled:opacity-50"
                      >
                        {loading ? 'Analyzing...' : 'Re-analyze with Moz'}
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Summary */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="card p-6">
                    <p className="text-text3 text-sm mb-2">Analyzed</p>
                    <p className="text-3xl font-bold text-text">{filteredWasteSummary?.totalTerms || 0}</p>
                    <p className="text-xs text-text3 mt-1">search terms</p>
                  </div>
                  <div className="card p-6">
                    <p className="text-text3 text-sm mb-2">Patterns Found</p>
                    <p className="text-3xl font-bold text-accent">{filteredAiSuggestions.length}</p>
                    <p className="text-xs text-text3 mt-1">matches detected</p>
                  </div>
                  <div className="card p-6">
                    <p className="text-text3 text-sm mb-2">Wasters Identified</p>
                    <p className="text-3xl font-bold text-danger">{filteredWasteSummary?.wasterCount || 0}</p>
                    <p className="text-xs text-text3 mt-1">costing money</p>
                  </div>
                  <div className="card card-accent p-6">
                    <p className="text-white/70 text-sm mb-2">AI Savings Estimate</p>
                    <p className="text-3xl font-bold text-white">${filteredAiSuggestions.reduce((sum, s) => sum + s.potentialSavings, 0).toFixed(0)}</p>
                    <p className="text-xs text-white/70 mt-1">per month</p>
                  </div>
                </div>

                {/* Analysis Cost Breakdown */}
                {analysisCosts && (
                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-text">Analysis Cost Breakdown</h3>
                      <span className="text-lg font-bold text-accent">${analysisCosts.total.toFixed(4)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {analysisCosts.breakdown.map((item, i) => {
                        const methodKey = item.method.includes('Rules') ? 'rule'
                          : item.method.includes('Embed') ? 'embedding'
                          : item.method.includes('Moz') ? 'moz'
                          : 'rule';
                        const methodInfo = METHOD_LABELS[methodKey] || METHOD_LABELS.rule;
                        return (
                          <div key={i} className={`p-3 rounded-lg ${methodInfo.bgColor}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span>{methodInfo.icon}</span>
                              <span className={`text-sm font-medium ${methodInfo.color}`}>{item.method}</span>
                            </div>
                            <p className="text-lg font-bold text-text">{item.count} terms</p>
                            <p className="text-xs text-text2">${item.cost.toFixed(4)}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-text2 border-t border-divider pt-3">
                      <span>ROI: <span className="font-semibold text-success">
                        {analysisCosts.total > 0
                          ? `${Math.round(filteredAiSuggestions.reduce((sum, s) => sum + s.potentialSavings, 0) / analysisCosts.total)}x`
                          : '∞'
                        }
                      </span> return on analysis cost</span>
                      <span className="text-text3">|</span>
                      <span>Potential savings: <span className="font-semibold text-success">${filteredAiSuggestions.reduce((sum, s) => sum + s.potentialSavings, 0).toFixed(2)}</span></span>
                    </div>
                  </div>
                )}

                {/* AI Suggestions List */}
                <div className="card">
                  <div className="p-4 border-b border-divider flex items-center justify-between">
                    <h3 className="font-semibold text-text">AI-Detected Wasteful Terms ({filteredAiSuggestions.length})</h3>
                    {selectedTerms.size > 0 && (
                      <button
                        onClick={openAddModal}
                        disabled={addingNegatives}
                        className="px-4 py-2 bg-danger text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        Add {selectedTerms.size} as Negatives
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-divider">
                    {filteredAiSuggestions.map((suggestion, i) => {
                      const info = CATEGORY_LABELS[suggestion.category] || { label: suggestion.category, color: 'text-gray-600', bgColor: 'bg-gray-50', icon: '❓' };
                      return (
                        <div
                          key={i}
                          onClick={() => toggleTermSelection(suggestion.searchTerm)}
                          className={`p-4 cursor-pointer transition-colors ${
                            selectedTerms.has(suggestion.searchTerm) ? 'bg-accent-light' : 'hover:bg-surface2'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <input
                              type="checkbox"
                              checked={selectedTerms.has(suggestion.searchTerm)}
                              onChange={() => toggleTermSelection(suggestion.searchTerm)}
                              className="w-4 h-4 mt-1 rounded border-divider text-accent focus:ring-accent"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-text">{suggestion.searchTerm}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.bgColor} ${info.color}`}>
                                  {info.icon} {info.label}
                                </span>
                                {suggestion.analysisMethod && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    METHOD_LABELS[suggestion.analysisMethod]?.bgColor || 'bg-gray-100'
                                  } ${METHOD_LABELS[suggestion.analysisMethod]?.color || 'text-gray-700'}`}>
                                    {METHOD_LABELS[suggestion.analysisMethod]?.icon} {METHOD_LABELS[suggestion.analysisMethod]?.label || suggestion.analysisMethod}
                                  </span>
                                )}
                                <span className="text-xs text-text3">
                                  {Math.round(suggestion.confidence * 100)}% confidence
                                </span>
                              </div>
                              <p className="text-sm text-text2 mb-2">{suggestion.reason}</p>
                              {/* KPI Metrics Row */}
                              <div className="flex items-center gap-4 text-xs mb-2">
                                {suggestion.clicks !== undefined && (
                                  <span className="text-text2">
                                    <span className="text-text3">Clicks:</span> <span className="font-medium">{suggestion.clicks}</span>
                                  </span>
                                )}
                                {suggestion.impressions !== undefined && (
                                  <span className="text-text2">
                                    <span className="text-text3">Impr:</span> <span className="font-medium">{suggestion.impressions.toLocaleString()}</span>
                                  </span>
                                )}
                                {suggestion.ctr !== undefined && suggestion.ctr > 0 && (
                                  <span className="text-text2">
                                    <span className="text-text3">CTR:</span> <span className="font-medium">{suggestion.ctr.toFixed(2)}%</span>
                                  </span>
                                )}
                                {suggestion.cpc !== undefined && suggestion.cpc > 0 && (
                                  <span className="text-text2">
                                    <span className="text-text3">CPC:</span> <span className="font-medium">${suggestion.cpc.toFixed(2)}</span>
                                  </span>
                                )}
                                {suggestion.conversions !== undefined && (
                                  <span className={`${suggestion.conversions === 0 ? 'text-danger' : 'text-success'}`}>
                                    <span className="text-text3">Conv:</span> <span className="font-medium">{suggestion.conversions}</span>
                                  </span>
                                )}
                              </div>
                              {suggestion.campaignName && (
                                <p className="text-xs text-text3">
                                  📁 {suggestion.campaignName} {suggestion.adGroupName && `/ ${suggestion.adGroupName}`}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-danger">${suggestion.cost.toFixed(2)}</p>
                              <p className="text-xs text-success">Save ${suggestion.potentialSavings.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Negative Lists Tab */}
            {activeTab === 'lists' && (
              <div className="space-y-6">
                {/* Existing Google Ads Lists */}
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-text flex items-center gap-2">
                        <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Your Google Ads Lists
                      </h3>
                      <p className="text-text3 text-sm">Existing negative keyword lists in your account</p>
                    </div>
                    <button
                      onClick={fetchExistingLists}
                      disabled={loadingLists}
                      className="px-3 py-1.5 bg-surface2 text-text2 text-sm rounded-lg hover:bg-divider transition-colors disabled:opacity-50"
                    >
                      {loadingLists ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>

                  {loadingLists ? (
                    <div className="py-8 text-center">
                      <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-2" />
                      <p className="text-text3 text-sm">Loading your lists...</p>
                    </div>
                  ) : existingLists.length === 0 ? (
                    <div className="py-8 text-center bg-surface2 rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <p className="text-text2 font-medium mb-1">No negative lists yet</p>
                      <p className="text-text3 text-sm">Add negatives from Search Terms or apply a pre-built list below</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {existingLists.map(list => (
                        <div key={list.id} className="p-4 rounded-xl border border-divider bg-surface hover:border-accent/50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center">
                                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-medium text-text text-sm">{list.name}</h4>
                                <p className="text-xs text-text3">{list.keywordCount} keywords</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <span className="px-2 py-1 bg-success-light text-success text-xs font-medium rounded-full">
                              Active
                            </span>
                            <span className="text-xs text-text3">ID: {list.id}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pre-built Lists */}
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-text mb-2">Pre-built Negative Lists</h3>
                  <p className="text-text2 text-sm mb-6">One-click apply common negative keyword patterns to protect your budget.</p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {PREBUILT_LISTS.map(list => (
                      <div key={list.id} className={`p-4 rounded-xl border-2 ${list.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{list.icon}</span>
                          <h4 className="font-semibold text-text">{list.name}</h4>
                        </div>
                        <p className="text-sm text-text2 mb-3">{list.description}</p>
                        <p className="text-xs text-text3 mb-3">{list.keywords.length} keywords</p>
                        <div className="flex flex-wrap gap-1 mb-4">
                          {list.keywords.slice(0, 4).map(kw => (
                            <span key={kw} className="px-2 py-0.5 bg-white/50 rounded text-xs text-text2">{kw}</span>
                          ))}
                          {list.keywords.length > 4 && (
                            <span className="px-2 py-0.5 bg-white/50 rounded text-xs text-text3">+{list.keywords.length - 4} more</span>
                          )}
                        </div>
                        <button
                          onClick={() => applyPrebuiltList(list.id)}
                          disabled={addingNegatives}
                          className="w-full py-2 bg-text text-white text-sm font-medium rounded-lg hover:bg-text/90 transition-colors disabled:opacity-50"
                        >
                          Apply List
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
