'use client';

import React, { useState } from 'react';
import { SearchAdPreview } from '@/components/ads/SearchAdPreview';

type AdType = 'search' | 'display' | 'pmax' | 'video';
type PreviewVariant = 'desktop' | 'mobile';

interface AdPreviewCardProps {
  type: AdType;
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  displayPath1?: string;
  displayPath2?: string;
  businessName?: string;
  images?: string[];
  logoUrl?: string;
  videoUrl?: string;
  sitelinks?: Array<{ text: string; url?: string }>;
  callouts?: string[];
  showVariantToggle?: boolean;
  className?: string;
}

/**
 * Unified ad preview wrapper supporting multiple ad types
 * Automatically selects the right preview component based on type
 */
export function AdPreviewCard({
  type,
  headlines,
  descriptions,
  finalUrl,
  displayPath1,
  displayPath2,
  businessName,
  images = [],
  logoUrl,
  sitelinks = [],
  callouts = [],
  showVariantToggle = true,
  className = '',
}: AdPreviewCardProps) {
  const [variant, setVariant] = useState<PreviewVariant>('desktop');

  const typeLabels: Record<AdType, string> = {
    search: 'Search Ad',
    display: 'Display Ad',
    pmax: 'Performance Max',
    video: 'Video Ad',
  };

  return (
    <div className={`bg-surface2 border border-divider rounded-lg p-4 ${className}`}>
      {/* Header with type and variant toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {type === 'search' && '🔍'}
            {type === 'display' && '🖼️'}
            {type === 'pmax' && '🚀'}
            {type === 'video' && '🎬'}
          </span>
          <span className="font-medium text-text text-sm">{typeLabels[type]} Preview</span>
        </div>

        {showVariantToggle && (
          <div className="flex items-center gap-1 bg-surface rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setVariant('desktop')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                variant === 'desktop'
                  ? 'bg-accent text-white'
                  : 'text-text3 hover:text-text'
              }`}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setVariant('mobile')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                variant === 'mobile'
                  ? 'bg-accent text-white'
                  : 'text-text3 hover:text-text'
              }`}
            >
              Mobile
            </button>
          </div>
        )}
      </div>

      {/* Preview content based on type */}
      <div className="flex justify-center">
        {type === 'search' && (
          <SearchAdPreview
            headlines={headlines}
            descriptions={descriptions}
            finalUrl={finalUrl}
            displayPath1={displayPath1}
            displayPath2={displayPath2}
            businessName={businessName}
            sitelinks={sitelinks}
            callouts={callouts}
            variant={variant}
          />
        )}

        {type === 'display' && (
          <DisplayAdPreview
            headlines={headlines}
            descriptions={descriptions}
            finalUrl={finalUrl}
            businessName={businessName}
            images={images}
            logoUrl={logoUrl}
            variant={variant}
          />
        )}

        {type === 'pmax' && (
          <PMaxAdPreview
            headlines={headlines}
            descriptions={descriptions}
            finalUrl={finalUrl}
            businessName={businessName}
            images={images}
            logoUrl={logoUrl}
            variant={variant}
          />
        )}

        {type === 'video' && (
          <VideoAdPreview
            headlines={headlines}
            descriptions={descriptions}
            finalUrl={finalUrl}
            businessName={businessName}
          />
        )}
      </div>
    </div>
  );
}

// Display Ad Preview Component
interface DisplayAdPreviewProps {
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  businessName?: string;
  images: string[];
  logoUrl?: string;
  variant: PreviewVariant;
}

function DisplayAdPreview({
  headlines,
  descriptions,
  businessName,
  images,
  logoUrl,
  variant,
}: DisplayAdPreviewProps) {
  const primaryImage = images[0];
  const displayHeadline = headlines.find((h) => h.trim()) || 'Your Headline';
  const displayDescription = descriptions.find((d) => d.trim()) || 'Your description text';

  return (
    <div className={variant === 'mobile' ? 'max-w-[320px]' : 'max-w-[336px]'}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-text3">Display Preview</span>
        <span className="px-1.5 py-0.5 bg-surface2 text-[10px] text-text3 rounded">336x280</span>
      </div>

      <div
        className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200"
        style={{ width: 336, height: 280 }}
      >
        {/* Image area */}
        <div className="h-[180px] bg-gray-100 relative">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt="Ad preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-4xl">🖼️</span>
            </div>
          )}
          <span className="absolute top-2 left-2 text-[10px] font-bold text-black bg-white/90 rounded px-1">
            Ad
          </span>
        </div>

        {/* Content area */}
        <div className="p-3">
          <div className="flex items-start gap-2">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-8 h-8 rounded object-contain bg-gray-50"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[#202124] truncate">
                {displayHeadline}
              </div>
              <div className="text-[11px] text-[#4d5156] line-clamp-2">
                {displayDescription}
              </div>
              {businessName && (
                <div className="text-[10px] text-[#70757a] mt-1">{businessName}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// PMax Ad Preview Component
interface PMaxAdPreviewProps {
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  businessName?: string;
  images: string[];
  logoUrl?: string;
  variant: PreviewVariant;
}

function PMaxAdPreview({
  headlines,
  descriptions,
  businessName,
  images,
  logoUrl,
  variant,
}: PMaxAdPreviewProps) {
  const [previewType, setPreviewType] = useState<'search' | 'display' | 'youtube'>('search');

  return (
    <div className="w-full">
      {/* Preview type tabs */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-text3">Preview as:</span>
        <div className="flex gap-1">
          {(['search', 'display', 'youtube'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setPreviewType(type)}
              className={`px-2 py-1 text-[10px] rounded transition-colors capitalize ${
                previewType === type
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text3 hover:text-text'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Show appropriate preview */}
      {previewType === 'search' && (
        <SearchAdPreview
          headlines={headlines}
          descriptions={descriptions}
          finalUrl={''}
          businessName={businessName}
          variant={variant}
        />
      )}

      {previewType === 'display' && (
        <DisplayAdPreview
          headlines={headlines}
          descriptions={descriptions}
          finalUrl={''}
          businessName={businessName}
          images={images}
          logoUrl={logoUrl}
          variant={variant}
        />
      )}

      {previewType === 'youtube' && (
        <div className={variant === 'mobile' ? 'max-w-[320px]' : 'max-w-[480px]'}>
          <div className="bg-black rounded-lg overflow-hidden">
            <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
              {images[0] ? (
                <img
                  src={images[0]}
                  alt="Video thumbnail"
                  className="w-full h-full object-cover opacity-60"
                />
              ) : (
                <span className="text-4xl">▶️</span>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 p-4">
                <div className="text-white text-sm font-medium mb-1">
                  {headlines[0] || 'Your Headline'}
                </div>
                <div className="text-white/70 text-xs">
                  {businessName || 'Your Business'} · Sponsored
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Video Ad Preview Component
interface VideoAdPreviewProps {
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  businessName?: string;
}

function VideoAdPreview({
  headlines,
  descriptions,
  businessName,
}: VideoAdPreviewProps) {
  return (
    <div className="max-w-[480px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-text3">YouTube Preview</span>
      </div>

      <div className="bg-black rounded-lg overflow-hidden">
        <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
          <span className="text-6xl">▶️</span>

          {/* Skip button */}
          <div className="absolute top-4 right-4 bg-black/80 text-white text-xs px-3 py-1.5 rounded">
            Skip Ad
          </div>

          {/* CTA overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-white text-base font-medium mb-1">
                  {headlines[0] || 'Your Headline'}
                </div>
                <div className="text-white/70 text-sm line-clamp-1">
                  {descriptions[0] || 'Your description'}
                </div>
              </div>
              <button className="bg-[#3ea6ff] text-black text-sm font-medium px-4 py-2 rounded">
                Learn More
              </button>
            </div>
            <div className="text-white/50 text-xs mt-2">
              {businessName || 'Your Business'} · Sponsored
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdPreviewCard;
