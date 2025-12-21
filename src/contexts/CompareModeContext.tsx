/**
 * Compare Mode Context
 *
 * Manages the compare mode state for period-over-period analysis.
 * When enabled, shows deltas (% change) next to metric values in the grid.
 */

'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type ComparePeriodType = 'previous' | 'same_last_year' | 'custom';

interface CompareConfig {
  periodType: ComparePeriodType;
  // For custom period
  customStartDate?: string;
  customEndDate?: string;
}

interface CompareModeContextType {
  isCompareMode: boolean;
  toggleCompareMode: () => void;
  setCompareMode: (enabled: boolean) => void;
  compareConfig: CompareConfig;
  setCompareConfig: (config: CompareConfig) => void;
}

const CompareModeContext = createContext<CompareModeContextType | undefined>(undefined);

export function CompareModeProvider({ children }: { children: ReactNode }) {
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareConfig, setCompareConfig] = useState<CompareConfig>({
    periodType: 'previous',
  });

  const toggleCompareMode = useCallback(() => {
    setIsCompareMode((prev) => !prev);
  }, []);

  const setCompareMode = useCallback((enabled: boolean) => {
    setIsCompareMode(enabled);
  }, []);

  return (
    <CompareModeContext.Provider
      value={{
        isCompareMode,
        toggleCompareMode,
        setCompareMode,
        compareConfig,
        setCompareConfig,
      }}
    >
      {children}
    </CompareModeContext.Provider>
  );
}

export function useCompareMode() {
  const context = useContext(CompareModeContext);
  if (!context) {
    throw new Error('useCompareMode must be used within a CompareModeProvider');
  }
  return context;
}
