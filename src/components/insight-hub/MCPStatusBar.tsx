'use client';

import { MCPConnection } from '@/hooks/useInsightChat';

interface MCPStatusBarProps {
  connections: MCPConnection[];
  onConfigure?: (type: MCPConnection['type']) => void;
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

const STATUS_TEXT_COLORS: Record<MCPConnection['status'], string> = {
  connected: 'text-green-600',
  disconnected: 'text-gray-500',
  error: 'text-red-600',
  loading: 'text-yellow-600',
};

export function MCPStatusBar({ connections, onConfigure }: MCPStatusBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
      <span className="text-xs font-medium text-gray-500 shrink-0">Connected MCPs:</span>
      <div className="flex items-center gap-2">
        {connections.map((conn) => (
          <button
            key={conn.type}
            onClick={() => conn.status === 'disconnected' && onConfigure?.(conn.type)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              transition-all duration-200
              ${conn.status === 'connected'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : conn.status === 'error'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 cursor-pointer'
              }
            `}
            title={conn.status === 'connected'
              ? `${conn.name} connected${conn.lastSync ? ` - Last sync: ${conn.lastSync.toLocaleTimeString()}` : ''}`
              : conn.status === 'error'
              ? `${conn.name} error: ${conn.error || 'Connection failed'}`
              : `Click to connect ${conn.name}`
            }
          >
            <span>{MCP_ICONS[conn.type]}</span>
            <span>{conn.name}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[conn.status]}`} />
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-gray-400">
          {connections.filter(c => c.status === 'connected').length}/{connections.length} active
        </span>
      </div>
    </div>
  );
}
