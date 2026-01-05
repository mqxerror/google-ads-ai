'use client';

import React from 'react';
import type { FormatConfig, PreviewData } from '@/types/ad-preview';

interface SearchPreviewProps {
  format: FormatConfig;
  data: PreviewData;
  scale?: number;
  className?: string;
}

/**
 * Google Search ad preview component
 * Renders desktop and mobile SERP styles
 */
export function SearchPreview({
  format,
  data,
  scale = 1,
  className = '',
}: SearchPreviewProps) {
  const isMobile = format.id === 'search-mobile';

  return (
    <div className={`inline-block ${className}`}>
      {/* Format label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text3">{format.name}</span>
        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[10px] rounded">
          Search
        </span>
      </div>

      {isMobile ? (
        <MobileSearchPreview data={data} scale={scale} />
      ) : (
        <DesktopSearchPreview data={data} scale={scale} />
      )}
    </div>
  );
}

/**
 * Desktop Search SERP preview
 */
function DesktopSearchPreview({
  data,
  scale = 1,
}: {
  data: PreviewData;
  scale?: number;
}) {
  const { headlines, descriptions, finalUrl, displayPath1, displayPath2, businessName } = data;

  const headline1 = headlines[0] || 'Your First Headline';
  const headline2 = headlines[1] || 'Your Second Headline';
  const headline3 = headlines[2] || '';
  const description1 = descriptions[0] || 'Your first description line goes here.';
  const description2 = descriptions[1] || 'Your second description line.';

  // Build display URL
  const displayUrl = finalUrl
    ? (() => {
        try {
          const url = new URL(finalUrl);
          let path = url.hostname.replace('www.', '');
          if (displayPath1) path += ` › ${displayPath1}`;
          if (displayPath2) path += ` › ${displayPath2}`;
          return path;
        } catch {
          return 'example.com';
        }
      })()
    : 'example.com';

  return (
    <div
      className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"
      style={{ width: 600 * scale }}
    >
      {/* Google Search Header mockup */}
      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔍</span>
          <span className="text-[#5f6368] text-sm">Google</span>
        </div>
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-600">
          {businessName?.toLowerCase().replace(/\s+/g, ' ') || 'search query'}
        </div>
      </div>

      {/* Ad Result */}
      <div className="max-w-[600px]">
        {/* Sponsored label & URL */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold text-[#202124] bg-white border border-gray-300 rounded px-1">
            Sponsored
          </span>
        </div>

        {/* URL line */}
        <div className="flex items-center gap-1 mb-1">
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-[10px] text-gray-500">🌐</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[#202124]">{businessName || 'Your Business'}</span>
            <span className="text-xs text-[#4d5156]">{displayUrl}</span>
          </div>
          <span className="text-gray-400 ml-1">⋮</span>
        </div>

        {/* Headlines (clickable title) */}
        <h3 className="text-xl text-[#1a0dab] hover:underline cursor-pointer leading-snug mb-1">
          {headline1}
          {headline2 && ` | ${headline2}`}
          {headline3 && ` | ${headline3}`}
        </h3>

        {/* Descriptions */}
        <p className="text-sm text-[#4d5156] leading-relaxed">
          {description1}
          {description2 && ` ${description2}`}
        </p>
      </div>
    </div>
  );
}

/**
 * Mobile Search SERP preview
 */
function MobileSearchPreview({
  data,
  scale = 1,
}: {
  data: PreviewData;
  scale?: number;
}) {
  const { headlines, descriptions, finalUrl, displayPath1, displayPath2, businessName } = data;

  const headline1 = headlines[0] || 'Your First Headline';
  const headline2 = headlines[1] || 'Your Second Headline';
  const description1 = descriptions[0] || 'Your first description line goes here.';

  // Build display URL
  const displayUrl = finalUrl
    ? (() => {
        try {
          const url = new URL(finalUrl);
          let path = url.hostname.replace('www.', '');
          if (displayPath1) path += ` › ${displayPath1}`;
          if (displayPath2) path += ` › ${displayPath2}`;
          return path;
        } catch {
          return 'example.com';
        }
      })()
    : 'example.com';

  return (
    <div
      className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
      style={{ width: 375 * scale }}
    >
      {/* Phone status bar */}
      <div className="bg-gray-100 px-4 py-2 flex items-center justify-between text-xs text-gray-600">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>

      {/* Google Search bar */}
      <div className="p-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5">
          <span className="text-lg">🔍</span>
          <span className="text-sm text-gray-600 flex-1">
            {businessName?.toLowerCase() || 'search query'}
          </span>
          <span className="text-lg">🎤</span>
        </div>
      </div>

      {/* Search tabs */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs border-b border-gray-100">
        <span className="text-blue-600 border-b-2 border-blue-600 pb-1">All</span>
        <span className="text-gray-600">Images</span>
        <span className="text-gray-600">Videos</span>
        <span className="text-gray-600">News</span>
      </div>

      {/* Ad Result */}
      <div className="p-4">
        {/* Sponsored label */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold text-[#202124] bg-white border border-gray-300 rounded px-1">
            Sponsored
          </span>
        </div>

        {/* URL & favicon */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-xs">🌐</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[#202124]">{businessName || 'Your Business'}</span>
            <span className="text-[10px] text-[#4d5156]">{displayUrl}</span>
          </div>
        </div>

        {/* Headlines */}
        <h3 className="text-lg text-[#1a0dab] leading-snug mb-2">
          {headline1}
          {headline2 && ` | ${headline2}`}
        </h3>

        {/* Description */}
        <p className="text-sm text-[#4d5156] line-clamp-3">
          {description1}
        </p>
      </div>

      {/* Bottom nav mockup */}
      <div className="border-t border-gray-200 py-3 flex justify-center">
        <div className="w-32 h-1 bg-gray-300 rounded-full" />
      </div>
    </div>
  );
}

export default SearchPreview;
