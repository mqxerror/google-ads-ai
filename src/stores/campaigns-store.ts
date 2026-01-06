'use client';

import { create } from 'zustand';
import { Campaign } from '@/types/campaign';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_WASTER_THRESHOLD = 40; // Default AI score threshold for wasters
const STORAGE_KEY_WASTER_THRESHOLD = 'quickads_waster_threshold';
const MAX_ACTIVITIES = 50; // Keep last 50 activities

interface DraftCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  dailyBudget?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type: 'pause' | 'enable' | 'budget_change' | 'negative_keywords' | 'create' | 'bulk_pause' | 'bulk_enable' | 'sync' | 'scan' | 'alert';
  description: string;
  campaignId?: string;
  campaignName?: string;
  details?: Record<string, any>;
  timestamp: number;
  isSystem?: boolean; // System-generated events (syncs, scans, etc.)
}

export interface AdGroup {
  id: string;
  campaignId: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpa: number;
}

export interface Keyword {
  id: string;
  adGroupId: string;
  campaignId: string;
  keyword: string;
  matchType: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  qualityScore: number | null;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpa: number;
}

export type DrilldownLevel = 'campaigns' | 'adGroups' | 'keywords';

interface CampaignsState {
  // Data
  campaigns: Campaign[];
  draftCampaigns: DraftCampaign[];
  activities: Activity[];
  customerId: string;
  isDemo: boolean;

  // Drill-down navigation
  drilldownLevel: DrilldownLevel;
  selectedCampaign: Campaign | null;
  selectedAdGroup: AdGroup | null;
  adGroups: AdGroup[];
  keywords: Keyword[];
  adGroupsLoading: boolean;
  keywordsLoading: boolean;

  // User settings
  wasterThreshold: number; // AI score below this = waster

  // Loading states
  loading: boolean;
  syncing: boolean;
  syncError: string | null;
  syncingDraftId: string | null;
  draftSyncError: string | null;

  // Cache
  lastFetchedAt: number | null;
  cacheKey: string | null;

  // Actions
  setCampaigns: (campaigns: Campaign[]) => void;
  setDraftCampaigns: (drafts: DraftCampaign[]) => void;
  setCustomerId: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;
  setSyncingDraftId: (id: string | null) => void;
  setDraftSyncError: (error: string | null) => void;
  setWasterThreshold: (threshold: number) => void;
  hydrateWasterThreshold: () => void; // Load from localStorage after mount
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp'>) => void;

  // Drill-down actions
  drillIntoCampaign: (campaign: Campaign) => Promise<void>;
  drillIntoAdGroup: (adGroup: AdGroup) => Promise<void>;
  goBack: () => void;
  resetDrilldown: () => void;

  // Cache-aware fetch
  fetchCampaigns: (customerId: string, forceRefresh?: boolean) => Promise<void>;
  fetchDraftCampaigns: () => Promise<void>;

  // Campaign actions
  toggleCampaignStatus: (campaignId: string) => Promise<void>;
  updateCampaignBudget: (campaignId: string, newBudget: number) => Promise<boolean>;
  syncDraftCampaign: (draftId: string) => Promise<boolean>;
  addNegativeKeywords: (keywords: string[], level: 'account' | 'campaign', campaignId?: string, campaignName?: string) => Promise<{ success: boolean; count: number }>;

  // Bulk actions
  pauseMultipleCampaigns: (campaignIds: string[]) => Promise<void>;
  enableMultipleCampaigns: (campaignIds: string[]) => Promise<void>;
}

// Note: We always start with default threshold to avoid hydration mismatch
// The actual localStorage value is loaded via useEffect in components

export const useCampaignsStore = create<CampaignsState>((set, get) => ({
  // Initial state
  campaigns: [],
  draftCampaigns: [],
  activities: [],
  customerId: 'demo',
  isDemo: true,

  // Drill-down state
  drilldownLevel: 'campaigns',
  selectedCampaign: null,
  selectedAdGroup: null,
  adGroups: [],
  keywords: [],
  adGroupsLoading: false,
  keywordsLoading: false,

  wasterThreshold: DEFAULT_WASTER_THRESHOLD, // Always start with default to avoid hydration mismatch
  loading: true,
  syncing: false,
  syncError: null,
  syncingDraftId: null,
  draftSyncError: null,
  lastFetchedAt: null,
  cacheKey: null,

  // Setters
  setCampaigns: (campaigns) => set({ campaigns }),
  setDraftCampaigns: (draftCampaigns) => set({ draftCampaigns }),
  setCustomerId: (customerId) => set({ customerId, isDemo: customerId === 'demo' }),
  setLoading: (loading) => set({ loading }),
  setSyncing: (syncing) => set({ syncing }),
  setSyncError: (syncError) => set({ syncError }),
  setSyncingDraftId: (syncingDraftId) => set({ syncingDraftId }),
  setDraftSyncError: (draftSyncError) => set({ draftSyncError }),
  setWasterThreshold: (wasterThreshold) => {
    set({ wasterThreshold });
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_WASTER_THRESHOLD, wasterThreshold.toString());
    }
  },
  hydrateWasterThreshold: () => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY_WASTER_THRESHOLD);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        set({ wasterThreshold: parsed });
      }
    }
  },
  addActivity: (activity) => {
    const newActivity: Activity = {
      ...activity,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      activities: [newActivity, ...state.activities].slice(0, MAX_ACTIVITIES),
    }));
  },

  // Drill-down navigation
  drillIntoCampaign: async (campaign) => {
    const state = get();
    set({
      drilldownLevel: 'adGroups',
      selectedCampaign: campaign,
      adGroupsLoading: true,
      adGroups: [],
    });

    try {
      const params = new URLSearchParams({
        customerId: state.customerId,
        campaignId: campaign.id,
      });
      const res = await fetch(`/api/google-ads/ad-groups?${params}`);
      const data = await res.json();

      set({
        adGroups: data.adGroups || [],
        adGroupsLoading: false,
      });
    } catch (error) {
      console.error('[CampaignsStore] Error fetching ad groups:', error);
      set({ adGroupsLoading: false });
    }
  },

  drillIntoAdGroup: async (adGroup) => {
    const state = get();
    set({
      drilldownLevel: 'keywords',
      selectedAdGroup: adGroup,
      keywordsLoading: true,
      keywords: [],
    });

    try {
      const params = new URLSearchParams({
        customerId: state.customerId,
        campaignId: state.selectedCampaign?.id || '',
        adGroupId: adGroup.id,
      });
      const res = await fetch(`/api/google-ads/keywords?${params}`);
      const data = await res.json();

      set({
        keywords: data.keywords || [],
        keywordsLoading: false,
      });
    } catch (error) {
      console.error('[CampaignsStore] Error fetching keywords:', error);
      set({ keywordsLoading: false });
    }
  },

  goBack: () => {
    const state = get();
    if (state.drilldownLevel === 'keywords') {
      set({
        drilldownLevel: 'adGroups',
        selectedAdGroup: null,
        keywords: [],
      });
    } else if (state.drilldownLevel === 'adGroups') {
      set({
        drilldownLevel: 'campaigns',
        selectedCampaign: null,
        adGroups: [],
      });
    }
  },

  resetDrilldown: () => {
    set({
      drilldownLevel: 'campaigns',
      selectedCampaign: null,
      selectedAdGroup: null,
      adGroups: [],
      keywords: [],
    });
  },

  // Cache-aware fetch campaigns
  fetchCampaigns: async (customerId, forceRefresh = false) => {
    const state = get();
    const now = Date.now();
    const cacheKey = customerId;

    // Check cache validity
    if (
      !forceRefresh &&
      state.cacheKey === cacheKey &&
      state.lastFetchedAt &&
      now - state.lastFetchedAt < CACHE_DURATION_MS &&
      state.campaigns.length > 0
    ) {
      console.log('[CampaignsStore] Using cached data');
      return;
    }

    set({ loading: true, customerId, isDemo: customerId === 'demo' });

    try {
      const params = new URLSearchParams({ customerId });
      if (forceRefresh) params.append('forceRefresh', 'true');

      const res = await fetch(`/api/google-ads/campaigns?${params}`);
      const data = await res.json();

      set({
        campaigns: data.campaigns || [],
        isDemo: data.isDemo ?? true,
        loading: false,
        lastFetchedAt: now,
        cacheKey,
        syncError: null,
      });
    } catch (error) {
      console.error('[CampaignsStore] Fetch error:', error);
      set({
        loading: false,
        syncError: 'Failed to fetch campaigns',
      });
    }
  },

  // Fetch draft campaigns
  fetchDraftCampaigns: async () => {
    try {
      const res = await fetch('/api/drafts');
      if (res.ok) {
        const data = await res.json();
        set({ draftCampaigns: data.drafts || [] });
      }
    } catch (error) {
      console.error('[CampaignsStore] Draft fetch error:', error);
    }
  },

  // Toggle campaign status
  toggleCampaignStatus: async (campaignId) => {
    const state = get();
    const campaign = state.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return;

    const newStatus = campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED';

    // Optimistic update
    set({
      campaigns: state.campaigns.map((c) =>
        c.id === campaignId ? { ...c, status: newStatus } : c
      ),
    });

    try {
      await fetch('/api/google-ads/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: state.customerId,
          campaignId,
          status: newStatus,
        }),
      });

      // Log activity
      get().addActivity({
        type: newStatus === 'PAUSED' ? 'pause' : 'enable',
        description: `${newStatus === 'PAUSED' ? 'Paused' : 'Enabled'} campaign "${campaign.name}"`,
        campaignId,
        campaignName: campaign.name,
      });
    } catch (error) {
      // Revert on error
      set({
        campaigns: state.campaigns.map((c) =>
          c.id === campaignId ? { ...c, status: campaign.status } : c
        ),
      });
      console.error('[CampaignsStore] Toggle status error:', error);
    }
  },

  // Update campaign budget
  updateCampaignBudget: async (campaignId, newBudget) => {
    const state = get();
    const campaign = state.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return false;

    const oldBudget = campaign.dailyBudget;

    // Optimistic update
    set({
      campaigns: state.campaigns.map((c) =>
        c.id === campaignId ? { ...c, dailyBudget: newBudget } : c
      ),
    });

    try {
      console.log(`[CampaignsStore] Updating budget for campaign ${campaignId} to $${newBudget}`);

      const res = await fetch('/api/google-ads/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: state.customerId,
          campaignId,
          dailyBudget: newBudget,
        }),
      });

      const data = await res.json();
      console.log('[CampaignsStore] Budget update response:', data);

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update budget');
      }

      // Log activity
      get().addActivity({
        type: 'budget_change',
        description: `Changed budget for "${campaign.name}" from $${oldBudget ?? 0} to $${newBudget}/day`,
        campaignId,
        campaignName: campaign.name,
        details: { oldBudget, newBudget },
      });

      // Auto-refresh to get the confirmed value from Google Ads
      console.log('[CampaignsStore] Budget updated, refreshing campaigns...');
      await get().fetchCampaigns(state.customerId, true);

      return true;
    } catch (error) {
      // Revert on error
      set({
        campaigns: state.campaigns.map((c) =>
          c.id === campaignId ? { ...c, dailyBudget: oldBudget } : c
        ),
      });
      console.error('[CampaignsStore] Update budget error:', error);
      return false;
    }
  },

  // Sync draft campaign to Google Ads
  syncDraftCampaign: async (draftId) => {
    set({ syncingDraftId: draftId, draftSyncError: null });

    try {
      const res = await fetch(`/api/drafts/${draftId}/sync`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        set({ draftSyncError: data.error || 'Sync failed', syncingDraftId: null });
        return false;
      }

      // Remove synced draft from list
      const state = get();
      set({
        draftCampaigns: state.draftCampaigns.filter((d) => d.id !== draftId),
        syncingDraftId: null,
      });

      // Refresh campaigns to show new one
      await get().fetchCampaigns(state.customerId, true);
      return true;
    } catch (error) {
      set({ draftSyncError: 'Network error', syncingDraftId: null });
      return false;
    }
  },

  // Add negative keywords
  addNegativeKeywords: async (keywords, level, campaignId, campaignName) => {
    const state = get();

    try {
      const res = await fetch('/api/google-ads/negative-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: state.customerId,
          keywords,
          level,
          campaignId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Log activity
        get().addActivity({
          type: 'negative_keywords',
          description: level === 'campaign' && campaignName
            ? `Added ${data.addedCount} negative keywords to "${campaignName}"`
            : `Added ${data.addedCount} negative keywords (account level)`,
          campaignId,
          campaignName,
          details: { count: data.addedCount, keywords: keywords.slice(0, 5), level },
        });
        return { success: true, count: data.addedCount };
      }

      return { success: false, count: 0 };
    } catch (error) {
      console.error('[CampaignsStore] Add negative keywords error:', error);
      return { success: false, count: 0 };
    }
  },

  // Bulk pause campaigns
  pauseMultipleCampaigns: async (campaignIds) => {
    const state = get();
    const campaignNames = state.campaigns
      .filter((c) => campaignIds.includes(c.id))
      .map((c) => c.name);

    // Optimistic update
    set({
      campaigns: state.campaigns.map((c) =>
        campaignIds.includes(c.id) ? { ...c, status: 'PAUSED' } : c
      ),
    });

    try {
      await Promise.all(
        campaignIds.map((id) =>
          fetch('/api/google-ads/campaigns', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: state.customerId,
              campaignId: id,
              status: 'PAUSED',
            }),
          })
        )
      );

      // Log activity
      get().addActivity({
        type: 'bulk_pause',
        description: `Paused ${campaignIds.length} campaigns`,
        details: { campaignIds, campaignNames },
      });
    } catch (error) {
      console.error('[CampaignsStore] Bulk pause error:', error);
      await get().fetchCampaigns(state.customerId, true);
    }
  },

  // Bulk enable campaigns
  enableMultipleCampaigns: async (campaignIds) => {
    const state = get();
    const campaignNames = state.campaigns
      .filter((c) => campaignIds.includes(c.id))
      .map((c) => c.name);

    // Optimistic update
    set({
      campaigns: state.campaigns.map((c) =>
        campaignIds.includes(c.id) ? { ...c, status: 'ENABLED' } : c
      ),
    });

    try {
      await Promise.all(
        campaignIds.map((id) =>
          fetch('/api/google-ads/campaigns', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: state.customerId,
              campaignId: id,
              status: 'ENABLED',
            }),
          })
        )
      );

      // Log activity
      get().addActivity({
        type: 'bulk_enable',
        description: `Enabled ${campaignIds.length} campaigns`,
        details: { campaignIds, campaignNames },
      });
    } catch (error) {
      console.error('[CampaignsStore] Bulk enable error:', error);
      await get().fetchCampaigns(state.customerId, true);
    }
  },
}));

// Selectors for computed values
export const selectTotalSpend = (state: CampaignsState) =>
  state.campaigns.reduce((sum, c) => sum + (c.spend ?? 0), 0);

export const selectTotalConversions = (state: CampaignsState) =>
  state.campaigns.reduce((sum, c) => sum + (c.conversions ?? 0), 0);

export const selectWasterCampaigns = (state: CampaignsState) =>
  state.campaigns.filter((c) => (c.aiScore ?? 0) < state.wasterThreshold && c.status === 'ENABLED');

export const selectWinnerCampaigns = (state: CampaignsState) =>
  state.campaigns.filter((c) => (c.aiScore ?? 0) >= 70 && c.status === 'ENABLED');

export const selectPotentialSavings = (state: CampaignsState) => {
  const wasters = state.campaigns.filter((c) => (c.aiScore ?? 0) < state.wasterThreshold && c.status === 'ENABLED');
  return wasters.reduce((sum, c) => sum + (c.spend ?? 0), 0);
};

export const selectAvgScore = (state: CampaignsState) => {
  const enabled = state.campaigns.filter((c) => c.status === 'ENABLED');
  if (enabled.length === 0) return 0;
  return Math.round(enabled.reduce((sum, c) => sum + (c.aiScore ?? 0), 0) / enabled.length);
};
