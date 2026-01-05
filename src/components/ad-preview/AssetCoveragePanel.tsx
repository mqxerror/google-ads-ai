'use client';

import React, { useMemo } from 'react';
import type { CampaignType, AspectRatio, UploadedAsset, AssetCoverage } from '@/types/ad-preview';
import { ASPECT_RATIO_REQUIREMENTS, ASPECT_RATIO_LABELS } from '@/constants/ad-formats';

interface AssetCoveragePanelProps {
  images: UploadedAsset[];
  logos: UploadedAsset[];
  videos?: UploadedAsset[];
  campaignType: CampaignType;
  onUploadMore?: (assetType: 'image' | 'logo' | 'video') => void;
  onCropAsset?: (asset: UploadedAsset, targetRatio: AspectRatio) => void;
  className?: string;
}

/**
 * AssetCoveragePanel - Shows asset coverage status for required aspect ratios
 * Displays which ratios are covered, missing, and provides quality scores
 */
export function AssetCoveragePanel({
  images,
  logos,
  videos = [],
  campaignType,
  onUploadMore,
  onCropAsset,
  className = '',
}: AssetCoveragePanelProps) {
  // Get requirements for this campaign type
  const requirements = ASPECT_RATIO_REQUIREMENTS[campaignType];

  // Analyze image coverage
  const imageCoverage = useMemo(() => {
    return analyzeAssetCoverage(
      images,
      requirements?.images || { required: [], recommended: [], optional: [] }
    );
  }, [images, requirements]);

  // Analyze logo coverage
  const logoCoverage = useMemo(() => {
    return analyzeAssetCoverage(
      logos,
      requirements?.logos || { required: [], recommended: [], optional: [] }
    );
  }, [logos, requirements]);

  // Calculate overall score
  const overallScore = useMemo(() => {
    const imageScore = calculateCoverageScore(imageCoverage);
    const logoScore = calculateCoverageScore(logoCoverage);

    // Weight images more heavily than logos
    return Math.round(imageScore * 0.7 + logoScore * 0.3);
  }, [imageCoverage, logoCoverage]);

  // Get score color
  const scoreColor = overallScore >= 80 ? 'text-success' : overallScore >= 50 ? 'text-warning' : 'text-danger';
  const scoreBg = overallScore >= 80 ? 'bg-success/10' : overallScore >= 50 ? 'bg-warning/10' : 'bg-danger/10';

  // Find best image for cropping suggestion
  const suggestedCropImage = images[0];

  return (
    <div className={`bg-surface2 border border-divider rounded-xl ${className}`}>
      {/* Header with score */}
      <div className="flex items-center justify-between p-4 border-b border-divider">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="font-medium text-text">Asset Coverage</h3>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${scoreBg}`}>
          <span className={`text-sm font-bold ${scoreColor}`}>{overallScore}</span>
          <span className="text-xs text-text3">/100</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Images Section */}
        <AssetSection
          title="Images"
          icon="🖼️"
          coverage={imageCoverage}
          assets={images}
          onUploadMore={() => onUploadMore?.('image')}
          onCropAsset={onCropAsset}
          suggestedCropImage={suggestedCropImage}
        />

        {/* Logos Section */}
        <AssetSection
          title="Logos"
          icon="🏷️"
          coverage={logoCoverage}
          assets={logos}
          onUploadMore={() => onUploadMore?.('logo')}
        />

        {/* Videos Section (if applicable) */}
        {campaignType === 'VIDEO' || campaignType === 'DEMAND_GEN' ? (
          <div className="pt-2 border-t border-divider">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>🎬</span>
                <span className="text-sm font-medium text-text">Videos</span>
              </div>
              <span className="text-xs text-text3">{videos.length} uploaded</span>
            </div>
            {videos.length === 0 ? (
              <button
                onClick={() => onUploadMore?.('video')}
                className="w-full p-3 border-2 border-dashed border-divider rounded-lg text-sm text-text3 hover:border-accent hover:text-accent transition-colors"
              >
                + Upload Video
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-success">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Video assets ready
              </div>
            )}
          </div>
        ) : null}

        {/* Tips based on coverage */}
        <CoverageTips
          imageCoverage={imageCoverage}
          logoCoverage={logoCoverage}
          campaignType={campaignType}
        />
      </div>
    </div>
  );
}

/**
 * Individual asset section component
 */
interface AssetSectionProps {
  title: string;
  icon: string;
  coverage: AssetCoverage[];
  assets: UploadedAsset[];
  onUploadMore?: () => void;
  onCropAsset?: (asset: UploadedAsset, targetRatio: AspectRatio) => void;
  suggestedCropImage?: UploadedAsset;
}

function AssetSection({
  title,
  icon,
  coverage,
  assets,
  onUploadMore,
  onCropAsset,
  suggestedCropImage,
}: AssetSectionProps) {
  const requiredCoverage = coverage.filter((c) => c.required);
  const recommendedCoverage = coverage.filter((c) => c.recommended && !c.required);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm font-medium text-text">{title}</span>
        </div>
        <span className="text-xs text-text3">{assets.length} uploaded</span>
      </div>

      {/* Required ratios */}
      {requiredCoverage.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-text3 uppercase tracking-wide mb-1.5">Required</p>
          <div className="space-y-1.5">
            {requiredCoverage.map((item) => (
              <CoverageRow
                key={item.ratio}
                item={item}
                onCrop={
                  item.status !== 'covered' && suggestedCropImage && onCropAsset
                    ? () => onCropAsset(suggestedCropImage, item.ratio)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Recommended ratios */}
      {recommendedCoverage.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-text3 uppercase tracking-wide mb-1.5">Recommended</p>
          <div className="space-y-1.5">
            {recommendedCoverage.map((item) => (
              <CoverageRow
                key={item.ratio}
                item={item}
                onCrop={
                  item.status !== 'covered' && suggestedCropImage && onCropAsset
                    ? () => onCropAsset(suggestedCropImage, item.ratio)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Upload more button */}
      {onUploadMore && (
        <button
          onClick={onUploadMore}
          className="w-full mt-2 p-2 text-xs text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors flex items-center justify-center gap-1.5"
        >
          <span>+</span>
          <span>Add more {title.toLowerCase()}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Individual coverage row
 */
function CoverageRow({
  item,
  onCrop,
}: {
  item: AssetCoverage;
  onCrop?: () => void;
}) {
  const statusIcon =
    item.status === 'covered'
      ? '✓'
      : item.status === 'partial'
        ? '◐'
        : '✗';

  const statusColor =
    item.status === 'covered'
      ? 'text-success'
      : item.status === 'partial'
        ? 'text-warning'
        : 'text-danger';

  const bgColor =
    item.status === 'covered'
      ? 'bg-success/10'
      : item.status === 'partial'
        ? 'bg-warning/10'
        : 'bg-danger/10';

  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${bgColor}`}>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${statusColor}`}>{statusIcon}</span>
        <span className="text-sm text-text">
          {ASPECT_RATIO_LABELS[item.ratio]} ({item.ratio})
        </span>
      </div>
      <div className="flex items-center gap-2">
        {item.count > 0 && (
          <span className="text-xs text-text3">
            {item.count} {item.count === 1 ? 'asset' : 'assets'}
          </span>
        )}
        {item.status !== 'covered' && onCrop && (
          <button
            onClick={onCrop}
            className="text-xs text-accent hover:underline"
          >
            Crop
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Coverage tips component
 */
function CoverageTips({
  imageCoverage,
  logoCoverage,
  campaignType,
}: {
  imageCoverage: AssetCoverage[];
  logoCoverage: AssetCoverage[];
  campaignType: CampaignType;
}) {
  const tips: string[] = [];

  // Check for missing required images
  const missingRequiredImages = imageCoverage.filter(
    (c) => c.required && c.status === 'missing'
  );
  if (missingRequiredImages.length > 0) {
    tips.push(
      `Add ${missingRequiredImages.map((c) => ASPECT_RATIO_LABELS[c.ratio]).join(', ')} images for better ad performance`
    );
  }

  // Check for missing required logos
  const missingRequiredLogos = logoCoverage.filter(
    (c) => c.required && c.status === 'missing'
  );
  if (missingRequiredLogos.length > 0) {
    tips.push(
      `Upload a ${missingRequiredLogos.map((c) => ASPECT_RATIO_LABELS[c.ratio]).join(', ')} logo`
    );
  }

  // Campaign-specific tips
  if (campaignType === 'PMAX') {
    const hasPortrait = imageCoverage.find((c) => c.ratio === '4:5' && c.status === 'covered');
    if (!hasPortrait) {
      tips.push('Portrait images (4:5) improve performance on mobile and YouTube');
    }
  }

  if (campaignType === 'DEMAND_GEN') {
    const hasVertical = imageCoverage.find((c) => c.ratio === '9:16' && c.status === 'covered');
    if (!hasVertical) {
      tips.push('Vertical images (9:16) are needed for YouTube Shorts');
    }
  }

  if (tips.length === 0) {
    return (
      <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
        <p className="text-xs text-success flex items-center gap-2">
          <span>✓</span>
          <span>Great job! Your asset coverage is optimized for {campaignType} campaigns.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
      <p className="text-xs font-medium text-warning mb-2">Recommendations:</p>
      <ul className="space-y-1">
        {tips.map((tip, index) => (
          <li key={index} className="text-xs text-text3 flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Analyze asset coverage for given requirements
 */
function analyzeAssetCoverage(
  assets: UploadedAsset[],
  requirements: { required: AspectRatio[]; recommended: AspectRatio[]; optional: AspectRatio[] }
): AssetCoverage[] {
  const allRatios = [...new Set([
    ...requirements.required,
    ...requirements.recommended,
    ...requirements.optional,
  ])];

  return allRatios.map((ratio) => {
    // Count assets matching this ratio
    const count = assets.filter((asset) => {
      if (asset.aspectRatio === ratio) return true;

      // Estimate ratio from dimensions if not explicitly set
      if (asset.width && asset.height) {
        const calculatedRatio = asset.width / asset.height;
        const targetRatio = parseAspectRatio(ratio);
        return Math.abs(calculatedRatio - targetRatio) < 0.1;
      }

      return false;
    }).length;

    return {
      ratio,
      required: requirements.required.includes(ratio),
      recommended: requirements.recommended.includes(ratio),
      count,
      status: count >= 1 ? 'covered' : 'missing',
    };
  });
}

/**
 * Calculate coverage score from coverage analysis
 */
function calculateCoverageScore(coverage: AssetCoverage[]): number {
  if (coverage.length === 0) return 100;

  let score = 0;
  let maxScore = 0;

  coverage.forEach((item) => {
    const weight = item.required ? 30 : item.recommended ? 15 : 5;
    maxScore += weight;

    if (item.status === 'covered') {
      score += weight;
    } else if (item.status === 'partial') {
      score += weight * 0.5;
    }
  });

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;
}

/**
 * Parse aspect ratio string to decimal
 */
function parseAspectRatio(ratio: AspectRatio): number {
  const parts = ratio.split(':').map(Number);
  return parts[0] / parts[1];
}

export default AssetCoveragePanel;
