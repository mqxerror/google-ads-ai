'use client';

import React, { useState, useCallback, useRef } from 'react';
import { IMAGE_REQUIREMENTS, type AssetType, type AspectRatio, type Asset } from '@/types/campaign';

interface AssetUploaderProps {
  campaignType: 'DISPLAY' | 'PMAX' | 'DEMAND_GEN' | 'VIDEO';
  assetType: 'IMAGE' | 'LOGO' | 'VIDEO';
  requiredAspectRatios?: AspectRatio[];
  maxAssets?: number;
  selectedAssets: UploadedAsset[];
  onAssetsChange: (assets: UploadedAsset[]) => void;
  showLibrary?: boolean;
}

export interface UploadedAsset {
  id: string;
  type: AssetType;
  file?: File;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  previewUrl?: string;
  width?: number;
  height?: number;
  aspectRatio?: AspectRatio;
  youtubeVideoId?: string;
  isFromLibrary?: boolean;
  isUploading?: boolean;
  uploadProgress?: number;
  validationErrors?: string[];
  validationWarnings?: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedAspectRatio?: AspectRatio;
}

const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  '1:1': 'Square (1:1)',
  '1.91:1': 'Landscape (1.91:1)',
  '4:5': 'Portrait (4:5)',
  '16:9': 'Widescreen (16:9)',
  '9:16': 'Vertical (9:16)',
};

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/mov'];
const MAX_FILE_SIZE_MB = 5;
const MAX_VIDEO_SIZE_MB = 256;

export function AssetUploader({
  campaignType,
  assetType,
  requiredAspectRatios,
  maxAssets = 20,
  selectedAssets,
  onAssetsChange,
  showLibrary = true,
}: AssetUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<Asset[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeError, setYoutubeError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get requirements for this campaign type
  const requirements = IMAGE_REQUIREMENTS[campaignType] || IMAGE_REQUIREMENTS.DISPLAY;

  // Determine accepted file types
  const acceptedTypes = assetType === 'VIDEO' ? ACCEPTED_VIDEO_TYPES : ACCEPTED_IMAGE_TYPES;
  const maxSize = assetType === 'VIDEO' ? MAX_VIDEO_SIZE_MB : MAX_FILE_SIZE_MB;

  // Calculate which aspect ratios we need based on campaign type and asset type
  const getRequiredAspectRatios = (): AspectRatio[] => {
    if (requiredAspectRatios) return requiredAspectRatios;

    if (assetType === 'LOGO') {
      return ['1:1'];
    }

    switch (campaignType) {
      case 'PMAX':
        return ['1.91:1', '1:1', '4:5'];
      case 'DEMAND_GEN':
        return ['1.91:1', '1:1', '4:5'];
      case 'DISPLAY':
        return ['1.91:1', '1:1'];
      default:
        return ['1.91:1'];
    }
  };

  const requiredRatios = getRequiredAspectRatios();

  // Validate file
  const validateFile = useCallback(async (file: File): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let detectedAspectRatio: AspectRatio | undefined;

    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      errors.push(`Invalid file type. Accepted: ${acceptedTypes.map(t => t.split('/')[1]).join(', ')}`);
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      errors.push(`File too large. Maximum size: ${maxSize}MB`);
    }

    // For images, check dimensions
    if (assetType !== 'VIDEO' && ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      try {
        const dimensions = await getImageDimensions(file);

        // Detect aspect ratio
        detectedAspectRatio = detectAspectRatio(dimensions.width, dimensions.height);

        // Check minimum dimensions
        if (dimensions.width < 300 || dimensions.height < 300) {
          errors.push('Image too small. Minimum dimension: 300px');
        }

        // Check if aspect ratio matches requirements
        if (requiredRatios.length > 0 && detectedAspectRatio && !requiredRatios.includes(detectedAspectRatio)) {
          warnings.push(`Aspect ratio ${detectedAspectRatio} may not be optimal. Recommended: ${requiredRatios.join(', ')}`);
        }

        // Check if dimensions match Google Ads requirements
        // VIDEO campaign type has different requirements (COMPANION_BANNER only)
        if (campaignType !== 'VIDEO') {
          const reqs = requirements as typeof IMAGE_REQUIREMENTS.DISPLAY;
          const expectedReq = assetType === 'LOGO'
            ? reqs.LOGO
            : reqs.MARKETING_IMAGE;

          if (expectedReq && dimensions.width < expectedReq.width * 0.8) {
            warnings.push(`Image resolution is lower than recommended (${expectedReq.width}x${expectedReq.height}px)`);
          }
        }
      } catch (err) {
        errors.push('Could not read image dimensions');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      detectedAspectRatio,
    };
  }, [acceptedTypes, maxSize, assetType, requiredRatios, requirements]);

  // Get image dimensions
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  // Detect aspect ratio from dimensions
  const detectAspectRatio = (width: number, height: number): AspectRatio | undefined => {
    const ratio = width / height;

    if (Math.abs(ratio - 1) < 0.1) return '1:1';
    if (Math.abs(ratio - 1.91) < 0.15) return '1.91:1';
    if (Math.abs(ratio - 0.8) < 0.1) return '4:5';
    if (Math.abs(ratio - 1.78) < 0.1) return '16:9';
    if (Math.abs(ratio - 0.5625) < 0.1) return '9:16';

    return undefined;
  };

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, []);

  // Handle file input change
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Upload a single file to the server
  const uploadFile = async (file: File, tempId: string): Promise<UploadedAsset | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetType', assetType);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Upload failed:', error);
        return null;
      }

      const data = await response.json();

      if (data.success && data.file) {
        // Also save to asset library
        try {
          await fetch('/api/campaigns/assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: assetType === 'LOGO' ? 'LOGO' : assetType,
              fileUrl: data.file.url,
              fileName: data.file.fileName,
              fileSize: data.file.fileSize,
              mimeType: data.file.mimeType,
              width: data.file.width,
              height: data.file.height,
              aspectRatio: data.file.aspectRatio,
            }),
          });
        } catch (e) {
          console.warn('Could not save to asset library:', e);
        }

        return {
          id: tempId,
          type: assetType === 'LOGO' ? 'LOGO' : assetType,
          fileUrl: data.file.url,
          fileName: data.file.fileName,
          fileSize: data.file.fileSize,
          mimeType: data.file.mimeType,
          previewUrl: data.file.url,
          width: data.file.width,
          height: data.file.height,
          aspectRatio: data.file.aspectRatio as AspectRatio,
          isUploading: false,
        };
      }

      return null;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  // Process selected files
  const processFiles = async (files: File[]) => {
    const remainingSlots = maxAssets - selectedAssets.length;
    const filesToProcess = files.slice(0, remainingSlots);

    // First, add placeholders with loading state
    const placeholders: UploadedAsset[] = [];

    for (const file of filesToProcess) {
      const validation = await validateFile(file);

      // Skip files with validation errors
      if (validation.errors.length > 0) {
        const dimensions = ACCEPTED_IMAGE_TYPES.includes(file.type)
          ? await getImageDimensions(file).catch(() => null)
          : null;

        placeholders.push({
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: assetType === 'LOGO' ? 'LOGO' : assetType,
          file,
          fileName: file.name,
          fileSize: file.size,
          previewUrl: URL.createObjectURL(file),
          width: dimensions?.width,
          height: dimensions?.height,
          aspectRatio: validation.detectedAspectRatio,
          validationErrors: validation.errors,
          validationWarnings: validation.warnings,
          isUploading: false,
        });
        continue;
      }

      const dimensions = ACCEPTED_IMAGE_TYPES.includes(file.type)
        ? await getImageDimensions(file).catch(() => null)
        : null;

      const tempId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      placeholders.push({
        id: tempId,
        type: assetType === 'LOGO' ? 'LOGO' : assetType,
        file,
        fileName: file.name,
        fileSize: file.size,
        previewUrl: URL.createObjectURL(file),
        width: dimensions?.width,
        height: dimensions?.height,
        aspectRatio: validation.detectedAspectRatio,
        validationWarnings: validation.warnings,
        isUploading: true,
      });
    }

    // Update state with placeholders
    let newAssets = [...selectedAssets, ...placeholders];
    onAssetsChange(newAssets);

    // Upload files that don't have validation errors
    for (const placeholder of placeholders) {
      if (placeholder.file && placeholder.isUploading) {
        const uploaded = await uploadFile(placeholder.file, placeholder.id);

        if (uploaded) {
          // Update the asset with upload result
          newAssets = newAssets.map(a =>
            a.id === placeholder.id
              ? { ...a, ...uploaded, validationWarnings: placeholder.validationWarnings }
              : a
          );
          onAssetsChange(newAssets);
        } else {
          // Upload failed, mark with error
          newAssets = newAssets.map(a =>
            a.id === placeholder.id
              ? { ...a, isUploading: false, validationErrors: ['Upload failed'] }
              : a
          );
          onAssetsChange(newAssets);
        }
      }
    }
  };

  // Handle YouTube URL
  const handleYoutubeUrl = useCallback(() => {
    setYoutubeError('');

    if (!youtubeUrl.trim()) return;

    // Extract video ID from various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    let videoId: string | null = null;
    for (const pattern of patterns) {
      const match = youtubeUrl.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }

    if (!videoId) {
      setYoutubeError('Invalid YouTube URL');
      return;
    }

    // Check if already added
    if (selectedAssets.some(a => a.youtubeVideoId === videoId)) {
      setYoutubeError('Video already added');
      return;
    }

    // Add YouTube video asset
    const newAsset: UploadedAsset = {
      id: `yt-${videoId}`,
      type: 'VIDEO',
      youtubeVideoId: videoId,
      previewUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      fileName: `YouTube: ${videoId}`,
    };

    onAssetsChange([...selectedAssets, newAsset]);
    setYoutubeUrl('');
  }, [youtubeUrl, selectedAssets, onAssetsChange]);

  // Remove asset
  const removeAsset = useCallback((assetId: string) => {
    const asset = selectedAssets.find(a => a.id === assetId);
    if (asset?.previewUrl && !asset.isFromLibrary) {
      URL.revokeObjectURL(asset.previewUrl);
    }
    onAssetsChange(selectedAssets.filter(a => a.id !== assetId));
  }, [selectedAssets, onAssetsChange]);

  // Load library assets
  const loadLibraryAssets = useCallback(async () => {
    setIsLoadingLibrary(true);
    try {
      const type = assetType === 'LOGO' ? 'LOGO' : assetType;
      const response = await fetch(`/api/campaigns/assets?type=${type}`);
      const data = await response.json();

      if (data.success) {
        setLibraryAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Failed to load library assets:', error);
    }
    setIsLoadingLibrary(false);
  }, [assetType]);

  // Select from library
  const selectFromLibrary = useCallback((asset: Asset) => {
    if (selectedAssets.length >= maxAssets) return;
    if (selectedAssets.some(a => a.id === asset.id)) return;

    const newAsset: UploadedAsset = {
      id: asset.id,
      type: asset.type,
      fileUrl: asset.fileUrl,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      previewUrl: asset.fileUrl,
      width: asset.width,
      height: asset.height,
      aspectRatio: asset.aspectRatio,
      youtubeVideoId: asset.youtubeVideoId,
      isFromLibrary: true,
    };

    onAssetsChange([...selectedAssets, newAsset]);
    setShowLibraryModal(false);
  }, [selectedAssets, maxAssets, onAssetsChange]);

  // Open library modal
  const openLibrary = useCallback(() => {
    setShowLibraryModal(true);
    loadLibraryAssets();
  }, [loadLibraryAssets]);

  // Check coverage of required aspect ratios
  const coverageStatus = requiredRatios.map(ratio => ({
    ratio,
    covered: selectedAssets.some(a => a.aspectRatio === ratio && (!a.validationErrors || a.validationErrors.length === 0)),
  }));

  const hasAllRequired = coverageStatus.every(s => s.covered);

  return (
    <div className="space-y-4">
      {/* Aspect Ratio Coverage */}
      {assetType !== 'VIDEO' && requiredRatios.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {coverageStatus.map(({ ratio, covered }) => (
            <span
              key={ratio}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                covered
                  ? 'bg-success-light text-success'
                  : 'bg-warning-light text-warning'
              }`}
            >
              {covered ? '✓' : '!'} {ASPECT_RATIO_LABELS[ratio]}
            </span>
          ))}
        </div>
      )}

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging
            ? 'border-accent bg-accent-light'
            : 'border-divider hover:border-accent hover:bg-surface2'
        } ${selectedAssets.length >= maxAssets ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="space-y-2">
          <div className="text-4xl">
            {assetType === 'VIDEO' ? '🎬' : assetType === 'LOGO' ? '🏷️' : '🖼️'}
          </div>
          <p className="text-text font-medium">
            {isDragging
              ? 'Drop files here'
              : `Drag & drop ${assetType.toLowerCase()}s or click to browse`}
          </p>
          <p className="text-text3 text-sm">
            {assetType === 'VIDEO'
              ? 'MP4, WebM up to 256MB'
              : `JPG, PNG, GIF up to ${MAX_FILE_SIZE_MB}MB`}
          </p>
          {!hasAllRequired && assetType !== 'VIDEO' && (
            <p className="text-warning text-sm mt-2">
              Recommended aspect ratios: {requiredRatios.map(r => ASPECT_RATIO_LABELS[r]).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* YouTube URL Input (for videos) */}
      {assetType === 'VIDEO' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="Paste YouTube URL..."
            className="flex-1 px-4 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            onClick={handleYoutubeUrl}
            className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Add YouTube
          </button>
        </div>
      )}
      {youtubeError && (
        <p className="text-danger text-sm">{youtubeError}</p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {showLibrary && (
          <button
            type="button"
            onClick={openLibrary}
            className="px-4 py-2 bg-surface2 text-text rounded-lg hover:bg-divider transition-colors text-sm"
          >
            📂 Browse Library
          </button>
        )}
        <span className="text-text3 text-sm self-center ml-auto">
          {selectedAssets.length} / {maxAssets} assets
        </span>
      </div>

      {/* Selected Assets Grid */}
      {selectedAssets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {selectedAssets.map((asset) => (
            <div
              key={asset.id}
              className={`relative group rounded-lg overflow-hidden border ${
                asset.validationErrors && asset.validationErrors.length > 0
                  ? 'border-danger'
                  : 'border-divider'
              }`}
            >
              {/* Preview */}
              <div className="aspect-square bg-surface2 flex items-center justify-center relative">
                {asset.previewUrl ? (
                  <img
                    src={asset.previewUrl}
                    alt={asset.fileName || 'Asset preview'}
                    className="w-full h-full object-cover"
                  />
                ) : asset.youtubeVideoId ? (
                  <img
                    src={`https://img.youtube.com/vi/${asset.youtubeVideoId}/hqdefault.jpg`}
                    alt="YouTube thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl text-text3">📄</span>
                )}

                {/* Uploading overlay */}
                {asset.isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
                  </div>
                )}

                {/* YouTube badge */}
                {asset.youtubeVideoId && (
                  <div className="absolute bottom-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                    YouTube
                  </div>
                )}

                {/* Aspect ratio badge */}
                {asset.aspectRatio && !asset.isUploading && (
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {asset.aspectRatio}
                  </div>
                )}

                {/* Library badge */}
                {asset.isFromLibrary && (
                  <div className="absolute top-2 right-2 bg-accent text-white text-xs px-2 py-1 rounded">
                    Library
                  </div>
                )}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeAsset(asset.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-danger text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>

              {/* Info */}
              <div className="p-2 bg-surface">
                <p className="text-xs text-text truncate">
                  {asset.fileName || 'Unnamed asset'}
                </p>
                {asset.width && asset.height && (
                  <p className="text-xs text-text3">
                    {asset.width}×{asset.height}px
                  </p>
                )}

                {/* Validation errors */}
                {asset.validationErrors && asset.validationErrors.length > 0 && (
                  <div className="mt-1 text-xs text-danger">
                    {asset.validationErrors[0]}
                  </div>
                )}

                {/* Validation warnings */}
                {(!asset.validationErrors || asset.validationErrors.length === 0) &&
                  asset.validationWarnings &&
                  asset.validationWarnings.length > 0 && (
                    <div className="mt-1 text-xs text-warning">
                      {asset.validationWarnings[0]}
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Library Modal */}
      {showLibraryModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowLibraryModal(false)}
        >
          <div
            className="bg-surface rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Asset Library</h3>
              <button
                type="button"
                onClick={() => setShowLibraryModal(false)}
                className="text-text3 hover:text-text"
              >
                ✕
              </button>
            </div>

            {isLoadingLibrary ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
              </div>
            ) : libraryAssets.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-text3">
                <p>No assets in library yet. Upload some assets first!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 overflow-y-auto flex-1">
                {libraryAssets.map((asset) => {
                  const isSelected = selectedAssets.some(a => a.id === asset.id);
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => selectFromLibrary(asset)}
                      disabled={isSelected || selectedAssets.length >= maxAssets}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        isSelected
                          ? 'border-accent opacity-50'
                          : 'border-divider hover:border-accent'
                      }`}
                    >
                      {asset.fileUrl || asset.youtubeVideoId ? (
                        <img
                          src={
                            asset.fileUrl ||
                            `https://img.youtube.com/vi/${asset.youtubeVideoId}/hqdefault.jpg`
                          }
                          alt={asset.fileName || 'Asset'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface2">
                          <span className="text-2xl">📄</span>
                        </div>
                      )}

                      {isSelected && (
                        <div className="absolute inset-0 bg-accent/30 flex items-center justify-center">
                          <span className="text-white text-2xl">✓</span>
                        </div>
                      )}

                      {asset.aspectRatio && (
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                          {asset.aspectRatio}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AssetUploader;
