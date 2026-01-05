'use client';

import React from 'react';
import type { FormatConfig, PreviewData } from '@/types/ad-preview';

interface YouTubePreviewProps {
  format: FormatConfig;
  data: PreviewData;
  scale?: number;
  className?: string;
}

/**
 * YouTube ad preview component
 * Renders In-Stream, Discovery, and Shorts formats
 */
export function YouTubePreview({
  format,
  data,
  scale = 1,
  className = '',
}: YouTubePreviewProps) {
  const { headlines, descriptions, images, logos, businessName, callToAction } = data;

  const primaryImage = images[0]?.previewUrl || images[0]?.fileUrl;
  const logoUrl = logos[0]?.previewUrl || logos[0]?.fileUrl;
  const headline = headlines.find((h) => h.trim()) || 'Your Headline';
  const description = descriptions.find((d) => d.trim()) || 'Your description';
  const cta = callToAction || 'Learn More';

  if (format.id === 'youtube-shorts') {
    return <ShortsPreview data={data} scale={scale} className={className} />;
  }

  if (format.id === 'youtube-discovery') {
    return <DiscoveryPreview data={data} scale={scale} className={className} />;
  }

  // In-Stream Preview (default)
  return (
    <div className={`inline-block ${className}`}>
      {/* Format label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text3">{format.name}</span>
        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded">
          YouTube
        </span>
      </div>

      {/* In-Stream Ad Preview */}
      <div
        className="bg-black rounded-lg overflow-hidden relative"
        style={{ width: 480 * scale, aspectRatio: '16/9' }}
      >
        {/* Video thumbnail/placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt="Video thumbnail"
              className="w-full h-full object-cover opacity-70"
            />
          ) : (
            <div className="text-white/50">
              <span className="text-6xl">▶️</span>
            </div>
          )}
        </div>

        {/* Skip button */}
        <div className="absolute top-3 right-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded cursor-pointer hover:bg-black/90">
          Skip Ad <span className="text-white/60">5</span>
        </div>

        {/* Ad indicator */}
        <div className="absolute top-3 left-3 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded">
          Ad · 0:15
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-12 left-0 right-0 h-1 bg-white/30">
          <div className="h-full bg-yellow-500 w-1/3" />
        </div>

        {/* CTA overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 pt-8">
          <div className="flex items-end justify-between">
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-2 mb-1">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-6 h-6 rounded-full object-contain bg-white/10"
                  />
                )}
                <span className="text-white/70 text-xs">
                  {businessName || 'Advertiser'} · Sponsored
                </span>
              </div>
              <h3 className="text-white text-sm font-medium line-clamp-1">
                {headline}
              </h3>
              <p className="text-white/70 text-xs line-clamp-1 mt-0.5">
                {description}
              </p>
            </div>
            <button className="bg-[#3ea6ff] text-black text-sm font-medium px-4 py-2 rounded hover:bg-[#65b8ff] transition-colors flex-shrink-0">
              {cta}
            </button>
          </div>
        </div>

        {/* Video controls */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 text-white/70">
          <span className="text-lg cursor-pointer">⏸</span>
          <span className="text-xs">0:05 / 0:15</span>
        </div>
      </div>
    </div>
  );
}

/**
 * YouTube Discovery ad preview
 */
function DiscoveryPreview({
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
  const description = descriptions.find((d) => d.trim()) || 'Your description';

  return (
    <div className={`inline-block ${className}`}>
      {/* Format label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text3">Discovery</span>
        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded">
          YouTube
        </span>
      </div>

      {/* Discovery Ad Preview - appears in search results/home feed */}
      <div
        className="bg-[#0f0f0f] rounded-lg overflow-hidden p-3"
        style={{ width: 360 * scale }}
      >
        {/* Thumbnail */}
        <div className="relative rounded-lg overflow-hidden mb-2" style={{ aspectRatio: '16/9' }}>
          {primaryImage ? (
            <img
              src={primaryImage}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <span className="text-4xl">▶️</span>
            </div>
          )}
          {/* Ad badge */}
          <div className="absolute bottom-2 left-2 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
            Ad
          </div>
          {/* Duration */}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
            0:30
          </div>
        </div>

        {/* Content */}
        <div className="flex gap-2">
          {/* Channel avatar */}
          <div className="flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Channel"
                className="w-9 h-9 rounded-full object-contain bg-gray-700"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm">
                {(businessName || 'A')[0]}
              </div>
            )}
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight">
              {headline}
            </h3>
            <div className="mt-1 text-[#aaa] text-xs">
              <span>{businessName || 'Advertiser'}</span>
              <span className="mx-1">·</span>
              <span>Sponsored</span>
            </div>
            <p className="text-[#aaa] text-xs line-clamp-1 mt-0.5">
              {description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * YouTube Shorts ad preview
 */
function ShortsPreview({
  data,
  scale = 1,
  className = '',
}: {
  data: PreviewData;
  scale?: number;
  className?: string;
}) {
  const { headlines, images, logos, businessName, callToAction } = data;

  const primaryImage = images[0]?.previewUrl || images[0]?.fileUrl;
  const logoUrl = logos[0]?.previewUrl || logos[0]?.fileUrl;
  const headline = headlines.find((h) => h.trim()) || 'Your Headline';
  const cta = callToAction || 'Learn More';

  return (
    <div className={`inline-block ${className}`}>
      {/* Format label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text3">Shorts</span>
        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded">
          YouTube
        </span>
      </div>

      {/* Shorts Preview - vertical format */}
      <div
        className="bg-black rounded-2xl overflow-hidden relative"
        style={{ width: 200 * scale, height: 355 * scale }}
      >
        {/* Video content */}
        <div className="absolute inset-0">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt="Short video"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <span className="text-4xl">📹</span>
            </div>
          )}
        </div>

        {/* Ad indicator */}
        <div className="absolute top-3 left-3 bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">
          Ad
        </div>

        {/* Right side actions */}
        <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-sm">👍</span>
            </div>
            <span className="text-white text-[10px] mt-0.5">Like</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-sm">💬</span>
            </div>
            <span className="text-white text-[10px] mt-0.5">0</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-sm">↗️</span>
            </div>
            <span className="text-white text-[10px] mt-0.5">Share</span>
          </div>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
          {/* Channel info */}
          <div className="flex items-center gap-2 mb-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Channel"
                className="w-6 h-6 rounded-full object-contain"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs">
                {(businessName || 'A')[0]}
              </div>
            )}
            <span className="text-white text-xs font-medium">
              {businessName || 'Advertiser'}
            </span>
            <span className="text-white/60 text-[10px]">Sponsored</span>
          </div>

          {/* Headline */}
          <p className="text-white text-xs line-clamp-2 mb-2">{headline}</p>

          {/* CTA button */}
          <button className="w-full bg-white text-black text-xs font-medium py-2 rounded-full">
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}

export default YouTubePreview;
