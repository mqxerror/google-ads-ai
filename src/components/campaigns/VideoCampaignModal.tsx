'use client';

import React, { useState } from 'react';
import { AssetUploader, type UploadedAsset } from '../shared/AssetUploader';
import { YouTubeAdPreview } from '../ads/previews';
import { UtmBuilder } from '../shared/UtmBuilder';

type VideoAdFormat = 'INSTREAM_SKIPPABLE' | 'INSTREAM_NON_SKIPPABLE' | 'DISCOVERY' | 'BUMPER' | 'SHORTS';

interface VideoCampaignData {
  // Basic Info
  name: string;
  dailyBudget: number;
  biddingStrategy: 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CLICKS' | 'TARGET_CPV' | 'TARGET_CPA';
  targetCpv?: number;
  targetCpa?: number;

  // Ad Details
  adFormat: VideoAdFormat;
  businessName: string;
  finalUrl: string;
  displayUrl?: string;
  callToAction: string;

  // Headlines & Descriptions
  headline: string;
  longHeadline: string;
  description1: string;
  description2?: string;

  // Videos
  youtubeVideoId: string;
  companionBannerUrl?: string;

  // Targeting
  targetLocations: string[];
  targetLanguages: string[];
  targetAudiences?: string[];
}

interface VideoCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (campaign: any) => void;
}

const AD_FORMATS: { id: VideoAdFormat; label: string; description: string; duration: string }[] = [
  {
    id: 'INSTREAM_SKIPPABLE',
    label: 'Skippable In-stream',
    description: 'Plays before, during, or after videos. Viewers can skip after 5 seconds.',
    duration: 'Any length (recommended 15-60s)',
  },
  {
    id: 'INSTREAM_NON_SKIPPABLE',
    label: 'Non-skippable In-stream',
    description: 'Plays before videos and cannot be skipped. Best for awareness.',
    duration: '15 seconds max',
  },
  {
    id: 'BUMPER',
    label: 'Bumper Ads',
    description: 'Short, non-skippable ads that play before videos.',
    duration: '6 seconds max',
  },
  {
    id: 'DISCOVERY',
    label: 'In-feed Video',
    description: 'Appears in YouTube search results, alongside related videos, and on the homepage.',
    duration: 'Any length',
  },
  {
    id: 'SHORTS',
    label: 'YouTube Shorts',
    description: 'Vertical video ads shown between Shorts.',
    duration: '60 seconds max (9:16 aspect)',
  },
];

const CALL_TO_ACTIONS = [
  'Learn More',
  'Shop Now',
  'Sign Up',
  'Book Now',
  'Get Quote',
  'Contact Us',
  'Download',
  'Apply Now',
  'Watch More',
  'Subscribe',
];

export function VideoCampaignModal({ isOpen, onClose, onSuccess }: VideoCampaignModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [videoAssets, setVideoAssets] = useState<UploadedAsset[]>([]);
  const [companionBannerAssets, setCompanionBannerAssets] = useState<UploadedAsset[]>([]);

  const [formData, setFormData] = useState<VideoCampaignData>({
    name: '',
    dailyBudget: 50,
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
    adFormat: 'INSTREAM_SKIPPABLE',
    businessName: '',
    finalUrl: '',
    callToAction: 'Learn More',
    headline: '',
    longHeadline: '',
    description1: '',
    targetLocations: ['2840'], // US
    targetLanguages: ['en'],
    youtubeVideoId: '',
  });

  if (!isOpen) return null;

  const totalSteps = 4;

  const updateField = <K extends keyof VideoCampaignData>(field: K, value: VideoCampaignData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      // Get YouTube video ID from assets
      const youtubeVideoId = videoAssets[0]?.youtubeVideoId || formData.youtubeVideoId;
      if (!youtubeVideoId) {
        throw new Error('Please add a YouTube video');
      }

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          type: 'VIDEO',
          youtubeVideoId,
          companionBannerUrl: companionBannerAssets[0]?.fileUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create campaign');
      }

      const data = await response.json();
      onSuccess?.(data.campaign);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => (
        <React.Fragment key={i}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i + 1 === step
                ? 'bg-accent text-white'
                : i + 1 < step
                ? 'bg-success text-white'
                : 'bg-surface2 text-text3'
            }`}
          >
            {i + 1 < step ? '✓' : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div className={`w-12 h-0.5 ${i + 1 < step ? 'bg-success' : 'bg-surface2'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Choose Video Ad Format</h3>

      <div className="grid gap-3">
        {AD_FORMATS.map((format) => (
          <button
            key={format.id}
            type="button"
            onClick={() => updateField('adFormat', format.id)}
            className={`p-4 rounded-lg border text-left transition-all ${
              formData.adFormat === format.id
                ? 'border-accent bg-accent-light'
                : 'border-divider hover:border-accent'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                formData.adFormat === format.id
                  ? 'border-accent bg-accent'
                  : 'border-text3'
              }`}>
                {formData.adFormat === format.id && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-text">{format.label}</h4>
                <p className="text-sm text-text3 mt-1">{format.description}</p>
                <p className="text-xs text-text3 mt-1">Duration: {format.duration}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Campaign Name & Budget */}
      <div className="pt-4 border-t border-divider space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-2">Campaign Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., Summer Sale YouTube Campaign"
            className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">Daily Budget ($) *</label>
            <input
              type="number"
              value={formData.dailyBudget}
              onChange={(e) => updateField('dailyBudget', Number(e.target.value))}
              min={1}
              step={5}
              className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-2">Bidding Strategy</label>
            <select
              value={formData.biddingStrategy}
              onChange={(e) => updateField('biddingStrategy', e.target.value as any)}
              className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="MAXIMIZE_CONVERSIONS">Maximize Conversions</option>
              <option value="MAXIMIZE_CLICKS">Maximize Clicks</option>
              <option value="TARGET_CPV">Target CPV</option>
              <option value="TARGET_CPA">Target CPA</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Add Your Video</h3>

      {/* YouTube Video */}
      <div>
        <label className="block text-sm font-medium text-text mb-2">YouTube Video *</label>
        <p className="text-sm text-text3 mb-3">
          Add your YouTube video URL. The video must be uploaded to YouTube first.
        </p>
        <AssetUploader
          campaignType="VIDEO"
          assetType="VIDEO"
          selectedAssets={videoAssets}
          onAssetsChange={setVideoAssets}
          maxAssets={1}
          showLibrary={false}
        />
      </div>

      {/* Companion Banner (for in-stream ads) */}
      {(formData.adFormat === 'INSTREAM_SKIPPABLE' || formData.adFormat === 'INSTREAM_NON_SKIPPABLE') && (
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Companion Banner (Optional)
          </label>
          <p className="text-sm text-text3 mb-3">
            300×60 banner shown alongside your video ad on desktop
          </p>
          <AssetUploader
            campaignType="VIDEO"
            assetType="IMAGE"
            selectedAssets={companionBannerAssets}
            onAssetsChange={setCompanionBannerAssets}
            maxAssets={1}
            requiredAspectRatios={['1.91:1']}
            showLibrary={true}
          />
        </div>
      )}

      {/* Business Info */}
      <div className="pt-4 border-t border-divider space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-2">Business Name *</label>
          <input
            type="text"
            value={formData.businessName}
            onChange={(e) => updateField('businessName', e.target.value)}
            placeholder="Your Company Name"
            maxLength={25}
            className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-text3 mt-1">{formData.businessName.length}/25 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Landing Page URL *</label>
          <input
            type="url"
            value={formData.finalUrl}
            onChange={(e) => updateField('finalUrl', e.target.value)}
            placeholder="https://yourwebsite.com/landing-page"
            className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {/* UTM Builder */}
          <UtmBuilder
            baseUrl={formData.finalUrl}
            onUrlChange={(url) => updateField('finalUrl', url)}
            campaignName={formData.name}
            showToggle={true}
            className="mt-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Call to Action</label>
          <select
            value={formData.callToAction}
            onChange={(e) => updateField('callToAction', e.target.value)}
            className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {CALL_TO_ACTIONS.map(cta => (
              <option key={cta} value={cta}>{cta}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Ad Copy</h3>

      <div>
        <label className="block text-sm font-medium text-text mb-2">Headline *</label>
        <input
          type="text"
          value={formData.headline}
          onChange={(e) => updateField('headline', e.target.value)}
          placeholder="Grab attention with a compelling headline"
          maxLength={25}
          className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="text-xs text-text3 mt-1">{formData.headline.length}/25 characters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-2">Long Headline</label>
        <input
          type="text"
          value={formData.longHeadline}
          onChange={(e) => updateField('longHeadline', e.target.value)}
          placeholder="Add more context with a longer headline"
          maxLength={90}
          className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="text-xs text-text3 mt-1">{formData.longHeadline.length}/90 characters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-2">Description *</label>
        <textarea
          value={formData.description1}
          onChange={(e) => updateField('description1', e.target.value)}
          placeholder="Describe your offer and why viewers should take action"
          maxLength={90}
          rows={3}
          className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
        <p className="text-xs text-text3 mt-1">{formData.description1.length}/90 characters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-2">Description 2 (Optional)</label>
        <textarea
          value={formData.description2 || ''}
          onChange={(e) => updateField('description2', e.target.value)}
          placeholder="Additional description text"
          maxLength={90}
          rows={3}
          className="w-full px-4 py-3 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
        <p className="text-xs text-text3 mt-1">{(formData.description2 || '').length}/90 characters</p>
      </div>
    </div>
  );

  const renderStep4 = () => {
    const youtubeVideoId = videoAssets[0]?.youtubeVideoId;

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Review Your Video Ad</h3>

        {/* Preview */}
        <div className="flex justify-center">
          <YouTubeAdPreview
            headline={formData.longHeadline || formData.headline}
            description={formData.description1}
            businessName={formData.businessName}
            youtubeVideoId={youtubeVideoId}
            companionBannerUrl={companionBannerAssets[0]?.fileUrl}
            callToAction={formData.callToAction}
            finalUrl={formData.finalUrl}
            format={
              formData.adFormat === 'DISCOVERY' ? 'discovery' :
              formData.adFormat === 'SHORTS' ? 'shorts' :
              formData.adFormat === 'BUMPER' ? 'bumper' :
              'in-stream'
            }
          />
        </div>

        {/* Summary */}
        <div className="bg-surface2 rounded-lg p-4 space-y-3">
          <h4 className="font-medium">Campaign Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text3">Campaign:</span>
              <span className="ml-2 text-text">{formData.name}</span>
            </div>
            <div>
              <span className="text-text3">Format:</span>
              <span className="ml-2 text-text">
                {AD_FORMATS.find(f => f.id === formData.adFormat)?.label}
              </span>
            </div>
            <div>
              <span className="text-text3">Daily Budget:</span>
              <span className="ml-2 text-text">${formData.dailyBudget}</span>
            </div>
            <div>
              <span className="text-text3">Bidding:</span>
              <span className="ml-2 text-text">{formData.biddingStrategy.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <span className="text-text3">Landing Page:</span>
              <span className="ml-2 text-text truncate">{formData.finalUrl}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-danger-light text-danger rounded-lg">
            {error}
          </div>
        )}
      </div>
    );
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.name && formData.dailyBudget > 0;
      case 2:
        return videoAssets.length > 0 && formData.businessName && formData.finalUrl;
      case 3:
        return formData.headline && formData.description1;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Create YouTube Video Campaign</h2>
            <p className="text-sm text-text3">Step {step} of {totalSteps}</p>
          </div>
          <button onClick={onClose} className="text-text3 hover:text-text p-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepIndicator()}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-divider flex justify-between">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="px-4 py-2 text-text3 hover:text-text transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Campaign'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoCampaignModal;
