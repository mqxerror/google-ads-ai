'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface InlineEditableCellProps {
  value: string;
  onSave: (newValue: string) => void;
  type?: 'text' | 'select';
  options?: { value: string; label: string }[];
  className?: string;
  placeholder?: string;
}

export default function InlineEditableCell({
  value,
  onSave,
  type = 'text',
  options = [],
  className = '',
  placeholder = 'Enter value...',
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing) {
      if (type === 'text' && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (type === 'select' && selectRef.current) {
        selectRef.current.focus();
      }
    }
  }, [isEditing, type]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(value);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Small delay to allow clicking save button
    setTimeout(() => {
      if (isEditing) {
        handleSave();
      }
    }, 150);
  };

  // Get display label for select type
  const getDisplayLabel = () => {
    if (type === 'select') {
      const option = options.find(opt => opt.value === value);
      return option?.label || value;
    }
    return value;
  };

  if (isEditing) {
    if (type === 'select') {
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <select
            ref={selectRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="rounded border border-blue-400 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            className="rounded p-1 text-green-600 hover:bg-green-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={handleCancel}
            className="rounded p-1 text-red-600 hover:bg-red-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleSave}
          className="rounded p-1 text-green-600 hover:bg-green-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={handleCancel}
          className="rounded p-1 text-red-600 hover:bg-red-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  const displayValue = getDisplayLabel();

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`group/cell cursor-text rounded px-1 -mx-1 hover:bg-gray-100 ${className}`}
      title="Double-click to edit"
    >
      <span className="flex items-center gap-1">
        {displayValue || <span className="text-gray-400 italic">{placeholder}</span>}
        <svg
          className="h-3 w-3 text-gray-400 opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </span>
    </div>
  );
}
