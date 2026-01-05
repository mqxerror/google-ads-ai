'use client';

import React, { useState, useMemo } from 'react';
import type { CampaignType, AdFormat, PreviewData, UploadedAsset } from '@/types/ad-preview';
import { AD_FORMATS, FORMAT_CATEGORIES, getFormatsGroupedByCategory } from '@/constants/ad-formats';
import { DisplayFormatPreview, YouTubePreview, GmailDiscoverPreview, SearchPreview } from './previews';

interface FormatPreviewGridProps {
  campaignType: CampaignType;
  headlines: string[];
  descriptions: string[];
  images: UploadedAsset[];
  logos: UploadedAsset[];
  videos?: UploadedAsset[];
  businessName?: string;
  finalUrl?: string;
  displayPath1?: string;
  displayPath2?: string;
  callToAction?: string;
  onFormatSelect?: (format: AdFormat) => void;
  selectedFormat?: AdFormat;
  className?: string;
}

type CategoryFilter = 'all' | 'display' | 'youtube' | 'gmail' | 'discover' | 'search';

/**
 * FormatPreviewGrid - Multi-format ad preview display
 * Shows all available ad formats for a campaign type in a grid layout
 */
export function FormatPreviewGrid({
  campaignType,
  headlines,
  descriptions,
  images,
  logos,
  videos = [],
  businessName,
  finalUrl,
  displayPath1,
  displayPath2,
  callToAction,
  onFormatSelect,
  selectedFormat,
  className = '',
}: FormatPreviewGridProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [scale, setScale] = useState(0.8);

  // Get formats grouped by category for this campaign type
  const groupedFormats = useMemo(
    () => getFormatsGroupedByCategory(campaignType),
    [campaignType]
  );

  // Get available categories
  const availableCategories = useMemo(
    () => Object.keys(groupedFormats) as CategoryFilter[],
    [groupedFormats]
  );

  // Filter formats based on selected category
  const filteredFormats = useMemo(() => {
    if (categoryFilter === 'all') {
      return AD_FORMATS.filter((f) => f.campaignTypes.includes(campaignType));
    }
    return groupedFormats[categoryFilter] || [];
  }, [campaignType, categoryFilter, groupedFormats]);

  // Build preview data object
  const previewData: PreviewData = {
    headlines,
    descriptions,
    images,
    logos,
    videos,
    businessName,
    finalUrl,
    displayPath1,
    displayPath2,
    callToAction,
  };

  // Render the appropriate preview component for each format
  const renderPreview = (format: typeof AD_FORMATS[number]) => {
    const isSelected = selectedFormat === format.id;

    const previewWrapper = (children: React.ReactNode) => (
      <div
        key={format.id}
        onClick={() => onFormatSelect?.(format.id)}
        className={`
          relative p-4 rounded-xl transition-all cursor-pointer
          ${isSelected
            ? 'bg-accent/10 ring-2 ring-accent'
            : 'bg-surface2 hover:bg-surface2/80'
          }
          ${onFormatSelect ? 'hover:ring-1 hover:ring-accent/50' : ''}
        `}
      >
        {isSelected && (
          <div className="absolute top-2 right-2 bg-accent text-white text-[10px] px-2 py-0.5 rounded-full">
            Selected
          </div>
        )}
        {children}
      </div>
    );

    switch (format.category) {
      case 'display':
        return previewWrapper(
          <DisplayFormatPreview
            format={format}
            data={previewData}
            scale={scale}
          />
        );
      case 'youtube':
        return previewWrapper(
          <YouTubePreview
            format={format}
            data={previewData}
            scale={scale}
          />
        );
      case 'gmail':
      case 'discover':
        return previewWrapper(
          <GmailDiscoverPreview
            format={format}
            data={previewData}
            scale={scale}
          />
        );
      case 'search':
        return previewWrapper(
          <SearchPreview
            format={format}
            data={previewData}
            scale={scale}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`${className}`}>
      {/* Header with filter and scale controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📐</span>
          <h3 className="font-medium text-text">Format Preview Grid</h3>
          <span className="text-xs text-text3 bg-surface2 px-2 py-0.5 rounded-full">
            {filteredFormats.length} formats
          </span>
        </div>

        {/* Scale control */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text3">Scale:</span>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-20 h-1 bg-divider rounded-full appearance-none cursor-pointer"
            />
            <span className="text-xs text-text3 w-8">{Math.round(scale * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`
            px-3 py-1.5 text-xs rounded-full transition-colors flex-shrink-0
            ${categoryFilter === 'all'
              ? 'bg-accent text-white'
              : 'bg-surface2 text-text3 hover:text-text hover:bg-surface2/80'
            }
          `}
        >
          All Formats
        </button>
        {availableCategories.map((category) => {
          const categoryInfo = FORMAT_CATEGORIES[category as keyof typeof FORMAT_CATEGORIES];
          if (!categoryInfo) return null;

          return (
            <button
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={`
                px-3 py-1.5 text-xs rounded-full transition-colors flex-shrink-0 flex items-center gap-1.5
                ${categoryFilter === category
                  ? 'bg-accent text-white'
                  : 'bg-surface2 text-text3 hover:text-text hover:bg-surface2/80'
                }
              `}
            >
              <span>{categoryInfo.icon}</span>
              <span>{categoryInfo.label}</span>
              <span className="opacity-60">({groupedFormats[category]?.length || 0})</span>
            </button>
          );
        })}
      </div>

      {/* No formats message */}
      {filteredFormats.length === 0 && (
        <div className="text-center py-12 text-text3">
          <span className="text-4xl mb-2 block">🔍</span>
          <p>No formats available for this campaign type</p>
        </div>
      )}

      {/* Format grid */}
      <div className="grid gap-4 auto-rows-auto" style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))'
      }}>
        {filteredFormats.map(renderPreview)}
      </div>

      {/* Tip for users */}
      {onFormatSelect && (
        <div className="mt-4 p-3 bg-accent/5 border border-accent/20 rounded-lg">
          <p className="text-xs text-text3 flex items-start gap-2">
            <span>💡</span>
            <span>
              Click on any preview to select it for editing. Selected format will be used
              for asset cropping and optimization.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

export default FormatPreviewGrid;
