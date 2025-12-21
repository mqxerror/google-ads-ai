'use client';

import { useState, useRef, useEffect } from 'react';
import { FilterConfig, SortConfig } from '@/types/campaign';
import { useMode } from '@/contexts/ModeContext';
import { useSavedViews, SavedView, ViewState } from '@/hooks/useSavedViews';
import {
  BookmarkIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface ViewDefinition {
  id: string;
  name: string;
  description?: string;
  filters?: FilterConfig;
  sorting?: SortConfig;
  isDefault?: boolean;
  proOnly?: boolean; // Only show in Pro mode
}

interface ViewCounts {
  all: number;
  wasted_spend: number;
  scaling: number;
  tracking: number;
  needs_attention: number;
  top_performers: number;
}

interface ViewsDropdownProps {
  activeView: string;
  onViewChange: (viewId: string, filters?: FilterConfig, sorting?: SortConfig, datePreset?: string | null) => void;
  counts: ViewCounts;
  currentState?: ViewState; // Current grid state for saving
  entityType?: string;
}

const PRESET_VIEWS: ViewDefinition[] = [
  {
    id: 'all',
    name: 'All Campaigns',
    isDefault: true,
  },
  {
    id: 'needs_attention',
    name: 'Needs Attention',
    description: 'Campaigns with critical issues',
    filters: { aiScoreMax: 50 },
    sorting: { column: 'aiScore', direction: 'asc' },
  },
  {
    id: 'wasted_spend',
    name: 'Wasted Spend',
    description: 'High spend, no conversions',
    filters: { spendMin: 100, conversionsMax: 0 },
    sorting: { column: 'spend', direction: 'desc' },
  },
  {
    id: 'scaling',
    name: 'Scaling Candidates',
    description: 'High-performing, ready to scale',
    filters: { aiScoreMin: 75 },
    sorting: { column: 'conversions', direction: 'desc' },
  },
  {
    id: 'top_performers',
    name: 'Top Performers',
    description: 'Best converting campaigns',
    filters: { conversionsMin: 10 },
    sorting: { column: 'conversions', direction: 'desc' },
    proOnly: true, // Pro mode only
  },
  {
    id: 'tracking',
    name: 'Tracking Issues',
    description: 'Potential tracking problems',
    proOnly: true, // Pro mode only
  },
];

export default function ViewsDropdown({
  activeView,
  onViewChange,
  counts,
  currentState,
  entityType = 'campaign',
}: ViewsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isProMode } = useMode();

  // Saved views from API
  const {
    views: savedViews,
    activeView: activeSavedView,
    isLoading: savedViewsLoading,
    createView,
    updateView,
    deleteView,
    applyView,
    clearActiveView,
  } = useSavedViews(entityType, (view) => {
    // When a saved view is applied, call onViewChange with its settings
    // Convert sorting format: SavedView uses {column, direction}, SortConfig uses {column, direction}
    const sortConfig: SortConfig = {
      column: view.sorting.column as keyof import('@/types/campaign').Campaign,
      direction: view.sorting.direction,
    };
    onViewChange(
      `saved:${view.id}`,
      view.filters as FilterConfig,
      sortConfig,
      view.datePreset
    );
  });

  // Filter views based on mode
  const visibleViews = PRESET_VIEWS.filter(v => !v.proOnly || isProMode);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Determine active view name
  const getActiveViewName = () => {
    if (activeSavedView) {
      return activeSavedView.name;
    }
    const presetView = visibleViews.find(v => v.id === activeView);
    return presetView?.name || 'All Campaigns';
  };

  const activeCount = counts[activeView as keyof ViewCounts] || counts.all;

  // Quick chips for common views (show these as shortcuts)
  const quickViews = visibleViews.filter(v =>
    ['needs_attention', 'wasted_spend', 'scaling'].includes(v.id) &&
    v.id !== activeView &&
    !activeSavedView
  );

  const handlePresetViewSelect = (view: ViewDefinition) => {
    clearActiveView();
    onViewChange(view.id, view.filters, view.sorting);
    setIsOpen(false);
  };

  const handleSavedViewSelect = (view: SavedView) => {
    applyView(view);
    setIsOpen(false);
  };

  const handleCreateView = async () => {
    if (!newViewName.trim() || !currentState) return;

    await createView({
      name: newViewName.trim(),
      filters: currentState.filters,
      sorting: currentState.sorting,
      columns: currentState.columns,
      datePreset: currentState.datePreset,
    });

    setNewViewName('');
    setIsCreating(false);
  };

  const handleUpdateName = async (id: string) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    await updateView(id, { name: editingName.trim() });
    setEditingId(null);
  };

  const handleToggleDefault = async (e: React.MouseEvent, view: SavedView) => {
    e.stopPropagation();
    await updateView(view.id, { isDefault: !view.isDefault });
  };

  const handleTogglePin = async (e: React.MouseEvent, view: SavedView) => {
    e.stopPropagation();
    await updateView(view.id, { isPinned: !view.isPinned });
  };

  const handleDeleteView = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this saved view?')) {
      await deleteView(id);
    }
  };

  // Sort saved views: pinned first, then default, then by updatedAt
  const sortedSavedViews = [...savedViews].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white">
      {/* Main Dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            activeSavedView
              ? 'bg-blue-50 hover:bg-blue-100'
              : 'bg-slate-100 hover:bg-slate-200'
          }`}
        >
          {activeSavedView && <BookmarkIcon className="w-4 h-4 text-blue-600" />}
          <span className={`text-sm font-semibold ${activeSavedView ? 'text-blue-800' : 'text-slate-800'}`}>
            {getActiveViewName()}
          </span>
          {!activeSavedView && (
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {activeCount}
            </span>
          )}
          <svg className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
            {/* Preset Views Section */}
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Smart Views</p>
              {visibleViews.map(view => {
                const count = counts[view.id as keyof ViewCounts] || 0;
                const isActive = view.id === activeView && !activeSavedView;

                return (
                  <button
                    key={view.id}
                    onClick={() => handlePresetViewSelect(view)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{view.name}</p>
                      {view.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{view.description}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      isActive
                        ? 'bg-indigo-200 text-indigo-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Saved Views Section */}
            <div className="border-t border-gray-200 p-2">
              <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                <BookmarkIcon className="w-3.5 h-3.5" />
                Saved Views
                {savedViewsLoading && <span className="text-gray-300">(loading...)</span>}
              </p>

              {sortedSavedViews.length === 0 && !savedViewsLoading ? (
                <p className="px-3 py-2 text-xs text-gray-400 italic">No saved views yet</p>
              ) : (
                sortedSavedViews.map(view => {
                  const isActive = activeSavedView?.id === view.id;

                  if (editingId === view.id) {
                    // Edit mode
                    return (
                      <div key={view.id} className="px-3 py-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateName(view.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateName(view.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-400 hover:bg-gray-50 rounded"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={view.id}
                      onClick={() => handleSavedViewSelect(view)}
                      className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Pin/Default indicators */}
                        <div className="w-5 flex-shrink-0">
                          {view.isPinned && <span className="text-amber-500">📌</span>}
                          {view.isDefault && !view.isPinned && (
                            <StarIconSolid className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <span className={`text-sm font-medium truncate max-w-[140px] ${isActive ? 'text-blue-700' : ''}`}>
                          {view.name}
                        </span>
                      </div>

                      {/* Action buttons (visible on hover) */}
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={(e) => handleTogglePin(e, view)}
                          className="p-1 text-gray-400 hover:text-amber-500 rounded"
                          title={view.isPinned ? 'Unpin' : 'Pin'}
                        >
                          <span className="text-xs">{view.isPinned ? '📌' : '📍'}</span>
                        </button>
                        <button
                          onClick={(e) => handleToggleDefault(e, view)}
                          className="p-1 text-gray-400 hover:text-amber-500 rounded"
                          title={view.isDefault ? 'Remove default' : 'Set as default'}
                        >
                          {view.isDefault ? (
                            <StarIconSolid className="w-4 h-4 text-amber-400" />
                          ) : (
                            <StarIcon className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(view.id);
                            setEditingName(view.name);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-500 rounded"
                          title="Rename"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteView(e, view.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Create New View Section */}
            <div className="border-t border-gray-200 p-2">
              {isCreating ? (
                <div className="flex items-center gap-2 px-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateView();
                      if (e.key === 'Escape') {
                        setIsCreating(false);
                        setNewViewName('');
                      }
                    }}
                    placeholder="View name..."
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleCreateView}
                    disabled={!newViewName.trim() || !currentState}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setNewViewName('');
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  disabled={!currentState}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Save current view
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Chips */}
      <div className="flex items-center gap-2">
        {quickViews.map(view => {
          const count = counts[view.id as keyof ViewCounts] || 0;
          if (count === 0) return null;

          return (
            <button
              key={view.id}
              onClick={() => handlePresetViewSelect(view)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                view.id === 'needs_attention' ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' :
                view.id === 'wasted_spend' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                view.id === 'scaling' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' :
                'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {view.name}
              <span className="font-bold">({count})</span>
            </button>
          );
        })}

        {/* Clear saved view chip if one is active */}
        {activeSavedView && (
          <button
            onClick={() => {
              clearActiveView();
              onViewChange('all');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
