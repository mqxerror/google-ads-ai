/**
 * Ad Format Constants
 * Configuration for all supported ad formats across campaign types
 */

import type { FormatConfig, CampaignType, AspectRatio } from '@/types/ad-preview';

export const AD_FORMATS: FormatConfig[] = [
  // Display Formats
  {
    id: 'display-300x250',
    name: 'Medium Rectangle',
    width: 300,
    height: 250,
    aspectRatio: '1.91:1',
    campaignTypes: ['DISPLAY', 'PMAX', 'DEMAND_GEN'],
    category: 'display',
    icon: '🖼️',
  },
  {
    id: 'display-728x90',
    name: 'Leaderboard',
    width: 728,
    height: 90,
    aspectRatio: '1.91:1',
    campaignTypes: ['DISPLAY', 'PMAX'],
    category: 'display',
    icon: '📏',
  },
  {
    id: 'display-160x600',
    name: 'Wide Skyscraper',
    width: 160,
    height: 600,
    aspectRatio: '4:5',
    campaignTypes: ['DISPLAY', 'PMAX'],
    category: 'display',
    icon: '📐',
  },
  {
    id: 'display-320x50',
    name: 'Mobile Banner',
    width: 320,
    height: 50,
    aspectRatio: '1.91:1',
    campaignTypes: ['DISPLAY', 'PMAX'],
    category: 'display',
    icon: '📱',
  },
  {
    id: 'display-300x600',
    name: 'Half Page',
    width: 300,
    height: 600,
    aspectRatio: '4:5',
    campaignTypes: ['DISPLAY', 'PMAX'],
    category: 'display',
    icon: '📄',
  },
  // YouTube Formats
  {
    id: 'youtube-instream',
    name: 'In-Stream',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    campaignTypes: ['VIDEO', 'PMAX', 'DEMAND_GEN'],
    category: 'youtube',
    icon: '▶️',
  },
  {
    id: 'youtube-discovery',
    name: 'Discovery',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    campaignTypes: ['VIDEO', 'PMAX', 'DEMAND_GEN'],
    category: 'youtube',
    icon: '🔍',
  },
  {
    id: 'youtube-shorts',
    name: 'Shorts',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    campaignTypes: ['VIDEO', 'DEMAND_GEN'],
    category: 'youtube',
    icon: '📹',
  },
  // Gmail/Discover Formats
  {
    id: 'gmail-feed',
    name: 'Gmail Promotions',
    width: 600,
    height: 314,
    aspectRatio: '1.91:1',
    campaignTypes: ['PMAX', 'DEMAND_GEN'],
    category: 'gmail',
    icon: '📧',
  },
  {
    id: 'discover-feed',
    name: 'Discover Feed',
    width: 600,
    height: 600,
    aspectRatio: '1:1',
    campaignTypes: ['PMAX', 'DEMAND_GEN'],
    category: 'discover',
    icon: '🌐',
  },
  // Search Formats
  {
    id: 'search-desktop',
    name: 'Desktop Search',
    width: 600,
    height: 150,
    aspectRatio: '1.91:1',
    campaignTypes: ['SEARCH', 'PMAX'],
    category: 'search',
    icon: '🖥️',
  },
  {
    id: 'search-mobile',
    name: 'Mobile Search',
    width: 375,
    height: 200,
    aspectRatio: '1.91:1',
    campaignTypes: ['SEARCH', 'PMAX'],
    category: 'search',
    icon: '📱',
  },
];

export const ASPECT_RATIO_REQUIREMENTS: Record<
  CampaignType,
  {
    images: { required: AspectRatio[]; recommended: AspectRatio[]; optional: AspectRatio[] };
    logos: { required: AspectRatio[]; recommended: AspectRatio[]; optional: AspectRatio[] };
  }
> = {
  PMAX: {
    images: {
      required: ['1.91:1', '1:1'],
      recommended: ['4:5'],
      optional: ['9:16'],
    },
    logos: {
      required: ['1:1'],
      recommended: ['4:1'],
      optional: [],
    },
  },
  DISPLAY: {
    images: {
      required: ['1.91:1'],
      recommended: ['1:1'],
      optional: ['4:5'],
    },
    logos: {
      required: ['1:1'],
      recommended: [],
      optional: [],
    },
  },
  DEMAND_GEN: {
    images: {
      required: ['1.91:1', '1:1'],
      recommended: ['4:5', '9:16'],
      optional: [],
    },
    logos: {
      required: ['1:1'],
      recommended: [],
      optional: [],
    },
  },
  VIDEO: {
    images: {
      required: [],
      recommended: ['16:9'],
      optional: ['1:1'],
    },
    logos: {
      required: [],
      recommended: ['1:1'],
      optional: [],
    },
  },
  SEARCH: {
    images: {
      required: [],
      recommended: [],
      optional: [],
    },
    logos: {
      required: [],
      recommended: [],
      optional: [],
    },
  },
};

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  '1:1': 'Square',
  '1.91:1': 'Landscape',
  '4:5': 'Portrait',
  '9:16': 'Vertical',
  '16:9': 'Widescreen',
  '4:1': 'Wide Banner',
};

export const FORMAT_CATEGORIES = {
  display: { label: 'Display Network', icon: '🖼️' },
  youtube: { label: 'YouTube', icon: '▶️' },
  gmail: { label: 'Gmail', icon: '📧' },
  discover: { label: 'Discover', icon: '🌐' },
  search: { label: 'Search', icon: '🔍' },
};

/**
 * Get formats available for a specific campaign type
 */
export function getFormatsForCampaignType(campaignType: CampaignType): FormatConfig[] {
  return AD_FORMATS.filter((format) => format.campaignTypes.includes(campaignType));
}

/**
 * Get formats grouped by category for a campaign type
 */
export function getFormatsGroupedByCategory(
  campaignType: CampaignType
): Record<string, FormatConfig[]> {
  const formats = getFormatsForCampaignType(campaignType);
  return formats.reduce(
    (acc, format) => {
      if (!acc[format.category]) {
        acc[format.category] = [];
      }
      acc[format.category].push(format);
      return acc;
    },
    {} as Record<string, FormatConfig[]>
  );
}
