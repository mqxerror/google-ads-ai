'use client';

import { useState, useEffect } from 'react';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { useDrillDown } from '@/contexts/DrillDownContext';
import { useAccount } from '@/contexts/AccountContext';

export default function QueryDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showActual, setShowActual] = useState(true); // Toggle between expected/actual
  const { dateRange, lastSyncedAt, syncStatus, lastApiResponse } = useCampaignsData();
  const { currentLevel, selectedCampaign, selectedAdGroup } = useDrillDown();
  const { currentAccount } = useAccount();

  // Handle hydration - only check localStorage after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Always show in development, or when explicitly enabled via localStorage
  const showDebug = process.env.NODE_ENV === 'development' ||
    (mounted && typeof window !== 'undefined' && localStorage.getItem('showQueryDebug') === 'true');

  if (!showDebug) return null;

  const getQueryInfo = () => {
    const baseInfo = {
      customerId: currentAccount?.googleAccountId || 'N/A',
      accountName: currentAccount?.accountName || 'N/A',
      dateRange: `${dateRange.startDate} to ${dateRange.endDate}`,
      lastSynced: lastSyncedAt?.toLocaleString() || 'Never',
      syncStatus,
    };

    if (currentLevel === 'campaigns') {
      return {
        ...baseInfo,
        entity: 'Campaigns',
        gaqlQuery: `
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
ORDER BY metrics.cost_micros DESC
        `.trim(),
      };
    }

    if (currentLevel === 'adGroups' && selectedCampaign) {
      return {
        ...baseInfo,
        entity: 'Ad Groups',
        parentCampaign: selectedCampaign.name,
        parentCampaignId: selectedCampaign.id,
        gaqlQuery: `
SELECT
  ad_group.id,
  ad_group.name,
  ad_group.status,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.cost_micros
FROM ad_group
WHERE ad_group.campaign = 'customers/${currentAccount?.googleAccountId}/campaigns/${selectedCampaign.id}'
  AND ad_group.status != 'REMOVED'
  AND segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
ORDER BY metrics.cost_micros DESC
        `.trim(),
      };
    }

    if (currentLevel === 'keywords' && selectedAdGroup) {
      return {
        ...baseInfo,
        entity: 'Keywords',
        parentAdGroup: selectedAdGroup.name,
        parentAdGroupId: selectedAdGroup.id,
        gaqlQuery: `
SELECT
  ad_group_criterion.criterion_id,
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  ad_group_criterion.status,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.cost_micros
FROM keyword_view
WHERE ad_group_criterion.ad_group = 'customers/${currentAccount?.googleAccountId}/adGroups/${selectedAdGroup.id}'
  AND ad_group_criterion.status != 'REMOVED'
  AND segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
ORDER BY metrics.cost_micros DESC
        `.trim(),
      };
    }

    return baseInfo;
  };

  const info = getQueryInfo();

  // Get actual API response data for current level
  const getActualApiData = () => {
    if (currentLevel === 'campaigns' && lastApiResponse.campaigns) {
      return lastApiResponse.campaigns;
    }
    if (currentLevel === 'adGroups' && lastApiResponse.adGroups) {
      return lastApiResponse.adGroups;
    }
    if (currentLevel === 'keywords' && lastApiResponse.keywords) {
      return lastApiResponse.keywords;
    }
    return null;
  };

  const actualData = getActualApiData();

  // Check if expected vs actual date ranges match
  const dateRangeMatch = actualData
    ? actualData.startDate === dateRange.startDate && actualData.endDate === dateRange.endDate
    : null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white shadow-lg hover:bg-slate-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        {isOpen ? 'Hide' : 'Show'} Query Debug
        {actualData && !dateRangeMatch && (
          <span className="rounded-full bg-red-500 px-1.5 text-xs">!</span>
        )}
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-[700px] max-h-[70vh] overflow-auto rounded-lg bg-slate-900 p-4 text-sm text-white shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-emerald-400">GAQL Query Debug</h3>
            <div className="flex items-center gap-2">
              {/* Toggle between Expected/Actual */}
              <div className="flex rounded-lg bg-slate-800 p-0.5">
                <button
                  onClick={() => setShowActual(false)}
                  className={`rounded px-2 py-1 text-xs font-medium transition ${
                    !showActual ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Expected
                </button>
                <button
                  onClick={() => setShowActual(true)}
                  className={`rounded px-2 py-1 text-xs font-medium transition ${
                    showActual ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Actual API
                </button>
              </div>
              <div className={`rounded px-2 py-0.5 text-xs font-medium ${
                syncStatus === 'idle' ? 'bg-green-500/20 text-green-400' :
                syncStatus === 'syncing' ? 'bg-blue-500/20 text-blue-400' :
                syncStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {syncStatus}
              </div>
            </div>
          </div>

          {/* Date Range Match Warning */}
          {actualData && !dateRangeMatch && (
            <div className="mb-4 rounded border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-300">
              <strong>DATE RANGE MISMATCH!</strong>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-red-400">UI expects:</span>{' '}
                  <code className="bg-slate-800 px-1 rounded">{dateRange.startDate} → {dateRange.endDate}</code>
                </div>
                <div>
                  <span className="text-red-400">API returned:</span>{' '}
                  <code className="bg-slate-800 px-1 rounded">{actualData.startDate} → {actualData.endDate}</code>
                </div>
              </div>
            </div>
          )}

          {/* Actual API Response Data (when showActual is true) */}
          {showActual && actualData && (
            <div className="mb-4 rounded border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="mb-2 text-xs font-medium text-emerald-400">
                Actual API Response (_meta)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Customer ID:</span>{' '}
                  <code className="bg-slate-800 px-1 rounded text-white">{actualData.customerId}</code>
                </div>
                <div>
                  <span className="text-slate-400">Date Range:</span>{' '}
                  <code className="bg-slate-800 px-1 rounded text-emerald-300">
                    {actualData.startDate} → {actualData.endDate}
                  </code>
                </div>
                {actualData.campaignId && (
                  <div>
                    <span className="text-slate-400">Campaign ID:</span>{' '}
                    <code className="bg-slate-800 px-1 rounded text-white">{actualData.campaignId}</code>
                  </div>
                )}
                {actualData.adGroupId && (
                  <div>
                    <span className="text-slate-400">Ad Group ID:</span>{' '}
                    <code className="bg-slate-800 px-1 rounded text-white">{actualData.adGroupId}</code>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-slate-400">Executed At:</span>{' '}
                  <code className="bg-slate-800 px-1 rounded text-slate-300">
                    {new Date(actualData.executedAt).toLocaleString()}
                  </code>
                </div>
              </div>
            </div>
          )}

          {showActual && !actualData && (
            <div className="mb-4 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-300">
              <strong>No API response captured yet.</strong> Refresh the data to see actual query parameters from the API.
            </div>
          )}

          {/* Info Grid */}
          <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-slate-800 p-2">
              <div className="text-slate-400">Account</div>
              <div className="font-mono text-white">{info.accountName}</div>
              <div className="font-mono text-slate-500">{info.customerId}</div>
            </div>
            <div className="rounded bg-slate-800 p-2">
              <div className="text-slate-400">UI Date Range {showActual && '(expected)'}</div>
              <div className="font-mono text-emerald-400">{info.dateRange}</div>
              {dateRange.preset && (
                <div className="text-slate-500">Preset: {dateRange.preset}</div>
              )}
            </div>
            <div className="rounded bg-slate-800 p-2">
              <div className="text-slate-400">Current View</div>
              <div className="font-mono text-white">{'entity' in info ? info.entity : currentLevel}</div>
            </div>
            <div className="rounded bg-slate-800 p-2">
              <div className="text-slate-400">Last Synced</div>
              <div className="font-mono text-white">{info.lastSynced}</div>
            </div>
            {'parentCampaign' in info && (
              <div className="col-span-2 rounded bg-slate-800 p-2">
                <div className="text-slate-400">Parent Campaign</div>
                <div className="font-mono text-white">{info.parentCampaign}</div>
                <div className="font-mono text-slate-500">ID: {info.parentCampaignId}</div>
              </div>
            )}
            {'parentAdGroup' in info && (
              <div className="col-span-2 rounded bg-slate-800 p-2">
                <div className="text-slate-400">Parent Ad Group</div>
                <div className="font-mono text-white">{info.parentAdGroup}</div>
                <div className="font-mono text-slate-500">ID: {info.parentAdGroupId}</div>
              </div>
            )}
          </div>

          {/* GAQL Query */}
          {'gaqlQuery' in info && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-slate-400">
                  GAQL Query ({showActual ? 'based on actual API params' : 'expected'})
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(info.gaqlQuery);
                  }}
                  className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                >
                  Copy
                </button>
              </div>
              <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-emerald-300">
                {info.gaqlQuery}
              </pre>
            </div>
          )}

          {/* Data Consistency Check */}
          {dateRangeMatch === true && (
            <div className="mt-4 rounded border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
              <strong>Date ranges match.</strong> UI expected dates match actual API query dates.
            </div>
          )}

          {/* Instructions */}
          <div className="mt-3 text-xs text-slate-500">
            <div>Toggle &quot;Actual API&quot; to see the real query parameters returned from the server.</div>
            <div className="mt-1">
              To enable in production: <code className="bg-slate-800 px-1 rounded">localStorage.setItem(&apos;showQueryDebug&apos;, &apos;true&apos;)</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
