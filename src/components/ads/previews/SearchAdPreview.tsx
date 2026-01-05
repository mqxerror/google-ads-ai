'use client';

import React from 'react';

interface SearchAdPreviewProps {
  headlines: string[];
  descriptions: string[];
  displayUrl?: string;
  finalUrl: string;
  path1?: string;
  path2?: string;
  sitelinks?: { title: string; description?: string }[];
  callouts?: string[];
  variant?: 'desktop' | 'mobile';
}

export function SearchAdPreview({
  headlines,
  descriptions,
  displayUrl,
  finalUrl,
  path1,
  path2,
  sitelinks = [],
  callouts = [],
  variant = 'desktop',
}: SearchAdPreviewProps) {
  // Use first 3 headlines and first 2 descriptions
  const displayHeadlines = headlines.slice(0, 3).filter(Boolean);
  const displayDescriptions = descriptions.slice(0, 2).filter(Boolean);

  // Build display URL
  const baseUrl = displayUrl || new URL(finalUrl).hostname;
  const pathParts = [path1, path2].filter(Boolean);
  const fullDisplayUrl = pathParts.length > 0
    ? `${baseUrl}/${pathParts.join('/')}`
    : baseUrl;

  const isMobile = variant === 'mobile';

  return (
    <div className={`${isMobile ? 'max-w-[360px]' : 'max-w-[600px]'} bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200`}>
      {/* Search bar mockup */}
      <div className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">G</span>
            <span className="text-lg font-medium text-gray-500">oogle</span>
          </div>
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-600">
            {displayHeadlines[0]?.split(' ').slice(0, 3).join(' ')}...
          </div>
        </div>
      </div>

      {/* Ad result */}
      <div className="p-4 hover:bg-gray-50">
        {/* Ad label and URL */}
        <div className="flex items-center gap-2 mb-1">
          <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-black rounded">
            Sponsored
          </span>
          <span className="text-sm text-gray-700">{fullDisplayUrl}</span>
        </div>

        {/* Headlines */}
        <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} text-blue-800 hover:underline cursor-pointer leading-tight mb-1`}>
          {displayHeadlines.join(' | ')}
        </h3>

        {/* Descriptions */}
        <p className="text-sm text-gray-600 leading-relaxed">
          {displayDescriptions.join(' ')}
        </p>

        {/* Sitelinks */}
        {sitelinks.length > 0 && (
          <div className={`mt-3 grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-x-4 gap-y-2'}`}>
            {sitelinks.slice(0, 4).map((link, i) => (
              <div key={i}>
                <span className="text-blue-800 text-sm hover:underline cursor-pointer">
                  {link.title}
                </span>
                {link.description && !isMobile && (
                  <p className="text-xs text-gray-600">{link.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Callouts */}
        {callouts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {callouts.slice(0, 4).map((callout, i) => (
              <span key={i} className="text-xs text-gray-600">
                {callout}{i < callouts.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchAdPreview;
