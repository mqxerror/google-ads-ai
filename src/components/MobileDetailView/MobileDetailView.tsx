'use client';

import { useState, ReactNode } from 'react';

export interface DetailSection {
  id: string;
  title: string;
  icon?: React.ReactNode;
  content: ReactNode;
  badge?: string | number;
}

interface MobileDetailViewProps {
  title: string;
  subtitle?: string;
  status?: {
    label: string;
    color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  };
  sections: DetailSection[];
  actions?: ReactNode;
  onClose?: () => void;
  headerContent?: ReactNode;
}

export default function MobileDetailView({
  title,
  subtitle,
  status,
  sections,
  actions,
  onClose,
  headerContent,
}: MobileDetailViewProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '');

  const statusColors = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header - sticky */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        {/* Close button and title */}
        <div className="flex items-center gap-3 px-4 py-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 -ml-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-500 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {status && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[status.color]}`}>
              {status.label}
            </span>
          )}
        </div>

        {/* Optional header content (e.g., key metrics) */}
        {headerContent && (
          <div className="px-4 pb-3">
            {headerContent}
          </div>
        )}

        {/* Section tabs - horizontal scroll on mobile */}
        <div className="flex overflow-x-auto scrollbar-hide border-t border-gray-100">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeSection === section.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {section.icon && <span className="h-4 w-4">{section.icon}</span>}
              <span>{section.title}</span>
              {section.badge !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  activeSection === section.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {section.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div
            key={section.id}
            className={activeSection === section.id ? 'block' : 'hidden'}
          >
            {section.content}
          </div>
        ))}
      </div>

      {/* Floating action button area - mobile */}
      {actions && (
        <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3">
          {actions}
        </div>
      )}
    </div>
  );
}

// Reusable section content components

interface MetricGridProps {
  metrics: {
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
  }[];
}

export function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="rounded-lg bg-gray-50 p-3"
        >
          <div className="text-xs text-gray-500 mb-1">
            {metric.label}
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {metric.value}
          </div>
          {metric.change !== undefined && (
            <div className={`text-xs flex items-center gap-1 mt-1 ${
              metric.change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={metric.change >= 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}
                />
              </svg>
              {Math.abs(metric.change)}% {metric.changeLabel || ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface InfoListProps {
  items: {
    label: string;
    value: ReactNode;
  }[];
}

export function InfoList({ items }: InfoListProps) {
  return (
    <div className="divide-y divide-gray-100">
      {items.map((item, index) => (
        <div key={index} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-500">
            {item.label}
          </span>
          <span className="text-sm font-medium text-gray-900">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

interface ActionCardProps {
  icon: ReactNode;
  title: string;
  description?: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
}

export function ActionCard({ icon, title, description, onClick, variant = 'default' }: ActionCardProps) {
  const variantClasses = {
    default: 'hover:bg-gray-50',
    primary: 'bg-blue-50 hover:bg-blue-100',
    danger: 'bg-red-50 hover:bg-red-100',
  };

  const iconColors = {
    default: 'text-gray-600',
    primary: 'text-blue-600',
    danger: 'text-red-600',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-4 text-left rounded-lg transition-colors ${variantClasses[variant]}`}
    >
      <span className={`flex-shrink-0 ${iconColors[variant]}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">
          {title}
        </div>
        {description && (
          <div className="text-xs text-gray-500">
            {description}
          </div>
        )}
      </div>
      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
