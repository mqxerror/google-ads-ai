'use client';

import React, { useState, useMemo, memo } from 'react';
import type { UploadedAsset, AspectRatio, CampaignType } from '@/types/ad-preview';
import { ASPECT_RATIO_LABELS, ASPECT_RATIO_REQUIREMENTS } from '@/constants/ad-formats';

interface ImageVariantPanelProps {
  image: UploadedAsset;
  campaignType: CampaignType;
  existingVariants?: UploadedAsset[];
  onCropForRatio?: (image: UploadedAsset, ratio: AspectRatio) => void;
  onSelectVariant?: (variant: UploadedAsset) => void;
  className?: string;
}

interface VariantInfo {
  ratio: AspectRatio;
  label: string;
  required: boolean;
  recommended: boolean;
  hasVariant: boolean;
  variant?: UploadedAsset;
}

/**
 * ImageVariantPanel - Shows all aspect ratio variants for an image
 * Displays which ratios are covered and allows creating new crops
 * Memoized to prevent unnecessary re-renders
 */
export const ImageVariantPanel = memo(function ImageVariantPanel({
  image,
  campaignType,
  existingVariants = [],
  onCropForRatio,
  onSelectVariant,
  className = '',
}: ImageVariantPanelProps) {
  const [hoveredRatio, setHoveredRatio] = useState<AspectRatio | null>(null);

  // Determine if this is a logo or image
  const isLogo = image.type === 'logo';

  // Get required and recommended ratios for this campaign type
  const requirements = ASPECT_RATIO_REQUIREMENTS[campaignType];

  // Build variant info for each ratio - use logos or images requirements based on asset type
  const variants: VariantInfo[] = useMemo(() => {
    const assetRequirements = isLogo ? requirements.logos : requirements.images;

    const allRatios: AspectRatio[] = [
      ...assetRequirements.required,
      ...assetRequirements.recommended,
      ...(assetRequirements.optional || []),
    ];

    // Remove duplicates
    const uniqueRatios = [...new Set(allRatios)];

    return uniqueRatios.map((ratio) => {
      // Find existing variant with this ratio
      const variant = existingVariants.find((v) => v.aspectRatio === ratio);

      return {
        ratio,
        label: ASPECT_RATIO_LABELS[ratio] || ratio,
        required: assetRequirements.required.includes(ratio),
        recommended: assetRequirements.recommended.includes(ratio),
        hasVariant: !!variant,
        variant,
      };
    });
  }, [requirements, existingVariants, isLogo]);

  // Count coverage
  const requiredCount = variants.filter((v) => v.required).length;
  const coveredRequired = variants.filter((v) => v.required && v.hasVariant).length;
  const coveragePercent = requiredCount > 0 ? Math.round((coveredRequired / requiredCount) * 100) : 100;

  return (
    <div className={`bg-surface2 border border-divider rounded-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-divider">
        <div className="flex items-center gap-2">
          <span className="text-lg">{isLogo ? '🏷️' : '🎨'}</span>
          <span className="text-sm font-medium text-text">{isLogo ? 'Logo Variants' : 'Image Variants'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium ${
              coveragePercent === 100
                ? 'text-success'
                : coveragePercent >= 50
                  ? 'text-warning'
                  : 'text-danger'
            }`}
          >
            {coveragePercent}% covered
          </span>
        </div>
      </div>

      {/* Source asset preview */}
      <div className="p-3 border-b border-divider">
        <p className="text-xs text-text3 mb-2">{isLogo ? 'Source Logo' : 'Source Image'}</p>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            <img
              src={image.previewUrl || image.fileUrl}
              alt="Source"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text truncate">{image.name || 'Uploaded image'}</p>
            {image.width && image.height && (
              <p className="text-xs text-text3">
                {image.width} x {image.height}px
              </p>
            )}
            {image.aspectRatio && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-accent/10 text-accent text-[10px] rounded-full">
                {ASPECT_RATIO_LABELS[image.aspectRatio]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Variants grid */}
      <div className="p-3">
        <p className="text-xs text-text3 mb-3">{isLogo ? 'Required Logo Ratios' : 'Required Aspect Ratios'}</p>
        <div className="space-y-2">
          {variants.map((v) => (
            <div
              key={v.ratio}
              className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                hoveredRatio === v.ratio ? 'bg-accent/10' : 'bg-surface'
              }`}
              onMouseEnter={() => setHoveredRatio(v.ratio)}
              onMouseLeave={() => setHoveredRatio(null)}
            >
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    v.hasVariant
                      ? 'bg-success/20 text-success'
                      : v.required
                        ? 'bg-danger/20 text-danger'
                        : 'bg-warning/20 text-warning'
                  }`}
                >
                  {v.hasVariant ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </div>

                {/* Ratio info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text">{v.label}</span>
                    {v.required && (
                      <span className="px-1.5 py-0.5 bg-danger/10 text-danger text-[9px] rounded">
                        Required
                      </span>
                    )}
                    {v.recommended && !v.required && (
                      <span className="px-1.5 py-0.5 bg-warning/10 text-warning text-[9px] rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-text3">
                    {v.hasVariant ? 'Variant available' : 'Not created'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {v.hasVariant && v.variant ? (
                  <>
                    {/* Preview thumbnail - shows the cropped image */}
                    <div
                      className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:ring-2 hover:ring-accent border-2 border-success relative group"
                      onClick={() => onSelectVariant?.(v.variant!)}
                      title="Click to view this variant"
                    >
                      <img
                        src={v.variant.previewUrl || v.variant.fileUrl}
                        alt={v.label}
                        className="w-full h-full object-cover"
                      />
                      {/* Checkmark badge */}
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    {/* Re-crop button */}
                    {onCropForRatio && (
                      <button
                        onClick={() => onCropForRatio(image, v.ratio)}
                        className="p-2 text-text3 hover:text-accent hover:bg-accent/10 transition-colors rounded-lg"
                        title="Edit this crop"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </>
                ) : (
                  /* Create crop button */
                  onCropForRatio && (
                    <button
                      onClick={() => onCropForRatio(image, v.ratio)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        v.required
                          ? 'bg-accent text-white hover:bg-accent/90'
                          : 'bg-surface text-text hover:bg-accent/10 border border-divider'
                      }`}
                    >
                      {v.required ? 'Create' : 'Add'}
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      {onCropForRatio && (
        <div className="p-3 border-t border-divider">
          <button
            onClick={() => {
              // Open crop studio with all missing ratios
              const missingRatios = variants.filter((v) => !v.hasVariant && (v.required || v.recommended));
              if (missingRatios.length > 0) {
                onCropForRatio(image, missingRatios[0].ratio);
              }
            }}
            className="w-full py-2 bg-accent/10 text-accent text-sm rounded-lg hover:bg-accent/20 transition-colors"
          >
            Create All Missing Variants
          </button>
        </div>
      )}
    </div>
  );
});

export default ImageVariantPanel;
