'use client';

import { useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';

interface DataHealthStatus {
  status: 'healthy' | 'partial' | 'stale' | 'error';
  daysAvailable: number;
  totalDays: number;
  lastSync: Date;
  conversionLag?: number;
  issues: DataIssue[];
}

interface DataIssue {
  type: 'missing_days' | 'conversion_lag' | 'api_delay' | 'tracking_gap';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detail?: string;
}

// Mock data health - in production this would come from an API
function useDataHealth(): DataHealthStatus {
  return {
    status: 'partial',
    daysAvailable: 4,
    totalDays: 5,
    lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    conversionLag: 24,
    issues: [
      {
        type: 'missing_days',
        severity: 'warning',
        message: 'Yesterday\'s data incomplete',
        detail: 'Google Ads API reported partial data for Dec 17. Full data typically available within 24h.',
      },
      {
        type: 'conversion_lag',
        severity: 'info',
        message: '24-hour conversion attribution window',
        detail: 'Some conversions may not yet be attributed. Final numbers available after attribution window closes.',
      },
    ],
  };
}

export default function DataHealthBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentAccount } = useAccount();
  const health = useDataHealth();

  const statusConfig = {
    healthy: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      label: 'Data Complete',
    },
    partial: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      label: 'Partial Data',
    },
    stale: {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      dot: 'bg-orange-500',
      label: 'Stale Data',
    },
    error: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
      label: 'Sync Error',
    },
  };

  const config = statusConfig[health.status];

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m ago`;
    return `${minutes}m ago`;
  };

  return (
    <div className="relative">
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} ${config.text} hover:shadow-sm transition-all`}
      >
        <span className={`w-2 h-2 rounded-full ${config.dot} ${health.status === 'partial' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium">{config.label}</span>
        <span className="text-xs opacity-75">
          {health.daysAvailable}/{health.totalDays} days
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-96 z-50 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${config.dot}`} />
                  <span className="font-semibold text-gray-900">{config.label}</span>
                </div>
                <span className="text-xs text-gray-500">
                  Last sync: {formatTime(health.lastSync)}
                </span>
              </div>
            </div>

            {/* Data Summary */}
            <div className="p-4 border-b border-gray-100">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{health.daysAvailable}</div>
                  <div className="text-xs text-gray-500">Days Available</div>
                </div>
                <div className="text-center border-x border-gray-100">
                  <div className="text-2xl font-bold text-gray-900">{health.totalDays - health.daysAvailable}</div>
                  <div className="text-xs text-gray-500">Days Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{health.conversionLag}h</div>
                  <div className="text-xs text-gray-500">Conv. Lag</div>
                </div>
              </div>
            </div>

            {/* Issues List */}
            <div className="p-4 space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data Notes</h4>
              {health.issues.map((issue, index) => (
                <div
                  key={index}
                  className={`rounded-lg p-3 ${
                    issue.severity === 'critical' ? 'bg-rose-50 border border-rose-200' :
                    issue.severity === 'warning' ? 'bg-amber-50 border border-amber-200' :
                    'bg-slate-50 border border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {issue.severity === 'critical' ? (
                      <svg className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : issue.severity === 'warning' ? (
                      <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        issue.severity === 'critical' ? 'text-rose-800' :
                        issue.severity === 'warning' ? 'text-amber-800' :
                        'text-slate-700'
                      }`}>
                        {issue.message}
                      </p>
                      {issue.detail && (
                        <p className="text-xs text-gray-500 mt-1">{issue.detail}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Account: {currentAccount?.accountName || 'Demo Account'}
                </span>
                <button className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
