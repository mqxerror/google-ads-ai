'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useShallow } from 'zustand/react/shallow';
import {
  useCampaignsStore,
  selectTotalSpend,
  selectTotalConversions,
  selectPotentialSavings,
  selectAvgScore,
} from '@/stores/campaigns-store';

interface GoogleAdsAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode?: string;
}

/**
 * Main hook for campaigns data with automatic fetching and caching
 */
export function useCampaigns() {
  const { data: session, status } = useSession();
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const {
    customerId,
    setCustomerId,
    fetchCampaigns,
    fetchDraftCampaigns,
  } = useCampaignsStore();

  // Fetch accounts on auth
  useEffect(() => {
    async function loadAccounts() {
      if (status !== 'authenticated') {
        setAccountsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/google-ads/accounts');
        if (res.ok) {
          const data = await res.json();
          setAccounts(data.accounts || []);

          // Auto-select first account or restore from localStorage
          const savedCustomerId = localStorage.getItem('quickads_customerId');
          const accountIds = (data.accounts || []).map((a: GoogleAdsAccount) => a.customerId);

          if (savedCustomerId && accountIds.includes(savedCustomerId)) {
            setCustomerId(savedCustomerId);
          } else if (accountIds.length > 0) {
            setCustomerId(accountIds[0]);
          }
        }
      } catch (error) {
        console.error('[useCampaigns] Error fetching accounts:', error);
      } finally {
        setAccountsLoading(false);
      }
    }

    loadAccounts();
  }, [status, setCustomerId]);

  // Fetch campaigns when customerId changes
  useEffect(() => {
    if (customerId) {
      fetchCampaigns(customerId);
      fetchDraftCampaigns();

      // Save to localStorage
      if (customerId !== 'demo') {
        localStorage.setItem('quickads_customerId', customerId);
      }
    }
  }, [customerId, fetchCampaigns, fetchDraftCampaigns]);

  return {
    accounts,
    accountsLoading,
    isAuthenticated: status === 'authenticated',
  };
}

/**
 * Hook for dashboard statistics
 * Uses useShallow for array selectors to prevent infinite loops
 */
export function useDashboardStats() {
  // Primitive selectors (safe without shallow)
  const totalSpend = useCampaignsStore(selectTotalSpend);
  const totalConversions = useCampaignsStore(selectTotalConversions);
  const avgScore = useCampaignsStore(selectAvgScore);
  const potentialSavings = useCampaignsStore(selectPotentialSavings);

  // Get campaigns and threshold, derive counts in useMemo to avoid infinite loops
  const campaigns = useCampaignsStore(useShallow((state) => state.campaigns));
  const wasterThreshold = useCampaignsStore((state) => state.wasterThreshold);

  const stats = useMemo(() => {
    const activeCampaigns = campaigns.filter((c) => c.status === 'ENABLED');
    const wasters = campaigns.filter((c) => (c.aiScore ?? 0) < wasterThreshold && c.status === 'ENABLED');
    const winners = campaigns.filter((c) => (c.aiScore ?? 0) >= 70 && c.status === 'ENABLED');

    return {
      activeCampaigns,
      wasters,
      winners,
      campaignCount: campaigns.length,
      activeCampaignCount: activeCampaigns.length,
      wasterCount: wasters.length,
      winnerCount: winners.length,
      wasterThreshold,
    };
  }, [campaigns, wasterThreshold]);

  return {
    totalSpend,
    totalConversions,
    avgScore,
    potentialSavings,
    ...stats,
  };
}

/**
 * Hook for campaign selection (bulk actions)
 */
export function useCampaignSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = (ids: string[]) => {
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isSelected = (id: string) => selectedIds.has(id);

  return {
    selectedIds: Array.from(selectedIds),
    selectedCount: selectedIds.size,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
  };
}
