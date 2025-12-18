'use client';

import { LastChange } from '@/types/health';

interface LastChangeCellProps {
  change: LastChange;
  showDetails?: boolean;
}

function getSourceIcon(source: LastChange['source']) {
  switch (source) {
    case 'user':
      return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'ai':
      return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'system':
      return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'api':
      return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
  }
}

function getSourceColor(source: LastChange['source']) {
  switch (source) {
    case 'user':
      return 'text-blue-600 bg-blue-100';
    case 'ai':
      return 'text-purple-600 bg-purple-100';
    case 'system':
      return 'text-slate-600 bg-slate-100';
    case 'api':
      return 'text-emerald-600 bg-emerald-100';
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LastChangeCell({ change, showDetails = false }: LastChangeCellProps) {
  const sourceColor = getSourceColor(change.source);
  const timeAgo = formatTimeAgo(new Date(change.when));

  return (
    <div className="min-w-[100px]">
      {/* Source badge + time */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${sourceColor}`}
        >
          {getSourceIcon(change.source)}
          <span className="text-[10px] font-medium capitalize">{change.who || change.source}</span>
        </span>
        <span className="text-[10px] text-slate-400">{timeAgo}</span>
      </div>

      {/* What changed */}
      <p className="text-xs text-slate-700 truncate" title={change.what}>
        {change.what}
      </p>

      {/* Value change */}
      {showDetails && change.oldValue !== undefined && change.newValue !== undefined && (
        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
          <span className="tabular-nums line-through">{formatValue(change.oldValue)}</span>
          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="tabular-nums font-medium text-slate-700">
            {formatValue(change.newValue)}
          </span>
        </div>
      )}
    </div>
  );
}

function formatValue(value: string | number): string {
  if (typeof value === 'number') {
    return `$${value.toLocaleString()}`;
  }
  return String(value);
}

// Compact badge version
export function LastChangeBadge({ change }: { change: LastChange }) {
  const sourceColor = getSourceColor(change.source);
  const timeAgo = formatTimeAgo(new Date(change.when));

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 ${sourceColor}`}
      title={`${change.what} - ${change.who || change.source} ${timeAgo}`}
    >
      {getSourceIcon(change.source)}
      <span className="text-xs truncate max-w-[80px]">{change.what}</span>
    </span>
  );
}

// Mini indicator
export function LastChangeIndicator({ source }: { source: LastChange['source'] }) {
  const sourceColor = getSourceColor(source);

  return (
    <span
      className={`inline-flex items-center justify-center h-5 w-5 rounded ${sourceColor}`}
      title={`Changed by ${source}`}
    >
      {getSourceIcon(source)}
    </span>
  );
}
