'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { DateRange, getDefaultDateRange } from '@/components/insight-hub/DateRangePicker';

export interface MCPSource {
  mcp: 'google_ads' | 'analytics' | 'search_console' | 'bigquery';
  tool: string;
  data?: any;
}

export interface InsightAction {
  label: string;
  action: string;
  params?: Record<string, any>;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface InsightMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: MCPSource[];
  actions?: InsightAction[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface MCPConnection {
  type: 'google_ads' | 'analytics' | 'search_console' | 'bigquery';
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'loading';
  lastSync?: Date;
  error?: string;
}

export interface CampaignData {
  id: string;
  name: string;
  status: string;
  type?: string;
  spend: number;
  clicks?: number;
  impressions?: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas?: number;
  aiScore?: number;
}

export interface GoogleAdsAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode?: string;
  manager?: boolean;
}

interface UseInsightChatReturn {
  messages: InsightMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  mcpConnections: MCPConnection[];
  campaigns: CampaignData[];
  isLoadingCampaigns: boolean;
  accounts: GoogleAdsAccount[];
  selectedAccountId: string | null;
  dateRange: DateRange;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  executeAction: (action: InsightAction) => Promise<void>;
  refreshCampaigns: () => Promise<void>;
  selectAccount: (accountId: string) => Promise<void>;
  setDateRange: (range: DateRange) => void;
}

const SUGGESTED_PROMPTS = [
  "Show me campaigns with high spend but low conversions",
  "What keywords are wasting budget?",
  "Which campaigns improved this week?",
  "Find opportunities to reduce CPA",
];

export function useInsightChat(): UseInsightChatReturn {
  const [messages, setMessages] = useState<InsightMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcpConnections, setMcpConnections] = useState<MCPConnection[]>([
    { type: 'google_ads', name: 'Google Ads', status: 'loading' },
    { type: 'analytics', name: 'Analytics', status: 'disconnected' },
    { type: 'search_console', name: 'Search Console', status: 'disconnected' },
    { type: 'bigquery', name: 'BigQuery', status: 'disconnected' },
  ]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loginCustomerId, setLoginCustomerId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const abortControllerRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Fetch Google Ads account on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    fetchAccountAndCampaigns();
  }, []);

  const fetchAccountAndCampaigns = async () => {
    setIsLoadingCampaigns(true);

    try {
      // First, get the accounts
      const accountsRes = await fetch('/api/google-ads/accounts');
      const accountsData = await accountsRes.json();

      if (accountsData.error) {
        console.error('[InsightChat] Account error:', accountsData.error);
        setMcpConnections(prev => prev.map(c =>
          c.type === 'google_ads' ? { ...c, status: 'error', error: accountsData.error } : c
        ));
        setWelcomeMessage(null, accountsData.error);
        setIsLoadingCampaigns(false);
        return;
      }

      if (!accountsData.accounts || accountsData.accounts.length === 0) {
        setMcpConnections(prev => prev.map(c =>
          c.type === 'google_ads' ? { ...c, status: 'disconnected' } : c
        ));
        setWelcomeMessage(null, 'No Google Ads accounts found');
        setIsLoadingCampaigns(false);
        return;
      }

      // Store all accounts
      setAccounts(accountsData.accounts);
      if (accountsData.loginCustomerId) {
        setLoginCustomerId(accountsData.loginCustomerId);
      }

      // Use first account by default
      const account = accountsData.accounts[0];
      setSelectedAccountId(account.customerId);

      // Fetch campaigns for this account
      await fetchCampaignsForAccount(account.customerId, accountsData.loginCustomerId);
    } catch (err) {
      console.error('[InsightChat] Failed to fetch campaigns:', err);
      setMcpConnections(prev => prev.map(c =>
        c.type === 'google_ads' ? { ...c, status: 'error', error: 'Failed to connect' } : c
      ));
      setWelcomeMessage(null, 'Failed to connect to Google Ads');
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  const fetchCampaignsForAccount = async (accountId: string, mccId?: string | null, range?: DateRange) => {
    setIsLoadingCampaigns(true);
    try {
      const currentRange = range || dateRange;
      const params = new URLSearchParams({
        customerId: accountId,
        startDate: currentRange.startDate,
        endDate: currentRange.endDate,
      });
      if (mccId) params.append('loginCustomerId', mccId);

      const campaignsRes = await fetch(`/api/google-ads/campaigns?${params.toString()}`);
      const campaignsData = await campaignsRes.json();

      if (campaignsData.campaigns && campaignsData.campaigns.length > 0 && !campaignsData.isDemo) {
        setCampaigns(campaignsData.campaigns);
        setMcpConnections(prev => prev.map(c =>
          c.type === 'google_ads'
            ? { ...c, status: 'connected', lastSync: campaignsData.dataFreshness?.lastSyncedAt ? new Date(campaignsData.dataFreshness.lastSyncedAt) : undefined }
            : c
        ));
        setWelcomeMessage(campaignsData.campaigns);
      } else {
        // No campaigns or demo mode
        setCampaigns(campaignsData.campaigns || []);
        setMcpConnections(prev => prev.map(c =>
          c.type === 'google_ads' ? { ...c, status: campaignsData.isDemo ? 'disconnected' : 'connected' } : c
        ));
        setWelcomeMessage(campaignsData.isDemo ? null : campaignsData.campaigns);
      }
    } catch (err) {
      console.error('[InsightChat] Failed to fetch campaigns:', err);
      setCampaigns([]);
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  const selectAccount = async (accountId: string) => {
    if (accountId === selectedAccountId) return;

    setSelectedAccountId(accountId);
    const account = accounts.find(a => a.customerId === accountId);

    // Add system message about account switch
    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'system',
      content: `Switched to account: **${account?.descriptiveName || accountId}**`,
      timestamp: new Date(),
    }]);

    await fetchCampaignsForAccount(accountId, loginCustomerId);
  };

  const refreshCampaigns = async () => {
    if (selectedAccountId) {
      setIsLoadingCampaigns(true);
      try {
        const params = new URLSearchParams({
          customerId: selectedAccountId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          forceRefresh: 'true',
        });
        if (loginCustomerId) params.append('loginCustomerId', loginCustomerId);

        const res = await fetch(`/api/google-ads/campaigns?${params.toString()}`);
        const data = await res.json();
        if (data.campaigns) {
          setCampaigns(data.campaigns);
        }
      } catch (err) {
        console.error('[InsightChat] Failed to refresh campaigns:', err);
      } finally {
        setIsLoadingCampaigns(false);
      }
    }
  };

  const handleDateRangeChange = async (newRange: DateRange) => {
    setDateRange(newRange);
    if (selectedAccountId) {
      await fetchCampaignsForAccount(selectedAccountId, loginCustomerId, newRange);
    }
  };

  const setWelcomeMessage = (campaignData: CampaignData[] | null, errorMsg?: string) => {
    let content = '';

    if (errorMsg) {
      content = `Welcome to **Insight Hub**! 🧠

⚠️ **${errorMsg}**

Please make sure you're signed in with a Google account that has access to Google Ads.

Once connected, I can help you:
- Analyze campaign performance
- Identify wasted spend
- Suggest optimizations`;
    } else if (!campaignData || campaignData.length === 0) {
      content = `Welcome to **Insight Hub**! 🧠

I'm your AI assistant for Google Marketing data.

📊 **No campaigns found** - Start by creating a campaign or syncing your data.

I can help you:
- Analyze campaign performance
- Identify wasted spend and suggest negative keywords
- Answer questions about your marketing data`;
    } else {
      const totalSpend = campaignData.reduce((sum, c) => sum + (c.spend || 0), 0);
      const totalConversions = campaignData.reduce((sum, c) => sum + (c.conversions || 0), 0);
      const enabledCount = campaignData.filter(c => c.status === 'ENABLED').length;

      content = `Welcome to **Insight Hub**! 🧠

✅ **Connected to Google Ads** - ${campaignData.length} campaigns loaded

**Quick Stats:**
- 📊 ${enabledCount} active campaigns
- 💰 $${totalSpend.toLocaleString()} total spend
- 🎯 ${totalConversions} conversions

**Try asking:**
- "Which campaigns have high spend but low conversions?"
- "Show me my best performing campaign"
- "What's my average CPA?"`;
    }

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content,
      timestamp: new Date(),
    }]);
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    // Add user message
    const userMessage: InsightMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Create placeholder for assistant response
    const assistantId = generateId();
    const assistantMessage: InsightMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, assistantMessage]);
    setIsStreaming(true);

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Build message history for context
      const history = messages
        .filter(m => m.role !== 'system')
        .slice(-10) // Last 10 messages for context
        .map(m => ({ role: m.role, content: m.content }));

      // Call the chat API with streaming - pass real campaign data!
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: content.trim() }],
          context: 'insight_hub',
          campaigns: campaigns.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            type: c.type,
            spend: c.spend || 0,
            conversions: c.conversions || 0,
            ctr: c.ctr || 0,
            cpa: c.cpa || 0,
            roas: c.roas,
            clicks: c.clicks,
            impressions: c.impressions,
          })),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE format: data: {...}\n\n - split on double newline
          const events = buffer.split('\n\n');
          buffer = events.pop() || ''; // Keep incomplete event in buffer

          for (const event of events) {
            const lines = event.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                if (!data) continue;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    fullContent += parsed.content;
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantId
                          ? { ...m, content: fullContent }
                          : m
                      )
                    );
                  }
                  if (parsed.error) {
                    setError(parsed.error);
                  }
                  // Handle MCP sources if included
                  if (parsed.sources) {
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantId
                          ? { ...m, sources: parsed.sources }
                          : m
                      )
                    );
                  }
                  // Handle actions if included
                  if (parsed.actions) {
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantId
                          ? { ...m, actions: parsed.actions }
                          : m
                      )
                    );
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', data, e);
                }
              }
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, isStreaming: false }
            : m
        )
      );

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }

      setError(err.message || 'Failed to send message');
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [messages, isLoading, campaigns]);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Chat cleared. How can I help you with your marketing data?`,
        timestamp: new Date(),
      },
    ]);
    setError(null);
  }, []);

  const executeAction = useCallback(async (action: InsightAction) => {
    console.log('Executing action:', action);
    // TODO: Implement action execution
    // This will call the appropriate API based on action.action
    // For now, just add a message showing the action
    setMessages(prev => [
      ...prev,
      {
        id: generateId(),
        role: 'system',
        content: `Executing: ${action.label}...`,
        timestamp: new Date(),
      },
    ]);
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    mcpConnections,
    campaigns,
    isLoadingCampaigns,
    accounts,
    selectedAccountId,
    dateRange,
    sendMessage,
    clearMessages,
    executeAction,
    refreshCampaigns,
    selectAccount,
    setDateRange: handleDateRangeChange,
  };
}

export { SUGGESTED_PROMPTS };
