/**
 * Google Ads API - Visual Campaign Operations
 * Handles PMax, Display, and Demand Gen campaign creation/sync
 */

import { createGoogleAdsClient, getCustomer, executeRestMutate } from './google-ads';
import sharp from 'sharp';

// =====================================================
// Constants
// =====================================================

// Language code to Google Ads languageConstants ID mapping
const LANGUAGE_MAPPING: Record<string, string> = {
  en: '1000', // English
  es: '1003', // Spanish
  fr: '1002', // French
  de: '1001', // German
  pt: '1014', // Portuguese
  it: '1004', // Italian
  nl: '1010', // Dutch
  ja: '1005', // Japanese
  ko: '1012', // Korean
  zh: '1017', // Chinese (Simplified)
  ar: '1019', // Arabic
  ru: '1031', // Russian
};

// Default location (US) if none specified
const DEFAULT_LOCATION = '2840'; // United States

// AssetFieldType enum values for PMax
const ASSET_FIELD_TYPE = {
  HEADLINE: 2,
  DESCRIPTION: 3,
  LONG_HEADLINE: 23,
  BUSINESS_NAME: 24,
  MARKETING_IMAGE: 5,
  SQUARE_MARKETING_IMAGE: 20,
  PORTRAIT_MARKETING_IMAGE: 19,
  LOGO: 6,
  YOUTUBE_VIDEO: 15,
};

// AssetType enum values
const ASSET_TYPE = {
  IMAGE: 4,
  YOUTUBE_VIDEO: 5,
  TEXT: 1,
};

// MimeType enum values for Google Ads
const MIME_TYPE = {
  IMAGE_JPEG: 1,
  IMAGE_PNG: 2,
  IMAGE_GIF: 3,
  IMAGE_WEBP: 10,
};

// =====================================================
// Image Upload Helpers
// =====================================================

// Google Ads image requirements
const IMAGE_REQUIREMENTS = {
  MARKETING_IMAGE: {
    aspectRatio: 1.91,      // 1.91:1 landscape
    minWidth: 600,
    minHeight: 314,
    recommendedWidth: 1200,
    recommendedHeight: 628,
    maxFileSize: 5 * 1024 * 1024, // 5MB
  },
  SQUARE_MARKETING_IMAGE: {
    aspectRatio: 1.0,       // 1:1 square
    minWidth: 300,
    minHeight: 300,
    recommendedWidth: 1200,
    recommendedHeight: 1200,
    maxFileSize: 5 * 1024 * 1024,
  },
  LOGO: {
    aspectRatio: 1.0,       // 1:1 square
    minWidth: 128,
    minHeight: 128,
    recommendedWidth: 1200,
    recommendedHeight: 1200,
    maxFileSize: 5 * 1024 * 1024,
  },
};

/**
 * Process an image with Sharp to meet Google Ads requirements:
 * - Resize/crop to correct aspect ratio
 * - Compress to stay under 5MB
 * - Convert to JPEG for best compatibility
 */
async function processImageForGoogleAds(
  imageBuffer: Buffer,
  targetType: 'MARKETING_IMAGE' | 'SQUARE_MARKETING_IMAGE' | 'LOGO'
): Promise<{ data: string; mimeType: number; size: number } | null> {
  try {
    const requirements = IMAGE_REQUIREMENTS[targetType];
    const targetAspectRatio = requirements.aspectRatio;

    // Get original image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    if (originalWidth === 0 || originalHeight === 0) {
      console.error('[Image Process] Could not read image dimensions');
      return null;
    }

    const originalAspectRatio = originalWidth / originalHeight;
    console.log(`[Image Process] Original: ${originalWidth}x${originalHeight} (AR: ${originalAspectRatio.toFixed(2)})`);
    console.log(`[Image Process] Target: ${targetType} (AR: ${targetAspectRatio.toFixed(2)})`);

    // Calculate crop dimensions to achieve target aspect ratio
    let cropWidth = originalWidth;
    let cropHeight = originalHeight;

    if (Math.abs(originalAspectRatio - targetAspectRatio) > 0.01) {
      // Need to crop to correct aspect ratio
      if (originalAspectRatio > targetAspectRatio) {
        // Image is too wide - crop width
        cropWidth = Math.round(originalHeight * targetAspectRatio);
      } else {
        // Image is too tall - crop height
        cropHeight = Math.round(originalWidth / targetAspectRatio);
      }
      console.log(`[Image Process] Cropping to: ${cropWidth}x${cropHeight}`);
    }

    // Calculate final resize dimensions
    let finalWidth = requirements.recommendedWidth;
    let finalHeight = requirements.recommendedHeight;

    // Don't upscale small images beyond reasonable limits
    if (cropWidth < requirements.recommendedWidth) {
      finalWidth = Math.max(cropWidth, requirements.minWidth);
      finalHeight = Math.round(finalWidth / targetAspectRatio);
    }

    console.log(`[Image Process] Final resize to: ${finalWidth}x${finalHeight}`);

    // Process image with Sharp
    let processedBuffer: Buffer;
    let quality = 85;

    // Try compression levels until we're under 5MB
    do {
      const pipeline = sharp(imageBuffer)
        .extract({
          left: Math.round((originalWidth - cropWidth) / 2),
          top: Math.round((originalHeight - cropHeight) / 2),
          width: cropWidth,
          height: cropHeight,
        })
        .resize(finalWidth, finalHeight, {
          fit: 'fill',
          withoutEnlargement: false, // Allow upscaling if needed
        })
        .jpeg({
          quality,
          mozjpeg: true, // Better compression
        });

      processedBuffer = await pipeline.toBuffer();

      if (processedBuffer.length > requirements.maxFileSize) {
        quality -= 10;
        console.log(`[Image Process] Image still too large (${(processedBuffer.length / 1024 / 1024).toFixed(2)}MB), reducing quality to ${quality}`);
      }
    } while (processedBuffer.length > requirements.maxFileSize && quality > 20);

    if (processedBuffer.length > requirements.maxFileSize) {
      console.error(`[Image Process] Could not compress image below 5MB even at quality ${quality}`);
      return null;
    }

    const base64 = processedBuffer.toString('base64');
    console.log(`[Image Process] SUCCESS: ${finalWidth}x${finalHeight}, ${(processedBuffer.length / 1024).toFixed(1)}KB, quality ${quality}`);

    return {
      data: base64,
      mimeType: MIME_TYPE.IMAGE_JPEG,
      size: processedBuffer.length,
    };
  } catch (error) {
    console.error('[Image Process] Error processing image:', error);
    return null;
  }
}

/**
 * Fetch an image from URL and process it for Google Ads
 * Works with both local (/uploads/...) and remote URLs
 */
async function fetchImageAsBase64(
  imageUrl: string,
  targetType: 'MARKETING_IMAGE' | 'SQUARE_MARKETING_IMAGE' | 'LOGO' = 'MARKETING_IMAGE'
): Promise<{
  data: string;
  mimeType: number;
  size: number;
} | null> {
  try {
    // Handle relative URLs by prepending the app URL
    let fullUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      fullUrl = `${appUrl}${imageUrl}`;
    }

    console.log(`[Image Upload] Fetching image from: ${fullUrl}`);

    const response = await fetch(fullUrl);
    if (!response.ok) {
      console.error(`[Image Upload] Failed to fetch image: ${response.status} ${response.statusText}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    console.log(`[Image Upload] Fetched ${imageBuffer.length} bytes, processing for ${targetType}...`);

    // Process the image with Sharp to fix aspect ratio and compression
    const processed = await processImageForGoogleAds(imageBuffer, targetType);

    if (!processed) {
      console.error(`[Image Upload] Failed to process image for ${targetType}`);
      return null;
    }

    return processed;
  } catch (error) {
    console.error(`[Image Upload] Error fetching image from ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Upload an image asset to Google Ads
 * Returns the resource name of the created asset
 */
async function uploadImageAsset(
  customer: any,
  imageUrl: string,
  imageName: string,
  width?: number,
  height?: number
): Promise<string | null> {
  try {
    const imageData = await fetchImageAsBase64(imageUrl);
    if (!imageData) {
      console.error(`[Image Upload] Could not fetch image data for: ${imageUrl}`);
      return null;
    }

    console.log(`[Image Upload] Uploading image asset: ${imageName}`);

    const assetPayload: any = {
      name: imageName.substring(0, 100), // Max 100 chars for asset name
      type: ASSET_TYPE.IMAGE,
      image_asset: {
        data: imageData.data,
        file_size: imageData.size,
        mime_type: imageData.mimeType,
      },
    };

    // Add dimensions if provided
    if (width && height) {
      assetPayload.image_asset.full_size = {
        height_pixels: height,
        width_pixels: width,
      };
    }

    const assetResult = await customer.assets.create([assetPayload] as any);
    const resourceName = assetResult.results[0]?.resource_name;

    if (resourceName) {
      console.log(`[Image Upload] Successfully created image asset: ${resourceName}`);
      return resourceName;
    } else {
      console.error(`[Image Upload] No resource name returned for asset`);
      return null;
    }
  } catch (error) {
    console.error(`[Image Upload] Error uploading image asset:`, error);
    return null;
  }
}

// =====================================================
// Types
// =====================================================

export interface AssetInput {
  type: 'TEXT' | 'IMAGE' | 'YOUTUBE_VIDEO' | 'MEDIA_BUNDLE';
  name?: string;
  textAssetText?: string;
  imageUrl?: string;
  youtubeVideoId?: string;
}

export interface AssetGroupInput {
  name: string;
  finalUrl: string;
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
  businessName: string;
  callToAction?: string;
  images: { url: string; aspectRatio?: string }[];
  logos: { url: string }[];
  videos?: { youtubeVideoId: string }[];
  path1?: string;
  path2?: string;
}

export interface PMaxCampaignInput {
  name: string;
  dailyBudget: number;
  biddingStrategy: 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CONVERSION_VALUE' | 'TARGET_CPA' | 'TARGET_ROAS';
  targetCpa?: number;
  targetRoas?: number;
  finalUrl: string;
  assetGroups: AssetGroupInput[];
  // Targeting
  targetLocations?: string[]; // Geo target constants (e.g., "2840" for US)
  targetLanguages?: string[]; // Language codes (e.g., "en", "es")
  // Audience signals
  audienceSignals?: {
    customSegments?: string[];
    interestCategories?: string[];
    demographics?: {
      ageRanges?: string[];
      genders?: string[];
    };
  };
}

export interface DisplayCampaignInput {
  name: string;
  dailyBudget: number;
  biddingStrategy: 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CLICKS' | 'TARGET_CPA';
  targetCpa?: number;
  finalUrl: string;
  headlines: string[];
  longHeadline: string;
  descriptions: string[];
  businessName: string;
  images: { url: string; aspectRatio?: string }[];
  logos: { url: string }[];
  targetLocations?: string[];
  targetLanguages?: string[];
}

export interface DemandGenCampaignInput {
  name: string;
  dailyBudget: number;
  biddingStrategy: 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CONVERSION_VALUE' | 'TARGET_CPA';
  targetCpa?: number;
  finalUrl: string;
  assetGroups: AssetGroupInput[];
  targetLocations?: string[];
  targetLanguages?: string[];
}

interface CampaignResult {
  success: boolean;
  campaignId?: string;
  assetGroupIds?: string[];
  error?: string;
  details?: string;
  googleAdsError?: string;
}

// =====================================================
// Performance Max Campaign
// =====================================================

/**
 * Create a Performance Max campaign with asset groups
 */
export async function createPMaxCampaign(
  refreshToken: string,
  customerId: string,
  input: PMaxCampaignInput,
  loginCustomerId?: string
): Promise<CampaignResult> {
  const client = createGoogleAdsClient();
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    console.log('[PMax] Creating Performance Max campaign:', input.name);
    console.log('[PMax] Input:', JSON.stringify({
      ...input,
      assetGroups: input.assetGroups.map(ag => ({
        name: ag.name,
        headlines: ag.headlines.length,
        descriptions: ag.descriptions.length,
        longHeadlines: ag.longHeadlines.length,
        businessName: ag.businessName,
      }))
    }, null, 2));

    // Step 1: Create Budget
    const budgetAmountMicros = input.dailyBudget * 1_000_000;
    const timestamp = Date.now();

    const budgetResult = await customer.campaignBudgets.create([{
      name: `Budget for ${input.name} ${timestamp}`,
      amount_micros: budgetAmountMicros,
      delivery_method: 2, // STANDARD
      explicitly_shared: false,
    }] as any);

    const budgetResourceName = budgetResult.results[0]?.resource_name;
    if (!budgetResourceName) {
      return { success: false, error: 'Failed to create budget' };
    }
    console.log('[PMax] Budget created:', budgetResourceName);

    // Step 2: Create Campaign
    // Note: For PMax, advertising_channel_type = 10 (PERFORMANCE_MAX)
    const campaignPayload: any = {
      name: `${input.name} ${timestamp}`,
      advertising_channel_type: 10, // PERFORMANCE_MAX
      status: 2, // ENABLED (live - user requested to put campaigns live)
      campaign_budget: budgetResourceName,
      contains_eu_political_advertising: 3, // DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING (required)
      brand_guidelines_enabled: false, // Disable to avoid requiring brand assets at campaign creation
      url_expansion_opt_out: false,
      // Bidding strategy
      ...(input.biddingStrategy === 'MAXIMIZE_CONVERSIONS' && {
        maximize_conversions: {},
      }),
      ...(input.biddingStrategy === 'MAXIMIZE_CONVERSION_VALUE' && {
        maximize_conversion_value: {},
      }),
      ...(input.biddingStrategy === 'TARGET_CPA' && input.targetCpa && {
        target_cpa: {
          target_cpa_micros: input.targetCpa * 1_000_000,
        },
      }),
      ...(input.biddingStrategy === 'TARGET_ROAS' && input.targetRoas && {
        target_roas: {
          target_roas: input.targetRoas,
        },
      }),
    };

    console.log('[PMax] Campaign payload:', JSON.stringify(campaignPayload, null, 2));

    const campaignResult = await customer.campaigns.create([campaignPayload] as any);
    const campaignResourceName = campaignResult.results[0]?.resource_name;
    if (!campaignResourceName) {
      return { success: false, error: 'Failed to create campaign' };
    }
    const campaignId = campaignResourceName.split('/').pop()!;
    console.log('[PMax] Campaign created:', campaignId);

    // Step 3: Add Location Targeting
    const targetLocations = input.targetLocations?.length ? input.targetLocations : [DEFAULT_LOCATION];
    console.log('[PMax] Adding location targeting:', targetLocations);

    try {
      const locationCriteria = targetLocations.map(loc => ({
        campaign: campaignResourceName,
        location: {
          geo_target_constant: `geoTargetConstants/${loc}`,
        },
      }));
      await customer.campaignCriteria.create(locationCriteria as any);
      console.log('[PMax] Location targeting added');
    } catch (error) {
      console.error('[PMax] Error adding location targeting (non-fatal):', error);
    }

    // Step 4: Add Language Targeting
    const targetLanguages = input.targetLanguages?.length ? input.targetLanguages : ['en'];
    console.log('[PMax] Adding language targeting:', targetLanguages);

    try {
      const languageCriteria = targetLanguages.map(lang => {
        const langId = LANGUAGE_MAPPING[lang] || LANGUAGE_MAPPING['en'];
        return {
          campaign: campaignResourceName,
          language: {
            language_constant: `languageConstants/${langId}`,
          },
        };
      });
      await customer.campaignCriteria.create(languageCriteria as any);
      console.log('[PMax] Language targeting added');
    } catch (error) {
      console.error('[PMax] Error adding language targeting (non-fatal):', error);
    }

    // Step 5: Create Asset Groups with Assets using ATOMIC mutate
    // All assets, asset group, and asset links must be created in ONE operation
    const assetGroupIds: string[] = [];

    for (let i = 0; i < input.assetGroups.length; i++) {
      const assetGroup = input.assetGroups[i];
      console.log(`[PMax] Creating asset group ${i + 1}/${input.assetGroups.length}: ${assetGroup.name}`);

      try {
        // Validate minimum requirements
        const headlinesToCreate = assetGroup.headlines.slice(0, 15);
        if (headlinesToCreate.length < 3) {
          console.error(`[PMax] Asset group ${assetGroup.name} needs at least 3 headlines (has ${headlinesToCreate.length})`);
          continue;
        }

        const descriptionsToCreate = assetGroup.descriptions.slice(0, 5);
        if (descriptionsToCreate.length < 2) {
          console.error(`[PMax] Asset group ${assetGroup.name} needs at least 2 descriptions (has ${descriptionsToCreate.length})`);
          continue;
        }

        // Build ALL operations for atomic mutate
        const operations: any[] = [];
        let tempId = -1; // Start with -1 for asset group

        // Temp ID assignments
        const assetGroupTempId = tempId--;
        const assetGroupResourceName = `customers/${customerId}/assetGroups/${assetGroupTempId}`;

        // Track assets with their temp IDs for linking
        const assetsToLink: { tempId: number; fieldType: number }[] = [];

        // Build REST API format operations (camelCase, proper structure)
        // 1. Create headline asset operations
        for (const headline of headlinesToCreate) {
          const assetTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${assetTempId}`,
                name: `Headline: ${headline.substring(0, 50)}`,
                textAsset: { text: headline.substring(0, 30) },
              },
            },
          });
          assetsToLink.push({ tempId: assetTempId, fieldType: ASSET_FIELD_TYPE.HEADLINE });
        }

        // 2. Create description asset operations
        for (const desc of descriptionsToCreate) {
          const assetTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${assetTempId}`,
                name: `Description: ${desc.substring(0, 50)}`,
                textAsset: { text: desc.substring(0, 90) },
              },
            },
          });
          assetsToLink.push({ tempId: assetTempId, fieldType: ASSET_FIELD_TYPE.DESCRIPTION });
        }

        // 3. Create long headline asset operation
        const longHeadline = assetGroup.longHeadlines[0] || assetGroup.headlines[0] || 'Discover Our Products';
        const longHeadlineTempId = tempId--;
        operations.push({
          assetOperation: {
            create: {
              resourceName: `customers/${customerId}/assets/${longHeadlineTempId}`,
              name: `Long Headline`,
              textAsset: { text: longHeadline.substring(0, 90) },
            },
          },
        });
        assetsToLink.push({ tempId: longHeadlineTempId, fieldType: ASSET_FIELD_TYPE.LONG_HEADLINE });

        // 4. Create business name asset operation
        const businessName = assetGroup.businessName || input.name;
        const businessNameTempId = tempId--;
        operations.push({
          assetOperation: {
            create: {
              resourceName: `customers/${customerId}/assets/${businessNameTempId}`,
              name: `Business Name`,
              textAsset: { text: businessName.substring(0, 25) },
            },
          },
        });
        assetsToLink.push({ tempId: businessNameTempId, fieldType: ASSET_FIELD_TYPE.BUSINESS_NAME });

        // 5. Fetch and create image asset operations
        // Separate images by type to ensure we have both marketing (1.91:1) and square (1:1)
        console.log(`[PMax] Preparing image assets for ${assetGroup.name}...`);
        let marketingCount = 0;
        let squareCount = 0;

        // First pass: categorize images and track which ones we have
        const marketingImages: typeof assetGroup.images = [];
        const squareImages: typeof assetGroup.images = [];

        for (const img of assetGroup.images) {
          const isSquare = (img as any).fieldType === 'SQUARE_MARKETING_IMAGE' || img.aspectRatio === '1:1';
          if (isSquare) {
            squareImages.push(img);
          } else {
            marketingImages.push(img);
          }
        }

        console.log(`[PMax] Found ${marketingImages.length} marketing images, ${squareImages.length} square images in input`);

        // If we don't have both types, use any image and convert to correct aspect ratio
        const needMarketing = marketingImages.length === 0 && assetGroup.images.length > 0;
        const needSquare = squareImages.length === 0 && assetGroup.images.length > 0;

        if (needMarketing && assetGroup.images.length > 0) {
          console.log(`[PMax] No marketing images found, will convert first available image`);
          marketingImages.push(assetGroup.images[0]);
        }
        if (needSquare && assetGroup.images.length > 0) {
          console.log(`[PMax] No square images found, will convert first available image`);
          squareImages.push(assetGroup.images[0]);
        }

        // Process marketing images (will be cropped/resized to 1.91:1)
        for (const img of marketingImages.slice(0, 10)) { // Max 10 marketing images
          const imgUrl = img.url;
          if (!imgUrl) continue;

          const imageData = await fetchImageAsBase64(imgUrl, 'MARKETING_IMAGE');
          if (!imageData) continue;

          const imageTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${imageTempId}`,
                name: `Marketing Image ${marketingCount + 1}`,
                type: 'IMAGE',
                imageAsset: {
                  data: imageData.data,
                },
              },
            },
          });
          assetsToLink.push({ tempId: imageTempId, fieldType: ASSET_FIELD_TYPE.MARKETING_IMAGE });
          marketingCount++;
        }

        // Process square images (will be cropped/resized to 1:1)
        for (const img of squareImages.slice(0, 10)) { // Max 10 square images
          const imgUrl = img.url;
          if (!imgUrl) continue;

          const imageData = await fetchImageAsBase64(imgUrl, 'SQUARE_MARKETING_IMAGE');
          if (!imageData) continue;

          const imageTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${imageTempId}`,
                name: `Square Image ${squareCount + 1}`,
                type: 'IMAGE',
                imageAsset: {
                  data: imageData.data,
                },
              },
            },
          });
          assetsToLink.push({ tempId: imageTempId, fieldType: ASSET_FIELD_TYPE.SQUARE_MARKETING_IMAGE });
          squareCount++;
        }

        console.log(`[PMax] Processed ${marketingCount} marketing images, ${squareCount} square images`);

        // 6. Fetch and create logo asset operations (will be cropped/resized to 1:1)
        for (let logoIdx = 0; logoIdx < Math.min(assetGroup.logos.length, 5); logoIdx++) {
          const logo = assetGroup.logos[logoIdx];
          const logoUrl = logo.url;
          if (!logoUrl) continue;

          const imageData = await fetchImageAsBase64(logoUrl, 'LOGO');
          if (!imageData) continue;

          const logoTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${logoTempId}`,
                name: `Logo ${logoIdx + 1}`,
                type: 'IMAGE',
                imageAsset: {
                  data: imageData.data,
                },
              },
            },
          });
          assetsToLink.push({ tempId: logoTempId, fieldType: ASSET_FIELD_TYPE.LOGO });
        }
        const logoCount = assetsToLink.filter(a => a.fieldType === ASSET_FIELD_TYPE.LOGO).length;
        console.log(`[PMax] Processed ${logoCount} logos`);

        // Validate minimum image requirements
        if (marketingCount === 0 && squareCount === 0) {
          console.error(`[PMax] No valid marketing images for ${assetGroup.name}`);
          continue;
        }
        if (logoCount === 0) {
          console.error(`[PMax] No valid logos for ${assetGroup.name}`);
          continue;
        }

        // 7. Create asset group operation
        operations.push({
          assetGroupOperation: {
            create: {
              resourceName: assetGroupResourceName,
              campaign: campaignResourceName,
              name: `${assetGroup.name} ${timestamp}`,
              finalUrls: [assetGroup.finalUrl || input.finalUrl],
              status: 'ENABLED',
              ...(assetGroup.path1 && { path1: assetGroup.path1 }),
              ...(assetGroup.path2 && { path2: assetGroup.path2 }),
            },
          },
        });

        // 8. Create asset group asset link operations
        // Map field type numbers to strings for REST API
        const fieldTypeNames: Record<number, string> = {
          [ASSET_FIELD_TYPE.HEADLINE]: 'HEADLINE',
          [ASSET_FIELD_TYPE.DESCRIPTION]: 'DESCRIPTION',
          [ASSET_FIELD_TYPE.LONG_HEADLINE]: 'LONG_HEADLINE',
          [ASSET_FIELD_TYPE.BUSINESS_NAME]: 'BUSINESS_NAME',
          [ASSET_FIELD_TYPE.MARKETING_IMAGE]: 'MARKETING_IMAGE',
          [ASSET_FIELD_TYPE.SQUARE_MARKETING_IMAGE]: 'SQUARE_MARKETING_IMAGE',
          [ASSET_FIELD_TYPE.LOGO]: 'LOGO',
        };

        for (const asset of assetsToLink) {
          operations.push({
            assetGroupAssetOperation: {
              create: {
                assetGroup: assetGroupResourceName,
                asset: `customers/${customerId}/assets/${asset.tempId}`,
                fieldType: fieldTypeNames[asset.fieldType] || 'UNSPECIFIED',
              },
            },
          });
        }

        // Log summary
        const assetBreakdown = assetsToLink.reduce((acc, a) => {
          const key = Object.entries(ASSET_FIELD_TYPE).find(([_, v]) => v === a.fieldType)?.[0] || String(a.fieldType);
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`[PMax] Asset breakdown:`, JSON.stringify(assetBreakdown));
        console.log(`[PMax] Executing REST API atomic mutate with ${operations.length} operations...`);

        // Execute atomic mutate via REST API (bypasses library issues)
        const mutateResult = await executeRestMutate(
          refreshToken,
          customerId,
          operations,
          loginCustomerId
        );

        // Find the asset group result
        const assetGroupResultEntry = mutateResult.mutateOperationResponses?.find(
          (r: any) => r.assetGroupResult?.resourceName
        );

        if (assetGroupResultEntry?.assetGroupResult?.resourceName) {
          const assetGroupId = assetGroupResultEntry.assetGroupResult.resourceName.split('/').pop()!;
          assetGroupIds.push(assetGroupId);
          console.log(`[PMax] SUCCESS! Asset group created: ${assetGroupId} with ${assetsToLink.length} assets`);
        } else {
          console.error(`[PMax] Mutate succeeded but no asset group ID found`);
          console.log(`[PMax] Mutate result:`, JSON.stringify(mutateResult, null, 2).substring(0, 1000));
        }

      } catch (error: any) {
        console.error(`[PMax] Error creating asset group ${assetGroup.name}:`, error.message || error);
        // Log first few error details if available
        if (error.errors) {
          error.errors.slice(0, 3).forEach((e: any, idx: number) => {
            console.error(`[PMax] Error ${idx + 1}: ${e.message}`);
          });
        }
      }
    }

    // Step 6: Check if asset groups were created successfully
    if (assetGroupIds.length > 0) {
      console.log(`[PMax] Campaign created with ${assetGroupIds.length} asset group(s)`);
      return {
        success: true,
        campaignId,
        assetGroupIds,
        details: `Campaign is LIVE with ${assetGroupIds.length} asset group(s) and all assets linked.`,
      };
    } else {
      // No asset groups created - this is a failure for PMax
      console.error('[PMax] FAILED: No asset groups were created - campaign is incomplete');
      return {
        success: false,
        campaignId, // Still return the campaign ID so user knows it exists
        error: 'Campaign created but no asset groups could be attached. PMax requires at least 3 headlines, 2 descriptions, 1 long headline, 1 business name, 1 marketing image, and 1 logo.',
        details: 'Please check that your campaign has all required assets and try again.',
      };
    }

  } catch (error: any) {
    console.error('[PMax] Error creating campaign:', error);

    const errorDetails = JSON.stringify(error, null, 2);
    console.error('[PMax] Full error details:', errorDetails);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create PMax campaign',
      details: errorDetails,
      googleAdsError: errorDetails,
    };
  }
}

// =====================================================
// Display Campaign
// =====================================================

/**
 * Create a Display campaign with responsive display ads
 */
export async function createDisplayCampaign(
  refreshToken: string,
  customerId: string,
  input: DisplayCampaignInput,
  loginCustomerId?: string
): Promise<CampaignResult> {
  const client = createGoogleAdsClient();
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    console.log('[Display] Creating Display campaign:', input.name);
    const timestamp = Date.now();

    // Step 1: Create Budget
    const budgetAmountMicros = input.dailyBudget * 1_000_000;

    const budgetResult = await customer.campaignBudgets.create([{
      name: `Budget for ${input.name} ${timestamp}`,
      amount_micros: budgetAmountMicros,
      delivery_method: 2,
      explicitly_shared: false,
    }] as any);

    const budgetResourceName = budgetResult.results[0]?.resource_name;
    if (!budgetResourceName) {
      return { success: false, error: 'Failed to create budget' };
    }
    console.log('[Display] Budget created:', budgetResourceName);

    // Step 2: Create Campaign
    const campaignPayload: any = {
      name: `${input.name} ${timestamp}`,
      advertising_channel_type: 3, // DISPLAY
      status: 2, // ENABLED
      campaign_budget: budgetResourceName,
      network_settings: {
        target_google_search: false,
        target_search_network: false,
        target_content_network: true,
        target_partner_search_network: false,
      },
      ...(input.biddingStrategy === 'MAXIMIZE_CONVERSIONS' && {
        maximize_conversions: {},
      }),
      ...(input.biddingStrategy === 'MAXIMIZE_CLICKS' && {
        maximize_clicks: {},
      }),
      ...(input.biddingStrategy === 'TARGET_CPA' && input.targetCpa && {
        target_cpa: {
          target_cpa_micros: input.targetCpa * 1_000_000,
        },
      }),
    };

    const campaignResult = await customer.campaigns.create([campaignPayload] as any);
    const campaignResourceName = campaignResult.results[0]?.resource_name;
    if (!campaignResourceName) {
      return { success: false, error: 'Failed to create campaign' };
    }
    const campaignId = campaignResourceName.split('/').pop()!;
    console.log('[Display] Campaign created:', campaignId);

    // Step 3: Create Ad Group
    const adGroupPayload: any = {
      campaign: campaignResourceName,
      name: `${input.name} Ad Group ${timestamp}`,
      type: 10, // DISPLAY_STANDARD
      status: 2, // ENABLED
      cpc_bid_micros: 1_000_000,
    };

    const adGroupResult = await customer.adGroups.create([adGroupPayload] as any);
    const adGroupResourceName = adGroupResult.results[0]?.resource_name;
    if (!adGroupResourceName) {
      return { success: false, error: 'Failed to create ad group' };
    }
    console.log('[Display] Ad group created');

    // Step 4: Upload image assets and create Responsive Display Ad
    console.log('[Display] Preparing assets for Responsive Display Ad...');

    const operations: any[] = [];
    let tempId = -1;

    // Track asset resource names
    const headlineAssets: string[] = [];
    const descriptionAssets: string[] = [];
    const marketingImageAssets: string[] = [];
    const squareImageAssets: string[] = [];
    const logoAssets: string[] = [];

    // Create headline assets (need at least 1, max 5)
    const headlinesToCreate = input.headlines.slice(0, 5);
    for (const headline of headlinesToCreate) {
      const assetTempId = tempId--;
      operations.push({
        assetOperation: {
          create: {
            resourceName: `customers/${customerId}/assets/${assetTempId}`,
            name: `Headline: ${headline.substring(0, 50)}`,
            textAsset: { text: headline.substring(0, 30) },
          },
        },
      });
      headlineAssets.push(`customers/${customerId}/assets/${assetTempId}`);
    }

    // Create long headline asset
    const longHeadlineTempId = tempId--;
    const longHeadline = input.longHeadline || input.headlines[0] || 'Discover More';
    operations.push({
      assetOperation: {
        create: {
          resourceName: `customers/${customerId}/assets/${longHeadlineTempId}`,
          name: `Long Headline`,
          textAsset: { text: longHeadline.substring(0, 90) },
        },
      },
    });
    const longHeadlineAsset = `customers/${customerId}/assets/${longHeadlineTempId}`;

    // Create description assets (need at least 1, max 5)
    const descriptionsToCreate = input.descriptions.slice(0, 5);
    for (const desc of descriptionsToCreate) {
      const assetTempId = tempId--;
      operations.push({
        assetOperation: {
          create: {
            resourceName: `customers/${customerId}/assets/${assetTempId}`,
            name: `Description: ${desc.substring(0, 50)}`,
            textAsset: { text: desc.substring(0, 90) },
          },
        },
      });
      descriptionAssets.push(`customers/${customerId}/assets/${assetTempId}`);
    }

    // Create business name asset
    const businessNameTempId = tempId--;
    operations.push({
      assetOperation: {
        create: {
          resourceName: `customers/${customerId}/assets/${businessNameTempId}`,
          name: `Business Name`,
          textAsset: { text: (input.businessName || input.name).substring(0, 25) },
        },
      },
    });
    const businessNameAsset = `customers/${customerId}/assets/${businessNameTempId}`;

    // Process marketing images (1.91:1)
    let hasMarketingImage = false;
    for (const img of input.images.slice(0, 5)) {
      if (!img.url) continue;
      const imageData = await fetchImageAsBase64(img.url, 'MARKETING_IMAGE');
      if (!imageData) continue;

      const imageTempId = tempId--;
      operations.push({
        assetOperation: {
          create: {
            resourceName: `customers/${customerId}/assets/${imageTempId}`,
            name: `Marketing Image`,
            type: 'IMAGE',
            imageAsset: { data: imageData.data },
          },
        },
      });
      marketingImageAssets.push(`customers/${customerId}/assets/${imageTempId}`);
      hasMarketingImage = true;
    }

    // Process square images (1:1) - use same images cropped to square
    for (const img of input.images.slice(0, 5)) {
      if (!img.url) continue;
      const imageData = await fetchImageAsBase64(img.url, 'SQUARE_MARKETING_IMAGE');
      if (!imageData) continue;

      const imageTempId = tempId--;
      operations.push({
        assetOperation: {
          create: {
            resourceName: `customers/${customerId}/assets/${imageTempId}`,
            name: `Square Image`,
            type: 'IMAGE',
            imageAsset: { data: imageData.data },
          },
        },
      });
      squareImageAssets.push(`customers/${customerId}/assets/${imageTempId}`);
    }

    // Process logos (1:1)
    for (const logo of input.logos.slice(0, 5)) {
      if (!logo.url) continue;
      const imageData = await fetchImageAsBase64(logo.url, 'LOGO');
      if (!imageData) continue;

      const imageTempId = tempId--;
      operations.push({
        assetOperation: {
          create: {
            resourceName: `customers/${customerId}/assets/${imageTempId}`,
            name: `Logo`,
            type: 'IMAGE',
            imageAsset: { data: imageData.data },
          },
        },
      });
      logoAssets.push(`customers/${customerId}/assets/${imageTempId}`);
    }

    console.log(`[Display] Assets prepared: ${headlineAssets.length} headlines, ${descriptionAssets.length} descriptions, ${marketingImageAssets.length} marketing images, ${squareImageAssets.length} square images, ${logoAssets.length} logos`);

    // Validate minimum requirements
    if (!hasMarketingImage || logoAssets.length === 0) {
      console.error('[Display] Missing required images');
      return {
        success: true, // Campaign was created
        campaignId,
        error: 'Campaign created but ads could not be added: missing marketing image or logo',
        details: 'Please add images manually in Google Ads UI',
      };
    }

    // Create Responsive Display Ad using AdGroupAd
    const adTempId = tempId--;
    operations.push({
      adGroupAdOperation: {
        create: {
          adGroup: adGroupResourceName,
          status: 'ENABLED',
          ad: {
            resourceName: `customers/${customerId}/ads/${adTempId}`,
            finalUrls: [input.finalUrl],
            responsiveDisplayAd: {
              headlines: headlineAssets.map(asset => ({ asset })),
              longHeadline: { asset: longHeadlineAsset },
              descriptions: descriptionAssets.map(asset => ({ asset })),
              marketingImages: marketingImageAssets.map(asset => ({ asset })),
              squareMarketingImages: squareImageAssets.length > 0
                ? squareImageAssets.map(asset => ({ asset }))
                : undefined,
              logoImages: logoAssets.map(asset => ({ asset })),
              businessName: input.businessName || input.name,
            },
          },
        },
      },
    });

    console.log(`[Display] Executing REST API mutate with ${operations.length} operations...`);

    // Execute atomic mutate via REST API
    const mutateResult = await executeRestMutate(
      refreshToken,
      customerId,
      operations,
      loginCustomerId
    );

    if (mutateResult.error) {
      console.error('[Display] REST mutate error:', JSON.stringify(mutateResult.error, null, 2));
      return {
        success: true, // Campaign exists
        campaignId,
        error: 'Campaign created but ads failed: ' + (mutateResult.error.message || 'Unknown error'),
        details: JSON.stringify(mutateResult.error),
      };
    }

    console.log('[Display] SUCCESS! Campaign with Responsive Display Ad created');

    return {
      success: true,
      campaignId,
      details: 'Display campaign is LIVE with Responsive Display Ad and all assets linked.',
    };

  } catch (error: any) {
    console.error('[Display] Error creating campaign:', error);

    const errorDetails = JSON.stringify(error, null, 2);
    if (errorDetails.includes('EXPRESS') || errorDetails.includes('advertising_channel_sub_type')) {
      return {
        success: false,
        error: 'Your Google Ads account appears to be in Smart Mode. Display campaigns require Expert Mode.',
        details: errorDetails,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Display campaign',
      details: errorDetails,
    };
  }
}

// =====================================================
// Demand Gen Campaign
// =====================================================

/**
 * Create a Demand Gen campaign with asset groups
 * Demand Gen uses asset groups similar to PMax
 */
export async function createDemandGenCampaign(
  refreshToken: string,
  customerId: string,
  input: DemandGenCampaignInput,
  loginCustomerId?: string
): Promise<CampaignResult> {
  const client = createGoogleAdsClient();
  const customer = getCustomer(client, customerId, refreshToken, loginCustomerId);

  try {
    console.log('[DemandGen] Creating Demand Gen campaign:', input.name);
    const timestamp = Date.now();

    // Step 1: Create Budget
    const budgetAmountMicros = input.dailyBudget * 1_000_000;

    const budgetResult = await customer.campaignBudgets.create([{
      name: `Budget for ${input.name} ${timestamp}`,
      amount_micros: budgetAmountMicros,
      delivery_method: 2,
      explicitly_shared: false,
    }] as any);

    const budgetResourceName = budgetResult.results[0]?.resource_name;
    if (!budgetResourceName) {
      return { success: false, error: 'Failed to create budget' };
    }
    console.log('[DemandGen] Budget created:', budgetResourceName);

    // Step 2: Create Campaign
    const campaignPayload: any = {
      name: `${input.name} ${timestamp}`,
      advertising_channel_type: 12, // DEMAND_GEN
      status: 2, // ENABLED
      campaign_budget: budgetResourceName,
      ...(input.biddingStrategy === 'MAXIMIZE_CONVERSIONS' && {
        maximize_conversions: {},
      }),
      ...(input.biddingStrategy === 'MAXIMIZE_CONVERSION_VALUE' && {
        maximize_conversion_value: {},
      }),
      ...(input.biddingStrategy === 'TARGET_CPA' && input.targetCpa && {
        target_cpa: {
          target_cpa_micros: input.targetCpa * 1_000_000,
        },
      }),
    };

    const campaignResult = await customer.campaigns.create([campaignPayload] as any);
    const campaignResourceName = campaignResult.results[0]?.resource_name;
    if (!campaignResourceName) {
      return { success: false, error: 'Failed to create campaign' };
    }
    const campaignId = campaignResourceName.split('/').pop()!;
    console.log('[DemandGen] Campaign created:', campaignId);

    // Step 3: Create Asset Groups (similar to PMax)
    const assetGroupIds: string[] = [];

    for (let i = 0; i < input.assetGroups.length; i++) {
      const assetGroup = input.assetGroups[i];
      console.log(`[DemandGen] Creating asset group ${i + 1}/${input.assetGroups.length}: ${assetGroup.name}`);

      try {
        // Validate minimum requirements
        const headlinesToCreate = assetGroup.headlines.slice(0, 15);
        if (headlinesToCreate.length < 3) {
          console.error(`[DemandGen] Asset group ${assetGroup.name} needs at least 3 headlines`);
          continue;
        }

        const descriptionsToCreate = assetGroup.descriptions.slice(0, 5);
        if (descriptionsToCreate.length < 2) {
          console.error(`[DemandGen] Asset group ${assetGroup.name} needs at least 2 descriptions`);
          continue;
        }

        // Build ALL operations for atomic mutate
        const operations: any[] = [];
        let tempId = -1;

        const assetGroupTempId = tempId--;
        const assetGroupResourceName = `customers/${customerId}/assetGroups/${assetGroupTempId}`;

        const assetsToLink: { tempId: number; fieldType: number }[] = [];

        // Create headline assets
        for (const headline of headlinesToCreate) {
          const assetTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${assetTempId}`,
                name: `Headline: ${headline.substring(0, 50)}`,
                textAsset: { text: headline.substring(0, 30) },
              },
            },
          });
          assetsToLink.push({ tempId: assetTempId, fieldType: ASSET_FIELD_TYPE.HEADLINE });
        }

        // Create description assets
        for (const desc of descriptionsToCreate) {
          const assetTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${assetTempId}`,
                name: `Description: ${desc.substring(0, 50)}`,
                textAsset: { text: desc.substring(0, 90) },
              },
            },
          });
          assetsToLink.push({ tempId: assetTempId, fieldType: ASSET_FIELD_TYPE.DESCRIPTION });
        }

        // Create long headline asset
        const longHeadline = assetGroup.longHeadlines[0] || assetGroup.headlines[0] || 'Discover More';
        const longHeadlineTempId = tempId--;
        operations.push({
          assetOperation: {
            create: {
              resourceName: `customers/${customerId}/assets/${longHeadlineTempId}`,
              name: `Long Headline`,
              textAsset: { text: longHeadline.substring(0, 90) },
            },
          },
        });
        assetsToLink.push({ tempId: longHeadlineTempId, fieldType: ASSET_FIELD_TYPE.LONG_HEADLINE });

        // Create business name asset
        const businessName = assetGroup.businessName || input.name;
        const businessNameTempId = tempId--;
        operations.push({
          assetOperation: {
            create: {
              resourceName: `customers/${customerId}/assets/${businessNameTempId}`,
              name: `Business Name`,
              textAsset: { text: businessName.substring(0, 25) },
            },
          },
        });
        assetsToLink.push({ tempId: businessNameTempId, fieldType: ASSET_FIELD_TYPE.BUSINESS_NAME });

        // Process images
        console.log(`[DemandGen] Preparing image assets for ${assetGroup.name}...`);
        let marketingCount = 0;
        let squareCount = 0;

        // Process marketing images (1.91:1)
        for (const img of assetGroup.images.slice(0, 10)) {
          const imgUrl = img.url;
          if (!imgUrl) continue;

          const imageData = await fetchImageAsBase64(imgUrl, 'MARKETING_IMAGE');
          if (!imageData) continue;

          const imageTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${imageTempId}`,
                name: `Marketing Image ${marketingCount + 1}`,
                type: 'IMAGE',
                imageAsset: { data: imageData.data },
              },
            },
          });
          assetsToLink.push({ tempId: imageTempId, fieldType: ASSET_FIELD_TYPE.MARKETING_IMAGE });
          marketingCount++;
        }

        // Process square images (1:1)
        for (const img of assetGroup.images.slice(0, 10)) {
          const imgUrl = img.url;
          if (!imgUrl) continue;

          const imageData = await fetchImageAsBase64(imgUrl, 'SQUARE_MARKETING_IMAGE');
          if (!imageData) continue;

          const imageTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${imageTempId}`,
                name: `Square Image ${squareCount + 1}`,
                type: 'IMAGE',
                imageAsset: { data: imageData.data },
              },
            },
          });
          assetsToLink.push({ tempId: imageTempId, fieldType: ASSET_FIELD_TYPE.SQUARE_MARKETING_IMAGE });
          squareCount++;
        }

        // Process logos
        for (let logoIdx = 0; logoIdx < Math.min(assetGroup.logos.length, 5); logoIdx++) {
          const logo = assetGroup.logos[logoIdx];
          if (!logo.url) continue;

          const imageData = await fetchImageAsBase64(logo.url, 'LOGO');
          if (!imageData) continue;

          const logoTempId = tempId--;
          operations.push({
            assetOperation: {
              create: {
                resourceName: `customers/${customerId}/assets/${logoTempId}`,
                name: `Logo ${logoIdx + 1}`,
                type: 'IMAGE',
                imageAsset: { data: imageData.data },
              },
            },
          });
          assetsToLink.push({ tempId: logoTempId, fieldType: ASSET_FIELD_TYPE.LOGO });
        }

        const logoCount = assetsToLink.filter(a => a.fieldType === ASSET_FIELD_TYPE.LOGO).length;
        console.log(`[DemandGen] Processed ${marketingCount} marketing, ${squareCount} square, ${logoCount} logos`);

        // Validate minimum image requirements
        if (marketingCount === 0 && squareCount === 0) {
          console.error(`[DemandGen] No valid marketing images for ${assetGroup.name}`);
          continue;
        }
        if (logoCount === 0) {
          console.error(`[DemandGen] No valid logos for ${assetGroup.name}`);
          continue;
        }

        // Create asset group operation
        operations.push({
          assetGroupOperation: {
            create: {
              resourceName: assetGroupResourceName,
              campaign: campaignResourceName,
              name: `${assetGroup.name} ${timestamp}`,
              finalUrls: [assetGroup.finalUrl || input.finalUrl],
              status: 'ENABLED',
              ...(assetGroup.path1 && { path1: assetGroup.path1 }),
              ...(assetGroup.path2 && { path2: assetGroup.path2 }),
            },
          },
        });

        // Create asset group asset link operations
        const fieldTypeNames: Record<number, string> = {
          [ASSET_FIELD_TYPE.HEADLINE]: 'HEADLINE',
          [ASSET_FIELD_TYPE.DESCRIPTION]: 'DESCRIPTION',
          [ASSET_FIELD_TYPE.LONG_HEADLINE]: 'LONG_HEADLINE',
          [ASSET_FIELD_TYPE.BUSINESS_NAME]: 'BUSINESS_NAME',
          [ASSET_FIELD_TYPE.MARKETING_IMAGE]: 'MARKETING_IMAGE',
          [ASSET_FIELD_TYPE.SQUARE_MARKETING_IMAGE]: 'SQUARE_MARKETING_IMAGE',
          [ASSET_FIELD_TYPE.LOGO]: 'LOGO',
        };

        for (const asset of assetsToLink) {
          operations.push({
            assetGroupAssetOperation: {
              create: {
                assetGroup: assetGroupResourceName,
                asset: `customers/${customerId}/assets/${asset.tempId}`,
                fieldType: fieldTypeNames[asset.fieldType] || 'UNSPECIFIED',
              },
            },
          });
        }

        console.log(`[DemandGen] Executing REST API mutate with ${operations.length} operations...`);

        // Execute atomic mutate via REST API
        const mutateResult = await executeRestMutate(
          refreshToken,
          customerId,
          operations,
          loginCustomerId
        );

        const assetGroupResultEntry = mutateResult.mutateOperationResponses?.find(
          (r: any) => r.assetGroupResult?.resourceName
        );

        if (assetGroupResultEntry?.assetGroupResult?.resourceName) {
          const assetGroupId = assetGroupResultEntry.assetGroupResult.resourceName.split('/').pop()!;
          assetGroupIds.push(assetGroupId);
          console.log(`[DemandGen] SUCCESS! Asset group created: ${assetGroupId}`);
        } else {
          console.error(`[DemandGen] Mutate succeeded but no asset group ID found`);
        }

      } catch (error: any) {
        console.error(`[DemandGen] Error creating asset group ${assetGroup.name}:`, error.message || error);
      }
    }

    if (assetGroupIds.length > 0) {
      console.log(`[DemandGen] Campaign created with ${assetGroupIds.length} asset group(s)`);
      return {
        success: true,
        campaignId,
        assetGroupIds,
        details: `Demand Gen campaign is LIVE with ${assetGroupIds.length} asset group(s) and all assets linked.`,
      };
    } else {
      console.error('[DemandGen] FAILED: No asset groups were created');
      return {
        success: false,
        campaignId,
        error: 'Campaign created but no asset groups could be attached.',
        details: 'Please check that your campaign has all required assets.',
      };
    }

  } catch (error: any) {
    console.error('[DemandGen] Error creating campaign:', error);

    const errorDetails = JSON.stringify(error, null, 2);
    if (errorDetails.includes('EXPRESS') || errorDetails.includes('advertising_channel_sub_type')) {
      return {
        success: false,
        error: 'Your Google Ads account appears to be in Smart Mode. Demand Gen campaigns require Expert Mode.',
        details: errorDetails,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Demand Gen campaign',
      details: errorDetails,
    };
  }
}

// =====================================================
// Sync Campaign to Google Ads
// =====================================================

/**
 * Sync a local campaign to Google Ads
 * This is a wrapper that routes to the appropriate campaign type handler
 */
export async function syncCampaignToGoogleAds(
  refreshToken: string,
  customerId: string,
  campaign: {
    type: 'PMAX' | 'DISPLAY' | 'DEMAND_GEN';
    name: string;
    dailyBudget: number;
    biddingStrategy: string;
    targetCpa?: number;
    targetRoas?: number;
    finalUrl: string;
    assetGroups?: AssetGroupInput[];
    headlines?: string[];
    longHeadline?: string;
    descriptions?: string[];
    businessName?: string;
    images?: { url: string; aspectRatio?: string }[];
    logos?: { url: string }[];
    targetLocations?: string[];
    targetLanguages?: string[];
  },
  loginCustomerId?: string
): Promise<CampaignResult> {
  switch (campaign.type) {
    case 'PMAX':
      return createPMaxCampaign(refreshToken, customerId, {
        name: campaign.name,
        dailyBudget: campaign.dailyBudget,
        biddingStrategy: campaign.biddingStrategy as any,
        targetCpa: campaign.targetCpa,
        targetRoas: campaign.targetRoas,
        finalUrl: campaign.finalUrl,
        assetGroups: campaign.assetGroups || [],
        targetLocations: campaign.targetLocations,
        targetLanguages: campaign.targetLanguages,
      }, loginCustomerId);

    case 'DISPLAY':
      return createDisplayCampaign(refreshToken, customerId, {
        name: campaign.name,
        dailyBudget: campaign.dailyBudget,
        biddingStrategy: campaign.biddingStrategy as any,
        targetCpa: campaign.targetCpa,
        finalUrl: campaign.finalUrl,
        headlines: campaign.headlines || [],
        longHeadline: campaign.longHeadline || '',
        descriptions: campaign.descriptions || [],
        businessName: campaign.businessName || '',
        images: campaign.images || [],
        logos: campaign.logos || [],
        targetLocations: campaign.targetLocations,
        targetLanguages: campaign.targetLanguages,
      }, loginCustomerId);

    case 'DEMAND_GEN':
      return createDemandGenCampaign(refreshToken, customerId, {
        name: campaign.name,
        dailyBudget: campaign.dailyBudget,
        biddingStrategy: campaign.biddingStrategy as any,
        targetCpa: campaign.targetCpa,
        finalUrl: campaign.finalUrl,
        assetGroups: campaign.assetGroups || [],
        targetLocations: campaign.targetLocations,
        targetLanguages: campaign.targetLanguages,
      }, loginCustomerId);

    default:
      return {
        success: false,
        error: `Unsupported campaign type: ${campaign.type}`,
      };
  }
}
