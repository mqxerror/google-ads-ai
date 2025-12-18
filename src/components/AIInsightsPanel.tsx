'use client';

import { useState, useEffect } from 'react';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { CampaignData, AccountAnalysis, CampaignInsight, PROVIDER_NAMES, LLMProvider } from '@/lib/llm/types';

interface AIInsightsPanelProps {
  campaigns: CampaignData[];
  isOpen: boolean;
  onClose: () => void;
}

export default function AIInsightsPanel({ campaigns, isOpen, onClose }: AIInsightsPanelProps) {
  const { analyzeAccount, getSuggestions, isLoading, error, configuredProviders, checkConfiguration } = useAIAnalysis();
  const [analysis, setAnalysis] = useState<AccountAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'insights' | 'suggestions'>('insights');
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen && isConfigured === null) {
      checkConfiguration().then(setIsConfigured);
    }
  }, [isOpen, isConfigured, checkConfiguration]);

  const handleAnalyze = async () => {
    const result = await analyzeAccount(campaigns);
    setAnalysis(result);
  };

  const handleGetSuggestions = async () => {
    const result = await getSuggestions(campaigns);
    setSuggestions(result);
  };

  if (!isOpen) return null;

  const getInsightIcon = (type: CampaignInsight['type']) => {
    switch (type) {
      case 'opportunity':
        return (
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getImpactBadge = (impact: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[impact]}`}>
        {impact.charAt(0).toUpperCase() + impact.slice(1)} Impact
      </span>
    );
  };

  const getHealthColor = (health: AccountAnalysis['overallHealth']) => {
    switch (health) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'fair': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-red-600 bg-red-100';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Insights</h2>
              <p className="text-xs text-gray-500">
                {configuredProviders.length > 0
                  ? `Powered by ${PROVIDER_NAMES[configuredProviders[0] as LLMProvider]}`
                  : 'No AI provider configured'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Not Configured State */}
        {isConfigured === false && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">AI Not Configured</h3>
              <p className="text-sm text-gray-500 mb-4">
                Set up an AI provider to unlock intelligent campaign insights.
              </p>
              <div className="text-left bg-gray-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-gray-700 mb-2">Add one of these to your .env.local:</p>
                <code className="block text-xs bg-gray-100 p-2 rounded mb-1">ANTHROPIC_API_KEY=your_key</code>
                <code className="block text-xs bg-gray-100 p-2 rounded">OPENAI_API_KEY=your_key</code>
              </div>
            </div>
          </div>
        )}

        {/* Configured State */}
        {isConfigured && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('insights')}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeTab === 'insights'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Account Analysis
              </button>
              <button
                onClick={() => setActiveTab('suggestions')}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeTab === 'suggestions'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Optimization Tips
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {activeTab === 'insights' && (
                <>
                  {!analysis ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500 mb-4">
                        Analyze {campaigns.length} campaigns with AI
                      </p>
                      <button
                        onClick={handleAnalyze}
                        disabled={isLoading || campaigns.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Analyze with AI
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Summary */}
                      <div className="rounded-lg bg-gray-50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Account Health</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getHealthColor(analysis.overallHealth)}`}>
                            {analysis.overallHealth}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{analysis.summary}</p>
                      </div>

                      {/* Insights */}
                      {analysis.insights.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Key Insights</h3>
                          <div className="space-y-3">
                            {analysis.insights.map((insight, i) => (
                              <div key={i} className="rounded-lg border border-gray-200 p-4">
                                <div className="flex items-start gap-3">
                                  {getInsightIcon(insight.type)}
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium text-gray-900">{insight.title}</span>
                                      {getImpactBadge(insight.impact)}
                                    </div>
                                    <p className="text-sm text-gray-600">{insight.description}</p>
                                    {insight.suggestedAction && (
                                      <p className="mt-2 text-sm text-purple-600">
                                        <strong>Action:</strong> {insight.suggestedAction}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {analysis.recommendations.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recommendations</h3>
                          <ul className="space-y-2">
                            {analysis.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-purple-500">•</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Top/Under Performers */}
                      <div className="grid grid-cols-2 gap-4">
                        {analysis.topPerformers.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Top Performers</h4>
                            <ul className="space-y-1">
                              {analysis.topPerformers.slice(0, 3).map((name, i) => (
                                <li key={i} className="text-sm text-green-700 truncate">
                                  {name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {analysis.underperformers.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Needs Attention</h4>
                            <ul className="space-y-1">
                              {analysis.underperformers.slice(0, 3).map((name, i) => (
                                <li key={i} className="text-sm text-red-700 truncate">
                                  {name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Re-analyze button */}
                      <button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {isLoading ? 'Analyzing...' : 'Re-analyze'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'suggestions' && (
                <>
                  {!suggestions ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500 mb-4">
                        Get AI-powered optimization suggestions
                      </p>
                      <button
                        onClick={handleGetSuggestions}
                        disabled={isLoading || campaigns.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Get Suggestions
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-purple-50 p-4">
                        <h3 className="text-sm font-semibold text-purple-900 mb-2">AI Optimization Suggestions</h3>
                        <div className="prose prose-sm prose-purple">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestions}</p>
                        </div>
                      </div>

                      <button
                        onClick={handleGetSuggestions}
                        disabled={isLoading}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {isLoading ? 'Generating...' : 'Get New Suggestions'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
