'use client';

import { useState, useRef } from 'react';
import { cycleCaseStyle, calculateEffectiveLength, containsDKI, getCharCountColor } from '@/lib/ad-copy-utils';
import { HEADLINE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/types/ad-generation';

interface AdFieldInputProps {
  index: number;
  value: string;
  type: 'headline' | 'description';
  onChange: (value: string) => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  canDelete: boolean;
  isRegenerating?: boolean;
}

export default function AdFieldInput({
  index,
  value,
  type,
  onChange,
  onDelete,
  onRegenerate,
  canDelete,
  isRegenerating = false,
}: AdFieldInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const maxLength = type === 'headline' ? HEADLINE_MAX_LENGTH : DESCRIPTION_MAX_LENGTH;
  const effectiveLength = calculateEffectiveLength(value);
  const isOverLimit = effectiveLength > maxLength;
  const hasDKI = containsDKI(value);
  const charCountColor = getCharCountColor(effectiveLength, maxLength);

  const handleCaseToggle = () => {
    onChange(cycleCaseStyle(value));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  const InputComponent = type === 'headline' ? 'input' : 'textarea';

  return (
    <div className="group flex items-start gap-2">
      {/* Index indicator */}
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mt-2.5 ${
          value.trim()
            ? isOverLimit
              ? 'bg-danger/20 text-danger'
              : 'bg-success/20 text-success'
            : 'bg-surface2 text-text3'
        }`}
      >
        {index + 1}
      </div>

      {/* Input field */}
      <div className="flex-1 relative">
        <InputComponent
          ref={inputRef as any}
          type={type === 'headline' ? 'text' : undefined}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={`${type === 'headline' ? 'Headline' : 'Description'} ${index + 1}`}
          rows={type === 'description' ? 2 : undefined}
          disabled={isRegenerating}
          className={`w-full px-3 py-2 bg-surface2 border rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 transition-all resize-none ${
            hasDKI ? 'pr-24' : 'pr-14'
          } ${
            isOverLimit
              ? 'border-danger focus:ring-danger/50'
              : isFocused
                ? 'border-accent focus:ring-accent/50'
                : 'border-divider hover:border-accent/50'
          } ${isRegenerating ? 'opacity-50' : ''}`}
        />

        {/* Right side indicators */}
        <div className={`absolute right-3 ${type === 'headline' ? 'top-2' : 'bottom-2'} flex items-center gap-1.5`}>
          {/* DKI indicator */}
          {hasDKI && (
            <span className="px-1.5 py-0.5 bg-accent/20 text-accent text-[10px] font-medium rounded">
              DKI
            </span>
          )}
          {/* Character count */}
          <span className={`text-xs font-medium ${charCountColor}`}>
            {effectiveLength}/{maxLength}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1.5">
        {/* Case toggle */}
        <button
          onClick={handleCaseToggle}
          disabled={!value.trim() || isRegenerating}
          className="p-1.5 text-text3 hover:text-text hover:bg-surface2 rounded transition-colors disabled:opacity-30"
          title="Toggle case (Title/UPPER/lower)"
        >
          <span className="text-xs font-bold w-5 h-5 flex items-center justify-center">Aa</span>
        </button>

        {/* Copy */}
        <button
          onClick={handleCopy}
          disabled={!value.trim() || isRegenerating}
          className="p-1.5 text-text3 hover:text-text hover:bg-surface2 rounded transition-colors disabled:opacity-30"
          title="Copy"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>

        {/* Paste */}
        <button
          onClick={handlePaste}
          disabled={isRegenerating}
          className="p-1.5 text-text3 hover:text-text hover:bg-surface2 rounded transition-colors disabled:opacity-30"
          title="Paste"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </button>

        {/* Regenerate */}
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="p-1.5 text-text3 hover:text-accent hover:bg-accent/10 rounded transition-colors disabled:opacity-30"
            title="Regenerate with AI"
          >
            {isRegenerating ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </button>
        )}

        {/* Delete */}
        {canDelete && (
          <button
            onClick={onDelete}
            disabled={isRegenerating}
            className="p-1.5 text-text3 hover:text-danger hover:bg-danger/10 rounded transition-colors disabled:opacity-30"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
