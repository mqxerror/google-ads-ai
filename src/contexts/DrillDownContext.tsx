'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { Campaign, AdGroup, Keyword } from '@/types/campaign';

export type EntityType = 'campaigns' | 'adGroups' | 'keywords';

export interface BreadcrumbItem {
  type: EntityType;
  id?: string;
  name: string;
}

interface DrillDownContextType {
  // Current view level
  currentLevel: EntityType;

  // Selected entities for drill-down
  selectedCampaign: Campaign | null;
  selectedAdGroup: AdGroup | null;

  // Breadcrumb trail
  breadcrumbs: BreadcrumbItem[];

  // Navigation actions
  drillIntoCampaign: (campaign: Campaign) => void;
  drillIntoAdGroup: (adGroup: AdGroup) => void;
  navigateToBreadcrumb: (index: number) => void;
  goBack: () => void;
  resetToRoot: () => void;
}

const DrillDownContext = createContext<DrillDownContextType | undefined>(undefined);

const DRILLDOWN_STATE_KEY = 'drilldown-state';

interface SavedDrillDownState {
  currentLevel: EntityType;
  selectedCampaign: Campaign | null;
  selectedAdGroup: AdGroup | null;
  breadcrumbs: BreadcrumbItem[];
}

// Helper to save state to sessionStorage (sessionStorage so it clears on browser close)
function saveDrillDownState(state: SavedDrillDownState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DRILLDOWN_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

// Helper to load state from sessionStorage
function loadDrillDownState(): SavedDrillDownState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem(DRILLDOWN_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Get initial state from sessionStorage (SSR-safe)
function getInitialState(): SavedDrillDownState {
  const defaultState: SavedDrillDownState = {
    currentLevel: 'campaigns',
    selectedCampaign: null,
    selectedAdGroup: null,
    breadcrumbs: [{ type: 'campaigns', name: 'Campaigns' }],
  };

  const saved = loadDrillDownState();
  return saved || defaultState;
}

export function DrillDownProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const initialState = getInitialState();
  const [currentLevel, setCurrentLevel] = useState<EntityType>(initialState.currentLevel);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(initialState.selectedCampaign);
  const [selectedAdGroup, setSelectedAdGroup] = useState<AdGroup | null>(initialState.selectedAdGroup);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>(initialState.breadcrumbs);

  // Use refs to prevent loops and track state
  const isInitializedRef = useRef(false);
  const isUpdatingUrlRef = useRef(false);

  // Restore state from URL on initial mount only (runs once)
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const view = searchParams.get('view');
    const campaignId = searchParams.get('campaignId');
    const adGroupId = searchParams.get('adGroupId');

    // If URL has drill-down params, restore from URL + sessionStorage labels
    if (view && campaignId) {
      const savedState = loadDrillDownState();

      if (view === 'adgroups' || view === 'adGroups') {
        // Restore ad groups view
        const campaignName = savedState?.selectedCampaign?.name || 'Campaign';
        const campaign = savedState?.selectedCampaign?.id === campaignId
          ? savedState.selectedCampaign
          : { id: campaignId, name: campaignName } as Campaign;

        setSelectedCampaign(campaign);
        setSelectedAdGroup(null);
        setCurrentLevel('adGroups');
        setBreadcrumbs([
          { type: 'campaigns', name: 'Campaigns' },
          { type: 'adGroups', id: campaignId, name: campaign.name }
        ]);
      } else if ((view === 'keywords' || view === 'ads') && adGroupId) {
        // Restore keywords/ads view
        const campaignName = savedState?.selectedCampaign?.name || 'Campaign';
        const adGroupName = savedState?.selectedAdGroup?.name || 'Ad Group';

        const campaign = savedState?.selectedCampaign?.id === campaignId
          ? savedState.selectedCampaign
          : { id: campaignId, name: campaignName } as Campaign;
        const adGroup = savedState?.selectedAdGroup?.id === adGroupId
          ? savedState.selectedAdGroup
          : { id: adGroupId, name: adGroupName } as AdGroup;

        setSelectedCampaign(campaign);
        setSelectedAdGroup(adGroup);
        setCurrentLevel('keywords');
        setBreadcrumbs([
          { type: 'campaigns', name: 'Campaigns' },
          { type: 'adGroups', id: campaignId, name: campaign.name },
          { type: 'keywords', id: adGroupId, name: adGroup.name }
        ]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Helper to update URL - uses window.history to avoid React re-renders
  const updateUrlSilently = useCallback((level: EntityType, campaign: Campaign | null, adGroup: AdGroup | null) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();

    if (level === 'adGroups' && campaign) {
      params.set('view', 'adgroups');
      params.set('campaignId', campaign.id);
    } else if (level === 'keywords' && campaign && adGroup) {
      params.set('view', 'keywords');
      params.set('campaignId', campaign.id);
      params.set('adGroupId', adGroup.id);
    }

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    // Use window.history directly to avoid triggering React navigation
    window.history.replaceState(null, '', newUrl);
  }, [pathname]);

  // Save state to sessionStorage whenever it changes (for labels/data)
  useEffect(() => {
    if (!isInitializedRef.current) return;

    saveDrillDownState({
      currentLevel,
      selectedCampaign,
      selectedAdGroup,
      breadcrumbs,
    });
  }, [currentLevel, selectedCampaign, selectedAdGroup, breadcrumbs]);

  const drillIntoCampaign = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setSelectedAdGroup(null);
    setCurrentLevel('adGroups');
    setBreadcrumbs([
      { type: 'campaigns', name: 'Campaigns' },
      { type: 'adGroups', id: campaign.id, name: campaign.name }
    ]);
    // Update URL silently after state change
    updateUrlSilently('adGroups', campaign, null);
  }, [updateUrlSilently]);

  const drillIntoAdGroup = useCallback((adGroup: AdGroup) => {
    setSelectedAdGroup(adGroup);
    setCurrentLevel('keywords');
    setBreadcrumbs(prev => [
      ...prev.slice(0, 2),
      { type: 'keywords', id: adGroup.id, name: adGroup.name }
    ]);
    // Update URL silently after state change - need selectedCampaign from closure
  }, []);

  // Separate effect to update URL for drillIntoAdGroup (needs selectedCampaign)
  const drillIntoAdGroupWithUrl = useCallback((adGroup: AdGroup) => {
    drillIntoAdGroup(adGroup);
    updateUrlSilently('keywords', selectedCampaign, adGroup);
  }, [drillIntoAdGroup, selectedCampaign, updateUrlSilently]);

  const navigateToBreadcrumb = useCallback((index: number) => {
    const targetBreadcrumb = breadcrumbs[index];
    if (!targetBreadcrumb) return;

    if (targetBreadcrumb.type === 'campaigns') {
      setSelectedCampaign(null);
      setSelectedAdGroup(null);
      setCurrentLevel('campaigns');
      setBreadcrumbs([{ type: 'campaigns', name: 'Campaigns' }]);
      updateUrlSilently('campaigns', null, null);
    } else if (targetBreadcrumb.type === 'adGroups') {
      setSelectedAdGroup(null);
      setCurrentLevel('adGroups');
      setBreadcrumbs(prev => prev.slice(0, 2));
      updateUrlSilently('adGroups', selectedCampaign, null);
    }
  }, [breadcrumbs, selectedCampaign, updateUrlSilently]);

  const goBack = useCallback(() => {
    if (currentLevel === 'keywords') {
      setSelectedAdGroup(null);
      setCurrentLevel('adGroups');
      setBreadcrumbs(prev => prev.slice(0, 2));
      updateUrlSilently('adGroups', selectedCampaign, null);
    } else if (currentLevel === 'adGroups') {
      setSelectedCampaign(null);
      setCurrentLevel('campaigns');
      setBreadcrumbs([{ type: 'campaigns', name: 'Campaigns' }]);
      updateUrlSilently('campaigns', null, null);
    }
  }, [currentLevel, selectedCampaign, updateUrlSilently]);

  const resetToRoot = useCallback(() => {
    setSelectedCampaign(null);
    setSelectedAdGroup(null);
    setCurrentLevel('campaigns');
    setBreadcrumbs([{ type: 'campaigns', name: 'Campaigns' }]);
    updateUrlSilently('campaigns', null, null);
  }, [updateUrlSilently]);

  return (
    <DrillDownContext.Provider
      value={{
        currentLevel,
        selectedCampaign,
        selectedAdGroup,
        breadcrumbs,
        drillIntoCampaign,
        drillIntoAdGroup: drillIntoAdGroupWithUrl,
        navigateToBreadcrumb,
        goBack,
        resetToRoot,
      }}
    >
      {children}
    </DrillDownContext.Provider>
  );
}

export function useDrillDown() {
  const context = useContext(DrillDownContext);
  if (context === undefined) {
    throw new Error('useDrillDown must be used within a DrillDownProvider');
  }
  return context;
}
