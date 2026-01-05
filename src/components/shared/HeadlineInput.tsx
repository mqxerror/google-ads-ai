'use client';

import React from 'react';
import { AD_TEXT_LIMITS, getTextValidationStatus, getRemainingChars } from '@/constants/ad-limits';

interface HeadlineInputProps {
  headlines: string[];
  onChange: (headlines: string[]) => void;
  minCount?: number;
  maxCount?: number;
  maxLength?: number;
  label?: string;
  placeholder?: string;
  helperText?: string;
  showLongHeadlines?: boolean;
  className?: string;
}

/**
 * Reusable headline input component with character counter
 * Use in: Search, PMax, Display, Demand Gen campaigns
 */
export function HeadlineInput({
  headlines,
  onChange,
  minCount = AD_TEXT_LIMITS.HEADLINE_MIN_COUNT,
  maxCount = AD_TEXT_LIMITS.HEADLINE_MAX_COUNT,
  maxLength = AD_TEXT_LIMITS.HEADLINE_MAX_LENGTH,
  label = 'Headlines',
  placeholder = 'Enter headline',
  helperText,
  showLongHeadlines = false,
  className = '',
}: HeadlineInputProps) {
  const effectiveMaxLength = showLongHeadlines
    ? AD_TEXT_LIMITS.LONG_HEADLINE_MAX_LENGTH
    : maxLength;

  const updateHeadline = (index: number, value: string) => {
    const newHeadlines = [...headlines];
    newHeadlines[index] = value;
    onChange(newHeadlines);
  };

  const addHeadline = () => {
    if (headlines.length < maxCount) {
      onChange([...headlines, '']);
    }
  };

  const removeHeadline = (index: number) => {
    if (headlines.length > minCount) {
      const newHeadlines = headlines.filter((_, i) => i !== index);
      onChange(newHeadlines);
    }
  };

  const validHeadlines = headlines.filter(
    (h) => h.trim().length > 0 && h.length <= effectiveMaxLength
  ).length;

  const getStatusColor = (text: string) => {
    const status = getTextValidationStatus(text, effectiveMaxLength);
    switch (status) {
      case 'error':
        return 'text-danger';
      case 'warning':
        return 'text-warning';
      case 'valid':
        return 'text-success';
      default:
        return 'text-text3';
    }
  };

  const getInputBorderClass = (text: string) => {
    const status = getTextValidationStatus(text, effectiveMaxLength);
    switch (status) {
      case 'error':
        return 'border-danger focus:ring-danger';
      case 'warning':
        return 'border-warning focus:ring-warning';
      default:
        return 'border-divider focus:ring-accent';
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-text">
          {label}{' '}
          <span className="text-text3 font-normal">
            ({validHeadlines}/{minCount} required, {maxCount} max)
          </span>
        </label>
        {headlines.length < maxCount && (
          <button
            type="button"
            onClick={addHeadline}
            className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add headline
          </button>
        )}
      </div>

      <div className="space-y-2">
        {headlines.map((headline, index) => (
          <div key={index} className="relative group">
            <input
              type="text"
              value={headline}
              onChange={(e) => updateHeadline(index, e.target.value)}
              placeholder={`${placeholder} ${index + 1}`}
              maxLength={effectiveMaxLength + 10} // Allow typing over to show error
              className={`w-full px-4 py-2.5 pr-20 bg-surface2 border rounded-lg text-text text-sm focus:outline-none focus:ring-2 transition-all ${getInputBorderClass(
                headline
              )}`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className={`text-xs ${getStatusColor(headline)}`}>
                {getRemainingChars(headline, effectiveMaxLength)}
              </span>
              {headlines.length > minCount && (
                <button
                  type="button"
                  onClick={() => removeHeadline(index)}
                  className="opacity-0 group-hover:opacity-100 text-text3 hover:text-danger transition-all p-1"
                  title="Remove headline"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Helper text and validation summary */}
      <div className="mt-2 space-y-1">
        {helperText && <p className="text-xs text-text3">{helperText}</p>}
        {validHeadlines < minCount && (
          <p className="text-xs text-warning flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Need {minCount - validHeadlines} more valid headline
            {minCount - validHeadlines !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default HeadlineInput;
