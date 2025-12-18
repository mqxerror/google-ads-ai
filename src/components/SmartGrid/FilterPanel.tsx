'use client';

import { useState } from 'react';
import { FilterConfig, CampaignStatus, CampaignType } from '@/types/campaign';

interface FilterPanelProps {
  filters: FilterConfig;
  onFiltersChange: (filters: FilterConfig) => void;
  onClose: () => void;
}

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

export default function FilterPanel({ filters, onFiltersChange, onClose }: FilterPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleStatus = (status: CampaignStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({ ...filters, status: updated.length > 0 ? updated : undefined });
  };

  const toggleType = (type: CampaignType) => {
    const current = filters.type || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFiltersChange({ ...filters, type: updated.length > 0 ? updated : undefined });
  };

  const clearAll = () => {
    onFiltersChange({});
  };

  const hasFilters = Object.values(filters).some((v) =>
    v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  );

  const hasAdvancedFilters = filters.clicksMin !== undefined || filters.clicksMax !== undefined ||
    filters.conversionsMin !== undefined || filters.conversionsMax !== undefined ||
    filters.ctrMin !== undefined || filters.ctrMax !== undefined ||
    filters.cpaMin !== undefined || filters.cpaMax !== undefined;

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-4">
      <div className="space-y-4">
        {/* Basic Filters Row */}
        <div className="flex items-start justify-between">
          <div className="flex flex-wrap gap-6">
            {/* Status Filter */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleStatus(opt.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      filters.status?.includes(opt.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Campaign Type
              </label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleType(opt.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      filters.type?.includes(opt.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Spend Range */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Spend Range ($)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.spendMin || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      spendMin: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.spendMax || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      spendMax: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* AI Score Range */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                AI Score
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  max={100}
                  value={filters.aiScoreMin || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      aiScoreMin: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  max={100}
                  value={filters.aiScoreMax || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      aiScoreMax: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                onClick={clearAll}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            <svg
              className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Advanced Filters
            {hasAdvancedFilters && (
              <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Advanced Filters Row */}
        {showAdvanced && (
          <div className="flex flex-wrap gap-6 border-t border-gray-200 pt-4">
            {/* Clicks Range */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Clicks
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  value={filters.clicksMin || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      clicksMin: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  value={filters.clicksMax || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      clicksMax: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Conversions Range */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Conversions
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  value={filters.conversionsMin || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      conversionsMin: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  value={filters.conversionsMax || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      conversionsMax: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* CTR Range */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                CTR (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  max={100}
                  step={0.1}
                  value={filters.ctrMin || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      ctrMin: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  max={100}
                  step={0.1}
                  value={filters.ctrMax || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      ctrMax: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* CPA Range */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                CPA ($)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  step={0.01}
                  value={filters.cpaMin || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      cpaMin: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  step={0.01}
                  value={filters.cpaMax || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      cpaMax: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
