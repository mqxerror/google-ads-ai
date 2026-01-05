'use client';

import { useInsightChat } from '@/hooks/useInsightChat';
import { MCPStatusBar } from './MCPStatusBar';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export function ChatPanel() {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    mcpConnections,
    sendMessage,
    clearMessages,
    executeAction,
  } = useInsightChat();

  const handleConfigure = (type: string) => {
    // TODO: Open configuration modal for the MCP type
    console.log('Configure MCP:', type);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* MCP Status Bar */}
      <MCPStatusBar connections={mcpConnections} onConfigure={handleConfigure} />

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => clearMessages()}
            className="text-red-600 hover:text-red-800 text-xs underline"
          >
            Clear & retry
          </button>
        </div>
      )}

      {/* Messages */}
      <MessageList messages={messages} onAction={executeAction} />

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading || isStreaming}
        placeholder="Ask about campaigns, keywords, analytics, or search data..."
      />
    </div>
  );
}
