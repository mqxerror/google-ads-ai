'use client';

import { useInsightChat } from '@/hooks/useInsightChat';
import { MCPStatusBar } from './MCPStatusBar';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { AccountSelector } from './AccountSelector';

export function ChatPanel() {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    mcpConnections,
    campaigns,
    isLoadingCampaigns,
    accounts,
    selectedAccountId,
    sendMessage,
    clearMessages,
    executeAction,
    refreshCampaigns,
    selectAccount,
  } = useInsightChat();

  const handleConfigure = (type: string) => {
    // For Google Ads, refresh campaigns
    if (type === 'google_ads') {
      refreshCampaigns();
    } else {
      // TODO: Open configuration modal for other MCP types
      console.log('Configure MCP:', type);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* MCP Status Bar with Account Selector */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50">
        <MCPStatusBar
          connections={mcpConnections}
          onConfigure={handleConfigure}
          onRefresh={refreshCampaigns}
          isRefreshing={isLoadingCampaigns}
        />
        {accounts.length > 1 && (
          <div className="pr-4 flex items-center gap-2">
            <span className="text-xs text-gray-400">Account:</span>
            <AccountSelector
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onSelect={selectAccount}
              isLoading={isLoadingCampaigns}
            />
          </div>
        )}
      </div>

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

      {/* Loading campaigns indicator */}
      {isLoadingCampaigns && messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading your campaigns...</p>
          </div>
        </div>
      )}

      {/* Messages */}
      {(!isLoadingCampaigns || messages.length > 0) && (
        <MessageList messages={messages} onAction={executeAction} />
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading || isStreaming}
        disabled={isLoadingCampaigns && messages.length === 0}
        placeholder={
          campaigns.length > 0
            ? `Ask about your ${campaigns.length} campaigns...`
            : "Ask about campaigns, keywords, analytics, or search data..."
        }
      />
    </div>
  );
}
