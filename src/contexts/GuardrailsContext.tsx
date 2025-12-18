'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { GuardrailSettings, defaultGuardrailSettings } from '@/lib/guardrails';

interface GuardrailsContextType {
  settings: GuardrailSettings;
  updateSettings: (updates: Partial<GuardrailSettings>) => void;
  resetSettings: () => void;
}

const GuardrailsContext = createContext<GuardrailsContextType | undefined>(undefined);

const STORAGE_KEY = 'guardrails-settings';

export function GuardrailsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GuardrailSettings>(defaultGuardrailSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultGuardrailSettings, ...parsed });
      } catch {
        // Invalid stored data, use defaults
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<GuardrailSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultGuardrailSettings);
  }, []);

  return (
    <GuardrailsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </GuardrailsContext.Provider>
  );
}

export function useGuardrails() {
  const context = useContext(GuardrailsContext);
  if (context === undefined) {
    throw new Error('useGuardrails must be used within a GuardrailsProvider');
  }
  return context;
}
