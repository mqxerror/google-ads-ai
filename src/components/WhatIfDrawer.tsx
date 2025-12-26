'use client';

import { useState, useEffect } from 'react';
import { Campaign } from '@/types/campaign';

interface WhatIfDrawerProps {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
}

// AI Score weights (from PRD v2.1)
const WEIGHTS = {
  ctr: 0.35,
  convRate: 0.30,
  cpc: 0.20,
  qualityScore: 0.15,
};

export default function WhatIfDrawer({ campaign, isOpen, onClose }: WhatIfDrawerProps) {
  // Calculate CPC from spend/clicks
  const calculatedCpc = campaign.spend / Math.max(campaign.clicks || 1, 1);

  // Current values
  const [ctr, setCtr] = useState(campaign.ctr);
  const [convRate, setConvRate] = useState((campaign.conversions / Math.max(campaign.clicks || 1, 1)) * 100);
  const [cpc, setCpc] = useState(calculatedCpc);
  const [qualityScore, setQualityScore] = useState(7); // Default QS

  // Calculate projected AI Score
  const calculateScore = (ctrVal: number, convVal: number, cpcVal: number, qsVal: number) => {
    const ctrScore = Math.min(ctrVal / 5, 1) * 100; // 5% CTR = 100
    const convScore = Math.min(convVal / 10, 1) * 100; // 10% conv = 100
    const cpcScore = Math.max(0, 100 - (cpcVal / 10) * 100); // Lower CPC = higher score
    const qsScore = (qsVal / 10) * 100;

    return Math.round(
      ctrScore * WEIGHTS.ctr +
      convScore * WEIGHTS.convRate +
      cpcScore * WEIGHTS.cpc +
      qsScore * WEIGHTS.qualityScore
    );
  };

  const currentScore = campaign.aiScore;
  const projectedScore = calculateScore(ctr, convRate, cpc, qualityScore);
  const scoreDiff = projectedScore - currentScore;

  // Calculate financial impact
  const projectedSavings = scoreDiff > 0 ? (scoreDiff * campaign.spend * 0.01).toFixed(2) : '0';

  // Reset values when campaign changes
  useEffect(() => {
    setCtr(campaign.ctr);
    setConvRate((campaign.conversions / Math.max(campaign.clicks || 1, 1)) * 100);
    setCpc(campaign.spend / Math.max(campaign.clicks || 1, 1));
    setQualityScore(7);
  }, [campaign]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-[450px] bg-surface h-full shadow-xl overflow-y-auto animate-slideInRight">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-divider p-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text">What-If Scenario</h2>
              <p className="text-sm text-text3">{campaign.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface2 rounded-lg text-text3"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Score Comparison */}
        <div className="p-4 border-b border-divider">
          <div className="flex items-center justify-between gap-4">
            <div className="text-center">
              <div className="text-xs text-text3 mb-1">Current</div>
              <div className={`text-3xl font-bold ${
                currentScore >= 70 ? 'text-success' : currentScore >= 40 ? 'text-warning' : 'text-danger'
              }`}>
                {currentScore}
              </div>
            </div>

            <div className="text-2xl text-text3">→</div>

            <div className="text-center">
              <div className="text-xs text-text3 mb-1">Projected</div>
              <div className={`text-3xl font-bold ${
                projectedScore >= 70 ? 'text-success' : projectedScore >= 40 ? 'text-warning' : 'text-danger'
              }`}>
                {projectedScore}
              </div>
            </div>

            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              scoreDiff > 0 ? 'bg-success/10 text-success' : scoreDiff < 0 ? 'bg-danger/10 text-danger' : 'bg-surface2 text-text3'
            }`}>
              {scoreDiff > 0 ? '+' : ''}{scoreDiff} pts
            </div>
          </div>
        </div>

        {/* Score Breakdown Bar */}
        <div className="p-4 border-b border-divider">
          <div className="text-xs text-text3 mb-2">Score Breakdown</div>
          <div className="h-3 rounded-full bg-surface2 overflow-hidden flex">
            <div className="bg-blue-500 h-full" style={{ width: `${WEIGHTS.ctr * 100}%` }} title="CTR (35%)" />
            <div className="bg-green-500 h-full" style={{ width: `${WEIGHTS.convRate * 100}%` }} title="Conv Rate (30%)" />
            <div className="bg-yellow-500 h-full" style={{ width: `${WEIGHTS.cpc * 100}%` }} title="CPC (20%)" />
            <div className="bg-purple-500 h-full" style={{ width: `${WEIGHTS.qualityScore * 100}%` }} title="Quality Score (15%)" />
          </div>
          <div className="flex text-xs text-text3 mt-1 gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500" /> CTR 35%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500" /> Conv 30%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-500" /> CPC 20%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500" /> QS 15%</span>
          </div>
        </div>

        {/* Sliders */}
        <div className="p-4 space-y-6">
          {/* CTR Slider */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text2">Click-Through Rate</span>
              <span className="text-text font-medium">{ctr.toFixed(2)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={ctr}
              onChange={(e) => setCtr(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer slider-blue"
            />
            <div className="flex justify-between text-xs text-text3 mt-1">
              <span>0%</span>
              <span>Current: {campaign.ctr.toFixed(2)}%</span>
              <span>10%</span>
            </div>
          </div>

          {/* Conversion Rate Slider */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text2">Conversion Rate</span>
              <span className="text-text font-medium">{convRate.toFixed(2)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={convRate}
              onChange={(e) => setConvRate(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer slider-green"
            />
            <div className="flex justify-between text-xs text-text3 mt-1">
              <span>0%</span>
              <span>20%</span>
            </div>
          </div>

          {/* CPC Slider */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text2">Cost per Click</span>
              <span className="text-text font-medium">${cpc.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={cpc}
              onChange={(e) => setCpc(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer slider-yellow"
            />
            <div className="flex justify-between text-xs text-text3 mt-1">
              <span>$0.10</span>
              <span>Lower is better</span>
              <span>$20</span>
            </div>
          </div>

          {/* Quality Score Slider */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text2">Quality Score</span>
              <span className="text-text font-medium">{qualityScore}/10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={qualityScore}
              onChange={(e) => setQualityScore(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer slider-purple"
            />
            <div className="flex justify-between text-xs text-text3 mt-1">
              <span>1</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* AI Insight */}
        <div className="p-4 mx-4 mb-4 bg-accent/10 rounded-xl border border-accent/20">
          <div className="flex items-start gap-3">
            <span className="text-xl">✨</span>
            <div>
              <div className="text-sm font-medium text-accent mb-1">Claude&apos;s Insight</div>
              <p className="text-sm text-text2">
                {scoreDiff > 10
                  ? `Increasing CTR to ${ctr.toFixed(1)}% could boost your AI Score by ${scoreDiff} points, translating to an estimated $${projectedSavings} savings.`
                  : scoreDiff > 0
                  ? `These adjustments would improve your score slightly. Focus on CTR improvements for the biggest impact.`
                  : scoreDiff < 0
                  ? `These changes would decrease performance. Consider improving Quality Score or lowering CPC instead.`
                  : `Current metrics are optimal. Small CTR improvements could yield better results.`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Financial Impact */}
        {scoreDiff > 0 && (
          <div className="p-4 mx-4 mb-4 bg-success/10 rounded-xl border border-success/20">
            <div className="text-center">
              <div className="text-xs text-success mb-1">Potential Monthly Savings</div>
              <div className="text-2xl font-bold text-success">${projectedSavings}</div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .slider-blue::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        .slider-green::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #22c55e;
          cursor: pointer;
        }
        .slider-yellow::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #eab308;
          cursor: pointer;
        }
        .slider-purple::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #a855f7;
          cursor: pointer;
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
