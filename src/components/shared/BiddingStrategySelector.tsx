'use client';

import React from 'react';
import type { BiddingStrategy, CampaignType } from '@/types/campaign';
import { BIDDING_STRATEGIES, getBiddingStrategiesForType } from '@/constants/campaign';

interface BiddingStrategySelectorProps {
  value: BiddingStrategy;
  onChange: (strategy: BiddingStrategy) => void;
  campaignType?: CampaignType;
  targetCpa?: number;
  targetRoas?: number;
  onTargetCpaChange?: (value: number | undefined) => void;
  onTargetRoasChange?: (value: number | undefined) => void;
  showTargetInputs?: boolean;
  currency?: string;
  className?: string;
}

/**
 * Reusable bidding strategy selector with optional CPA/ROAS inputs
 * Use in: Search, PMax, Display, Demand Gen, Video campaigns
 */
export function BiddingStrategySelector({
  value,
  onChange,
  campaignType,
  targetCpa,
  targetRoas,
  onTargetCpaChange,
  onTargetRoasChange,
  showTargetInputs = true,
  currency = '$',
  className = '',
}: BiddingStrategySelectorProps) {
  // Get strategies appropriate for campaign type, or all if not specified
  const availableStrategies = campaignType
    ? getBiddingStrategiesForType(campaignType)
    : (Object.keys(BIDDING_STRATEGIES) as BiddingStrategy[]);

  const selectedInfo = BIDDING_STRATEGIES[value];

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-text mb-2">
        Bidding Strategy
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value as BiddingStrategy)}
        className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
      >
        {availableStrategies.map((strategy) => (
          <option key={strategy} value={strategy}>
            {BIDDING_STRATEGIES[strategy].label}
          </option>
        ))}
      </select>

      {/* Strategy description */}
      <p className="text-xs text-text3 mt-1.5">
        {selectedInfo.description}
      </p>

      {/* Target CPA input */}
      {showTargetInputs && selectedInfo.requiresTarget === 'cpa' && onTargetCpaChange && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-text mb-2">
            Target CPA
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text3">
              {currency}
            </span>
            <input
              type="number"
              value={targetCpa || ''}
              onChange={(e) => onTargetCpaChange(parseFloat(e.target.value) || undefined)}
              placeholder="e.g., 25"
              min={0}
              step="0.01"
              className="w-full pl-8 pr-4 py-3 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
            />
          </div>
          <p className="text-xs text-text3 mt-1">
            Average amount you want to pay per conversion
          </p>
        </div>
      )}

      {/* Target ROAS input */}
      {showTargetInputs && selectedInfo.requiresTarget === 'roas' && onTargetRoasChange && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-text mb-2">
            Target ROAS (%)
          </label>
          <div className="relative">
            <input
              type="number"
              value={targetRoas || ''}
              onChange={(e) => onTargetRoasChange(parseFloat(e.target.value) || undefined)}
              placeholder="e.g., 400"
              min={0}
              step="1"
              className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text3">
              %
            </span>
          </div>
          <p className="text-xs text-text3 mt-1">
            Target return on ad spend (e.g., 400% means {currency}4 return for every {currency}1 spent)
          </p>
        </div>
      )}
    </div>
  );
}

export default BiddingStrategySelector;
