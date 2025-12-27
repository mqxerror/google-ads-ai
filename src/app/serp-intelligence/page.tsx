'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface TrackedKeyword {
  id: string;
  keyword: string;
  target_domain: string;
  location_code: string;
  device: string;
  project_name: string | null;
  color: string;
  latestSnapshot: {
    organic_position: number | null;
    position_change: number | null;
    competitor_ads_count: number;
    shopping_ads_present: boolean;
    local_pack_present: boolean;
    featured_snippet: boolean;
    snapshot_date: string;
  } | null;
}

interface Opportunity {
  id: string;
  opportunity_type: string;
  priority: 'high' | 'medium' | 'low';
  recommendation_text: string;
  suggested_action: string;
  estimated_impact: any;
  created_at: string;
}

export default function SERPIntelligencePage() {
  const { data: session, status } = useSession();
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');
  const [stats, setStats] = useState({
    total: 0,
    withPositions: 0,
    avgPosition: 0,
    avgCompetitorAds: 0,
  });

  const isAuthenticated = status === 'authenticated' && session?.user;

  useEffect(() => {
    if (isAuthenticated) {
      // Get customerId from localStorage
      const savedCustomerId = localStorage.getItem('quickads_customerId');
      if (savedCustomerId && savedCustomerId !== 'demo') {
        setCustomerId(savedCustomerId);
        fetchKeywords(savedCustomerId);
        fetchOpportunities();
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  async function fetchKeywords(custId: string) {
    try {
      const res = await fetch(`/api/serp-intelligence/keywords?customerId=${custId}`);
      const data = await res.json();
      setKeywords(data.keywords || []);
      setStats(data.stats || { total: 0, withPositions: 0, avgPosition: 0, avgCompetitorAds: 0 });
    } catch (error) {
      console.error('Error fetching keywords:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOpportunities() {
    try {
      const res = await fetch('/api/serp-intelligence/opportunities?status=active');
      const data = await res.json();
      setOpportunities(data.opportunities || []);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    }
  }

  async function handleCheckNow() {
    if (!customerId || keywords.length === 0) return;

    setChecking(true);
    try {
      const keywordIds = keywords.slice(0, 10).map((k) => k.id); // Check first 10 keywords
      const res = await fetch('/api/serp-intelligence/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywordIds, customerId }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchKeywords(customerId);
        await fetchOpportunities();
      } else if (res.status === 429) {
        alert(data.message || 'Rate limited. Please wait before checking again.');
      }
    } catch (error) {
      console.error('Error checking positions:', error);
    } finally {
      setChecking(false);
    }
  }

  async function dismissOpportunity(id: string) {
    try {
      await fetch(`/api/serp-intelligence/opportunities/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User dismissed' }),
      });
      fetchOpportunities();
    } catch (error) {
      console.error('Error dismissing opportunity:', error);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface rounded-2xl p-8 border border-divider">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-indigo-400 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center text-text mb-3">SERP Intelligence</h1>
          <p className="text-text3 text-center mb-6">
            Sign in to track keyword positions and discover PPC opportunities
          </p>
          <Link
            href="/"
            className="block w-full py-3 px-4 bg-accent hover:bg-accent/90 text-white rounded-xl font-medium text-center transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  // Calculate PPC opportunity score
  const highPriorityOpps = opportunities.filter((o) => o.priority === 'high').length;
  const serpFeaturesTriggered = keywords.filter(
    (k) =>
      k.latestSnapshot?.shopping_ads_present ||
      k.latestSnapshot?.local_pack_present ||
      k.latestSnapshot?.featured_snippet
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-divider sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/" className="text-text3 hover:text-text text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-text">SERP Intelligence</h1>
            <p className="text-sm text-text3 mt-1">
              Monitor competitor ad presence and identify PPC opportunities
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCheckNow}
              disabled={checking || keywords.length === 0}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {checking ? 'Checking...' : 'Check Now'}
            </button>
            <Link
              href="/keyword-factory"
              className="px-4 py-2 bg-surface2 hover:bg-divider text-text rounded-xl font-medium text-sm transition-colors"
            >
              + Add Keywords
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {keywords.length === 0 ? (
          // Empty State
          <div className="bg-surface rounded-2xl p-12 border border-divider text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/10 to-indigo-400/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text mb-2">No Keywords Tracked Yet</h2>
            <p className="text-text3 mb-6 max-w-md mx-auto">
              Start tracking keywords to monitor your organic positions, discover PPC opportunities, and track competitor ad presence
            </p>
            <Link
              href="/keyword-factory"
              className="inline-block px-6 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-medium transition-colors"
            >
              Generate Keywords to Track
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - KPIs + Keywords Table */}
            <div className="lg:col-span-2 space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface rounded-xl p-4 border border-divider">
                  <p className="text-xs text-text3 mb-1">Keywords Tracked</p>
                  <p className="text-2xl font-bold text-text">{stats.total}</p>
                  <p className="text-xs text-text3 mt-1">
                    {stats.withPositions} with positions
                  </p>
                </div>
                <div className="bg-surface rounded-xl p-4 border border-divider">
                  <p className="text-xs text-text3 mb-1">PPC Opportunities</p>
                  <p className="text-2xl font-bold text-accent">{highPriorityOpps}</p>
                  <p className="text-xs text-text3 mt-1">High priority</p>
                </div>
                <div className="bg-surface rounded-xl p-4 border border-divider">
                  <p className="text-xs text-text3 mb-1">Avg Competitor Ads</p>
                  <p className="text-2xl font-bold text-text">
                    {stats.avgCompetitorAds.toFixed(1)}
                  </p>
                  <p className="text-xs text-text3 mt-1">Ads per keyword</p>
                </div>
                <div className="bg-surface rounded-xl p-4 border border-divider">
                  <p className="text-xs text-text3 mb-1">SERP Features</p>
                  <p className="text-2xl font-bold text-text">{serpFeaturesTriggered}</p>
                  <p className="text-xs text-text3 mt-1">Keywords</p>
                </div>
              </div>

              {/* Keywords Table */}
              <div className="bg-surface rounded-2xl border border-divider overflow-hidden">
                <div className="px-6 py-4 border-b border-divider">
                  <h2 className="text-lg font-semibold text-text">Tracked Keywords</h2>
                  <p className="text-sm text-text3 mt-1">
                    Monitor positions and identify bidding opportunities
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface2">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text3 uppercase tracking-wider">
                          Keyword
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text3 uppercase tracking-wider">
                          Organic Pos.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text3 uppercase tracking-wider">
                          Change
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text3 uppercase tracking-wider">
                          Competitor Ads
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text3 uppercase tracking-wider">
                          SERP Features
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text3 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {keywords.map((kw) => {
                        const snapshot = kw.latestSnapshot;
                        const position = snapshot?.organic_position;
                        const change = snapshot?.position_change;
                        const needsPPC = !position || position > 10;

                        return (
                          <tr key={kw.id} className="hover:bg-surface2 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: kw.color }}
                                />
                                <span className="text-sm font-medium text-text">
                                  {kw.keyword}
                                </span>
                              </div>
                              {kw.project_name && (
                                <p className="text-xs text-text3 mt-1">{kw.project_name}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {position ? (
                                <span
                                  className={`text-sm font-semibold ${
                                    position <= 3
                                      ? 'text-green-500'
                                      : position <= 10
                                      ? 'text-yellow-500'
                                      : 'text-red-500'
                                  }`}
                                >
                                  #{position}
                                </span>
                              ) : (
                                <span className="text-sm text-text3">Not ranked</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {change !== null && change !== undefined ? (
                                <span
                                  className={`text-sm flex items-center gap-1 ${
                                    change < 0 ? 'text-green-500' : change > 0 ? 'text-red-500' : 'text-text3'
                                  }`}
                                >
                                  {change < 0 ? '↑' : change > 0 ? '↓' : '—'}
                                  {Math.abs(change)}
                                </span>
                              ) : (
                                <span className="text-sm text-text3">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-text">
                                {snapshot?.competitor_ads_count || 0}
                                {snapshot && snapshot.competitor_ads_count >= 6 && (
                                  <span className="ml-1 text-xs text-red-500">🔥</span>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex gap-1">
                                {snapshot?.shopping_ads_present && (
                                  <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded">
                                    Shopping
                                  </span>
                                )}
                                {snapshot?.local_pack_present && (
                                  <span className="text-xs px-2 py-1 bg-purple-500/10 text-purple-500 rounded">
                                    Local
                                  </span>
                                )}
                                {snapshot?.featured_snippet && (
                                  <span className="text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded">
                                    Snippet
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {needsPPC ? (
                                <button className="text-xs px-3 py-1 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 font-medium transition-colors">
                                  Create Campaign
                                </button>
                              ) : (
                                <span className="text-xs text-text3">Monitor</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Sidebar - Opportunities */}
            <div className="space-y-6">
              <div className="bg-surface rounded-2xl border border-divider overflow-hidden">
                <div className="px-6 py-4 border-b border-divider">
                  <h2 className="text-lg font-semibold text-text">Quick Insights</h2>
                  <p className="text-sm text-text3 mt-1">PPC opportunities</p>
                </div>
                <div className="p-6 space-y-4">
                  {opportunities.length === 0 ? (
                    <p className="text-sm text-text3">
                      No opportunities yet. Check positions to generate recommendations.
                    </p>
                  ) : (
                    opportunities.slice(0, 5).map((opp) => (
                      <div
                        key={opp.id}
                        className="p-4 bg-surface2 rounded-xl border border-divider"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              opp.priority === 'high'
                                ? 'bg-red-500/10 text-red-500'
                                : opp.priority === 'medium'
                                ? 'bg-yellow-500/10 text-yellow-500'
                                : 'bg-gray-500/10 text-gray-500'
                            }`}
                          >
                            {opp.priority.toUpperCase()}
                          </span>
                          <button
                            onClick={() => dismissOpportunity(opp.id)}
                            className="text-text3 hover:text-text text-xs"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-sm text-text mb-2">{opp.recommendation_text}</p>
                        <button className="text-xs text-accent hover:underline font-medium">
                          {opp.suggested_action.replace(/_/g, ' ').toUpperCase()}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
