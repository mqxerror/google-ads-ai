'use client';

import { useState, useEffect } from 'react';
import { GeneratedKeyword } from '../types';

interface KeywordDetailModalProps {
  keyword: GeneratedKeyword | null;
  onClose: () => void;
}

interface KeywordInsights {
  keyword: string;
  overview: {
    searchVolume: number;
    cpc: number;
    competition: string;
    difficulty: number;
    intent: string;
  };
  trends: Array<{
    month: string;
    volume: number;
  }>;
  serp: {
    difficulty: number;
    features: string[];
    topDomains: string[];
  };
  relatedKeywords: Array<{
    keyword: string;
    volume: number;
    relevance: number;
  }>;
}

export default function KeywordDetailModal({ keyword, onClose }: KeywordDetailModalProps) {
  const [insights, setInsights] = useState<KeywordInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'serp' | 'related'>('overview');

  useEffect(() => {
    if (keyword) {
      fetchKeywordInsights(keyword.keyword);
    }
  }, [keyword]);

  const fetchKeywordInsights = async (kw: string) => {
    setLoading(true);
    try {
      // TODO: Implement actual API call to fetch insights
      const response = await fetch(`/api/keywords/insights?keyword=${encodeURIComponent(kw)}`);

      if (response.ok) {
        const data = await response.json();
        setInsights(data);
        setLoading(false);
        return;
      }
    } catch (error) {
      // API not available, silently fallback
    }

    // Use existing keyword data as fallback
    setInsights({
      keyword: kw,
      overview: {
        searchVolume: keyword?.metrics?.searchVolume || 0,
        cpc: keyword?.metrics?.cpc || 0,
        competition: keyword?.metrics?.competition || 'UNKNOWN',
        difficulty: keyword?.metrics?.difficulty || 0,
        intent: keyword?.estimatedIntent || 'unknown',
      },
      trends: [],
      serp: {
        difficulty: keyword?.metrics?.difficulty || 0,
        features: [],
        topDomains: [],
      },
      relatedKeywords: [],
    });
    setLoading(false);
  };

  if (!keyword) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-accent to-accent-dark text-white p-4 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">{keyword.keyword}</h2>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="px-2 py-0.5 bg-white/20 rounded text-xs">
                {keyword.estimatedIntent}
              </span>
              <span className="px-2 py-0.5 bg-white/20 rounded text-xs">
                {keyword.suggestedMatchType}
              </span>
              <span className="px-2 py-0.5 bg-white/20 rounded text-xs">
                {keyword.type}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl leading-none ml-4"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-divider bg-surface2">
          <div className="flex">
            {(['overview', 'trends', 'serp', 'related'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text2 hover:text-text'
                }`}
              >
                {tab === 'overview' && '📊 Overview'}
                {tab === 'trends' && '📈 Trends'}
                {tab === 'serp' && '🔍 SERP Analysis'}
                {tab === 'related' && '🔗 Related Keywords'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin text-4xl">⏳</div>
              <span className="ml-3 text-text2">Loading insights...</span>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && insights && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card p-4">
                      <div className="text-xs text-text3 mb-1">Search Volume</div>
                      <div className="text-2xl font-bold text-text">
                        {insights.overview.searchVolume.toLocaleString()}
                      </div>
                    </div>
                    <div className="card p-4">
                      <div className="text-xs text-text3 mb-1">Avg CPC</div>
                      <div className="text-2xl font-bold text-text">
                        ${insights.overview.cpc.toFixed(2)}
                      </div>
                    </div>
                    <div className="card p-4">
                      <div className="text-xs text-text3 mb-1">Competition</div>
                      <div className={`text-lg font-bold ${
                        insights.overview.competition === 'HIGH' ? 'text-danger' :
                        insights.overview.competition === 'MEDIUM' ? 'text-warning' :
                        'text-success'
                      }`}>
                        {insights.overview.competition}
                      </div>
                    </div>
                    <div className="card p-4">
                      <div className="text-xs text-text3 mb-1">Difficulty</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface3 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              insights.overview.difficulty >= 70 ? 'bg-danger' :
                              insights.overview.difficulty >= 40 ? 'bg-warning' :
                              'bg-success'
                            }`}
                            style={{ width: `${insights.overview.difficulty}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{insights.overview.difficulty}/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="card p-4">
                    <h3 className="font-semibold mb-3">Opportunity Score</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-4 bg-surface3 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            keyword.opportunityScore && keyword.opportunityScore >= 75 ? 'bg-emerald-500' :
                            keyword.opportunityScore && keyword.opportunityScore >= 50 ? 'bg-yellow-500' :
                            'bg-orange-500'
                          }`}
                          style={{ width: `${keyword.opportunityScore || 0}%` }}
                        />
                      </div>
                      <span className="text-2xl font-bold">{keyword.opportunityScore || 0}</span>
                    </div>
                    <p className="text-sm text-text3 mt-2">
                      {keyword.opportunityScore && keyword.opportunityScore >= 75
                        ? '✨ High opportunity - Strong volume with manageable competition'
                        : keyword.opportunityScore && keyword.opportunityScore >= 50
                        ? '📊 Medium opportunity - Balanced metrics'
                        : '⚠️ Lower opportunity - Consider niche targeting or different keywords'}
                    </p>
                  </div>

                  <div className="card p-4">
                    <h3 className="font-semibold mb-3">Data Source</h3>
                    <div className="text-sm text-text2">
                      {keyword.metrics?.dataSource === 'google_ads' && '🎯 Google Ads API'}
                      {keyword.metrics?.dataSource === 'moz' && '📊 Moz API'}
                      {keyword.metrics?.dataSource === 'dataforseo' && '📈 DataForSEO'}
                      {keyword.metrics?.dataSource === 'cached' && '💾 Cached Data'}
                      {keyword.metrics?.cacheAge ? ` • ${keyword.metrics.cacheAge} days old` : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Trends Tab */}
              {activeTab === 'trends' && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📈</div>
                  <div className="text-text2">Trends analysis coming soon</div>
                  <div className="text-sm text-text3 mt-1">12-month search volume history</div>
                </div>
              )}

              {/* SERP Tab */}
              {activeTab === 'serp' && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🔍</div>
                  <div className="text-text2">SERP analysis coming soon</div>
                  <div className="text-sm text-text3 mt-1">
                    SERP features, difficulty score, top-ranking domains
                  </div>
                </div>
              )}

              {/* Related Keywords Tab */}
              {activeTab === 'related' && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🔗</div>
                  <div className="text-text2">Related keywords coming soon</div>
                  <div className="text-sm text-text3 mt-1">
                    Discover similar keywords and variations
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-divider bg-surface2 p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface3 hover:bg-divider rounded text-sm font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              // TODO: Add action (e.g., add to campaign)
              alert('Action coming soon!');
            }}
            className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded text-sm font-medium transition-colors"
          >
            Add to Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
