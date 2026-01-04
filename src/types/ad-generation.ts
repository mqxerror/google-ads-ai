// Types for enhanced ad generation (AdAlchemy-style)

export interface AdGenerationContext {
  companyName: string;
  productOffering: string;
  keyStatistics: string[];
  keyBenefits: string[];
  targetKeywords: string[];
  language: 'en' | 'es' | 'fr' | 'de' | 'pt';
  finalUrl?: string;
  pathField1?: string;
  pathField2?: string;
}

export interface AdCopyField {
  id: string;
  value: string;
  type: 'headline' | 'description';
  isPinned?: boolean;
}

export interface QualityRecommendation {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  priority: number; // 1=critical, 2=important, 3=nice-to-have
}

export interface QualityChecks {
  enoughHeadlines: boolean;
  enoughDescriptions: boolean;
  hasDKI: boolean;
  hasPowerWords: boolean;
  isTitleCase: boolean;
  noDuplicates: boolean;
  charCountsValid: boolean;
  hasInterestingChars: boolean;
  pathsUsed: boolean;
  noCopyIssues: boolean;
  noTruncatedText: boolean; // Check for text that appears cut off mid-word
}

export interface WriteForMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: {
    headlines: string[];
    descriptions: string[];
    paths: { path1: string; path2: string };
    context: AdGenerationContext;
  }) => void;
  initialContext?: Partial<AdGenerationContext>;
  initialHeadlines?: string[];
  initialDescriptions?: string[];
  initialPaths?: { path1: string; path2: string };
}

export interface GenerateAdsRequestContext {
  companyName: string;
  productOffering: string;
  keyStatistics: string[];
  keyBenefits: string[];
  targetKeywords: string[];
  language: string;
}

export interface GeneratedAdResponse {
  adGroupId: string;
  headlines: string[];
  descriptions: string[];
  suggestedPaths?: {
    path1: string;
    path2: string;
  };
}

// Constants
export const POWER_WORDS = [
  'Free',
  'Exclusive',
  'Limited',
  'Guaranteed',
  'Proven',
  'Save',
  'Now',
  'Today',
  'New',
  'Best',
  'Top',
  'Premium',
  'Fast',
  'Easy',
  'Instant',
  'Official',
  'Trusted',
  'Sale',
  'Discount',
  'Offer',
  'Deal',
  'Bonus',
  'Special',
  'Expert',
  'Professional',
];

export const HEADLINE_MAX_LENGTH = 30;
export const DESCRIPTION_MAX_LENGTH = 90;
export const PATH_MAX_LENGTH = 15;
export const RECOMMENDED_HEADLINES = 8;
export const MAX_HEADLINES = 15;
export const MIN_HEADLINES = 3;
export const RECOMMENDED_DESCRIPTIONS = 3;
export const MAX_DESCRIPTIONS = 4;
export const MIN_DESCRIPTIONS = 2;

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
] as const;
