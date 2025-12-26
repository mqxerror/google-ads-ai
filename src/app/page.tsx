'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Campaign } from '@/types/campaign';
import WhatIfDrawer from '@/components/WhatIfDrawer';
import AIPlaybooks from '@/components/AIPlaybooks';
import ModeSwitcher, { modeThemes } from '@/components/ModeSwitcher';
import { InfoTooltip } from '@/components/Tooltip';

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
  const [mode, setMode] = useState<'monitor' | 'build'>('monitor');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [dataFreshness, setDataFreshness] = useState<DataFreshness | null>(null);
  const [canSync, setCanSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string>('demo');
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const theme = modeThemes[mode];
  const isAuthenticated = status === 'authenticated' && session?.user;

  // Fetch accounts and campaigns on load
  useEffect(() => {
    if (isAuthenticated) {
      fetchAccounts();
    } else {
      // Not authenticated - use demo mode
      fetchCampaigns('demo');
    }
  }, [isAuthenticated]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/google-ads/accounts');
      const data = await res.json();

      if (data.accounts && data.accounts.length > 0) {
        // Store all accounts for the switcher
        setAccounts(data.accounts);

        // Use first account by default
        const firstAccount = data.accounts[0];
        console.log(`[App] Using account: ${firstAccount.descriptiveName} (${firstAccount.customerId}) from ${data.source}`);
        setCustomerId(firstAccount.customerId);
        fetchCampaigns(firstAccount.customerId);
      } else {
        // No accounts found - show helpful message and stay in demo mode
        console.log('[App] No client accounts found:', data.message || data.error);
        setAccounts([]);
        fetchCampaigns('demo');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setAccounts([]);
      fetchCampaigns('demo');
    }
  }

  // Handle account switch
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
      if (!data.isDemo) {
        setCustomerId(custId);
      }
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
        body: JSON.stringify({
          customerId,
          syncType: 'incremental',
        }),
      });

      const data = await res.json();

      if (data.rateLimited) {
        setSyncError(`Rate limited. Try again ${data.nextSyncAt ? 'later' : 'in 1 hour'}.`);
      } else if (!data.success) {
        setSyncError(data.error || 'Sync failed');
      } else {
        // Refresh campaigns after sync
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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setStreaming(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          campaigns: campaigns.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            spend: c.spend,
            conversions: c.conversions,
            ctr: c.ctr,
            cpa: c.cpa,
          })),
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
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: updated[lastIdx].content + parsed.content,
                  };
                  return updated;
                });
              }
            } catch {
              // Skip invalid JSON
            }
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

    // Optimistic update
    setCampaigns(prev =>
      prev.map(c =>
        c.id === campaign.id ? { ...c, status: newStatus } : c
      )
    );

    try {
      await fetch('/api/google-ads/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'demo',
          campaignId: campaign.id,
          status: newStatus,
        }),
      });
    } catch (error) {
      console.error('Error updating campaign:', error);
      // Revert on error
      setCampaigns(prev =>
        prev.map(c =>
          c.id === campaign.id ? { ...c, status: campaign.status } : c
        )
      );
    }
  }

  function handleScoreClick(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setShowWhatIf(true);
  }

  function handlePlaybookAction(action: string, affectedCampaigns: Campaign[]) {
    console.log('Executing playbook:', action, affectedCampaigns);
    // Implementation would go here
    if (action === 'pause-wasters') {
      affectedCampaigns.forEach(c => toggleCampaignStatus(c));
    }
  }

  // Calculate stats
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'ENABLED').length;
  const avgScore = Math.round(campaigns.reduce((sum, c) => sum + c.aiScore, 0) / Math.max(campaigns.length, 1));
  const wasters = campaigns.filter(c => c.aiScore < 40 && c.status === 'ENABLED');
  const potentialSavings = wasters.reduce((sum, c) => sum + c.spend, 0) * 0.3;

  return (
    <div className={`min-h-screen flex bg-gradient-to-b ${theme.headerBg}`}>
      {/* Left: Campaign List */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-text">Quick Ads AI</h1>
            <p className="text-text2">Stop wasting spend. Grow what works.</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Data Freshness Indicator */}
            <div className="flex items-center gap-2">
              {isDemo ? (
                <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-xs rounded-full">
                  Demo Mode
                </span>
              ) : dataFreshness ? (
                <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1.5 ${
                  dataFreshness.isStale
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-green-500/10 text-green-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    dataFreshness.isStale ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  Data as of {dataFreshness.timeAgo}
                </span>
              ) : null}

              {/* Sync Button */}
              <button
                onClick={handleSync}
                disabled={syncing || (!canSync && !isDemo)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  syncing
                    ? 'bg-surface2 text-text3 cursor-wait'
                    : canSync || isDemo
                    ? 'bg-accent text-white hover:bg-accent-hover'
                    : 'bg-surface2 text-text3 cursor-not-allowed'
                }`}
                title={!canSync && !isDemo ? 'Rate limited - try again later' : 'Sync data from Google Ads'}
              >
                <svg
                  className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {syncing ? 'Syncing...' : 'Sync Data'}
              </button>
            </div>

            {syncError && (
              <span className="text-xs text-red-500">{syncError}</span>
            )}

            {/* Account Switcher */}
            {accounts.length > 0 && (
              <div className="relative">
                <select
                  value={customerId}
                  onChange={(e) => handleAccountSwitch(e.target.value)}
                  className="appearance-none bg-surface2 text-text text-xs rounded-lg px-3 py-1.5 pr-8 border border-divider focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  {accounts.map((acc) => (
                    <option key={acc.customerId} value={acc.customerId}>
                      {acc.descriptiveName || `Account ${acc.customerId}`}
                    </option>
                  ))}
                </select>
                <svg
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text3 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}

            <ModeSwitcher mode={mode} onModeChange={setMode} />

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text2 hidden sm:inline">
                  {session.user?.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium bg-surface2 text-text2 hover:bg-divider transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <a
                href="/login"
                className="px-3 py-1.5 text-xs rounded-lg font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Sign In
              </a>
            )}
          </div>
        </div>

        {/* Mode-specific content */}
        {mode === 'monitor' ? (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <StatCard
                label="Total Spend"
                value={`$${totalSpend.toLocaleString()}`}
                icon="💰"
              />
              <StatCard
                label="Conversions"
                value={totalConversions.toLocaleString()}
                icon="🎯"
              />
              <StatCard
                label="Active"
                value={activeCampaigns.toString()}
                sublabel={`of ${campaigns.length}`}
                icon="✅"
              />
              <StatCard
                label="Avg AI Score"
                value={avgScore.toString()}
                icon="🤖"
                highlight={avgScore >= 70 ? 'success' : avgScore >= 40 ? 'warning' : 'danger'}
              />
              <StatCard
                label="Potential Savings"
                value={`$${potentialSavings.toFixed(0)}/mo`}
                icon="💡"
                highlight="success"
                tooltip="Estimated savings from pausing low-performing campaigns (AI Score < 40). Based on 30% of current spend on waster campaigns."
              />
            </div>

            {/* AI Playbooks */}
            <AIPlaybooks campaigns={campaigns} onAction={handlePlaybookAction} />

            {/* Campaign Table */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
                <h3 className="font-semibold text-text">Campaigns</h3>
                <div className="flex items-center gap-2 text-xs text-text3">
                  <span>Click AI Score to see breakdown</span>
                </div>
              </div>
              {loading ? (
                <div className="p-8 text-center text-text2">Loading campaigns...</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-divider bg-surface2">
                      <th className="text-left p-4 text-xs font-semibold text-text2 uppercase">Campaign</th>
                      <th className="text-right p-4 text-xs font-semibold text-text2 uppercase">Spend</th>
                      <th className="text-right p-4 text-xs font-semibold text-text2 uppercase">Conv</th>
                      <th className="text-right p-4 text-xs font-semibold text-text2 uppercase">CTR</th>
                      <th className="text-right p-4 text-xs font-semibold text-text2 uppercase">CPA</th>
                      <th className="text-right p-4 text-xs font-semibold text-text2 uppercase">
                        <span className="flex items-center justify-end gap-1">
                          AI Score
                          <InfoTooltip content="AI Score is calculated from CTR (35%), Conversion Rate (30%), CPC (20%), and Quality Score (15%). Click to see breakdown and what-if scenarios." />
                        </span>
                      </th>
                      <th className="text-center p-4 text-xs font-semibold text-text2 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(campaign => (
                      <tr
                        key={campaign.id}
                        className="border-b border-divider hover:bg-surface2 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                campaign.status === 'ENABLED' ? 'bg-success' : 'bg-text3'
                              }`}
                            />
                            <div>
                              <div className="font-medium text-text">{campaign.name}</div>
                              <div className="text-xs text-text3">{campaign.type}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right tabular-nums text-text">
                          ${campaign.spend.toLocaleString()}
                        </td>
                        <td className="p-4 text-right tabular-nums text-text">
                          {campaign.conversions}
                        </td>
                        <td className="p-4 text-right tabular-nums text-text">
                          {campaign.ctr.toFixed(2)}%
                        </td>
                        <td className="p-4 text-right tabular-nums text-text">
                          ${campaign.cpa.toFixed(2)}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleScoreClick(campaign)}
                            className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-semibold cursor-pointer transition-all hover:scale-110 hover:shadow-lg ${
                              campaign.aiScore >= 70
                                ? 'bg-success/10 text-success hover:bg-success/20'
                                : campaign.aiScore >= 40
                                ? 'bg-warning/10 text-warning hover:bg-warning/20'
                                : 'bg-danger/10 text-danger hover:bg-danger/20'
                            }`}
                            title="Click to see What-If scenarios"
                          >
                            {campaign.aiScore}
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleCampaignStatus(campaign)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              campaign.status === 'ENABLED'
                                ? 'bg-surface2 text-text2 hover:bg-divider'
                                : 'bg-accent text-white hover:bg-accent-hover'
                            }`}
                          >
                            {campaign.status === 'ENABLED' ? 'Pause' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          /* Build Mode Content */
          <div className="card p-8 text-center">
            <div className="text-4xl mb-4">🚧</div>
            <h2 className="text-xl font-semibold text-text mb-2">Build Mode Coming Soon</h2>
            <p className="text-text2 max-w-md mx-auto">
              Create campaigns, manage keywords, and configure negative keywords.
              Paste a URL to scan landing pages and generate AI-powered campaign structures.
            </p>
          </div>
        )}
      </div>

      {/* Right: AI Chat */}
      <div className={`w-[400px] border-l border-divider bg-surface flex flex-col ${
        mode === 'monitor' ? 'border-l-blue-900/30' : 'border-l-purple-900/30'
      }`}>
        <div className={`p-4 border-b border-divider ${
          mode === 'monitor' ? 'bg-blue-900/10' : 'bg-purple-900/10'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-xl ${mode === 'monitor' ? 'text-blue-500' : 'text-purple-500'}`}>✨</span>
            <h2 className="font-semibold text-text">AI Assistant</h2>
          </div>
          <p className="text-xs text-text3 mt-1">
            {mode === 'monitor'
              ? 'Ask me to optimize, analyze, or manage campaigns'
              : 'I can help you create and configure campaigns'
            }
          </p>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-text3 py-8">
              <p className="mb-4">Try asking:</p>
              <div className="space-y-2">
                {(mode === 'monitor'
                  ? ['Optimize my campaigns', 'What should I pause?', 'Show top performers']
                  : ['Create a new campaign', 'Suggest keywords', 'Scan my landing page']
                ).map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="block w-full px-4 py-2 bg-surface2 rounded-lg text-sm text-text2 hover:bg-divider transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map(message => (
            <div
              key={message.id}
              className={`animate-slideUp ${
                message.role === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block max-w-[85%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                  message.role === 'user'
                    ? mode === 'monitor' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                    : 'bg-surface2 text-text'
                }`}
              >
                {message.content || (streaming && message.role === 'assistant' ? '...' : '')}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-divider">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask AI to help..."
              className="flex-1 px-4 py-2 bg-surface2 rounded-xl text-sm text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={streaming}
            />
            <button
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              className={`px-4 py-2 rounded-xl text-white font-medium transition-colors disabled:opacity-50 ${
                mode === 'monitor' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {streaming ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* What-If Drawer */}
      {selectedCampaign && (
        <WhatIfDrawer
          campaign={selectedCampaign}
          isOpen={showWhatIf}
          onClose={() => {
            setShowWhatIf(false);
            setSelectedCampaign(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon,
  highlight,
  tooltip
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: string;
  highlight?: 'success' | 'warning' | 'danger';
  tooltip?: string;
}) {
  const highlightClasses = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-text3 flex items-center gap-1">
          {label}
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${highlight ? highlightClasses[highlight] : 'text-text'}`}>
        {value}
        {sublabel && <span className="text-sm text-text3 font-normal ml-1">{sublabel}</span>}
      </div>
    </div>
  );
}
