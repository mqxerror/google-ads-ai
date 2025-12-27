'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface PageAnalysis {
  url: string;
  score: number;
  error?: string;
  authority?: {
    domainAuthority: number;
    pageAuthority: number;
    spamScore: number;
    linkingDomains: number;
    totalLinks: number;
    issues: string[];
    source: 'moz' | 'estimated';
  };
  speed: {
    score: number;
    loadTime: number;
    ttfb: number;
    issues: string[];
  };
  mobile: {
    score: number;
    isResponsive: boolean;
    hasViewport: boolean;
    issues: string[];
  };
  content: {
    score: number;
    title: string;
    description: string;
    h1: string[];
    wordCount: number;
    hasImages: boolean;
    issues: string[];
  };
  relevance: {
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    keywordDensity: Record<string, number>;
  };
  cta: {
    score: number;
    found: { text: string; type: string }[];
    issues: string[];
  };
  security: {
    score: number;
    hasSSL: boolean;
    issues: string[];
  };
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: string;
    message: string;
    impact: string;
  }[];
  analyzedAt: string;
  dataSource?: 'basic' | 'moz' | 'all';
}

interface RecentAnalysis {
  url: string;
  score: number;
  analyzedAt: string;
}

const SCORE_COLORS = {
  high: { bg: 'bg-success', text: 'text-success', light: 'bg-success-light' },
  medium: { bg: 'bg-warning', text: 'text-warning', light: 'bg-warning-light' },
  low: { bg: 'bg-danger', text: 'text-danger', light: 'bg-danger-light' },
};

function getScoreLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

export default function LandingAnalyzerPage() {
  const { data: session, status } = useSession();
  const [url, setUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PageAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'basic' | 'moz' | 'all'>('all');

  const isAuthenticated = status === 'authenticated' && session?.user;

  // Load recent analyses from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quickads_recent_analyses');
      if (saved) {
        try {
          setRecentAnalyses(JSON.parse(saved).slice(0, 5));
        } catch {}
      }
    }
  }, []);

  // Save analysis to recent
  function saveToRecent(result: PageAnalysis) {
    const recent = [
      { url: result.url, score: result.score, analyzedAt: result.analyzedAt },
      ...recentAnalyses.filter(r => r.url !== result.url),
    ].slice(0, 5);
    setRecentAnalyses(recent);
    localStorage.setItem('quickads_recent_analyses', JSON.stringify(recent));
  }

  async function handleAnalyze() {
    if (!url.trim()) return;

    setAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const keywordList = keywords
        .split(/[,\n]/)
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const res = await fetch('/api/analyzer/landing-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, keywords: keywordList, source: dataSource }),
      });

      const data = await res.json();

      if (data.error && !data.score) {
        setError(data.error);
      } else {
        setAnalysis(data);
        saveToRecent(data);
      }
    } catch (err) {
      setError('Failed to analyze page. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleSection(section: string) {
    setExpandedSection(expandedSection === section ? null : section);
  }

  // Score ring component
  function ScoreRing({ score, size = 'large' }: { score: number; size?: 'large' | 'small' }) {
    const level = getScoreLevel(score);
    const colors = SCORE_COLORS[level];
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className={`relative ${size === 'large' ? 'w-32 h-32' : 'w-16 h-16'}`}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-surface2"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={colors.text}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${size === 'large' ? 'text-3xl' : 'text-lg'} font-bold text-text`}>
            {score}
          </span>
          {size === 'large' && (
            <span className={`text-xs font-medium ${colors.text}`}>{getScoreLabel(score)}</span>
          )}
        </div>
      </div>
    );
  }

  // Category card component
  function CategoryCard({
    title,
    icon,
    score,
    issues,
    children,
    sectionKey,
  }: {
    title: string;
    icon: string;
    score: number;
    issues: string[];
    children?: React.ReactNode;
    sectionKey: string;
  }) {
    const level = getScoreLevel(score);
    const colors = SCORE_COLORS[level];
    const isExpanded = expandedSection === sectionKey;

    return (
      <div className="card overflow-hidden">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full p-4 flex items-center justify-between hover:bg-surface2 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div className="text-left">
              <h3 className="font-semibold text-text">{title}</h3>
              <p className="text-xs text-text3">{issues.length > 0 ? `${issues.length} issues` : 'No issues'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full ${colors.light}`}>
              <span className={`font-bold ${colors.text}`}>{score}</span>
            </div>
            <svg
              className={`w-5 h-5 text-text3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {isExpanded && (
          <div className="p-4 pt-0 border-t border-divider">
            {issues.length > 0 && (
              <div className="mb-4 space-y-2">
                {issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-text2">{issue}</span>
                  </div>
                ))}
              </div>
            )}
            {children}
          </div>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text mb-2">Landing Page Analyzer</h1>
          <p className="text-text2 mb-6">Sign in to analyze your landing pages</p>
          <Link href="/login" className="btn-primary">Sign In with Google</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-divider sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-text2 hover:text-text transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-text">Landing Page Analyzer</h1>
                  <p className="text-xs text-text3">Check speed, relevance & conversion factors</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Input */}
          <div className="lg:col-span-1 space-y-4">
            {/* URL Input Card */}
            <div className="card p-6">
              <h2 className="font-semibold text-text mb-4">Analyze a Page</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Landing Page URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/landing-page"
                    className="w-full px-4 py-3 bg-surface2 rounded-xl text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent"
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">
                    Ad Keywords <span className="text-text3 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="Enter keywords to check relevance&#10;e.g., running shoes, athletic footwear"
                    rows={3}
                    className="w-full px-4 py-3 bg-surface2 rounded-xl text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  />
                  <p className="text-xs text-text3 mt-1">Separate with commas or new lines</p>
                </div>

                {/* Data Source Selector */}
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Data Source</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDataSource('basic')}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        dataSource === 'basic'
                          ? 'bg-accent text-white'
                          : 'bg-surface2 text-text2 hover:bg-surface3'
                      }`}
                    >
                      Basic
                    </button>
                    <button
                      type="button"
                      onClick={() => setDataSource('moz')}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        dataSource === 'moz'
                          ? 'bg-accent text-white'
                          : 'bg-surface2 text-text2 hover:bg-surface3'
                      }`}
                    >
                      Moz API
                    </button>
                    <button
                      type="button"
                      onClick={() => setDataSource('all')}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        dataSource === 'all'
                          ? 'bg-accent text-white'
                          : 'bg-surface2 text-text2 hover:bg-surface3'
                      }`}
                    >
                      All
                    </button>
                  </div>
                  <p className="text-xs text-text3 mt-1">
                    {dataSource === 'moz' ? 'Requires Moz API key' : dataSource === 'all' ? 'Uses Moz if available' : 'Basic page analysis'}
                  </p>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !url.trim()}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Analyze Page
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Recent Analyses */}
            {recentAnalyses.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-medium text-text mb-3">Recent Analyses</h3>
                <div className="space-y-2">
                  {recentAnalyses.map((recent, i) => (
                    <button
                      key={i}
                      onClick={() => setUrl(recent.url)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface2 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text truncate">{new URL(recent.url).hostname}</p>
                        <p className="text-xs text-text3">{new Date(recent.analyzedAt).toLocaleDateString()}</p>
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${SCORE_COLORS[getScoreLevel(recent.score)].light} ${SCORE_COLORS[getScoreLevel(recent.score)].text}`}>
                        {recent.score}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tips Card */}
            <div className="card p-4 bg-accent-light border-accent/20">
              <h3 className="text-sm font-medium text-accent mb-2">Pro Tips</h3>
              <ul className="text-xs text-text2 space-y-1">
                <li>Add your ad keywords to check relevance</li>
                <li>Higher scores mean better Quality Score</li>
                <li>Focus on high-priority recommendations first</li>
                <li>Mobile experience affects 60%+ of traffic</li>
              </ul>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2">
            {error && (
              <div className="card p-6 border-2 border-danger/20 bg-danger-light">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-danger">Analysis Failed</h3>
                    <p className="text-sm text-text2">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {!analysis && !error && !analyzing && (
              <div className="card p-12 text-center">
                <div className="w-20 h-20 rounded-2xl bg-surface2 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-text mb-2">Enter a URL to analyze</h2>
                <p className="text-text2 max-w-md mx-auto">
                  Get instant insights on page speed, mobile friendliness, content quality, and conversion optimization.
                </p>
              </div>
            )}

            {analyzing && (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 rounded-full border-4 border-accent border-t-transparent animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-text mb-2">Analyzing Page...</h2>
                <p className="text-text2">Checking speed, content, mobile, and more</p>
              </div>
            )}

            {analysis && !analyzing && (
              <div className="space-y-4">
                {/* Overall Score Card */}
                <div className="card p-6">
                  <div className="flex items-center gap-6">
                    <ScoreRing score={analysis.score} />
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-text mb-1">
                        {new URL(analysis.url).hostname}
                      </h2>
                      <p className="text-sm text-text3 mb-3 truncate">{analysis.url}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${SCORE_COLORS[getScoreLevel(analysis.speed.score)].light} ${SCORE_COLORS[getScoreLevel(analysis.speed.score)].text}`}>
                          Speed: {analysis.speed.score}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${SCORE_COLORS[getScoreLevel(analysis.mobile.score)].light} ${SCORE_COLORS[getScoreLevel(analysis.mobile.score)].text}`}>
                          Mobile: {analysis.mobile.score}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${SCORE_COLORS[getScoreLevel(analysis.content.score)].light} ${SCORE_COLORS[getScoreLevel(analysis.content.score)].text}`}>
                          Content: {analysis.content.score}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${SCORE_COLORS[getScoreLevel(analysis.cta.score)].light} ${SCORE_COLORS[getScoreLevel(analysis.cta.score)].text}`}>
                          CTA: {analysis.cta.score}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Authority Metrics - Moz Style */}
                {analysis.authority && (
                  <div className="card p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-text">Domain & Page Authority</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          analysis.authority.source === 'moz'
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {analysis.authority.source === 'moz' ? 'Moz Data' : 'Estimated'}
                        </span>
                      </div>
                      {analysis.authority.source === 'estimated' && (
                        <Link href="/api-settings" className="text-xs text-purple-600 hover:underline">
                          Add Moz API Key
                        </Link>
                      )}
                    </div>

                    {/* DA/PA Circles */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {/* Domain Authority */}
                      <div className="text-center">
                        <div className="relative w-20 h-20 mx-auto mb-2">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                            <circle
                              cx="50" cy="50" r="42" fill="none"
                              stroke={analysis.authority.domainAuthority >= 50 ? '#10b981' : analysis.authority.domainAuthority >= 30 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 42}
                              strokeDashoffset={2 * Math.PI * 42 * (1 - analysis.authority.domainAuthority / 100)}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-bold text-text">{analysis.authority.domainAuthority}</span>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-text">Domain Authority</p>
                        <p className="text-xs text-text3">DA</p>
                      </div>

                      {/* Page Authority */}
                      <div className="text-center">
                        <div className="relative w-20 h-20 mx-auto mb-2">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                            <circle
                              cx="50" cy="50" r="42" fill="none"
                              stroke={analysis.authority.pageAuthority >= 50 ? '#10b981' : analysis.authority.pageAuthority >= 30 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 42}
                              strokeDashoffset={2 * Math.PI * 42 * (1 - analysis.authority.pageAuthority / 100)}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-bold text-text">{analysis.authority.pageAuthority}</span>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-text">Page Authority</p>
                        <p className="text-xs text-text3">PA</p>
                      </div>

                      {/* Spam Score */}
                      <div className="text-center">
                        <div className="relative w-20 h-20 mx-auto mb-2">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                            <circle
                              cx="50" cy="50" r="42" fill="none"
                              stroke={analysis.authority.spamScore <= 10 ? '#10b981' : analysis.authority.spamScore <= 30 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 42}
                              strokeDashoffset={2 * Math.PI * 42 * (1 - analysis.authority.spamScore / 100)}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-bold text-text">{analysis.authority.spamScore}%</span>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-text">Spam Score</p>
                        <p className="text-xs text-text3">{analysis.authority.spamScore <= 10 ? 'Low' : analysis.authority.spamScore <= 30 ? 'Medium' : 'High'}</p>
                      </div>

                      {/* Linking Domains */}
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-2 bg-surface2 rounded-full flex items-center justify-center">
                          <div className="text-center">
                            <span className="text-2xl font-bold text-text">
                              {analysis.authority.linkingDomains > 1000
                                ? `${(analysis.authority.linkingDomains / 1000).toFixed(1)}k`
                                : analysis.authority.linkingDomains}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-text">Linking Domains</p>
                        <p className="text-xs text-text3">Backlinks</p>
                      </div>
                    </div>

                    {/* Authority Issues */}
                    {analysis.authority.issues.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-purple-200">
                        <p className="text-xs font-medium text-text2 mb-2">Authority Notes</p>
                        <div className="space-y-1">
                          {analysis.authority.issues.map((issue, i) => (
                            <p key={i} className="text-xs text-text3 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-purple-400" />
                              {issue}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations.length > 0 && (
                  <div className="card p-6">
                    <h3 className="font-semibold text-text mb-4">Priority Recommendations</h3>
                    <div className="space-y-3">
                      {analysis.recommendations.slice(0, 5).map((rec, i) => (
                        <div
                          key={i}
                          className={`p-4 rounded-xl ${
                            rec.priority === 'high' ? 'bg-danger-light border border-danger/20' :
                            rec.priority === 'medium' ? 'bg-warning-light border border-warning/20' :
                            'bg-surface2'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                              rec.priority === 'high' ? 'bg-danger text-white' :
                              rec.priority === 'medium' ? 'bg-warning text-white' :
                              'bg-text3 text-white'
                            }`}>
                              {rec.priority}
                            </span>
                            <div>
                              <p className="font-medium text-text">{rec.message}</p>
                              <p className="text-sm text-text2 mt-1">{rec.impact}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category Details */}
                <div className="space-y-3">
                  <CategoryCard
                    title="Page Speed"
                    icon="⚡"
                    score={analysis.speed.score}
                    issues={analysis.speed.issues}
                    sectionKey="speed"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-surface2 rounded-lg">
                        <p className="text-xs text-text3 mb-1">Load Time</p>
                        <p className="text-lg font-bold text-text">{analysis.speed.loadTime.toFixed(2)}s</p>
                      </div>
                      <div className="p-3 bg-surface2 rounded-lg">
                        <p className="text-xs text-text3 mb-1">Time to First Byte</p>
                        <p className="text-lg font-bold text-text">{analysis.speed.ttfb}ms</p>
                      </div>
                    </div>
                  </CategoryCard>

                  <CategoryCard
                    title="Mobile Experience"
                    icon="📱"
                    score={analysis.mobile.score}
                    issues={analysis.mobile.issues}
                    sectionKey="mobile"
                  >
                    <div className="flex gap-4">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${analysis.mobile.hasViewport ? 'bg-success-light' : 'bg-danger-light'}`}>
                        {analysis.mobile.hasViewport ? '✓' : '✗'} Viewport
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${analysis.mobile.isResponsive ? 'bg-success-light' : 'bg-warning-light'}`}>
                        {analysis.mobile.isResponsive ? '✓' : '?'} Responsive
                      </div>
                    </div>
                  </CategoryCard>

                  <CategoryCard
                    title="Content Quality"
                    icon="📝"
                    score={analysis.content.score}
                    issues={analysis.content.issues}
                    sectionKey="content"
                  >
                    <div className="space-y-3">
                      {analysis.content.title && (
                        <div>
                          <p className="text-xs text-text3 mb-1">Page Title</p>
                          <p className="text-sm text-text font-medium">{analysis.content.title}</p>
                        </div>
                      )}
                      {analysis.content.h1.length > 0 && (
                        <div>
                          <p className="text-xs text-text3 mb-1">H1 Heading</p>
                          <p className="text-sm text-text">{analysis.content.h1[0]}</p>
                        </div>
                      )}
                      <div className="flex gap-4 text-sm">
                        <span className="text-text2">Words: <span className="font-medium text-text">{analysis.content.wordCount}</span></span>
                        <span className="text-text2">Images: <span className="font-medium text-text">{analysis.content.hasImages ? 'Yes' : 'No'}</span></span>
                      </div>
                    </div>
                  </CategoryCard>

                  {keywords && (
                    <CategoryCard
                      title="Keyword Relevance"
                      icon="🎯"
                      score={analysis.relevance.score}
                      issues={analysis.relevance.missingKeywords.length > 0 ? [`Missing: ${analysis.relevance.missingKeywords.join(', ')}`] : []}
                      sectionKey="relevance"
                    >
                      <div className="space-y-3">
                        {analysis.relevance.matchedKeywords.length > 0 && (
                          <div>
                            <p className="text-xs text-text3 mb-2">Found Keywords</p>
                            <div className="flex flex-wrap gap-2">
                              {analysis.relevance.matchedKeywords.map((kw, i) => (
                                <span key={i} className="px-2 py-1 bg-success-light text-success text-xs rounded-lg">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysis.relevance.missingKeywords.length > 0 && (
                          <div>
                            <p className="text-xs text-text3 mb-2">Missing Keywords</p>
                            <div className="flex flex-wrap gap-2">
                              {analysis.relevance.missingKeywords.map((kw, i) => (
                                <span key={i} className="px-2 py-1 bg-danger-light text-danger text-xs rounded-lg">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CategoryCard>
                  )}

                  <CategoryCard
                    title="Call to Action"
                    icon="👆"
                    score={analysis.cta.score}
                    issues={analysis.cta.issues}
                    sectionKey="cta"
                  >
                    {analysis.cta.found.length > 0 ? (
                      <div>
                        <p className="text-xs text-text3 mb-2">CTAs Found</p>
                        <div className="flex flex-wrap gap-2">
                          {analysis.cta.found.map((cta, i) => (
                            <span key={i} className="px-3 py-1.5 bg-accent-light text-accent text-sm font-medium rounded-lg">
                              "{cta.text}" <span className="text-text3">({cta.type})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text2">No clear call-to-action buttons detected</p>
                    )}
                  </CategoryCard>

                  <CategoryCard
                    title="Security"
                    icon="🔒"
                    score={analysis.security.score}
                    issues={analysis.security.issues}
                    sectionKey="security"
                  >
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${analysis.security.hasSSL ? 'bg-success-light' : 'bg-danger-light'}`}>
                      {analysis.security.hasSSL ? (
                        <>
                          <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-success font-medium">SSL Certificate Active</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="text-danger font-medium">No SSL (HTTP only)</span>
                        </>
                      )}
                    </div>
                  </CategoryCard>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
