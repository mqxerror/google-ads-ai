/**
 * Google Ads Character Limits & Asset Requirements
 * These limits are enforced by the Google Ads API
 */

// ============================================================================
// TEXT LIMITS
// ============================================================================

export const AD_TEXT_LIMITS = {
  // Headlines
  HEADLINE_MAX_LENGTH: 30,
  HEADLINE_MIN_COUNT: 3,
  HEADLINE_MAX_COUNT: 15,

  // Long Headlines (PMax, Demand Gen)
  LONG_HEADLINE_MAX_LENGTH: 90,
  LONG_HEADLINE_MIN_COUNT: 1,
  LONG_HEADLINE_MAX_COUNT: 5,

  // Descriptions
  DESCRIPTION_MAX_LENGTH: 90,
  DESCRIPTION_MIN_COUNT: 2,
  DESCRIPTION_MAX_COUNT: 4,

  // Business Name
  BUSINESS_NAME_MAX_LENGTH: 25,

  // Display URL Paths
  PATH_MAX_LENGTH: 15,

  // Sitelink Extensions
  SITELINK_TEXT_MAX_LENGTH: 25,
  SITELINK_DESCRIPTION_MAX_LENGTH: 35,

  // Callout Extensions
  CALLOUT_MAX_LENGTH: 25,

  // Structured Snippets
  SNIPPET_HEADER_MAX_LENGTH: 25,
  SNIPPET_VALUE_MAX_LENGTH: 25,
};

// ============================================================================
// IMAGE REQUIREMENTS
// ============================================================================

export interface ImageRequirement {
  aspectRatio: string;
  minWidth: number;
  minHeight: number;
  recommendedWidth: number;
  recommendedHeight: number;
  maxFileSize: number; // in bytes
  formats: string[];
}

export const IMAGE_REQUIREMENTS: Record<string, ImageRequirement> = {
  'landscape': {
    aspectRatio: '1.91:1',
    minWidth: 600,
    minHeight: 314,
    recommendedWidth: 1200,
    recommendedHeight: 628,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    formats: ['image/jpeg', 'image/png', 'image/gif'],
  },
  'square': {
    aspectRatio: '1:1',
    minWidth: 300,
    minHeight: 300,
    recommendedWidth: 1200,
    recommendedHeight: 1200,
    maxFileSize: 5 * 1024 * 1024,
    formats: ['image/jpeg', 'image/png', 'image/gif'],
  },
  'portrait': {
    aspectRatio: '4:5',
    minWidth: 480,
    minHeight: 600,
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    maxFileSize: 5 * 1024 * 1024,
    formats: ['image/jpeg', 'image/png', 'image/gif'],
  },
  'logo_square': {
    aspectRatio: '1:1',
    minWidth: 128,
    minHeight: 128,
    recommendedWidth: 1200,
    recommendedHeight: 1200,
    maxFileSize: 5 * 1024 * 1024,
    formats: ['image/jpeg', 'image/png'],
  },
  'logo_landscape': {
    aspectRatio: '4:1',
    minWidth: 512,
    minHeight: 128,
    recommendedWidth: 1200,
    recommendedHeight: 300,
    maxFileSize: 5 * 1024 * 1024,
    formats: ['image/jpeg', 'image/png'],
  },
};

// ============================================================================
// VIDEO REQUIREMENTS
// ============================================================================

export const VIDEO_REQUIREMENTS = {
  maxFileSize: 256 * 1024 * 1024, // 256MB
  minDuration: 6, // seconds
  maxDuration: 180, // 3 minutes for most formats
  formats: ['video/mp4', 'video/webm', 'video/quicktime'],
  minWidth: 480,
  minHeight: 360,
  recommendedWidth: 1920,
  recommendedHeight: 1080,
};

// ============================================================================
// ASSET GROUP REQUIREMENTS BY CAMPAIGN TYPE
// ============================================================================

export interface AssetGroupRequirements {
  headlines: { min: number; max: number; maxLength: number };
  longHeadlines?: { min: number; max: number; maxLength: number };
  descriptions: { min: number; max: number; maxLength: number };
  images: { min: number; max: number; requiredRatios: string[] };
  logos: { min: number; max: number; requiredRatios: string[] };
  videos?: { min: number; max: number };
}

export const ASSET_REQUIREMENTS_BY_TYPE: Record<string, AssetGroupRequirements> = {
  SEARCH: {
    headlines: { min: 3, max: 15, maxLength: 30 },
    descriptions: { min: 2, max: 4, maxLength: 90 },
    images: { min: 0, max: 0, requiredRatios: [] },
    logos: { min: 0, max: 0, requiredRatios: [] },
  },
  PMAX: {
    headlines: { min: 3, max: 15, maxLength: 30 },
    longHeadlines: { min: 1, max: 5, maxLength: 90 },
    descriptions: { min: 2, max: 5, maxLength: 90 },
    images: { min: 1, max: 20, requiredRatios: ['1.91:1', '1:1', '4:5'] },
    logos: { min: 1, max: 5, requiredRatios: ['1:1'] },
    videos: { min: 0, max: 5 },
  },
  DISPLAY: {
    headlines: { min: 3, max: 15, maxLength: 30 },
    longHeadlines: { min: 1, max: 5, maxLength: 90 },
    descriptions: { min: 2, max: 5, maxLength: 90 },
    images: { min: 1, max: 15, requiredRatios: ['1.91:1', '1:1'] },
    logos: { min: 1, max: 5, requiredRatios: ['1:1'] },
  },
  DEMAND_GEN: {
    headlines: { min: 3, max: 15, maxLength: 30 },
    longHeadlines: { min: 1, max: 5, maxLength: 90 },
    descriptions: { min: 2, max: 5, maxLength: 90 },
    images: { min: 1, max: 20, requiredRatios: ['1.91:1', '1:1', '4:5'] },
    logos: { min: 1, max: 5, requiredRatios: ['1:1'] },
    videos: { min: 0, max: 5 },
  },
  VIDEO: {
    headlines: { min: 1, max: 5, maxLength: 30 },
    descriptions: { min: 1, max: 2, maxLength: 90 },
    images: { min: 0, max: 1, requiredRatios: ['1:1'] }, // Companion banner
    logos: { min: 0, max: 1, requiredRatios: ['1:1'] },
    videos: { min: 1, max: 1 },
  },
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate headline length
 */
export function isValidHeadline(text: string, maxLength = AD_TEXT_LIMITS.HEADLINE_MAX_LENGTH): boolean {
  return text.length > 0 && text.length <= maxLength;
}

/**
 * Validate description length
 */
export function isValidDescription(text: string): boolean {
  return text.length > 0 && text.length <= AD_TEXT_LIMITS.DESCRIPTION_MAX_LENGTH;
}

/**
 * Get remaining characters
 */
export function getRemainingChars(text: string, maxLength: number): number {
  return maxLength - text.length;
}

/**
 * Get validation status (for UI indicators)
 */
export function getTextValidationStatus(
  text: string,
  maxLength: number
): 'empty' | 'valid' | 'warning' | 'error' {
  if (text.length === 0) return 'empty';
  if (text.length > maxLength) return 'error';
  if (text.length > maxLength * 0.9) return 'warning';
  return 'valid';
}
