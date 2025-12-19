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
  currentPreset: DashboardPreset;
  applyPreset: (preset: DashboardPreset) => void;
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
const PRESET_KEY = 'dashboard-preset';

export type DashboardPreset = 'default' | 'executive' | 'operator' | 'growth' | 'qa';

// Preset configurations
const PRESETS: Record<DashboardPreset, Partial<WidgetConfig>[]> = {
  default: [
    { id: 'metric-cards', visible: true, order: 0, size: 'full' },
    { id: 'spend-trend', visible: true, order: 1, size: 'medium' },
    { id: 'conversions-trend', visible: true, order: 2, size: 'medium' },
    { id: 'campaign-distribution', visible: true, order: 3, size: 'medium' },
    { id: 'top-campaigns', visible: true, order: 4, size: 'large' },
    { id: 'ctr-trend', visible: false, order: 5, size: 'medium' },
    { id: 'cpa-comparison', visible: false, order: 6, size: 'medium' },
  ],
  executive: [
    // High-level KPIs, trends, minimal detail
    { id: 'metric-cards', visible: true, order: 0, size: 'full' },
    { id: 'spend-trend', visible: true, order: 1, size: 'large' },
    { id: 'conversions-trend', visible: true, order: 2, size: 'large' },
    { id: 'campaign-distribution', visible: false, order: 3, size: 'medium' },
    { id: 'top-campaigns', visible: true, order: 4, size: 'full' },
    { id: 'ctr-trend', visible: false, order: 5, size: 'medium' },
    { id: 'cpa-comparison', visible: false, order: 6, size: 'medium' },
  ],
  operator: [
    // Detailed performance, all widgets visible
    { id: 'metric-cards', visible: true, order: 0, size: 'full' },
    { id: 'spend-trend', visible: true, order: 1, size: 'medium' },
    { id: 'conversions-trend', visible: true, order: 2, size: 'medium' },
    { id: 'ctr-trend', visible: true, order: 3, size: 'medium' },
    { id: 'cpa-comparison', visible: true, order: 4, size: 'medium' },
    { id: 'campaign-distribution', visible: true, order: 5, size: 'medium' },
    { id: 'top-campaigns', visible: true, order: 6, size: 'large' },
  ],
  growth: [
    // Focus on conversions, CPA, scaling opportunities
    { id: 'metric-cards', visible: true, order: 0, size: 'full' },
    { id: 'conversions-trend', visible: true, order: 1, size: 'large' },
    { id: 'cpa-comparison', visible: true, order: 2, size: 'large' },
    { id: 'top-campaigns', visible: true, order: 3, size: 'full' },
    { id: 'spend-trend', visible: true, order: 4, size: 'medium' },
    { id: 'ctr-trend', visible: false, order: 5, size: 'medium' },
    { id: 'campaign-distribution', visible: false, order: 6, size: 'medium' },
  ],
  qa: [
    // Quality focus: CTR, distribution, issues
    { id: 'metric-cards', visible: true, order: 0, size: 'full' },
    { id: 'ctr-trend', visible: true, order: 1, size: 'large' },
    { id: 'campaign-distribution', visible: true, order: 2, size: 'large' },
    { id: 'cpa-comparison', visible: true, order: 3, size: 'medium' },
    { id: 'top-campaigns', visible: true, order: 4, size: 'large' },
    { id: 'spend-trend', visible: false, order: 5, size: 'medium' },
    { id: 'conversions-trend', visible: false, order: 6, size: 'medium' },
  ],
};

export const PRESET_INFO: Record<DashboardPreset, { label: string; description: string; icon: string }> = {
  default: { label: 'Default', description: 'Balanced overview', icon: '📊' },
  executive: { label: 'Executive', description: 'High-level KPIs & trends', icon: '👔' },
  operator: { label: 'Operator', description: 'Full operational detail', icon: '⚙️' },
  growth: { label: 'Growth', description: 'Conversions & scaling', icon: '📈' },
  qa: { label: 'QA', description: 'Quality & distribution', icon: '🔍' },
};

// Initialize widgets from localStorage (SSR-safe)
function getInitialWidgets(): WidgetConfig[] {
  if (typeof window === 'undefined') return DEFAULT_WIDGETS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle new widgets added in updates
      return DEFAULT_WIDGETS.map(defaultWidget => {
        const savedWidget = parsed.find((w: WidgetConfig) => w.id === defaultWidget.id);
        return savedWidget ? { ...defaultWidget, ...savedWidget } : defaultWidget;
      });
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_WIDGETS;
}

function getInitialPreset(): DashboardPreset {
  if (typeof window === 'undefined') return 'default';
  try {
    const saved = localStorage.getItem(PRESET_KEY);
    if (saved && saved in PRESETS) {
      return saved as DashboardPreset;
    }
  } catch {
    // Ignore
  }
  return 'default';
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(getInitialWidgets);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<DashboardPreset>(getInitialPreset);

  // Save to localStorage when widgets change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    } catch {
      // Ignore storage errors
    }
  }, [widgets]);

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
    setCurrentPreset('default');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(PRESET_KEY, 'default');
  }, []);

  const applyPreset = useCallback((preset: DashboardPreset) => {
    const presetConfig = PRESETS[preset];
    const newWidgets = DEFAULT_WIDGETS.map(widget => {
      const presetWidget = presetConfig.find(p => p.id === widget.id);
      if (presetWidget) {
        return { ...widget, ...presetWidget };
      }
      return widget;
    });
    setWidgets(newWidgets);
    setCurrentPreset(preset);
    localStorage.setItem(PRESET_KEY, preset);
  }, []);

  const value: DashboardContextValue = {
    widgets,
    toggleWidget,
    reorderWidgets,
    setWidgetSize,
    resetToDefault,
    isCustomizing,
    setIsCustomizing,
    currentPreset,
    applyPreset,
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
