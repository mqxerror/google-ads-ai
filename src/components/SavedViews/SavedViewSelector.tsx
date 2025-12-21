/**
 * SavedViewSelector Component
 *
 * Dropdown selector for saved views with:
 * - List of saved views (pinned first, then default, then by updated)
 * - Apply view on click
 * - Quick save current state
 * - Edit/delete actions
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronDownIcon,
  BookmarkIcon,
  PlusIcon,
  CheckIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { SavedView, ViewState, useSavedViews } from '@/hooks/useSavedViews';

interface SavedViewSelectorProps {
  entityType: string;
  currentState: ViewState;
  onApplyView: (view: SavedView) => void;
  className?: string;
}

export function SavedViewSelector({
  entityType,
  currentState,
  onApplyView,
  className = '',
}: SavedViewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    views,
    activeView,
    isLoading,
    createView,
    updateView,
    deleteView,
    applyView,
    clearActiveView,
  } = useSavedViews(entityType, onApplyView);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreateView = async () => {
    if (!newViewName.trim()) return;

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

  const handleSetDefault = async (view: SavedView) => {
    await updateView(view.id, { isDefault: !view.isDefault });
  };

  const handleTogglePin = async (view: SavedView) => {
    await updateView(view.id, { isPinned: !view.isPinned });
  };

  const handleDeleteView = async (id: string) => {
    if (confirm('Delete this saved view?')) {
      await deleteView(id);
    }
  };

  const handleApplyView = (view: SavedView) => {
    applyView(view);
    setIsOpen(false);
  };

  const handleClearView = () => {
    clearActiveView();
    setIsOpen(false);
  };

  // Sort views: pinned first, then default, then by updatedAt
  const sortedViews = [...views].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
          border transition-colors
          ${activeView
            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }
        `}
      >
        <BookmarkIcon className="h-4 w-4" />
        <span className="max-w-[120px] truncate">
          {activeView ? activeView.name : 'Views'}
        </span>
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Saved Views
            </span>
            {activeView && (
              <button
                onClick={handleClearView}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>

          {/* Views List */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                Loading...
              </div>
            ) : sortedViews.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No saved views yet
              </div>
            ) : (
              <ul className="py-1">
                {sortedViews.map((view) => (
                  <li key={view.id} className="group relative">
                    {editingId === view.id ? (
                      // Edit mode
                      <div className="px-3 py-2 flex items-center gap-2">
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
                          <CheckIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      // View mode
                      <div
                        className={`
                          flex items-center gap-2 px-3 py-2 cursor-pointer
                          ${activeView?.id === view.id ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        `}
                        onClick={() => handleApplyView(view)}
                      >
                        {/* Icon indicators */}
                        <div className="flex items-center gap-1 w-8">
                          {view.isPinned && (
                            <span className="text-amber-500">📌</span>
                          )}
                          {view.isDefault && !view.isPinned && (
                            <StarIconSolid className="h-4 w-4 text-amber-400" />
                          )}
                        </div>

                        {/* View name */}
                        <span className={`flex-1 text-sm truncate ${activeView?.id === view.id ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                          {view.name}
                        </span>

                        {/* Action buttons (visible on hover) */}
                        <div className="hidden group-hover:flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePin(view);
                            }}
                            className="p-1 text-gray-400 hover:text-amber-500 rounded"
                            title={view.isPinned ? 'Unpin' : 'Pin'}
                          >
                            {view.isPinned ? '📌' : <span className="text-xs">📌</span>}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefault(view);
                            }}
                            className="p-1 text-gray-400 hover:text-amber-500 rounded"
                            title={view.isDefault ? 'Remove default' : 'Set as default'}
                          >
                            {view.isDefault ? (
                              <StarIconSolid className="h-4 w-4 text-amber-400" />
                            ) : (
                              <StarIcon className="h-4 w-4" />
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
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteView(view.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Create New View */}
          <div className="border-t border-gray-100 p-2">
            {isCreating ? (
              <div className="flex items-center gap-2">
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
                  disabled={!newViewName.trim()}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                <PlusIcon className="h-4 w-4" />
                Save Current View
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
