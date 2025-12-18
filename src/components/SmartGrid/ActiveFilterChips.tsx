'use client';

import { FilterConfig, CampaignStatus, CampaignType } from '@/types/campaign';

interface ActiveFilterChipsProps {
  filters: FilterConfig;
  onRemoveFilter: (key: keyof FilterConfig, value?: string) => void;
  onClearAll: () => void;
}

const statusLabels: Record<CampaignStatus, string> = {
  ENABLED: 'Active',
  PAUSED: 'Paused',
  REMOVED: 'Removed',
};

const typeLabels: Record<CampaignType, string> = {
  SEARCH: 'Search',
  PERFORMANCE_MAX: 'PMax',
  SHOPPING: 'Shopping',
  DISPLAY: 'Display',
  VIDEO: 'Video',
  DEMAND_GEN: 'Demand Gen',
  APP: 'App',
};

export default function ActiveFilterChips({ filters, onRemoveFilter, onClearAll }: ActiveFilterChipsProps) {
  const chips: Array<{ key: keyof FilterConfig; label: string; value?: string }> = [];

  // Status chips
  if (filters.status?.length) {
    filters.status.forEach(s => {
      chips.push({ key: 'status', label: `Status: ${statusLabels[s]}`, value: s });
    });
  }

  // Type chips
  if (filters.type?.length) {
    filters.type.forEach(t => {
      chips.push({ key: 'type', label: `Type: ${typeLabels[t]}`, value: t });
    });
  }

  // Spend range
  if (filters.spendMin !== undefined || filters.spendMax !== undefined) {
    const min = filters.spendMin ?? 0;
    const max = filters.spendMax;
    const label = max !== undefined
      ? `Spend: $${min.toLocaleString()}-$${max.toLocaleString()}`
      : `Spend: >$${min.toLocaleString()}`;
    chips.push({ key: 'spendMin', label });
  }

  // AI Score range
  if (filters.aiScoreMin !== undefined || filters.aiScoreMax !== undefined) {
    const min = filters.aiScoreMin ?? 0;
    const max = filters.aiScoreMax ?? 100;
    chips.push({ key: 'aiScoreMin', label: `AI Score: ${min}-${max}` });
  }

  // Conversions range
  if (filters.conversionsMin !== undefined || filters.conversionsMax !== undefined) {
    const min = filters.conversionsMin ?? 0;
    const max = filters.conversionsMax;
    const label = max !== undefined
      ? `Conv: ${min}-${max}`
      : `Conv: >${min}`;
    chips.push({ key: 'conversionsMin', label });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-2 bg-slate-50 border-b border-slate-200">
      <span className="text-xs font-medium text-slate-500">Active filters:</span>
      {chips.map((chip, index) => (
        <span
          key={`${chip.key}-${chip.value || index}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium"
        >
          {chip.label}
          <button
            onClick={() => onRemoveFilter(chip.key, chip.value)}
            className="hover:text-indigo-900 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs font-medium text-slate-500 hover:text-slate-700 ml-2"
      >
        Clear all
      </button>
    </div>
  );
}
