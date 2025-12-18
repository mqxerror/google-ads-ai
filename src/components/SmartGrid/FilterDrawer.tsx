'use client';

import { useState } from 'react';
import { FilterConfig, CampaignStatus, CampaignType } from '@/types/campaign';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterConfig;
  onFiltersChange: (filters: FilterConfig) => void;
}

export default function FilterDrawer({ isOpen, onClose, filters, onFiltersChange }: FilterDrawerProps) {
  // Use key to reset state when drawer opens with different filters
  // This avoids needing to sync state in useEffect
  if (!isOpen) return null;

  return (
    <FilterDrawerContent
      key={JSON.stringify(filters)}
      filters={filters}
      onFiltersChange={onFiltersChange}
      onClose={onClose}
    />
  );
}

// Inner component with local state - remounts when filters change via key prop
function FilterDrawerContent({
  filters,
  onFiltersChange,
  onClose
}: {
  filters: FilterConfig;
  onFiltersChange: (filters: FilterConfig) => void;
  onClose: () => void;
}) {
  const [localFilters, setLocalFilters] = useState<FilterConfig>(filters);

  const statusOptions: { value: CampaignStatus; label: string }[] = [
    { value: 'ENABLED', label: 'Active' },
    { value: 'PAUSED', label: 'Paused' },
    { value: 'REMOVED', label: 'Removed' },
  ];

  const typeOptions: { value: CampaignType; label: string }[] = [
    { value: 'SEARCH', label: 'Search' },
    { value: 'PERFORMANCE_MAX', label: 'Performance Max' },
    { value: 'SHOPPING', label: 'Shopping' },
    { value: 'DISPLAY', label: 'Display' },
    { value: 'VIDEO', label: 'Video' },
    { value: 'DEMAND_GEN', label: 'Demand Gen' },
    { value: 'APP', label: 'App' },
  ];

  const handleStatusToggle = (status: CampaignStatus) => {
    const current = localFilters.status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    setLocalFilters({ ...localFilters, status: updated.length > 0 ? updated : undefined });
  };

  const handleTypeToggle = (type: CampaignType) => {
    const current = localFilters.type || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setLocalFilters({ ...localFilters, type: updated.length > 0 ? updated : undefined });
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleClear = () => {
    setLocalFilters({});
    onFiltersChange({});
  };

  const activeCount = Object.values(localFilters).filter(v =>
    v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <p className="text-sm text-gray-500">Refine your campaign list</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter Content */}
        <div className="overflow-y-auto p-6 space-y-6" style={{ height: 'calc(100% - 140px)' }}>
          {/* Status */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Status</h3>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleStatusToggle(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    localFilters.status?.includes(option.value)
                      ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-500'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campaign Type */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Campaign Type</h3>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleTypeToggle(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    localFilters.type?.includes(option.value)
                      ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-500'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spend Range */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Spend Range</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Min ($)</label>
                <input
                  type="number"
                  value={localFilters.spendMin ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    spendMin: e.target.value ? Number(e.target.value) : undefined
                  })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Max ($)</label>
                <input
                  type="number"
                  value={localFilters.spendMax ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    spendMax: e.target.value ? Number(e.target.value) : undefined
                  })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>

          {/* AI Score Range */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">AI Health Score</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Min</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={localFilters.aiScoreMin ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    aiScoreMin: e.target.value ? Number(e.target.value) : undefined
                  })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Max</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={localFilters.aiScoreMax ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    aiScoreMax: e.target.value ? Number(e.target.value) : undefined
                  })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="100"
                />
              </div>
            </div>
          </div>

          {/* Conversions Range */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Conversions</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Min</label>
                <input
                  type="number"
                  value={localFilters.conversionsMin ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    conversionsMin: e.target.value ? Number(e.target.value) : undefined
                  })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Max</label>
                <input
                  type="number"
                  value={localFilters.conversionsMax ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    conversionsMax: e.target.value ? Number(e.target.value) : undefined
                  })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClear}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Clear all
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >
                Apply{activeCount > 0 && ` (${activeCount})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
