'use client';

import React from 'react';

interface DisplayAdPreviewProps {
  headline: string;
  description?: string;
  businessName: string;
  imageUrl?: string;
  logoUrl?: string;
  callToAction?: string;
  finalUrl: string;
  format?: 'square' | 'landscape' | 'portrait' | 'leaderboard' | 'skyscraper';
}

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  square: { width: 300, height: 250 },
  landscape: { width: 336, height: 280 },
  portrait: { width: 160, height: 600 },
  leaderboard: { width: 728, height: 90 },
  skyscraper: { width: 300, height: 600 },
};

export function DisplayAdPreview({
  headline,
  description,
  businessName,
  imageUrl,
  logoUrl,
  callToAction = 'Learn More',
  finalUrl,
  format = 'square',
}: DisplayAdPreviewProps) {
  const dimensions = FORMAT_DIMENSIONS[format];
  const isVertical = format === 'portrait' || format === 'skyscraper';
  const isLeaderboard = format === 'leaderboard';

  // Scale down for preview while maintaining aspect ratio
  const scale = 0.8;
  const previewWidth = dimensions.width * scale;
  const previewHeight = dimensions.height * scale;

  return (
    <div className="inline-block">
      <div
        className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm relative"
        style={{ width: previewWidth, height: previewHeight }}
      >
        {/* Image Background */}
        {imageUrl && (
          <div className="absolute inset-0">
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className={`absolute inset-0 flex ${isVertical ? 'flex-col' : isLeaderboard ? 'flex-row items-center' : 'flex-col'} p-3`}>
          {/* Logo and Business Name (top) */}
          {!isLeaderboard && (
            <div className="flex items-center gap-2 mb-auto">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={businessName}
                  className="w-6 h-6 rounded-full object-cover bg-white"
                />
              )}
              <span className="text-xs text-white font-medium truncate">
                {businessName}
              </span>
            </div>
          )}

          {/* Leaderboard layout */}
          {isLeaderboard && (
            <>
              {/* Left: Logo and text */}
              <div className="flex items-center gap-3 flex-1">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={businessName}
                    className="w-10 h-10 rounded-full object-cover bg-white"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">{headline}</h4>
                  {description && (
                    <p className="text-xs text-white/80 truncate">{description}</p>
                  )}
                </div>
              </div>

              {/* Right: CTA */}
              <button className="px-4 py-1.5 bg-white text-blue-600 text-xs font-medium rounded hover:bg-gray-100 whitespace-nowrap">
                {callToAction}
              </button>
            </>
          )}

          {/* Standard/Vertical layout - Bottom content */}
          {!isLeaderboard && (
            <div className="mt-auto">
              <h4 className={`font-bold text-white leading-tight ${isVertical ? 'text-sm' : 'text-base'} line-clamp-2`}>
                {headline}
              </h4>
              {description && !isVertical && (
                <p className="text-xs text-white/80 mt-1 line-clamp-2">
                  {description}
                </p>
              )}

              {/* CTA Button */}
              <button className="mt-2 px-3 py-1.5 bg-white text-blue-600 text-xs font-medium rounded hover:bg-gray-100">
                {callToAction}
              </button>
            </div>
          )}
        </div>

        {/* Ad indicator */}
        <div className="absolute top-1 right-1">
          <span className="px-1 py-0.5 text-[8px] bg-white/80 text-gray-600 rounded">
            Ad
          </span>
        </div>
      </div>

      {/* Format label */}
      <div className="text-center mt-2 text-xs text-text3">
        {dimensions.width} × {dimensions.height}
      </div>
    </div>
  );
}

export default DisplayAdPreview;
