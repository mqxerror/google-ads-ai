'use client';

import { useState, useEffect, useMemo } from 'react';
import { Campaign } from '@/types/campaign';

interface ScoreDriver {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  status: 'good' | 'warning' | 'critical';
  whyExplanation: string;
  whatToChange: string;
  estimatedImpact: number;
  confidence: 'high' | 'medium' | 'low';
}

interface ScoreBreakdownDrawerProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ScoreBreakdownDrawer({ campaign, isOpen, onClose }: ScoreBreakdownDrawerProps) {
  const [showAllDrivers, setShowAllDrivers] = useState(false);

  // Generate score drivers based on campaign metrics
  const drivers = useMemo((): ScoreDriver[] => {
    if (!campaign) return [];

    const spend = campaign.spend ?? 0;
    const clicks = campaign.clicks ?? 0;
    const conversions = campaign.conversions ?? 0;
    const ctr = campaign.ctr ?? 0;
    const cpa = campaign.cpa ?? 0;

    return [
      {
        id: 'conversion-efficiency',
        name: 'Conversion Efficiency',
        score: conversions > 0 ? Math.min(25, Math.round(25 * (1 - Math.min(cpa / 100, 1)))) : 5,
        maxScore: 25,
        weight: 0.25,
        status: cpa < 50 ? 'good' : cpa < 80 ? 'warning' : 'critical',
        whyExplanation: cpa < 50
          ? `Strong CPA of $${cpa.toFixed(0)} indicates efficient conversion funnel`
          : cpa < 80
          ? `CPA of $${cpa.toFixed(0)} is acceptable but has room for improvement`
          : `High CPA of $${cpa.toFixed(0)} suggests inefficient spend or targeting issues`,
        whatToChange: cpa >= 50
          ? 'Review search terms for irrelevant queries. Consider tightening match types or adding negative keywords.'
          : 'Maintain current targeting. Consider scaling budget on this campaign.',
        estimatedImpact: cpa >= 80 ? 15 : cpa >= 50 ? 8 : 3,
        confidence: conversions > 10 ? 'high' : conversions > 3 ? 'medium' : 'low',
      },
      {
        id: 'click-quality',
        name: 'Click Quality (CTR)',
        score: Math.min(20, Math.round(ctr * 2.5)),
        maxScore: 20,
        weight: 0.20,
        status: ctr >= 5 ? 'good' : ctr >= 2 ? 'warning' : 'critical',
        whyExplanation: ctr >= 5
          ? `Excellent CTR of ${ctr.toFixed(2)}% shows strong ad relevance`
          : ctr >= 2
          ? `CTR of ${ctr.toFixed(2)}% is average. Ads may need optimization`
          : `Low CTR of ${ctr.toFixed(2)}% indicates poor ad-query alignment`,
        whatToChange: ctr < 5
          ? 'Test new ad copy highlighting unique value props. Ensure keywords match ad messaging.'
          : 'A/B test variations to push CTR even higher.',
        estimatedImpact: ctr < 2 ? 12 : ctr < 5 ? 6 : 2,
        confidence: clicks > 100 ? 'high' : clicks > 30 ? 'medium' : 'low',
      },
      {
        id: 'budget-utilization',
        name: 'Budget Utilization',
        score: spend > 0 ? Math.min(20, Math.round(20 * Math.min(spend / ((campaign.dailyBudget ?? 100) * 30), 1))) : 5,
        maxScore: 20,
        weight: 0.20,
        status: spend / ((campaign.dailyBudget ?? 100) * 30) > 0.8 ? 'good' : spend / ((campaign.dailyBudget ?? 100) * 30) > 0.5 ? 'warning' : 'critical',
        whyExplanation: spend / ((campaign.dailyBudget ?? 100) * 30) > 0.8
          ? 'Campaign is spending near budget capacity - good demand signal'
          : spend / ((campaign.dailyBudget ?? 100) * 30) > 0.5
          ? 'Moderate spend suggests limited impression share or tight targeting'
          : 'Low spend may indicate targeting issues, bid competitiveness, or quality problems',
        whatToChange: spend / ((campaign.dailyBudget ?? 100) * 30) < 0.5
          ? 'Check impression share. Consider broadening keywords or increasing bids.'
          : 'Consider increasing budget to capture more volume.',
        estimatedImpact: spend / ((campaign.dailyBudget ?? 100) * 30) < 0.5 ? 10 : 4,
        confidence: 'high',
      },
      {
        id: 'volume-signal',
        name: 'Volume Signal Strength',
        score: Math.min(20, Math.round(Math.log10(clicks + 1) * 5)),
        maxScore: 20,
        weight: 0.20,
        status: clicks > 500 ? 'good' : clicks > 100 ? 'warning' : 'critical',
        whyExplanation: clicks > 500
          ? `Strong volume of ${clicks.toLocaleString()} clicks provides reliable performance data`
          : clicks > 100
          ? `${clicks.toLocaleString()} clicks is moderate - trends may be noisy`
          : `Low volume of ${clicks.toLocaleString()} clicks - insufficient data for confident optimization`,
        whatToChange: clicks < 100
          ? 'Expand targeting or increase budget to gather more data before making changes.'
          : 'Sufficient volume for optimization. Focus on improving efficiency metrics.',
        estimatedImpact: clicks < 100 ? 5 : 2,
        confidence: 'high',
      },
      {
        id: 'conversion-coverage',
        name: 'Conversion Coverage',
        score: conversions > 0 ? Math.min(15, conversions) : 0,
        maxScore: 15,
        weight: 0.15,
        status: conversions >= 10 ? 'good' : conversions >= 3 ? 'warning' : 'critical',
        whyExplanation: conversions >= 10
          ? `${conversions} conversions provides strong signal for optimization`
          : conversions >= 3
          ? `${conversions} conversions - learning phase, algorithms need more data`
          : `${conversions} conversions - campaign may be struggling or targeting is off`,
        whatToChange: conversions < 3
          ? 'Review conversion tracking setup. Consider micro-conversions or broader targeting.'
          : 'Sufficient conversions. Let automated bidding optimize or manually adjust bids.',
        estimatedImpact: conversions < 3 ? 8 : 3,
        confidence: conversions >= 10 ? 'high' : 'low',
      },
    ];
  }, [campaign]);

  // Calculate total score from drivers
  const calculatedScore = useMemo(() => {
    return drivers.reduce((sum, d) => sum + d.score, 0);
  }, [drivers]);

  // Sort drivers by impact opportunity
  const sortedDrivers = useMemo(() => {
    return [...drivers].sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  }, [drivers]);

  // Top issue (highest impact)
  const topIssue = sortedDrivers.find(d => d.status !== 'good');

  // Sparkline data (simulated trend)
  const trendData = useMemo(() => {
    const base = campaign?.aiScore ?? calculatedScore;
    return Array.from({ length: 7 }, (_, i) => {
      const variance = (Math.random() - 0.5) * 10;
      return Math.max(0, Math.min(100, base + variance - (6 - i) * 2));
    });
  }, [campaign?.aiScore, calculatedScore]);

  if (!isOpen || !campaign) return null;

  const score = campaign.aiScore ?? calculatedScore;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-surface shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-divider">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text">Score Breakdown</h2>
              <p className="text-sm text-text3 mt-1">{campaign.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface2 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Score with sparkline */}
          <div className="mt-4 flex items-center gap-6">
            <div className={`text-5xl font-bold ${
              score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-danger'
            }`}>
              {score}
            </div>
            <div className="flex-1">
              <p className="text-xs text-text3 mb-1">7-day trend</p>
              <div className="flex items-end gap-0.5 h-8">
                {trendData.map((val, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${i === trendData.length - 1 ? 'bg-accent' : 'bg-surface2'}`}
                    style={{ height: `${(val / 100) * 100}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-text">
                {score >= 70 ? 'Strong' : score >= 40 ? 'Needs Work' : 'Critical'}
              </p>
              <p className="text-xs text-text3">
                {trendData[trendData.length - 1] > trendData[0] ? 'Improving' : 'Declining'} trend
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Top issue callout */}
          {topIssue && (
            <div className={`p-4 rounded-xl mb-6 ${
              topIssue.status === 'critical' ? 'bg-danger/10 border border-danger/20' : 'bg-warning/10 border border-warning/20'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${topIssue.status === 'critical' ? 'bg-danger/20' : 'bg-warning/20'}`}>
                  <svg className={`w-5 h-5 ${topIssue.status === 'critical' ? 'text-danger' : 'text-warning'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-text">Top Priority: {topIssue.name}</p>
                  <p className="text-sm text-text2 mt-1">{topIssue.whatToChange}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs bg-surface px-2 py-1 rounded">
                      +{topIssue.estimatedImpact} pts potential
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      topIssue.confidence === 'high' ? 'bg-success/20 text-success' :
                      topIssue.confidence === 'medium' ? 'bg-warning/20 text-warning' :
                      'bg-text3/20 text-text3'
                    }`}>
                      {topIssue.confidence} confidence
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Score drivers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-text">Score Drivers</h3>
              <button
                onClick={() => setShowAllDrivers(!showAllDrivers)}
                className="text-sm text-accent hover:underline"
              >
                {showAllDrivers ? 'Show less' : 'Show all'}
              </button>
            </div>

            <div className="space-y-4">
              {(showAllDrivers ? sortedDrivers : sortedDrivers.slice(0, 3)).map((driver) => (
                <div key={driver.id} className="bg-surface2/50 rounded-xl p-4">
                  {/* Driver header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        driver.status === 'good' ? 'bg-success' :
                        driver.status === 'warning' ? 'bg-warning' : 'bg-danger'
                      }`} />
                      <span className="font-medium text-text">{driver.name}</span>
                    </div>
                    <span className="text-sm text-text2">
                      {driver.score}/{driver.maxScore}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-surface rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${
                        driver.status === 'good' ? 'bg-success' :
                        driver.status === 'warning' ? 'bg-warning' : 'bg-danger'
                      }`}
                      style={{ width: `${(driver.score / driver.maxScore) * 100}%` }}
                    />
                  </div>

                  {/* Why explanation */}
                  <p className="text-sm text-text2 mb-2">{driver.whyExplanation}</p>

                  {/* What to change */}
                  {driver.status !== 'good' && (
                    <div className="mt-3 pt-3 border-t border-divider">
                      <p className="text-xs text-text3 mb-1">Recommendation:</p>
                      <p className="text-sm text-text">{driver.whatToChange}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">
                          +{driver.estimatedImpact} pts
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          driver.confidence === 'high' ? 'bg-success/10 text-success' :
                          driver.confidence === 'medium' ? 'bg-warning/10 text-warning' :
                          'bg-text3/10 text-text3'
                        }`}>
                          {driver.confidence} confidence
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-divider bg-surface2/30">
          <div className="flex items-center justify-between text-xs text-text3">
            <span>Score updated {new Date().toLocaleDateString()}</span>
            <span>Based on last 30 days of data</span>
          </div>
        </div>
      </div>
    </>
  );
}
