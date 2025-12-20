'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UIMode = 'simple' | 'pro';

interface ModeContextType {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  isSimpleMode: boolean;
  isProMode: boolean;
  isHydrated: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

const DEFAULT_MODE: UIMode = 'simple';

export function ModeProvider({ children }: { children: ReactNode }) {
  // Start with default mode to match server render
  const [mode, setModeState] = useState<UIMode>(DEFAULT_MODE);
  const [isHydrated, setIsHydrated] = useState(false);

  // Sync with localStorage after hydration to avoid mismatch
  useEffect(() => {
    const saved = localStorage.getItem('uiMode') as UIMode;
    if (saved === 'simple' || saved === 'pro') {
      setModeState(saved);
    }
    setIsHydrated(true);
  }, []);

  const setMode = (newMode: UIMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('uiMode', newMode);
    }
  };

  const toggleMode = () => {
    const newMode = mode === 'simple' ? 'pro' : 'simple';
    setMode(newMode);
  };

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isSimpleMode: mode === 'simple',
        isProMode: mode === 'pro',
        isHydrated,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}
