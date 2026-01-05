/**
 * Shared Campaign Constants
 * Used across all campaign types: Search, PMax, Display, Demand Gen, Video
 */

import type { BiddingStrategy, CampaignType } from '@/types/campaign';

// ============================================================================
// BIDDING STRATEGIES
// ============================================================================

export interface BiddingStrategyInfo {
  label: string;
  description: string;
  requiresTarget?: 'cpa' | 'roas';
  recommendedFor?: CampaignType[];
}

export const BIDDING_STRATEGIES: Record<BiddingStrategy, BiddingStrategyInfo> = {
  MAXIMIZE_CONVERSIONS: {
    label: 'Maximize Conversions',
    description: 'Get the most conversions within your budget',
    recommendedFor: ['SEARCH', 'PMAX', 'DISPLAY', 'DEMAND_GEN'],
  },
  MAXIMIZE_CLICKS: {
    label: 'Maximize Clicks',
    description: 'Get the most clicks within your budget',
    recommendedFor: ['SEARCH', 'DISPLAY'],
  },
  TARGET_CPA: {
    label: 'Target CPA',
    description: 'Get conversions at your target cost per action',
    requiresTarget: 'cpa',
    recommendedFor: ['SEARCH', 'PMAX', 'DISPLAY'],
  },
  TARGET_ROAS: {
    label: 'Target ROAS',
    description: 'Get conversions at your target return on ad spend',
    requiresTarget: 'roas',
    recommendedFor: ['SEARCH', 'PMAX', 'SHOPPING'],
  },
  MAXIMIZE_CONVERSION_VALUE: {
    label: 'Maximize Conversion Value',
    description: 'Get the highest total conversion value',
    recommendedFor: ['PMAX', 'SHOPPING'],
  },
  MANUAL_CPC: {
    label: 'Manual CPC',
    description: 'Manually set bids for individual keywords',
    recommendedFor: ['SEARCH'],
  },
};

// Get strategies filtered by campaign type
export function getBiddingStrategiesForType(campaignType: CampaignType): BiddingStrategy[] {
  return (Object.entries(BIDDING_STRATEGIES) as [BiddingStrategy, BiddingStrategyInfo][])
    .filter(([, info]) => !info.recommendedFor || info.recommendedFor.includes(campaignType))
    .map(([key]) => key);
}

// ============================================================================
// LOCATIONS
// ============================================================================

export interface LocationInfo {
  code: string;
  label: string;
  country?: string;
  type?: 'country' | 'region' | 'city';
}

export const LOCATIONS: LocationInfo[] = [
  { code: '2840', label: 'United States', type: 'country' },
  { code: '2124', label: 'Canada', type: 'country' },
  { code: '2826', label: 'United Kingdom', type: 'country' },
  { code: '2036', label: 'Australia', type: 'country' },
  { code: '2276', label: 'Germany', type: 'country' },
  { code: '2250', label: 'France', type: 'country' },
  { code: '2724', label: 'Spain', type: 'country' },
  { code: '2380', label: 'Italy', type: 'country' },
  { code: '2528', label: 'Netherlands', type: 'country' },
  { code: '2620', label: 'Portugal', type: 'country' },
  { code: '2392', label: 'Japan', type: 'country' },
  { code: '2076', label: 'Brazil', type: 'country' },
  { code: '2484', label: 'Mexico', type: 'country' },
  { code: '2356', label: 'India', type: 'country' },
  { code: '21137', label: 'All Countries', type: 'region' },
];

// Common location presets for quick selection
export const LOCATION_PRESETS = {
  northAmerica: ['2840', '2124', '2484'],
  europe: ['2826', '2276', '2250', '2724', '2380', '2528', '2620'],
  englishSpeaking: ['2840', '2826', '2124', '2036'],
  worldwide: ['21137'],
};

// ============================================================================
// CAMPAIGN TYPES
// ============================================================================

export interface CampaignTypeInfo {
  icon: string;
  title: string;
  description: string;
  features: string[];
  hasKeywords?: boolean;
  hasAssetGroups?: boolean;
  hasVideo?: boolean;
}

export const CAMPAIGN_TYPES: Record<string, CampaignTypeInfo> = {
  SEARCH: {
    icon: '🔍',
    title: 'Search Campaign',
    description: 'Show text ads on Google Search results when people search for your products or services',
    features: ['Text ads', 'Keyword targeting', 'Search intent', 'Highest intent traffic'],
    hasKeywords: true,
  },
  PMAX: {
    icon: '🚀',
    title: 'Performance Max',
    description: 'AI-powered campaign that optimizes across all Google channels',
    features: ['All channels in one', 'AI optimization', 'Asset groups', 'Best for conversions'],
    hasAssetGroups: true,
  },
  DISPLAY: {
    icon: '🖼️',
    title: 'Display Campaign',
    description: 'Show image ads across millions of websites and apps',
    features: ['Image & responsive ads', 'Audience targeting', 'Brand awareness', 'Remarketing'],
    hasAssetGroups: true,
  },
  DEMAND_GEN: {
    icon: '✨',
    title: 'Demand Gen',
    description: 'Reach new customers on YouTube, Discover, and Gmail',
    features: ['YouTube Shorts', 'Discover feed', 'Gmail promotions', 'Visually rich ads'],
    hasAssetGroups: true,
  },
  VIDEO: {
    icon: '🎬',
    title: 'Video Campaign',
    description: 'Show video ads on YouTube and across the web',
    features: ['YouTube ads', 'In-stream ads', 'Discovery ads', 'Brand lift'],
    hasVideo: true,
  },
};

// ============================================================================
// CAMPAIGN GOALS
// ============================================================================

export interface CampaignGoalInfo {
  value: string;
  label: string;
  icon: string;
  description: string;
}

export const CAMPAIGN_GOALS: CampaignGoalInfo[] = [
  { value: 'AWARENESS', label: 'Brand Awareness', icon: '👁️', description: 'Increase visibility and reach' },
  { value: 'LEADS', label: 'Leads', icon: '📧', description: 'Get contact information' },
  { value: 'SALES', label: 'Sales', icon: '💳', description: 'Drive online purchases' },
  { value: 'TRAFFIC', label: 'Traffic', icon: '👥', description: 'Increase website visits' },
  { value: 'APP_INSTALLS', label: 'App Installs', icon: '📱', description: 'Drive app downloads' },
];

// ============================================================================
// LANGUAGES
// ============================================================================

export interface LanguageInfo {
  code: string;
  label: string;
  googleId: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English', googleId: '1000' },
  { code: 'es', label: 'Spanish', googleId: '1003' },
  { code: 'fr', label: 'French', googleId: '1002' },
  { code: 'de', label: 'German', googleId: '1001' },
  { code: 'pt', label: 'Portuguese', googleId: '1014' },
  { code: 'it', label: 'Italian', googleId: '1004' },
  { code: 'nl', label: 'Dutch', googleId: '1010' },
  { code: 'ja', label: 'Japanese', googleId: '1005' },
  { code: 'zh', label: 'Chinese', googleId: '1017' },
  { code: 'ko', label: 'Korean', googleId: '1012' },
  { code: 'ar', label: 'Arabic', googleId: '1019' },
];
