'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ASPECT_RATIO_DIMENSIONS, calculateCropForRatio, getAvailableCrops } from '@/lib/image-processing';

interface ImageCropperProps {
  imageUrl: string;
  originalWidth: number;
  originalHeight: number;
  onCropComplete: (croppedUrl: string, aspectRatio: string) => void;
  onCancel: () => void;
  targetRatios?: string[];
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropper({
  imageUrl,
  originalWidth,
  originalHeight,
  onCropComplete,
  onCancel,
  targetRatios = ['1:1', '1.91:1', '4:5'],
}: ImageCropperProps) {
  const [selectedRatio, setSelectedRatio] = useState(targetRatios[0] || '1:1');
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Calculate the display dimensions
  const maxDisplayWidth = 600;
  const maxDisplayHeight = 500;
  const scale = Math.min(maxDisplayWidth / originalWidth, maxDisplayHeight / originalHeight);
  const displayWidth = originalWidth * scale;
  const displayHeight = originalHeight * scale;

  // Get available crops
  const availableCrops = getAvailableCrops(originalWidth, originalHeight);

  // Update crop area when ratio changes
  useEffect(() => {
    const crop = calculateCropForRatio(originalWidth, originalHeight, selectedRatio);
    setCropArea(crop);
  }, [selectedRatio, originalWidth, originalHeight]);

  // Convert crop area to display coordinates
  const displayCrop = {
    x: cropArea.x * scale,
    y: cropArea.y * scale,
    width: cropArea.width * scale,
    height: cropArea.height * scale,
  };

  // Handle mouse down on crop area
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - displayCrop.x, y: e.clientY - displayCrop.y });
  }, [displayCrop]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    const newX = (e.clientX - dragStart.x) / scale;
    const newY = (e.clientY - dragStart.y) / scale;

    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(originalWidth - cropArea.width, newX));
    const clampedY = Math.max(0, Math.min(originalHeight - cropArea.height, newY));

    setCropArea(prev => ({
      ...prev,
      x: clampedX,
      y: clampedY,
    }));
  }, [isDragging, dragStart, scale, originalWidth, originalHeight, cropArea.width, cropArea.height]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle crop
  const handleCrop = async () => {
    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/image/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePath: imageUrl,
          operation: 'smartcrop',
          params: {
            width: ASPECT_RATIO_DIMENSIONS[selectedRatio]?.width || cropArea.width,
            height: ASPECT_RATIO_DIMENSIONS[selectedRatio]?.height || cropArea.height,
            type: 'jpeg',
            quality: 95,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Crop failed');
      }

      const data = await response.json();
      onCropComplete(data.url, selectedRatio);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to crop image');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between">
          <h2 className="text-lg font-semibold">Crop Image</h2>
          <button onClick={onCancel} className="text-text3 hover:text-text">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Aspect Ratio Selection */}
          <div className="mb-4">
            <label className="text-sm text-text3 mb-2 block">Aspect Ratio</label>
            <div className="flex flex-wrap gap-2">
              {targetRatios.map(ratio => {
                const cropInfo = availableCrops.find(c => c.ratio === ratio);
                return (
                  <button
                    key={ratio}
                    onClick={() => setSelectedRatio(ratio)}
                    className={`px-4 py-2 rounded-lg border transition-all ${
                      selectedRatio === ratio
                        ? 'border-accent bg-accent-light text-accent'
                        : 'border-divider hover:border-accent'
                    }`}
                  >
                    <span className="font-medium">{ratio}</span>
                    {cropInfo && (
                      <span className={`ml-2 text-xs ${
                        cropInfo.quality === 'optimal' ? 'text-success' :
                        cropInfo.quality === 'acceptable' ? 'text-warning' : 'text-danger'
                      }`}>
                        {cropInfo.quality === 'optimal' ? 'Best' :
                         cropInfo.quality === 'acceptable' ? 'OK' : 'Poor'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Crop Preview */}
          <div
            ref={containerRef}
            className="relative mx-auto bg-surface2 rounded-lg overflow-hidden"
            style={{ width: displayWidth, height: displayHeight }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Original Image */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Original"
              className="w-full h-full object-contain opacity-50"
              draggable={false}
            />

            {/* Dark overlay outside crop area */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top */}
              <div
                className="absolute bg-black/60"
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  height: displayCrop.y,
                }}
              />
              {/* Bottom */}
              <div
                className="absolute bg-black/60"
                style={{
                  top: displayCrop.y + displayCrop.height,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
              {/* Left */}
              <div
                className="absolute bg-black/60"
                style={{
                  top: displayCrop.y,
                  left: 0,
                  width: displayCrop.x,
                  height: displayCrop.height,
                }}
              />
              {/* Right */}
              <div
                className="absolute bg-black/60"
                style={{
                  top: displayCrop.y,
                  left: displayCrop.x + displayCrop.width,
                  right: 0,
                  height: displayCrop.height,
                }}
              />
            </div>

            {/* Crop Area */}
            <div
              className="absolute border-2 border-accent cursor-move"
              style={{
                top: displayCrop.y,
                left: displayCrop.x,
                width: displayCrop.width,
                height: displayCrop.height,
              }}
              onMouseDown={handleMouseDown}
            >
              {/* Preview of cropped area */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: `${displayWidth}px ${displayHeight}px`,
                  backgroundPosition: `-${displayCrop.x}px -${displayCrop.y}px`,
                }}
              />

              {/* Grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-0 right-0 border-t border-white/30" />
                <div className="absolute top-2/3 left-0 right-0 border-t border-white/30" />
                <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/30" />
                <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/30" />
              </div>

              {/* Corner handles (visual only for now) */}
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-accent border border-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent border border-white" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-accent border border-white" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent border border-white" />
            </div>
          </div>

          {/* Dimensions info */}
          <div className="mt-4 text-center text-sm text-text3">
            Crop area: {Math.round(cropArea.width)} × {Math.round(cropArea.height)}px
            <span className="mx-2">|</span>
            Output: {ASPECT_RATIO_DIMENSIONS[selectedRatio]?.width || 'auto'} × {ASPECT_RATIO_DIMENSIONS[selectedRatio]?.height || 'auto'}px
          </div>

          {error && (
            <div className="mt-4 p-3 bg-danger-light text-danger rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-divider flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-text3 hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            disabled={isProcessing}
            className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              'Apply Crop'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageCropper;
