'use client';

import { FilterState } from '../types';

interface KeywordFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  viewMode: 'list' | 'clusters';
  onViewModeChange: (mode: 'list' | 'clusters') => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export default function KeywordFilters({
  filters,
  onFilterChange,
  viewMode,
  onViewModeChange,
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
}: KeywordFiltersProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text2">View:</span>
          <div className="flex bg-surface2 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('list')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'list' ? 'bg-accent text-white' : 'text-text2 hover:text-text'
              }`}
            >
              List
            </button>
            <button
              onClick={() => onViewModeChange('clusters')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'clusters' ? 'bg-accent text-white' : 'text-text2 hover:text-text'
              }`}
            >
              Clusters
            </button>
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text2">Type:</span>
          <select
            value={filters.type}
            onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
            className="px-2 py-1 text-sm bg-surface2 rounded-lg text-text"
          >
            <option value="all">All</option>
            <option value="seed">Seed</option>
            <option value="variation">Variation</option>
            <option value="synonym">Synonym</option>
            <option value="modifier">Modifier</option>
            <option value="long_tail">Long Tail</option>
          </select>
        </div>

        {/* Intent Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text2">Intent:</span>
          <select
            value={filters.intent}
            onChange={(e) => onFilterChange({ ...filters, intent: e.target.value })}
            className="px-2 py-1 text-sm bg-surface2 rounded-lg text-text"
          >
            <option value="all">All</option>
            <option value="transactional">Transactional</option>
            <option value="commercial">Commercial</option>
            <option value="informational">Informational</option>
            <option value="navigational">Navigational</option>
          </select>
        </div>

        {/* Match Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text2">Match:</span>
          <select
            value={filters.match}
            onChange={(e) => onFilterChange({ ...filters, match: e.target.value })}
            className="px-2 py-1 text-sm bg-surface2 rounded-lg text-text"
          >
            <option value="all">All</option>
            <option value="EXACT">Exact</option>
            <option value="PHRASE">Phrase</option>
            <option value="BROAD">Broad</option>
          </select>
        </div>

        <div className="flex-1" />

        {/* Selection Actions */}
        <div className="flex items-center gap-2">
          <button onClick={onSelectAll} className="text-sm text-accent hover:underline">
            Select All
          </button>
          <button onClick={onClearSelection} className="text-sm text-text3 hover:underline">
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
