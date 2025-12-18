'use client';

import { useState, useRef, useEffect } from 'react';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean; // Can't be hidden
}

interface ColumnVisibilityToggleProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

export default function ColumnVisibilityToggle({
  columns,
  onColumnsChange,
}: ColumnVisibilityToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (columnId: string) => {
    const newColumns = columns.map((col) =>
      col.id === columnId && !col.required
        ? { ...col, visible: !col.visible }
        : col
    );
    onColumnsChange(newColumns);
  };

  const handleShowAll = () => {
    const newColumns = columns.map((col) => ({ ...col, visible: true }));
    onColumnsChange(newColumns);
  };

  const handleHideOptional = () => {
    const newColumns = columns.map((col) => ({
      ...col,
      visible: col.required ?? false,
    }));
    onColumnsChange(newColumns);
  };

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
        Columns
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
          {visibleCount}/{columns.length}
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">
              Toggle Columns
            </span>
            <div className="flex gap-1">
              <button
                onClick={handleShowAll}
                className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
              >
                Show All
              </button>
              <button
                onClick={handleHideOptional}
                className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Columns List */}
          <div className="max-h-64 overflow-y-auto p-2">
            {columns.map((column) => (
              <label
                key={column.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 ${
                  column.required ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => handleToggle(column.id)}
                  disabled={column.required}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700">
                  {column.label}
                </span>
                {column.required && (
                  <span className="ml-auto text-xs text-gray-400">(required)</span>
                )}
              </label>
            ))}
          </div>

          {/* Footer hint */}
          <div className="border-t border-gray-200 px-4 py-2">
            <p className="text-xs text-gray-500">
              Hidden columns are still available in exports
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
