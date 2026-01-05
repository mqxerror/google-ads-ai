'use client';

import { useState, useCallback, useRef } from 'react';

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

interface UseInsightChatReturn {
  messages: InsightMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  mcpConnections: MCPConnection[];
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  executeAction: (action: InsightAction) => Promise<void>;
}

const DEFAULT_MCP_CONNECTIONS: MCPConnection[] = [
  { type: 'google_ads', name: 'Google Ads', status: 'connected' },
  { type: 'analytics', name: 'Analytics', status: 'disconnected' },
  { type: 'search_console', name: 'Search Console', status: 'disconnected' },
  { type: 'bigquery', name: 'BigQuery', status: 'disconnected' },
];

const SUGGESTED_PROMPTS = [
  "Show me campaigns with high spend but low conversions",
  "What keywords are wasting budget?",
  "Which campaigns improved this week?",
  "Find opportunities to reduce CPA",
];

export function useInsightChat(): UseInsightChatReturn {
  const [messages, setMessages] = useState<InsightMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Welcome to **Insight Hub**! I'm your AI assistant connected to your Google Marketing data.

I can help you:
- Analyze campaign performance and find optimization opportunities
- Identify wasted spend and suggest negative keywords
- Correlate data across Google Ads, Analytics, and Search Console
- Answer questions about your marketing data in natural language

**Try asking:**
- "Show me campaigns spending over $100/day with low ROAS"
- "What search terms are wasting budget?"
- "Which landing pages have high bounce rates?"`,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcpConnections, setMcpConnections] = useState<MCPConnection[]>(DEFAULT_MCP_CONNECTIONS);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

      // Call the chat API with streaming
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: content.trim() }],
          context: 'insight_hub',
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
  }, [messages, isLoading]);

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
    sendMessage,
    clearMessages,
    executeAction,
  };
}

export { SUGGESTED_PROMPTS };
