'use client';

import { useState, useEffect } from 'react';

interface WizardStep4Props {
  data: any;
  onUpdate: (updates: any) => void;
}

const BIDDING_STRATEGIES = [
  {
    value: 'MAXIMIZE_CONVERSIONS',
    label: 'Maximize Conversions',
    icon: '🎯',
    description: 'Get the most conversions within your budget (recommended for most campaigns)',
  },
  {
    value: 'TARGET_CPA',
    label: 'Target CPA',
    icon: '💰',
    description: 'Automatically set bids to get conversions at your target cost-per-acquisition',
  },
  {
    value: 'MANUAL_CPC',
    label: 'Manual CPC',
    icon: '✋',
    description: 'Set your own maximum cost-per-click bids (advanced)',
  },
];

const PREBUILT_NEGATIVE_LISTS = [
  {
    id: 'free_seekers',
    name: 'Free Seekers',
    keywords: ['free', 'gratis', 'no cost', 'without paying', 'complimentary', '0 cost', 'at no charge'],
    description: 'Exclude users looking for free options',
  },
  {
    id: 'job_seekers',
    name: 'Job Seekers',
    keywords: ['job', 'jobs', 'career', 'careers', 'employment', 'hiring', 'resume', 'salary', 'work from home'],
    description: 'Exclude job seekers and recruiters',
  },
  {
    id: 'diy',
    name: 'DIY / Tutorial Seekers',
    keywords: ['how to', 'tutorial', 'diy', 'guide', 'course', 'learn', 'training', 'instructions'],
    description: 'Exclude users looking for educational content',
  },
  {
    id: 'informational',
    name: 'Informational Only',
    keywords: ['what is', 'definition', 'meaning', 'explain', 'wikipedia', 'pdf', 'download'],
    description: 'Exclude purely informational queries',
  },
];

export default function WizardStep4Budget({ data, onUpdate }: WizardStep4Props) {
  const [dailyBudget, setDailyBudget] = useState(data.dailyBudget || 50);
  const [biddingStrategy, setBiddingStrategy] = useState(data.biddingStrategy || 'MAXIMIZE_CONVERSIONS');
  const [targetCpa, setTargetCpa] = useState(data.targetCpa || 0);
  const [selectedNegativeLists, setSelectedNegativeLists] = useState<string[]>([]);
  const [customNegatives, setCustomNegatives] = useState('');
  const [costEstimate, setCostEstimate] = useState({
    dailyClicks: 0,
    monthlyClicks: 0,
    monthlyCost: 0,
    avgCpc: 0,
  });

  // Calculate cost estimates
  useEffect(() => {
    if (data.adGroups && data.adGroups.length > 0) {
      // Calculate average CPC from all keywords
      const allKeywords = data.adGroups.flatMap((group: any) => group.keywords);
      const avgCpc =
        allKeywords.reduce((sum: number, kw: any) => sum + (kw.metrics?.cpc || 0), 0) / allKeywords.length || 2.5;

      const dailyClicks = Math.floor(dailyBudget / avgCpc);
      const monthlyClicks = dailyClicks * 30;
      const monthlyCost = dailyBudget * 30;

      setCostEstimate({
        dailyClicks,
        monthlyClicks,
        monthlyCost,
        avgCpc,
      });

      onUpdate({
        dailyBudget,
        biddingStrategy,
        targetCpa: biddingStrategy === 'TARGET_CPA' ? targetCpa : undefined,
        estimatedCost: {
          daily: dailyBudget,
          monthly: monthlyCost,
        },
      });
    }
  }, [dailyBudget, biddingStrategy, targetCpa, data.adGroups]);

  const handleBudgetChange = (value: number) => {
    setDailyBudget(value);
  };

  const handleBiddingStrategyChange = (strategy: string) => {
    setBiddingStrategy(strategy);
  };

  const toggleNegativeList = (listId: string) => {
    const newSelected = selectedNegativeLists.includes(listId)
      ? selectedNegativeLists.filter((id) => id !== listId)
      : [...selectedNegativeLists, listId];

    setSelectedNegativeLists(newSelected);

    // Compile all negative keywords
    const negativeKeywords = [
      ...PREBUILT_NEGATIVE_LISTS.filter((list) => newSelected.includes(list.id)).flatMap((list) => list.keywords),
      ...customNegatives.split('\n').filter((kw) => kw.trim().length > 0),
    ];

    onUpdate({ negativeKeywords });
  };

  const handleCustomNegativesChange = (value: string) => {
    setCustomNegatives(value);

    // Compile all negative keywords
    const negativeKeywords = [
      ...PREBUILT_NEGATIVE_LISTS.filter((list) => selectedNegativeLists.includes(list.id)).flatMap(
        (list) => list.keywords
      ),
      ...value.split('\n').filter((kw) => kw.trim().length > 0),
    ];

    onUpdate({ negativeKeywords });
  };

  return (
    <div className="space-y-8">
      {/* Daily Budget */}
      <div>
        <label className="block text-sm font-medium text-text mb-3">
          Daily budget <span className="text-danger">*</span>
        </label>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-text">${dailyBudget}</span>
            <span className="text-sm text-text3">per day</span>
          </div>

          <input
            type="range"
            min="10"
            max="500"
            step="10"
            value={dailyBudget}
            onChange={(e) => handleBudgetChange(Number(e.target.value))}
            className="w-full h-2 bg-surface2 rounded-lg appearance-none cursor-pointer accent-accent"
          />

          <div className="flex items-center justify-between text-xs text-text3">
            <span>$10/day</span>
            <span>$500/day</span>
          </div>

          <input
            type="number"
            min="10"
            value={dailyBudget}
            onChange={(e) => handleBudgetChange(Number(e.target.value))}
            className="w-32 px-4 py-2 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Bidding Strategy */}
      <div>
        <label className="block text-sm font-medium text-text mb-3">
          Bidding strategy <span className="text-danger">*</span>
        </label>
        <div className="space-y-3">
          {BIDDING_STRATEGIES.map((strategy) => (
            <button
              key={strategy.value}
              onClick={() => handleBiddingStrategyChange(strategy.value)}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                biddingStrategy === strategy.value
                  ? 'border-accent bg-accent/10'
                  : 'border-divider bg-surface2 hover:border-accent/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{strategy.icon}</div>
                <div className="flex-1">
                  <div className="font-medium text-text">{strategy.label}</div>
                  <div className="text-xs text-text3 mt-1">{strategy.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Target CPA (conditional) */}
      {biddingStrategy === 'TARGET_CPA' && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
          <label className="block text-sm font-medium text-text mb-2">
            Target cost per acquisition (CPA)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-text3">$</span>
            <input
              type="number"
              min="1"
              value={targetCpa}
              onChange={(e) => setTargetCpa(Number(e.target.value))}
              placeholder="e.g., 50"
              className="w-32 px-4 py-2 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
            />
          </div>
          <p className="text-xs text-text3 mt-2">
            Google will automatically adjust bids to get conversions at this target cost
          </p>
        </div>
      )}

      {/* Cost Estimates */}
      <div className="bg-surface2 border border-divider rounded-lg p-6">
        <h4 className="font-medium text-text mb-4 flex items-center gap-2">
          <span className="text-xl">📊</span>
          Cost Estimates
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-text3 mb-1">Estimated Daily Clicks</div>
            <div className="text-2xl font-bold text-text">{costEstimate.dailyClicks}</div>
            <div className="text-xs text-text3 mt-1">Based on avg CPC of ${costEstimate.avgCpc.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-text3 mb-1">Monthly Budget</div>
            <div className="text-2xl font-bold text-text">${costEstimate.monthlyCost.toFixed(0)}</div>
            <div className="text-xs text-text3 mt-1">~{costEstimate.monthlyClicks} clicks per month</div>
          </div>
        </div>
      </div>

      {/* Negative Keywords */}
      <div>
        <label className="block text-sm font-medium text-text mb-3">Negative keywords (optional)</label>
        <p className="text-xs text-text3 mb-4">
          Prevent your ads from showing for these search terms to save budget and improve targeting
        </p>

        {/* Pre-built Lists */}
        <div className="space-y-3 mb-4">
          <div className="text-xs font-medium text-text3 mb-2">PRE-BUILT LISTS</div>
          {PREBUILT_NEGATIVE_LISTS.map((list) => (
            <button
              key={list.id}
              onClick={() => toggleNegativeList(list.id)}
              className={`w-full p-3 rounded-lg border transition-all text-left ${
                selectedNegativeLists.includes(list.id)
                  ? 'border-accent bg-accent/10'
                  : 'border-divider bg-surface2 hover:border-accent/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-text text-sm">{list.name}</div>
                  <div className="text-xs text-text3 mt-0.5">{list.description}</div>
                  <div className="text-xs text-text3 mt-1">
                    {list.keywords.length} keywords:{' '}
                    {list.keywords.slice(0, 3).join(', ')}
                    {list.keywords.length > 3 ? '...' : ''}
                  </div>
                </div>
                {selectedNegativeLists.includes(list.id) && (
                  <div className="text-success">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Custom Negatives */}
        <div>
          <div className="text-xs font-medium text-text3 mb-2">CUSTOM NEGATIVE KEYWORDS</div>
          <textarea
            value={customNegatives}
            onChange={(e) => handleCustomNegativesChange(e.target.value)}
            placeholder="Enter one keyword per line&#10;e.g., cheap&#10;discount&#10;coupon"
            rows={4}
            className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all resize-none"
          />
          <p className="text-xs text-text3 mt-1">One keyword per line</p>
        </div>
      </div>

      {/* Summary */}
      {(selectedNegativeLists.length > 0 || customNegatives.trim().length > 0) && (
        <div className="bg-surface2 border border-divider rounded-lg p-4">
          <h4 className="text-sm font-medium text-text mb-2">Negative Keywords Summary</h4>
          <div className="text-xs text-text3">
            {selectedNegativeLists.length} pre-built lists +{' '}
            {customNegatives.split('\n').filter((kw) => kw.trim().length > 0).length} custom keywords ={' '}
            <span className="font-medium text-text">
              {PREBUILT_NEGATIVE_LISTS.filter((list) => selectedNegativeLists.includes(list.id)).reduce(
                (sum, list) => sum + list.keywords.length,
                0
              ) + customNegatives.split('\n').filter((kw) => kw.trim().length > 0).length}{' '}
              total
            </span>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <h4 className="font-medium text-text text-sm mb-1">Budget Tips</h4>
            <ul className="text-xs text-text3 space-y-1">
              <li>• Start with "Maximize Conversions" for best results with minimal setup</li>
              <li>• Google may spend up to 2x your daily budget on high-traffic days</li>
              <li>• You can always adjust your budget after launch</li>
              <li>• Negative keywords help prevent wasted spend on irrelevant searches</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
