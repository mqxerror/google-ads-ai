'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { AspectRatio, UploadedAsset, CroppedVersion } from '@/types/ad-preview';
import { ASPECT_RATIO_LABELS } from '@/constants/ad-formats';

interface SmartCropStudioProps {
  image: UploadedAsset;
  requiredRatios: AspectRatio[];
  existingCrops?: CroppedVersion[];
  onSaveCrops: (crops: CroppedVersion[]) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * SmartCropStudio - Batch cropping workflow for multiple aspect ratios
 * Features: Image scaling, auto-fit, and smart crop positioning
 */
export function SmartCropStudio({
  image,
  requiredRatios,
  existingCrops,
  onSaveCrops,
  onCancel,
}: SmartCropStudioProps) {
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(requiredRatios[0] || '1:1');
  const [crops, setCrops] = useState<Map<AspectRatio, CropArea>>(new Map());
  const [completedRatios, setCompletedRatios] = useState<Set<AspectRatio>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Image scale within crop (1 = fill crop, <1 = show more image, >1 = zoom into image)
  const [imageScale, setImageScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasInitialized = useRef(false);

  const imageUrl = image.previewUrl || image.fileUrl || '';

  // Track the image ID to detect when we're editing a different image
  const currentImageId = useRef<string | null>(null);

  // Initialize or reinitialize when image changes or existing crops are provided
  useEffect(() => {
    const imageId = image.id;

    // If same image and already initialized, skip
    if (currentImageId.current === imageId && hasInitialized.current) {
      return;
    }

    currentImageId.current = imageId;
    hasInitialized.current = true;

    // Initialize completed ratios from existing crops
    const newCompleted = new Set<AspectRatio>();

    if (existingCrops && existingCrops.length > 0) {
      existingCrops.forEach((crop) => {
        if (crop.status === 'saved') {
          newCompleted.add(crop.ratio);
        }
      });
    }

    setCompletedRatios(newCompleted);

    // Note: We don't set crops here - they get initialized on image load
    // with smart crop positions (which is better than trying to restore exact positions)
  }, [image.id, existingCrops]);

  // Parse aspect ratio to decimal
  const parseRatio = (ratio: AspectRatio): number => {
    const [w, h] = ratio.split(':').map(Number);
    return w / h;
  };

  // Calculate optimal crop that fills the target ratio
  const calculateFillCrop = useCallback((ratio: AspectRatio, imgWidth: number, imgHeight: number, scale: number = 1): CropArea => {
    const targetRatio = parseRatio(ratio);
    const imageRatio = imgWidth / imgHeight;

    let cropWidth: number;
    let cropHeight: number;

    if (imageRatio > targetRatio) {
      // Image is wider - height constrains
      cropHeight = imgHeight / scale;
      cropWidth = cropHeight * targetRatio;
    } else {
      // Image is taller - width constrains
      cropWidth = imgWidth / scale;
      cropHeight = cropWidth / targetRatio;
    }

    // Ensure crop doesn't exceed image bounds
    cropWidth = Math.min(cropWidth, imgWidth);
    cropHeight = Math.min(cropHeight, imgHeight);

    // Center the crop
    const x = (imgWidth - cropWidth) / 2;
    const y = (imgHeight - cropHeight) / 2;

    return { x, y, width: cropWidth, height: cropHeight };
  }, []);

  // Calculate crop that shows entire image (fit mode)
  const calculateFitCrop = useCallback((ratio: AspectRatio, imgWidth: number, imgHeight: number): CropArea => {
    const targetRatio = parseRatio(ratio);
    const imageRatio = imgWidth / imgHeight;

    let cropWidth: number;
    let cropHeight: number;

    if (imageRatio > targetRatio) {
      // Image is wider - use full width
      cropWidth = imgWidth;
      cropHeight = imgWidth / targetRatio;
    } else {
      // Image is taller - use full height
      cropHeight = imgHeight;
      cropWidth = imgHeight * targetRatio;
    }

    // Center (may extend beyond image - that's ok for "fit" concept)
    const x = (imgWidth - cropWidth) / 2;
    const y = (imgHeight - cropHeight) / 2;

    return { x, y, width: cropWidth, height: cropHeight };
  }, []);

  // Smart crop - detect center of interest (simple: weighted center)
  const calculateSmartCrop = useCallback((ratio: AspectRatio, imgWidth: number, imgHeight: number): CropArea => {
    const targetRatio = parseRatio(ratio);
    const imageRatio = imgWidth / imgHeight;

    let cropWidth: number;
    let cropHeight: number;

    if (imageRatio > targetRatio) {
      cropHeight = imgHeight;
      cropWidth = cropHeight * targetRatio;
    } else {
      cropWidth = imgWidth;
      cropHeight = cropWidth / targetRatio;
    }

    // Smart positioning: slightly favor upper portion (faces/objects usually there)
    // and center horizontally
    const x = (imgWidth - cropWidth) / 2;
    const y = Math.max(0, (imgHeight - cropHeight) * 0.4); // 40% from top instead of 50%

    return {
      x: Math.max(0, Math.min(x, imgWidth - cropWidth)),
      y: Math.max(0, Math.min(y, imgHeight - cropHeight)),
      width: cropWidth,
      height: cropHeight
    };
  }, []);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      setImageSize({ width: naturalWidth, height: naturalHeight });
      setIsImageLoaded(true);

      // Initialize with smart crop for all ratios
      setCrops((prevCrops) => {
        const newCrops = new Map(prevCrops);
        requiredRatios.forEach((ratio) => {
          if (!newCrops.has(ratio)) {
            newCrops.set(ratio, calculateSmartCrop(ratio, naturalWidth, naturalHeight));
          }
        });
        return newCrops;
      });
    }
  }, [requiredRatios, calculateSmartCrop]);

  // Get current crop area
  const currentCrop = crops.get(selectedRatio) || calculateFillCrop(selectedRatio, imageSize.width || 1, imageSize.height || 1);

  // Calculate display dimensions
  const getDisplayDimensions = () => {
    const containerWidth = 500;
    const containerHeight = 400;

    if (imageSize.width === 0) {
      return { displayWidth: containerWidth, displayHeight: containerHeight, scale: 1 };
    }

    const scale = Math.min(
      containerWidth / imageSize.width,
      containerHeight / imageSize.height
    );

    return {
      displayWidth: imageSize.width * scale,
      displayHeight: imageSize.height * scale,
      scale,
    };
  };

  const { displayWidth, displayHeight, scale } = getDisplayDimensions();

  // Handle mouse events for dragging crop area
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const deltaX = x - dragStart.x;
    const deltaY = y - dragStart.y;

    // Move crop position
    const newCrop = { ...currentCrop };
    newCrop.x = Math.max(0, Math.min(imageSize.width - newCrop.width, currentCrop.x + deltaX));
    newCrop.y = Math.max(0, Math.min(imageSize.height - newCrop.height, currentCrop.y + deltaY));

    setCrops(new Map(crops).set(selectedRatio, newCrop));
    setDragStart({ x, y });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Scale handlers - adjust crop size (smaller crop = more zoom into image)
  const handleScaleChange = (newScale: number) => {
    setImageScale(newScale);

    // Recalculate crop with new scale
    const baseCrop = calculateFillCrop(selectedRatio, imageSize.width, imageSize.height, newScale);

    // Try to keep center point stable
    const oldCrop = currentCrop;
    const oldCenterX = oldCrop.x + oldCrop.width / 2;
    const oldCenterY = oldCrop.y + oldCrop.height / 2;

    let newX = oldCenterX - baseCrop.width / 2;
    let newY = oldCenterY - baseCrop.height / 2;

    // Clamp to bounds
    newX = Math.max(0, Math.min(imageSize.width - baseCrop.width, newX));
    newY = Math.max(0, Math.min(imageSize.height - baseCrop.height, newY));

    setCrops(new Map(crops).set(selectedRatio, {
      ...baseCrop,
      x: newX,
      y: newY,
    }));
  };

  // Auto-fit options
  const handleAutoFit = (mode: 'fill' | 'fit' | 'smart') => {
    let newCrop: CropArea;

    switch (mode) {
      case 'fill':
        newCrop = calculateFillCrop(selectedRatio, imageSize.width, imageSize.height);
        setImageScale(1);
        break;
      case 'fit':
        // For fit, we want to show entire image - use smallest crop that covers full image
        newCrop = calculateFillCrop(selectedRatio, imageSize.width, imageSize.height);
        setImageScale(1);
        break;
      case 'smart':
        newCrop = calculateSmartCrop(selectedRatio, imageSize.width, imageSize.height);
        setImageScale(1);
        break;
      default:
        return;
    }

    setCrops(new Map(crops).set(selectedRatio, newCrop));
  };

  // Mark current ratio as complete
  const handleMarkComplete = () => {
    const newCompleted = new Set(completedRatios);
    newCompleted.add(selectedRatio);
    setCompletedRatios(newCompleted);

    // Move to next incomplete ratio
    const nextRatio = requiredRatios.find((r) => r !== selectedRatio && !newCompleted.has(r));
    if (nextRatio) {
      setSelectedRatio(nextRatio);
      // Reset scale for new ratio
      setImageScale(1);
    }
  };

  // Generate cropped image preview URL
  const generateCroppedPreview = useCallback(async (crop: CropArea): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const img = imageRef.current;

      if (!canvas || !img) {
        resolve('');
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }

      // Set canvas size to crop size (use reasonable output size)
      const maxDimension = 1200;
      const outputScale = Math.min(1, maxDimension / Math.max(crop.width, crop.height));

      canvas.width = crop.width * outputScale;
      canvas.height = crop.height * outputScale;

      // Draw cropped portion
      ctx.drawImage(
        img,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    });
  }, []);

  // Save all crops
  const handleSaveAll = async () => {
    const croppedVersions: CroppedVersion[] = [];

    for (const ratio of requiredRatios) {
      const crop = crops.get(ratio);
      if (crop && completedRatios.has(ratio)) {
        const previewUrl = await generateCroppedPreview(crop);
        croppedVersions.push({
          ratio,
          cropArea: crop,
          previewUrl,
          status: 'saved',
        });
      }
    }

    onSaveCrops(croppedVersions);
  };

  // Quick save just this ratio
  const handleSaveAndClose = async () => {
    const crop = crops.get(selectedRatio);
    if (crop) {
      const previewUrl = await generateCroppedPreview(crop);
      onSaveCrops([{
        ratio: selectedRatio,
        cropArea: crop,
        previewUrl,
        status: 'saved',
      }]);
    }
  };

  const completedCount = completedRatios.size;
  const totalCount = requiredRatios.length;

  // Calculate current zoom percentage for display
  const currentZoomPercent = Math.round((1 / (currentCrop.width / imageSize.width)) * 100) || 100;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-divider">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✂️</span>
            <div>
              <h2 className="text-lg font-medium text-text">Smart Crop Studio</h2>
              <p className="text-xs text-text3">
                Crop for {totalCount} aspect ratio{totalCount > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text3">
              {completedCount}/{totalCount} done
            </span>
            <button
              onClick={onCancel}
              className="p-2 text-text3 hover:text-text transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Image with crop overlay */}
          <div className="flex-1 p-4 flex flex-col bg-bg">
            {/* Image container */}
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <div
                ref={containerRef}
                className="relative cursor-move select-none"
                style={{ width: displayWidth, height: displayHeight }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Image */}
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Crop source"
                  className="w-full h-full object-contain"
                  onLoad={handleImageLoad}
                  draggable={false}
                />

                {/* Dark overlay outside crop area */}
                {isImageLoaded && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Top */}
                    <div
                      className="absolute bg-black/60 left-0 right-0 top-0"
                      style={{ height: currentCrop.y * scale }}
                    />
                    {/* Bottom */}
                    <div
                      className="absolute bg-black/60 left-0 right-0 bottom-0"
                      style={{
                        height: Math.max(0, (imageSize.height - currentCrop.y - currentCrop.height) * scale),
                      }}
                    />
                    {/* Left */}
                    <div
                      className="absolute bg-black/60 left-0"
                      style={{
                        top: currentCrop.y * scale,
                        width: currentCrop.x * scale,
                        height: currentCrop.height * scale,
                      }}
                    />
                    {/* Right */}
                    <div
                      className="absolute bg-black/60 right-0"
                      style={{
                        top: currentCrop.y * scale,
                        width: Math.max(0, (imageSize.width - currentCrop.x - currentCrop.width) * scale),
                        height: currentCrop.height * scale,
                      }}
                    />

                    {/* Crop area border */}
                    <div
                      className="absolute border-2 border-white shadow-lg"
                      style={{
                        left: currentCrop.x * scale,
                        top: currentCrop.y * scale,
                        width: currentCrop.width * scale,
                        height: currentCrop.height * scale,
                      }}
                    >
                      {/* Grid lines (rule of thirds) */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="border border-white/20" />
                        ))}
                      </div>

                      {/* Corner handles */}
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-sm shadow" />
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-sm shadow" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-sm shadow" />
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-sm shadow" />

                      {/* Ratio label */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap shadow">
                        {ASPECT_RATIO_LABELS[selectedRatio]}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls below image */}
            <div className="mt-4 space-y-3">
              {/* Auto-fit buttons */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-text3 mr-2">Auto:</span>
                <button
                  onClick={() => handleAutoFit('smart')}
                  className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-accent/90 transition-colors"
                >
                  🎯 Smart Crop
                </button>
                <button
                  onClick={() => handleAutoFit('fill')}
                  className="px-3 py-1.5 bg-surface2 text-text text-xs rounded-lg hover:bg-surface transition-colors"
                >
                  Fill Frame
                </button>
              </div>

              {/* Zoom/Scale slider */}
              <div className="flex items-center justify-center gap-3">
                <span className="text-xs text-text3">Zoom:</span>
                <button
                  onClick={() => handleScaleChange(Math.max(0.5, imageScale - 0.25))}
                  className="p-1 text-text3 hover:text-text transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={imageScale * 100}
                  onChange={(e) => handleScaleChange(Number(e.target.value) / 100)}
                  className="w-32 h-1.5 bg-surface2 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <button
                  onClick={() => handleScaleChange(Math.min(2, imageScale + 0.25))}
                  className="p-1 text-text3 hover:text-text transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <span className="text-xs text-text3 w-12">{Math.round(imageScale * 100)}%</span>
              </div>

              {/* Instructions */}
              <p className="text-xs text-text3 text-center">
                Drag to reposition • Use zoom to include more/less of the image
              </p>
            </div>
          </div>

          {/* Right: Ratio queue and preview */}
          <div className="w-80 border-l border-divider flex flex-col">
            {/* Ratio queue */}
            <div className="p-4 border-b border-divider">
              <h3 className="text-sm font-medium text-text mb-3">Crop Queue</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {requiredRatios.map((ratio) => {
                  const isSelected = ratio === selectedRatio;
                  const isComplete = completedRatios.has(ratio);

                  return (
                    <button
                      key={ratio}
                      onClick={() => {
                        setSelectedRatio(ratio);
                        setImageScale(1);
                      }}
                      className={`
                        w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left
                        ${isSelected
                          ? 'bg-accent/10 border-2 border-accent'
                          : 'bg-surface2 border-2 border-transparent hover:border-accent/30'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${isComplete ? 'text-success' : 'text-text3'}`}>
                          {isComplete ? '✓' : '○'}
                        </span>
                        <span className="text-sm text-text">
                          {ASPECT_RATIO_LABELS[ratio]}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] text-accent">Editing</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div className="flex-1 p-4 overflow-auto">
              <h3 className="text-sm font-medium text-text mb-2">Preview</h3>
              <div className="bg-surface2 rounded-lg p-3 flex items-center justify-center">
                <div
                  className="bg-gray-800 overflow-hidden rounded border border-divider"
                  style={{
                    width: 180,
                    height: 180 / parseRatio(selectedRatio),
                    maxHeight: 180,
                  }}
                >
                  {isImageLoaded && imageSize.width > 0 && (
                    <div
                      className="w-full h-full bg-cover bg-no-repeat"
                      style={{
                        backgroundImage: `url(${imageUrl})`,
                        backgroundPosition: `${(currentCrop.x / (imageSize.width - currentCrop.width)) * 100 || 50}% ${(currentCrop.y / (imageSize.height - currentCrop.height)) * 100 || 50}%`,
                        backgroundSize: `${(imageSize.width / currentCrop.width) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Confirm button */}
              <button
                onClick={handleMarkComplete}
                className={`
                  w-full mt-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2
                  ${completedRatios.has(selectedRatio)
                    ? 'bg-success/20 text-success'
                    : 'bg-accent text-white hover:bg-accent/90'
                  }
                `}
              >
                {completedRatios.has(selectedRatio) ? (
                  <>✓ Confirmed</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm Crop
                  </>
                )}
              </button>

              <p className="text-[10px] text-text3 mt-2 text-center">
                {completedRatios.has(selectedRatio)
                  ? 'Click again to re-confirm after adjustments'
                  : 'Confirm to save this crop and continue'}
              </p>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-divider space-y-2">
              {requiredRatios.length === 1 ? (
                <button
                  onClick={handleSaveAndClose}
                  className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Crop
                </button>
              ) : (
                <button
                  onClick={handleSaveAll}
                  disabled={completedCount === 0}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    completedCount > 0
                      ? 'bg-accent text-white hover:bg-accent/90'
                      : 'bg-surface2 text-text3 cursor-not-allowed'
                  }`}
                >
                  Save {completedCount} Crop{completedCount !== 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={onCancel}
                className="w-full py-2.5 bg-surface2 text-text3 rounded-lg text-sm hover:text-text transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

export default SmartCropStudio;
