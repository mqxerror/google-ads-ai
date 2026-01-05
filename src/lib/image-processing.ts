/**
 * Image Processing Service
 * Uses imaginary API for resize, crop, and transformation operations
 *
 * imaginary API: https://imaginary.pixelcraftedmedia.com
 * imgproxy API: https://imgproxy.pixelcraftedmedia.com (for WebP compression)
 */

const IMAGINARY_URL = process.env.IMAGINARY_URL || 'https://imaginary.pixelcraftedmedia.com';
const IMGPROXY_URL = process.env.IMGPROXY_URL || 'https://imgproxy.pixelcraftedmedia.com';

// Google Ads image requirements by aspect ratio
export const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number; minWidth: number; minHeight: number }> = {
  '1:1': { width: 1200, height: 1200, minWidth: 300, minHeight: 300 },
  '1.91:1': { width: 1200, height: 628, minWidth: 600, minHeight: 314 },
  '4:5': { width: 1080, height: 1350, minWidth: 480, minHeight: 600 },
  '16:9': { width: 1920, height: 1080, minWidth: 600, minHeight: 338 },
  '9:16': { width: 1080, height: 1920, minWidth: 338, minHeight: 600 },
};

export interface CropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeOptions {
  width: number;
  height: number;
  fit?: 'cover' | 'contain' | 'fill';
}

export interface ImageProcessingResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Resize an image to specific dimensions
 */
export async function resizeImage(
  imageUrl: string,
  options: ResizeOptions
): Promise<ImageProcessingResult> {
  try {
    const params = new URLSearchParams({
      width: options.width.toString(),
      height: options.height.toString(),
      type: 'jpeg',
      quality: '95',
    });

    // For imaginary, if it's a local URL, we need to fetch and post the image
    if (imageUrl.startsWith('/')) {
      // Local file - need to use POST with file upload
      return await processLocalImage(imageUrl, 'resize', params);
    }

    // Remote URL - use direct URL parameter
    params.append('url', imageUrl);
    const processedUrl = `${IMAGINARY_URL}/resize?${params.toString()}`;

    return { success: true, url: processedUrl };
  } catch (error) {
    console.error('Resize error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resize image',
    };
  }
}

/**
 * Crop an image to specific dimensions
 */
export async function cropImage(
  imageUrl: string,
  options: CropOptions
): Promise<ImageProcessingResult> {
  try {
    const params = new URLSearchParams({
      width: options.width.toString(),
      height: options.height.toString(),
      top: options.y.toString(),
      left: options.x.toString(),
      type: 'jpeg',
      quality: '95',
    });

    if (imageUrl.startsWith('/')) {
      return await processLocalImage(imageUrl, 'crop', params);
    }

    params.append('url', imageUrl);
    const processedUrl = `${IMAGINARY_URL}/crop?${params.toString()}`;

    return { success: true, url: processedUrl };
  } catch (error) {
    console.error('Crop error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to crop image',
    };
  }
}

/**
 * Smart crop to target aspect ratio (centered)
 */
export async function smartCropToRatio(
  imageUrl: string,
  targetRatio: string,
  originalWidth: number,
  originalHeight: number
): Promise<ImageProcessingResult> {
  try {
    const dimensions = ASPECT_RATIO_DIMENSIONS[targetRatio];
    if (!dimensions) {
      return { success: false, error: `Unknown aspect ratio: ${targetRatio}` };
    }

    const targetAspect = dimensions.width / dimensions.height;
    const originalAspect = originalWidth / originalHeight;

    let cropWidth: number;
    let cropHeight: number;
    let cropX: number;
    let cropY: number;

    if (originalAspect > targetAspect) {
      // Image is wider than target - crop sides
      cropHeight = originalHeight;
      cropWidth = Math.round(cropHeight * targetAspect);
      cropX = Math.round((originalWidth - cropWidth) / 2);
      cropY = 0;
    } else {
      // Image is taller than target - crop top/bottom
      cropWidth = originalWidth;
      cropHeight = Math.round(cropWidth / targetAspect);
      cropX = 0;
      cropY = Math.round((originalHeight - cropHeight) / 2);
    }

    // Use imaginary's smart crop feature
    const params = new URLSearchParams({
      width: dimensions.width.toString(),
      height: dimensions.height.toString(),
      type: 'jpeg',
      quality: '95',
    });

    if (imageUrl.startsWith('/')) {
      return await processLocalImage(imageUrl, 'smartcrop', params);
    }

    params.append('url', imageUrl);
    const processedUrl = `${IMAGINARY_URL}/smartcrop?${params.toString()}`;

    return { success: true, url: processedUrl };
  } catch (error) {
    console.error('Smart crop error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to smart crop image',
    };
  }
}

/**
 * Fit image to exact dimensions (with letterboxing/pillarboxing if needed)
 */
export async function fitImage(
  imageUrl: string,
  width: number,
  height: number,
  backgroundColor: string = 'white'
): Promise<ImageProcessingResult> {
  try {
    const params = new URLSearchParams({
      width: width.toString(),
      height: height.toString(),
      type: 'jpeg',
      quality: '95',
      embed: 'true', // Embed in canvas
      background: backgroundColor,
    });

    if (imageUrl.startsWith('/')) {
      return await processLocalImage(imageUrl, 'embed', params);
    }

    params.append('url', imageUrl);
    const processedUrl = `${IMAGINARY_URL}/embed?${params.toString()}`;

    return { success: true, url: processedUrl };
  } catch (error) {
    console.error('Fit error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fit image',
    };
  }
}

/**
 * Rotate image
 */
export async function rotateImage(
  imageUrl: string,
  degrees: number
): Promise<ImageProcessingResult> {
  try {
    const params = new URLSearchParams({
      rotate: degrees.toString(),
      type: 'jpeg',
      quality: '95',
    });

    if (imageUrl.startsWith('/')) {
      return await processLocalImage(imageUrl, 'rotate', params);
    }

    params.append('url', imageUrl);
    const processedUrl = `${IMAGINARY_URL}/rotate?${params.toString()}`;

    return { success: true, url: processedUrl };
  } catch (error) {
    console.error('Rotate error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rotate image',
    };
  }
}

/**
 * Compress image using imgproxy (WebP at q92)
 */
export function getCompressedUrl(imageUrl: string, maxWidth: number = 2048): string {
  // imgproxy format: /insecure/rs:fit:width:height/q:quality/plain/url@webp
  const encodedUrl = encodeURIComponent(imageUrl);
  return `${IMGPROXY_URL}/insecure/rs:fit:${maxWidth}:${maxWidth}/q:92/plain/${encodedUrl}@webp`;
}

/**
 * Process a local image file by uploading to imaginary
 */
async function processLocalImage(
  localPath: string,
  operation: string,
  params: URLSearchParams
): Promise<ImageProcessingResult> {
  try {
    // For local files, we need to call our own API endpoint to proxy the request
    const response = await fetch('/api/image/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagePath: localPath,
        operation,
        params: Object.fromEntries(params.entries()),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Processing failed' };
    }

    const data = await response.json();
    return { success: true, url: data.url };
  } catch (error) {
    console.error('Local image processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process local image',
    };
  }
}

/**
 * Calculate crop dimensions to fit target aspect ratio
 */
export function calculateCropForRatio(
  originalWidth: number,
  originalHeight: number,
  targetRatio: string
): { x: number; y: number; width: number; height: number } {
  const dimensions = ASPECT_RATIO_DIMENSIONS[targetRatio];
  if (!dimensions) {
    return { x: 0, y: 0, width: originalWidth, height: originalHeight };
  }

  const targetAspect = dimensions.width / dimensions.height;
  const originalAspect = originalWidth / originalHeight;

  let cropWidth: number;
  let cropHeight: number;
  let cropX: number;
  let cropY: number;

  if (originalAspect > targetAspect) {
    // Image is wider than target - crop sides
    cropHeight = originalHeight;
    cropWidth = Math.round(cropHeight * targetAspect);
    cropX = Math.round((originalWidth - cropWidth) / 2);
    cropY = 0;
  } else {
    // Image is taller than target - crop top/bottom
    cropWidth = originalWidth;
    cropHeight = Math.round(cropWidth / targetAspect);
    cropX = 0;
    cropY = Math.round((originalHeight - cropHeight) / 2);
  }

  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
}

/**
 * Get available crops for an image based on its dimensions
 */
export function getAvailableCrops(
  originalWidth: number,
  originalHeight: number
): { ratio: string; dimensions: { width: number; height: number }; quality: 'optimal' | 'acceptable' | 'poor' }[] {
  const results: { ratio: string; dimensions: { width: number; height: number }; quality: 'optimal' | 'acceptable' | 'poor' }[] = [];

  for (const [ratio, dims] of Object.entries(ASPECT_RATIO_DIMENSIONS)) {
    const crop = calculateCropForRatio(originalWidth, originalHeight, ratio);

    // Determine quality based on how much of the original image is used
    const usedArea = (crop.width * crop.height) / (originalWidth * originalHeight);
    const meetsMinimum = crop.width >= dims.minWidth && crop.height >= dims.minHeight;

    let quality: 'optimal' | 'acceptable' | 'poor';
    if (!meetsMinimum) {
      quality = 'poor';
    } else if (usedArea >= 0.8) {
      quality = 'optimal';
    } else if (usedArea >= 0.5) {
      quality = 'acceptable';
    } else {
      quality = 'poor';
    }

    results.push({
      ratio,
      dimensions: { width: crop.width, height: crop.height },
      quality,
    });
  }

  return results;
}
