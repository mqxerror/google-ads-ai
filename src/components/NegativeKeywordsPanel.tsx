'use client';

import { useState, useEffect } from 'react';

interface NegativeSuggestion {
  searchTerm: string;
  reason: string;
  category: string;
  confidence: number;
  cost: number;
  potentialSavings: number;
  similarTo?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
}

interface Summary {
  analyzed: number;
  wastersFound: number;
  suggestionsCount: number;
  potentialSavings: number;
  byCategory: Record<string, { count: number; savings: number }>;
}

interface NegativeKeywordsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  free: { label: 'Free Seekers', color: 'text-red-500 bg-red-50', icon: '🆓' },
  jobs: { label: 'Job Seekers', color: 'text-orange-500 bg-orange-50', icon: '💼' },
  diy: { label: 'DIY/How-To', color: 'text-yellow-500 bg-yellow-50', icon: '🔧' },
  cheap: { label: 'Bargain Hunters', color: 'text-purple-500 bg-purple-50', icon: '💰' },
  informational: { label: 'Research Only', color: 'text-blue-500 bg-blue-50', icon: '📚' },
  competitors: { label: 'Competitors', color: 'text-gray-500 bg-gray-50', icon: '🏢' },
  low_intent: { label: 'Low Intent', color: 'text-amber-500 bg-amber-50', icon: '⚠️' },
  expensive_waster: { label: 'Expensive Waster', color: 'text-red-600 bg-red-50', icon: '🔥' },
};

export default function NegativeKeywordsPanel({ isOpen, onClose, customerId }: NegativeKeywordsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<NegativeSuggestion[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [addingNegatives, setAddingNegatives] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<string>('all');

  useEffect(() => {
    if (isOpen && customerId && customerId !== 'demo') {
      analyzeSearchTerms();
    }
  }, [isOpen, customerId]);

  async function analyzeSearchTerms() {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch search terms
      const searchTermsRes = await fetch(`/api/google-ads/search-terms?customerId=${customerId}&days=30`);
      const searchTermsData = await searchTermsRes.json();

      if (searchTermsData.error) {
        throw new Error(searchTermsData.error);
      }

      if (!searchTermsData.searchTerms || searchTermsData.searchTerms.length === 0) {
        setSuggestions([]);
        setSummary({
          analyzed: 0,
          wastersFound: 0,
          suggestionsCount: 0,
          potentialSavings: 0,
          byCategory: {},
        });
        return;
      }

      // Step 2: Analyze for negative suggestions
      const suggestRes = await fetch('/api/keywords/negative-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: searchTermsData.searchTerms,
          threshold: 0.75,
        }),
      });

      const suggestData = await suggestRes.json();

      if (suggestData.error) {
        throw new Error(suggestData.error);
      }

      setSuggestions(suggestData.suggestions || []);
      setSummary(suggestData.summary || null);

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze search terms');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(term: string) {
    const newSelected = new Set(selectedTerms);
    if (newSelected.has(term)) {
      newSelected.delete(term);
    } else {
      newSelected.add(term);
    }
    setSelectedTerms(newSelected);
  }

  function selectAll() {
    const filtered = campaignFilter === 'all'
      ? suggestions
      : suggestions.filter(s => s.campaignId === campaignFilter);
    setSelectedTerms(new Set(filtered.map(s => s.searchTerm)));
  }

  function deselectAll() {
    setSelectedTerms(new Set());
  }

  async function addAsNegatives() {
    if (selectedTerms.size === 0) return;

    setAddingNegatives(true);
    // TODO: Implement actual Google Ads negative keyword addition
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 1000));

    alert(`Added ${selectedTerms.size} negative keywords! (Demo - actual implementation coming soon)`);
    setSelectedTerms(new Set());
    setAddingNegatives(false);
  }

  // Get unique campaigns for filter dropdown
  const uniqueCampaigns = Array.from(
    new Map(
      suggestions
        .filter(s => s.campaignId && s.campaignName)
        .map(s => [s.campaignId, { id: s.campaignId!, name: s.campaignName! }])
    ).values()
  );

  // Filter suggestions by selected campaign
  const filteredSuggestions = campaignFilter === 'all'
    ? suggestions
    : suggestions.filter(s => s.campaignId === campaignFilter);

  const selectedSavings = filteredSuggestions
    .filter(s => selectedTerms.has(s.searchTerm))
    .reduce((sum, s) => sum + s.potentialSavings, 0);

  const filteredSavings = filteredSuggestions.reduce((sum, s) => sum + s.potentialSavings, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-surface shadow-2xl flex flex-col animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-divider">
          <div>
            <h2 className="text-xl font-semibold text-text flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-danger-light flex items-center justify-center">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </span>
              Negative Keywords AI
            </h2>
            <p className="text-sm text-text2 mt-1">Find and block wasteful search terms</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-surface2 flex items-center justify-center hover:bg-divider transition-colors"
          >
            <svg className="w-5 h-5 text-text2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {customerId === 'demo' ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-surface2 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-text mb-2">Connect Google Ads</h3>
              <p className="text-text2 text-sm">Sign in with Google to analyze your search terms</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-text2">Analyzing search terms with AI...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-danger-light flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-text mb-2">Analysis Failed</h3>
              <p className="text-text2 text-sm mb-4">{error}</p>
              <button
                onClick={analyzeSearchTerms}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-text mb-2">Looking Good!</h3>
              <p className="text-text2 text-sm">No wasteful search terms found. Your campaigns are efficient!</p>
            </div>
          ) : (
            <>
              {/* Campaign Filter */}
              {uniqueCampaigns.length > 1 && (
                <div className="mb-4">
                  <label className="text-xs text-text3 mb-2 block">Filter by Campaign</label>
                  <select
                    value={campaignFilter}
                    onChange={(e) => {
                      setCampaignFilter(e.target.value);
                      setSelectedTerms(new Set()); // Clear selection on filter change
                    }}
                    className="w-full bg-surface2 text-text text-sm rounded-lg px-3 py-2 border border-divider focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="all">All Campaigns ({suggestions.length} terms)</option>
                    {uniqueCampaigns.map(campaign => {
                      const count = suggestions.filter(s => s.campaignId === campaign.id).length;
                      return (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name} ({count} terms)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Summary Cards */}
              {summary && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="card p-4">
                    <p className="text-text3 text-xs mb-1">Analyzed</p>
                    <p className="text-2xl font-semibold text-text">{summary.analyzed}</p>
                    <p className="text-xs text-text3">search terms</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-text3 text-xs mb-1">Wasters Found</p>
                    <p className="text-2xl font-semibold text-danger">{filteredSuggestions.length}</p>
                    <p className="text-xs text-text3">{campaignFilter === 'all' ? 'to block' : 'in this campaign'}</p>
                  </div>
                  <div className="card p-4 card-accent">
                    <p className="text-white/70 text-xs mb-1">Potential Savings</p>
                    <p className="text-2xl font-semibold text-white">${filteredSavings.toFixed(0)}</p>
                    <p className="text-xs text-white/70">per month</p>
                  </div>
                </div>
              )}

              {/* Selection Actions */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-sm text-accent hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-text3">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-sm text-text2 hover:text-text"
                  >
                    Deselect All
                  </button>
                </div>
                <p className="text-sm text-text2">
                  {selectedTerms.size} selected · ${selectedSavings.toFixed(0)} savings
                </p>
              </div>

              {/* Suggestions List */}
              <div className="space-y-2">
                {filteredSuggestions.map((suggestion, index) => {
                  const categoryInfo = CATEGORY_LABELS[suggestion.category] || {
                    label: suggestion.category,
                    color: 'text-gray-500 bg-gray-50',
                    icon: '❓',
                  };

                  return (
                    <div
                      key={index}
                      onClick={() => toggleSelection(suggestion.searchTerm)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedTerms.has(suggestion.searchTerm)
                          ? 'border-accent bg-accent-light'
                          : 'border-divider bg-surface hover:border-accent/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          selectedTerms.has(suggestion.searchTerm)
                            ? 'border-accent bg-accent'
                            : 'border-text3'
                        }`}>
                          {selectedTerms.has(suggestion.searchTerm) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-text truncate">{suggestion.searchTerm}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryInfo.color}`}>
                              {categoryInfo.icon} {categoryInfo.label}
                            </span>
                          </div>
                          <p className="text-sm text-text2 mb-2">{suggestion.reason}</p>
                          {/* Campaign/AdGroup Context */}
                          {suggestion.campaignName && (
                            <div className="flex items-center gap-2 text-xs text-text3 mb-2">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                              <span className="truncate max-w-[180px]" title={suggestion.campaignName}>
                                {suggestion.campaignName}
                              </span>
                              {suggestion.adGroupName && (
                                <>
                                  <span className="text-text3">/</span>
                                  <span className="truncate max-w-[120px]" title={suggestion.adGroupName}>
                                    {suggestion.adGroupName}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-text3">
                            <span>Cost: ${suggestion.cost.toFixed(2)}</span>
                            <span className="text-success font-medium">Save: ${suggestion.potentialSavings.toFixed(2)}</span>
                            <span>Confidence: {Math.round(suggestion.confidence * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {filteredSuggestions.length > 0 && (
          <div className="p-6 border-t border-divider bg-surface">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text">
                  {selectedTerms.size} keywords selected
                </p>
                <p className="text-xs text-success">
                  Potential savings: ${selectedSavings.toFixed(0)}/month
                </p>
              </div>
              <button
                onClick={addAsNegatives}
                disabled={selectedTerms.size === 0 || addingNegatives}
                className="px-6 py-3 bg-danger text-white rounded-xl font-medium transition-all disabled:opacity-50 hover:bg-red-600 flex items-center gap-2"
              >
                {addingNegatives ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Add as Negatives
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
