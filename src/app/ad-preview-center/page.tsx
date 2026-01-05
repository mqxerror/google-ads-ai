'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FormatPreviewGrid,
  AssetCoveragePanel,
  SmartCropStudio,
  ImageGallery,
  ImageVariantPanel,
} from '@/components/ad-preview';
import type { CampaignType, AspectRatio, UploadedAsset, CroppedVersion } from '@/types/ad-preview';
import { ASPECT_RATIO_REQUIREMENTS } from '@/constants/ad-formats';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
}

interface AssetGroup {
  headlines: string[];
  descriptions: string[];
  images: UploadedAsset[];
  logos: UploadedAsset[];
  videos?: UploadedAsset[];
  businessName?: string;
  finalUrl?: string;
  displayPath1?: string;
  displayPath2?: string;
}

interface PreviewCenterData {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  headlines: string[];
  descriptions: string[];
  images: UploadedAsset[];
  logos: UploadedAsset[];
  businessName?: string;
  finalUrl?: string;
  displayPath1?: string;
  displayPath2?: string;
}

// Demo data for when no campaign is selected
const DEMO_ASSETS: AssetGroup = {
  headlines: [
    'Premium Quality Products',
    'Shop Now & Save 20%',
    'Free Shipping on Orders $50+',
    'Trusted by 10,000+ Customers',
    'Limited Time Offer',
  ],
  descriptions: [
    'Discover our award-winning collection of premium products. High quality materials, exceptional craftsmanship.',
    'Shop the latest trends and enjoy exclusive discounts. New arrivals weekly. Satisfaction guaranteed.',
    'Experience the difference with our best-selling items. Fast shipping, easy returns, 24/7 support.',
    'Join thousands of happy customers. Premium quality at affordable prices. Shop now!',
  ],
  images: [
    { id: '1', type: 'image', previewUrl: '/placeholder-landscape.jpg', aspectRatio: '1.91:1' },
    { id: '2', type: 'image', previewUrl: '/placeholder-square.jpg', aspectRatio: '1:1' },
  ],
  logos: [
    { id: 'logo1', type: 'logo', previewUrl: '/placeholder-logo.png', aspectRatio: '1:1' },
  ],
  businessName: 'Demo Business',
  finalUrl: 'https://example.com',
  displayPath1: 'products',
  displayPath2: 'new',
};

// Loading fallback for Suspense
function AdPreviewCenterLoading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex items-center gap-3 text-text3">
        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading Ad Preview Center...
      </div>
    </div>
  );
}

// Main page wrapped in Suspense
export default function AdPreviewCenterPage() {
  return (
    <Suspense fallback={<AdPreviewCenterLoading />}>
      <AdPreviewCenterContent />
    </Suspense>
  );
}

function AdPreviewCenterContent() {
  const searchParams = useSearchParams();
  const isFromWizard = searchParams.get('source') === 'wizard';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignType, setCampaignType] = useState<CampaignType>('PMAX');
  const [campaignName, setCampaignName] = useState<string>('');
  const [assets, setAssets] = useState<AssetGroup>(DEMO_ASSETS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wizardMode, setWizardMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Crop studio state
  const [showCropStudio, setShowCropStudio] = useState(false);
  const [cropImage, setCropImage] = useState<UploadedAsset | null>(null);
  const [cropRatios, setCropRatios] = useState<AspectRatio[]>([]);

  // Image management state
  const [selectedImage, setSelectedImage] = useState<UploadedAsset | null>(null);
  const [selectedAssetType, setSelectedAssetType] = useState<'image' | 'logo'>('image');
  const [viewMode, setViewMode] = useState<'previews' | 'images'>('previews');

  // Track selected image ID separately to avoid stale references
  const selectedImageId = selectedImage?.id || null;

  // Derive the current selected asset from assets to always have fresh data
  // Now looks in both images AND logos
  const currentSelectedImage = useMemo(() => {
    if (!selectedImageId) return null;
    // Check images first
    const foundImage = assets.images.find(img => img.id === selectedImageId);
    if (foundImage) return foundImage;
    // Then check logos
    const foundLogo = assets.logos.find(logo => logo.id === selectedImageId);
    return foundLogo || null;
  }, [assets.images, assets.logos, selectedImageId]);

  // Load data from sessionStorage if coming from wizard
  useEffect(() => {
    if (isFromWizard) {
      const storedData = sessionStorage.getItem('previewCenterData');
      if (storedData) {
        try {
          const data: PreviewCenterData = JSON.parse(storedData);
          setWizardMode(true);
          setSelectedCampaignId(data.campaignId);
          setCampaignName(data.campaignName);
          setCampaignType((data.campaignType?.toUpperCase() || 'PMAX') as CampaignType);
          setAssets({
            headlines: data.headlines || [],
            descriptions: data.descriptions || [],
            images: data.images || [],
            logos: data.logos || [],
            businessName: data.businessName,
            finalUrl: data.finalUrl,
            displayPath1: data.displayPath1,
            displayPath2: data.displayPath2,
          });
        } catch (err) {
          console.error('Failed to parse preview data:', err);
        }
      }
    } else {
      fetchCampaigns();
    }
  }, [isFromWizard]);

  // Track changes
  const updateAssets = useCallback((newAssets: AssetGroup) => {
    setAssets(newAssets);
    setHasChanges(true);
    setSaveSuccess(false);
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/campaigns');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch campaign details when selected
  const handleSelectCampaign = useCallback(async (campaignId: string) => {
    if (!campaignId) {
      setSelectedCampaignId(null);
      setAssets(DEMO_ASSETS);
      setCampaignType('PMAX');
      setCampaignName('');
      return;
    }

    setSelectedCampaignId(campaignId);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch campaign');

      const data = await response.json();

      // Map campaign type
      const type = (data.type?.toUpperCase() || 'PMAX') as CampaignType;
      setCampaignType(type);
      setCampaignName(data.name || '');

      // Map assets from campaign data
      if (data.assetGroups?.[0]) {
        const group = data.assetGroups[0];
        setAssets({
          headlines: group.headlines || [],
          descriptions: group.descriptions || [],
          images: (group.images || []).map((img: { url?: string; previewUrl?: string; fileUrl?: string }, i: number) => ({
            id: `img-${i}`,
            type: 'image' as const,
            previewUrl: img.url || img.previewUrl || img.fileUrl,
          })),
          logos: (group.logos || []).map((logo: { url?: string; previewUrl?: string; fileUrl?: string }, i: number) => ({
            id: `logo-${i}`,
            type: 'logo' as const,
            previewUrl: logo.url || logo.previewUrl || logo.fileUrl,
          })),
          businessName: group.businessName || data.name,
          finalUrl: group.finalUrl || data.finalUrl,
          displayPath1: group.displayPath1,
          displayPath2: group.displayPath2,
        });
      } else {
        // Use ad data if no asset groups
        setAssets({
          headlines: data.headlines || DEMO_ASSETS.headlines,
          descriptions: data.descriptions || DEMO_ASSETS.descriptions,
          images: DEMO_ASSETS.images,
          logos: DEMO_ASSETS.logos,
          businessName: data.businessName || data.name,
          finalUrl: data.finalUrl || DEMO_ASSETS.finalUrl,
        });
      }
    } catch (err) {
      console.error('Failed to load campaign:', err);
      setError('Failed to load campaign details');
      setAssets(DEMO_ASSETS);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle upload more action from coverage panel
  const handleUploadMore = (assetType: 'image' | 'logo' | 'video') => {
    // TODO: Open file picker dialog
    console.log('Upload more:', assetType);
    alert(`Upload ${assetType} feature coming soon!`);
  };

  // Handle crop action from coverage panel
  const handleCropAsset = (asset: UploadedAsset, targetRatio: AspectRatio) => {
    setCropImage(asset);

    // Get all required ratios for this campaign type
    const requirements = ASPECT_RATIO_REQUIREMENTS[campaignType];
    const ratios = [
      ...requirements.images.required,
      ...requirements.images.recommended,
    ];
    setCropRatios(ratios);
    setShowCropStudio(true);
  };

  // Handle save crops from crop studio
  const handleSaveCrops = (crops: CroppedVersion[]) => {
    console.log('Saved crops:', crops);

    const sourceId = cropImage?.id;
    const isLogo = cropImage?.type === 'logo';

    if (!sourceId) {
      setShowCropStudio(false);
      setCropImage(null);
      return;
    }

    const ratiosBeingSaved = new Set(crops.map(c => c.ratio));

    if (isLogo) {
      // Handle logo crops - save to logos array
      let newLogos = assets.logos.filter(logo => {
        if (logo.sourceId !== sourceId) return true;
        if (!ratiosBeingSaved.has(logo.aspectRatio!)) return true;
        return false;
      });

      crops.forEach((crop) => {
        if (crop.previewUrl) {
          newLogos.push({
            id: `logo-crop-${sourceId}-${crop.ratio}-${Date.now()}`,
            type: 'logo',
            previewUrl: crop.previewUrl,
            aspectRatio: crop.ratio,
            sourceId: sourceId,
            name: cropImage?.name ? `${cropImage.name} (${crop.ratio})` : `Logo (${crop.ratio})`,
            width: Math.round(crop.cropArea.width),
            height: Math.round(crop.cropArea.height),
          });
        }
      });

      updateAssets({ ...assets, logos: newLogos });
      console.log(`Saved ${crops.length} crop(s) for logo ${sourceId}`);
    } else {
      // Handle image crops - save to images array
      let newImages = assets.images.filter(img => {
        if (img.sourceId !== sourceId) return true;
        if (!ratiosBeingSaved.has(img.aspectRatio!)) return true;
        return false;
      });

      crops.forEach((crop) => {
        if (crop.previewUrl) {
          newImages.push({
            id: `crop-${sourceId}-${crop.ratio}-${Date.now()}`,
            type: 'image',
            previewUrl: crop.previewUrl,
            aspectRatio: crop.ratio,
            sourceId: sourceId,
            name: cropImage?.name ? `${cropImage.name} (${crop.ratio})` : `Cropped (${crop.ratio})`,
            width: Math.round(crop.cropArea.width),
            height: Math.round(crop.cropArea.height),
          });
        }
      });

      updateAssets({ ...assets, images: newImages });
      console.log(`Saved ${crops.length} crop(s) for image ${sourceId}`);
    }

    setShowCropStudio(false);
    setCropImage(null);
  };

  // Get existing crops for an image or logo (to pass to crop studio)
  const getExistingCropsForImage = useCallback((asset: UploadedAsset): CroppedVersion[] => {
    const assetsArray = asset.type === 'logo' ? assets.logos : assets.images;
    return assetsArray
      .filter(img => img.sourceId === asset.id && img.aspectRatio)
      .map(img => ({
        ratio: img.aspectRatio!,
        cropArea: { x: 0, y: 0, width: img.width || 0, height: img.height || 0 },
        previewUrl: img.previewUrl || '',
        status: 'saved' as const,
      }));
  }, [assets.images, assets.logos]);

  // Get all variants for an image or logo (bidirectional - works for source or crop)
  const getVariantsForImage = useCallback((image: UploadedAsset): UploadedAsset[] => {
    // Determine the source ID - either the image itself or its sourceId
    const sourceId = image.sourceId || image.id;

    // Determine which array to search based on type
    const assetsArray = image.type === 'logo' ? assets.logos : assets.images;

    // Find all assets that share this source (including the source itself)
    return assetsArray.filter(img => {
      // Include the source asset
      if (img.id === sourceId) return true;
      // Include all crops of this source
      if (img.sourceId === sourceId) return true;
      return false;
    });
  }, [assets.images, assets.logos]);

  // Get the source image/logo for cropping (always use the original, not a crop)
  const getSourceImageForCropping = useCallback((image: UploadedAsset): UploadedAsset => {
    if (image.sourceId) {
      // This is a crop, find the original source
      const assetsArray = image.type === 'logo' ? assets.logos : assets.images;
      const source = assetsArray.find(img => img.id === image.sourceId);
      return source || image;
    }
    // This is already a source image/logo
    return image;
  }, [assets.images, assets.logos]);

  // Memoized handlers to prevent child re-renders
  const handleImageSelect = useCallback((image: UploadedAsset) => {
    setSelectedImage(image);
    // Determine if this is an image or logo based on type
    setSelectedAssetType(image.type === 'logo' ? 'logo' : 'image');
  }, []);

  const handleImagesChange = useCallback((newImages: UploadedAsset[]) => {
    setAssets(prev => ({ ...prev, images: newImages }));
    setHasChanges(true);
    setSaveSuccess(false);
  }, []);

  const handleLogosChange = useCallback((newLogos: UploadedAsset[]) => {
    setAssets(prev => ({ ...prev, logos: newLogos }));
    setHasChanges(true);
    setSaveSuccess(false);
  }, []);

  const handleGalleryCropImage = useCallback((image: UploadedAsset) => {
    setCropImage(image);
    const requirements = ASPECT_RATIO_REQUIREMENTS[campaignType];

    // Use logo ratios if it's a logo, otherwise use image ratios
    if (image.type === 'logo') {
      const ratios = [
        ...requirements.logos.required,
        ...requirements.logos.recommended,
      ];
      setCropRatios(ratios);
    } else {
      const ratios = [
        ...requirements.images.required,
        ...requirements.images.recommended,
      ];
      setCropRatios(ratios);
    }
    setShowCropStudio(true);
  }, [campaignType]);

  const handleVariantPanelCrop = useCallback((asset: UploadedAsset, ratio: AspectRatio) => {
    // Always use the source asset for cropping
    const sourceAsset = getSourceImageForCropping(asset);
    setCropImage(sourceAsset);
    setCropRatios([ratio]);
    setShowCropStudio(true);
  }, [getSourceImageForCropping]);

  // Memoize the variants for the currently selected image
  const currentImageVariants = useMemo(() => {
    if (!currentSelectedImage) return [];
    return getVariantsForImage(currentSelectedImage);
  }, [currentSelectedImage, getVariantsForImage]);

  // Memoize the source image for variant panel
  const sourceImageForPanel = useMemo(() => {
    if (!currentSelectedImage) return null;
    return getSourceImageForCropping(currentSelectedImage);
  }, [currentSelectedImage, getSourceImageForCropping]);

  // Apply changes back to wizard (save to sessionStorage)
  const handleApplyChanges = () => {
    const updatedData: PreviewCenterData = {
      campaignId: selectedCampaignId || '',
      campaignName: campaignName,
      campaignType: campaignType,
      headlines: assets.headlines,
      descriptions: assets.descriptions,
      images: assets.images,
      logos: assets.logos,
      businessName: assets.businessName,
      finalUrl: assets.finalUrl,
      displayPath1: assets.displayPath1,
      displayPath2: assets.displayPath2,
    };

    // Save to sessionStorage for the wizard to pick up
    sessionStorage.setItem('previewCenterUpdatedData', JSON.stringify(updatedData));

    // Broadcast event to opener window
    if (window.opener) {
      window.opener.postMessage({
        type: 'PREVIEW_CENTER_UPDATE',
        data: updatedData,
      }, window.location.origin);
    }

    setSaveSuccess(true);
    setHasChanges(false);

    // Show success message briefly then close
    setTimeout(() => {
      if (window.opener) {
        window.close();
      }
    }, 1500);
  };

  // Discard changes and close
  const handleDiscard = () => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        return;
      }
    }
    sessionStorage.removeItem('previewCenterData');
    if (window.opener) {
      window.close();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-divider sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!wizardMode && (
                <Link
                  href="/"
                  className="text-text3 hover:text-text transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
              )}
              <div>
                <h1 className="text-xl font-bold text-text flex items-center gap-2">
                  <span>📐</span>
                  Ad Preview Center
                  {wizardMode && (
                    <span className="ml-2 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full">
                      Editing: {campaignName}
                    </span>
                  )}
                </h1>
                <p className="text-sm text-text3">
                  {wizardMode
                    ? 'Make changes and apply them to your campaign'
                    : 'Preview your ads across all formats and optimize asset coverage'
                  }
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-surface2 rounded-lg p-1">
              <button
                onClick={() => setViewMode('previews')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  viewMode === 'previews'
                    ? 'bg-accent text-white'
                    : 'text-text3 hover:text-text'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  Previews
                </span>
              </button>
              <button
                onClick={() => setViewMode('images')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  viewMode === 'images'
                    ? 'bg-accent text-white'
                    : 'text-text3 hover:text-text'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Images
                </span>
              </button>
            </div>

            {/* Actions based on mode */}
            <div className="flex items-center gap-3">
              {wizardMode ? (
                <>
                  {/* Wizard mode actions */}
                  <button
                    onClick={handleDiscard}
                    className="px-4 py-2 text-text3 hover:text-text text-sm transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleApplyChanges}
                    disabled={!hasChanges && !saveSuccess}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      saveSuccess
                        ? 'bg-success text-white'
                        : hasChanges
                          ? 'bg-accent text-white hover:bg-accent/90'
                          : 'bg-surface2 text-text3 cursor-not-allowed'
                    }`}
                  >
                    {saveSuccess ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Applied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Apply Changes
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {/* Regular mode - campaign selector */}
                  <select
                    value={selectedCampaignId || ''}
                    onChange={(e) => handleSelectCampaign(e.target.value)}
                    className="px-4 py-2 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent min-w-[250px]"
                  >
                    <option value="">Demo Mode (No Campaign)</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.type})
                      </option>
                    ))}
                  </select>

                  {/* Campaign type override for demo mode */}
                  {!selectedCampaignId && (
                    <select
                      value={campaignType}
                      onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                      className="px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="SEARCH">Search</option>
                      <option value="DISPLAY">Display</option>
                      <option value="PMAX">Performance Max</option>
                      <option value="DEMAND_GEN">Demand Gen</option>
                      <option value="VIDEO">Video</option>
                    </select>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-text3">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading campaign...
            </div>
          </div>
        ) : error ? (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger">
            {error}
          </div>
        ) : viewMode === 'previews' ? (
            /* PREVIEWS MODE - Original layout */
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left: Asset Coverage Panel */}
              <div className="lg:col-span-1">
                <AssetCoveragePanel
                  images={assets.images}
                  logos={assets.logos}
                  videos={assets.videos}
                  campaignType={campaignType}
                  onUploadMore={handleUploadMore}
                  onCropAsset={handleCropAsset}
                />

                {/* Quick edit panel */}
                <div className="mt-4 bg-surface2 border border-divider rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text mb-3 flex items-center gap-2">
                    <span>✏️</span>
                    Quick Edit
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-text3 block mb-1">Business Name</label>
                      <input
                        type="text"
                        value={assets.businessName || ''}
                        onChange={(e) => updateAssets({ ...assets, businessName: e.target.value })}
                        className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text3 block mb-1">Landing Page URL</label>
                      <input
                        type="url"
                        value={assets.finalUrl || ''}
                        onChange={(e) => updateAssets({ ...assets, finalUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* Headlines editor */}
                <div className="mt-4 bg-surface2 border border-divider rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text mb-3 flex items-center gap-2">
                    <span>📝</span>
                    Headlines ({assets.headlines.filter(h => h.trim()).length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {assets.headlines.map((headline, index) => (
                      <input
                        key={index}
                        type="text"
                        value={headline}
                        onChange={(e) => {
                          const newHeadlines = [...assets.headlines];
                          newHeadlines[index] = e.target.value;
                          updateAssets({ ...assets, headlines: newHeadlines });
                        }}
                        placeholder={`Headline ${index + 1}`}
                        className="w-full px-3 py-1.5 bg-surface border border-divider rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    ))}
                  </div>
                </div>

                {/* Descriptions editor */}
                <div className="mt-4 bg-surface2 border border-divider rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text mb-3 flex items-center gap-2">
                    <span>📄</span>
                    Descriptions ({assets.descriptions.filter(d => d.trim()).length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {assets.descriptions.map((description, index) => (
                      <textarea
                        key={index}
                        value={description}
                        onChange={(e) => {
                          const newDescriptions = [...assets.descriptions];
                          newDescriptions[index] = e.target.value;
                          updateAssets({ ...assets, descriptions: newDescriptions });
                        }}
                        placeholder={`Description ${index + 1}`}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-surface border border-divider rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Format Preview Grid */}
              <div className="lg:col-span-3">
                <FormatPreviewGrid
                  campaignType={campaignType}
                  headlines={assets.headlines}
                  descriptions={assets.descriptions}
                  images={assets.images}
                  logos={assets.logos}
                  videos={assets.videos}
                  businessName={assets.businessName}
                  finalUrl={assets.finalUrl}
                  displayPath1={assets.displayPath1}
                  displayPath2={assets.displayPath2}
                />
              </div>
            </div>
          ) : (
            /* IMAGES MODE - Image management layout */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Image Gallery */}
              <div className="lg:col-span-1">
                <ImageGallery
                  images={assets.images}
                  logos={assets.logos}
                  onImagesChange={handleImagesChange}
                  onLogosChange={handleLogosChange}
                  onImageSelect={handleImageSelect}
                  onCropImage={handleGalleryCropImage}
                  selectedImageId={selectedImageId || undefined}
                  maxImages={20}
                  maxLogos={5}
                />
              </div>

              {/* Center: Selected Image/Logo Preview + Variant Panel */}
              <div className="lg:col-span-1">
                {currentSelectedImage ? (
                  <div className="space-y-4">
                    {/* Large preview of selected asset */}
                    <div className="bg-surface2 border border-divider rounded-xl overflow-hidden">
                      <div className="p-3 border-b border-divider flex items-center justify-between">
                        <h3 className="text-sm font-medium text-text flex items-center gap-2">
                          <span>{currentSelectedImage.type === 'logo' ? '🏷️' : '🔍'}</span>
                          {currentSelectedImage.sourceId
                            ? (currentSelectedImage.type === 'logo' ? 'Logo Variant' : 'Cropped Variant')
                            : (currentSelectedImage.type === 'logo' ? 'Source Logo' : 'Source Image')
                          }
                        </h3>
                        {currentSelectedImage.aspectRatio && (
                          <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded">
                            {currentSelectedImage.aspectRatio}
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={currentSelectedImage.previewUrl || currentSelectedImage.fileUrl}
                            alt={currentSelectedImage.name || 'Selected'}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        {currentSelectedImage.name && (
                          <p className="mt-2 text-sm text-text truncate">{currentSelectedImage.name}</p>
                        )}
                        {currentSelectedImage.width && currentSelectedImage.height && (
                          <p className="text-xs text-text3">
                            {currentSelectedImage.width} x {currentSelectedImage.height}px
                            {currentSelectedImage.aspectRatio && ` • ${currentSelectedImage.aspectRatio}`}
                          </p>
                        )}
                        {/* Quick crop button for logos */}
                        {currentSelectedImage.type === 'logo' && (
                          <button
                            onClick={() => handleGalleryCropImage(currentSelectedImage)}
                            className="mt-3 w-full py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l3-3m0 0l3 3m-3-3v12m18-6l-3 3m0 0l-3-3m3 3V6m-12 0h12M3 18h12" />
                            </svg>
                            Create Logo Variants (1:1 & 4:1)
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Variant panel - shows for both images and logos */}
                    {sourceImageForPanel && (
                      <ImageVariantPanel
                        image={sourceImageForPanel}
                        campaignType={campaignType}
                        existingVariants={currentImageVariants}
                        onCropForRatio={handleVariantPanelCrop}
                        onSelectVariant={handleImageSelect}
                      />
                    )}
                  </div>
                ) : (
                  /* Empty state when no image/logo selected */
                  <div className="bg-surface2 border border-divider rounded-xl p-8 text-center">
                    <span className="text-4xl block mb-3">👆</span>
                    <h3 className="text-sm font-medium text-text mb-1">Select an Image or Logo</h3>
                    <p className="text-xs text-text3">
                      Click on an image or logo in the gallery to see its variants and create crops for different aspect ratios.
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Asset Coverage Summary + Tips */}
              <div className="lg:col-span-1">
                <AssetCoveragePanel
                  images={assets.images}
                  logos={assets.logos}
                  videos={assets.videos}
                  campaignType={campaignType}
                  onUploadMore={handleUploadMore}
                  onCropAsset={handleCropAsset}
                />

                {/* Tips panel */}
                <div className="mt-4 bg-surface2 border border-divider rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text mb-3 flex items-center gap-2">
                    <span>💡</span>
                    Image Tips
                  </h3>
                  <ul className="space-y-2 text-xs text-text3">
                    <li className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      <span>Use high-resolution images (1200x628 recommended)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      <span>Include images for all required aspect ratios</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      <span>Keep important content centered for flexible cropping</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-warning">!</span>
                      <span>Avoid text in images - Google may reject them</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-warning">!</span>
                      <span>Logos should be 1:1 or 4:1 ratio with transparency</span>
                    </li>
                  </ul>
                </div>

                {/* Quick actions */}
                <div className="mt-4 bg-surface2 border border-divider rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text mb-3 flex items-center gap-2">
                    <span>⚡</span>
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const requirements = ASPECT_RATIO_REQUIREMENTS[campaignType];
                        const missingRatios = requirements.images.required.filter(
                          (ratio) => !assets.images.some((img) => img.aspectRatio === ratio)
                        );
                        if (missingRatios.length > 0 && assets.images.length > 0) {
                          setCropImage(assets.images[0]);
                          setCropRatios(missingRatios);
                          setShowCropStudio(true);
                        } else if (assets.images.length === 0) {
                          alert('Upload at least one image first');
                        } else {
                          alert('All required ratios are covered!');
                        }
                      }}
                      className="w-full py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors"
                    >
                      Create Missing Crops
                    </button>
                    <button
                      onClick={() => setViewMode('previews')}
                      className="w-full py-2 bg-surface text-text text-sm rounded-lg border border-divider hover:bg-surface2 transition-colors"
                    >
                      View All Previews
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
      </main>

      {/* Crop Studio Modal */}
      {showCropStudio && cropImage && (
        <SmartCropStudio
          image={cropImage}
          requiredRatios={cropRatios}
          existingCrops={getExistingCropsForImage(cropImage)}
          onSaveCrops={handleSaveCrops}
          onCancel={() => {
            setShowCropStudio(false);
            setCropImage(null);
          }}
        />
      )}
    </div>
  );
}
