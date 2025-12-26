/**
 * AI Agent Webhook API
 *
 * This endpoint receives requests from n8n webhooks or external AI agents
 * to review tasks, audit campaigns, and communicate with Google Ads GPT.
 *
 * Usage with n8n:
 * 1. Create a Webhook node in n8n pointing to: POST /api/agent/webhook
 * 2. Send payload with action type and data
 * 3. Receive structured response for GPT processing
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Types for webhook requests
interface WebhookPayload {
  action:
    | 'audit_campaigns'
    | 'review_task'
    | 'suggest_optimizations'
    | 'analyze_keywords'
    | 'generate_report';
  data: Record<string, unknown>;
  callback_url?: string; // Optional n8n callback URL
  gpt_context?: string; // Context from Google Ads GPT
}

interface AuditResult {
  status: 'success' | 'error';
  action: string;
  timestamp: string;
  result: unknown;
  recommendations?: string[];
  for_gpt_review?: string; // Formatted for GPT consumption
}

// Demo campaign data (same as main app)
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
  },
];

// Initialize Anthropic client
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// Audit campaigns and generate recommendations
async function auditCampaigns(): Promise<AuditResult> {
  const campaigns = DEMO_CAMPAIGNS;
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const avgCPA = totalSpend / totalConversions;

  // Identify issues
  const issues: string[] = [];
  const recommendations: string[] = [];

  campaigns.forEach((campaign) => {
    if (campaign.aiScore < 40) {
      issues.push(`${campaign.name}: Critical AI Score (${campaign.aiScore})`);
      if (campaign.cpa > avgCPA * 2) {
        recommendations.push(
          `Consider pausing "${campaign.name}" - CPA $${campaign.cpa.toFixed(2)} is ${(campaign.cpa / avgCPA).toFixed(1)}x above average`
        );
      }
    } else if (campaign.aiScore < 60) {
      issues.push(`${campaign.name}: Below average AI Score (${campaign.aiScore})`);
    }

    if (campaign.ctr < 2 && campaign.status === 'ENABLED') {
      recommendations.push(
        `"${campaign.name}" has low CTR (${campaign.ctr}%) - review ad copy and targeting`
      );
    }
  });

  // Calculate potential savings
  const wastedSpend = campaigns
    .filter((c) => c.aiScore < 40 && c.conversions < 5)
    .reduce((sum, c) => sum + c.spend * 0.7, 0);

  const forGPT = `
## Campaign Audit Summary

**Overall Performance:**
- Total Spend: $${totalSpend.toLocaleString()}
- Total Conversions: ${totalConversions}
- Average CPA: $${avgCPA.toFixed(2)}

**Issues Found (${issues.length}):**
${issues.map((i) => `- ${i}`).join('\n')}

**Recommendations (${recommendations.length}):**
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

**Potential Monthly Savings:** $${wastedSpend.toFixed(2)}

**Action Required:** ${issues.length > 0 ? 'Yes - Review underperforming campaigns' : 'No - All campaigns performing well'}
  `.trim();

  return {
    status: 'success',
    action: 'audit_campaigns',
    timestamp: new Date().toISOString(),
    result: {
      campaigns,
      totalSpend,
      totalConversions,
      avgCPA,
      issues,
      wastedSpend,
    },
    recommendations,
    for_gpt_review: forGPT,
  };
}

// Review a specific task
async function reviewTask(taskData: Record<string, unknown>): Promise<AuditResult> {
  const client = getAnthropicClient();
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

  let aiReview = 'AI review not available (no API key)';

  if (client && taskData.description) {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are a Google Ads expert reviewing a task. Provide a brief, actionable review.

Task: ${taskData.description}
Context: ${taskData.context || 'No additional context'}

Provide:
1. Task validity (is this a good approach?)
2. Potential risks
3. Suggested improvements
4. Priority level (high/medium/low)`,
          },
        ],
      });

      aiReview =
        message.content[0].type === 'text' ? message.content[0].text : 'Unable to generate review';
    } catch {
      aiReview = 'AI review failed - check API key';
    }
  }

  return {
    status: 'success',
    action: 'review_task',
    timestamp: new Date().toISOString(),
    result: {
      task: taskData,
      ai_review: aiReview,
    },
    for_gpt_review: `## Task Review\n\n**Task:** ${taskData.description}\n\n**AI Analysis:**\n${aiReview}`,
  };
}

// Suggest optimizations based on current data
async function suggestOptimizations(): Promise<AuditResult> {
  const campaigns = DEMO_CAMPAIGNS;

  const optimizations = [
    {
      type: 'budget_reallocation',
      priority: 'high',
      description: 'Move $1,000 from "Generic Keywords" to "Brand Search"',
      estimated_impact: '+15 conversions/month',
      reason: 'Brand Search has 3x better conversion rate',
    },
    {
      type: 'pause_campaign',
      priority: 'high',
      description: 'Pause "Display Remarketing" campaign',
      estimated_impact: 'Save $950/month',
      reason: 'Only 3 conversions at $316.67 CPA',
    },
    {
      type: 'keyword_optimization',
      priority: 'medium',
      description: 'Add negative keywords to "Generic Keywords"',
      estimated_impact: 'Reduce CPA by ~30%',
      reason: 'High spend with low conversion rate suggests irrelevant traffic',
    },
    {
      type: 'bid_adjustment',
      priority: 'medium',
      description: 'Increase bids on "Shopping Feed" by 15%',
      estimated_impact: '+8 conversions/month',
      reason: 'High AI Score (82) with room for scale',
    },
  ];

  const forGPT = `
## Optimization Suggestions

${optimizations
  .map(
    (opt, i) => `
### ${i + 1}. ${opt.description}
- **Type:** ${opt.type}
- **Priority:** ${opt.priority.toUpperCase()}
- **Estimated Impact:** ${opt.estimated_impact}
- **Reason:** ${opt.reason}
`
  )
  .join('\n')}

**Total Potential Impact:**
- Estimated additional conversions: +23/month
- Estimated cost savings: $950/month
- Projected CPA improvement: -25%
  `.trim();

  return {
    status: 'success',
    action: 'suggest_optimizations',
    timestamp: new Date().toISOString(),
    result: { optimizations },
    recommendations: optimizations.map((o) => o.description),
    for_gpt_review: forGPT,
  };
}

// Main webhook handler
export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload = await request.json();

    console.log(`[Agent Webhook] Action: ${payload.action}`, {
      hasCallbackUrl: !!payload.callback_url,
      hasGPTContext: !!payload.gpt_context,
    });

    let result: AuditResult;

    switch (payload.action) {
      case 'audit_campaigns':
        result = await auditCampaigns();
        break;

      case 'review_task':
        result = await reviewTask(payload.data);
        break;

      case 'suggest_optimizations':
        result = await suggestOptimizations();
        break;

      case 'analyze_keywords':
        // Placeholder for keyword analysis
        result = {
          status: 'success',
          action: 'analyze_keywords',
          timestamp: new Date().toISOString(),
          result: { message: 'Keyword analysis not yet implemented' },
          for_gpt_review: 'Keyword analysis feature coming soon.',
        };
        break;

      case 'generate_report':
        // Combine audit + optimizations for full report
        const audit = await auditCampaigns();
        const optimizations = await suggestOptimizations();
        result = {
          status: 'success',
          action: 'generate_report',
          timestamp: new Date().toISOString(),
          result: {
            audit: audit.result,
            optimizations: optimizations.result,
          },
          recommendations: [
            ...(audit.recommendations || []),
            ...(optimizations.recommendations || []),
          ],
          for_gpt_review: `${audit.for_gpt_review}\n\n---\n\n${optimizations.for_gpt_review}`,
        };
        break;

      default:
        return NextResponse.json(
          {
            status: 'error',
            message: `Unknown action: ${payload.action}`,
            supported_actions: [
              'audit_campaigns',
              'review_task',
              'suggest_optimizations',
              'analyze_keywords',
              'generate_report',
            ],
          },
          { status: 400 }
        );
    }

    // If callback URL provided, send async response to n8n
    if (payload.callback_url) {
      fetch(payload.callback_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      }).catch((err) => console.error('[Agent Webhook] Callback failed:', err));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Agent Webhook] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/health check
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'Quick Ads AI - Agent Webhook',
    version: '1.0.0',
    supported_actions: [
      'audit_campaigns',
      'review_task',
      'suggest_optimizations',
      'analyze_keywords',
      'generate_report',
    ],
    usage: {
      method: 'POST',
      content_type: 'application/json',
      example_payload: {
        action: 'audit_campaigns',
        data: {},
        callback_url: 'https://your-n8n-instance.com/webhook/callback',
      },
    },
  });
}
