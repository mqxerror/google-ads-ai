'use client';

import { useState, useEffect } from 'react';

interface Message {
  id: number;
  timestamp: string;
  sender: 'claude' | 'gpt';
  content: string;
}

export default function ChatLogPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchMessages = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch('/api/dev/chat-log');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    if (autoRefresh) {
      const interval = setInterval(() => fetchMessages(false), 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleRefresh = () => {
    fetchMessages(true);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(messages.map(m => m.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  };

  const formatContent = (content: string) => {
    // Convert markdown headers
    let formatted = content
      .replace(/^### (.*$)/gm, '<h4 class="text-sm font-semibold mt-3 mb-1 text-gray-200">$1</h4>')
      .replace(/^## (.*$)/gm, '<h3 class="text-base font-bold mt-4 mb-2 text-white">$1</h3>')
      .replace(/^# (.*$)/gm, '<h2 class="text-lg font-bold mt-4 mb-2 text-white">$1</h2>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      // Lists
      .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
      // Line breaks
      .replace(/\n/g, '<br />');

    return formatted;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">💬</span> Dev Chat Log
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Claude Code ↔ Google Ads Designer GPT
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-gray-800 border-gray-700"
              />
              <span className="text-gray-400">Auto-refresh</span>
            </label>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded text-sm font-medium flex items-center gap-2"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
            <span className="text-xs text-gray-500">
              {messages.length} messages
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2 border-b border-gray-800">
        <button
          onClick={expandAll}
          className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300"
        >
          Collapse All
        </button>
        <span className="text-xs text-gray-500 ml-auto">
          Click message to expand/collapse
        </span>
      </div>

      {/* Chat Messages */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">🤖</p>
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isExpanded = expandedIds.has(msg.id);
              const displayContent = isExpanded ? msg.content : truncateContent(msg.content);
              const needsTruncation = msg.content.length > 200;

              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'claude' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    onClick={() => needsTruncation && toggleExpand(msg.id)}
                    className={`max-w-[85%] rounded-2xl px-5 py-4 transition-all ${
                      msg.sender === 'claude'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-800 text-gray-100 rounded-bl-sm border border-gray-700'
                    } ${needsTruncation ? 'cursor-pointer hover:ring-2 hover:ring-white/20' : ''}`}
                  >
                    {/* Sender Label */}
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-opacity-20 border-white">
                      <span className="text-lg">
                        {msg.sender === 'claude' ? '🤖' : '🧠'}
                      </span>
                      <span className="font-semibold text-sm">
                        {msg.sender === 'claude' ? 'Claude Code' : 'Google Ads Designer GPT'}
                      </span>
                      <span className="text-xs opacity-60 ml-auto">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      {needsTruncation && (
                        <span className="text-xs opacity-60">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}
                    </div>

                    {/* Message Content */}
                    <div
                      className={`text-sm leading-relaxed prose-invert ${
                        !isExpanded && needsTruncation ? 'line-clamp-4' : ''
                      }`}
                      dangerouslySetInnerHTML={{ __html: formatContent(displayContent) }}
                    />

                    {/* Expand/Collapse hint */}
                    {needsTruncation && !isExpanded && (
                      <div className="mt-2 pt-2 border-t border-opacity-20 border-white text-xs opacity-60 text-center">
                        Click to expand ({msg.content.length} chars)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <span>⚠️ Development only - this page will be removed after completion</span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
