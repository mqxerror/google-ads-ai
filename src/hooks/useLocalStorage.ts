'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for persisting state to localStorage with SSR support
 * @param key The localStorage key
 * @param initialValue The initial value if nothing is stored
 * @param debounceMs Optional debounce delay for saves (default: 500ms)
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  debounceMs: number = 500
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
    setIsInitialized(true);
  }, [key]);

  // Save to localStorage when value changes (debounced)
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    const timeoutId = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.warn(`Error saving to localStorage key "${key}":`, error);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [key, storedValue, debounceMs, isInitialized]);

  // Setter function that supports functional updates
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      return newValue;
    });
  }, []);

  // Reset to initial value
  const reset = useCallback(() => {
    setStoredValue(initialValue);
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, reset];
}

/**
 * Hook specifically for persisting column visibility settings
 */
export function useColumnVisibility(
  gridId: string,
  defaultColumns: { id: string; label: string; visible: boolean; required?: boolean }[]
) {
  const storageKey = `gridColumns_${gridId}`;

  const [columns, setColumns, resetColumns] = useLocalStorage(
    storageKey,
    defaultColumns
  );

  // Update column visibility
  const toggleColumn = useCallback((columnId: string) => {
    setColumns(prev =>
      prev.map(col =>
        col.id === columnId && !col.required
          ? { ...col, visible: !col.visible }
          : col
      )
    );
  }, [setColumns]);

  // Show all columns
  const showAll = useCallback(() => {
    setColumns(prev => prev.map(col => ({ ...col, visible: true })));
  }, [setColumns]);

  // Hide all optional columns
  const hideOptional = useCallback(() => {
    setColumns(prev =>
      prev.map(col => ({ ...col, visible: col.required ?? false }))
    );
  }, [setColumns]);

  // Get visible column IDs
  const visibleColumnIds = columns.filter(c => c.visible).map(c => c.id);

  return {
    columns,
    setColumns,
    toggleColumn,
    showAll,
    hideOptional,
    resetColumns,
    visibleColumnIds,
  };
}

export default useLocalStorage;
