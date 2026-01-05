'use client';

import React from 'react';
import type { FormatConfig, PreviewData } from '@/types/ad-preview';

interface GmailDiscoverPreviewProps {
  format: FormatConfig;
  data: PreviewData;
  scale?: number;
  className?: string;
}

/**
 * Gmail and Discover feed ad preview component
 */
export function GmailDiscoverPreview({
  format,
  data,
  scale = 1,
  className = '',
}: GmailDiscoverPreviewProps) {
  if (format.id === 'gmail-feed') {
    return <GmailPreview data={data} scale={scale} className={className} />;
  }

  return <DiscoverPreview data={data} scale={scale} className={className} />;
}

/**
 * Gmail Promotions tab ad preview
 */
function GmailPreview({
  data,
  scale = 1,
  className = '',
}: {
  data: PreviewData;
  scale?: number;
  className?: string;
}) {
  const { headlines, descriptions, images, logos, businessName } = data;

  const primaryImage = images[0]?.previewUrl || images[0]?.fileUrl;
  const logoUrl = logos[0]?.previewUrl || logos[0]?.fileUrl;
  const headline = headlines.find((h) => h.trim()) || 'Your Headline';
  const description = descriptions.find((d) => d.trim()) || 'Your description text here';

  return (
    <div className={`inline-block ${className}`}>
      {/* Format label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text3">Gmail Promotions</span>
        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[10px] rounded">
          Gmail
        </span>
      </div>

      {/* Gmail Ad Preview - Collapsed state */}
      <div
        className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200"
        style={{ width: 380 * scale }}
      >
        {/* Collapsed row (like in inbox) */}
        <div className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
          <div className="flex items-center gap-3">
            {/* Checkbox & Star */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-4 h-4 border border-gray-300 rounded" />
              <span className="text-gray-400">☆</span>
            </div>

            {/* Logo */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-8 h-8 rounded object-contain flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {(businessName || 'A')[0]}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                  Ad
                </span>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {businessName || 'Advertiser'}
                </span>
              </div>
              <p className="text-sm text-gray-600 truncate">{headline}</p>
            </div>

            {/* Time */}
            <span className="text-xs text-gray-400 flex-shrink-0">2:30 PM</span>
          </div>
        </div>

        {/* Expanded state preview */}
        <div className="p-4 bg-gray-50">
          <div className="text-[10px] text-gray-500 mb-2 text-center">
            ↑ Collapsed view above | Expanded view below ↓
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Image banner */}
            {primaryImage && (
              <div className="relative" style={{ aspectRatio: '1.91/1' }}>
                <img
                  src={primaryImage}
                  alt="Promo"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-10 h-10 rounded object-contain flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                      Ad
                    </span>
                    <span className="font-medium text-gray-900">
                      {businessName || 'Advertiser'}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-gray-900 mb-1">
                    {headline}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {description}
                  </p>
                </div>
              </div>

              {/* CTA */}
              <button className="mt-3 w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded hover:bg-blue-700">
                Shop Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Google Discover feed ad preview
 */
function DiscoverPreview({
  data,
  scale = 1,
  className = '',
}: {
  data: PreviewData;
  scale?: number;
  className?: string;
}) {
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

  return (
    <div className={`inline-block ${className}`}>
      {/* Format label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text3">Discover Feed</span>
        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[10px] rounded">
          Discover
        </span>
      </div>

      {/* Discover Card Preview */}
      <div
        className="bg-white rounded-xl overflow-hidden shadow-md"
        style={{ width: 340 * scale }}
      >
        {/* Image */}
        <div className="relative" style={{ aspectRatio: '1/1' }}>
          {primaryImage ? (
            <img
              src={primaryImage}
              alt="Discover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <span className="text-5xl">🌐</span>
            </div>
          )}

          {/* Ad label */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-700 text-[10px] font-medium px-2 py-1 rounded-full shadow-sm">
            Ad · {displayDomain}
          </div>

          {/* Gradient overlay for text */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-4 -mt-12 relative">
          <div className="flex items-start gap-3">
            {/* Logo */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-10 h-10 rounded-full object-contain bg-white shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium shadow-md flex-shrink-0">
                {(businessName || displayDomain)[0].toUpperCase()}
              </div>
            )}

            {/* Text */}
            <div className="flex-1 pt-8">
              <h3 className="text-base font-medium text-gray-900 line-clamp-2 mb-1">
                {headline}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {businessName || 'Sponsored'}
                </span>
                <button className="text-xs text-gray-400 hover:text-gray-600">
                  •••
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GmailDiscoverPreview;
