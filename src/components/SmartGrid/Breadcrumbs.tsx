'use client';

import { useDrillDown } from '@/contexts/DrillDownContext';

export default function Breadcrumbs() {
  const { breadcrumbs, navigateToBreadcrumb, goBack, currentLevel } = useDrillDown();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
      {/* Back button */}
      <button
        onClick={goBack}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-200"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="h-4 w-px bg-gray-300" />

      {/* Breadcrumb trail */}
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const isClickable = !isLast;

          return (
            <span key={`${crumb.type}-${crumb.id || 'root'}`} className="flex items-center gap-1">
              {index > 0 && (
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isClickable ? (
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {crumb.name}
                </button>
              ) : (
                <span className="font-medium text-gray-900">{crumb.name}</span>
              )}
            </span>
          );
        })}
      </nav>

      {/* Current level indicator */}
      <div className="ml-auto">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          {currentLevel === 'campaigns' && 'Campaigns'}
          {currentLevel === 'adGroups' && 'Ad Groups'}
          {currentLevel === 'keywords' && 'Keywords'}
        </span>
      </div>
    </div>
  );
}
