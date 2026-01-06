'use client';

import { Campaign } from '@/types/campaign';
import { useCampaignsStore } from '@/stores/campaigns-store';
import { useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';

interface CampaignDrawerProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CampaignDrawer({ campaign, isOpen, onClose }: CampaignDrawerProps) {
  const toggleCampaignStatus = useCampaignsStore((state) => state.toggleCampaignStatus);
  const updateCampaignBudget = useCampaignsStore((state) => state.updateCampaignBudget);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState('');
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);

  const handleStatusToggle = () => {
    if (campaign?.status === 'ENABLED') {
      setShowPauseConfirm(true);
    } else {
      toggleCampaignStatus(campaign!.id);
    }
  };

  const confirmPause = () => {
    toggleCampaignStatus(campaign!.id);
    setShowPauseConfirm(false);
  };

  if (!campaign) return null;

  const score = campaign.aiScore ?? 0;
  const scoreColor = score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-danger';
  const scoreBg = score >= 70 ? 'bg-success/10' : score >= 40 ? 'bg-warning/10' : 'bg-danger/10';

  const metrics = [
    { label: 'Spend', value: `$${(campaign.spend ?? 0).toLocaleString()}`, sub: 'total' },
    { label: 'Budget', value: `$${(campaign.dailyBudget ?? 0).toLocaleString()}`, sub: '/day' },
    { label: 'Clicks', value: (campaign.clicks ?? 0).toLocaleString() },
    { label: 'Impressions', value: (campaign.impressions ?? 0).toLocaleString() },
    { label: 'Conversions', value: (campaign.conversions ?? 0).toLocaleString() },
    { label: 'CTR', value: `${(campaign.ctr ?? 0).toFixed(2)}%` },
    { label: 'CPA', value: `$${(campaign.cpa ?? 0).toFixed(2)}` },
    { label: 'ROAS', value: `${(campaign.roas ?? 0).toFixed(2)}x` },
  ];

  const handleBudgetSave = async () => {
    const newBudget = parseFloat(budgetValue);
    if (!isNaN(newBudget) && newBudget >= 0) {
      await updateCampaignBudget(campaign.id, newBudget);
    }
    setEditingBudget(false);
  };

  const startBudgetEdit = () => {
    setBudgetValue((campaign.dailyBudget ?? 0).toString());
    setEditingBudget(true);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-[480px] bg-surface shadow-2xl z-50 transform transition-transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="p-6 border-b border-divider">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${campaign.status === 'ENABLED' ? 'bg-success' : 'bg-text3'}`} />
                <span className="text-xs text-text3 uppercase">{campaign.type}</span>
              </div>
              <h2 className="text-xl font-semibold text-text truncate">{campaign.name}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-surface2 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* AI Score */}
          <div className={`mt-4 p-4 rounded-xl ${scoreBg}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-text3">AI Score</p>
                <p className={`text-3xl font-bold ${scoreColor}`}>{score}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-text3">Recommendation</p>
                <p className="text-sm text-text">{campaign.aiRecommendation || 'No issues detected'}</p>
              </div>
            </div>

            {/* Score Breakdown */}
            {campaign.aiScoreBreakdown?.factors && (
              <div className="border-t border-divider/50 pt-3 space-y-2">
                <p className="text-xs text-text3 uppercase tracking-wide mb-2">Score Factors</p>
                {campaign.aiScoreBreakdown.factors.map((factor, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        factor.status === 'good' ? 'bg-success' :
                        factor.status === 'warning' ? 'bg-warning' : 'bg-danger'
                      }`} />
                      <span className="text-xs text-text">{factor.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${
                        factor.score > 0 ? 'text-success' :
                        factor.score < 0 ? 'text-danger' : 'text-text3'
                      }`}>
                        {factor.score > 0 ? '+' : ''}{factor.score}
                      </span>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-text3 mt-2 pt-2 border-t border-divider/30">
                  Base: 50 + factor scores = {score}. CTR/CPA compared to industry benchmarks.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-text3 uppercase tracking-wide mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric, i) => (
              <div key={i} className="p-4 bg-surface2 rounded-xl">
                <p className="text-xs text-text3 mb-1">{metric.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-semibold text-text">{metric.value}</span>
                  {metric.sub && <span className="text-xs text-text3">{metric.sub}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-divider">
          <h3 className="text-sm font-medium text-text3 uppercase tracking-wide mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {/* Budget Edit */}
            <div className="flex items-center gap-3">
              {editingBudget ? (
                <>
                  <input
                    type="number"
                    value={budgetValue}
                    onChange={(e) => setBudgetValue(e.target.value)}
                    className="flex-1 px-4 py-2 bg-surface2 rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleBudgetSave();
                      if (e.key === 'Escape') setEditingBudget(false);
                    }}
                  />
                  <button onClick={handleBudgetSave} className="px-4 py-2 bg-accent text-white rounded-lg">
                    Save
                  </button>
                  <button onClick={() => setEditingBudget(false)} className="px-4 py-2 bg-surface2 text-text2 rounded-lg">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={startBudgetEdit}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface2 hover:bg-divider text-text rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Edit Daily Budget
                </button>
              )}
            </div>

            {/* Status Toggle */}
            <button
              onClick={handleStatusToggle}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                campaign.status === 'ENABLED'
                  ? 'bg-danger/10 text-danger hover:bg-danger hover:text-white'
                  : 'bg-success/10 text-success hover:bg-success hover:text-white'
              }`}
            >
              {campaign.status === 'ENABLED' ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pause Campaign
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Enable Campaign
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pause Confirmation Modal */}
      <ConfirmModal
        isOpen={showPauseConfirm}
        onClose={() => setShowPauseConfirm(false)}
        onConfirm={confirmPause}
        title="Pause Campaign?"
        message={`This will pause "${campaign.name}" with a daily budget of $${(campaign.dailyBudget ?? 0).toLocaleString()}. It will stop showing ads immediately.`}
        confirmText="Pause Campaign"
        confirmVariant="warning"
      />
    </>
  );
}
