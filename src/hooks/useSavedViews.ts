/**
 * useSavedViews Hook
 *
 * Manages saved views state and operations:
 * - Fetch saved views for current entity type
 * - Create, update, delete views
 * - Apply views to current state
 * - Track current active view
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';

export interface SavedView {
  id: string;
  name: string;
  entityType: string;
  filters: Record<string, unknown>;
  sorting: { column: string; direction: 'asc' | 'desc' };
  columns: string[];
  datePreset: string | null;
  isDefault: boolean;
  isPinned: boolean;
  icon: string | null;
  color: string | null;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ViewState {
  filters: Record<string, unknown>;
  sorting: { column: string; direction: 'asc' | 'desc' };
  columns: string[];
  datePreset: string | null;
}

interface UseSavedViewsResult {
  views: SavedView[];
  activeView: SavedView | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchViews: () => Promise<void>;
  createView: (data: Partial<SavedView>) => Promise<SavedView | null>;
  updateView: (id: string, data: Partial<SavedView>) => Promise<SavedView | null>;
  deleteView: (id: string) => Promise<boolean>;
  applyView: (view: SavedView) => void;
  clearActiveView: () => void;

  // Quick save current state
  saveCurrentState: (name: string, state: ViewState) => Promise<SavedView | null>;
}

export function useSavedViews(
  entityType: string = 'campaign',
  onApplyView?: (view: SavedView) => void
): UseSavedViewsResult {
  const { currentAccount } = useAccount();
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeView, setActiveView] = useState<SavedView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch views
  const fetchViews = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ entityType });
      if (currentAccount?.id) {
        params.set('accountId', currentAccount.id);
      }

      const res = await fetch(`/api/saved-views?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch views');
      }

      const data = await res.json();
      setViews(data.views || []);

      // Auto-apply default view if no active view
      if (!activeView) {
        const defaultView = data.views?.find((v: SavedView) => v.isDefault);
        if (defaultView) {
          setActiveView(defaultView);
          onApplyView?.(defaultView);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch views');
    } finally {
      setIsLoading(false);
    }
  }, [entityType, currentAccount?.id, activeView, onApplyView]);

  // Create view
  const createView = useCallback(async (data: Partial<SavedView>): Promise<SavedView | null> => {
    try {
      const res = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          entityType,
          accountId: currentAccount?.id,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create view');
      }

      const { view } = await res.json();
      setViews(prev => [view, ...prev]);
      return view;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create view');
      return null;
    }
  }, [entityType, currentAccount?.id]);

  // Update view
  const updateView = useCallback(async (id: string, data: Partial<SavedView>): Promise<SavedView | null> => {
    try {
      const res = await fetch(`/api/saved-views/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update view');
      }

      const { view } = await res.json();
      setViews(prev => prev.map(v => v.id === id ? view : v));

      // Update active view if it was updated
      if (activeView?.id === id) {
        setActiveView(view);
      }

      return view;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update view');
      return null;
    }
  }, [activeView?.id]);

  // Delete view
  const deleteView = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/saved-views/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete view');
      }

      setViews(prev => prev.filter(v => v.id !== id));

      // Clear active view if deleted
      if (activeView?.id === id) {
        setActiveView(null);
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete view');
      return false;
    }
  }, [activeView?.id]);

  // Apply view
  const applyView = useCallback((view: SavedView) => {
    setActiveView(view);
    onApplyView?.(view);
  }, [onApplyView]);

  // Clear active view
  const clearActiveView = useCallback(() => {
    setActiveView(null);
  }, []);

  // Quick save current state
  const saveCurrentState = useCallback(async (name: string, state: ViewState): Promise<SavedView | null> => {
    return createView({
      name,
      filters: state.filters,
      sorting: state.sorting,
      columns: state.columns,
      datePreset: state.datePreset,
    });
  }, [createView]);

  // Fetch views on mount and when entity type changes
  useEffect(() => {
    fetchViews();
  }, [entityType, currentAccount?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    views,
    activeView,
    isLoading,
    error,
    fetchViews,
    createView,
    updateView,
    deleteView,
    applyView,
    clearActiveView,
    saveCurrentState,
  };
}
