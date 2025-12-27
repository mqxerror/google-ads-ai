'use client';

import { useState, useEffect } from 'react';
import { GeneratedKeyword } from '@/app/keyword-factory/types';

interface WizardStep1Props {
  data: any;
  onUpdate: (updates: any) => void;
  preSelectedKeywords?: GeneratedKeyword[];
}

const CAMPAIGN_TYPES = [
  { value: 'SEARCH', label: 'Search', icon: '🔍', description: 'Text ads on Google Search' },
  { value: 'PERFORMANCE_MAX', label: 'Performance Max', icon: '🚀', description: 'AI-optimized across all Google' },
  { value: 'SHOPPING', label: 'Shopping', icon: '🛍️', description: 'Product listings on Google' },
];

const GOALS = [
  { value: 'LEADS', label: 'Leads', icon: '📧', description: 'Get contact information' },
  { value: 'SALES', label: 'Sales', icon: '💳', description: 'Drive online purchases' },
  { value: 'TRAFFIC', label: 'Traffic', icon: '👥', description: 'Increase website visits' },
];

const LOCATIONS = [
  { value: '2840', label: 'United States' },
  { value: '2124', label: 'Canada' },
  { value: '2826', label: 'United Kingdom' },
  { value: '2036', label: 'Australia' },
  { value: '21137', label: 'All countries' },
];

export default function WizardStep1Campaign({ data, onUpdate, preSelectedKeywords = [] }: WizardStep1Props) {
  const [estimatedDailyCost, setEstimatedDailyCost] = useState({ min: 0, max: 0 });

  // Calculate estimated cost based on keywords CPC
  useEffect(() => {
    if (preSelectedKeywords.length > 0) {
      const avgCpc = preSelectedKeywords.reduce((sum, kw) => sum + (kw.metrics?.cpc || 0), 0) / preSelectedKeywords.length;
      const estimatedClicks = 20; // Assume 20 clicks per day initially
      const min = avgCpc * estimatedClicks * 0.7; // 30% lower
      const max = avgCpc * estimatedClicks * 1.3; // 30% higher
      setEstimatedDailyCost({ min, max });
    } else {
      // Default estimates based on campaign type
      const estimates = {
        SEARCH: { min: 30, max: 60 },
        PERFORMANCE_MAX: { min: 50, max: 100 },
        SHOPPING: { min: 40, max: 80 },
      };
      setEstimatedDailyCost(estimates[data.campaignType as keyof typeof estimates] || { min: 30, max: 60 });
    }
  }, [data.campaignType, preSelectedKeywords]);

  return (
    <div className="space-y-8">
      {/* Campaign Name */}
      <div>
        <label className="block text-sm font-medium text-text mb-2">
          Campaign name <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          value={data.campaignName || ''}
          onChange={(e) => onUpdate({ campaignName: e.target.value })}
          placeholder="e.g., Portugal Golden Visa - US"
          className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
        />
        <p className="mt-1.5 text-xs text-text3">
          Choose a descriptive name that helps you identify this campaign
        </p>
      </div>

      {/* Campaign Type */}
      <div>
        <label className="block text-sm font-medium text-text mb-3">
          Campaign type <span className="text-danger">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {CAMPAIGN_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => onUpdate({ campaignType: type.value })}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                data.campaignType === type.value
                  ? 'border-accent bg-accent/10'
                  : 'border-divider bg-surface2 hover:border-accent/50'
              }`}
            >
              <div className="text-2xl mb-2">{type.icon}</div>
              <div className="font-medium text-text text-sm">{type.label}</div>
              <div className="text-xs text-text3 mt-1">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Goal */}
      <div>
        <label className="block text-sm font-medium text-text mb-3">
          Campaign goal <span className="text-danger">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {GOALS.map((goal) => (
            <button
              key={goal.value}
              onClick={() => onUpdate({ goal: goal.value })}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                data.goal === goal.value
                  ? 'border-accent bg-accent/10'
                  : 'border-divider bg-surface2 hover:border-accent/50'
              }`}
            >
              <div className="text-2xl mb-2">{goal.icon}</div>
              <div className="font-medium text-text text-sm">{goal.label}</div>
              <div className="text-xs text-text3 mt-1">{goal.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Target Location */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Target location <span className="text-danger">*</span>
          </label>
          <select
            value={data.targetLocation || '2840'}
            onChange={(e) => onUpdate({ targetLocation: e.target.value })}
            className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc.value} value={loc.value}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Language
          </label>
          <select
            value={data.language || 'en'}
            onChange={(e) => onUpdate({ language: e.target.value })}
            className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
          </select>
        </div>
      </div>

      {/* Estimated Cost Preview */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">💰</span>
          <span className="font-medium text-text">Estimated daily cost</span>
        </div>
        <div className="text-2xl font-bold text-text">
          ${estimatedDailyCost.min.toFixed(0)} - ${estimatedDailyCost.max.toFixed(0)}
        </div>
        <p className="text-xs text-text3 mt-2">
          Based on {preSelectedKeywords.length > 0 ? `${preSelectedKeywords.length} selected keywords` : 'typical campaign performance'}.
          Final cost depends on budget settings in Step 4.
        </p>
      </div>

      {/* Keywords Summary (if pre-selected) */}
      {preSelectedKeywords.length > 0 && (
        <div className="bg-surface2 rounded-lg p-4 border border-divider">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <span className="font-medium text-text">Selected keywords</span>
            </div>
            <span className="text-sm text-text3">{preSelectedKeywords.length} keywords</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {preSelectedKeywords.slice(0, 10).map((kw, i) => (
              <span key={i} className="px-2.5 py-1 bg-surface rounded text-xs text-text2 border border-divider">
                {kw.keyword}
              </span>
            ))}
            {preSelectedKeywords.length > 10 && (
              <span className="px-2.5 py-1 text-xs text-text3">
                +{preSelectedKeywords.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
