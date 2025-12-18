'use client';

import { useState, useEffect, useRef } from 'react';
import { FilterConfig, SortConfig, SavedView, CampaignStatus } from '@/types/campaign';
import { useAccount } from '@/contexts/AccountContext';

interface ViewTabsProps {
  activeView: string;
  onViewChange: (viewId: string, filters?: FilterConfig, sorting?: SortConfig) => void;
  currentFilters: FilterConfig;
  currentSorting: SortConfig;
  campaigns?: Array<{
    status: CampaignStatus;
    spend: number;
    conversions: number;
    clicks: number;
    aiScore: number;
  }>;
}

interface SavedViewData {
  id: string;
  name: string;
  filters: FilterConfig;
  sorting: SortConfig;
  isDefault: boolean;
}

const builtInViews: SavedView[] = [
  { id: 'all', name: 'All', filters: {}, sorting: { column: 'spend', direction: 'desc' }, isBuiltIn: true },
  { id: 'paused', name: 'Paused', filters: { status: ['PAUSED'] }, sorting: { column: 'spend', direction: 'desc' }, isBuiltIn: true },
];

// AI-powered views with explanations
interface AIView extends SavedView {
  description: string;
  icon: 'waste' | 'scale' | 'tracking' | 'performer';
}

const aiViews: AIView[] = [
  {
    id: 'ai-wasted',
    name: 'Wasted Spend',
    filters: { spendMin: 100, conversionsMax: 0, status: ['ENABLED'] },
    sorting: { column: 'spend', direction: 'desc' },
    isBuiltIn: true,
    description: 'Campaigns spending without converting',
    icon: 'waste',
  },
  {
    id: 'ai-scaling',
    name: 'Scaling Candidates',
    filters: { aiScoreMin: 80, status: ['ENABLED'] },
    sorting: { column: 'roas', direction: 'desc' },
    isBuiltIn: true,
    description: 'High performers ready for more budget',
    icon: 'scale',
  },
  {
    id: 'ai-tracking',
    name: 'Tracking Risks',
    filters: { conversionsMax: 0, clicksMin: 100, status: ['ENABLED'] },
    sorting: { column: 'clicks', direction: 'desc' },
    isBuiltIn: true,
    description: 'Conversion anomalies detected',
    icon: 'tracking',
  },
  {
    id: 'ai-top',
    name: 'Top Performers',
    filters: { aiScoreMin: 75, status: ['ENABLED'] },
    sorting: { column: 'aiScore', direction: 'desc' },
    isBuiltIn: true,
    description: 'Your best performing campaigns',
    icon: 'performer',
  },
];

export default function ViewTabs({ activeView, onViewChange, currentFilters, currentSorting, campaigns = [] }: ViewTabsProps) {
  const { currentAccount } = useAccount();

  // Calculate count for each AI view based on filter criteria
  const getAIViewCount = (view: AIView): number => {
    if (!campaigns || campaigns.length === 0) return 0;

    return campaigns.filter(c => {
      const filters = view.filters;

      // Status filter
      if (filters.status && !filters.status.includes(c.status)) return false;

      // Spend minimum
      if (filters.spendMin !== undefined && c.spend < filters.spendMin) return false;

      // Conversions max (0 = no conversions)
      if (filters.conversionsMax !== undefined && c.conversions > filters.conversionsMax) return false;

      // Clicks minimum
      if (filters.clicksMin !== undefined && c.clicks < filters.clicksMin) return false;

      // AI Score minimum
      if (filters.aiScoreMin !== undefined && c.aiScore < filters.aiScoreMin) return false;

      return true;
    }).length;
  };
  const [savedViews, setSavedViews] = useState<SavedViewData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingView, setEditingView] = useState<SavedViewData | null>(null);
  const [newViewName, setNewViewName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ viewId: string; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Fetch saved views when account changes
  useEffect(() => {
    if (!currentAccount?.id) return;

    const fetchViews = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/views?accountId=${currentAccount.id}&entityType=campaign`);
        if (response.ok) {
          const data = await response.json();
          setSavedViews(data.views || []);
        }
      } catch (error) {
        console.error('Failed to fetch views:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchViews();
  }, [currentAccount?.id]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateView = async () => {
    if (!newViewName.trim() || !currentAccount?.id) return;

    try {
      const response = await fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount.id,
          name: newViewName.trim(),
          entityType: 'campaign',
          filters: currentFilters,
          sorting: currentSorting,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSavedViews([...savedViews, data.view]);
        setShowCreateModal(false);
        setNewViewName('');
        // Switch to the new view
        onViewChange(data.view.id, data.view.filters, data.view.sorting);
      }
    } catch (error) {
      console.error('Failed to create view:', error);
    }
  };

  const handleRenameView = async () => {
    if (!editingView || !newViewName.trim()) return;

    try {
      const response = await fetch('/api/views', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingView.id,
          name: newViewName.trim(),
        }),
      });

      if (response.ok) {
        setSavedViews(savedViews.map(v =>
          v.id === editingView.id ? { ...v, name: newViewName.trim() } : v
        ));
        setEditingView(null);
        setNewViewName('');
      }
    } catch (error) {
      console.error('Failed to rename view:', error);
    }
  };

  const handleUpdateViewFilters = async (viewId: string) => {
    try {
      const response = await fetch('/api/views', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: viewId,
          filters: currentFilters,
          sorting: currentSorting,
        }),
      });

      if (response.ok) {
        setSavedViews(savedViews.map(v =>
          v.id === viewId ? { ...v, filters: currentFilters, sorting: currentSorting } : v
        ));
      }
    } catch (error) {
      console.error('Failed to update view:', error);
    }
    setContextMenu(null);
  };

  const handleDeleteView = async (viewId: string) => {
    if (!confirm('Are you sure you want to delete this view?')) return;

    try {
      const response = await fetch(`/api/views?id=${viewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSavedViews(savedViews.filter(v => v.id !== viewId));
        if (activeView === viewId) {
          onViewChange('all');
        }
      }
    } catch (error) {
      console.error('Failed to delete view:', error);
    }
    setContextMenu(null);
  };

  const handleViewClick = (view: SavedView | SavedViewData) => {
    onViewChange(view.id, view.filters as FilterConfig, view.sorting as SortConfig);
  };

  const handleContextMenu = (e: React.MouseEvent, viewId: string) => {
    e.preventDefault();
    // Only show context menu for custom views, not built-in ones
    if (builtInViews.some(v => v.id === viewId)) return;
    setContextMenu({ viewId, x: e.clientX, y: e.clientY });
  };

  const allViews = [...builtInViews, ...savedViews];

  const [hoveredAIView, setHoveredAIView] = useState<string | null>(null);

  // AI View icons
  const getAIViewIcon = (icon: AIView['icon']) => {
    switch (icon) {
      case 'waste':
        return (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      case 'scale':
        return (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'tracking':
        return (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'performer':
        return (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        );
    }
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 px-4 py-2">
      {/* Built-in Views */}
      {builtInViews.map((view) => (
        <button
          key={view.id}
          onClick={() => handleViewClick(view)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            activeView === view.id
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {view.name}
        </button>
      ))}

      {/* AI Views Separator */}
      <div className="mx-1 h-5 w-px bg-gray-300" />

      {/* AI Views */}
      {aiViews.map((view) => {
        const count = getAIViewCount(view);
        return (
        <div key={view.id} className="relative">
          <button
            onClick={() => handleViewClick(view)}
            onMouseEnter={() => setHoveredAIView(view.id)}
            onMouseLeave={() => setHoveredAIView(null)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeView === view.id
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-indigo-50'
            }`}
          >
            <span className={activeView === view.id ? 'text-indigo-600' : 'text-indigo-500'}>
              {getAIViewIcon(view.icon)}
            </span>
            {view.name}
            {count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold ${
                view.icon === 'waste' || view.icon === 'tracking'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {count}
              </span>
            )}
          </button>
          {/* Tooltip */}
          {hoveredAIView === view.id && (
            <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              <p className="text-xs text-gray-600">{view.description}</p>
              <p className="mt-1 text-[10px] text-indigo-600">AI-powered view</p>
            </div>
          )}
        </div>
        );
      })}

      {/* Separator */}
      {savedViews.length > 0 && (
        <div className="mx-1 h-5 w-px bg-gray-300" />
      )}

      {/* Custom Saved Views */}
      {savedViews.map((view) => (
        <button
          key={view.id}
          onClick={() => handleViewClick(view)}
          onContextMenu={(e) => handleContextMenu(e, view.id)}
          className={`group relative whitespace-nowrap rounded-lg px-3 py-1.5 pr-6 text-sm font-medium transition-colors ${
            activeView === view.id
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {view.name}
          {/* Edit indicator (3 dots) */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e, view.id);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded"
          >
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </span>
        </button>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <span className="text-xs text-gray-400">Loading...</span>
      )}

      {/* Create View Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
      >
        + Save Current View
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              const view = savedViews.find(v => v.id === contextMenu.viewId);
              if (view) {
                setEditingView(view);
                setNewViewName(view.name);
              }
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Rename
          </button>
          <button
            onClick={() => handleUpdateViewFilters(contextMenu.viewId)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Update with Current Filters
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => handleDeleteView(contextMenu.viewId)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}

      {/* Create View Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Save Current View
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              Save your current filters and sorting as a custom view for quick access.
            </p>
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="View name"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateView()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewViewName('');
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateView}
                disabled={!newViewName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename View Modal */}
      {editingView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Rename View
            </h3>
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="View name"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRenameView()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingView(null);
                  setNewViewName('');
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameView}
                disabled={!newViewName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
