'use client';

import { MCPConnection } from '@/hooks/useInsightChat';

interface MCPStatusBarProps {
  connections: MCPConnection[];
  onConfigure?: (type: MCPConnection['type']) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const MCP_ICONS: Record<MCPConnection['type'], string> = {
  google_ads: '📊',
  analytics: '📈',
  search_console: '🔍',
  bigquery: '🗄️',
};

const STATUS_COLORS: Record<MCPConnection['status'], string> = {
  connected: 'bg-green-500',
  disconnected: 'bg-gray-400',
  error: 'bg-red-500',
  loading: 'bg-yellow-500 animate-pulse',
};

export function MCPStatusBar({ connections, onConfigure, onRefresh, isRefreshing }: MCPStatusBarProps) {
  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const hasGoogleAds = connections.find(c => c.type === 'google_ads' && c.status === 'connected');

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
      <span className="text-xs font-medium text-gray-500 shrink-0">Connected MCPs:</span>
      <div className="flex items-center gap-2">
        {connections.map((conn) => (
          <button
            key={conn.type}
            onClick={() => {
              if (conn.status === 'disconnected') {
                onConfigure?.(conn.type);
              } else if (conn.type === 'google_ads' && conn.status === 'connected') {
                onRefresh?.();
              }
            }}
            disabled={conn.status === 'loading' || isRefreshing}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              transition-all duration-200
              ${conn.status === 'connected'
                ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                : conn.status === 'error'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : conn.status === 'loading'
                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 cursor-pointer'
              }
              ${(conn.status === 'loading' || isRefreshing) ? 'opacity-70 cursor-wait' : ''}
            `}
            title={
              conn.status === 'connected'
                ? `${conn.name} connected${conn.lastSync ? ` - Last sync: ${conn.lastSync.toLocaleTimeString()}` : ''} - Click to refresh`
                : conn.status === 'error'
                ? `${conn.name} error: ${conn.error || 'Connection failed'}`
                : conn.status === 'loading'
                ? `Loading ${conn.name}...`
                : `Click to connect ${conn.name}`
            }
          >
            <span className={conn.status === 'loading' || (conn.type === 'google_ads' && isRefreshing) ? 'animate-pulse' : ''}>
              {MCP_ICONS[conn.type]}
            </span>
            <span>{conn.name}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[conn.status]}`} />
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {hasGoogleAds && onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-[10px] text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
        )}
        <span className="text-[10px] text-gray-400">
          {connectedCount}/{connections.length} active
        </span>
      </div>
    </div>
  );
}
