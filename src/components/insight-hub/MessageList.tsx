'use client';

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { InsightMessage, InsightAction, MCPSource } from '@/hooks/useInsightChat';

interface MessageListProps {
  messages: InsightMessage[];
  onAction?: (action: InsightAction) => void;
}

const MCP_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  google_ads: { label: 'Google Ads', color: 'text-blue-700', bg: 'bg-blue-100' },
  analytics: { label: 'Analytics', color: 'text-green-700', bg: 'bg-green-100' },
  search_console: { label: 'Search Console', color: 'text-purple-700', bg: 'bg-purple-100' },
  bigquery: { label: 'BigQuery', color: 'text-orange-700', bg: 'bg-orange-100' },
};

function MCPSourceBadge({ source }: { source: MCPSource }) {
  const style = MCP_LABELS[source.mcp] || { label: source.mcp, color: 'text-gray-700', bg: 'bg-gray-100' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.color}`}>
      {style.label}
      {source.tool && <span className="opacity-70">/ {source.tool}</span>}
    </span>
  );
}

function ActionButton({ action, onClick }: { action: InsightAction; onClick: () => void }) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${variants[action.variant || 'secondary']}`}
    >
      {action.label}
    </button>
  );
}

function MessageBubble({
  message,
  onAction,
}: {
  message: InsightMessage;
  onAction?: (action: InsightAction) => void;
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
            : 'bg-white border border-gray-200 rounded-2xl rounded-bl-md shadow-sm'
        }`}
      >
        {/* Header for assistant messages */}
        {!isUser && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
            <span className="text-lg">🤖</span>
            <span className="text-sm font-medium text-gray-700">Insight Hub AI</span>
            {message.isStreaming && (
              <span className="flex items-center gap-1 text-xs text-blue-600">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                typing...
              </span>
            )}
          </div>
        )}

        {/* Message content */}
        <div className={`px-4 py-3 ${isUser ? '' : 'prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0'}`}>
          {isUser ? (
            <p className="text-sm">{message.content}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="text-sm text-gray-700 mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">{children}</ul>,
                li: ({ children }) => <li>{children}</li>,
                code: ({ children }) => (
                  <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-800">{children}</code>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* MCP Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-1">
            <span className="text-[10px] text-gray-400 mr-1">Sources:</span>
            {message.sources.map((source, idx) => (
              <MCPSourceBadge key={idx} source={source} />
            ))}
          </div>
        )}

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2">
            {message.actions.map((action, idx) => (
              <ActionButton
                key={idx}
                action={action}
                onClick={() => onAction?.(action)}
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={`px-4 pb-2 text-[10px] ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

export function MessageList({ messages, onAction }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} onAction={onAction} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
