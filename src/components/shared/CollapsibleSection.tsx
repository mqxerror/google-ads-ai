'use client';

import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  icon?: string;
  badge?: string;
  badgeColor?: 'accent' | 'success' | 'warning' | 'danger' | 'text3';
  defaultOpen?: boolean;
  variant?: 'default' | 'subtle' | 'bordered';
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable collapsible section component
 * Use in: Advanced settings, optional configurations across all campaign types
 */
export function CollapsibleSection({
  title,
  icon,
  badge,
  badgeColor = 'text3',
  defaultOpen = false,
  variant = 'default',
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const variantClasses = {
    default: 'bg-surface2 rounded-lg border border-divider',
    subtle: 'bg-transparent',
    bordered: 'bg-surface rounded-lg border-2 border-divider',
  }[variant];

  const headerPadding = {
    default: 'px-4 py-3',
    subtle: 'py-2',
    bordered: 'px-4 py-3',
  }[variant];

  const contentPadding = {
    default: 'px-4 pb-4',
    subtle: 'pb-2',
    bordered: 'px-4 pb-4',
  }[variant];

  const badgeColorClasses = {
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    text3: 'bg-surface text-text3',
  }[badgeColor];

  return (
    <div className={`${variantClasses} ${className}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${headerPadding} flex items-center justify-between group`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="font-medium text-text text-sm">{title}</span>
          {badge && (
            <span className={`px-2 py-0.5 text-[10px] rounded-full ${badgeColorClasses}`}>
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-text3 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className={contentPadding}>{children}</div>
      </div>
    </div>
  );
}

export default CollapsibleSection;
