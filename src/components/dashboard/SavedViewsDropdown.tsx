'use client';

import { useState, useRef, useEffect } from 'react';

export interface FilterConfig {
  searchQuery: string;
  statusFilter: 'ALL' | 'ENABLED' | 'PAUSED';
  scoreRange: { min: number; max: number } | null;
  typeFilter: 'ALL' | 'SEARCH' | 'DISPLAY' | 'SHOPPING' | 'VIDEO' | 'PERFORMANCE_MAX';
  spendRange: { min: number; max: number } | null;
}

export interface SavedView {
  id: string;
  name: string;
  filters: FilterConfig;
  isPreset?: boolean;
}

const PRESET_VIEWS: SavedView[] = [
  {
    id: 'preset-all',
    name: 'All Campaigns',
    isPreset: true,
    filters: {
      searchQuery: '',
      statusFilter: 'ALL',
      scoreRange: null,
      typeFilter: 'ALL',
      spendRange: null,
    },
  },
  {
    id: 'preset-wasters',
    name: 'Wasters (Score < 40)',
    isPreset: true,
    filters: {
      searchQuery: '',
      statusFilter: 'ENABLED',
      scoreRange: { min: 0, max: 39 },
      typeFilter: 'ALL',
      spendRange: null,
    },
  },
  {
    id: 'preset-top-performers',
    name: 'Top Performers (Score 70+)',
    isPreset: true,
    filters: {
      searchQuery: '',
      statusFilter: 'ENABLED',
      scoreRange: { min: 70, max: 100 },
      typeFilter: 'ALL',
      spendRange: null,
    },
  },
  {
    id: 'preset-paused',
    name: 'Paused Campaigns',
    isPreset: true,
    filters: {
      searchQuery: '',
      statusFilter: 'PAUSED',
      scoreRange: null,
      typeFilter: 'ALL',
      spendRange: null,
    },
  },
  {
    id: 'preset-high-spend',
    name: 'High Spend ($100+/day)',
    isPreset: true,
    filters: {
      searchQuery: '',
      statusFilter: 'ENABLED',
      scoreRange: null,
      typeFilter: 'ALL',
      spendRange: { min: 100, max: Infinity },
    },
  },
];

interface SavedViewsDropdownProps {
  currentFilters: FilterConfig;
  onSelectView: (filters: FilterConfig) => void;
  savedViews: SavedView[];
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
}

export default function SavedViewsDropdown({
  currentFilters,
  onSelectView,
  savedViews,
  onSaveView,
  onDeleteView,
}: SavedViewsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSaveInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allViews = [...PRESET_VIEWS, ...savedViews];

  // Find current active view
  const activeView = allViews.find(v =>
    v.filters.statusFilter === currentFilters.statusFilter &&
    v.filters.searchQuery === currentFilters.searchQuery &&
    JSON.stringify(v.filters.scoreRange) === JSON.stringify(currentFilters.scoreRange) &&
    v.filters.typeFilter === currentFilters.typeFilter &&
    JSON.stringify(v.filters.spendRange) === JSON.stringify(currentFilters.spendRange)
  );

  const handleSaveView = () => {
    if (newViewName.trim()) {
      onSaveView(newViewName.trim());
      setNewViewName('');
      setShowSaveInput(false);
    }
  };

  const hasCustomFilters =
    currentFilters.searchQuery !== '' ||
    currentFilters.statusFilter !== 'ALL' ||
    currentFilters.scoreRange !== null ||
    currentFilters.typeFilter !== 'ALL' ||
    currentFilters.spendRange !== null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-surface2 text-text2 rounded-lg text-sm hover:bg-divider transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <span className="max-w-32 truncate">{activeView?.name || 'Custom View'}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-surface rounded-xl shadow-lg border border-divider overflow-hidden z-50">
          {/* Preset Views */}
          <div className="p-2 border-b border-divider">
            <p className="px-2 py-1 text-xs text-text3 uppercase tracking-wide">Quick Views</p>
            {PRESET_VIEWS.map((view) => (
              <button
                key={view.id}
                onClick={() => {
                  onSelectView(view.filters);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeView?.id === view.id
                    ? 'bg-accent/10 text-accent'
                    : 'hover:bg-surface2 text-text'
                }`}
              >
                {view.name}
              </button>
            ))}
          </div>

          {/* Saved Views */}
          {savedViews.length > 0 && (
            <div className="p-2 border-b border-divider">
              <p className="px-2 py-1 text-xs text-text3 uppercase tracking-wide">Saved Views</p>
              {savedViews.map((view) => (
                <div key={view.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onSelectView(view.filters);
                      setIsOpen(false);
                    }}
                    className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeView?.id === view.id
                        ? 'bg-accent/10 text-accent'
                        : 'hover:bg-surface2 text-text'
                    }`}
                  >
                    {view.name}
                  </button>
                  <button
                    onClick={() => onDeleteView(view.id)}
                    className="p-1 hover:bg-danger/10 rounded text-text3 hover:text-danger"
                    title="Delete view"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Save Current Filters */}
          <div className="p-2">
            {showSaveInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="View name..."
                  className="flex-1 px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveView()}
                />
                <button
                  onClick={handleSaveView}
                  disabled={!newViewName.trim()}
                  className="px-3 py-2 bg-accent text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                disabled={!hasCustomFilters}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-surface2 text-text2 rounded-lg text-sm hover:bg-divider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Save Current Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
