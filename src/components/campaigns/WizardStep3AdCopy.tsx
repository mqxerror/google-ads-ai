'use client';

import { useState, useEffect } from 'react';

interface AdCopy {
  adGroupId: string;
  headlines: string[];
  descriptions: string[];
}

interface WizardStep3Props {
  data: any;
  onUpdate: (updates: any) => void;
  setIsProcessing: (processing: boolean) => void;
}

const HEADLINE_MAX_LENGTH = 30;
const DESCRIPTION_MAX_LENGTH = 90;
const MIN_HEADLINES = 3;
const MAX_HEADLINES = 15;
const MIN_DESCRIPTIONS = 2;
const MAX_DESCRIPTIONS = 4;

export default function WizardStep3AdCopy({ data, onUpdate, setIsProcessing }: WizardStep3Props) {
  const [ads, setAds] = useState<AdCopy[]>(data.ads || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAdGroupId, setSelectedAdGroupId] = useState<string | null>(null);

  // Auto-generate ads on first load if no ads exist
  useEffect(() => {
    if (ads.length === 0 && data.adGroups?.length > 0 && !isGenerating) {
      handleGenerateAds();
    } else if (ads.length > 0 && !selectedAdGroupId) {
      setSelectedAdGroupId(ads[0].adGroupId);
    }
  }, []);

  const handleGenerateAds = async () => {
    if (!data.adGroups || data.adGroups.length === 0) {
      setError('No ad groups found. Please go back to Step 2.');
      return;
    }

    setIsGenerating(true);
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/campaigns/wizard/generate-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adGroups: data.adGroups,
          campaignType: data.campaignType,
          goal: data.goal,
          landingPageUrl: data.landingPageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate ad copy');
      }

      const { ads: generatedAds } = await response.json();
      setAds(generatedAds);
      onUpdate({ ads: generatedAds });

      if (generatedAds.length > 0) {
        setSelectedAdGroupId(generatedAds[0].adGroupId);
      }
    } catch (err) {
      console.error('Error generating ads:', err);
      setError('Failed to generate ad copy. Please try again.');
    } finally {
      setIsGenerating(false);
      setIsProcessing(false);
    }
  };

  const updateHeadline = (adGroupId: string, index: number, value: string) => {
    const updatedAds = ads.map((ad) =>
      ad.adGroupId === adGroupId
        ? {
            ...ad,
            headlines: ad.headlines.map((h, i) => (i === index ? value : h)),
          }
        : ad
    );
    setAds(updatedAds);
    onUpdate({ ads: updatedAds });
  };

  const updateDescription = (adGroupId: string, index: number, value: string) => {
    const updatedAds = ads.map((ad) =>
      ad.adGroupId === adGroupId
        ? {
            ...ad,
            descriptions: ad.descriptions.map((d, i) => (i === index ? value : d)),
          }
        : ad
    );
    setAds(updatedAds);
    onUpdate({ ads: updatedAds });
  };

  const addHeadline = (adGroupId: string) => {
    const updatedAds = ads.map((ad) =>
      ad.adGroupId === adGroupId && ad.headlines.length < MAX_HEADLINES
        ? { ...ad, headlines: [...ad.headlines, ''] }
        : ad
    );
    setAds(updatedAds);
    onUpdate({ ads: updatedAds });
  };

  const removeHeadline = (adGroupId: string, index: number) => {
    const updatedAds = ads.map((ad) =>
      ad.adGroupId === adGroupId && ad.headlines.length > MIN_HEADLINES
        ? { ...ad, headlines: ad.headlines.filter((_, i) => i !== index) }
        : ad
    );
    setAds(updatedAds);
    onUpdate({ ads: updatedAds });
  };

  const addDescription = (adGroupId: string) => {
    const updatedAds = ads.map((ad) =>
      ad.adGroupId === adGroupId && ad.descriptions.length < MAX_DESCRIPTIONS
        ? { ...ad, descriptions: [...ad.descriptions, ''] }
        : ad
    );
    setAds(updatedAds);
    onUpdate({ ads: updatedAds });
  };

  const removeDescription = (adGroupId: string, index: number) => {
    const updatedAds = ads.map((ad) =>
      ad.adGroupId === adGroupId && ad.descriptions.length > MIN_DESCRIPTIONS
        ? { ...ad, descriptions: ad.descriptions.filter((_, i) => i !== index) }
        : ad
    );
    setAds(updatedAds);
    onUpdate({ ads: updatedAds });
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full mb-4" />
        <h3 className="text-lg font-medium text-text mb-2">Generating ad copy...</h3>
        <p className="text-sm text-text3">
          Using AI to create compelling headlines and descriptions for {data.adGroups?.length || 0} ad groups
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="text-lg font-medium text-danger mb-2">Error</h3>
        <p className="text-sm text-text3 mb-4">{error}</p>
        <button
          onClick={handleGenerateAds}
          className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">✍️</div>
        <h3 className="text-lg font-medium text-text mb-2">No ad copy yet</h3>
        <p className="text-sm text-text3 mb-6">Generate AI-powered ad copy for all ad groups</p>
        <button
          onClick={handleGenerateAds}
          className="px-8 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
        >
          Generate Ad Copy
        </button>
      </div>
    );
  }

  const currentAd = ads.find((ad) => ad.adGroupId === selectedAdGroupId);
  const currentAdGroup = data.adGroups?.find((g: any) => g.id === selectedAdGroupId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text">Ad Copy</h3>
          <p className="text-sm text-text3 mt-1">
            Create compelling headlines and descriptions for each ad group
          </p>
        </div>
        <button
          onClick={handleGenerateAds}
          className="px-4 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text hover:bg-surface transition-colors"
        >
          ↻ Regenerate All
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Ad Groups Sidebar */}
        <div className="col-span-1 space-y-2">
          <div className="text-xs font-medium text-text3 mb-3">AD GROUPS</div>
          {ads.map((ad) => {
            const adGroup = data.adGroups?.find((g: any) => g.id === ad.adGroupId);
            const isSelected = selectedAdGroupId === ad.adGroupId;
            const isComplete =
              ad.headlines.length >= MIN_HEADLINES &&
              ad.descriptions.length >= MIN_DESCRIPTIONS &&
              ad.headlines.every((h) => h.length > 0 && h.length <= HEADLINE_MAX_LENGTH) &&
              ad.descriptions.every((d) => d.length > 0 && d.length <= DESCRIPTION_MAX_LENGTH);

            return (
              <button
                key={ad.adGroupId}
                onClick={() => setSelectedAdGroupId(ad.adGroupId)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-accent/10 border-accent text-text'
                    : 'bg-surface2 border-divider text-text3 hover:border-accent/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium truncate">{adGroup?.name || 'Ad Group'}</div>
                    <div className="text-xs text-text3 mt-0.5">
                      {ad.headlines.length} headlines, {ad.descriptions.length} descriptions
                    </div>
                  </div>
                  {isComplete && (
                    <div className="ml-2 text-success">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Ad Copy Editor */}
        <div className="col-span-3 space-y-6">
          {currentAd && currentAdGroup && (
            <>
              {/* Ad Group Header */}
              <div className="bg-surface2 border border-divider rounded-lg p-4">
                <h4 className="font-medium text-text">{currentAdGroup.name}</h4>
                <p className="text-xs text-text3 mt-1">
                  {currentAdGroup.keywords.length} keywords · Editing ad copy for this group
                </p>
              </div>

              {/* Headlines */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-text">Headlines</h4>
                    <p className="text-xs text-text3 mt-0.5">
                      {currentAd.headlines.length} of {MAX_HEADLINES} (min {MIN_HEADLINES}, max 30 characters each)
                    </p>
                  </div>
                  {currentAd.headlines.length < MAX_HEADLINES && (
                    <button
                      onClick={() => addHeadline(currentAd.adGroupId)}
                      className="px-3 py-1.5 bg-surface2 border border-divider rounded text-xs text-text hover:bg-surface transition-colors"
                    >
                      + Add Headline
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {currentAd.headlines.map((headline, index) => {
                    const charCount = headline.length;
                    const isOverLimit = charCount > HEADLINE_MAX_LENGTH;

                    return (
                      <div key={index} className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="relative">
                            <input
                              type="text"
                              value={headline}
                              onChange={(e) => updateHeadline(currentAd.adGroupId, index, e.target.value)}
                              placeholder={`Headline ${index + 1}`}
                              className={`w-full px-4 py-3 bg-surface2 border rounded-lg text-text placeholder-text3 focus:outline-none focus:ring-2 transition-all ${
                                isOverLimit
                                  ? 'border-danger focus:ring-danger'
                                  : 'border-divider focus:ring-accent focus:border-transparent'
                              }`}
                            />
                            <div
                              className={`absolute right-3 top-3 text-xs font-medium ${
                                isOverLimit ? 'text-danger' : charCount > 25 ? 'text-warning' : 'text-text3'
                              }`}
                            >
                              {charCount}/{HEADLINE_MAX_LENGTH}
                            </div>
                          </div>
                        </div>
                        {currentAd.headlines.length > MIN_HEADLINES && (
                          <button
                            onClick={() => removeHeadline(currentAd.adGroupId, index)}
                            className="mt-3 text-text3 hover:text-danger transition-colors"
                            title="Remove headline"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Descriptions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-text">Descriptions</h4>
                    <p className="text-xs text-text3 mt-0.5">
                      {currentAd.descriptions.length} of {MAX_DESCRIPTIONS} (min {MIN_DESCRIPTIONS}, max 90 characters
                      each)
                    </p>
                  </div>
                  {currentAd.descriptions.length < MAX_DESCRIPTIONS && (
                    <button
                      onClick={() => addDescription(currentAd.adGroupId)}
                      className="px-3 py-1.5 bg-surface2 border border-divider rounded text-xs text-text hover:bg-surface transition-colors"
                    >
                      + Add Description
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {currentAd.descriptions.map((description, index) => {
                    const charCount = description.length;
                    const isOverLimit = charCount > DESCRIPTION_MAX_LENGTH;

                    return (
                      <div key={index} className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="relative">
                            <textarea
                              value={description}
                              onChange={(e) => updateDescription(currentAd.adGroupId, index, e.target.value)}
                              placeholder={`Description ${index + 1}`}
                              rows={2}
                              className={`w-full px-4 py-3 bg-surface2 border rounded-lg text-text placeholder-text3 focus:outline-none focus:ring-2 transition-all resize-none ${
                                isOverLimit
                                  ? 'border-danger focus:ring-danger'
                                  : 'border-divider focus:ring-accent focus:border-transparent'
                              }`}
                            />
                            <div
                              className={`absolute right-3 bottom-3 text-xs font-medium ${
                                isOverLimit ? 'text-danger' : charCount > 80 ? 'text-warning' : 'text-text3'
                              }`}
                            >
                              {charCount}/{DESCRIPTION_MAX_LENGTH}
                            </div>
                          </div>
                        </div>
                        {currentAd.descriptions.length > MIN_DESCRIPTIONS && (
                          <button
                            onClick={() => removeDescription(currentAd.adGroupId, index)}
                            className="mt-3 text-text3 hover:text-danger transition-colors"
                            title="Remove description"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ad Preview */}
              <div className="bg-surface2 border border-divider rounded-lg p-4">
                <h4 className="text-sm font-medium text-text mb-3">Preview</h4>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white text-sm font-bold">
                      Ad
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-green-700 mb-1">Sponsored</div>
                      <div className="text-blue-700 text-lg font-medium hover:underline cursor-pointer">
                        {currentAd.headlines[0] || 'Headline 1'} |{' '}
                        {currentAd.headlines[1] || 'Headline 2'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">example.com</div>
                      <div className="text-sm text-gray-800 mt-2">
                        {currentAd.descriptions[0] || 'Description 1'}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-text3 mt-2">
                  Google will automatically test different headline and description combinations
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <h4 className="font-medium text-text text-sm mb-1">Ad Copy Best Practices</h4>
            <ul className="text-xs text-text3 space-y-1">
              <li>• Include your main keyword in at least 2 headlines</li>
              <li>• Add a clear call-to-action (CTA) in at least 1 headline</li>
              <li>• Use numbers or special offers to stand out</li>
              <li>• Make sure descriptions provide unique value propositions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
