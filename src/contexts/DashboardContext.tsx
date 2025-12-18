'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type WidgetType =
  | 'metric-cards'
  | 'spend-trend'
  | 'conversions-trend'
  | 'campaign-distribution'
  | 'top-campaigns'
  | 'ctr-trend'
  | 'cpa-comparison';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  visible: boolean;
  order: number;
  size: WidgetSize;
}

interface DashboardContextValue {
  widgets: WidgetConfig[];
  toggleWidget: (widgetId: string) => void;
  reorderWidgets: (startIndex: number, endIndex: number) => void;
  setWidgetSize: (widgetId: string, size: WidgetSize) => void;
  resetToDefault: () => void;
  isCustomizing: boolean;
  setIsCustomizing: (value: boolean) => void;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'metric-cards', type: 'metric-cards', title: 'Key Metrics', visible: true, order: 0, size: 'full' },
  { id: 'spend-trend', type: 'spend-trend', title: 'Spend Trend', visible: true, order: 1, size: 'medium' },
  { id: 'conversions-trend', type: 'conversions-trend', title: 'Conversions Trend', visible: true, order: 2, size: 'medium' },
  { id: 'campaign-distribution', type: 'campaign-distribution', title: 'Campaign Distribution', visible: true, order: 3, size: 'medium' },
  { id: 'top-campaigns', type: 'top-campaigns', title: 'Top Campaigns', visible: true, order: 4, size: 'large' },
  { id: 'ctr-trend', type: 'ctr-trend', title: 'CTR Trend', visible: false, order: 5, size: 'medium' },
  { id: 'cpa-comparison', type: 'cpa-comparison', title: 'CPA by Campaign', visible: false, order: 6, size: 'medium' },
];

const STORAGE_KEY = 'dashboard-widgets-config';

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new widgets added in updates
        const merged = DEFAULT_WIDGETS.map(defaultWidget => {
          const savedWidget = parsed.find((w: WidgetConfig) => w.id === defaultWidget.id);
          return savedWidget ? { ...defaultWidget, ...savedWidget } : defaultWidget;
        });
        setWidgets(merged);
      }
    } catch (e) {
      console.error('Failed to load dashboard config:', e);
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage when widgets change (after initialization)
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
      } catch (e) {
        console.error('Failed to save dashboard config:', e);
      }
    }
  }, [widgets, isInitialized]);

  const toggleWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    ));
  }, []);

  const reorderWidgets = useCallback((startIndex: number, endIndex: number) => {
    setWidgets(prev => {
      const result = [...prev].sort((a, b) => a.order - b.order);
      const visibleWidgets = result.filter(w => w.visible);
      const [removed] = visibleWidgets.splice(startIndex, 1);
      visibleWidgets.splice(endIndex, 0, removed);

      // Update order numbers
      visibleWidgets.forEach((widget, idx) => {
        const widgetIndex = result.findIndex(w => w.id === widget.id);
        if (widgetIndex !== -1) {
          result[widgetIndex] = { ...result[widgetIndex], order: idx };
        }
      });

      return result;
    });
  }, []);

  const setWidgetSize = useCallback((widgetId: string, size: WidgetSize) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, size } : w
    ));
  }, []);

  const resetToDefault = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: DashboardContextValue = {
    widgets,
    toggleWidget,
    reorderWidgets,
    setWidgetSize,
    resetToDefault,
    isCustomizing,
    setIsCustomizing,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
