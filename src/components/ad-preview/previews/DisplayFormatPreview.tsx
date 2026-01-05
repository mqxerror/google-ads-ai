'use client';

import React from 'react';
import type { FormatConfig, PreviewData } from '@/types/ad-preview';

interface DisplayFormatPreviewProps {
  format: FormatConfig;
  data: PreviewData;
  scale?: number;
  className?: string;
}

/**
 * Display Network ad preview component
 * Renders ads in various display format sizes (300x250, 728x90, etc.)
 */
export function DisplayFormatPreview({
  format,
  data,
  scale = 1,
  className = '',
}: DisplayFormatPreviewProps) {
  const { headlines, descriptions, images, logos, businessName, finalUrl } = data;

  const primaryImage = images[0]?.previewUrl || images[0]?.fileUrl;
  const logoUrl = logos[0]?.previewUrl || logos[0]?.fileUrl;
  const headline = headlines.find((h) => h.trim()) || 'Your Headline';
  const description = descriptions.find((d) => d.trim()) || 'Your description text here';

  // Extract domain from URL
  const displayDomain = finalUrl
    ? (() => {
        try {
          return new URL(finalUrl).hostname.replace('www.', '');
        } catch {
          return 'example.com';
        }
      })()
    : 'example.com';

  const scaledWidth = format.width * scale;
  const scaledHeight = format.height * scale;

  // Different layouts based on format dimensions
  const isLeaderboard = format.id === 'display-728x90' || format.id === 'display-320x50';
  const isSkyscraper = format.id === 'display-160x600' || format.id === 'display-300x600';

  return (
    <div className={`inline-block ${className}`}>
      {/* Format label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text3">{format.name}</span>
        <span className="px-1.5 py-0.5 bg-surface2 text-[10px] text-text3 rounded">
          {format.width}x{format.height}
        </span>
      </div>

      {/* Ad preview container */}
      <div
        className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 relative"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        {/* Sponsored label */}
        <span className="absolute top-1 left-1 z-10 text-[9px] font-bold text-gray-600 bg-white/90 rounded px-1">
          Ad
        </span>

        {isLeaderboard ? (
          // Horizontal layout for leaderboard/banner formats
          <div className="flex h-full">
            {/* Image section (40%) */}
            <div className="w-[40%] h-full bg-gray-100 relative flex-shrink-0">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt="Ad"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <span className="text-2xl">🖼️</span>
                </div>
              )}
            </div>

            {/* Content section (60%) */}
            <div className="flex-1 p-2 flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-4 h-4 rounded object-contain flex-shrink-0"
                  />
                )}
                <span
                  className="text-[10px] font-medium text-[#202124] truncate"
                  style={{ fontSize: Math.max(10 * scale, 8) }}
                >
                  {headline}
                </span>
              </div>
              <p
                className="text-[8px] text-[#4d5156] line-clamp-1"
                style={{ fontSize: Math.max(8 * scale, 6) }}
              >
                {description}
              </p>
              <span
                className="text-[7px] text-[#1a73e8] mt-0.5"
                style={{ fontSize: Math.max(7 * scale, 5) }}
              >
                {displayDomain}
              </span>
            </div>
          </div>
        ) : isSkyscraper ? (
          // Vertical layout for skyscraper formats
          <div className="flex flex-col h-full">
            {/* Image section (60%) */}
            <div className="h-[60%] bg-gray-100 relative">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt="Ad"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <span className="text-3xl">🖼️</span>
                </div>
              )}
            </div>

            {/* Content section (40%) */}
            <div className="flex-1 p-2 flex flex-col">
              <div className="flex items-center gap-1.5 mb-1">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-5 h-5 rounded object-contain flex-shrink-0"
                  />
                )}
                <span className="text-[9px] text-[#70757a]">
                  {businessName || displayDomain}
                </span>
              </div>
              <h3 className="text-[11px] font-medium text-[#202124] line-clamp-2 mb-1">
                {headline}
              </h3>
              <p className="text-[9px] text-[#4d5156] line-clamp-3 flex-1">
                {description}
              </p>
              <button className="mt-auto px-2 py-1 bg-[#1a73e8] text-white text-[9px] rounded font-medium">
                Learn More
              </button>
            </div>
          </div>
        ) : (
          // Standard rectangle layout (300x250)
          <div className="flex flex-col h-full">
            {/* Image section */}
            <div className="h-[55%] bg-gray-100 relative">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt="Ad"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <span className="text-4xl">🖼️</span>
                </div>
              )}
            </div>

            {/* Content section */}
            <div className="flex-1 p-3">
              <div className="flex items-start gap-2">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-8 h-8 rounded object-contain flex-shrink-0 bg-gray-50"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-medium text-[#202124] line-clamp-1">
                    {headline}
                  </h3>
                  <p className="text-[11px] text-[#4d5156] line-clamp-2 mt-0.5">
                    {description}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-[#70757a]">
                      {businessName || displayDomain}
                    </span>
                    <span className="text-[10px] text-[#1a73e8] font-medium">
                      Learn more
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DisplayFormatPreview;
