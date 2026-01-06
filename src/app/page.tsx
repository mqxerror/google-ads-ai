'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Campaign } from '@/types/campaign';
import Link from 'next/link';
import WhatIfDrawer from '@/components/WhatIfDrawer';
import NegativeKeywordsPanel from '@/components/NegativeKeywordsPanel';
import { useCampaigns, useDashboardStats } from '@/hooks/useCampaigns';
import { useCampaignsStore } from '@/stores/campaigns-store';
import KPICards from '@/components/dashboard/KPICards';
import QuickActionsBar from '@/components/dashboard/QuickActionsBar';
import DrilldownContainer from '@/components/dashboard/DrilldownContainer';
import ActivityHistory from '@/components/dashboard/ActivityHistory';
import CommandPalette from '@/components/CommandPalette';

export default function Home() {
  const { data: session, status } = useSession();
  const { accounts, accountsLoading, isAuthenticated } = useCampaigns();

  // Local UI state
  const [mode, setMode] = useState<'dashboard' | 'campaigns' | 'insights' | 'settings'>('dashboard');
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showNegativeKeywords, setShowNegativeKeywords] = useState(false);

  // Store state
  const { customerId, setCustomerId, isDemo, syncing, fetchCampaigns, hydrateWasterThreshold } = useCampaignsStore();
  const { totalSpend } = useDashboardStats();

  // Hydrate localStorage values after mount to avoid SSR mismatch
  useEffect(() => {
    hydrateWasterThreshold();
  }, [hydrateWasterThreshold]);

  // Handle account switch
  const handleAccountSwitch = (newCustomerId: string) => {
    setCustomerId(newCustomerId);
    fetchCampaigns(newCustomerId, true);
  };

  // Handle sync
  const handleSync = () => {
    fetchCampaigns(customerId, true);
  };

  // Handle score click
  const handleScoreClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowWhatIf(true);
  };

  // Monthly chart data
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
      <header className="bg-surface border-b border-divider sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
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

            {/* Create Campaign Button */}
            <Link
              href="/campaigns/create"
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-full font-medium hover:bg-accent/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Campaign
            </Link>

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
                <div className="absolute top-full right-0 mt-2 w-64 bg-surface rounded-xl shadow-lg border border-divider overflow-hidden z-50">
                  <Link href="/command" className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors bg-blue-500/5 border-l-2 border-blue-500">
                    <span className="text-lg">🧠</span>
                    <div>
                      <p className="text-sm font-medium text-blue-600">Insight Hub</p>
                      <p className="text-xs text-text3">AI chat for all your data</p>
                    </div>
                  </Link>
                  <Link href="/spend-shield" className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors">
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
                  <Link href="/keyword-factory" className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors">
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
                  <Link href="/landing-analyzer" className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">Landing Analyzer</p>
                      <p className="text-xs text-text3">Check speed & relevance</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>

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

            {/* Status / Sync */}
            {isDemo ? (
              <span className="px-3 py-1.5 bg-surface2 text-text3 text-sm rounded-full">Demo</span>
            ) : (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface2 text-text2 text-sm rounded-full hover:bg-divider transition-colors disabled:opacity-50"
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
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
                  {session?.user?.name?.[0] || 'U'}
                </div>
                <button onClick={() => signOut()} className="text-sm text-text3 hover:text-text">
                  Sign Out
                </button>
              </div>
            ) : (
              <Link href="/login" className="text-sm text-accent hover:underline">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <KPICards />

        {/* Quick Actions Bar - Pause Wasters prominent! */}
        <QuickActionsBar onShowNegativeKeywords={() => setShowNegativeKeywords(true)} />

        {/* Monthly Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-text">Monthly Spend</h3>
              <p className="text-sm text-text3">${totalSpend.toLocaleString()} total this period</p>
            </div>
          </div>
          <div className="flex items-end gap-3 h-48">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className={`text-xs font-medium ${d.change >= 0 ? 'text-success' : 'text-danger'}`}>
                  {d.change >= 0 ? '+' : ''}{d.change}%
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all ${i === monthlyData.length - 1 ? 'bg-accent' : 'bg-surface2'}`}
                  style={{ height: `${(d.spend / maxSpend) * 100}%` }}
                />
                <span className="text-xs text-text3">{d.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign Table with inline editing + Activity History */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            <DrilldownContainer onScoreClick={handleScoreClick} />
          </div>
          <div className="xl:col-span-1">
            <ActivityHistory />
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

      {/* Command Palette - Cmd+K */}
      <CommandPalette />
    </div>
  );
}
