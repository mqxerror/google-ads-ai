/**
 * useComparisonData Hook
 *
 * Fetches comparison data for campaigns when compare mode is enabled.
 * Returns a map of campaignId -> comparison data.
 */

import { useState, useEffect, useCallback } from 'react';
import { useCompareMode } from '@/contexts/CompareModeContext';
import { CampaignComparison } from '@/types/campaign';

interface UseComparisonDataParams {
  accountId: string | null;
  startDate: string;
  endDate: string;
}

interface ComparisonResponse {
  success: boolean;
  comparisons: Array<{
    campaignId: string;
    comparison: CampaignComparison;
  }>;
  currentPeriod: { start: string; end: string; days: number };
  comparePeriod: { start: string; end: string; days: number };
}

export function useComparisonData({ accountId, startDate, endDate }: UseComparisonDataParams) {
  const { isCompareMode } = useCompareMode();
  const [comparisonMap, setComparisonMap] = useState<Map<string, CampaignComparison>>(new Map());
  const [comparePeriod, setComparePeriod] = useState<{ start: string; end: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    if (!accountId || !startDate || !endDate) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        accountId,
        startDate,
        endDate,
      });

      const res = await fetch(`/api/google-ads/campaigns/compare?${params}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch comparison data');
      }

      const data: ComparisonResponse = await res.json();

      // Build map
      const map = new Map<string, CampaignComparison>();
      for (const item of data.comparisons) {
        map.set(item.campaignId, item.comparison);
      }
      setComparisonMap(map);
      setComparePeriod(data.comparePeriod);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comparison data');
      setComparisonMap(new Map());
      setComparePeriod(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, startDate, endDate]);

  // Fetch when compare mode is enabled and we have valid params
  useEffect(() => {
    if (isCompareMode && accountId && startDate && endDate) {
      fetchComparison();
    } else if (!isCompareMode) {
      // Clear data when compare mode is disabled
      setComparisonMap(new Map());
      setComparePeriod(null);
    }
  }, [isCompareMode, accountId, startDate, endDate, fetchComparison]);

  return {
    comparisonMap,
    comparePeriod,
    isLoading,
    error,
    refetch: fetchComparison,
  };
}
