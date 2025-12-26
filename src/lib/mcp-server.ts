/**
 * MCP (Model Context Protocol) Server for Quick Ads AI
 *
 * This module provides MCP-compatible tools that can be used by:
 * - Claude Code (via MCP)
 * - FastMCP (Python)
 * - Custom AI agents
 * - n8n workflows
 *
 * To use with FastMCP, expose these as HTTP endpoints
 * To use with Claude Code, register as an MCP server
 */

import { getSupabaseClient } from './supabase';
import { generateEmbedding, EMBEDDING_MODEL } from './embeddings';

// MCP Tool Definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Available MCP Tools
export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'get_campaigns',
    description: 'Get all Google Ads campaigns with performance metrics and AI scores',
    inputSchema: {
      type: 'object',
      properties: {
        status_filter: {
          type: 'string',
          description: 'Filter by status: "all", "enabled", "paused"',
        },
      },
    },
  },
  {
    name: 'audit_campaign',
    description: 'Perform a detailed audit of a specific campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'The campaign ID to audit',
        },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'find_wasted_spend',
    description: 'Identify campaigns and keywords wasting budget',
    inputSchema: {
      type: 'object',
      properties: {
        min_spend: {
          type: 'number',
          description: 'Minimum spend threshold to consider',
        },
        max_conversions: {
          type: 'number',
          description: 'Maximum conversions to consider as waste',
        },
      },
    },
  },
  {
    name: 'suggest_negative_keywords',
    description: 'Use AI to suggest negative keywords based on search term patterns',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign ID to analyze',
        },
        similarity_threshold: {
          type: 'number',
          description: 'Semantic similarity threshold (0.5-0.95)',
        },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'cluster_keywords',
    description: 'Group keywords by semantic similarity using vector embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: {
          type: 'string',
          description: 'Comma-separated list of keywords to cluster',
        },
        threshold: {
          type: 'number',
          description: 'Similarity threshold for clustering (0.5-0.95)',
        },
      },
      required: ['keywords'],
    },
  },
  {
    name: 'generate_optimization_plan',
    description: 'Generate a comprehensive optimization plan for all campaigns',
    inputSchema: {
      type: 'object',
      properties: {
        budget_constraint: {
          type: 'number',
          description: 'Optional monthly budget constraint',
        },
        goal: {
          type: 'string',
          description: 'Optimization goal: "conversions", "roas", "cpa"',
        },
      },
    },
  },
];

// Demo campaign data
const DEMO_CAMPAIGNS = [
  {
    id: '1',
    name: 'Brand Search',
    type: 'SEARCH',
    status: 'ENABLED',
    spend: 2500,
    conversions: 45,
    ctr: 8.0,
    cpa: 55.56,
    aiScore: 78,
    impressions: 31250,
    clicks: 2500,
  },
  {
    id: '2',
    name: 'Generic Keywords',
    type: 'SEARCH',
    status: 'ENABLED',
    spend: 4200,
    conversions: 12,
    ctr: 3.2,
    cpa: 350.0,
    aiScore: 35,
    impressions: 65625,
    clicks: 2100,
  },
  {
    id: '3',
    name: 'Shopping Feed',
    type: 'SHOPPING',
    status: 'ENABLED',
    spend: 1800,
    conversions: 28,
    ctr: 5.4,
    cpa: 64.29,
    aiScore: 82,
    impressions: 33333,
    clicks: 1800,
  },
  {
    id: '4',
    name: 'Display Remarketing',
    type: 'DISPLAY',
    status: 'PAUSED',
    spend: 950,
    conversions: 3,
    ctr: 0.4,
    cpa: 316.67,
    aiScore: 28,
    impressions: 237500,
    clicks: 950,
  },
  {
    id: '5',
    name: 'Performance Max',
    type: 'PERFORMANCE_MAX',
    status: 'ENABLED',
    spend: 3200,
    conversions: 52,
    ctr: 2.97,
    cpa: 61.54,
    aiScore: 71,
    impressions: 107744,
    clicks: 3200,
  },
];

// Tool Implementations
export async function executeMCPTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<MCPToolResult> {
  try {
    switch (toolName) {
      case 'get_campaigns':
        return getCampaigns(params.status_filter as string);

      case 'audit_campaign':
        return auditCampaign(params.campaign_id as string);

      case 'find_wasted_spend':
        return findWastedSpend(
          params.min_spend as number,
          params.max_conversions as number
        );

      case 'suggest_negative_keywords':
        return suggestNegativeKeywords(
          params.campaign_id as string,
          params.similarity_threshold as number
        );

      case 'cluster_keywords':
        return clusterKeywords(
          params.keywords as string,
          params.threshold as number
        );

      case 'generate_optimization_plan':
        return generateOptimizationPlan(
          params.budget_constraint as number,
          params.goal as string
        );

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get campaigns with optional filter
function getCampaigns(statusFilter?: string): MCPToolResult {
  let campaigns = [...DEMO_CAMPAIGNS];

  if (statusFilter === 'enabled') {
    campaigns = campaigns.filter((c) => c.status === 'ENABLED');
  } else if (statusFilter === 'paused') {
    campaigns = campaigns.filter((c) => c.status === 'PAUSED');
  }

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);

  return {
    success: true,
    data: {
      campaigns,
      summary: {
        count: campaigns.length,
        totalSpend,
        totalConversions,
        avgCPA: totalConversions > 0 ? totalSpend / totalConversions : 0,
        avgAIScore:
          campaigns.reduce((sum, c) => sum + c.aiScore, 0) / campaigns.length,
      },
    },
  };
}

// Detailed campaign audit
function auditCampaign(campaignId: string): MCPToolResult {
  const campaign = DEMO_CAMPAIGNS.find((c) => c.id === campaignId);

  if (!campaign) {
    return { success: false, error: `Campaign ${campaignId} not found` };
  }

  const avgCPA =
    DEMO_CAMPAIGNS.reduce((sum, c) => sum + c.spend, 0) /
    DEMO_CAMPAIGNS.reduce((sum, c) => sum + c.conversions, 0);

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Analyze metrics
  if (campaign.aiScore < 40) {
    issues.push('Critical: AI Score below 40');
  }
  if (campaign.cpa > avgCPA * 2) {
    issues.push(`High CPA: ${(campaign.cpa / avgCPA).toFixed(1)}x above average`);
    recommendations.push('Consider pausing or restructuring this campaign');
  }
  if (campaign.ctr < 2) {
    issues.push(`Low CTR: ${campaign.ctr}%`);
    recommendations.push('Review ad copy and targeting');
  }
  if (campaign.conversions < 5 && campaign.spend > 1000) {
    issues.push('Low conversion volume with significant spend');
    recommendations.push('Add negative keywords or narrow targeting');
  }

  return {
    success: true,
    data: {
      campaign,
      audit: {
        healthScore: campaign.aiScore,
        issuesFound: issues.length,
        issues,
        recommendations,
        benchmarkComparison: {
          cpaVsAvg: `${((campaign.cpa / avgCPA) * 100).toFixed(0)}%`,
          ctrBenchmark: campaign.type === 'SEARCH' ? '3.5%' : '0.5%',
          ctrStatus: campaign.ctr > (campaign.type === 'SEARCH' ? 3.5 : 0.5) ? 'above' : 'below',
        },
      },
    },
  };
}

// Find wasted spend
function findWastedSpend(minSpend = 100, maxConversions = 2): MCPToolResult {
  const wastedCampaigns = DEMO_CAMPAIGNS.filter(
    (c) => c.spend >= minSpend && c.conversions <= maxConversions
  );

  const totalWasted = wastedCampaigns.reduce((sum, c) => sum + c.spend, 0);

  return {
    success: true,
    data: {
      wastedCampaigns: wastedCampaigns.map((c) => ({
        name: c.name,
        spend: c.spend,
        conversions: c.conversions,
        wasteRatio: c.conversions > 0 ? c.spend / c.conversions : c.spend,
      })),
      totalWasted,
      recommendation:
        totalWasted > 0
          ? `Consider pausing ${wastedCampaigns.length} campaign(s) to save $${totalWasted.toLocaleString()}/month`
          : 'No significant waste detected',
    },
  };
}

// Suggest negative keywords using vector similarity
async function suggestNegativeKeywords(
  campaignId: string,
  threshold = 0.7
): Promise<MCPToolResult> {
  // In production, this would query the vector store
  // For now, return static suggestions

  const suggestions = [
    { keyword: 'free', confidence: 0.95, reason: 'Low commercial intent' },
    { keyword: 'jobs', confidence: 0.92, reason: 'Employment intent' },
    { keyword: 'how to', confidence: 0.88, reason: 'Research intent' },
    { keyword: 'salary', confidence: 0.90, reason: 'Employment intent' },
    { keyword: 'download', confidence: 0.87, reason: 'Free-seeker intent' },
  ];

  return {
    success: true,
    data: {
      campaignId,
      threshold,
      suggestions,
      estimatedSavings: 523.0,
      searchTermsAnalyzed: 150,
    },
  };
}

// Cluster keywords by semantic similarity
async function clusterKeywords(
  keywordsStr: string,
  threshold = 0.8
): Promise<MCPToolResult> {
  const keywords = keywordsStr.split(',').map((k) => k.trim());

  if (keywords.length === 0) {
    return { success: false, error: 'No keywords provided' };
  }

  // In production, generate embeddings and cluster
  // For now, return mock clusters
  const clusters = [
    {
      name: 'Brand Terms',
      keywords: keywords.filter((k) => k.toLowerCase().includes('brand')),
      avgSimilarity: 0.92,
    },
    {
      name: 'Product Terms',
      keywords: keywords.filter(
        (k) =>
          !k.toLowerCase().includes('brand') && !k.toLowerCase().includes('free')
      ),
      avgSimilarity: 0.85,
    },
  ];

  return {
    success: true,
    data: {
      inputCount: keywords.length,
      threshold,
      clusters: clusters.filter((c) => c.keywords.length > 0),
      unclustered: keywords.filter(
        (k) => !clusters.some((c) => c.keywords.includes(k))
      ),
    },
  };
}

// Generate optimization plan
function generateOptimizationPlan(
  budgetConstraint?: number,
  goal = 'conversions'
): MCPToolResult {
  const campaigns = DEMO_CAMPAIGNS;
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);

  const plan = {
    currentState: {
      totalSpend,
      totalConversions: campaigns.reduce((sum, c) => sum + c.conversions, 0),
      avgCPA:
        totalSpend / campaigns.reduce((sum, c) => sum + c.conversions, 0),
    },
    actions: [
      {
        priority: 1,
        action: 'Pause "Display Remarketing"',
        impact: 'Save $950/month, lose ~3 conversions',
        netBenefit: '+$631 CPA improvement',
      },
      {
        priority: 2,
        action: 'Reallocate $1,000 from "Generic Keywords" to "Brand Search"',
        impact: 'Est. +10 conversions at same spend',
        netBenefit: 'CPA reduction of ~20%',
      },
      {
        priority: 3,
        action: 'Scale "Shopping Feed" by 25%',
        impact: 'Est. +7 conversions for +$450',
        netBenefit: 'Maintains strong ROAS',
      },
      {
        priority: 4,
        action: 'Add negative keywords to "Generic Keywords"',
        impact: 'Est. CPA reduction of 30%',
        netBenefit: 'Improved efficiency',
      },
    ],
    projectedOutcome: {
      spendChange: budgetConstraint
        ? budgetConstraint - totalSpend
        : -500,
      conversionChange: '+18',
      cpaChange: '-35%',
    },
    goal,
  };

  return {
    success: true,
    data: plan,
  };
}

// Export for use in API routes
export { DEMO_CAMPAIGNS };
