// ============================================
// UNIFIED CAMPAIGN SYSTEM TYPES
// ============================================

// Core Enums
export type CampaignType = 'SEARCH' | 'DISPLAY' | 'PMAX' | 'DEMAND_GEN' | 'VIDEO' | 'PERFORMANCE_MAX' | 'SHOPPING' | 'APP';
export type CampaignStatus = 'DRAFT' | 'PENDING' | 'ENABLED' | 'ACTIVE' | 'PAUSED' | 'REMOVED';
export type BiddingStrategy = 'MANUAL_CPC' | 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CLICKS' | 'TARGET_CPA' | 'TARGET_ROAS' | 'MAXIMIZE_CONVERSION_VALUE';
export type MatchType = 'BROAD' | 'PHRASE' | 'EXACT';
export type AssetType = 'IMAGE' | 'VIDEO' | 'LOGO' | 'HEADLINE' | 'DESCRIPTION' | 'LONG_HEADLINE' | 'BUSINESS_NAME' | 'CALL_TO_ACTION';
export type AspectRatio = '1:1' | '1.91:1' | '4:5' | '16:9' | '9:16';
export type PerformanceLabel = 'BEST' | 'GOOD' | 'LOW' | 'PENDING' | 'LEARNING';
export type AudienceType = 'CUSTOM' | 'IN_MARKET' | 'AFFINITY' | 'REMARKETING' | 'SIMILAR' | 'COMBINED';
export type TargetingMode = 'TARGETING' | 'OBSERVATION';

// ============================================
// AI Score Types (Existing - preserved)
// ============================================

export interface AIScoreFactor {
  name: string;
  score: number;
  weight: number;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export interface AIScoreBreakdown {
  totalScore: number;
  factors: AIScoreFactor[];
  topIssue?: string;
}

// ============================================
// Campaign Interface (Extended)
// ============================================

export interface Campaign {
  id: string;
  userId?: string;
  googleCampaignId?: string;

  // Basic Info
  name: string;
  type: CampaignType;
  status: CampaignStatus;

  // Targeting
  targetLocations?: string[];
  targetLanguages?: string[];

  // Budget & Bidding
  dailyBudget?: number;
  budget?: number; // Alias for backward compatibility
  biddingStrategy?: BiddingStrategy;
  targetCpa?: number;
  targetRoas?: number;

  // Scheduling
  startDate?: string;
  endDate?: string;
  adSchedule?: AdSchedule[];

  // Network Settings (Search-specific)
  includeSearchPartners?: boolean;
  includeDisplayNetwork?: boolean;

  // URLs
  finalUrl?: string;
  trackingTemplate?: string;

  // Performance Metrics (from API/reports)
  spend?: number;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
  roas?: number;

  // AI Features
  aiScore?: number;
  aiScoreBreakdown?: AIScoreBreakdown;
  aiRecommendation?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  syncedAt?: string;

  // Relations
  adGroups?: AdGroup[];
  assetGroups?: AssetGroup[];
  intelligenceProjectId?: string;
}

// ============================================
// Ad Schedule
// ============================================

export interface AdSchedule {
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startHour: number; // 0-23
  endHour: number;   // 0-23
  bidModifier?: number;
}

// ============================================
// Ad Group Interface (Extended)
// ============================================

export interface AdGroup {
  id: string;
  campaignId: string;
  googleAdGroupId?: string;

  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';

  // Bidding
  cpcBid?: number;

  // Targeting (Display/Video)
  targetingType?: 'KEYWORDS' | 'AUDIENCES' | 'PLACEMENTS' | 'TOPICS';

  // Performance Metrics
  impressions?: number;
  clicks?: number;
  conversions?: number;
  spend?: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;

  // Relations
  keywords?: Keyword[];
  ads?: Ad[];
  assets?: AssetLink[];

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// Asset Group (PMax, Demand Gen)
// ============================================

export interface AssetGroup {
  id: string;
  campaignId: string;
  googleAssetGroupId?: string;

  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  finalUrl: string;

  // Path fields for display URL
  path1?: string;
  path2?: string;

  // Relations
  assets?: AssetLink[];
  audienceSignals?: AudienceSignal[];

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// Asset Interface
// ============================================

export interface Asset {
  id: string;
  userId: string;
  googleAssetId?: string;

  type: AssetType;

  // Content
  content?: string;         // Text assets
  fileUrl?: string;         // Media assets
  fileName?: string;
  fileSize?: number;
  mimeType?: string;

  // Dimensions
  width?: number;
  height?: number;
  aspectRatio?: AspectRatio;
  durationSeconds?: number;

  // YouTube
  youtubeVideoId?: string;

  // Deduplication
  contentHash?: string;

  // Metadata
  createdAt?: string;
}

// ============================================
// Asset Link (Connect assets to ad groups/asset groups)
// ============================================

export interface AssetLink {
  id: string;
  assetId: string;
  asset?: Asset;

  // Polymorphic link
  adGroupId?: string;
  assetGroupId?: string;

  // Role/Position
  fieldType: AssetFieldType;
  position?: number;

  // Performance
  performanceLabel?: PerformanceLabel;

  // Metadata
  createdAt?: string;
}

export type AssetFieldType =
  | 'HEADLINE'
  | 'DESCRIPTION'
  | 'LONG_HEADLINE'
  | 'BUSINESS_NAME'
  | 'MARKETING_IMAGE'
  | 'SQUARE_MARKETING_IMAGE'
  | 'PORTRAIT_MARKETING_IMAGE'
  | 'LOGO'
  | 'LANDSCAPE_LOGO'
  | 'YOUTUBE_VIDEO'
  | 'CALL_TO_ACTION_SELECTION';

// ============================================
// Keyword Interface (Extended)
// ============================================

export interface Keyword {
  id: string;
  adGroupId: string;
  googleKeywordId?: string;

  keyword: string;
  text?: string; // Alias for backward compatibility
  matchType: MatchType;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';

  // Bidding
  cpcBid?: number;

  // Performance
  qualityScore?: number;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  spend?: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;

  // Metadata
  createdAt?: string;
}

// ============================================
// Negative Keyword
// ============================================

export interface NegativeKeyword {
  id: string;
  campaignId?: string;
  adGroupId?: string;

  keyword: string;
  matchType: MatchType;
  level: 'CAMPAIGN' | 'AD_GROUP';

  // Metadata
  createdAt?: string;
}

// ============================================
// Ad Interface (Existing - preserved)
// ============================================

export interface Ad {
  id: string;
  adGroupId: string;
  googleAdId?: string;

  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  type: 'RESPONSIVE_SEARCH_AD' | 'EXPANDED_TEXT_AD' | 'RESPONSIVE_DISPLAY_AD' | 'VIDEO_AD' | string;

  // RSA fields
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];

  // Performance
  clicks?: number;
  impressions?: number;
  ctr?: number;
  spend?: number;
  conversions?: number;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// Audience Types
// ============================================

export interface Audience {
  id: string;
  userId: string;
  googleAudienceId?: string;

  name: string;
  type: AudienceType;

  // For custom audiences
  definition?: {
    keywords?: string[];
    urls?: string[];
    apps?: string[];
    interests?: string[];
  };

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface AudienceSignal {
  id: string;
  assetGroupId?: string;

  type: 'CUSTOM_AUDIENCE' | 'SEARCH_THEMES' | 'AFFINITY' | 'IN_MARKET' | 'DETAILED_DEMOGRAPHICS';
  name: string;

  // For search themes
  searchThemes?: string[];

  // For audience IDs
  audienceIds?: string[];
}

export interface AudienceTargeting {
  id: string;
  campaignId?: string;
  adGroupId?: string;
  assetGroupId?: string;
  audienceId: string;
  audience?: Audience;

  targetingMode: TargetingMode;
  bidModifier?: number;

  // Metadata
  createdAt?: string;
}

// ============================================
// Campaign Performance
// ============================================

export interface CampaignPerformance {
  id: string;
  campaignId: string;
  date: string;

  // Core Metrics
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;

  // Calculated
  ctr: number;
  cpc: number;
  cpa?: number;
  roas?: number;

  // Video Metrics
  videoViews?: number;
  videoQuartile25?: number;
  videoQuartile50?: number;
  videoQuartile75?: number;
  videoQuartile100?: number;

  // Metadata
  syncedAt?: string;
}

// ============================================
// Campaign Creation Wizard Types
// ============================================

export interface CampaignWizardData {
  // Step 1: Campaign Settings
  campaignName: string;
  campaignType: CampaignType;
  dailyBudget: number;
  biddingStrategy: BiddingStrategy;
  targetCpa?: number;
  targetRoas?: number;
  targetLocations: string[];
  targetLanguages: string[];
  startDate?: string;
  endDate?: string;

  // Step 2: Ad Groups / Asset Groups
  adGroups?: AdGroupWizardData[];
  assetGroups?: AssetGroupWizardData[];

  // Step 3: Ads / Assets
  // (handled within adGroups/assetGroups)

  // Intelligence Link
  intelligenceProjectId?: string;
}

export interface AdGroupWizardData {
  id: string; // Temporary ID for wizard
  name: string;
  keywords: KeywordWizardData[];
  negativeKeywords: string[];
  ads: AdWizardData[];
  cpcBid?: number;
}

export interface AssetGroupWizardData {
  id: string; // Temporary ID for wizard
  name: string;
  finalUrl: string;
  path1?: string;
  path2?: string;
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
  businessName: string;
  callToAction?: string;
  images: AssetWizardData[];
  logos: AssetWizardData[];
  videos?: AssetWizardData[];
  audienceSignals?: AudienceSignalWizardData[];
}

export interface KeywordWizardData {
  keyword: string;
  matchType: MatchType;
}

export interface AdWizardData {
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  path1?: string;
  path2?: string;
}

export interface AssetWizardData {
  type: AssetType;
  file?: File;
  fileUrl?: string;
  content?: string;
  aspectRatio?: AspectRatio;
  youtubeVideoId?: string;
}

export interface AudienceSignalWizardData {
  type: 'SEARCH_THEMES' | 'CUSTOM_AUDIENCE' | 'INTERESTS';
  searchThemes?: string[];
  customAudienceId?: string;
  interests?: string[];
}

// ============================================
// API Response Types
// ============================================

export interface CampaignListResponse {
  campaigns: Campaign[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CampaignDetailResponse {
  campaign: Campaign;
  adGroups?: AdGroup[];
  assetGroups?: AssetGroup[];
  performance?: CampaignPerformance[];
}

export interface CreateCampaignRequest {
  data: CampaignWizardData;
  syncToGoogle?: boolean;
}

export interface CreateCampaignResponse {
  success: boolean;
  campaign?: Campaign;
  googleCampaignId?: string;
  errors?: string[];
}

// ============================================
// Asset Upload Types
// ============================================

export interface AssetUploadRequest {
  file?: File;
  type: AssetType;
  content?: string;
  youtubeVideoId?: string;
}

export interface AssetUploadResponse {
  success: boolean;
  asset?: Asset;
  error?: string;
}

export interface AssetValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

// ============================================
// Image Requirements by Platform
// ============================================

export const IMAGE_REQUIREMENTS = {
  DISPLAY: {
    MARKETING_IMAGE: { width: 1200, height: 628, aspectRatio: '1.91:1' as AspectRatio },
    SQUARE_MARKETING_IMAGE: { width: 1200, height: 1200, aspectRatio: '1:1' as AspectRatio },
    LOGO: { width: 1200, height: 1200, aspectRatio: '1:1' as AspectRatio },
    LANDSCAPE_LOGO: { width: 1200, height: 300, aspectRatio: '4:1' as AspectRatio },
  },
  PMAX: {
    MARKETING_IMAGE: { width: 1200, height: 628, aspectRatio: '1.91:1' as AspectRatio },
    SQUARE_MARKETING_IMAGE: { width: 1200, height: 1200, aspectRatio: '1:1' as AspectRatio },
    PORTRAIT_MARKETING_IMAGE: { width: 960, height: 1200, aspectRatio: '4:5' as AspectRatio },
    LOGO: { width: 1200, height: 1200, aspectRatio: '1:1' as AspectRatio },
    LANDSCAPE_LOGO: { width: 1200, height: 300, aspectRatio: '4:1' as AspectRatio },
  },
  DEMAND_GEN: {
    MARKETING_IMAGE: { width: 1200, height: 628, aspectRatio: '1.91:1' as AspectRatio },
    SQUARE_MARKETING_IMAGE: { width: 1200, height: 1200, aspectRatio: '1:1' as AspectRatio },
    PORTRAIT_MARKETING_IMAGE: { width: 960, height: 1200, aspectRatio: '4:5' as AspectRatio },
    LOGO: { width: 1200, height: 1200, aspectRatio: '1:1' as AspectRatio },
  },
  VIDEO: {
    COMPANION_BANNER: { width: 300, height: 60, aspectRatio: '5:1' as AspectRatio },
  },
} as const;

// ============================================
// Text Asset Limits
// ============================================

export const TEXT_LIMITS = {
  SEARCH: {
    HEADLINE: { min: 1, max: 30 },
    DESCRIPTION: { min: 1, max: 90 },
  },
  PMAX: {
    HEADLINE: { min: 1, max: 30, count: { min: 3, max: 15 } },
    LONG_HEADLINE: { min: 1, max: 90, count: { min: 1, max: 5 } },
    DESCRIPTION: { min: 1, max: 90, count: { min: 2, max: 5 } },
    BUSINESS_NAME: { min: 1, max: 25 },
  },
  DEMAND_GEN: {
    HEADLINE: { min: 1, max: 40, count: { min: 1, max: 5 } },
    DESCRIPTION: { min: 1, max: 90, count: { min: 1, max: 5 } },
  },
} as const;
