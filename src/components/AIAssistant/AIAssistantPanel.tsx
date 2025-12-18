'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useActionQueue } from '@/contexts/ActionQueueContext';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { useDrillDown } from '@/contexts/DrillDownContext';
import { ActionType, EntityType } from '@/types/action-queue';

interface SuggestedAction {
  id: string;
  label: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  currentValue: string;
  newValue: string;
  description?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: boolean;
  suggestedActions?: SuggestedAction[];
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIAssistantPanel({ isOpen, onClose }: AIAssistantPanelProps) {
  const { currentAccount } = useAccount();
  const { addAction } = useActionQueue();
  const { campaigns, adGroups, keywords, fetchAdGroups, fetchKeywords } = useCampaignsData();
  const { selectedCampaign, selectedAdGroup, currentLevel } = useDrillDown();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI Campaign Assistant. I can help you:\n\n• Create new campaigns from descriptions\n• Generate ad copy and keywords\n• Optimize existing campaigns\n• Answer Google Ads questions\n\nWhat would you like to do?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Fetch ad groups when viewing a campaign
  useEffect(() => {
    if (selectedCampaign && currentAccount?.id) {
      fetchAdGroups(selectedCampaign.id);
    }
  }, [selectedCampaign, currentAccount?.id, fetchAdGroups]);

  // Fetch keywords when viewing an ad group
  useEffect(() => {
    if (selectedAdGroup && currentAccount?.id) {
      fetchKeywords(selectedAdGroup.id);
    }
  }, [selectedAdGroup, currentAccount?.id, fetchKeywords]);

  const stopGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);

      // Mark current streaming message as complete
      setMessages(prev => prev.map(m =>
        m.isStreaming ? { ...m, isStreaming: false, content: m.content + ' [stopped]' } : m
      ));
    }
  }, [abortController]);

  const retryLastMessage = useCallback(() => {
    // Find the last user message
    const lastUserMsgIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserMsgIndex === -1) return;

    const lastUserMsg = messages[lastUserMsgIndex];

    // Remove messages after the last user message
    setMessages(prev => prev.slice(0, lastUserMsgIndex + 1));

    // Resend
    sendMessageWithContent(lastUserMsg.content);
  }, [messages]);

  const sendMessageWithContent = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: new Date(),
    };

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
            role: m.role,
            content: m.content,
          })),
          accountContext: currentAccount ? {
            accountId: currentAccount.id,
            accountName: currentAccount.googleAccountId,
            // All campaigns summary for context
            campaigns: campaigns.map(c => ({
              id: c.id,
              name: c.name,
              status: c.status,
              type: c.type,
              spend: c.spend,
              clicks: c.clicks,
              impressions: c.impressions,
              conversions: c.conversions,
              ctr: c.ctr,
              cpa: c.cpa,
              roas: c.roas,
              aiScore: c.aiScore,
              aiRecommendation: c.aiRecommendation,
            })),
            // Currently selected entity for focused context
            selectedEntity: selectedCampaign ? {
              type: selectedAdGroup ? 'adGroup' : 'campaign',
              campaign: selectedCampaign,
              adGroup: selectedAdGroup || undefined,
              adGroups: adGroups.length > 0 ? adGroups : undefined,
              keywords: keywords.length > 0 ? keywords : undefined,
            } : null,
            currentLevel,
          } : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Stream request failed');
      }

      const reader = response.body?.getReader();
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
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: m.content + parsed.content }
                    : m
                ));
              }
              if (parsed.suggestedActions) {
                // Add suggested actions to the message
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, suggestedActions: parsed.suggestedActions }
                    : m
                ));
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue; // Skip invalid JSON
              throw e;
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId ? { ...m, isStreaming: false } : m
      ));
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled - already handled
        return;
      }

      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isApiKeyError = errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('unauthorized');
      const isModelError = errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('unavailable');

      let userFriendlyMessage = 'Sorry, I encountered an error. Please try again.';
      if (isApiKeyError) {
        userFriendlyMessage = 'API key issue: Please check your AI settings (Settings > AI Integration) to configure your API key.';
      } else if (isModelError) {
        userFriendlyMessage = 'AI service temporarily unavailable. Please try again in a moment, or check your API key in Settings.';
      } else if (errorMessage) {
        userFriendlyMessage = `Error: ${errorMessage}`;
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? {
              ...m,
              content: userFriendlyMessage,
              isStreaming: false,
              error: true,
            }
          : m
      ));
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const content = input;
    setInput('');
    await sendMessageWithContent(content);
  };

  const handleQuickAction = (action: string) => {
    let prompt = '';
    switch (action) {
      case 'create':
        prompt = 'Help me create a new search campaign';
        break;
      case 'optimize':
        prompt = 'Analyze my campaigns and suggest optimizations for better performance';
        break;
      case 'keywords':
        prompt = 'Generate keyword ideas for my business';
        break;
      case 'ads':
        prompt = 'Help me write better ad copy';
        break;
    }
    setInput(prompt);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Chat cleared! How can I help you today?",
        timestamp: new Date(),
      },
    ]);
  };

  const handleAddActionToQueue = (action: SuggestedAction) => {
    if (!currentAccount) return;

    addAction({
      accountId: currentAccount.id,
      actionType: action.actionType,
      entityType: action.entityType,
      entityId: action.entityId,
      entityName: action.entityName,
      currentValue: action.currentValue,
      newValue: action.newValue,
    });

    // Mark the action as added in the message
    setMessages(prev => prev.map(m => ({
      ...m,
      suggestedActions: m.suggestedActions?.map(a =>
        a.id === action.id ? { ...a, description: 'Added to queue!' } : a
      ),
    })));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Panel - Full screen on mobile, positioned panel on desktop */}
      <div
        role="dialog"
        aria-labelledby="ai-assistant-title"
        aria-describedby="ai-assistant-description"
        aria-modal="true"
        className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white shadow-2xl sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[600px] sm:w-[420px] sm:rounded-2xl md:bottom-8 md:right-8"
      >
        <p id="ai-assistant-description" className="sr-only">
          Chat interface for AI-powered Google Ads campaign assistance. Press Escape to close.
        </p>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <svg className="h-6 w-6 text-white" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h2 id="ai-assistant-title" className="font-semibold text-white">AI Campaign Assistant</h2>
              <p className="text-xs text-white/70">
                {currentAccount ? currentAccount.googleAccountId : 'No account selected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearHistory}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Clear chat history"
              title="Clear history"
            >
              <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Close chat panel"
            >
              <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-4 py-2" role="group" aria-label="Quick actions">
          {[
            { id: 'create', label: 'Create Campaign', icon: '➕' },
            { id: 'optimize', label: 'Optimize', icon: '📈' },
            { id: 'keywords', label: 'Keywords', icon: '🔑' },
            { id: 'ads', label: 'Ad Copy', icon: '✏️' },
          ].map(action => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.id)}
              disabled={isLoading}
              aria-label={`Quick action: ${action.label}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span aria-hidden="true">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-relevant="additions"
          aria-label="Chat messages"
        >
          {messages.map(message => (
            <div
              key={message.id}
              role="article"
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.error
                    ? 'bg-red-50 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <span className="sr-only">
                  {message.role === 'user' ? 'You said:' : 'AI Assistant replied:'}
                </span>
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                )}

                {/* Suggested Actions */}
                {message.suggestedActions && message.suggestedActions.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                    <p className="text-xs font-medium text-gray-500">Suggested Actions:</p>
                    {message.suggestedActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleAddActionToQueue(action)}
                        disabled={action.description === 'Added to queue!'}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          action.description === 'Added to queue!'
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {action.description === 'Added to queue!' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            )}
                          </svg>
                          {action.label}
                        </span>
                        <span className="text-xs opacity-70">
                          {action.description || 'Add to Queue'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-1">
                  <p
                    className={`text-xs ${
                      message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {message.error && (
                    <button
                      onClick={retryLastMessage}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && !messages.some(m => m.isStreaming) && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-100 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          {/* Stop button when generating */}
          {isLoading && (
            <button
              onClick={stopGeneration}
              className="mb-2 w-full flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop generating
            </button>
          )}

          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">Chat message</label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask me anything about Google Ads... (Shift+Enter for new line)"
              aria-describedby="chat-input-hint"
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              disabled={isLoading}
            />
            <span id="chat-input-hint" className="sr-only">Press Enter to send, Shift+Enter for new line</span>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
