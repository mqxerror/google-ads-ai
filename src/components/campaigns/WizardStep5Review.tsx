'use client';

import { useState } from 'react';

interface WizardStep5Props {
  data: any;
  setIsProcessing: (processing: boolean) => void;
  onSuccess: () => void;
}

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  SEARCH: 'Search',
  PERFORMANCE_MAX: 'Performance Max',
  SHOPPING: 'Shopping',
};

const GOAL_LABELS: Record<string, string> = {
  LEADS: 'Leads',
  SALES: 'Sales',
  TRAFFIC: 'Traffic',
};

const LOCATION_LABELS: Record<string, string> = {
  '2840': 'United States',
  '2124': 'Canada',
  '2826': 'United Kingdom',
  '2036': 'Australia',
  '21137': 'All countries',
};

const BIDDING_STRATEGY_LABELS: Record<string, string> = {
  MAXIMIZE_CONVERSIONS: 'Maximize Conversions',
  TARGET_CPA: 'Target CPA',
  MANUAL_CPC: 'Manual CPC',
};

export default function WizardStep5Review({ data, setIsProcessing, onSuccess }: WizardStep5Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  const handleLaunchCampaign = async () => {
    setIsCreating(true);
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/campaigns/wizard/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: data.campaignName,
          campaignType: data.campaignType,
          targetLocation: data.targetLocation,
          language: data.language,
          goal: data.goal,
          adGroups: data.adGroups,
          ads: data.ads,
          dailyBudget: data.dailyBudget,
          biddingStrategy: data.biddingStrategy,
          targetCpa: data.targetCpa,
          negativeKeywords: data.negativeKeywords || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create campaign');
      }

      const { campaignId, campaignName } = await response.json();

      setCreatedCampaignId(campaignId);

      // Show success for 2 seconds then close wizard
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error('Error creating campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to create campaign. Please try again.');
    } finally {
      setIsCreating(false);
      setIsProcessing(false);
    }
  };

  // Success state
  if (createdCampaignId) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-6xl mb-4 animate-bounce">🎉</div>
        <h3 className="text-2xl font-bold text-text mb-2">Campaign Created Successfully!</h3>
        <p className="text-text3 mb-4">Your campaign "{data.campaignName}" is now live in Google Ads</p>
        <div className="bg-success/10 border border-success/30 rounded-lg p-4 text-center">
          <p className="text-sm text-success">Campaign ID: {createdCampaignId}</p>
        </div>
        <p className="text-xs text-text3 mt-4">Redirecting to dashboard...</p>
      </div>
    );
  }

  // Creating state
  if (isCreating) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full mb-4" />
        <h3 className="text-xl font-medium text-text mb-2">Creating campaign...</h3>
        <p className="text-sm text-text3 mb-6">This may take 30-60 seconds</p>
        <div className="space-y-2 text-xs text-text3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span>Setting up campaign structure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-100" />
            <span>Creating ad groups</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-200" />
            <span>Uploading ad copy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-300" />
            <span>Configuring budget and bidding</span>
          </div>
        </div>
      </div>
    );
  }

  // Review state
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-text">Review & Launch</h3>
        <p className="text-sm text-text3 mt-1">Review your campaign settings before launching</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h4 className="font-medium text-danger mb-1">Failed to Create Campaign</h4>
              <p className="text-sm text-text3">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Settings Summary */}
      <div className="bg-surface2 border border-divider rounded-lg p-6">
        <h4 className="font-medium text-text mb-4 flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          Campaign Settings
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-text3 mb-1">Campaign Name</div>
            <div className="font-medium text-text">{data.campaignName}</div>
          </div>
          <div>
            <div className="text-xs text-text3 mb-1">Campaign Type</div>
            <div className="font-medium text-text">{CAMPAIGN_TYPE_LABELS[data.campaignType]}</div>
          </div>
          <div>
            <div className="text-xs text-text3 mb-1">Goal</div>
            <div className="font-medium text-text">{GOAL_LABELS[data.goal]}</div>
          </div>
          <div>
            <div className="text-xs text-text3 mb-1">Target Location</div>
            <div className="font-medium text-text">{LOCATION_LABELS[data.targetLocation] || data.targetLocation}</div>
          </div>
          <div>
            <div className="text-xs text-text3 mb-1">Language</div>
            <div className="font-medium text-text">{data.language?.toUpperCase()}</div>
          </div>
          <div>
            <div className="text-xs text-text3 mb-1">Daily Budget</div>
            <div className="font-medium text-text">${data.dailyBudget}</div>
          </div>
          <div>
            <div className="text-xs text-text3 mb-1">Bidding Strategy</div>
            <div className="font-medium text-text">{BIDDING_STRATEGY_LABELS[data.biddingStrategy]}</div>
          </div>
          {data.biddingStrategy === 'TARGET_CPA' && data.targetCpa && (
            <div>
              <div className="text-xs text-text3 mb-1">Target CPA</div>
              <div className="font-medium text-text">${data.targetCpa}</div>
            </div>
          )}
        </div>
      </div>

      {/* Ad Groups Summary */}
      <div className="bg-surface2 border border-divider rounded-lg p-6">
        <h4 className="font-medium text-text mb-4 flex items-center gap-2">
          <span className="text-xl">🎯</span>
          Ad Groups ({data.adGroups?.length || 0})
        </h4>
        <div className="space-y-3">
          {data.adGroups?.map((group: any, index: number) => (
            <div key={group.id} className="bg-surface border border-divider rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-text">{group.name}</div>
                <div className="text-xs text-text3">{group.keywords.length} keywords</div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {group.keywords.slice(0, 8).map((kw: any, kwIndex: number) => (
                  <span key={kwIndex} className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded">
                    {kw.keyword}
                  </span>
                ))}
                {group.keywords.length > 8 && (
                  <span className="px-2 py-0.5 text-text3 text-xs">+{group.keywords.length - 8} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ad Copy Preview */}
      <div className="bg-surface2 border border-divider rounded-lg p-6">
        <h4 className="font-medium text-text mb-4 flex items-center gap-2">
          <span className="text-xl">✍️</span>
          Ad Copy Preview
        </h4>
        <div className="space-y-4">
          {data.ads?.slice(0, 2).map((ad: any, index: number) => {
            const adGroup = data.adGroups?.find((g: any) => g.id === ad.adGroupId);
            return (
              <div key={ad.adGroupId} className="bg-surface border border-divider rounded-lg p-4">
                <div className="text-xs text-text3 mb-2">Ad Group: {adGroup?.name || 'Unknown'}</div>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold">
                      Ad
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-green-700 mb-0.5">Sponsored</div>
                      <div className="text-blue-700 text-sm font-medium">
                        {ad.headlines.slice(0, 3).join(' | ')}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">example.com</div>
                      <div className="text-xs text-gray-800 mt-1">{ad.descriptions[0]}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {data.ads?.length > 2 && (
            <div className="text-center text-xs text-text3">+{data.ads.length - 2} more ad variations</div>
          )}
        </div>
      </div>

      {/* Budget & Estimates */}
      <div className="bg-surface2 border border-divider rounded-lg p-6">
        <h4 className="font-medium text-text mb-4 flex items-center gap-2">
          <span className="text-xl">💰</span>
          Budget & Estimates
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-text3 mb-1">Daily Budget</div>
            <div className="text-2xl font-bold text-text">${data.dailyBudget}</div>
          </div>
          <div>
            <div className="text-xs text-text3 mb-1">Monthly Budget</div>
            <div className="text-2xl font-bold text-text">${data.estimatedCost?.monthly || data.dailyBudget * 30}</div>
          </div>
          <div>
            <div className="text-xs text-text3 mb-1">Total Keywords</div>
            <div className="text-2xl font-bold text-text">
              {data.adGroups?.reduce((sum: number, group: any) => sum + group.keywords.length, 0) || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Negative Keywords */}
      {data.negativeKeywords && data.negativeKeywords.length > 0 && (
        <div className="bg-surface2 border border-divider rounded-lg p-6">
          <h4 className="font-medium text-text mb-4 flex items-center gap-2">
            <span className="text-xl">🚫</span>
            Negative Keywords ({data.negativeKeywords.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {data.negativeKeywords.slice(0, 15).map((kw: string, index: number) => (
              <span key={index} className="px-2 py-0.5 bg-danger/10 text-danger text-xs rounded">
                {kw}
              </span>
            ))}
            {data.negativeKeywords.length > 15 && (
              <span className="px-2 py-0.5 text-text3 text-xs">+{data.negativeKeywords.length - 15} more</span>
            )}
          </div>
        </div>
      )}

      {/* Launch Button */}
      <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🚀</span>
          <div>
            <h4 className="font-medium text-text mb-1">Ready to launch?</h4>
            <p className="text-xs text-text3">
              Your campaign will be created in Google Ads and will start serving ads immediately
            </p>
          </div>
        </div>
        <button
          onClick={handleLaunchCampaign}
          disabled={isCreating}
          className="px-8 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isCreating ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              Creating...
            </>
          ) : (
            <>
              <span>🚀</span>
              Launch Campaign
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-surface2 border border-divider rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <h4 className="font-medium text-text text-sm mb-1">What happens next?</h4>
            <ul className="text-xs text-text3 space-y-1">
              <li>• Campaign will be created in your Google Ads account</li>
              <li>• Ads will go through Google's review process (usually 1 business day)</li>
              <li>• Once approved, ads will start serving to your target audience</li>
              <li>• You can monitor performance in the dashboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
