'use client';

import { useState } from 'react';
import { GeneratedKeyword } from '../types';

interface Campaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  type: 'SEARCH' | 'DISPLAY' | 'SHOPPING' | 'VIDEO' | 'PERFORMANCE_MAX';
}

interface BulkActionBarProps {
  selectedKeywords: GeneratedKeyword[];
  campaigns: Campaign[];
  loadingCampaigns?: boolean;
  onAddToCampaign: (campaignId: string) => Promise<void>;
  onCreateCampaign: () => Promise<void>;
  onExport: () => void;
  onTrackInSERP?: () => Promise<void>;
  onClearSelection: () => void;
}

export default function BulkActionBar({
  selectedKeywords,
  campaigns,
  loadingCampaigns = false,
  onAddToCampaign,
  onCreateCampaign,
  onExport,
  onTrackInSERP,
  onClearSelection,
}: BulkActionBarProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCampaignMenu, setShowCampaignMenu] = useState(false);

  if (selectedKeywords.length === 0) {
    return null;
  }

  const handleAddToCampaign = async (campaignId: string) => {
    setIsProcessing(true);
    try {
      await onAddToCampaign(campaignId);
      setShowCampaignMenu(false);
    } catch (error) {
      console.error('Failed to add to campaign:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateCampaign = async () => {
    setIsProcessing(true);
    try {
      await onCreateCampaign();
    } catch (error) {
      console.error('Failed to create campaign:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-accent text-white px-3 py-2 rounded-lg mb-3 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Selection Count */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{selectedKeywords.length} selected</span>
            <button
              onClick={onClearSelection}
              className="text-white/60 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          {/* Stats Summary - Compact */}
          <div className="hidden md:flex items-center gap-3 text-xs text-white/70 border-l border-white/20 pl-3">
            {selectedKeywords.some(kw => kw.metrics?.searchVolume) && (
              <div className="flex items-center gap-1">
                <span className="text-white/50">Vol:</span>
                <span className="font-medium text-white">
                  {selectedKeywords
                    .reduce((sum, kw) => sum + (kw.metrics?.searchVolume || 0), 0)
                    .toLocaleString()}
                </span>
              </div>
            )}
            {selectedKeywords.some(kw => kw.metrics?.cpc) && (
              <div className="flex items-center gap-1">
                <span className="text-white/50">Avg CPC:</span>
                <span className="font-medium text-white">
                  $
                  {(
                    selectedKeywords.reduce((sum, kw) => sum + (kw.metrics?.cpc || 0), 0) /
                    selectedKeywords.filter(kw => kw.metrics?.cpc).length
                  ).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Track in SERP Intelligence Button */}
          {onTrackInSERP && (
            <button
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await onTrackInSERP();
                } catch (error) {
                  console.error('Failed to track in SERP Intelligence:', error);
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              📊 Track Rankings
            </button>
          )}

          {/* Export Button - Compact */}
          <button
            onClick={onExport}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            📥 Export
          </button>

          {/* Add to Campaign Dropdown - Single unified button */}
          <div className="relative">
            <button
              onClick={() => setShowCampaignMenu(!showCampaignMenu)}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-white text-accent hover:bg-white/90 rounded text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              ➕ Add to Campaign
              <span className="text-[10px]">▼</span>
            </button>

            {showCampaignMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white text-text rounded-lg shadow-xl border border-divider overflow-hidden z-20">
                <div className="p-2 bg-surface2 border-b border-divider">
                  <div className="text-[10px] text-text3 uppercase font-semibold tracking-wide">
                    Add {selectedKeywords.length} keywords to:
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {loadingCampaigns ? (
                    <div className="px-3 py-4 text-center text-text3 text-xs">
                      <div className="animate-spin inline-block mb-1">⏳</div>
                      <div>Loading campaigns...</div>
                    </div>
                  ) : campaigns.length === 0 ? (
                    <div className="px-3 py-4 text-center text-text3 text-xs">
                      No campaigns found
                    </div>
                  ) : (
                    campaigns
                      .filter(c => c.status === 'ENABLED')
                      .map((campaign) => (
                        <button
                          key={campaign.id}
                          onClick={() => handleAddToCampaign(campaign.id)}
                          disabled={isProcessing}
                          className="w-full px-3 py-2 text-left hover:bg-surface2 transition-colors text-sm disabled:opacity-50 border-b border-divider/50"
                        >
                          <div className="font-medium">{campaign.name}</div>
                          <div className="text-xs text-text3">
                            {campaign.type.replace('_', ' ')} Campaign • {campaign.status === 'ENABLED' ? 'Active' : 'Paused'}
                          </div>
                        </button>
                      ))
                  )}

                  {/* Create New Campaign Option */}
                  <button
                    onClick={handleCreateCampaign}
                    disabled={isProcessing}
                    className="w-full px-3 py-2.5 text-left hover:bg-accent/5 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <span className="text-lg">✨</span>
                    <div>
                      <div className="text-sm font-semibold text-accent">Create New Campaign</div>
                      <div className="text-xs text-text3">Build campaign from selection</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="mt-1.5 text-xs text-white/60 flex items-center gap-1">
          <div className="animate-spin">⏳</div>
          Processing...
        </div>
      )}
    </div>
  );
}
