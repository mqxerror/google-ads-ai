'use client';

import React from 'react';

export interface CardOption<T = string> {
  value: T;
  icon?: string;
  title: string;
  description: string;
  features?: string[];
  badge?: string;
  disabled?: boolean;
  recommended?: boolean;
}

interface SelectableCardGridProps<T = string> {
  options: CardOption<T>[];
  selected: T | T[];
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
  multiSelect?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showFeatures?: boolean;
  label?: string;
  required?: boolean;
  className?: string;
}

/**
 * Reusable selectable card grid component
 * Use in: Campaign type selection, goal selection, bidding strategy, ad format selection
 */
export function SelectableCardGrid<T = string>({
  options,
  selected,
  onChange,
  columns = 3,
  multiSelect = false,
  size = 'md',
  showFeatures = false,
  label,
  required = false,
  className = '',
}: SelectableCardGridProps<T>) {
  const isSelected = (value: T): boolean => {
    if (multiSelect && Array.isArray(selected)) {
      return selected.includes(value);
    }
    return selected === value;
  };

  const handleClick = (value: T, disabled?: boolean) => {
    if (disabled) return;
    onChange(value);
  };

  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns];

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  }[size];

  const iconSizeClass = {
    sm: 'text-xl mb-1',
    md: 'text-2xl mb-2',
    lg: 'text-3xl mb-3',
  }[size];

  const titleSizeClass = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  const descSizeClass = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size];

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text mb-3">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}

      <div className={`grid ${gridColsClass} gap-3`}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => handleClick(option.value, option.disabled)}
            disabled={option.disabled}
            className={`${sizeClasses} rounded-lg border-2 transition-all text-left relative ${
              isSelected(option.value)
                ? 'border-accent bg-accent/10'
                : option.disabled
                  ? 'border-divider bg-surface2/50 opacity-50 cursor-not-allowed'
                  : 'border-divider bg-surface2 hover:border-accent/50'
            }`}
          >
            {/* Recommended badge */}
            {option.recommended && (
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-accent text-white text-[10px] rounded-full font-medium">
                Recommended
              </span>
            )}

            {/* Custom badge */}
            {option.badge && !option.recommended && (
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-surface2 border border-divider text-text3 text-[10px] rounded-full">
                {option.badge}
              </span>
            )}

            {/* Icon */}
            {option.icon && <div className={iconSizeClass}>{option.icon}</div>}

            {/* Title */}
            <div className={`font-medium text-text ${titleSizeClass}`}>{option.title}</div>

            {/* Description */}
            <div className={`text-text3 mt-1 ${descSizeClass}`}>{option.description}</div>

            {/* Features list */}
            {showFeatures && option.features && option.features.length > 0 && (
              <ul className="mt-2 space-y-1">
                {option.features.map((feature, i) => (
                  <li key={i} className="text-[10px] text-text3 flex items-center gap-1">
                    <svg
                      className="w-3 h-3 text-success flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            )}

            {/* Selection indicator */}
            {isSelected(option.value) && (
              <div className="absolute top-2 right-2">
                <svg
                  className="w-5 h-5 text-accent"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SelectableCardGrid;
