'use client';

import { useState } from 'react';
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
    dailyBudget: 50,
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
    negativeKeywords: [],
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-divider">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-text">Create Campaign</h2>
              <p className="text-sm text-text3 mt-1">
                {preSelectedKeywords.length > 0
                  ? `Build campaign from ${preSelectedKeywords.length} selected keywords`
                  : landingPageUrl
                  ? `Build campaign from landing page`
                  : 'Build a new Google Ads campaign with AI assistance'}
              </p>
            </div>
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
              preSelectedKeywords={preSelectedKeywords}
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

              <button
                onClick={goToNext}
                disabled={isProcessing || currentStep === STEPS.length}
                className="px-8 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Processing...
                  </>
                ) : currentStep === STEPS.length ? (
                  'Launch Campaign'
                ) : (
                  <>
                    Continue →
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
