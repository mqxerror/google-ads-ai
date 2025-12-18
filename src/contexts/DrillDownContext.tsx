'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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

export function DrillDownProvider({ children }: { children: ReactNode }) {
  const [currentLevel, setCurrentLevel] = useState<EntityType>('campaigns');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedAdGroup, setSelectedAdGroup] = useState<AdGroup | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { type: 'campaigns', name: 'Campaigns' }
  ]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved state on mount
  useEffect(() => {
    const savedState = loadDrillDownState();
    if (savedState) {
      setCurrentLevel(savedState.currentLevel);
      setSelectedCampaign(savedState.selectedCampaign);
      setSelectedAdGroup(savedState.selectedAdGroup);
      setBreadcrumbs(savedState.breadcrumbs);
    }
    setIsInitialized(true);
  }, []);

  // Save state whenever it changes (after initialization)
  useEffect(() => {
    if (isInitialized) {
      saveDrillDownState({
        currentLevel,
        selectedCampaign,
        selectedAdGroup,
        breadcrumbs,
      });
    }
  }, [currentLevel, selectedCampaign, selectedAdGroup, breadcrumbs, isInitialized]);

  const drillIntoCampaign = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setSelectedAdGroup(null);
    setCurrentLevel('adGroups');
    setBreadcrumbs([
      { type: 'campaigns', name: 'Campaigns' },
      { type: 'adGroups', id: campaign.id, name: campaign.name }
    ]);
  }, []);

  const drillIntoAdGroup = useCallback((adGroup: AdGroup) => {
    setSelectedAdGroup(adGroup);
    setCurrentLevel('keywords');
    setBreadcrumbs(prev => [
      ...prev.slice(0, 2),
      { type: 'keywords', id: adGroup.id, name: adGroup.name }
    ]);
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    const targetBreadcrumb = breadcrumbs[index];
    if (!targetBreadcrumb) return;

    if (targetBreadcrumb.type === 'campaigns') {
      setSelectedCampaign(null);
      setSelectedAdGroup(null);
      setCurrentLevel('campaigns');
      setBreadcrumbs([{ type: 'campaigns', name: 'Campaigns' }]);
    } else if (targetBreadcrumb.type === 'adGroups') {
      setSelectedAdGroup(null);
      setCurrentLevel('adGroups');
      setBreadcrumbs(prev => prev.slice(0, 2));
    }
  }, [breadcrumbs]);

  const goBack = useCallback(() => {
    if (currentLevel === 'keywords') {
      setSelectedAdGroup(null);
      setCurrentLevel('adGroups');
      setBreadcrumbs(prev => prev.slice(0, 2));
    } else if (currentLevel === 'adGroups') {
      setSelectedCampaign(null);
      setCurrentLevel('campaigns');
      setBreadcrumbs([{ type: 'campaigns', name: 'Campaigns' }]);
    }
  }, [currentLevel]);

  const resetToRoot = useCallback(() => {
    setSelectedCampaign(null);
    setSelectedAdGroup(null);
    setCurrentLevel('campaigns');
    setBreadcrumbs([{ type: 'campaigns', name: 'Campaigns' }]);
  }, []);

  return (
    <DrillDownContext.Provider
      value={{
        currentLevel,
        selectedCampaign,
        selectedAdGroup,
        breadcrumbs,
        drillIntoCampaign,
        drillIntoAdGroup,
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
