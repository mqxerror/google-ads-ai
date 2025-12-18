'use client';

import { useState, useEffect } from 'react';
import { Campaign, CampaignType } from '@/types/campaign';
import { useAccount } from '@/contexts/AccountContext';
import { useActionQueue } from '@/contexts/ActionQueueContext';

interface CampaignEditorProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: Campaign | null; // If null, we're creating a new campaign
  onSave?: (campaign: Campaign) => void;
}

type CampaignFormData = {
  name: string;
  type: CampaignType;
  status: 'ENABLED' | 'PAUSED';
  dailyBudget: number;
  startDate: string;
  endDate: string;
  targetLocations: string[];
  targetLanguages: string[];
  biddingStrategy: 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CLICKS' | 'TARGET_CPA' | 'TARGET_ROAS' | 'MANUAL_CPC';
  targetCpa?: number;
  targetRoas?: number;
};

const CAMPAIGN_TYPES: { value: CampaignType; label: string; description: string }[] = [
  { value: 'SEARCH', label: 'Search', description: 'Text ads on Google Search results' },
  { value: 'DISPLAY', label: 'Display', description: 'Image ads across the Google Display Network' },
  { value: 'SHOPPING', label: 'Shopping', description: 'Product listings on Google Shopping' },
  { value: 'VIDEO', label: 'Video', description: 'Video ads on YouTube and across the web' },
  { value: 'PERFORMANCE_MAX', label: 'Performance Max', description: 'AI-powered campaigns across all channels' },
  { value: 'DEMAND_GEN', label: 'Demand Gen', description: 'Visual ads to drive demand' },
];

const BIDDING_STRATEGIES = [
  { value: 'MAXIMIZE_CONVERSIONS', label: 'Maximize Conversions', description: 'Get the most conversions within your budget' },
  { value: 'MAXIMIZE_CLICKS', label: 'Maximize Clicks', description: 'Get the most clicks within your budget' },
  { value: 'TARGET_CPA', label: 'Target CPA', description: 'Get conversions at your target cost per action' },
  { value: 'TARGET_ROAS', label: 'Target ROAS', description: 'Get conversion value at your target return on ad spend' },
  { value: 'MANUAL_CPC', label: 'Manual CPC', description: 'Set your own max cost-per-click bids' },
];

export default function CampaignEditor({ isOpen, onClose, campaign, onSave }: CampaignEditorProps) {
  const { currentAccount } = useAccount();
  const { addAction } = useActionQueue();
  const isEditing = !!campaign;

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    type: 'SEARCH',
    status: 'PAUSED',
    dailyBudget: 10,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    targetLocations: ['United States'],
    targetLanguages: ['English'],
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
    targetCpa: undefined,
    targetRoas: undefined,
  });

  // Initialize form with campaign data when editing
  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        type: campaign.type,
        status: campaign.status as 'ENABLED' | 'PAUSED',
        dailyBudget: 10, // We don't have this in current Campaign type
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        targetLocations: ['United States'],
        targetLanguages: ['English'],
        biddingStrategy: 'MAXIMIZE_CONVERSIONS',
        targetCpa: undefined,
        targetRoas: undefined,
      });
    }
  }, [campaign]);

  const updateFormData = (updates: Partial<CampaignFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    if (!currentAccount) {
      setError('No account selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && campaign) {
        // Update existing campaign
        const response = await fetch('/api/google-ads/campaigns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: currentAccount.id,
            campaignId: campaign.id,
            updates: {
              name: formData.name,
              status: formData.status,
            },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update campaign');
        }

        // Also queue a status change if it changed
        if (formData.status !== campaign.status) {
          addAction({
            actionType: formData.status === 'PAUSED' ? 'pause_campaign' : 'enable_campaign',
            entityType: 'campaign',
            entityId: campaign.id,
            entityName: campaign.name,
            currentValue: campaign.status,
            newValue: formData.status,
            accountId: currentAccount.id,
          });
        }
      } else {
        // Create new campaign
        const response = await fetch('/api/google-ads/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: currentAccount.id,
            campaign: {
              name: formData.name,
              type: formData.type,
              status: formData.status,
              dailyBudget: formData.dailyBudget,
              biddingStrategy: formData.biddingStrategy,
              targetCpa: formData.targetCpa,
              targetRoas: formData.targetRoas,
              startDate: formData.startDate,
              endDate: formData.endDate || undefined,
            },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create campaign');
        }
      }

      onClose();
      if (onSave) {
        // Refresh the campaign list
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalSteps = isEditing ? 2 : 4;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 z-50 flex items-center justify-center sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl">
        <div className="relative w-full max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Campaign' : 'Create New Campaign'}
              </h2>
              {!isEditing && (
                <p className="mt-1 text-sm text-gray-500">
                  Step {step} of {totalSteps}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          {!isEditing && (
            <div className="h-1 bg-gray-100">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          )}

          {/* Content */}
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Step 1: Campaign Type (Create only) */}
            {!isEditing && step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Select Campaign Type</h3>
                <div className="grid grid-cols-2 gap-3">
                  {CAMPAIGN_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => updateFormData({ type: type.value })}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${
                        formData.type === type.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{type.label}</p>
                      <p className="mt-1 text-sm text-gray-500">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Basic Settings */}
            {(isEditing || step === 2) && (isEditing ? step === 1 : true) && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Campaign Settings</h3>

                {/* Campaign Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Campaign Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateFormData({ name: e.target.value })}
                    placeholder="Enter campaign name"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-2 flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={formData.status === 'ENABLED'}
                        onChange={() => updateFormData({ status: 'ENABLED' })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Enabled</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={formData.status === 'PAUSED'}
                        onChange={() => updateFormData({ status: 'PAUSED' })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Paused</span>
                    </label>
                  </div>
                </div>

                {/* Daily Budget (Create only) */}
                {!isEditing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Daily Budget</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={formData.dailyBudget}
                        onChange={(e) => updateFormData({ dailyBudget: parseFloat(e.target.value) || 0 })}
                        className="block w-full rounded-lg border border-gray-300 pl-8 pr-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Bidding Strategy (Create only) */}
            {!isEditing && step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Bidding Strategy</h3>
                <div className="space-y-3">
                  {BIDDING_STRATEGIES.map((strategy) => (
                    <button
                      key={strategy.value}
                      onClick={() => updateFormData({ biddingStrategy: strategy.value as CampaignFormData['biddingStrategy'] })}
                      className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                        formData.biddingStrategy === strategy.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{strategy.label}</p>
                      <p className="mt-1 text-sm text-gray-500">{strategy.description}</p>
                    </button>
                  ))}
                </div>

                {/* Target CPA/ROAS inputs */}
                {formData.biddingStrategy === 'TARGET_CPA' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Target CPA</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formData.targetCpa || ''}
                        onChange={(e) => updateFormData({ targetCpa: parseFloat(e.target.value) || undefined })}
                        placeholder="Enter target cost per acquisition"
                        className="block w-full rounded-lg border border-gray-300 pl-8 pr-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {formData.biddingStrategy === 'TARGET_ROAS' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Target ROAS</label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formData.targetRoas || ''}
                        onChange={(e) => updateFormData({ targetRoas: parseFloat(e.target.value) || undefined })}
                        placeholder="e.g., 4 for 400% ROAS"
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">x</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Schedule (Create only) */}
            {!isEditing && step === 4 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Campaign Schedule</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => updateFormData({ startDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => updateFormData({ endDate: e.target.value })}
                      min={formData.startDate}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-6 rounded-lg bg-gray-50 p-4">
                  <h4 className="font-medium text-gray-900">Campaign Summary</h4>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Name:</dt>
                      <dd className="font-medium text-gray-900">{formData.name || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Type:</dt>
                      <dd className="font-medium text-gray-900">{CAMPAIGN_TYPES.find(t => t.value === formData.type)?.label}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Daily Budget:</dt>
                      <dd className="font-medium text-gray-900">${formData.dailyBudget.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Bidding:</dt>
                      <dd className="font-medium text-gray-900">{BIDDING_STRATEGIES.find(s => s.value === formData.biddingStrategy)?.label}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status:</dt>
                      <dd className="font-medium text-gray-900">{formData.status === 'ENABLED' ? 'Active' : 'Paused'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {/* Edit mode step 2: Additional Settings */}
            {isEditing && step === 2 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Additional Settings</h3>
                <p className="text-sm text-gray-500">
                  Note: Budget and bidding strategy changes require using the Budget Management feature.
                </p>
                {/* Placeholder for future settings */}
                <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
                  Advanced settings coming soon
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <div>
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              {step < totalSteps ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 2 && !formData.name}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.name}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Campaign'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
