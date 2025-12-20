'use client';

import { useState, useEffect, useMemo } from 'react';
import { AdGroup } from '@/types/campaign';
import { useAccount } from '@/contexts/AccountContext';
import { useDrillDown } from '@/contexts/DrillDownContext';
import { useDetailPanel } from '@/contexts/DetailPanelContext';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import GridSkeleton from './GridSkeleton';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { AdEditor } from '@/components/AdEditor';
import { formatCurrency, formatNumber } from '@/lib/format';
import { validateHierarchy, ValidationResult } from '@/lib/validation/hierarchy-validator';
import HierarchyValidationBanner from '@/components/DataConsistency/HierarchyValidationBanner';

function StatusBadge({ status }: { status: string }) {
  const colors = {
    ENABLED: 'bg-green-100 text-green-800',
    PAUSED: 'bg-yellow-100 text-yellow-800',
    REMOVED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

export default function AdGroupsGrid() {
  const { currentAccount } = useAccount();
  const { selectedCampaign, drillIntoAdGroup } = useDrillDown();
  const { openPanel } = useDetailPanel();
  const { dateRange } = useCampaignsData();
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdEditorOpen, setIsAdEditorOpen] = useState(false);
  const [selectedAdGroupId, setSelectedAdGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentAccount?.id || !selectedCampaign?.id) {
      setAdGroups([]);
      setIsLoading(false);
      return;
    }

    const fetchAdGroups = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Include date range for consistent metrics across all entity levels
        const params = new URLSearchParams({
          accountId: currentAccount.id,
          campaignId: selectedCampaign.id,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
        const response = await fetch(`/api/google-ads/ad-groups?${params}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch ad groups');
        }

        const data = await response.json();
        setAdGroups(data.adGroups || []);
      } catch (err) {
        console.error('Error fetching ad groups:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch ad groups');
        setAdGroups([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdGroups();
  }, [currentAccount?.id, selectedCampaign?.id, dateRange.startDate, dateRange.endDate]);

  // Check if date range includes today (partial data)
  const isPartialData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return dateRange.endDate >= today;
  }, [dateRange.endDate]);

  // Validate hierarchy: campaign metrics vs sum of ad group metrics
  const hierarchyValidation: ValidationResult | null = useMemo(() => {
    if (!selectedCampaign || adGroups.length === 0) return null;

    // Use only fields available on both Campaign and AdGroup types
    const parentMetrics = {
      impressions: selectedCampaign.impressions || 0,
      clicks: selectedCampaign.clicks || 0,
      cost: selectedCampaign.spend || 0,
      conversions: selectedCampaign.conversions || 0,
    };

    const childMetrics = adGroups.map(ag => ({
      impressions: ag.impressions || 0,
      clicks: ag.clicks || 0,
      cost: ag.spend || 0,
      conversions: ag.conversions || 0,
    }));

    return validateHierarchy(parentMetrics, childMetrics, {
      parentName: selectedCampaign.name,
      childrenName: 'Ad Groups',
      isPartialData,
    });
  }, [selectedCampaign, adGroups, isPartialData]);

  // Determine if this is initial load (no cached data)
  const isInitialLoad = isLoading && adGroups.length === 0;

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

  if (adGroups.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <div className="flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">No Ad Groups Found</h3>
          <p className="max-w-sm text-sm text-gray-500">
            This campaign doesn&apos;t have any ad groups yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      {/* Loading overlay for refetch - shows over existing data */}
      {isLoading && adGroups.length > 0 && (
        <LoadingOverlay message="Refreshing ad groups..." opacity={70} />
      )}

      {/* Hierarchy validation banner */}
      <HierarchyValidationBanner
        validation={hierarchyValidation}
        parentName={selectedCampaign?.name || 'Campaign'}
        childrenName="Ad Groups"
        isPartialData={isPartialData}
      />

      <table className="w-full min-w-[800px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              Ad Group
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
              Clicks
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
              Conversions
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
              Spend
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
              CPA
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {adGroups.map((adGroup) => (
            <tr
              key={adGroup.id}
              className="group hover:bg-blue-50 cursor-pointer"
              onClick={() => drillIntoAdGroup(adGroup)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 group-hover:text-blue-600">
                    {adGroup.name}
                  </span>
                  <svg className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <div className="text-xs text-gray-500">ID: {adGroup.id}</div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={adGroup.status} />
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {formatNumber(adGroup.clicks)}
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {formatNumber(adGroup.conversions, { decimals: 1 })}
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {formatCurrency(adGroup.spend)}
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {adGroup.cpa > 0 ? formatCurrency(adGroup.cpa) : '-'}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAdGroupId(adGroup.id);
                      setIsAdEditorOpen(true);
                    }}
                    className="rounded-lg bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                  >
                    + Ad
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPanel(adGroup, 'adGroup');
                    }}
                    className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      drillIntoAdGroup(adGroup);
                    }}
                    className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                  >
                    Keywords
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Ad Editor Modal */}
      <AdEditor
        isOpen={isAdEditorOpen}
        onClose={() => {
          setIsAdEditorOpen(false);
          setSelectedAdGroupId(null);
        }}
        adGroupId={selectedAdGroupId || undefined}
      />
    </div>
  );
}
