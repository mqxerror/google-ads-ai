'use client';

import React from 'react';
import { AD_TEXT_LIMITS, getTextValidationStatus, getRemainingChars } from '@/constants/ad-limits';

interface DescriptionInputProps {
  descriptions: string[];
  onChange: (descriptions: string[]) => void;
  minCount?: number;
  maxCount?: number;
  maxLength?: number;
  label?: string;
  placeholder?: string;
  helperText?: string;
  useTextarea?: boolean;
  className?: string;
}

/**
 * Reusable description input component with character counter
 * Use in: Search, PMax, Display, Demand Gen, Video campaigns
 */
export function DescriptionInput({
  descriptions,
  onChange,
  minCount = AD_TEXT_LIMITS.DESCRIPTION_MIN_COUNT,
  maxCount = AD_TEXT_LIMITS.DESCRIPTION_MAX_COUNT,
  maxLength = AD_TEXT_LIMITS.DESCRIPTION_MAX_LENGTH,
  label = 'Descriptions',
  placeholder = 'Enter description',
  helperText,
  useTextarea = false,
  className = '',
}: DescriptionInputProps) {
  const updateDescription = (index: number, value: string) => {
    const newDescriptions = [...descriptions];
    newDescriptions[index] = value;
    onChange(newDescriptions);
  };

  const addDescription = () => {
    if (descriptions.length < maxCount) {
      onChange([...descriptions, '']);
    }
  };

  const removeDescription = (index: number) => {
    if (descriptions.length > minCount) {
      const newDescriptions = descriptions.filter((_, i) => i !== index);
      onChange(newDescriptions);
    }
  };

  const validDescriptions = descriptions.filter(
    (d) => d.trim().length > 0 && d.length <= maxLength
  ).length;

  const getStatusColor = (text: string) => {
    const status = getTextValidationStatus(text, maxLength);
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
    const status = getTextValidationStatus(text, maxLength);
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
            ({validDescriptions}/{minCount} required, {maxCount} max)
          </span>
        </label>
        {descriptions.length < maxCount && (
          <button
            type="button"
            onClick={addDescription}
            className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add description
          </button>
        )}
      </div>

      <div className="space-y-2">
        {descriptions.map((description, index) => (
          <div key={index} className="relative group">
            {useTextarea ? (
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => updateDescription(index, e.target.value)}
                  placeholder={`${placeholder} ${index + 1}`}
                  rows={2}
                  className={`w-full px-4 py-2.5 bg-surface2 border rounded-lg text-text text-sm focus:outline-none focus:ring-2 transition-all resize-none ${getInputBorderClass(
                    description
                  )}`}
                />
                <div className="absolute right-3 bottom-2 flex items-center gap-2">
                  <span className={`text-xs ${getStatusColor(description)}`}>
                    {getRemainingChars(description, maxLength)}
                  </span>
                  {descriptions.length > minCount && (
                    <button
                      type="button"
                      onClick={() => removeDescription(index)}
                      className="opacity-0 group-hover:opacity-100 text-text3 hover:text-danger transition-all p-1"
                      title="Remove description"
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
            ) : (
              <>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => updateDescription(index, e.target.value)}
                  placeholder={`${placeholder} ${index + 1}`}
                  maxLength={maxLength + 10} // Allow typing over to show error
                  className={`w-full px-4 py-2.5 pr-20 bg-surface2 border rounded-lg text-text text-sm focus:outline-none focus:ring-2 transition-all ${getInputBorderClass(
                    description
                  )}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className={`text-xs ${getStatusColor(description)}`}>
                    {getRemainingChars(description, maxLength)}
                  </span>
                  {descriptions.length > minCount && (
                    <button
                      type="button"
                      onClick={() => removeDescription(index)}
                      className="opacity-0 group-hover:opacity-100 text-text3 hover:text-danger transition-all p-1"
                      title="Remove description"
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
              </>
            )}
          </div>
        ))}
      </div>

      {/* Helper text and validation summary */}
      <div className="mt-2 space-y-1">
        {helperText && <p className="text-xs text-text3">{helperText}</p>}
        {validDescriptions < minCount && (
          <p className="text-xs text-warning flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Need {minCount - validDescriptions} more valid description
            {minCount - validDescriptions !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default DescriptionInput;
