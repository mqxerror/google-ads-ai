'use client';

import { useState, useRef, useEffect } from 'react';
import { PATH_MAX_LENGTH } from '@/types/ad-generation';

interface DKIInsertButtonProps {
  onInsert: (dkiToken: string) => void;
  disabled?: boolean;
  maxFallbackLength?: number;
}

export default function DKIInsertButton({ onInsert, disabled = false, maxFallbackLength = 15 }: DKIInsertButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fallbackText, setFallbackText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFallbackText('');
        setError(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!fallbackText.trim()) {
      setError('Fallback text is required');
      return;
    }

    if (fallbackText.length > maxFallbackLength) {
      setError(`Fallback must be ${maxFallbackLength} chars or less`);
      return;
    }

    // Check for invalid characters
    if (/[{}]/.test(fallbackText)) {
      setError('Fallback cannot contain { or }');
      return;
    }

    const dkiToken = `{KeyWord:${fallbackText}}`;
    onInsert(dkiToken);
    setIsOpen(false);
    setFallbackText('');
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setFallbackText('');
      setError(null);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Insert Dynamic Keyword Insertion token"
      >
        <span className="text-xs">{'{KeyWord}'}</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-surface border border-divider rounded-lg shadow-lg p-4 w-72">
          <div className="mb-3">
            <h4 className="font-medium text-text text-sm mb-1">Dynamic Keyword Insertion</h4>
            <p className="text-xs text-text3">
              Google will replace {'{KeyWord}'} with the search term. If it doesn&apos;t fit, the fallback text will
              show.
            </p>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-text2 mb-1">Fallback Text *</label>
            <input
              ref={inputRef}
              type="text"
              value={fallbackText}
              onChange={(e) => {
                setFallbackText(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Best Deals"
              maxLength={maxFallbackLength}
              className={`w-full px-3 py-2 bg-surface2 border rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 transition-all ${
                error ? 'border-danger focus:ring-danger/50' : 'border-divider focus:ring-accent/50 focus:border-accent'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {error ? (
                <span className="text-xs text-danger">{error}</span>
              ) : (
                <span className="text-xs text-text3">Shown if keyword is too long</span>
              )}
              <span className={`text-xs ${fallbackText.length > maxFallbackLength ? 'text-danger' : 'text-text3'}`}>
                {fallbackText.length}/{maxFallbackLength}
              </span>
            </div>
          </div>

          <div className="mb-3 p-2 bg-surface2 rounded-lg">
            <div className="text-xs text-text3 mb-1">Preview:</div>
            <div className="text-sm text-text font-mono">
              {fallbackText ? `{KeyWord:${fallbackText}}` : '{KeyWord:...}'}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsOpen(false);
                setFallbackText('');
                setError(null);
              }}
              className="flex-1 px-3 py-2 bg-surface2 text-text text-sm rounded-lg hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!fallbackText.trim()}
              className="flex-1 px-3 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
