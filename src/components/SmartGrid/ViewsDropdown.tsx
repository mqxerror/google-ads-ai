'use client';

import { useState, useRef, useEffect } from 'react';
import { FilterConfig, SortConfig } from '@/types/campaign';
import { useMode } from '@/contexts/ModeContext';

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
  onViewChange: (viewId: string, filters?: FilterConfig, sorting?: SortConfig) => void;
  counts: ViewCounts;
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

export default function ViewsDropdown({ activeView, onViewChange, counts }: ViewsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isProMode } = useMode();

  // Filter views based on mode
  const visibleViews = PRESET_VIEWS.filter(v => !v.proOnly || isProMode);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const activeViewDef = visibleViews.find(v => v.id === activeView) || visibleViews[0];
  const activeCount = counts[activeView as keyof ViewCounts] || counts.all;

  // Quick chips for common views (show these as shortcuts)
  const quickViews = visibleViews.filter(v =>
    ['needs_attention', 'wasted_spend', 'scaling'].includes(v.id) &&
    v.id !== activeView
  );

  const handleViewSelect = (view: ViewDefinition) => {
    onViewChange(view.id, view.filters, view.sorting);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white">
      {/* Main Dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <span className="text-sm font-semibold text-slate-800">{activeViewDef.name}</span>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
            {activeCount}
          </span>
          <svg className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Saved Views</p>
              {visibleViews.map(view => {
                const count = counts[view.id as keyof ViewCounts] || 0;
                const isActive = view.id === activeView;

                return (
                  <button
                    key={view.id}
                    onClick={() => handleViewSelect(view)}
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

            {/* Custom View Section */}
            <div className="border-t border-gray-200 p-2">
              <button className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create custom view
              </button>
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
              onClick={() => handleViewSelect(view)}
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
      </div>
    </div>
  );
}
