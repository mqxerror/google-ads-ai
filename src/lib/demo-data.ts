// Demo data for testing without Google Ads API
import type { Campaign, AdGroup, Keyword, QualityScoreRating } from '@/types/campaign';
import type {
  CampaignHealth,
  CampaignIssue,
  BudgetPacing,
  LastChange,
  CampaignTrends,
  TrendData,
} from '@/types/health';

// Helper to generate trend data
function generateTrend(
  baseValue: number,
  volatility: number,
  direction: 'up' | 'down' | 'stable'
): TrendData {
  const days = 7;
  const values: number[] = [];
  const dates: string[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);

    const trend = direction === 'up' ? i * -volatility : direction === 'down' ? i * volatility : 0;
    const noise = (Math.random() - 0.5) * volatility * 2;
    values.push(Math.max(0, baseValue + trend + noise));
  }

  const first = values[0];
  const last = values[values.length - 1];
  const changePercent = first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    values,
    dates,
    changePercent,
    direction,
  };
}

// Generate health data for a campaign
function generateHealth(
  score: number,
  hasIssues: boolean
): CampaignHealth {
  const issues: CampaignIssue[] = [];

  if (hasIssues && score < 75) {
    if (score < 50) {
      issues.push({
        id: `issue-${Math.random().toString(36).substr(2, 9)}`,
        category: 'wasted_spend',
        label: 'Wasted Spend Detected',
        icon: 'trash',
        severity: 'critical',
        impactEstimate: '$450/mo recoverable',
        impactValue: 450,
        impactMetric: 'savings',
        confidence: 'high',
        summary: 'Non-converting search terms are consuming 15% of budget',
        evidence: {
          metrics: [
            {
              name: 'wastedSpend',
              label: 'Wasted Spend',
              current: 450,
              previous: 380,
              change: 70,
              changePercent: 18.4,
              direction: 'up',
              format: 'currency',
              isGood: false,
            },
          ],
          dataPoints: 30,
          searchQueries: [
            { query: 'free project management software', clicks: 45, spend: 125.50, conversions: 0, recommendation: 'add_negative' },
            { query: 'project management jobs', clicks: 38, spend: 98.75, conversions: 0, recommendation: 'add_negative' },
            { query: 'what is project management', clicks: 52, spend: 88.20, conversions: 0, recommendation: 'add_negative' },
            { query: 'project management certification', clicks: 28, spend: 72.30, conversions: 0, recommendation: 'add_negative' },
            { query: 'project management courses', clicks: 25, spend: 65.25, conversions: 0, recommendation: 'review' },
          ],
        },
        fixes: [
          {
            id: 'fix-1',
            action: 'Add negative keywords',
            actionType: 'add_negatives',
            description: 'Add 12 recommended negative keywords to block irrelevant traffic',
            expectedImpact: 'Save $450/month',
            impactRange: { min: 350, max: 550, metric: 'savings' },
            assumptions: ['Traffic patterns remain consistent'],
            confidence: 'high',
            effort: 'quick',
            risk: 'low',
          },
        ],
        createdAt: new Date(),
      });
    }

    if (score < 65) {
      issues.push({
        id: `issue-${Math.random().toString(36).substr(2, 9)}`,
        category: 'high_cpa',
        label: 'CPA Above Target',
        icon: 'arrow-trending-up',
        severity: 'warning',
        impactEstimate: '+8 conversions possible',
        impactValue: 8,
        impactMetric: 'conversions',
        confidence: 'medium',
        summary: 'CPA is 35% higher than account average',
        evidence: {
          metrics: [
            {
              name: 'cpa',
              label: 'CPA',
              current: 85.50,
              previous: 65.00,
              change: 20.50,
              changePercent: 31.5,
              direction: 'up',
              format: 'currency',
              isGood: false,
            },
          ],
          dataPoints: 14,
        },
        fixes: [
          {
            id: 'fix-2',
            action: 'Adjust bid strategy',
            actionType: 'adjust_bid',
            description: 'Lower target CPA by 15% to improve efficiency',
            expectedImpact: '+8 conversions/month',
            impactRange: { min: 5, max: 12, metric: 'conversions' },
            assumptions: ['Conversion rate holds steady'],
            confidence: 'medium',
            effort: 'quick',
            risk: 'medium',
          },
        ],
        createdAt: new Date(),
      });
    }
  }

  return {
    score,
    label: score >= 75 ? 'Healthy' : score >= 50 ? 'Watch' : 'Action Needed',
    trend: score >= 70 ? 'improving' : score >= 50 ? 'stable' : 'declining',
    trendChange: Math.floor(Math.random() * 10) - 5,
    issues,
    opportunities: [],
    topIssue: issues[0],
    issueCount: {
      critical: issues.filter(i => i.severity === 'critical').length,
      warning: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
    },
    lastCalculated: new Date(),
    dataQuality: 'good',
  };
}

// Demo campaigns
export const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: 'demo-camp-1',
    name: 'Brand - Search Campaign',
    status: 'ENABLED',
    type: 'SEARCH',
    spend: 2450.75,
    budget: 3000,
    clicks: 1245,
    impressions: 45230,
    conversions: 87,
    conversionValue: 12500,
    ctr: 2.75,
    cpa: 28.17,
    roas: 5.1,
    aiScore: 92,
    health: generateHealth(92, false),
    budgetPacing: {
      status: 'on_track',
      percentUsed: 82,
      daysRemaining: 8,
      projectedSpend: 2980,
      budget: 3000,
    },
    lastChange: {
      who: 'AI Assistant',
      what: 'Increased budget by 10%',
      field: 'budget',
      oldValue: 2700,
      newValue: 3000,
      when: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      source: 'ai',
    },
    trends: {
      spend: generateTrend(350, 30, 'stable'),
      conversions: generateTrend(12, 2, 'up'),
      ctr: generateTrend(2.75, 0.3, 'stable'),
      cpa: generateTrend(28, 3, 'down'),
    },
  },
  {
    id: 'demo-camp-2',
    name: 'Performance Max - All Products',
    status: 'ENABLED',
    type: 'PERFORMANCE_MAX',
    spend: 5680.25,
    budget: 6000,
    clicks: 3420,
    impressions: 125000,
    conversions: 156,
    conversionValue: 28500,
    ctr: 2.74,
    cpa: 36.41,
    roas: 5.02,
    aiScore: 78,
    health: generateHealth(78, true),
    budgetPacing: {
      status: 'on_track',
      percentUsed: 95,
      daysRemaining: 8,
      projectedSpend: 5950,
      budget: 6000,
    },
    lastChange: {
      who: 'John Smith',
      what: 'Updated asset group',
      when: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      source: 'user',
    },
    trends: {
      spend: generateTrend(810, 50, 'up'),
      conversions: generateTrend(22, 3, 'up'),
      ctr: generateTrend(2.74, 0.2, 'stable'),
      cpa: generateTrend(36, 4, 'stable'),
    },
  },
  {
    id: 'demo-camp-3',
    name: 'Non-Brand - Generic Terms',
    status: 'ENABLED',
    type: 'SEARCH',
    spend: 3250.50,
    budget: 4000,
    clicks: 1890,
    impressions: 78500,
    conversions: 42,
    conversionValue: 6300,
    ctr: 2.41,
    cpa: 77.39,
    roas: 1.94,
    aiScore: 45,
    health: generateHealth(45, true),
    budgetPacing: {
      status: 'underspend',
      percentUsed: 81,
      daysRemaining: 8,
      projectedSpend: 3500,
      budget: 4000,
      recommendation: 'Consider increasing bids to capture more traffic',
    },
    lastChange: {
      who: 'System',
      what: 'Paused 3 low-performing keywords',
      when: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      source: 'system',
    },
    trends: {
      spend: generateTrend(460, 40, 'down'),
      conversions: generateTrend(6, 2, 'down'),
      ctr: generateTrend(2.41, 0.4, 'down'),
      cpa: generateTrend(77, 10, 'up'),
    },
  },
  {
    id: 'demo-camp-4',
    name: 'Competitor - Targeting',
    status: 'PAUSED',
    type: 'SEARCH',
    spend: 890.25,
    budget: 1500,
    clicks: 567,
    impressions: 23400,
    conversions: 8,
    conversionValue: 1200,
    ctr: 2.42,
    cpa: 111.28,
    roas: 1.35,
    aiScore: 32,
    health: generateHealth(32, true),
    budgetPacing: {
      status: 'limited',
      percentUsed: 59,
      daysRemaining: 8,
      projectedSpend: 890,
      budget: 1500,
      recommendation: 'Campaign is paused',
    },
    lastChange: {
      who: 'Demo User',
      what: 'Paused campaign',
      field: 'status',
      oldValue: 'ENABLED',
      newValue: 'PAUSED',
      when: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      source: 'user',
    },
    trends: {
      spend: generateTrend(127, 30, 'down'),
      conversions: generateTrend(1, 1, 'down'),
      ctr: generateTrend(2.42, 0.5, 'stable'),
      cpa: generateTrend(111, 15, 'up'),
    },
  },
  {
    id: 'demo-camp-5',
    name: 'Shopping - Best Sellers',
    status: 'ENABLED',
    type: 'SHOPPING',
    spend: 4120.00,
    budget: 4500,
    clicks: 2890,
    impressions: 95000,
    conversions: 134,
    conversionValue: 18760,
    ctr: 3.04,
    cpa: 30.75,
    roas: 4.55,
    aiScore: 85,
    health: generateHealth(85, false),
    budgetPacing: {
      status: 'on_track',
      percentUsed: 92,
      daysRemaining: 8,
      projectedSpend: 4480,
      budget: 4500,
    },
    lastChange: {
      who: 'AI Assistant',
      what: 'Optimized product groups',
      when: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      source: 'ai',
    },
    trends: {
      spend: generateTrend(588, 35, 'stable'),
      conversions: generateTrend(19, 2, 'up'),
      ctr: generateTrend(3.04, 0.25, 'up'),
      cpa: generateTrend(30.75, 3, 'down'),
    },
  },
  {
    id: 'demo-camp-6',
    name: 'Display - Remarketing',
    status: 'ENABLED',
    type: 'DISPLAY',
    spend: 1250.50,
    budget: 1500,
    clicks: 4560,
    impressions: 285000,
    conversions: 28,
    conversionValue: 4200,
    ctr: 1.60,
    cpa: 44.66,
    roas: 3.36,
    aiScore: 68,
    health: generateHealth(68, true),
    budgetPacing: {
      status: 'on_track',
      percentUsed: 83,
      daysRemaining: 8,
      projectedSpend: 1470,
      budget: 1500,
    },
    lastChange: {
      who: 'John Smith',
      what: 'Added new audience segment',
      when: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      source: 'user',
    },
    trends: {
      spend: generateTrend(178, 20, 'stable'),
      conversions: generateTrend(4, 1, 'stable'),
      ctr: generateTrend(1.60, 0.15, 'stable'),
      cpa: generateTrend(44.66, 5, 'stable'),
    },
  },
  {
    id: 'demo-camp-7',
    name: 'YouTube - Product Demos',
    status: 'ENABLED',
    type: 'VIDEO',
    spend: 2100.00,
    budget: 2500,
    clicks: 1234,
    impressions: 156000,
    conversions: 18,
    conversionValue: 2700,
    ctr: 0.79,
    cpa: 116.67,
    roas: 1.29,
    aiScore: 55,
    health: generateHealth(55, true),
    budgetPacing: {
      status: 'underspend',
      percentUsed: 84,
      daysRemaining: 8,
      projectedSpend: 2200,
      budget: 2500,
    },
    lastChange: {
      who: 'Demo User',
      what: 'Updated video assets',
      when: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      source: 'user',
    },
    trends: {
      spend: generateTrend(300, 25, 'stable'),
      conversions: generateTrend(2.5, 1, 'down'),
      ctr: generateTrend(0.79, 0.1, 'down'),
      cpa: generateTrend(116, 15, 'up'),
    },
  },
  {
    id: 'demo-camp-8',
    name: 'Demand Gen - Lookalikes',
    status: 'ENABLED',
    type: 'DEMAND_GEN',
    spend: 1850.75,
    budget: 2000,
    clicks: 2340,
    impressions: 198000,
    conversions: 32,
    conversionValue: 4800,
    ctr: 1.18,
    cpa: 57.84,
    roas: 2.59,
    aiScore: 72,
    health: generateHealth(72, true),
    budgetPacing: {
      status: 'on_track',
      percentUsed: 93,
      daysRemaining: 8,
      projectedSpend: 1980,
      budget: 2000,
    },
    lastChange: {
      who: 'AI Assistant',
      what: 'Expanded audience targeting',
      when: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      source: 'ai',
    },
    trends: {
      spend: generateTrend(264, 20, 'up'),
      conversions: generateTrend(4.5, 1, 'up'),
      ctr: generateTrend(1.18, 0.1, 'stable'),
      cpa: generateTrend(57.84, 6, 'down'),
    },
  },
];

// Demo ad groups
export const DEMO_AD_GROUPS: AdGroup[] = [
  {
    id: 'demo-ag-1',
    campaignId: 'demo-camp-1',
    name: 'Brand - Exact Match',
    status: 'ENABLED',
    clicks: 650,
    conversions: 52,
    cpa: 23.50,
    spend: 1222.00,
  },
  {
    id: 'demo-ag-2',
    campaignId: 'demo-camp-1',
    name: 'Brand - Phrase Match',
    status: 'ENABLED',
    clicks: 595,
    conversions: 35,
    cpa: 35.11,
    spend: 1228.75,
  },
  {
    id: 'demo-ag-3',
    campaignId: 'demo-camp-3',
    name: 'Generic - Product Category',
    status: 'ENABLED',
    clicks: 890,
    conversions: 22,
    cpa: 68.18,
    spend: 1500.00,
  },
  {
    id: 'demo-ag-4',
    campaignId: 'demo-camp-3',
    name: 'Generic - Problem/Solution',
    status: 'ENABLED',
    clicks: 1000,
    conversions: 20,
    cpa: 87.53,
    spend: 1750.50,
  },
  {
    id: 'demo-ag-5',
    campaignId: 'demo-camp-5',
    name: 'Best Sellers - Electronics',
    status: 'ENABLED',
    clicks: 1450,
    conversions: 78,
    cpa: 26.41,
    spend: 2060.00,
  },
  {
    id: 'demo-ag-6',
    campaignId: 'demo-camp-5',
    name: 'Best Sellers - Home & Garden',
    status: 'ENABLED',
    clicks: 1440,
    conversions: 56,
    cpa: 36.79,
    spend: 2060.00,
  },
];

// Demo keywords with Quality Score breakdown
export const DEMO_KEYWORDS: Keyword[] = [
  {
    id: 'demo-kw-1',
    adGroupId: 'demo-ag-1',
    text: 'acme software',
    matchType: 'EXACT',
    status: 'ENABLED',
    clicks: 320,
    conversions: 28,
    cpa: 19.64,
    qualityScore: 9,
    spend: 550.00,
    expectedCtr: 'ABOVE_AVERAGE',
    adRelevance: 'ABOVE_AVERAGE',
    landingPageExperience: 'ABOVE_AVERAGE',
  },
  {
    id: 'demo-kw-2',
    adGroupId: 'demo-ag-1',
    text: 'acme app',
    matchType: 'EXACT',
    status: 'ENABLED',
    clicks: 180,
    conversions: 14,
    cpa: 24.29,
    qualityScore: 8,
    spend: 340.00,
    expectedCtr: 'ABOVE_AVERAGE',
    adRelevance: 'ABOVE_AVERAGE',
    landingPageExperience: 'AVERAGE',
  },
  {
    id: 'demo-kw-3',
    adGroupId: 'demo-ag-2',
    text: 'acme software reviews',
    matchType: 'PHRASE',
    status: 'ENABLED',
    clicks: 295,
    conversions: 18,
    cpa: 34.17,
    qualityScore: 7,
    spend: 615.00,
    expectedCtr: 'ABOVE_AVERAGE',
    adRelevance: 'AVERAGE',
    landingPageExperience: 'AVERAGE',
  },
  {
    id: 'demo-kw-4',
    adGroupId: 'demo-ag-3',
    text: 'best project management software',
    matchType: 'PHRASE',
    status: 'ENABLED',
    clicks: 445,
    conversions: 12,
    cpa: 62.50,
    qualityScore: 6,
    spend: 750.00,
    expectedCtr: 'AVERAGE',
    adRelevance: 'AVERAGE',
    landingPageExperience: 'AVERAGE',
  },
  {
    id: 'demo-kw-5',
    adGroupId: 'demo-ag-3',
    text: 'team collaboration tools',
    matchType: 'BROAD',
    status: 'ENABLED',
    clicks: 445,
    conversions: 10,
    cpa: 75.00,
    qualityScore: 5,
    spend: 750.00,
    expectedCtr: 'AVERAGE',
    adRelevance: 'BELOW_AVERAGE',
    landingPageExperience: 'AVERAGE',
  },
  {
    id: 'demo-kw-6',
    adGroupId: 'demo-ag-4',
    text: 'how to manage remote teams',
    matchType: 'PHRASE',
    status: 'PAUSED',
    clicks: 500,
    conversions: 8,
    cpa: 109.38,
    qualityScore: 4,
    spend: 875.25,
    expectedCtr: 'BELOW_AVERAGE',
    adRelevance: 'BELOW_AVERAGE',
    landingPageExperience: 'AVERAGE',
  },
  {
    id: 'demo-kw-7',
    adGroupId: 'demo-ag-4',
    text: 'productivity software for teams',
    matchType: 'PHRASE',
    status: 'ENABLED',
    clicks: 500,
    conversions: 12,
    cpa: 72.94,
    qualityScore: 6,
    spend: 875.25,
    expectedCtr: 'AVERAGE',
    adRelevance: 'AVERAGE',
    landingPageExperience: 'BELOW_AVERAGE',
  },
];

// Demo Google Ads account
export const DEMO_ACCOUNT = {
  id: 'demo-account-1',
  googleAccountId: '123-456-7890',
  accountName: 'Demo E-Commerce Store',
  status: 'connected',
  isManager: false,
  lastSyncAt: new Date().toISOString(),
};

// Check if demo mode is enabled
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}
