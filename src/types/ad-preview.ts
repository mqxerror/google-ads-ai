/**
 * Ad Preview Types
 * Shared types for the Ad Preview Center components
 */

export type CampaignType = 'SEARCH' | 'DISPLAY' | 'PMAX' | 'DEMAND_GEN' | 'VIDEO';

export type AspectRatio = '1:1' | '1.91:1' | '4:5' | '9:16' | '16:9' | '4:1';

export type AdFormat =
  | 'display-300x250'
  | 'display-728x90'
  | 'display-160x600'
  | 'display-320x50'
  | 'display-300x600'
  | 'youtube-instream'
  | 'youtube-discovery'
  | 'youtube-shorts'
  | 'gmail-feed'
  | 'discover-feed'
  | 'search-desktop'
  | 'search-mobile';

export interface FormatConfig {
  id: AdFormat;
  name: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  campaignTypes: CampaignType[];
  category: 'display' | 'youtube' | 'gmail' | 'discover' | 'search';
  icon: string;
}

export interface UploadedAsset {
  id: string;
  file?: File;
  previewUrl?: string;
  fileUrl?: string;
  type: 'image' | 'logo' | 'video';
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
  name?: string;
  /** ID of the source image this was cropped from (for variant tracking) */
  sourceId?: string;
  /** MIME type of the asset (e.g., 'image/jpeg', 'image/png') */
  mimeType?: string;
  /** Original file name */
  fileName?: string;
  /** YouTube video ID for video assets */
  youtubeVideoId?: string;
}

export interface CroppedVersion {
  ratio: AspectRatio;
  cropArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  previewUrl: string;
  status: 'pending' | 'saved';
}

export interface AssetCoverage {
  ratio: AspectRatio;
  required: boolean;
  recommended: boolean;
  count: number;
  status: 'covered' | 'missing' | 'partial';
}

export interface PreviewData {
  headlines: string[];
  descriptions: string[];
  images: UploadedAsset[];
  logos: UploadedAsset[];
  videos?: UploadedAsset[];
  businessName?: string;
  finalUrl?: string;
  displayPath1?: string;
  displayPath2?: string;
  callToAction?: string;
}
