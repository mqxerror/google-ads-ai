'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Campaign } from '@/types/campaign';
import WhatIfDrawer from '@/components/WhatIfDrawer';
import NegativeKeywordsPanel from '@/components/NegativeKeywordsPanel';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface DataFreshness {
  lastSyncedAt: string;
  timeAgo: string;
  isStale: boolean;
}

interface GoogleAdsAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode?: string;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState<'dashboard' | 'campaigns' | 'insights' | 'settings'>('dashboard');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showNegativeKeywords, setShowNegativeKeywords] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [dataFreshness, setDataFreshness] = useState<DataFreshness | null>(null);
  const [canSync, setCanSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string>('demo');
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ENABLED' | 'PAUSED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [scoreFilter, setScoreFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [hasSpendFilter, setHasSpendFilter] = useState(false);
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load filters from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    const savedCustomerId = localStorage.getItem('quickads_customerId');
    if (savedCustomerId) setCustomerId(savedCustomerId);
    setSearchQuery(localStorage.getItem('quickads_searchQuery') || '');
    setStatusFilter((localStorage.getItem('quickads_statusFilter') as 'ALL' | 'ENABLED' | 'PAUSED') || 'ALL');
    setTypeFilter(localStorage.getItem('quickads_typeFilter') || 'ALL');
    setScoreFilter((localStorage.getItem('quickads_scoreFilter') as 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW') || 'ALL');
    setHasSpendFilter(localStorage.getItem('quickads_hasSpendFilter') === 'true');
    setFiltersLoaded(true);
  }, []);

  // Persist filters to localStorage
  useEffect(() => {
    if (filtersLoaded) {
      localStorage.setItem('quickads_searchQuery', searchQuery);
      localStorage.setItem('quickads_statusFilter', statusFilter);
      localStorage.setItem('quickads_typeFilter', typeFilter);
      localStorage.setItem('quickads_scoreFilter', scoreFilter);
      localStorage.setItem('quickads_hasSpendFilter', hasSpendFilter.toString());
    }
  }, [searchQuery, statusFilter, typeFilter, scoreFilter, hasSpendFilter, filtersLoaded]);

  const isAuthenticated = status === 'authenticated' && session?.user;

  // Filter campaigns based on search and filters
  const filteredCampaigns = campaigns.filter(campaign => {
    // Search filter
    if (searchQuery && !campaign.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Status filter
    if (statusFilter !== 'ALL' && campaign.status !== statusFilter) {
      return false;
    }
    // Type filter
    if (typeFilter !== 'ALL' && campaign.type !== typeFilter) {
      return false;
    }
    // Score filter
    if (scoreFilter === 'HIGH' && campaign.aiScore < 70) return false;
    if (scoreFilter === 'MEDIUM' && (campaign.aiScore < 40 || campaign.aiScore >= 70)) return false;
    if (scoreFilter === 'LOW' && campaign.aiScore >= 40) return false;
    // Has spend filter
    if (hasSpendFilter && campaign.spend <= 0) return false;
    return true;
  });

  // Get unique campaign types for filter
  const campaignTypes = [...new Set(campaigns.map(c => c.type))];

  // Check if any filters are active
  const hasActiveFilters = statusFilter !== 'ALL' || typeFilter !== 'ALL' || scoreFilter !== 'ALL' || hasSpendFilter;

  // Persist customerId to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && customerId && customerId !== 'demo') {
      localStorage.setItem('quickads_customerId', customerId);
    }
  }, [customerId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAccounts();
    } else {
      fetchCampaigns('demo');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/google-ads/accounts');
      const data = await res.json();
      if (data.accounts && data.accounts.length > 0) {
        setAccounts(data.accounts);
        // Use saved customerId if it exists in the accounts list, otherwise use first account
        const savedCustomerId = localStorage.getItem('quickads_customerId');
        const accountExists = savedCustomerId && data.accounts.some((acc: GoogleAdsAccount) => acc.customerId === savedCustomerId);
        const targetCustomerId = accountExists ? savedCustomerId : data.accounts[0].customerId;
        setCustomerId(targetCustomerId);
        fetchCampaigns(targetCustomerId);
      } else {
        setAccounts([]);
        fetchCampaigns('demo');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setAccounts([]);
      fetchCampaigns('demo');
    }
  }

  function handleAccountSwitch(newCustomerId: string) {
    if (newCustomerId === customerId) return;
    setCustomerId(newCustomerId);
    setLoading(true);
    fetchCampaigns(newCustomerId);
  }

  async function fetchCampaigns(custId: string) {
    try {
      const res = await fetch(`/api/google-ads/campaigns?customerId=${custId}`);
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setIsDemo(data.isDemo ?? true);
      setDataFreshness(data.dataFreshness || null);
      setCanSync(data.canSync ?? false);
      if (!data.isDemo) setCustomerId(custId);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (syncing || !customerId || customerId === 'demo') {
      setSyncError('Please sign in with Google to sync your campaigns.');
      return;
    }
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, syncType: 'incremental' }),
      });
      const data = await res.json();
      if (data.rateLimited) {
        setSyncError('Rate limited. Try again later.');
      } else if (!data.success) {
        setSyncError(data.error || 'Sync failed');
      } else {
        await fetchCampaigns(customerId);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncError('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || streaming) return;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setStreaming(true);
    const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          campaigns: campaigns.map(c => ({ id: c.id, name: c.name, status: c.status, spend: c.spend, conversions: c.conversions, ctr: c.ctr, cpa: c.cpa })),
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + parsed.content };
                  return updated;
                });
              }
            } catch { /* Skip */ }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setStreaming(false);
    }
  }

  async function toggleCampaignStatus(campaign: Campaign) {
    const newStatus = campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED';
    setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));
    try {
      await fetch('/api/google-ads/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: 'demo', campaignId: campaign.id, status: newStatus }),
      });
    } catch (error) {
      console.error('Error updating campaign:', error);
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: campaign.status } : c));
    }
  }

  function handleScoreClick(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setShowWhatIf(true);
  }

  // Calculate stats
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'ENABLED').length;
  const avgScore = Math.round(campaigns.reduce((sum, c) => sum + c.aiScore, 0) / Math.max(campaigns.length, 1));
  const wasters = campaigns.filter(c => c.aiScore < 40 && c.status === 'ENABLED');
  const potentialSavings = wasters.reduce((sum, c) => sum + c.spend, 0) * 0.3;
  const winners = campaigns.filter(c => c.aiScore >= 70 && c.status === 'ENABLED');

  // Mock monthly data for chart
  const monthlyData = [
    { month: 'Jul', spend: 8200, change: 12 },
    { month: 'Aug', spend: 9100, change: 18 },
    { month: 'Sep', spend: 7800, change: -8 },
    { month: 'Oct', spend: 11200, change: 24 },
    { month: 'Nov', spend: 10500, change: 15 },
    { month: 'Dec', spend: totalSpend, change: 8 },
  ];
  const maxSpend = Math.max(...monthlyData.map(d => d.spend));

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-divider">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-indigo-400 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-text">Quick Ads</span>
            </div>

            {/* Navigation Pills */}
            <nav className="flex items-center gap-1 bg-surface2 p-1 rounded-full">
              {(['dashboard', 'campaigns', 'insights', 'settings'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMode(tab)}
                  className={`nav-pill ${mode === tab ? 'nav-pill-active' : ''}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>

            {/* Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                onBlur={() => setTimeout(() => setShowToolsMenu(false), 150)}
                className="flex items-center gap-2 px-4 py-2 bg-surface2 text-text2 text-sm rounded-full hover:bg-divider transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Tools
                <svg className={`w-4 h-4 transition-transform ${showToolsMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showToolsMenu && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-surface rounded-xl shadow-lg border border-divider overflow-hidden z-50">
                  <Link
                    href="/spend-shield"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">Spend Shield</p>
                      <p className="text-xs text-text3">Eliminate wasted spend</p>
                    </div>
                  </Link>
                  <Link
                    href="/landing-analyzer"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">Landing Page Analyzer</p>
                      <p className="text-xs text-text3">Check speed & relevance</p>
                    </div>
                  </Link>
                  <Link
                    href="/campaigns/create"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors bg-accent/5 border-l-2 border-accent"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-accent">Create Campaign</p>
                      <p className="text-xs text-text3">AI-powered campaign wizard</p>
                    </div>
                  </Link>
                  <Link
                    href="/keyword-factory"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">Keyword Factory</p>
                      <p className="text-xs text-text3">Generate keyword ideas</p>
                    </div>
                  </Link>
                  <Link
                    href="/lists"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">Keyword Lists</p>
                      <p className="text-xs text-text3">Organize & cluster keywords</p>
                    </div>
                  </Link>
                  <Link
                    href="/serp-intelligence"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">SERP Intelligence</p>
                      <p className="text-xs text-text3">Track positions & PPC opportunities</p>
                    </div>
                  </Link>
                  <Link
                    href="/intelligence"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors bg-purple-500/5 border-l-2 border-purple-500"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-lg">
                      &#129504;
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-600">Intelligence Center</p>
                      <p className="text-xs text-text3">Brand & audience research</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {/* Account Switcher */}
              {accounts.length > 0 && (
                <select
                  value={customerId}
                  onChange={(e) => handleAccountSwitch(e.target.value)}
                  className="bg-surface2 text-text text-sm rounded-full px-4 py-2 border-none focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  {accounts.map((acc) => (
                    <option key={acc.customerId} value={acc.customerId}>
                      {acc.descriptiveName}
                    </option>
                  ))}
                </select>
              )}

              {/* Sync/Status */}
              {isDemo ? (
                <span className="px-3 py-1.5 bg-surface2 text-text3 text-sm rounded-full">Demo</span>
              ) : (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 bg-surface2 text-text2 text-sm rounded-full hover:bg-divider transition-colors disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
              )}

              {/* User */}
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
                    {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                  </div>
                  <button onClick={() => signOut()} className="text-sm text-text3 hover:text-text">
                    Sign Out
                  </button>
                </div>
              ) : (
                <a href="/login" className="btn-primary">Sign In</a>
              )}
            </div>
          </div>
        </div>
      </header>

      {syncError && (
        <div className="max-w-[1600px] mx-auto px-6 py-2">
          <div className="bg-danger-light text-danger text-sm px-4 py-2 rounded-lg">{syncError}</div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Left Content */}
          <div className="flex-1 space-y-6">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-4 gap-4">
              {/* Primary Card - Total Spend (with gradient like Finor's Income) */}
              <div className="card card-accent p-6 relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <button className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7m0 10H7" />
                    </svg>
                  </button>
                </div>
                <p className="text-white/70 text-sm mb-2">Total Spend</p>
                <div className="flex items-end gap-3">
                  <span className="stat-number text-white">${totalSpend.toLocaleString()}</span>
                  <span className="change-badge bg-white/20 text-white mb-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    12.3%
                  </span>
                </div>
              </div>

              {/* Conversions */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text3 text-sm">Conversions</p>
                  <button className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center hover:bg-divider transition-colors">
                    <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7m0 10H7" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-end gap-3">
                  <span className="stat-number">{totalConversions.toLocaleString()}</span>
                  <span className="change-badge change-badge-positive mb-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    8.4%
                  </span>
                </div>
              </div>

              {/* AI Score */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text3 text-sm">Avg AI Score</p>
                  <button className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center hover:bg-divider transition-colors">
                    <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7m0 10H7" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-end gap-3">
                  <span className={`stat-number ${avgScore >= 70 ? 'text-success' : avgScore >= 40 ? 'text-warning' : 'text-danger'}`}>
                    {avgScore}
                  </span>
                  <span className={`change-badge ${avgScore >= 50 ? 'change-badge-positive' : 'change-badge-negative'} mb-1`}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={avgScore >= 50 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                    </svg>
                    {avgScore >= 50 ? '+5' : '-3'} pts
                  </span>
                </div>
              </div>

              {/* Potential Savings */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text3 text-sm">Potential Savings</p>
                  <button className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center hover:bg-divider transition-colors">
                    <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7m0 10H7" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-end gap-3">
                  <span className="stat-number text-success">${potentialSavings.toFixed(0)}</span>
                  <span className="text-text3 text-sm mb-2">/month</span>
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-text">Monthly Spend</h3>
                  <p className="text-text3 text-sm">${totalSpend.toLocaleString()} total this period</p>
                </div>
                <select className="bg-surface2 text-text text-sm rounded-lg px-3 py-2 border-none focus:outline-none">
                  <option>Last 6 months</option>
                  <option>Last 12 months</option>
                  <option>This year</option>
                </select>
              </div>

              {/* Bar Chart */}
              <div className="flex items-end gap-4 h-48">
                {monthlyData.map((data, i) => (
                  <div key={data.month} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className={`text-xs font-medium ${data.change >= 0 ? 'text-success' : 'text-danger'}`}>
                      {data.change >= 0 ? '+' : ''}{data.change}%
                    </span>
                    <div className="w-full relative chart-bar animate-bar-grow" style={{ height: `${(data.spend / maxSpend) * 160}px`, animationDelay: `${i * 0.1}s` }}>
                      {/* Tooltip */}
                      <div className="tooltip -top-12 left-1/2 -translate-x-1/2">
                        ${data.spend.toLocaleString()} ({data.change >= 0 ? '+' : ''}{data.change}%)
                      </div>
                      <div
                        className={`absolute bottom-0 w-full rounded-t-lg ${
                          i === monthlyData.length - 1
                            ? 'bg-gradient-to-t from-accent to-indigo-400'
                            : 'bg-surface2 group-hover:bg-divider'
                        }`}
                        style={{ height: '100%' }}
                      />
                    </div>
                    <span className={`text-xs ${i === monthlyData.length - 1 ? 'font-semibold text-text' : 'text-text3'}`}>
                      {data.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Campaigns Table */}
            <div className="card">
              <div className="px-6 py-4 border-b border-divider flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-text">Campaigns</h3>
                  {(searchQuery || hasActiveFilters) && (
                    <span className="text-sm text-text3">
                      {filteredCampaigns.length} of {campaigns.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <svg className="w-4 h-4 text-text3 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-surface2 rounded-lg text-sm text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent w-48"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text3 hover:text-text"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        hasActiveFilters
                          ? 'bg-accent text-white'
                          : 'bg-surface2 text-text2 hover:bg-divider'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Filters
                      {hasActiveFilters && (
                        <span className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </button>
                    {showFiltersDropdown && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-surface rounded-xl shadow-lg border border-divider p-4 z-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-text text-sm">Filters</span>
                          {hasActiveFilters && (
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setStatusFilter('ALL');
                                setTypeFilter('ALL');
                                setScoreFilter('ALL');
                                setHasSpendFilter(false);
                              }}
                              className="text-xs text-accent hover:underline"
                            >
                              Clear all
                            </button>
                          )}
                        </div>

                        {/* Status Filter */}
                        <div className="mb-3">
                          <label className="text-xs text-text3 mb-1.5 block">Status</label>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                            className="w-full px-3 py-2 bg-surface2 rounded-lg text-sm text-text border-none focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="ALL">All statuses</option>
                            <option value="ENABLED">Enabled</option>
                            <option value="PAUSED">Paused</option>
                          </select>
                        </div>

                        {/* Type Filter */}
                        <div className="mb-3">
                          <label className="text-xs text-text3 mb-1.5 block">Campaign Type</label>
                          <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-surface2 rounded-lg text-sm text-text border-none focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="ALL">All types</option>
                            {campaignTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        {/* Score Filter */}
                        <div className="mb-3">
                          <label className="text-xs text-text3 mb-1.5 block">AI Score</label>
                          <select
                            value={scoreFilter}
                            onChange={(e) => setScoreFilter(e.target.value as typeof scoreFilter)}
                            className="w-full px-3 py-2 bg-surface2 rounded-lg text-sm text-text border-none focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="ALL">All scores</option>
                            <option value="HIGH">High (70+)</option>
                            <option value="MEDIUM">Medium (40-69)</option>
                            <option value="LOW">Low (&lt;40)</option>
                          </select>
                        </div>

                        {/* Has Spend Checkbox */}
                        <div className="mb-4 pt-3 border-t border-divider">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={hasSpendFilter}
                              onChange={(e) => setHasSpendFilter(e.target.checked)}
                              className="w-4 h-4 rounded border-divider text-accent focus:ring-accent"
                            />
                            <span className="text-sm text-text group-hover:text-accent transition-colors">
                              Only with spend
                            </span>
                          </label>
                          <p className="text-xs text-text3 mt-1 ml-6">
                            Hide campaigns with $0 spend
                          </p>
                        </div>

                        <button
                          onClick={() => setShowFiltersDropdown(false)}
                          className="w-full py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                        >
                          Apply Filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-text2">Loading campaigns...</div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-text2 mb-2">No campaigns found</p>
                  <p className="text-text3 text-sm">
                    {searchQuery || hasActiveFilters
                      ? 'Try adjusting your search or filters'
                      : 'Create your first campaign to get started'}
                  </p>
                  {(searchQuery || hasActiveFilters) && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('ALL');
                        setTypeFilter('ALL');
                        setScoreFilter('ALL');
                        setHasSpendFilter(false);
                      }}
                      className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-hover transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {filteredCampaigns.map(campaign => (
                    <div key={campaign.id} className="campaign-row px-6 py-4 flex items-center">
                      {/* Campaign Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`campaign-icon w-10 h-10 rounded-xl flex items-center justify-center transition-transform ${
                          campaign.aiScore >= 70 ? 'bg-success-light' : campaign.aiScore >= 40 ? 'bg-warning-light' : 'bg-danger-light'
                        }`}>
                          <svg className={`w-5 h-5 ${campaign.aiScore >= 70 ? 'text-success' : campaign.aiScore >= 40 ? 'text-warning' : 'text-danger'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-text">{campaign.name}</div>
                          <div className="text-xs text-text3 flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'ENABLED' ? 'bg-success' : 'bg-text3'}`} />
                            {campaign.type}
                          </div>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-8 text-sm">
                        <div className="text-right w-24">
                          <div className="font-medium text-text tabular-nums">${campaign.spend.toLocaleString()}</div>
                          <div className="text-xs text-text3">Spend</div>
                        </div>
                        <div className="text-right w-20">
                          <div className="font-medium text-text tabular-nums">{campaign.conversions}</div>
                          <div className="text-xs text-text3">Conv</div>
                        </div>
                        <div className="text-right w-20">
                          <div className="font-medium text-text tabular-nums">{campaign.ctr.toFixed(2)}%</div>
                          <div className="text-xs text-text3">CTR</div>
                        </div>

                        {/* AI Score Badge */}
                        <button
                          onClick={() => handleScoreClick(campaign)}
                          className={`w-12 h-8 rounded-lg text-sm font-semibold flex items-center justify-center transition-all hover:scale-105 ${
                            campaign.aiScore >= 70
                              ? 'bg-success-light text-success'
                              : campaign.aiScore >= 40
                              ? 'bg-warning-light text-warning'
                              : 'bg-danger-light text-danger'
                          }`}
                        >
                          {campaign.aiScore}
                        </button>

                        {/* Action Button */}
                        <button
                          onClick={() => toggleCampaignStatus(campaign)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            campaign.status === 'ENABLED'
                              ? 'bg-surface2 text-text2 hover:bg-divider'
                              : 'bg-accent text-white hover:bg-accent-hover'
                          }`}
                        >
                          {campaign.status === 'ENABLED' ? 'Pause' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-[340px] space-y-6">
            {/* AI Insights Card */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text">AI Insights</h3>
                <button className="text-sm text-accent hover:underline">View All</button>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3 mb-6">
                {wasters.length > 0 && (
                  <div className="insight-card p-4 bg-danger-light rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-danger/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text">Pause {wasters.length} Waster{wasters.length > 1 ? 's' : ''}</p>
                        <p className="text-xs text-text2">Save ~${Math.round(potentialSavings)}/mo</p>
                      </div>
                    </div>
                    <button
                      onClick={() => wasters.forEach(c => toggleCampaignStatus(c))}
                      className="w-full py-2 bg-danger text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors action-btn-pulse"
                    >
                      Pause All Wasters
                    </button>
                  </div>
                )}

                {winners.length > 0 && (
                  <div className="insight-card p-4 bg-success-light rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text">Boost {winners.length} Winner{winners.length > 1 ? 's' : ''}</p>
                        <p className="text-xs text-text2">Increase budget for more conversions</p>
                      </div>
                    </div>
                    <button className="w-full py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors">
                      View Winners
                    </button>
                  </div>
                )}

                {/* Spend Shield - Negative Keywords Tool */}
                <div className="insight-card p-4 bg-gradient-to-br from-accent-light to-indigo-100 rounded-xl border border-accent/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text">Spend Shield</p>
                      <p className="text-xs text-text2">Eliminate wasted ad spend</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href="/spend-shield"
                      className="flex-1 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Open Shield
                    </Link>
                    <button
                      onClick={() => setShowNegativeKeywords(true)}
                      className="px-3 py-2 bg-surface2 text-text2 text-sm rounded-lg hover:bg-divider transition-colors"
                      title="Quick Preview"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Landing Page Analyzer */}
                <Link
                  href="/landing-analyzer"
                  className="insight-card p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200/50 block hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text">Landing Page Analyzer</p>
                      <p className="text-xs text-text2">Check speed, relevance & CTAs</p>
                    </div>
                    <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>

                {/* Create Campaign - NEW! */}
                <Link
                  href="/campaigns/create"
                  className="insight-card p-4 bg-gradient-to-br from-accent to-purple-500 rounded-xl border border-accent/50 block hover:shadow-lg transition-all relative overflow-hidden group"
                >
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/20 rounded text-xs text-white font-medium">
                    NEW
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Create Campaign</p>
                      <p className="text-xs text-white/80">AI-powered 5-step wizard</p>
                    </div>
                    <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>

                {/* Keyword Factory */}
                <Link
                  href="/keyword-factory"
                  className="insight-card p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200/50 block hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text">Keyword Factory</p>
                      <p className="text-xs text-text2">Generate variations & match types</p>
                    </div>
                    <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>

                {/* Keyword Lists */}
                <Link
                  href="/lists"
                  className="insight-card p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200/50 block hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text">Keyword Lists</p>
                      <p className="text-xs text-text2">Organize, cluster & manage keywords</p>
                    </div>
                    <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </div>

              {/* Optimization Goals */}
              <div className="space-y-4">
                <p className="text-sm font-medium text-text">Optimization Progress</p>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-text2">AI Score Target</span>
                    <span className="font-medium text-text">{avgScore}/80</span>
                  </div>
                  <div className="progress-bar progress-bar-animated">
                    <div className="progress-bar-fill" style={{ width: `${(avgScore / 80) * 100}%`, animationDelay: '0.2s' }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-text2">Budget Efficiency</span>
                    <span className="font-medium text-text">${(totalSpend - potentialSavings).toFixed(0)}/${totalSpend.toFixed(0)}</span>
                  </div>
                  <div className="progress-bar progress-bar-animated">
                    <div className="progress-bar-fill bg-gradient-to-r from-success to-emerald-400" style={{ width: `${((totalSpend - potentialSavings) / totalSpend) * 100}%`, animationDelay: '0.4s' }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-text2">Campaign Health</span>
                    <span className="font-medium text-text">{activeCampaigns - wasters.length}/{activeCampaigns} healthy</span>
                  </div>
                  <div className="progress-bar progress-bar-animated">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${((activeCampaigns - wasters.length) / Math.max(activeCampaigns, 1)) * 100}%`,
                        background: wasters.length > 0 ? 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)' : undefined,
                        animationDelay: '0.6s'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Chat Card */}
            <div className="card flex flex-col" style={{ height: '400px' }}>
              <div className="p-4 border-b border-divider">
                <h3 className="font-semibold text-text">AI Assistant</h3>
                <p className="text-xs text-text3">Ask me anything about your campaigns</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-2">
                    {['Optimize my campaigns', 'What should I pause?', 'Show top performers'].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="w-full px-4 py-3 bg-surface2 rounded-xl text-sm text-text2 hover:bg-divider transition-colors text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                {messages.map(message => (
                  <div key={message.id} className={`${message.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
                      message.role === 'user' ? 'bg-accent text-white' : 'bg-surface2 text-text'
                    }`}>
                      {message.content || (streaming && message.role === 'assistant' ? '...' : '')}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t border-divider">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask AI to help..."
                    className="flex-1 px-4 py-2.5 bg-surface2 rounded-xl text-sm text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent"
                    disabled={streaming}
                  />
                  <button
                    onClick={handleSend}
                    disabled={streaming || !input.trim()}
                    className="px-4 py-2.5 bg-accent text-white rounded-xl font-medium transition-colors disabled:opacity-50 hover:bg-accent-hover"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* What-If Drawer */}
      {selectedCampaign && (
        <WhatIfDrawer
          campaign={selectedCampaign}
          isOpen={showWhatIf}
          onClose={() => { setShowWhatIf(false); setSelectedCampaign(null); }}
        />
      )}

      {/* Negative Keywords Panel */}
      <NegativeKeywordsPanel
        isOpen={showNegativeKeywords}
        onClose={() => setShowNegativeKeywords(false)}
        customerId={customerId}
      />
    </div>
  );
}
