'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UIMode = 'simple' | 'pro';

interface ModeContextType {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  isSimpleMode: boolean;
  isProMode: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UIMode>('simple');

  useEffect(() => {
    // Load saved preference from localStorage on client side
    const saved = localStorage.getItem('uiMode') as UIMode;
    if (saved === 'simple' || saved === 'pro') {
      setModeState(saved);
    }
  }, []);

  const setMode = (newMode: UIMode) => {
    setModeState(newMode);
    localStorage.setItem('uiMode', newMode);
  };

  const toggleMode = () => {
    const newMode = mode === 'simple' ? 'pro' : 'simple';
    setMode(newMode);
  };

  // Always provide context, even during initialization
  // Use the default state during SSR/initial render to avoid hydration mismatch
  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isSimpleMode: mode === 'simple',
        isProMode: mode === 'pro',
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
