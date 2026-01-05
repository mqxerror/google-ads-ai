'use client';

import React from 'react';

interface SearchAdPreviewProps {
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  displayPath1?: string;
  displayPath2?: string;
  businessName?: string;
  sitelinks?: Array<{ text: string; url?: string }>;
  callouts?: string[];
  variant?: 'desktop' | 'mobile';
  className?: string;
}

/**
 * Google Search Ad Preview (SERP mockup)
 * Renders a realistic preview of how a search ad will appear
 */
export function SearchAdPreview({
  headlines,
  descriptions,
  finalUrl,
  displayPath1 = '',
  displayPath2 = '',
  businessName,
  sitelinks = [],
  callouts = [],
  variant = 'desktop',
  className = '',
}: SearchAdPreviewProps) {
  // Get display URL from final URL
  const getDisplayUrl = () => {
    try {
      const url = new URL(finalUrl);
      let displayUrl = url.hostname.replace('www.', '');
      if (displayPath1) {
        displayUrl += `/${displayPath1}`;
        if (displayPath2) {
          displayUrl += `/${displayPath2}`;
        }
      }
      return displayUrl;
    } catch {
      return finalUrl || 'example.com';
    }
  };

  // Combine headlines with separator
  const displayHeadline = headlines
    .filter((h) => h.trim())
    .slice(0, 3)
    .join(' | ');

  // Combine descriptions
  const displayDescription = descriptions
    .filter((d) => d.trim())
    .slice(0, 2)
    .join(' ');

  const isMobile = variant === 'mobile';

  return (
    <div className={`${className}`}>
      {/* Preview header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-text3">
          {isMobile ? 'Mobile Preview' : 'Desktop Preview'}
        </span>
        <span className="px-1.5 py-0.5 bg-surface2 text-[10px] text-text3 rounded">
          Google Search
        </span>
      </div>

      {/* Google SERP card */}
      <div
        className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 ${
          isMobile ? 'max-w-[360px]' : 'max-w-[600px]'
        }`}
      >
        {/* Ad label + URL line */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold text-black bg-white border border-gray-400 rounded px-1">
            Ad
          </span>
          <span className="text-[13px] text-[#202124] truncate flex items-center gap-1">
            {businessName && (
              <>
                <span className="font-medium">{businessName}</span>
                <span className="text-gray-500">·</span>
              </>
            )}
            <span className="text-[#4d5156]">{getDisplayUrl()}</span>
          </span>
        </div>

        {/* Headline */}
        <div className="mb-1">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className={`text-[#1a0dab] hover:underline font-normal leading-tight ${
              isMobile ? 'text-[18px]' : 'text-[20px]'
            }`}
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            {displayHeadline || 'Your Headline Will Appear Here'}
          </a>
        </div>

        {/* Description */}
        <div
          className={`text-[#4d5156] leading-snug ${isMobile ? 'text-[13px]' : 'text-[14px]'}`}
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {displayDescription || 'Your description text will appear here. Write compelling copy to attract clicks.'}
        </div>

        {/* Callouts */}
        {callouts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {callouts.slice(0, 4).map((callout, i) => (
              <span
                key={i}
                className="text-[12px] text-[#4d5156]"
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                {callout}
              </span>
            ))}
          </div>
        )}

        {/* Sitelinks */}
        {sitelinks.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className={`grid ${isMobile ? 'grid-cols-1 gap-1' : 'grid-cols-2 gap-x-6 gap-y-1'}`}>
              {sitelinks.slice(0, 4).map((sitelink, i) => (
                <a
                  key={i}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-[#1a0dab] text-[14px] hover:underline"
                  style={{ fontFamily: 'Arial, sans-serif' }}
                >
                  {sitelink.text}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview info */}
      <div className="mt-3 p-2 bg-accent/5 rounded border border-accent/20">
        <p className="text-[10px] text-text3 flex items-start gap-1.5">
          <span>💡</span>
          <span>
            Google may show different combinations of your headlines and descriptions.
            This preview shows one possible variation.
          </span>
        </p>
      </div>
    </div>
  );
}

export default SearchAdPreview;
