'use client';

import { useState, useEffect } from 'react';
import WriteForMeModal from './WriteForMeModal';
import { AdGenerationContext, MAX_HEADLINES, MAX_DESCRIPTIONS, MIN_HEADLINES, MIN_DESCRIPTIONS, HEADLINE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/types/ad-generation';

interface AdCopy {
  adGroupId: string;
  headlines: string[];
  descriptions: string[];
  paths?: { path1: string; path2: string };
  context?: AdGenerationContext;
}

interface GlobalContext {
  companyName: string;
  productOffering: string;
  keyStatistics: string[];
  keyBenefits: string[];
  sellingTactics: string[];
  language: string;
}

interface IntelligenceProject {
  id: string;
  name: string;
  brandName: string;
  unifiedReportStatus: string;
  brandDnaStatus: string;
}

interface WizardStep3Props {
  data: any;
  onUpdate: (updates: any) => void;
  setIsProcessing: (processing: boolean) => void;
}

export default function WizardStep3AdCopy({ data, onUpdate, setIsProcessing }: WizardStep3Props) {
  const [ads, setAds] = useState<AdCopy[]>(data.ads || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAdGroupId, setSelectedAdGroupId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showGlobalContext, setShowGlobalContext] = useState(false);
  const [globalContext, setGlobalContext] = useState<GlobalContext>({
    companyName: data.campaignName || '',
    productOffering: '',
    keyStatistics: [],
    keyBenefits: [],
    sellingTactics: [],
    language: 'en',
  });
  const [newStatistic, setNewStatistic] = useState('');
  const [newBenefit, setNewBenefit] = useState('');
  const [newTactic, setNewTactic] = useState('');
  const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
  const [intelligenceProjects, setIntelligenceProjects] = useState<IntelligenceProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  // Suggested tactics for quick selection
  const SUGGESTED_TACTICS = [
    'Urgency (Limited Time)',
    'Social Proof',
    'Discount/Savings',
    'Free Trial/Demo',
    'Money-Back Guarantee',
    'Expert/Authority',
    'Exclusivity',
    'Compare to Competitors',
  ];

  // Fetch Intelligence Projects when modal opens
  useEffect(() => {
    if (showIntelligenceModal && intelligenceProjects.length === 0) {
      setIsLoadingProjects(true);
      fetch('/api/intelligence')
        .then(res => res.json())
        .then(data => {
          if (data.projects) {
            setIntelligenceProjects(data.projects.filter((p: IntelligenceProject) =>
              p.brandDnaStatus === 'completed'
            ));
          }
        })
        .catch(err => console.error('Failed to fetch intelligence projects:', err))
        .finally(() => setIsLoadingProjects(false));
    }
  }, [showIntelligenceModal]);

  // Load context from Intelligence Report
  const loadFromIntelligence = async (projectId: string) => {
    setLoadingReportId(projectId);
    try {
      const res = await fetch(`/api/intelligence/${projectId}`);
      const data = await res.json();

      if (data.project && data.brandDna) {
        const brandDna = data.brandDna;
        const personas = data.audienceDna || [];

        // Extract benefits from brand DNA
        const benefits: string[] = [];
        if (brandDna.uniqueDifferentiators) {
          benefits.push(...brandDna.uniqueDifferentiators.slice(0, 3));
        }
        if (brandDna.brandValues) {
          benefits.push(...brandDna.brandValues.slice(0, 2).map((v: any) => v.value || v));
        }

        // Extract pain points and motivations from personas
        const personaBenefits: string[] = [];
        personas.slice(0, 2).forEach((persona: any) => {
          if (persona.purchaseMotivations) {
            personaBenefits.push(...persona.purchaseMotivations.slice(0, 2));
          }
        });

        // Update global context with intelligence data
        setGlobalContext(prev => ({
          ...prev,
          companyName: data.project.brandName || prev.companyName,
          productOffering: brandDna.brandPositioning || prev.productOffering,
          keyBenefits: [...benefits, ...personaBenefits].slice(0, 5),
          keyStatistics: brandDna.keyMilestones?.slice(0, 3) || [],
        }));

        setShowIntelligenceModal(false);
      }
    } catch (error) {
      console.error('Failed to load intelligence data:', error);
    } finally {
      setLoadingReportId(null);
    }
  };

  // Auto-generate ads on first load if no ads exist
  useEffect(() => {
    if (ads.length === 0 && data.adGroups?.length > 0 && !isGenerating) {
      // Initialize empty ads for each group
      const initialAds = data.adGroups.map((group: any) => ({
        adGroupId: group.id,
        headlines: [],
        descriptions: [],
      }));
      setAds(initialAds);
      onUpdate({ ads: initialAds });
      if (initialAds.length > 0) {
        setSelectedAdGroupId(initialAds[0].adGroupId);
      }
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
      // Build context from global inputs - combine benefits and tactics
      const context = {
        companyName: globalContext.companyName || data.campaignName || '',
        productOffering: globalContext.productOffering || '',
        keyStatistics: globalContext.keyStatistics,
        keyBenefits: [
          ...globalContext.keyBenefits,
          ...globalContext.sellingTactics.map(t => `Use ${t} tactic`),
        ],
        targetKeywords: [], // Will be filled per ad group
        language: globalContext.language || 'en',
      };

      const response = await fetch('/api/campaigns/wizard/generate-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adGroups: data.adGroups,
          campaignType: data.campaignType,
          goal: data.goal,
          landingPageUrl: data.landingPageUrl,
          context: context.companyName ? context : undefined, // Only send if we have context
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

  // Helper functions for multi-value inputs
  const addStatistic = () => {
    if (newStatistic.trim()) {
      setGlobalContext(prev => ({
        ...prev,
        keyStatistics: [...prev.keyStatistics, newStatistic.trim()],
      }));
      setNewStatistic('');
    }
  };

  const removeStatistic = (index: number) => {
    setGlobalContext(prev => ({
      ...prev,
      keyStatistics: prev.keyStatistics.filter((_, i) => i !== index),
    }));
  };

  const addBenefit = () => {
    if (newBenefit.trim()) {
      setGlobalContext(prev => ({
        ...prev,
        keyBenefits: [...prev.keyBenefits, newBenefit.trim()],
      }));
      setNewBenefit('');
    }
  };

  const removeBenefit = (index: number) => {
    setGlobalContext(prev => ({
      ...prev,
      keyBenefits: prev.keyBenefits.filter((_, i) => i !== index),
    }));
  };

  const toggleTactic = (tactic: string) => {
    setGlobalContext(prev => ({
      ...prev,
      sellingTactics: prev.sellingTactics.includes(tactic)
        ? prev.sellingTactics.filter(t => t !== tactic)
        : [...prev.sellingTactics, tactic],
    }));
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

  // Handle modal apply - updates the selected ad group
  const handleModalApply = (modalData: {
    headlines: string[];
    descriptions: string[];
    paths: { path1: string; path2: string };
    context: AdGenerationContext;
  }) => {
    if (!selectedAdGroupId) return;

    const updatedAds = ads.map((ad) =>
      ad.adGroupId === selectedAdGroupId
        ? {
            ...ad,
            headlines: modalData.headlines,
            descriptions: modalData.descriptions,
            paths: modalData.paths,
            context: modalData.context,
          }
        : ad
    );
    setAds(updatedAds);
    onUpdate({ ads: updatedAds });
  };

  // Get initial context for the modal based on selected ad group (with global context fallback)
  const getInitialContext = (): Partial<AdGenerationContext> => {
    const currentAdGroup = data.adGroups?.find((g: any) => g.id === selectedAdGroupId);
    const currentAd = ads.find((ad) => ad.adGroupId === selectedAdGroupId);

    return {
      companyName: currentAd?.context?.companyName || globalContext.companyName || data.campaignName || '',
      productOffering: currentAd?.context?.productOffering || globalContext.productOffering || '',
      keyStatistics: currentAd?.context?.keyStatistics || globalContext.keyStatistics || [],
      keyBenefits: currentAd?.context?.keyBenefits || [
        ...globalContext.keyBenefits,
        ...globalContext.sellingTactics.map(t => `Use ${t} tactic`),
      ],
      targetKeywords: currentAdGroup?.keywords?.map((kw: any) => kw.keyword) || [],
      language: 'en',
      finalUrl: data.landingPageUrl || '',
      pathField1: currentAd?.paths?.path1 || '',
      pathField2: currentAd?.paths?.path2 || '',
    };
  };

  const currentAd = ads.find((ad) => ad.adGroupId === selectedAdGroupId);
  const currentAdGroup = data.adGroups?.find((g: any) => g.id === selectedAdGroupId);

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
        <div className="text-3xl mb-3">Warning</div>
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

  return (
    <div className="space-y-6">
      {/* Global Context Panel - Collapsible */}
      <div className="bg-gradient-to-r from-accent/5 to-accent/10 border border-accent/20 rounded-xl overflow-hidden">
        <div className="w-full px-5 py-4 flex items-center justify-between">
          {/* Clickable left section for collapse/expand */}
          <button
            type="button"
            onClick={() => setShowGlobalContext(!showGlobalContext)}
            className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity flex-1"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-text">AI Generation Context</h4>
              <p className="text-xs text-text3 mt-0.5">
                {globalContext.companyName || globalContext.keyBenefits.length > 0 || globalContext.sellingTactics.length > 0
                  ? `${globalContext.companyName ? globalContext.companyName + ' • ' : ''}${globalContext.keyBenefits.length} benefits • ${globalContext.sellingTactics.length} tactics`
                  : 'Add company info, benefits & tactics for better ad copy'
                }
              </p>
            </div>
          </button>
          {/* Right section with separate buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowIntelligenceModal(true)}
              className="px-3 py-1.5 bg-success/10 text-success text-xs font-medium rounded-lg hover:bg-success/20 transition-colors flex items-center gap-1.5"
              title="Load from Intelligence Report"
            >
              <span>🧠</span>
              <span>Use Report</span>
            </button>
            <button
              type="button"
              onClick={() => setShowGlobalContext(!showGlobalContext)}
              className="p-1 hover:bg-accent/10 rounded transition-colors"
            >
              <svg className={`w-5 h-5 text-text3 transition-transform ${showGlobalContext ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {showGlobalContext && (
          <div className="px-5 pb-5 space-y-5 border-t border-accent/10">
            {/* Row 1: Company & Product */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-text2 mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={globalContext.companyName}
                  onChange={(e) => setGlobalContext(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="e.g., Quick Ads AI"
                  className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text2 mb-1.5">Product/Service</label>
                <input
                  type="text"
                  value={globalContext.productOffering}
                  onChange={(e) => setGlobalContext(prev => ({ ...prev, productOffering: e.target.value }))}
                  placeholder="e.g., Google Ads Management Platform"
                  className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            {/* Row 2: Key Statistics */}
            <div>
              <label className="block text-xs font-medium text-text2 mb-1.5">
                Key Statistics <span className="text-text3 font-normal">(numbers that impress)</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newStatistic}
                  onChange={(e) => setNewStatistic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addStatistic()}
                  placeholder="e.g., 10,000+ Customers, 50% Cost Savings"
                  className="flex-1 px-3 py-2 bg-surface border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  onClick={addStatistic}
                  className="px-3 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 transition-colors"
                >
                  Add
                </button>
              </div>
              {globalContext.keyStatistics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {globalContext.keyStatistics.map((stat, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-divider rounded-full text-xs text-text">
                      📊 {stat}
                      <button onClick={() => removeStatistic(idx)} className="text-text3 hover:text-danger">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Row 3: Key Benefits */}
            <div>
              <label className="block text-xs font-medium text-text2 mb-1.5">
                Key Benefits <span className="text-text3 font-normal">(what customers get)</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newBenefit}
                  onChange={(e) => setNewBenefit(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBenefit()}
                  placeholder="e.g., Save Time, Increase ROI, 24/7 Support"
                  className="flex-1 px-3 py-2 bg-surface border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  onClick={addBenefit}
                  className="px-3 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 transition-colors"
                >
                  Add
                </button>
              </div>
              {globalContext.keyBenefits.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {globalContext.keyBenefits.map((benefit, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-full text-xs text-success">
                      ✓ {benefit}
                      <button onClick={() => removeBenefit(idx)} className="text-success/60 hover:text-danger">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Row 4: Selling Tactics (Quick Select) */}
            <div>
              <label className="block text-xs font-medium text-text2 mb-1.5">
                Selling Tactics <span className="text-text3 font-normal">(click to toggle)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TACTICS.map((tactic) => {
                  const isSelected = globalContext.sellingTactics.includes(tactic);
                  return (
                    <button
                      key={tactic}
                      onClick={() => toggleTactic(tactic)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-accent text-white'
                          : 'bg-surface border border-divider text-text2 hover:border-accent/50'
                      }`}
                    >
                      {tactic}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hint */}
            <div className="flex items-start gap-2 p-3 bg-surface rounded-lg">
              <svg className="w-4 h-4 text-accent mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-text3">
                This context will be used when clicking <strong>"Generate All Ads"</strong> below.
                Each ad group's keywords will be respected while incorporating these global inputs.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text">Ad Copy</h3>
          <p className="text-sm text-text3 mt-1">
            Create compelling headlines and descriptions for each ad group
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Write for me (AI)
          </button>
          <button
            onClick={handleGenerateAds}
            className="px-4 py-2 bg-gradient-to-r from-accent to-accent-hover text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Generate All Ads
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Ad Groups Sidebar */}
        <div className="col-span-1 space-y-2">
          <div className="text-xs font-medium text-text3 mb-3">AD GROUPS</div>
          {ads.map((ad) => {
            const adGroup = data.adGroups?.find((g: any) => g.id === ad.adGroupId);
            const isSelected = selectedAdGroupId === ad.adGroupId;
            const filledHeadlines = ad.headlines.filter(h => h.trim()).length;
            const filledDescriptions = ad.descriptions.filter(d => d.trim()).length;
            const isComplete =
              filledHeadlines >= MIN_HEADLINES &&
              filledDescriptions >= MIN_DESCRIPTIONS &&
              ad.headlines.every((h) => !h || h.length <= HEADLINE_MAX_LENGTH) &&
              ad.descriptions.every((d) => !d || d.length <= DESCRIPTION_MAX_LENGTH);

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
                      {filledHeadlines} headlines, {filledDescriptions} descriptions
                    </div>
                  </div>
                  {isComplete && filledHeadlines > 0 && (
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
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-text">{currentAdGroup.name}</h4>
                    <p className="text-xs text-text3 mt-1">
                      {currentAdGroup.keywords.length} keywords - Editing ad copy for this group
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-3 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-lg hover:bg-accent/20 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Write for me (AI)
                  </button>
                </div>
              </div>

              {/* Empty state - prompt to use Write for me */}
              {currentAd.headlines.length === 0 && currentAd.descriptions.length === 0 && (
                <div className="bg-surface2 border border-dashed border-divider rounded-lg p-8 text-center">
                  <div className="text-4xl mb-3">Edit</div>
                  <h4 className="font-medium text-text mb-2">No ad copy yet</h4>
                  <p className="text-sm text-text3 mb-4">
                    Use AI to generate compelling headlines and descriptions for this ad group
                  </p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Write for me (AI)
                  </button>
                </div>
              )}

              {/* Headlines */}
              {currentAd.headlines.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-text">Headlines</h4>
                      <p className="text-xs text-text3 mt-0.5">
                        {currentAd.headlines.filter(h => h.trim()).length} of {MAX_HEADLINES} (min {MIN_HEADLINES}, max 30 characters each)
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

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {currentAd.headlines.map((headline, index) => {
                      const charCount = headline.length;
                      const isOverLimit = charCount > HEADLINE_MAX_LENGTH;

                      return (
                        <div key={index} className="flex items-start gap-2 group">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mt-2.5 ${
                            headline.trim()
                              ? isOverLimit
                                ? 'bg-danger/20 text-danger'
                                : 'bg-success/20 text-success'
                              : 'bg-surface2 text-text3'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="relative">
                              <input
                                type="text"
                                value={headline}
                                onChange={(e) => updateHeadline(currentAd.adGroupId, index, e.target.value)}
                                placeholder={`Headline ${index + 1}`}
                                className={`w-full px-4 py-2.5 bg-surface2 border rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 transition-all ${
                                  isOverLimit
                                    ? 'border-danger focus:ring-danger'
                                    : 'border-divider focus:ring-accent focus:border-transparent'
                                }`}
                              />
                              <div
                                className={`absolute right-3 top-2.5 text-xs font-medium ${
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
                              className="mt-2.5 text-text3 hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
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
              )}

              {/* Descriptions */}
              {currentAd.descriptions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-text">Descriptions</h4>
                      <p className="text-xs text-text3 mt-0.5">
                        {currentAd.descriptions.filter(d => d.trim()).length} of {MAX_DESCRIPTIONS} (min {MIN_DESCRIPTIONS}, max 90 characters each)
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
                        <div key={index} className="flex items-start gap-2 group">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mt-2.5 ${
                            description.trim()
                              ? isOverLimit
                                ? 'bg-danger/20 text-danger'
                                : 'bg-success/20 text-success'
                              : 'bg-surface2 text-text3'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="relative">
                              <textarea
                                value={description}
                                onChange={(e) => updateDescription(currentAd.adGroupId, index, e.target.value)}
                                placeholder={`Description ${index + 1}`}
                                rows={2}
                                className={`w-full px-4 py-2.5 bg-surface2 border rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 transition-all resize-none ${
                                  isOverLimit
                                    ? 'border-danger focus:ring-danger'
                                    : 'border-divider focus:ring-accent focus:border-transparent'
                                }`}
                              />
                              <div
                                className={`absolute right-3 bottom-2.5 text-xs font-medium ${
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
                              className="mt-2.5 text-text3 hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
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
              )}

              {/* Ad Preview */}
              {(currentAd.headlines.length > 0 || currentAd.descriptions.length > 0) && (
                <div className="bg-surface2 border border-divider rounded-lg p-4">
                  <h4 className="text-sm font-medium text-text mb-3">Preview</h4>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">Sponsored</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-700 mb-1">
                      <span>{data.landingPageUrl?.replace(/^https?:\/\//, '').split('/')[0] || 'example.com'}</span>
                      {currentAd.paths?.path1 && <span>/{currentAd.paths.path1}</span>}
                      {currentAd.paths?.path2 && <span>/{currentAd.paths.path2}</span>}
                    </div>
                    <div className="text-blue-700 text-lg font-medium hover:underline cursor-pointer mb-1.5">
                      {currentAd.headlines.filter(h => h.trim()).slice(0, 3).join(' | ') || 'Headline 1 | Headline 2'}
                    </div>
                    <div className="text-sm text-gray-700">
                      {currentAd.descriptions.find(d => d.trim()) || 'Description 1'}
                    </div>
                  </div>
                  <p className="text-xs text-text3 mt-2">
                    Google will automatically test different headline and description combinations
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">Tip</span>
          <div>
            <h4 className="font-medium text-text text-sm mb-1">Ad Copy Best Practices</h4>
            <ul className="text-xs text-text3 space-y-1">
              <li>- Include your main keyword in at least 2 headlines</li>
              <li>- Add a clear call-to-action (CTA) in at least 1 headline</li>
              <li>- Use numbers or special offers to stand out</li>
              <li>- Use Dynamic Keyword Insertion {'{KeyWord:Fallback}'} for relevance</li>
              <li>- Make sure descriptions provide unique value propositions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* WriteForMe Modal */}
      <WriteForMeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApply={handleModalApply}
        initialContext={getInitialContext()}
        initialHeadlines={currentAd?.headlines}
        initialDescriptions={currentAd?.descriptions}
        initialPaths={currentAd?.paths}
      />

      {/* Intelligence Report Modal */}
      {showIntelligenceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-surface rounded-lg shadow-2xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-divider flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center text-xl">
                  🧠
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text">Use Intelligence Report</h3>
                  <p className="text-xs text-text3">Auto-fill context from your brand research</p>
                </div>
              </div>
              <button
                onClick={() => setShowIntelligenceModal(false)}
                className="text-text3 hover:text-text transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingProjects ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-success/30 border-t-success rounded-full mx-auto mb-3" />
                  <p className="text-text3">Loading your projects...</p>
                </div>
              ) : intelligenceProjects.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🧠</div>
                  <p className="text-text3 mb-2">No Intelligence Reports found</p>
                  <p className="text-xs text-text3 mb-4">
                    Create a Brand DNA report in the Intelligence Center first
                  </p>
                  <a
                    href="/intelligence"
                    target="_blank"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-success text-white rounded-lg text-sm hover:bg-success/90 transition-colors"
                  >
                    <span>Go to Intelligence Center</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-text3 mb-4">
                    Select a project to load brand positioning, benefits, and key messages:
                  </p>
                  {intelligenceProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => loadFromIntelligence(project.id)}
                      disabled={loadingReportId === project.id}
                      className="w-full bg-surface2 border border-divider rounded-lg p-4 hover:border-success transition-colors text-left disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center text-lg">
                            {project.unifiedReportStatus === 'completed' ? '✅' : '📊'}
                          </div>
                          <div>
                            <h4 className="font-medium text-text">{project.brandName}</h4>
                            <p className="text-xs text-text3">
                              {project.name}
                              {project.unifiedReportStatus === 'completed' && (
                                <span className="ml-2 text-success">Full report ready</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {loadingReportId === project.id ? (
                          <div className="animate-spin w-5 h-5 border-2 border-success/30 border-t-success rounded-full" />
                        ) : (
                          <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-divider bg-surface2/50">
              <div className="flex items-center gap-3 text-xs text-text3">
                <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Brand positioning, benefits, and key differentiators will be loaded</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
