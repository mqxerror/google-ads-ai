/**
 * Landing Page Analyzer API
 *
 * POST: Analyze a landing page for Google Ads quality factors
 * - Page speed (Core Web Vitals simulation)
 * - Mobile friendliness
 * - Keyword relevance (compare page content vs ad keywords)
 * - CTA detection
 * - SSL/Security check
 * - Content analysis
 * - Moz metrics (DA, PA, spam score) - optional
 */

import { NextRequest, NextResponse } from 'next/server';

interface AnalysisRequest {
  url: string;
  keywords?: string[]; // Ad keywords to check relevance
  campaignId?: string;
  source?: 'basic' | 'moz' | 'all'; // Data source selection
}

// Moz API metrics
interface MozMetrics {
  domainAuthority: number; // 0-100
  pageAuthority: number; // 0-100
  spamScore: number; // 0-100
  linkingDomains: number;
  totalLinks: number;
  mozRank: number;
}

interface PageAnalysis {
  url: string;
  score: number; // 0-100 overall score

  // Moz Authority Metrics (optional, requires API key)
  authority?: {
    domainAuthority: number;
    pageAuthority: number;
    spamScore: number;
    linkingDomains: number;
    totalLinks: number;
    issues: string[];
    source: 'moz' | 'estimated';
  };

  // Speed metrics
  speed: {
    score: number;
    loadTime: number; // seconds
    ttfb: number; // Time to First Byte
    issues: string[];
  };

  // Mobile metrics
  mobile: {
    score: number;
    isResponsive: boolean;
    hasViewport: boolean;
    issues: string[];
  };

  // SEO/Content metrics
  content: {
    score: number;
    title: string;
    description: string;
    h1: string[];
    wordCount: number;
    hasImages: boolean;
    issues: string[];
  };

  // Keyword relevance
  relevance: {
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    keywordDensity: Record<string, number>;
  };

  // CTA analysis
  cta: {
    score: number;
    found: { text: string; type: string }[];
    issues: string[];
  };

  // Security
  security: {
    score: number;
    hasSSL: boolean;
    issues: string[];
  };

  // Recommendations
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: string;
    message: string;
    impact: string;
  }[];

  analyzedAt: string;
  dataSource: 'basic' | 'moz' | 'all';
}

// Common CTA patterns
const CTA_PATTERNS = [
  { pattern: /buy\s*now/i, type: 'purchase' },
  { pattern: /add\s*to\s*cart/i, type: 'purchase' },
  { pattern: /shop\s*now/i, type: 'purchase' },
  { pattern: /order\s*now/i, type: 'purchase' },
  { pattern: /get\s*started/i, type: 'signup' },
  { pattern: /sign\s*up/i, type: 'signup' },
  { pattern: /start\s*free/i, type: 'signup' },
  { pattern: /try\s*(it\s*)?free/i, type: 'signup' },
  { pattern: /learn\s*more/i, type: 'info' },
  { pattern: /contact\s*us/i, type: 'contact' },
  { pattern: /get\s*a?\s*quote/i, type: 'lead' },
  { pattern: /request\s*(a\s*)?demo/i, type: 'lead' },
  { pattern: /schedule\s*(a\s*)?(call|meeting|consultation)/i, type: 'lead' },
  { pattern: /download/i, type: 'download' },
  { pattern: /subscribe/i, type: 'subscription' },
  { pattern: /book\s*(now|appointment)/i, type: 'booking' },
];

// Fetch Moz metrics via their API
async function fetchMozMetrics(targetUrl: string): Promise<MozMetrics | null> {
  try {
    // Get Moz API credentials from database or environment
    const mozAccessId = process.env.MOZ_ACCESS_ID;
    const mozSecretKey = process.env.MOZ_SECRET_KEY;

    if (!mozAccessId || !mozSecretKey) {
      console.log('[Landing Page Analyzer] Moz API credentials not configured');
      return null;
    }

    // Moz API V2 URL Metrics endpoint
    const apiEndpoint = 'https://lsapi.seomoz.com/v2/url_metrics';

    // Create Basic Auth header
    const authString = Buffer.from(`${mozAccessId}:${mozSecretKey}`).toString('base64');

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targets: [targetUrl],
      }),
    });

    if (!response.ok) {
      console.error('[Landing Page Analyzer] Moz API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result) {
      return null;
    }

    return {
      domainAuthority: Math.round(result.domain_authority || 0),
      pageAuthority: Math.round(result.page_authority || 0),
      spamScore: Math.round((result.spam_score || 0) * 100), // Convert to percentage
      linkingDomains: result.root_domains_to_root_domain || 0,
      totalLinks: result.external_pages_to_root_domain || 0,
      mozRank: result.moz_rank || 0,
    };
  } catch (error) {
    console.error('[Landing Page Analyzer] Moz API fetch error:', error);
    return null;
  }
}

// Estimate authority based on basic signals (when Moz not available)
function estimateAuthority(html: string, url: string, loadTime: number): PageAnalysis['authority'] {
  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname;

  let estimatedDA = 30; // Base score
  let estimatedPA = 25;
  const issues: string[] = [];

  // Boost for well-known TLDs
  if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
    estimatedDA += 20;
  } else if (domain.endsWith('.org')) {
    estimatedDA += 5;
  }

  // Content quality signals
  const hasStructuredData = html.includes('application/ld+json') || html.includes('itemtype=');
  if (hasStructuredData) {
    estimatedDA += 5;
    estimatedPA += 10;
  } else {
    issues.push('No structured data (schema.org) detected');
  }

  // Social signals
  const hasOGTags = html.includes('og:') || html.includes('twitter:');
  if (hasOGTags) {
    estimatedPA += 5;
  }

  // Performance penalty
  if (loadTime > 3) {
    estimatedDA -= 5;
    estimatedPA -= 10;
    issues.push('Slow load time affects authority');
  }

  // Canonical URL
  const hasCanonical = html.includes('rel="canonical"') || html.includes("rel='canonical'");
  if (!hasCanonical) {
    issues.push('Missing canonical URL tag');
  }

  // Hreflang for international
  const hasHreflang = html.includes('hreflang=');
  if (hasHreflang) {
    estimatedDA += 3;
  }

  // Check for robots meta
  const hasNoindex = html.toLowerCase().includes('noindex');
  if (hasNoindex) {
    estimatedPA -= 20;
    issues.push('Page has noindex directive');
  }

  return {
    domainAuthority: Math.min(100, Math.max(1, estimatedDA)),
    pageAuthority: Math.min(100, Math.max(1, estimatedPA)),
    spamScore: 0, // Can't estimate
    linkingDomains: 0,
    totalLinks: 0,
    issues,
    source: 'estimated',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { url, keywords = [], source = 'all' } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const finalUrl = parsedUrl.toString();
    console.log(`[Landing Page Analyzer] Analyzing: ${finalUrl}`);

    // Fetch the page
    const startTime = Date.now();
    let html = '';
    let ttfb = 0;
    let loadTime = 0;
    let hasSSL = finalUrl.startsWith('https');
    let fetchError = '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const ttfbStart = Date.now();
      const response = await fetch(finalUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; QuickAdsBot/1.0; +https://quickads.ai)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      ttfb = Date.now() - ttfbStart;

      clearTimeout(timeout);

      if (!response.ok) {
        fetchError = `HTTP ${response.status}`;
      } else {
        html = await response.text();
        loadTime = (Date.now() - startTime) / 1000;
      }
    } catch (err: any) {
      fetchError = err.name === 'AbortError' ? 'Timeout (>15s)' : err.message;
      console.error('[Landing Page Analyzer] Fetch error:', fetchError);
    }

    // If we couldn't fetch, return partial analysis
    if (!html) {
      return NextResponse.json({
        url: finalUrl,
        score: 0,
        error: `Could not fetch page: ${fetchError}`,
        speed: { score: 0, loadTime: 0, ttfb: 0, issues: [`Failed to load: ${fetchError}`] },
        mobile: { score: 0, isResponsive: false, hasViewport: false, issues: ['Could not analyze'] },
        content: { score: 0, title: '', description: '', h1: [], wordCount: 0, hasImages: false, issues: ['Could not analyze'] },
        relevance: { score: 0, matchedKeywords: [], missingKeywords: keywords, keywordDensity: {} },
        cta: { score: 0, found: [], issues: ['Could not analyze'] },
        security: { score: hasSSL ? 50 : 0, hasSSL, issues: hasSSL ? [] : ['No SSL certificate'] },
        recommendations: [{ priority: 'high', category: 'Accessibility', message: 'Page could not be loaded', impact: 'Users cannot access your landing page' }],
        analyzedAt: new Date().toISOString(),
      });
    }

    // Fetch Moz metrics if requested
    let mozMetrics: MozMetrics | null = null;
    if (source === 'moz' || source === 'all') {
      mozMetrics = await fetchMozMetrics(finalUrl);
    }

    // Parse HTML and analyze
    const analysis = analyzeHtml(html, finalUrl, keywords, loadTime, ttfb, hasSSL, mozMetrics, source);

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('[Landing Page Analyzer] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Analysis failed',
    }, { status: 500 });
  }
}

function analyzeHtml(
  html: string,
  url: string,
  keywords: string[],
  loadTime: number,
  ttfb: number,
  hasSSL: boolean,
  mozMetrics: MozMetrics | null,
  dataSource: 'basic' | 'moz' | 'all'
): PageAnalysis {
  const lowerHtml = html.toLowerCase();
  const recommendations: PageAnalysis['recommendations'] = [];

  // === AUTHORITY METRICS ===
  let authority: PageAnalysis['authority'];
  if (mozMetrics) {
    // Use real Moz data
    const authorityIssues: string[] = [];
    if (mozMetrics.domainAuthority < 20) {
      authorityIssues.push('Low Domain Authority - build more quality backlinks');
      recommendations.push({
        priority: 'medium',
        category: 'Authority',
        message: 'Domain Authority is low',
        impact: 'Higher DA correlates with better rankings',
      });
    }
    if (mozMetrics.spamScore > 30) {
      authorityIssues.push(`High Spam Score (${mozMetrics.spamScore}%) - review backlink profile`);
      recommendations.push({
        priority: 'high',
        category: 'Authority',
        message: 'High spam score detected',
        impact: 'Spammy backlinks can hurt rankings',
      });
    }
    if (mozMetrics.pageAuthority < mozMetrics.domainAuthority - 20) {
      authorityIssues.push('Page Authority is much lower than Domain - optimize page-level SEO');
    }

    authority = {
      domainAuthority: mozMetrics.domainAuthority,
      pageAuthority: mozMetrics.pageAuthority,
      spamScore: mozMetrics.spamScore,
      linkingDomains: mozMetrics.linkingDomains,
      totalLinks: mozMetrics.totalLinks,
      issues: authorityIssues,
      source: 'moz',
    };
  } else {
    // Use estimated authority
    const estimated = estimateAuthority(html, url, loadTime);
    if (dataSource !== 'basic' && estimated) {
      estimated.issues.push('Moz API not configured - showing estimates');
    }
    authority = estimated;
  }

  // === SPEED ANALYSIS ===
  const speedIssues: string[] = [];
  let speedScore = 100;

  if (loadTime > 3) {
    speedScore -= 30;
    speedIssues.push(`Slow load time: ${loadTime.toFixed(1)}s (should be <3s)`);
    recommendations.push({
      priority: 'high',
      category: 'Speed',
      message: 'Page loads too slowly',
      impact: 'Slow pages have 53% higher bounce rate',
    });
  } else if (loadTime > 2) {
    speedScore -= 15;
    speedIssues.push(`Load time could be faster: ${loadTime.toFixed(1)}s`);
  }

  if (ttfb > 600) {
    speedScore -= 20;
    speedIssues.push(`Slow server response: ${ttfb}ms TTFB`);
  }

  // Check for render-blocking resources
  const inlineScripts = (html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || []).length;
  if (inlineScripts > 10) {
    speedScore -= 10;
    speedIssues.push(`Too many inline scripts (${inlineScripts})`);
  }

  speedScore = Math.max(0, speedScore);

  // === MOBILE ANALYSIS ===
  const mobileIssues: string[] = [];
  let mobileScore = 100;

  const hasViewport = lowerHtml.includes('viewport');
  if (!hasViewport) {
    mobileScore -= 40;
    mobileIssues.push('Missing viewport meta tag');
    recommendations.push({
      priority: 'high',
      category: 'Mobile',
      message: 'Add viewport meta tag for mobile responsiveness',
      impact: 'Page may not display correctly on mobile devices',
    });
  }

  const hasMediaQueries = html.includes('@media') || html.includes('media=');
  const hasResponsiveImages = html.includes('srcset') || html.includes('sizes=');
  const isResponsive = hasViewport && (hasMediaQueries || hasResponsiveImages);

  if (!isResponsive && hasViewport) {
    mobileScore -= 20;
    mobileIssues.push('Limited responsive design detected');
  }

  // Check for small touch targets (approximate)
  const smallButtons = (html.match(/font-size:\s*(\d+)px/gi) || [])
    .filter(m => parseInt(m.match(/\d+/)?.[0] || '16') < 12).length;
  if (smallButtons > 5) {
    mobileScore -= 15;
    mobileIssues.push('Some text may be too small on mobile');
  }

  mobileScore = Math.max(0, mobileScore);

  // === CONTENT ANALYSIS ===
  const contentIssues: string[] = [];
  let contentScore = 100;

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  if (!title) {
    contentScore -= 20;
    contentIssues.push('Missing page title');
    recommendations.push({
      priority: 'high',
      category: 'SEO',
      message: 'Add a descriptive page title',
      impact: 'Title is crucial for ad relevance and Quality Score',
    });
  } else if (title.length < 30) {
    contentScore -= 10;
    contentIssues.push('Title is too short');
  } else if (title.length > 60) {
    contentScore -= 5;
    contentIssues.push('Title may be truncated in search results');
  }

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : '';
  if (!description) {
    contentScore -= 15;
    contentIssues.push('Missing meta description');
  }

  // Extract H1s
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1s = h1Matches.map(h => h.replace(/<[^>]*>/g, '').trim()).filter(h => h);
  if (h1s.length === 0) {
    contentScore -= 15;
    contentIssues.push('Missing H1 heading');
    recommendations.push({
      priority: 'medium',
      category: 'SEO',
      message: 'Add a clear H1 heading',
      impact: 'H1 helps Google understand page topic',
    });
  } else if (h1s.length > 1) {
    contentScore -= 5;
    contentIssues.push('Multiple H1 headings (should have one)');
  }

  // Word count (approximate)
  const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                         .replace(/<style[\s\S]*?<\/style>/gi, '')
                         .replace(/<[^>]*>/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();
  const wordCount = textContent.split(' ').filter(w => w.length > 2).length;
  if (wordCount < 100) {
    contentScore -= 20;
    contentIssues.push('Very thin content (low word count)');
    recommendations.push({
      priority: 'medium',
      category: 'Content',
      message: 'Add more descriptive content',
      impact: 'Thin content hurts Quality Score and conversions',
    });
  }

  const hasImages = html.includes('<img');

  contentScore = Math.max(0, contentScore);

  // === KEYWORD RELEVANCE ===
  const relevanceResult = analyzeKeywordRelevance(textContent, title, h1s, keywords);

  if (keywords.length > 0 && relevanceResult.score < 50) {
    recommendations.push({
      priority: 'high',
      category: 'Relevance',
      message: `Missing keywords: ${relevanceResult.missingKeywords.slice(0, 3).join(', ')}`,
      impact: 'Low keyword relevance hurts Quality Score',
    });
  }

  // === CTA ANALYSIS ===
  const ctaIssues: string[] = [];
  let ctaScore = 100;
  const ctasFound: { text: string; type: string }[] = [];

  for (const { pattern, type } of CTA_PATTERNS) {
    const matches = textContent.match(pattern);
    if (matches) {
      ctasFound.push({ text: matches[0], type });
    }
  }

  // Check for buttons/links with action text
  const buttonMatches = html.match(/<(button|a)[^>]*>([\s\S]*?)<\/(button|a)>/gi) || [];
  for (const btn of buttonMatches) {
    const btnText = btn.replace(/<[^>]*>/g, '').trim();
    if (btnText.length > 2 && btnText.length < 30) {
      for (const { pattern, type } of CTA_PATTERNS) {
        if (pattern.test(btnText) && !ctasFound.some(c => c.text.toLowerCase() === btnText.toLowerCase())) {
          ctasFound.push({ text: btnText, type });
        }
      }
    }
  }

  if (ctasFound.length === 0) {
    ctaScore = 30;
    ctaIssues.push('No clear call-to-action found');
    recommendations.push({
      priority: 'high',
      category: 'Conversion',
      message: 'Add a clear call-to-action button',
      impact: 'Pages without CTAs have very low conversion rates',
    });
  } else if (ctasFound.length === 1) {
    ctaScore = 80;
  }

  // === SECURITY ===
  const securityIssues: string[] = [];
  let securityScore = hasSSL ? 100 : 0;

  if (!hasSSL) {
    securityIssues.push('No SSL certificate (HTTP only)');
    recommendations.push({
      priority: 'high',
      category: 'Security',
      message: 'Enable HTTPS for your landing page',
      impact: 'Google penalizes non-HTTPS pages, browsers show warnings',
    });
  }

  // Check for mixed content hints
  if (hasSSL && html.includes('http://') && !html.includes('http://schema')) {
    securityScore -= 20;
    securityIssues.push('Possible mixed content (HTTP resources on HTTPS page)');
  }

  // === CALCULATE OVERALL SCORE ===
  const weights = {
    speed: 0.20,
    mobile: 0.20,
    content: 0.20,
    relevance: 0.20,
    cta: 0.15,
    security: 0.05,
  };

  const overallScore = Math.round(
    speedScore * weights.speed +
    mobileScore * weights.mobile +
    contentScore * weights.content +
    relevanceResult.score * weights.relevance +
    ctaScore * weights.cta +
    securityScore * weights.security
  );

  // Sort recommendations by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    url,
    score: overallScore,
    authority,
    speed: {
      score: speedScore,
      loadTime,
      ttfb,
      issues: speedIssues,
    },
    mobile: {
      score: mobileScore,
      isResponsive,
      hasViewport,
      issues: mobileIssues,
    },
    content: {
      score: contentScore,
      title,
      description,
      h1: h1s,
      wordCount,
      hasImages,
      issues: contentIssues,
    },
    relevance: relevanceResult,
    cta: {
      score: ctaScore,
      found: ctasFound,
      issues: ctaIssues,
    },
    security: {
      score: securityScore,
      hasSSL,
      issues: securityIssues,
    },
    recommendations,
    analyzedAt: new Date().toISOString(),
    dataSource,
  };
}

function analyzeKeywordRelevance(
  text: string,
  title: string,
  h1s: string[],
  keywords: string[]
): PageAnalysis['relevance'] {
  if (keywords.length === 0) {
    return {
      score: 100, // No keywords to check = assume ok
      matchedKeywords: [],
      missingKeywords: [],
      keywordDensity: {},
    };
  }

  const lowerText = text.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerH1s = h1s.map(h => h.toLowerCase()).join(' ');
  const totalWords = text.split(/\s+/).length || 1;

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  const keywordDensity: Record<string, number> = {};

  for (const keyword of keywords) {
    const lowerKw = keyword.toLowerCase();
    const regex = new RegExp(lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = (lowerText.match(regex) || []).length;

    if (matches > 0) {
      matchedKeywords.push(keyword);
      keywordDensity[keyword] = Math.round((matches / totalWords) * 1000) / 10; // percentage * 10
    } else {
      missingKeywords.push(keyword);
    }
  }

  // Bonus for keywords in title or H1
  let titleBonus = 0;
  for (const kw of matchedKeywords) {
    if (lowerTitle.includes(kw.toLowerCase())) titleBonus += 10;
    if (lowerH1s.includes(kw.toLowerCase())) titleBonus += 5;
  }

  // Calculate score
  const matchRate = matchedKeywords.length / keywords.length;
  let score = Math.round(matchRate * 80) + Math.min(titleBonus, 20);
  score = Math.min(100, Math.max(0, score));

  return {
    score,
    matchedKeywords,
    missingKeywords,
    keywordDensity,
  };
}
