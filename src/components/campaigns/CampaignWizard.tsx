'use client';

import { useState, useEffect } from 'react';
import { GeneratedKeyword } from '@/app/keyword-factory/types';

// Wizard step components (will create these next)
import WizardStep1Campaign from './WizardStep1Campaign';
import WizardStep2AdGroups from './WizardStep2AdGroups';
import WizardStep3AdCopy from './WizardStep3AdCopy';
import WizardStep4Budget from './WizardStep4Budget';
import WizardStep5Review from './WizardStep5Review';

interface CampaignWizardProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedKeywords?: GeneratedKeyword[];
  landingPageUrl?: string;
}

interface WizardData {
  // Step 1: Campaign Details
  campaignName: string;
  campaignType: 'SEARCH' | 'PERFORMANCE_MAX' | 'SHOPPING';
  targetLocation: string;
  language: string;
  goal: 'LEADS' | 'SALES' | 'TRAFFIC';
  landingPageUrl: string;

  // Network settings
  includeSearchPartners: boolean;
  includeDisplayNetwork: boolean;

  // Step 2: Ad Groups (AI-clustered)
  adGroups: Array<{
    id: string;
    name: string;
    keywords: GeneratedKeyword[];
  }>;

  // Step 3: Ad Copy
  ads: Array<{
    adGroupId: string;
    headlines: string[];
    descriptions: string[];
  }>;

  // Step 4: Budget & Settings
  dailyBudget: number;
  biddingStrategy: 'MAXIMIZE_CONVERSIONS' | 'MANUAL_CPC' | 'TARGET_CPA';
  targetCpa?: number;
  negativeKeywords: string[];

  // Step 5: Review
  estimatedCost: {
    daily: number;
    monthly: number;
  };
}

const STEPS = [
  { number: 1, name: 'Campaign settings', icon: '⚙️' },
  { number: 2, name: 'Ad groups', icon: '🎯' },
  { number: 3, name: 'Ad copy', icon: '✍️' },
  { number: 4, name: 'Budget', icon: '💰' },
  { number: 5, name: 'Review', icon: '✅' },
];

const WIZARD_STORAGE_KEY = 'quickads_wizard_progress';

export default function CampaignWizard({
  isOpen,
  onClose,
  preSelectedKeywords = [],
  landingPageUrl,
}: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<Partial<WizardData>>({
    campaignType: 'SEARCH',
    targetLocation: '2840', // United States
    language: 'en',
    goal: 'LEADS',
    landingPageUrl: landingPageUrl || '',
    includeSearchPartners: false, // Default to OFF (most advertisers don't want this)
    includeDisplayNetwork: false, // Default to OFF (Search-only is cleaner)
    dailyBudget: 50,
    biddingStrategy: 'MANUAL_CPC', // Default to Manual CPC (safer for new campaigns)
    negativeKeywords: [],
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [clusterKeywords, setClusterKeywords] = useState<GeneratedKeyword[]>([]);
  const [fromClusters, setFromClusters] = useState(false);

  // Load cluster data from sessionStorage OR saved wizard progress from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // First, check for cluster data from Cluster Studio
      const clusterData = sessionStorage.getItem('campaign-wizard-data');
      if (clusterData) {
        try {
          const parsed = JSON.parse(clusterData);
          if (parsed.fromClusters && parsed.adGroups) {
            console.log('[CampaignWizard] Loading cluster data:', parsed);
            setFromClusters(true);

            // Convert cluster adGroups to wizard format
            const formattedAdGroups = parsed.adGroups.map((group: any, index: number) => ({
              id: `cluster-${Date.now()}-${index}`,
              name: group.name,
              keywords: group.keywords.map((kw: string) => ({
                keyword: kw,
                type: 'clustered' as const,
                source: 'cluster_studio',
                suggestedMatchType: 'BROAD' as const,
                estimatedIntent: 'commercial' as const,
                metrics: {
                  searchVolume: Math.round((group.totalVolume || 0) / group.keywords.length),
                  cpc: group.avgCpc || 0,
                },
              })),
              avgCpc: group.avgCpc || 0,
              totalVolume: group.totalVolume || 0,
            }));

            // Extract all keywords for preSelectedKeywords
            const allKeywords: GeneratedKeyword[] = formattedAdGroups.flatMap((group: any) => group.keywords);
            setClusterKeywords(allKeywords);

            // Update wizard data with clusters
            setWizardData(prev => ({
              ...prev,
              campaignName: parsed.listName ? `${parsed.listName} Campaign` : '',
              adGroups: formattedAdGroups,
              preSelectedKeywords: allKeywords,
            }));

            // Clear sessionStorage to prevent stale data on next visit
            sessionStorage.removeItem('campaign-wizard-data');

            // Skip to step 2 since ad groups are already created
            setCurrentStep(2);
            return;
          }
        } catch (error) {
          console.error('Failed to load cluster data:', error);
        }
      }

      // Fall back to localStorage for saved wizard progress
      const saved = localStorage.getItem(WIZARD_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setWizardData(parsed.data);
          setCurrentStep(parsed.step || 1);
        } catch (error) {
          console.error('Failed to load wizard progress:', error);
        }
      }
    }
  }, []);

  // Save wizard progress to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(wizardData).length > 0) {
      localStorage.setItem(
        WIZARD_STORAGE_KEY,
        JSON.stringify({ data: wizardData, step: currentStep })
      );
    }
  }, [wizardData, currentStep]);

  if (!isOpen) return null;

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));

    // Show "Saved just now" indicator
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  };

  const goToNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (isProcessing) {
      if (!confirm('Campaign creation in progress. Are you sure you want to cancel?')) {
        return;
      }
    }
    onClose();
  };

  const handleStartOver = () => {
    if (confirm('This will clear all progress. Are you sure?')) {
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem(WIZARD_STORAGE_KEY);
      }

      // Reset wizard state
      setWizardData({
        campaignType: 'SEARCH',
        targetLocation: '2840',
        language: 'en',
        goal: 'LEADS',
        dailyBudget: 50,
        biddingStrategy: 'MAXIMIZE_CONVERSIONS',
        negativeKeywords: [],
      });
      setClusterKeywords([]);
      setFromClusters(false);
      setCurrentStep(1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-divider">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-text">Create Campaign</h2>
              <p className="text-sm text-text3 mt-1">
                {fromClusters && clusterKeywords.length > 0
                  ? `Build campaign from ${(wizardData.adGroups || []).length} clustered ad groups (${clusterKeywords.length} keywords)`
                  : preSelectedKeywords.length > 0
                  ? `Build campaign from ${preSelectedKeywords.length} selected keywords`
                  : landingPageUrl
                  ? `Build campaign from landing page`
                  : 'Build a new Google Ads campaign with AI assistance'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleStartOver}
                className="px-4 py-2 text-sm border border-divider rounded-lg text-text3 hover:text-text hover:border-accent transition-colors disabled:opacity-50"
                disabled={isProcessing}
                title="Clear all progress and start over"
              >
                Start Over
              </button>
              <button
                onClick={handleClose}
                className="text-text3 hover:text-text transition-colors p-2"
                disabled={isProcessing}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Step Progress Indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                {/* Step circle */}
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                    currentStep === step.number
                      ? 'border-accent bg-accent text-white'
                      : currentStep > step.number
                      ? 'border-success bg-success text-white'
                      : 'border-divider bg-surface2 text-text3'
                  }`}
                >
                  {currentStep > step.number ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold">{step.number}</span>
                  )}
                </div>

                {/* Step label */}
                <div className="ml-3 flex-1">
                  <div className={`text-xs font-medium ${currentStep >= step.number ? 'text-text' : 'text-text3'}`}>
                    {step.name}
                  </div>
                </div>

                {/* Connector line */}
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 transition-colors ${
                      currentStep > step.number ? 'bg-success' : 'bg-divider'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {currentStep === 1 && (
            <WizardStep1Campaign
              data={wizardData}
              onUpdate={updateWizardData}
              preSelectedKeywords={clusterKeywords.length > 0 ? clusterKeywords : preSelectedKeywords}
            />
          )}
          {currentStep === 2 && (
            <WizardStep2AdGroups
              data={wizardData}
              onUpdate={updateWizardData}
              setIsProcessing={setIsProcessing}
            />
          )}
          {currentStep === 3 && (
            <WizardStep3AdCopy
              data={wizardData}
              onUpdate={updateWizardData}
              setIsProcessing={setIsProcessing}
            />
          )}
          {currentStep === 4 && (
            <WizardStep4Budget data={wizardData} onUpdate={updateWizardData} />
          )}
          {currentStep === 5 && (
            <WizardStep5Review
              data={wizardData}
              setIsProcessing={setIsProcessing}
              onSuccess={onClose}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-divider bg-surface2/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {savedIndicator && (
                <div className="flex items-center gap-2 text-sm text-success animate-fade-in">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Saved just now</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg text-text3 hover:text-text hover:bg-surface2 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              {currentStep > 1 && (
                <button
                  onClick={goToPrevious}
                  disabled={isProcessing}
                  className="px-6 py-2.5 rounded-lg bg-surface2 text-text hover:bg-surface border border-divider transition-colors disabled:opacity-50"
                >
                  ← Previous
                </button>
              )}

              {/* Hide the Next/Launch button on step 5 (Review) since that step has its own Launch button */}
              {currentStep < STEPS.length && (
                <button
                  onClick={goToNext}
                  disabled={isProcessing}
                  className="px-8 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 font-medium flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Continue →
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
