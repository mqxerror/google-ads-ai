'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useDrillDown } from '@/contexts/DrillDownContext';
import { useDetailPanel } from '@/contexts/DetailPanelContext';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import GridSkeleton from './GridSkeleton';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { AdEditor } from '@/components/AdEditor';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';

interface Ad {
  id: string;
  adGroupId: string;
  type: 'RESPONSIVE_SEARCH_AD' | 'EXPANDED_TEXT_AD' | 'RESPONSIVE_DISPLAY_AD' | 'VIDEO_AD';
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
  clicks: number;
  impressions: number;
  conversions: number;
  spend: number;
  ctr: number;
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    ENABLED: 'bg-green-100 text-green-800',
    PAUSED: 'bg-yellow-100 text-yellow-800',
    REMOVED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {status === 'ENABLED' ? 'Active' : status}
    </span>
  );
}

function AdTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    RESPONSIVE_SEARCH_AD: 'RSA',
    EXPANDED_TEXT_AD: 'ETA',
    RESPONSIVE_DISPLAY_AD: 'RDA',
    VIDEO_AD: 'Video',
  };
  const colors: Record<string, string> = {
    RESPONSIVE_SEARCH_AD: 'bg-blue-100 text-blue-800',
    EXPANDED_TEXT_AD: 'bg-purple-100 text-purple-800',
    RESPONSIVE_DISPLAY_AD: 'bg-green-100 text-green-800',
    VIDEO_AD: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
      {labels[type] || type}
    </span>
  );
}

export default function AdsGrid() {
  const { currentAccount } = useAccount();
  const { selectedAdGroup } = useDrillDown();
  const { openPanel } = useDetailPanel();
  const { dateRange } = useCampaignsData();
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdEditorOpen, setIsAdEditorOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);

  const loadAds = useCallback(async () => {
    if (!currentAccount?.id || !selectedAdGroup?.id) {
      setAds([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      // Include date range for consistent metrics across all entity levels
      const params = new URLSearchParams({
        accountId: currentAccount.id,
        adGroupId: selectedAdGroup.id,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const response = await fetch(`/api/google-ads/ads?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch ads');
      }

      const data = await response.json();
      setAds(data.ads || []);
    } catch (err) {
      console.error('Error fetching ads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ads');
      setAds([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount?.id, selectedAdGroup?.id, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Determine if this is initial load (no cached data)
  const isInitialLoad = isLoading && ads.length === 0;

  if (isInitialLoad) {
    return <GridSkeleton />;
  }

  if (error) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <>
        <div className="px-4 py-16 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No Ads Found</h3>
            <p className="max-w-sm text-sm text-gray-500 mb-4">
              This ad group doesn&apos;t have any ads yet.
            </p>
            <button
              onClick={() => setIsAdEditorOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Create Ad
            </button>
          </div>
        </div>
        <AdEditor
          isOpen={isAdEditorOpen}
          onClose={() => setIsAdEditorOpen(false)}
          adGroupId={selectedAdGroup?.id}
        />
      </>
    );
  }

  return (
    <div className="relative">
      {/* Loading overlay for refetch - shows over existing data */}
      {isLoading && ads.length > 0 && (
        <LoadingOverlay message="Refreshing ads..." opacity={70} />
      )}
      {/* Header with Create Ad button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600">
          {ads.length} ad{ads.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => setIsAdEditorOpen(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create Ad
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Ad
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Impressions
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Clicks
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                CTR
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Conversions
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Spend
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ads.map((ad) => (
              <tr key={ad.id} className="group hover:bg-blue-50">
                <td className="px-4 py-3">
                  <div className="max-w-xs">
                    <div className="font-medium text-gray-900 truncate">
                      {ad.headlines[0] || 'Untitled Ad'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {ad.descriptions[0] || 'No description'}
                    </div>
                    <div className="text-xs text-gray-400">
                      ID: {ad.id}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <AdTypeBadge type={ad.type} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={ad.status} />
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatNumber(ad.impressions)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatNumber(ad.clicks)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatPercent(ad.ctr)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatNumber(ad.conversions, { decimals: 1 })}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatCurrency(ad.spend)}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setEditingAd(ad);
                        setIsAdEditorOpen(true);
                      }}
                      className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      className={`rounded-lg px-3 py-1 text-xs font-medium ${
                        ad.status === 'ENABLED'
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {ad.status === 'ENABLED' ? 'Pause' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ad Editor Modal */}
      <AdEditor
        isOpen={isAdEditorOpen}
        onClose={() => {
          setIsAdEditorOpen(false);
          setEditingAd(null);
        }}
        adGroupId={selectedAdGroup?.id}
      />
    </div>
  );
}
