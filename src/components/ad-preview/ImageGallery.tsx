'use client';

import React, { useState, useRef, useCallback, useMemo, memo } from 'react';
import type { UploadedAsset, AspectRatio } from '@/types/ad-preview';
import { ASPECT_RATIO_LABELS } from '@/constants/ad-formats';

interface ImageGalleryProps {
  images: UploadedAsset[];
  logos?: UploadedAsset[];
  onImagesChange: (images: UploadedAsset[]) => void;
  onLogosChange?: (logos: UploadedAsset[]) => void;
  onImageSelect?: (image: UploadedAsset) => void;
  onCropImage?: (image: UploadedAsset) => void;
  selectedImageId?: string;
  showUpload?: boolean;
  showVariants?: boolean;
  maxImages?: number;
  maxLogos?: number;
  className?: string;
}

/**
 * ImageGallery - Reusable component for managing images with upload, delete, and variant viewing
 * Memoized to prevent unnecessary re-renders
 */
export const ImageGallery = memo(function ImageGallery({
  images,
  logos = [],
  onImagesChange,
  onLogosChange,
  onImageSelect,
  onCropImage,
  selectedImageId,
  showUpload = true,
  showVariants = true,
  maxImages = 20,
  maxLogos = 5,
  className = '',
}: ImageGalleryProps) {
  const [activeTab, setActiveTab] = useState<'images' | 'logos'>('images');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | null, type: 'image' | 'logo') => {
    if (!files || files.length === 0) return;

    const currentAssets = type === 'image' ? images : logos;
    const maxAssets = type === 'image' ? maxImages : maxLogos;
    const onChange = type === 'image' ? onImagesChange : onLogosChange;

    if (!onChange) return;
    if (currentAssets.length >= maxAssets) {
      alert(`Maximum ${maxAssets} ${type}s allowed`);
      return;
    }

    const newAssets: UploadedAsset[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        continue;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is 5MB.`);
        continue;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);

      // Get image dimensions
      const dimensions = await getImageDimensions(previewUrl);
      const aspectRatio = detectAspectRatio(dimensions.width, dimensions.height);

      const asset: UploadedAsset = {
        id: `${type}-${Date.now()}-${i}`,
        type: type,
        previewUrl,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio,
        name: file.name,
      };

      newAssets.push(asset);

      if (currentAssets.length + newAssets.length >= maxAssets) {
        break;
      }
    }

    onChange([...currentAssets, ...newAssets]);
  }, [images, logos, maxImages, maxLogos, onImagesChange, onLogosChange]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files, activeTab === 'images' ? 'image' : 'logo');
  }, [activeTab, handleFileSelect]);

  // Delete an asset
  const handleDelete = useCallback((assetId: string, type: 'image' | 'logo') => {
    if (type === 'image') {
      const asset = images.find(img => img.id === assetId);
      if (asset?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(asset.previewUrl);
      }
      onImagesChange(images.filter(img => img.id !== assetId));
    } else if (onLogosChange) {
      const asset = logos.find(logo => logo.id === assetId);
      if (asset?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(asset.previewUrl);
      }
      onLogosChange(logos.filter(logo => logo.id !== assetId));
    }
  }, [images, logos, onImagesChange, onLogosChange]);

  // Group images by aspect ratio (memoized to prevent recalculation on every render)
  const imagesByRatio = useMemo(() => {
    return images.reduce((acc, img) => {
      const ratio = img.aspectRatio || 'unknown';
      if (!acc[ratio]) acc[ratio] = [];
      acc[ratio].push(img);
      return acc;
    }, {} as Record<string, UploadedAsset[]>);
  }, [images]);

  const currentAssets = activeTab === 'images' ? images : logos;
  const maxCurrentAssets = activeTab === 'images' ? maxImages : maxLogos;

  return (
    <div className={`bg-surface2 border border-divider rounded-xl ${className}`}>
      {/* Header with tabs */}
      <div className="flex items-center justify-between p-3 border-b border-divider">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('images')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              activeTab === 'images'
                ? 'bg-accent text-white'
                : 'text-text3 hover:text-text hover:bg-surface'
            }`}
          >
            Images ({images.length})
          </button>
          {onLogosChange && (
            <button
              onClick={() => setActiveTab('logos')}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                activeTab === 'logos'
                  ? 'bg-accent text-white'
                  : 'text-text3 hover:text-text hover:bg-surface'
              }`}
            >
              Logos ({logos.length})
            </button>
          )}
        </div>
        <span className="text-xs text-text3">
          {currentAssets.length}/{maxCurrentAssets}
        </span>
      </div>

      {/* Upload area */}
      {showUpload && currentAssets.length < maxCurrentAssets && (
        <div
          className={`m-3 border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            isDragging
              ? 'border-accent bg-accent/10'
              : 'border-divider hover:border-accent/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={activeTab === 'images' ? fileInputRef : logoInputRef}
            type="file"
            accept="image/*"
            multiple={activeTab === 'images'}
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files, activeTab === 'images' ? 'image' : 'logo')}
          />
          <button
            onClick={() => (activeTab === 'images' ? fileInputRef : logoInputRef).current?.click()}
            className="flex flex-col items-center gap-2 w-full"
          >
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-text">
                Drop {activeTab} here or <span className="text-accent">browse</span>
              </p>
              <p className="text-xs text-text3 mt-1">
                PNG, JPG, GIF up to 5MB
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Gallery grid */}
      <div className="p-3">
        {showVariants && activeTab === 'images' && Object.keys(imagesByRatio).length > 0 ? (
          // Show images grouped by aspect ratio
          <div className="space-y-4">
            {Object.entries(imagesByRatio).map(([ratio, ratioImages]) => (
              <div key={ratio}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-text">
                    {ASPECT_RATIO_LABELS[ratio as AspectRatio] || ratio}
                  </span>
                  <span className="text-xs text-text3">({ratioImages.length})</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ratioImages.map((image) => (
                    <ImageThumbnail
                      key={image.id}
                      image={image}
                      isSelected={selectedImageId === image.id}
                      onSelect={() => onImageSelect?.(image)}
                      onDelete={() => handleDelete(image.id, 'image')}
                      onCrop={() => onCropImage?.(image)}
                      showCrop={!!onCropImage}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Simple grid without grouping
          <div className="grid grid-cols-3 gap-2">
            {currentAssets.map((asset) => (
              <ImageThumbnail
                key={asset.id}
                image={asset}
                isSelected={selectedImageId === asset.id}
                onSelect={() => onImageSelect?.(asset)}
                onDelete={() => handleDelete(asset.id, activeTab === 'images' ? 'image' : 'logo')}
                onCrop={activeTab === 'images' ? () => onCropImage?.(asset) : undefined}
                showCrop={activeTab === 'images' && !!onCropImage}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {currentAssets.length === 0 && (
          <div className="text-center py-6 text-text3">
            <span className="text-3xl block mb-2">
              {activeTab === 'images' ? '🖼️' : '🏷️'}
            </span>
            <p className="text-sm">No {activeTab} uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Individual image thumbnail with actions
 * Memoized to prevent re-renders when parent state changes but props don't
 */
interface ImageThumbnailProps {
  image: UploadedAsset;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  onCrop?: () => void;
  showCrop?: boolean;
}

const ImageThumbnail = memo(function ImageThumbnail({
  image,
  isSelected,
  onSelect,
  onDelete,
  onCrop,
  showCrop,
}: ImageThumbnailProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer group transition-all ${
        isSelected ? 'ring-2 ring-accent' : 'hover:ring-1 hover:ring-accent/50'
      }`}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Image */}
      <img
        src={image.previewUrl || image.fileUrl}
        alt={image.name || 'Image'}
        className="w-full h-full object-cover"
      />

      {/* Aspect ratio badge */}
      {image.aspectRatio && (
        <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
          {image.aspectRatio}
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Actions overlay */}
      {showActions && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
          {showCrop && onCrop && (
            <button
              onClick={(e) => { e.stopPropagation(); onCrop(); }}
              className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              title="Crop"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l3-3m0 0l3 3m-3-3v12m18-6l-3 3m0 0l-3-3m3 3V6m-12 0h12M3 18h12" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-danger hover:text-white transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Get image dimensions from URL
 */
function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

/**
 * Detect aspect ratio from dimensions
 */
function detectAspectRatio(width: number, height: number): AspectRatio | undefined {
  if (width === 0 || height === 0) return undefined;

  const ratio = width / height;

  // Check against known ratios (with tolerance)
  const ratios: { ratio: number; label: AspectRatio }[] = [
    { ratio: 1, label: '1:1' },
    { ratio: 1.91, label: '1.91:1' },
    { ratio: 0.8, label: '4:5' },
    { ratio: 1.778, label: '16:9' },
    { ratio: 0.5625, label: '9:16' },
  ];

  const tolerance = 0.1;
  for (const r of ratios) {
    if (Math.abs(ratio - r.ratio) < tolerance) {
      return r.label;
    }
  }

  // Return closest match
  let closest = ratios[0];
  let minDiff = Math.abs(ratio - closest.ratio);
  for (const r of ratios) {
    const diff = Math.abs(ratio - r.ratio);
    if (diff < minDiff) {
      minDiff = diff;
      closest = r;
    }
  }

  return closest.label;
}

export default ImageGallery;
