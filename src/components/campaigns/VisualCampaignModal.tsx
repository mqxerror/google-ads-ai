'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { AssetUploader, type UploadedAsset } from '@/components/shared/AssetUploader';
import { DnaAdCopySelector } from '@/components/shared/DnaAdCopySelector';
import { BudgetInput } from '@/components/shared/BudgetInput';
import { BiddingStrategySelector } from '@/components/shared/BiddingStrategySelector';
import { LocationTargeting } from '@/components/shared/LocationTargeting';
import { UtmBuilder } from '@/components/shared/UtmBuilder';
import { HeadlineInput } from '@/components/shared/HeadlineInput';
import { DescriptionInput } from '@/components/shared/DescriptionInput';
import { AdPreviewCard } from '@/components/shared/AdPreviewCard';
import { BIDDING_STRATEGIES } from '@/constants/campaign';
import type { GeneratedAdCopy, DNAProject, AdCopyCampaignType } from '@/hooks/useDnaAdCopy';
import type { BiddingStrategy } from '@/types/campaign';

interface VisualCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (campaign: any) => void;
  initialType?: 'DISPLAY' | 'PMAX' | 'DEMAND_GEN';
}

type Step = 'type' | 'basics' | 'assets' | 'targeting' | 'review';

const CAMPAIGN_TYPE_INFO: Record<string, { icon: string; title: string; description: string; features: string[] }> = {
  DISPLAY: {
    icon: '🖼️',
    title: 'Display Campaign',
    description: 'Show image ads across millions of websites and apps in the Google Display Network',
    features: ['Image & responsive ads', 'Audience targeting', 'Placement targeting', 'Brand awareness'],
  },
  PMAX: {
    icon: '🚀',
    title: 'Performance Max',
    description: 'AI-powered campaign that optimizes across all Google channels (Search, Display, YouTube, Gmail, Discover)',
    features: ['All channels in one', 'AI optimization', 'Asset groups', 'Best for conversions'],
  },
  DEMAND_GEN: {
    icon: '✨',
    title: 'Demand Gen',
    description: 'Reach new customers on YouTube, Discover, and Gmail with engaging visual ads',
    features: ['YouTube Shorts', 'Discover feed', 'Gmail promotions', 'Visually rich ads'],
  },
};


export function VisualCampaignModal({
  isOpen,
  onClose,
  onSuccess,
  initialType,
}: VisualCampaignModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>(initialType ? 'basics' : 'type');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [campaignType, setCampaignType] = useState<'DISPLAY' | 'PMAX' | 'DEMAND_GEN'>(initialType || 'PMAX');
  const [campaignName, setCampaignName] = useState('');
  const [dailyBudget, setDailyBudget] = useState(50);
  const [biddingStrategy, setBiddingStrategy] = useState<BiddingStrategy>('MAXIMIZE_CONVERSIONS');
  const [targetCpa, setTargetCpa] = useState<number | undefined>();
  const [targetRoas, setTargetRoas] = useState<number | undefined>();
  const [finalUrl, setFinalUrl] = useState('');
  const [targetLocations, setTargetLocations] = useState<string[]>(['2840']); // US default

  // Asset Groups
  const [assetGroups, setAssetGroups] = useState<AssetGroupData[]>([
    {
      id: 'default',
      name: 'Asset Group 1',
      headlines: ['', '', ''],
      longHeadlines: [''],
      descriptions: ['', ''],
      businessName: '',
      images: [],
      logos: [],
      videos: [],
    },
  ]);

  interface AssetGroupData {
    id: string;
    name: string;
    headlines: string[];
    longHeadlines: string[];
    descriptions: string[];
    businessName: string;
    images: UploadedAsset[];
    logos: UploadedAsset[];
    videos: UploadedAsset[];
    displayPath1?: string;
    displayPath2?: string;
  }

  // Current asset group being edited
  const [activeAssetGroupId, setActiveAssetGroupId] = useState('default');

  const activeAssetGroup = useMemo(() => {
    return assetGroups.find(g => g.id === activeAssetGroupId) || assetGroups[0];
  }, [assetGroups, activeAssetGroupId]);

  // Handle DNA ad copy generation from the reusable component
  const handleDnaAdCopyGenerated = useCallback((adCopy: GeneratedAdCopy) => {
    // Update asset groups with AI-generated copy
    setAssetGroups(prev => prev.map((g, idx) => {
      if (idx === 0) {
        return {
          ...g,
          businessName: adCopy.businessName || g.businessName,
          headlines: adCopy.headlines.length >= 3
            ? [...adCopy.headlines.slice(0, 15)]
            : [...adCopy.headlines, ...Array(Math.max(0, 3 - adCopy.headlines.length)).fill('')],
          longHeadlines: adCopy.longHeadlines.length > 0
            ? [...adCopy.longHeadlines.slice(0, 5)]
            : g.longHeadlines,
          descriptions: adCopy.descriptions.length >= 2
            ? [...adCopy.descriptions.slice(0, 5)]
            : [...adCopy.descriptions, ...Array(Math.max(0, 2 - adCopy.descriptions.length)).fill('')],
        };
      }
      return g;
    }));

    // Set campaign name if not already set
    if (!campaignName && adCopy.businessName) {
      setCampaignName(`${adCopy.businessName} - ${CAMPAIGN_TYPE_INFO[campaignType]?.title || 'Campaign'}`);
    }
  }, [campaignName, campaignType]);

  // Listen for updates from the preview center
  useEffect(() => {
    const handlePreviewCenterUpdate = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'PREVIEW_CENTER_UPDATE') return;

      const updatedData = event.data.data;
      if (!updatedData) return;

      // Update asset groups with the changes from preview center
      setAssetGroups(prev => prev.map((g, idx) => {
        if (idx === 0) {
          return {
            ...g,
            headlines: updatedData.headlines || g.headlines,
            descriptions: updatedData.descriptions || g.descriptions,
            businessName: updatedData.businessName || g.businessName,
            images: updatedData.images || g.images,
            logos: updatedData.logos || g.logos,
            displayPath1: updatedData.displayPath1,
            displayPath2: updatedData.displayPath2,
          };
        }
        return g;
      }));

      // Update final URL if changed
      if (updatedData.finalUrl) {
        setFinalUrl(updatedData.finalUrl);
      }
    };

    window.addEventListener('message', handlePreviewCenterUpdate);
    return () => window.removeEventListener('message', handlePreviewCenterUpdate);
  }, []);

  // Handle DNA project selection (for setting URL from domain)
  const handleDnaProjectSelected = useCallback(async (project: DNAProject | null) => {
    if (!project) return;

    // Fetch project details to get domain
    try {
      const response = await fetch(`/api/intelligence/${project.id}`);
      if (response.ok) {
        const data = await response.json();
        if (!finalUrl && data.project?.domain) {
          setFinalUrl(`https://${data.project.domain.replace(/^https?:\/\//, '')}`);
        }
      }
    } catch (err) {
      console.error('Failed to fetch project details:', err);
    }
  }, [finalUrl]);

  const steps: Step[] = useMemo(() => {
    if (initialType) {
      return ['basics', 'assets', 'targeting', 'review'];
    }
    return ['type', 'basics', 'assets', 'targeting', 'review'];
  }, [initialType]);

  const currentStepIndex = steps.indexOf(currentStep);

  // Update asset group
  const updateAssetGroup = useCallback(<K extends keyof AssetGroupData>(
    groupId: string,
    field: K,
    value: AssetGroupData[K]
  ) => {
    setAssetGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, [field]: value } : g
    ));
  }, []);

  // Add new asset group
  const addAssetGroup = useCallback(() => {
    const newGroup: AssetGroupData = {
      id: `group-${Date.now()}`,
      name: `Asset Group ${assetGroups.length + 1}`,
      headlines: ['', '', ''],
      longHeadlines: [''],
      descriptions: ['', ''],
      businessName: assetGroups[0]?.businessName || '',
      images: [],
      logos: [],
      videos: [],
    };
    setAssetGroups(prev => [...prev, newGroup]);
    setActiveAssetGroupId(newGroup.id);
  }, [assetGroups]);

  // Remove asset group
  const removeAssetGroup = useCallback((groupId: string) => {
    if (assetGroups.length <= 1) return;
    setAssetGroups(prev => prev.filter(g => g.id !== groupId));
    if (activeAssetGroupId === groupId) {
      setActiveAssetGroupId(assetGroups[0].id);
    }
  }, [assetGroups, activeAssetGroupId]);

  // Get validation errors for current step
  const getValidationErrors = useCallback((step: Step): string[] => {
    const errors: string[] = [];
    switch (step) {
      case 'type':
        if (!campaignType) errors.push('Select a campaign type');
        break;
      case 'basics':
        if (!campaignName.trim()) errors.push('Campaign name is required');
        if (dailyBudget <= 0) errors.push('Daily budget must be greater than 0');
        if (!finalUrl.trim()) errors.push('Landing page URL is required');
        break;
      case 'assets':
        // Check active asset group for errors
        if (activeAssetGroup) {
          const headlineCount = activeAssetGroup.headlines.filter(h => h.trim()).length;
          const descriptionCount = activeAssetGroup.descriptions.filter(d => d.trim()).length;

          if (headlineCount < 3) {
            errors.push(`Add ${3 - headlineCount} more headline${3 - headlineCount > 1 ? 's' : ''} (${headlineCount}/3 minimum)`);
          }
          if (descriptionCount < 2) {
            errors.push(`Add ${2 - descriptionCount} more description${2 - descriptionCount > 1 ? 's' : ''} (${descriptionCount}/2 minimum)`);
          }
          if (!activeAssetGroup.businessName.trim()) {
            errors.push('Business name is required');
          }
          if (activeAssetGroup.images.length < 1) {
            errors.push('Add at least 1 image');
          }
          if (activeAssetGroup.logos.length < 1) {
            errors.push('Add at least 1 logo');
          }
        }
        break;
      case 'targeting':
        if (targetLocations.length === 0) errors.push('Select at least one target location');
        break;
    }
    return errors;
  }, [campaignType, campaignName, dailyBudget, finalUrl, activeAssetGroup, targetLocations]);

  // Validate current step
  const validateStep = useCallback((step: Step): boolean => {
    switch (step) {
      case 'type':
        return !!campaignType;
      case 'basics':
        return !!(campaignName.trim() && dailyBudget > 0 && finalUrl.trim());
      case 'assets':
        // Check if at least one asset group has minimum assets
        return assetGroups.some(g =>
          g.headlines.filter(h => h.trim()).length >= 3 &&
          g.descriptions.filter(d => d.trim()).length >= 2 &&
          g.businessName.trim() &&
          g.images.length >= 1 &&
          g.logos.length >= 1
        );
      case 'targeting':
        return targetLocations.length > 0;
      default:
        return true;
    }
  }, [campaignType, campaignName, dailyBudget, finalUrl, assetGroups, targetLocations]);

  const canProceed = validateStep(currentStep);
  const validationErrors = getValidationErrors(currentStep);

  // Navigate steps
  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  }, [currentStepIndex, steps]);

  const prevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  }, [currentStepIndex, steps]);

  // Submit campaign
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const campaignData = {
        name: campaignName,
        type: campaignType,
        status: 'DRAFT',
        dailyBudget,
        biddingStrategy,
        targetCpa: biddingStrategy === 'TARGET_CPA' ? targetCpa : undefined,
        targetRoas: biddingStrategy === 'TARGET_ROAS' ? targetRoas : undefined,
        finalUrl,
        targetLocations,
        assetGroups: assetGroups.map(g => ({
          name: g.name,
          finalUrl,
          headlines: g.headlines.filter(h => h.trim()),
          longHeadlines: g.longHeadlines.filter(h => h.trim()),
          descriptions: g.descriptions.filter(d => d.trim()),
          businessName: g.businessName,
          // Pass actual image data for Google Ads upload
          images: g.images.map(img => ({
            fileUrl: img.fileUrl,
            previewUrl: img.previewUrl,
            width: img.width,
            height: img.height,
            aspectRatio: img.aspectRatio,
            mimeType: img.mimeType,
            fileName: img.fileName,
          })),
          logos: g.logos.map(logo => ({
            fileUrl: logo.fileUrl,
            previewUrl: logo.previewUrl,
            width: logo.width,
            height: logo.height,
            aspectRatio: logo.aspectRatio,
            mimeType: logo.mimeType,
            fileName: logo.fileName,
          })),
          videos: g.videos.map(v => ({
            fileUrl: v.fileUrl,
            youtubeVideoId: v.youtubeVideoId,
            fileName: v.fileName,
          })),
        })),
      };

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create campaign');
      }

      onSuccess?.(result.campaign);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    campaignName, campaignType, dailyBudget, biddingStrategy,
    targetCpa, targetRoas, finalUrl, targetLocations, assetGroups,
    onSuccess, onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-slideUp">
        {/* Header */}
        <div className="p-6 border-b border-divider flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {CAMPAIGN_TYPE_INFO[campaignType]?.icon}
              {currentStep === 'type' ? 'Create Visual Campaign' : CAMPAIGN_TYPE_INFO[campaignType]?.title}
            </h2>
            {currentStep !== 'type' && (
              <p className="text-text3 text-sm mt-1">
                Step {currentStepIndex + 1} of {steps.length}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center hover:bg-divider transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        {currentStep !== 'type' && (
          <div className="h-1 bg-surface2">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-danger-light text-danger rounded-lg">
              {error}
            </div>
          )}

          {/* Step: Campaign Type */}
          {currentStep === 'type' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(CAMPAIGN_TYPE_INFO).map(([type, info]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setCampaignType(type as 'DISPLAY' | 'PMAX' | 'DEMAND_GEN');
                    setCurrentStep('basics');
                  }}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:border-accent ${
                    campaignType === type ? 'border-accent bg-accent-light' : 'border-divider'
                  }`}
                >
                  <div className="text-4xl mb-3">{info.icon}</div>
                  <h3 className="font-semibold text-lg mb-2">{info.title}</h3>
                  <p className="text-text3 text-sm mb-4">{info.description}</p>
                  <ul className="space-y-1">
                    {info.features.map((feature, i) => (
                      <li key={i} className="text-sm text-text2 flex items-center gap-2">
                        <span className="text-success">✓</span> {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          )}

          {/* Step: Basic Settings */}
          {currentStep === 'basics' && (
            <div className="space-y-6 max-w-xl">
              {/* DNA Report Selector - Reusable Component */}
              <DnaAdCopySelector
                campaignType={campaignType as AdCopyCampaignType}
                onAdCopyGenerated={handleDnaAdCopyGenerated}
                onProjectSelected={handleDnaProjectSelected}
              />

              <div>
                <label className="block text-sm font-medium mb-2">Campaign Name *</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Summer Sale 2025 - PMax"
                  className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Landing Page URL *</label>
                <input
                  type="url"
                  value={finalUrl}
                  onChange={(e) => setFinalUrl(e.target.value)}
                  placeholder="https://example.com/landing-page"
                  className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {/* UTM Builder */}
                <UtmBuilder
                  baseUrl={finalUrl}
                  onUrlChange={setFinalUrl}
                  campaignName={campaignName}
                  showToggle={true}
                  className="mt-2"
                />
              </div>

              <BudgetInput
                dailyBudget={dailyBudget}
                onChange={setDailyBudget}
              />

              <BiddingStrategySelector
                value={biddingStrategy}
                onChange={setBiddingStrategy}
                campaignType={campaignType}
                targetCpa={targetCpa}
                targetRoas={targetRoas}
                onTargetCpaChange={setTargetCpa}
                onTargetRoasChange={setTargetRoas}
              />
            </div>
          )}

          {/* Step: Assets */}
          {currentStep === 'assets' && (
            <div className="space-y-6">
              {/* Asset Group Tabs */}
              <div className="flex items-center gap-2 border-b border-divider pb-2">
                {assetGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveAssetGroupId(group.id)}
                    className={`px-4 py-2 rounded-t-lg transition-colors ${
                      activeAssetGroupId === group.id
                        ? 'bg-accent text-white'
                        : 'bg-surface2 hover:bg-divider'
                    }`}
                  >
                    {group.name}
                    {assetGroups.length > 1 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAssetGroup(group.id);
                        }}
                        className="ml-2 text-xs hover:text-danger"
                      >
                        ✕
                      </span>
                    )}
                  </button>
                ))}
                {campaignType !== 'DISPLAY' && assetGroups.length < 5 && (
                  <button
                    type="button"
                    onClick={addAssetGroup}
                    className="px-3 py-2 text-accent hover:bg-accent-light rounded-lg transition-colors"
                  >
                    + Add Group
                  </button>
                )}
              </div>

              {activeAssetGroup && (
                <div className="space-y-6">
                  {/* Group Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Asset Group Name</label>
                    <input
                      type="text"
                      value={activeAssetGroup.name}
                      onChange={(e) => updateAssetGroup(activeAssetGroup.id, 'name', e.target.value)}
                      className="w-full px-4 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  {/* Headlines */}
                  <HeadlineInput
                    headlines={activeAssetGroup.headlines}
                    onChange={(headlines) => updateAssetGroup(activeAssetGroup.id, 'headlines', headlines)}
                    minCount={3}
                    maxCount={15}
                  />

                  {/* Long Headlines (PMax/Demand Gen only) */}
                  {campaignType !== 'DISPLAY' && (
                    <HeadlineInput
                      headlines={activeAssetGroup.longHeadlines}
                      onChange={(headlines) => updateAssetGroup(activeAssetGroup.id, 'longHeadlines', headlines)}
                      label="Long Headlines"
                      minCount={1}
                      maxCount={5}
                      showLongHeadlines={true}
                      placeholder="Enter long headline"
                    />
                  )}

                  {/* Descriptions */}
                  <DescriptionInput
                    descriptions={activeAssetGroup.descriptions}
                    onChange={(descriptions) => updateAssetGroup(activeAssetGroup.id, 'descriptions', descriptions)}
                    minCount={2}
                    maxCount={5}
                    useTextarea={true}
                  />

                  {/* Business Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      Business Name *
                      {activeAssetGroup.businessName.trim() ? (
                        <span className="text-success text-xs">✓</span>
                      ) : (
                        <span className="text-danger text-xs">(required)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={activeAssetGroup.businessName}
                      onChange={(e) => updateAssetGroup(activeAssetGroup.id, 'businessName', e.target.value)}
                      placeholder="Your business name"
                      maxLength={25}
                      className="w-full px-4 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <span className="text-text3 text-sm">
                      {activeAssetGroup.businessName.length}/25
                    </span>
                  </div>

                  {/* Images */}
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      Images * (min 1)
                      {activeAssetGroup.images.length >= 1 ? (
                        <span className="text-success text-xs">✓ {activeAssetGroup.images.length} uploaded</span>
                      ) : (
                        <span className="text-danger text-xs">(required)</span>
                      )}
                    </label>
                    <AssetUploader
                      campaignType={campaignType}
                      assetType="IMAGE"
                      maxAssets={20}
                      selectedAssets={activeAssetGroup.images}
                      onAssetsChange={(assets) => updateAssetGroup(activeAssetGroup.id, 'images', assets)}
                    />
                  </div>

                  {/* Logos */}
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      Logos * (min 1)
                      {activeAssetGroup.logos.length >= 1 ? (
                        <span className="text-success text-xs">✓ {activeAssetGroup.logos.length} uploaded</span>
                      ) : (
                        <span className="text-danger text-xs">(required)</span>
                      )}
                    </label>
                    <AssetUploader
                      campaignType={campaignType}
                      assetType="LOGO"
                      requiredAspectRatios={['1:1']}
                      maxAssets={5}
                      selectedAssets={activeAssetGroup.logos}
                      onAssetsChange={(assets) => updateAssetGroup(activeAssetGroup.id, 'logos', assets)}
                    />
                  </div>

                  {/* Videos (optional) */}
                  {campaignType !== 'DISPLAY' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Videos (optional)</label>
                      <AssetUploader
                        campaignType={campaignType}
                        assetType="VIDEO"
                        maxAssets={5}
                        selectedAssets={activeAssetGroup.videos}
                        onAssetsChange={(assets) => updateAssetGroup(activeAssetGroup.id, 'videos', assets)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step: Targeting */}
          {currentStep === 'targeting' && (
            <div className="space-y-6 max-w-xl">
              <LocationTargeting
                selected={targetLocations}
                onChange={setTargetLocations}
                mode="both"
              />

              <div>
                <label className="block text-sm font-medium mb-2">Languages</label>
                <select
                  defaultValue="en"
                  className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="pt">Portuguese</option>
                </select>
              </div>

              {/* Audience signals (PMax only) */}
              {campaignType === 'PMAX' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Audience Signals (Optional)</label>
                  <div className="p-4 border border-divider rounded-lg space-y-4">
                    <p className="text-text3 text-sm">
                      Help Google's AI find the right audience by providing signals about your ideal customers.
                    </p>

                    <div>
                      <label className="block text-xs text-text3 mb-1">Search Themes</label>
                      <input
                        type="text"
                        placeholder="e.g., running shoes, fitness gear, athletic wear"
                        className="w-full px-4 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                      />
                    </div>

                    <p className="text-text3 text-xs">
                      More audience options can be configured after campaign creation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Review */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              {/* Ad Preview */}
              {assetGroups[0] && (
                <AdPreviewCard
                  type={campaignType === 'PMAX' ? 'pmax' : campaignType === 'DISPLAY' ? 'display' : 'display'}
                  headlines={assetGroups[0].headlines.filter(h => h.trim())}
                  descriptions={assetGroups[0].descriptions.filter(d => d.trim())}
                  finalUrl={finalUrl}
                  businessName={assetGroups[0].businessName}
                  images={assetGroups[0].images.map(img => img.previewUrl || img.fileUrl || '')}
                  logoUrl={assetGroups[0].logos[0]?.previewUrl || assetGroups[0].logos[0]?.fileUrl}
                />
              )}

              <div className="bg-surface2 rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  {CAMPAIGN_TYPE_INFO[campaignType]?.icon}
                  Campaign Summary
                </h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text3">Campaign Name:</span>
                    <p className="font-medium">{campaignName}</p>
                  </div>
                  <div>
                    <span className="text-text3">Campaign Type:</span>
                    <p className="font-medium">{CAMPAIGN_TYPE_INFO[campaignType]?.title}</p>
                  </div>
                  <div>
                    <span className="text-text3">Daily Budget:</span>
                    <p className="font-medium">${dailyBudget}</p>
                  </div>
                  <div>
                    <span className="text-text3">Bidding Strategy:</span>
                    <p className="font-medium">{BIDDING_STRATEGIES[biddingStrategy]?.label}</p>
                  </div>
                  <div>
                    <span className="text-text3">Landing Page:</span>
                    <p className="font-medium truncate">{finalUrl}</p>
                  </div>
                  <div>
                    <span className="text-text3">Target Locations:</span>
                    <p className="font-medium">{targetLocations.length} locations</p>
                  </div>
                </div>

                {/* Preview Center Link */}
                <div className="mt-4 pt-4 border-t border-divider">
                  <button
                    type="button"
                    onClick={() => {
                      // Store campaign data in sessionStorage for preview center
                      const previewData = {
                        campaignId: `draft-${Date.now()}`,
                        campaignName,
                        campaignType,
                        headlines: assetGroups[0]?.headlines || [],
                        descriptions: assetGroups[0]?.descriptions || [],
                        images: assetGroups[0]?.images.map(img => ({
                          id: img.id,
                          type: 'image',
                          previewUrl: img.previewUrl || img.fileUrl,
                        })) || [],
                        logos: assetGroups[0]?.logos.map(logo => ({
                          id: logo.id,
                          type: 'logo',
                          previewUrl: logo.previewUrl || logo.fileUrl,
                        })) || [],
                        businessName: assetGroups[0]?.businessName || campaignName,
                        finalUrl,
                        displayPath1: assetGroups[0]?.displayPath1,
                        displayPath2: assetGroups[0]?.displayPath2,
                      };
                      sessionStorage.setItem('previewCenterData', JSON.stringify(previewData));
                      window.open('/ad-preview-center?source=wizard', '_blank');
                    }}
                    className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    Open Full Preview Center
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Asset Groups Summary */}
              <div className="bg-surface2 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Asset Groups ({assetGroups.length})</h3>

                {assetGroups.map((group) => (
                  <div key={group.id} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-0 border-divider">
                    <h4 className="font-medium mb-2">{group.name}</h4>

                    {/* Headlines Preview */}
                    <div className="mb-3">
                      <span className="text-xs text-text3 block mb-1">Headlines ({group.headlines.filter(h => h.trim()).length})</span>
                      <div className="flex flex-wrap gap-1">
                        {group.headlines.filter(h => h.trim()).slice(0, 5).map((h, i) => (
                          <span key={i} className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded">
                            {h.length > 25 ? h.slice(0, 25) + '...' : h}
                          </span>
                        ))}
                        {group.headlines.filter(h => h.trim()).length > 5 && (
                          <span className="text-xs text-text3">+{group.headlines.filter(h => h.trim()).length - 5} more</span>
                        )}
                      </div>
                    </div>

                    {/* Descriptions Preview */}
                    <div className="mb-3">
                      <span className="text-xs text-text3 block mb-1">Descriptions ({group.descriptions.filter(d => d.trim()).length})</span>
                      <div className="space-y-1">
                        {group.descriptions.filter(d => d.trim()).slice(0, 2).map((d, i) => (
                          <p key={i} className="text-xs text-text2 line-clamp-1">
                            {d}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Assets Count */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-text3">Images:</span>
                        <p className="font-medium">{group.images.length}</p>
                      </div>
                      <div>
                        <span className="text-text3">Logos:</span>
                        <p className="font-medium">{group.logos.length}</p>
                      </div>
                      <div>
                        <span className="text-text3">Videos:</span>
                        <p className="font-medium">{group.videos.length}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-warning-light text-warning p-4 rounded-lg text-sm">
                <strong>Note:</strong> This campaign will be saved as a draft. You can sync it to Google Ads from the campaigns dashboard.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-divider">
          {/* Validation Errors */}
          {!canProceed && validationErrors.length > 0 && currentStep !== 'type' && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-danger mb-1">Please fix the following:</p>
                  <ul className="text-sm text-danger/80 space-y-0.5">
                    {validationErrors.map((error, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <span className="text-danger">•</span> {error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={currentStepIndex === 0 ? onClose : prevStep}
              className="px-6 py-2 text-text2 hover:text-text transition-colors"
            >
              {currentStepIndex === 0 ? 'Cancel' : 'Back'}
            </button>

            <div className="flex items-center gap-3">
              {currentStep === 'review' ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Campaign'}
                </button>
              ) : currentStep !== 'type' && (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!canProceed}
                  className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VisualCampaignModal;
