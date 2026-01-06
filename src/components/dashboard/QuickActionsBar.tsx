'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDashboardStats } from '@/hooks/useCampaigns';
import { useCampaignsStore } from '@/stores/campaigns-store';
import ConfirmModal from '@/components/ConfirmModal';

interface QuickActionsBarProps {
  onShowNegativeKeywords?: () => void;
}

export default function QuickActionsBar({ onShowNegativeKeywords }: QuickActionsBarProps) {
  const { wasters, potentialSavings, wasterCount, winnerCount, wasterThreshold } = useDashboardStats();
  const pauseMultiple = useCampaignsStore((state) => state.pauseMultipleCampaigns);
  const setWasterThreshold = useCampaignsStore((state) => state.setWasterThreshold);
  const [showThresholdMenu, setShowThresholdMenu] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);

  const handlePauseWasters = () => {
    if (wasters.length === 0) return;
    setShowPauseConfirm(true);
  };

  const confirmPauseWasters = async () => {
    const ids = wasters.map((c) => c.id);
    await pauseMultiple(ids);
    setShowPauseConfirm(false);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* PAUSE WASTERS - Most prominent button */}
      {wasterCount > 0 && (
        <button
          onClick={handlePauseWasters}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:scale-[1.02] transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span>Pause {wasterCount} Waster{wasterCount > 1 ? 's' : ''}</span>
          <span className="text-red-200 text-sm">Save ~${Math.round(potentialSavings).toLocaleString()}/mo</span>
        </button>
      )}

      {/* Spend Shield Link */}
      <Link
        href="/spend-shield"
        className="flex items-center gap-2 px-4 py-2.5 bg-surface2 hover:bg-divider text-text rounded-xl transition-colors"
      >
        <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div className="text-left">
          <p className="text-sm font-medium">Spend Shield</p>
          <p className="text-xs text-text3">Find negative keywords</p>
        </div>
      </Link>

      {/* Boost Winners */}
      {winnerCount > 0 && (
        <Link
          href="/campaigns/create"
          className="flex items-center gap-2 px-4 py-2.5 bg-surface2 hover:bg-divider text-text rounded-xl transition-colors"
        >
          <div className="w-6 h-6 rounded-lg bg-success/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-success">Boost {winnerCount} Winners</p>
            <p className="text-xs text-text3">Increase budget</p>
          </div>
        </Link>
      )}

      {/* Insight Hub Link */}
      <Link
        href="/command"
        className="flex items-center gap-2 px-4 py-2.5 bg-surface2 hover:bg-divider text-text rounded-xl transition-colors"
      >
        <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">
          🧠
        </div>
        <div className="text-left">
          <p className="text-sm font-medium">Insight Hub</p>
          <p className="text-xs text-text3">Ask AI anything</p>
        </div>
      </Link>

      {/* Waster Threshold Settings */}
      <div className="relative">
        <button
          onClick={() => setShowThresholdMenu(!showThresholdMenu)}
          onBlur={() => setTimeout(() => setShowThresholdMenu(false), 150)}
          className="flex items-center gap-2 px-3 py-2 bg-surface2 hover:bg-divider text-text2 text-sm rounded-xl transition-colors"
          title="Configure waster threshold"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span>Score &lt; {wasterThreshold}</span>
        </button>
        {showThresholdMenu && (
          <div className="absolute top-full left-0 mt-1 bg-surface rounded-xl shadow-lg border border-divider overflow-hidden z-50 w-48">
            <div className="p-3 border-b border-divider">
              <p className="text-xs text-text3 mb-2">Waster = AI Score below:</p>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={wasterThreshold}
                onChange={(e) => setWasterThreshold(parseInt(e.target.value))}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-xs text-text3 mt-1">
                <span>10</span>
                <span className="font-medium text-red-500">{wasterThreshold}</span>
                <span>60</span>
              </div>
            </div>
            <div className="p-2 text-xs text-text3 bg-surface2/50">
              Campaigns with AI Score &lt; {wasterThreshold} are marked as wasters
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Keyboard shortcuts hint */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-text3">
        <kbd className="px-1.5 py-0.5 bg-surface2 rounded text-text3">P</kbd>
        <span>Pause</span>
        <kbd className="px-1.5 py-0.5 bg-surface2 rounded text-text3 ml-2">B</kbd>
        <span>Budget</span>
      </div>

      {/* Pause Wasters Confirmation Modal */}
      <ConfirmModal
        isOpen={showPauseConfirm}
        onClose={() => setShowPauseConfirm(false)}
        onConfirm={confirmPauseWasters}
        title={`Pause ${wasterCount} Waster${wasterCount > 1 ? 's' : ''}?`}
        message={`This will pause ${wasterCount} underperforming campaign${wasterCount > 1 ? 's' : ''} with a combined daily budget of ~$${Math.round(potentialSavings).toLocaleString()}. They will stop showing ads immediately.`}
        confirmText={`Pause ${wasterCount} Campaign${wasterCount > 1 ? 's' : ''}`}
        confirmVariant="warning"
      />
    </div>
  );
}
