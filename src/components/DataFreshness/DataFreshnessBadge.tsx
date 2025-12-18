'use client';

import { useState } from 'react';
import { formatRelativeTime } from '@/lib/format';

interface DataFreshnessBadgeProps {
  lastSyncedAt: Date | null;
  syncStatus: 'idle' | 'syncing' | 'error' | 'partial';
  dataCompleteness?: number; // 0-100 percentage
  onRefresh?: () => void;
}

export default function DataFreshnessBadge({
  lastSyncedAt,
  syncStatus,
  dataCompleteness = 100,
  onRefresh,
}: DataFreshnessBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Determine badge appearance based on status
  const getStatusConfig = () => {
    if (syncStatus === 'syncing') {
      return {
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-600',
        borderColor: 'border-blue-200',
        icon: (
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ),
        label: 'Syncing...',
      };
    }

    if (syncStatus === 'error') {
      return {
        bgColor: 'bg-rose-50',
        textColor: 'text-rose-600',
        borderColor: 'border-rose-200',
        icon: (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        label: 'Sync failed',
      };
    }

    if (syncStatus === 'partial' || dataCompleteness < 100) {
      return {
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-600',
        borderColor: 'border-amber-200',
        icon: (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        label: `Partial data (${dataCompleteness}%)`,
      };
    }

    // Default: healthy/idle
    return {
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-200',
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      label: lastSyncedAt ? formatRelativeTime(lastSyncedAt) : 'Ready',
    };
  };

  const config = getStatusConfig();

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${config.bgColor} ${config.textColor} ${config.borderColor} hover:opacity-90`}
      >
        {config.icon}
        <span>{config.label}</span>
      </button>

      {/* Details Popover */}
      {showDetails && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDetails(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h4 className="text-sm font-semibold text-slate-900">
              Data Status
            </h4>

            <div className="mt-3 space-y-3">
              {/* Last Sync */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Last sync</span>
                <span className="font-medium text-slate-900">
                  {lastSyncedAt ? formatRelativeTime(lastSyncedAt) : 'Never'}
                </span>
              </div>

              {/* Data Completeness */}
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Completeness</span>
                  <span className="font-medium text-slate-900">
                    {dataCompleteness}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dataCompleteness >= 90
                        ? 'bg-emerald-500'
                        : dataCompleteness >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${dataCompleteness}%` }}
                  />
                </div>
              </div>

              {/* Sync Status */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <span className={`flex items-center gap-1 font-medium ${config.textColor}`}>
                  <span className={`h-2 w-2 rounded-full ${
                    syncStatus === 'idle' ? 'bg-emerald-500' :
                    syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' :
                    syncStatus === 'error' ? 'bg-rose-500' : 'bg-amber-500'
                  }`} />
                  {syncStatus === 'idle' ? 'Up to date' :
                   syncStatus === 'syncing' ? 'Syncing...' :
                   syncStatus === 'error' ? 'Error' : 'Partial'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              {onRefresh && (
                <button
                  onClick={() => {
                    onRefresh();
                    setShowDetails(false);
                  }}
                  disabled={syncStatus === 'syncing'}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Now
                </button>
              )}
              <button
                onClick={() => setShowDetails(false)}
                className="rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            {/* Help text */}
            <p className="mt-3 text-[11px] text-slate-500">
              Data syncs every 15 minutes from Google Ads API. Daily breakdown may take longer.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
