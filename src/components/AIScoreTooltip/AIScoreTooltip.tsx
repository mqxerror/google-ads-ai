'use client';

import { useState, useRef, useCallback } from 'react';
import { Campaign } from '@/types/campaign';
import { CampaignHealth } from '@/types/health';

interface AIScoreTooltipProps {
  score: number;
  campaign: Campaign;
  health?: CampaignHealth;
  size?: 'sm' | 'md';
}

interface ScoreDriver {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  detail: string;
}

// Generate score drivers based on campaign data
function getScoreDrivers(campaign: Campaign, health?: CampaignHealth): ScoreDriver[] {
  const drivers: ScoreDriver[] = [];

  // CPA Analysis
  if (campaign.cpa > 0) {
    if (campaign.cpa < 50) {
      drivers.push({
        factor: 'Strong CPA',
        impact: 'positive',
        weight: 25,
        detail: `$${campaign.cpa.toFixed(2)} CPA is within efficient range`,
      });
    } else if (campaign.cpa > 80) {
      drivers.push({
        factor: 'High CPA',
        impact: 'negative',
        weight: -20,
        detail: `$${campaign.cpa.toFixed(2)} CPA is above target threshold`,
      });
    }
  }

  // CTR Analysis
  if (campaign.ctr > 3) {
    drivers.push({
      factor: 'High CTR',
      impact: 'positive',
      weight: 15,
      detail: `${campaign.ctr.toFixed(2)}% CTR indicates strong ad relevance`,
    });
  } else if (campaign.ctr < 1.5) {
    drivers.push({
      factor: 'Low CTR',
      impact: 'negative',
      weight: -15,
      detail: `${campaign.ctr.toFixed(2)}% CTR suggests ad copy needs improvement`,
    });
  }

  // Conversion Volume
  if (campaign.conversions > 20) {
    drivers.push({
      factor: 'Good Volume',
      impact: 'positive',
      weight: 20,
      detail: `${campaign.conversions} conversions provides statistical confidence`,
    });
  } else if (campaign.conversions < 5) {
    drivers.push({
      factor: 'Low Volume',
      impact: 'negative',
      weight: -10,
      detail: `Only ${campaign.conversions} conversions - limited data for optimization`,
    });
  }

  // ROAS Analysis
  if (campaign.roas > 3) {
    drivers.push({
      factor: 'Strong ROAS',
      impact: 'positive',
      weight: 25,
      detail: `${campaign.roas.toFixed(2)}x return on ad spend`,
    });
  } else if (campaign.roas > 0 && campaign.roas < 1.5) {
    drivers.push({
      factor: 'Low ROAS',
      impact: 'negative',
      weight: -25,
      detail: `${campaign.roas.toFixed(2)}x ROAS is below profitability threshold`,
    });
  }

  // Health issues
  if (health?.issues && health.issues.length > 0) {
    const criticalCount = health.issues.filter(i => i.severity === 'critical').length;
    if (criticalCount > 0) {
      drivers.push({
        factor: 'Critical Issues',
        impact: 'negative',
        weight: -30,
        detail: `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} detected`,
      });
    }
  }

  // Sort by absolute weight
  return drivers.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 4);
}

export default function AIScoreTooltip({ score, campaign, health, size = 'md' }: AIScoreTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const drivers = getScoreDrivers(campaign, health);

  // Determine score color
  const getScoreColor = (s: number) => {
    if (s >= 75) return { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-500/20' };
    if (s >= 50) return { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-500/20' };
    return { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-500/20' };
  };

  const colors = getScoreColor(score);

  // Calculate position when opening tooltip
  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setPosition(spaceBelow < 300 ? 'top' : 'bottom');
    }
    setIsOpen(true);
  }, []);

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        onClick={() => isOpen ? setIsOpen(false) : handleOpen()}
        onMouseEnter={handleOpen}
        onMouseLeave={() => setIsOpen(false)}
        className={`inline-flex items-center gap-1.5 ${
          size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
        } rounded-lg ${colors.bg} ${colors.text} ring-1 ${colors.ring} hover:ring-2 transition-all cursor-pointer group`}
      >
        <span className={`font-bold ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{score}</span>
        <svg
          className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} opacity-60 group-hover:opacity-100 transition-opacity`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Tooltip */}
      {isOpen && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-1/2 -translate-x-1/2`}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {/* Header */}
          <div className={`px-4 py-3 ${colors.bg}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${colors.text}`}>AI Health Score</span>
              <span className={`text-2xl font-bold ${colors.text}`}>{score}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {score >= 75 ? 'Campaign performing well' :
               score >= 50 ? 'Room for optimization' :
               'Needs attention'}
            </p>
          </div>

          {/* Drivers */}
          <div className="p-3 space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Score Factors</h4>
            {drivers.map((driver, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  driver.impact === 'positive' ? 'bg-emerald-100' :
                  driver.impact === 'negative' ? 'bg-rose-100' :
                  'bg-gray-100'
                }`}>
                  {driver.impact === 'positive' ? (
                    <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : driver.impact === 'negative' ? (
                    <svg className="w-3 h-3 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{driver.factor}</span>
                    <span className={`text-xs font-semibold ${
                      driver.impact === 'positive' ? 'text-emerald-600' :
                      driver.impact === 'negative' ? 'text-rose-600' :
                      'text-gray-500'
                    }`}>
                      {driver.weight > 0 ? '+' : ''}{driver.weight}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{driver.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-3 py-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Click for detailed analysis
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
