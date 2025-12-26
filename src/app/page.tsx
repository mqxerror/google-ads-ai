'use client';

import { useState, useRef, useEffect } from 'react';
import { Campaign } from '@/types/campaign';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch campaigns on load
  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/google-ads/campaigns?customerId=demo');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen flex">
      {/* Left: Campaign List */}
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text">Quick Ads AI</h1>
          <p className="text-text2">Fast, AI-powered Google Ads management</p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Spend"
            value={`$${campaigns.reduce((sum, c) => sum + c.spend, 0).toLocaleString()}`}
          />
          <StatCard
            label="Conversions"
            value={campaigns.reduce((sum, c) => sum + c.conversions, 0).toLocaleString()}
          />
          <StatCard
            label="Active"
            value={campaigns.filter(c => c.status === 'ENABLED').length.toString()}
          />
          <StatCard
            label="Avg AI Score"
            value={Math.round(campaigns.reduce((sum, c) => sum + c.aiScore, 0) / Math.max(campaigns.length, 1)).toString()}
          />
        </div>

        {/* Campaign Table */}
        <div className="card overflow-hidden">
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
                  <th className="text-right p-4 text-xs font-semibold text-text2 uppercase">AI Score</th>
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
                      <span
                        className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-semibold ${
                          campaign.aiScore >= 70
                            ? 'bg-success/10 text-success'
                            : campaign.aiScore >= 40
                            ? 'bg-warning/10 text-warning'
                            : 'bg-danger/10 text-danger'
                        }`}
                      >
                        {campaign.aiScore}
                      </span>
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
      </div>

      {/* Right: AI Chat */}
      <div className="w-[400px] border-l border-divider bg-surface flex flex-col">
        <div className="p-4 border-b border-divider">
          <div className="flex items-center gap-2">
            <span className="text-accent text-xl">✨</span>
            <h2 className="font-semibold text-text">AI Assistant</h2>
          </div>
          <p className="text-xs text-text3 mt-1">Ask me to optimize, analyze, or manage campaigns</p>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-text3 py-8">
              <p className="mb-4">Try asking:</p>
              <div className="space-y-2">
                {['Optimize my campaigns', 'What should I pause?', 'Show top performers'].map(
                  suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="block w-full px-4 py-2 bg-surface2 rounded-lg text-sm text-text2 hover:bg-divider transition-colors"
                    >
                      {suggestion}
                    </button>
                  )
                )}
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
                    ? 'bg-accent text-white'
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
              className="btn-primary px-4"
            >
              {streaming ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-text3 mb-1">{label}</div>
      <div className="text-xl font-semibold text-text tabular-nums">{value}</div>
    </div>
  );
}
