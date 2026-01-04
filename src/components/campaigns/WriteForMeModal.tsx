'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  AdGenerationContext,
  WriteForMeModalProps,
  MAX_HEADLINES,
  MIN_HEADLINES,
  MAX_DESCRIPTIONS,
  MIN_DESCRIPTIONS,
  HEADLINE_MAX_LENGTH,
} from '@/types/ad-generation';
import { runQualityChecks, generateRecommendations } from '@/lib/ad-copy-utils';
import AIContextForm from './ad-editor/AIContextForm';
import AdFieldInput from './ad-editor/AdFieldInput';
import DKIInsertButton from './ad-editor/DKIInsertButton';
import RecommendationsPanel from './ad-editor/RecommendationsPanel';
import AdPreview from './ad-editor/AdPreview';

const defaultContext: AdGenerationContext = {
  companyName: '',
  productOffering: '',
  keyStatistics: [],
  keyBenefits: [],
  targetKeywords: [],
  language: 'en',
  finalUrl: '',
  pathField1: '',
  pathField2: '',
};

export default function WriteForMeModal({
  isOpen,
  onClose,
  onApply,
  initialContext,
  initialHeadlines,
  initialDescriptions,
  initialPaths,
}: WriteForMeModalProps) {
  // State
  const [activeTab, setActiveTab] = useState<'inputs' | 'advanced'>('inputs');
  const [context, setContext] = useState<AdGenerationContext>(() => ({
    ...defaultContext,
    ...initialContext,
  }));
  const [headlines, setHeadlines] = useState<string[]>(() =>
    initialHeadlines?.length ? [...initialHeadlines, ...Array(MAX_HEADLINES - initialHeadlines.length).fill('')].slice(0, MAX_HEADLINES) : Array(MAX_HEADLINES).fill('')
  );
  const [descriptions, setDescriptions] = useState<string[]>(() =>
    initialDescriptions?.length ? [...initialDescriptions, ...Array(MAX_DESCRIPTIONS - initialDescriptions.length).fill('')].slice(0, MAX_DESCRIPTIONS) : Array(MAX_DESCRIPTIONS).fill('')
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<{ type: 'headline' | 'description'; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedHeadlineIndex, setSelectedHeadlineIndex] = useState<number | null>(null);

  // Initialize paths from props
  useEffect(() => {
    if (initialPaths) {
      setContext((prev) => ({
        ...prev,
        pathField1: initialPaths.path1 || '',
        pathField2: initialPaths.path2 || '',
      }));
    }
  }, [initialPaths]);

  // Quality recommendations
  const recommendations = useMemo(() => {
    const checks = runQualityChecks(headlines, descriptions, {
      path1: context.pathField1 || '',
      path2: context.pathField2 || '',
    });
    return generateRecommendations(checks);
  }, [headlines, descriptions, context.pathField1, context.pathField2]);

  // Handlers
  const handleContextChange = useCallback((updates: Partial<AdGenerationContext>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleHeadlineChange = useCallback((index: number, value: string) => {
    setHeadlines((prev) => prev.map((h, i) => (i === index ? value : h)));
  }, []);

  const handleDescriptionChange = useCallback((index: number, value: string) => {
    setDescriptions((prev) => prev.map((d, i) => (i === index ? value : d)));
  }, []);

  const handleDeleteHeadline = useCallback((index: number) => {
    setHeadlines((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      // Ensure we maintain the max headlines array size
      return [...filtered, ...Array(MAX_HEADLINES - filtered.length).fill('')].slice(0, MAX_HEADLINES);
    });
  }, []);

  const handleDeleteDescription = useCallback((index: number) => {
    setDescriptions((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return [...filtered, ...Array(MAX_DESCRIPTIONS - filtered.length).fill('')].slice(0, MAX_DESCRIPTIONS);
    });
  }, []);

  const handleDKIInsert = useCallback((dkiToken: string) => {
    if (selectedHeadlineIndex !== null) {
      setHeadlines((prev) =>
        prev.map((h, i) => (i === selectedHeadlineIndex ? h + dkiToken : h))
      );
      setSelectedHeadlineIndex(null);
    }
  }, [selectedHeadlineIndex]);

  const handleGenerate = async () => {
    if (!context.companyName.trim() || !context.productOffering.trim()) {
      setError('Company name and product/service are required');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/campaigns/wizard/generate-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adGroups: [
            {
              id: 'standalone',
              name: context.companyName,
              keywords: context.targetKeywords.map((kw) => ({ keyword: kw })),
            },
          ],
          campaignType: 'SEARCH',
          goal: 'LEADS',
          landingPageUrl: context.finalUrl,
          context: {
            companyName: context.companyName,
            productOffering: context.productOffering,
            keyStatistics: context.keyStatistics,
            keyBenefits: context.keyBenefits,
            targetKeywords: context.targetKeywords,
            language: context.language,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate ad copy');
      }

      const data = await response.json();
      const generatedAd = data.ads?.[0];

      if (generatedAd) {
        // Fill headlines array (pad with empty strings if needed)
        const newHeadlines = [...(generatedAd.headlines || []), ...Array(MAX_HEADLINES).fill('')].slice(0, MAX_HEADLINES);
        setHeadlines(newHeadlines);

        // Fill descriptions array
        const newDescriptions = [...(generatedAd.descriptions || []), ...Array(MAX_DESCRIPTIONS).fill('')].slice(0, MAX_DESCRIPTIONS);
        setDescriptions(newDescriptions);

        // Set suggested paths if available
        if (generatedAd.suggestedPaths) {
          setContext((prev) => ({
            ...prev,
            pathField1: generatedAd.suggestedPaths.path1 || prev.pathField1,
            pathField2: generatedAd.suggestedPaths.path2 || prev.pathField2,
          }));
        }
      }
    } catch (err) {
      console.error('Error generating ads:', err);
      setError('Failed to generate ad copy. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateSingle = async (type: 'headline' | 'description', index: number) => {
    setRegeneratingIndex({ type, index });

    try {
      const response = await fetch('/api/campaigns/wizard/regenerate-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldType: type,
          fieldIndex: index,
          existingFields: type === 'headline' ? headlines : descriptions,
          context: {
            companyName: context.companyName,
            productOffering: context.productOffering,
            keyStatistics: context.keyStatistics,
            keyBenefits: context.keyBenefits,
            targetKeywords: context.targetKeywords,
            language: context.language,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate');
      }

      const data = await response.json();

      if (data.newValue) {
        if (type === 'headline') {
          handleHeadlineChange(index, data.newValue);
        } else {
          handleDescriptionChange(index, data.newValue);
        }
      }
    } catch (err) {
      console.error('Error regenerating:', err);
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleApply = () => {
    const filledHeadlines = headlines.filter((h) => h.trim());
    const filledDescriptions = descriptions.filter((d) => d.trim());

    if (filledHeadlines.length < MIN_HEADLINES) {
      setError(`Please add at least ${MIN_HEADLINES} headlines`);
      return;
    }

    if (filledDescriptions.length < MIN_DESCRIPTIONS) {
      setError(`Please add at least ${MIN_DESCRIPTIONS} descriptions`);
      return;
    }

    onApply({
      headlines: filledHeadlines,
      descriptions: filledDescriptions,
      paths: {
        path1: context.pathField1 || '',
        path2: context.pathField2 || '',
      },
      context,
    });
    onClose();
  };

  const filledHeadlinesCount = headlines.filter((h) => h.trim()).length;
  const filledDescriptionsCount = descriptions.filter((d) => d.trim()).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider">
          <div>
            <h2 className="text-xl font-semibold text-text">Write for me (AI)</h2>
            <p className="text-sm text-text3 mt-0.5">Generate compelling ad copy with AI assistance</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text3 hover:text-text hover:bg-surface2 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2 border-b border-divider">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('inputs')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'inputs'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text3 hover:text-text'
              }`}
            >
              Ad Inputs
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'advanced'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text3 hover:text-text'
              }`}
            >
              Advanced Prompt Customization (optional)
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - AI Context Form */}
          <div className="w-80 flex-shrink-0 border-r border-divider overflow-y-auto p-4">
            {activeTab === 'inputs' ? (
              <AIContextForm
                context={context}
                onChange={handleContextChange}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-text3">
                  Advanced prompt customization allows you to fine-tune how the AI generates your ad copy.
                </p>
                <div>
                  <label className="block text-xs font-medium text-text2 mb-1.5">Custom Instructions</label>
                  <textarea
                    placeholder="e.g., Focus on luxury and exclusivity. Use formal tone. Emphasize premium quality..."
                    rows={6}
                    className="w-full px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text2 mb-1.5">Avoid These Words/Phrases</label>
                  <textarea
                    placeholder="e.g., cheap, discount, budget..."
                    rows={3}
                    className="w-full px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Ad Copy Editor */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 gap-4 h-full">
              {/* Headlines & Descriptions Column */}
              <div className="col-span-2 space-y-6">
                {/* Error display */}
                {error && (
                  <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
                    {error}
                  </div>
                )}

                {/* Headlines Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-text">Headlines</h3>
                      <p className="text-xs text-text3 mt-0.5">
                        {filledHeadlinesCount} of {MAX_HEADLINES} (min {MIN_HEADLINES}, max 30 chars each)
                      </p>
                    </div>
                    <DKIInsertButton
                      onInsert={handleDKIInsert}
                      disabled={selectedHeadlineIndex === null}
                      maxFallbackLength={HEADLINE_MAX_LENGTH - 10}
                    />
                  </div>

                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
                    {headlines.map((headline, index) => (
                      <div key={index} onFocus={() => setSelectedHeadlineIndex(index)}>
                        <AdFieldInput
                          index={index}
                          value={headline}
                          type="headline"
                          onChange={(value) => handleHeadlineChange(index, value)}
                          onDelete={() => handleDeleteHeadline(index)}
                          onRegenerate={() => handleRegenerateSingle('headline', index)}
                          canDelete={filledHeadlinesCount > MIN_HEADLINES}
                          isRegenerating={regeneratingIndex?.type === 'headline' && regeneratingIndex?.index === index}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Descriptions Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-text">Descriptions</h3>
                      <p className="text-xs text-text3 mt-0.5">
                        {filledDescriptionsCount} of {MAX_DESCRIPTIONS} (min {MIN_DESCRIPTIONS}, max 90 chars each)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {descriptions.map((description, index) => (
                      <AdFieldInput
                        key={index}
                        index={index}
                        value={description}
                        type="description"
                        onChange={(value) => handleDescriptionChange(index, value)}
                        onDelete={() => handleDeleteDescription(index)}
                        onRegenerate={() => handleRegenerateSingle('description', index)}
                        canDelete={filledDescriptionsCount > MIN_DESCRIPTIONS}
                        isRegenerating={regeneratingIndex?.type === 'description' && regeneratingIndex?.index === index}
                      />
                    ))}
                  </div>
                </div>

                {/* Ad Preview */}
                <AdPreview
                  headlines={headlines}
                  descriptions={descriptions}
                  finalUrl={context.finalUrl || 'example.com'}
                  path1={context.pathField1}
                  path2={context.pathField2}
                />
              </div>

              {/* Recommendations Column */}
              <div className="col-span-1">
                <RecommendationsPanel recommendations={recommendations} totalChecks={10} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-divider flex items-center justify-between">
          <p className="text-xs text-text3">
            Power words have shown to increase attention and CTR.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-surface2 text-text font-medium rounded-lg hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={filledHeadlinesCount < MIN_HEADLINES || filledDescriptionsCount < MIN_DESCRIPTIONS}
              className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply to Ad Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
