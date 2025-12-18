// AI-powered Campaign Optimization Engine
import { LLMService, LLMConfig, CampaignData } from './index';

export interface BidRecommendation {
  entityType: 'campaign' | 'ad_group' | 'keyword';
  entityId: string;
  entityName: string;
  currentBid: number;
  recommendedBid: number;
  changePercent: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  expectedImpact: {
    conversions: string;
    cost: string;
    cpa: string;
  };
}

export interface BudgetRecommendation {
  campaignId: string;
  campaignName: string;
  currentBudget: number;
  recommendedBudget: number;
  changePercent: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  reallocationSource?: string;
}

export interface OptimizationPlan {
  summary: string;
  totalExpectedSavings: number;
  totalExpectedConversionGain: number;
  bidRecommendations: BidRecommendation[];
  budgetRecommendations: BudgetRecommendation[];
  pauseRecommendations: Array<{
    campaignId: string;
    campaignName: string;
    reason: string;
    currentSpend: number;
    currentConversions: number;
  }>;
  enableRecommendations: Array<{
    campaignId: string;
    campaignName: string;
    reason: string;
  }>;
  priority: 'high' | 'medium' | 'low';
  generatedAt: string;
}

const OPTIMIZATION_PROMPT = `You are an expert Google Ads optimization AI. Analyze the campaign data and generate specific, actionable optimization recommendations.

Consider these optimization strategies:
1. Budget Reallocation: Move budget from underperforming to high-performing campaigns
2. Bid Adjustments: Increase bids for high-converting keywords, decrease for poor performers
3. Pause Recommendations: Identify campaigns/keywords with high spend and zero conversions
4. Enable Recommendations: Identify paused campaigns that might perform well now

Rules:
- Be conservative with recommendations (confidence should match data quality)
- Only recommend changes that have clear data support
- Consider seasonality and recent trends
- Prioritize revenue impact over cost savings

Respond with valid JSON only matching this exact structure:
{
  "summary": "Brief overview of optimization strategy",
  "totalExpectedSavings": number,
  "totalExpectedConversionGain": number,
  "bidRecommendations": [
    {
      "entityType": "campaign|ad_group|keyword",
      "entityId": "string",
      "entityName": "string",
      "currentBid": number,
      "recommendedBid": number,
      "changePercent": number,
      "reason": "string",
      "confidence": "high|medium|low",
      "expectedImpact": {"conversions": "+X%", "cost": "+/-X%", "cpa": "-X%"}
    }
  ],
  "budgetRecommendations": [
    {
      "campaignId": "string",
      "campaignName": "string",
      "currentBudget": number,
      "recommendedBudget": number,
      "changePercent": number,
      "reason": "string",
      "confidence": "high|medium|low",
      "reallocationSource": "Campaign name to take budget from (optional)"
    }
  ],
  "pauseRecommendations": [
    {
      "campaignId": "string",
      "campaignName": "string",
      "reason": "string",
      "currentSpend": number,
      "currentConversions": number
    }
  ],
  "enableRecommendations": [
    {
      "campaignId": "string",
      "campaignName": "string",
      "reason": "string"
    }
  ],
  "priority": "high|medium|low"
}`;

export async function generateOptimizationPlan(
  campaigns: CampaignData[],
  targetMetric: 'conversions' | 'roas' | 'cpa' | 'efficiency' = 'conversions',
  constraints?: {
    maxBudgetChange?: number; // Max % change in total budget
    preserveCampaigns?: string[]; // Campaign IDs not to touch
    aggressiveness?: 'conservative' | 'moderate' | 'aggressive';
  },
  config?: Partial<LLMConfig>
): Promise<OptimizationPlan> {
  const service = new LLMService(config);

  // Prepare detailed campaign analysis
  const campaignAnalysis = campaigns.map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    type: c.type,
    dailyBudget: c.spend / 30, // Approximate daily budget
    totalSpend: c.spend,
    clicks: c.clicks,
    impressions: c.impressions,
    conversions: c.conversions,
    ctr: c.ctr,
    cpa: c.cpa,
    roas: c.roas,
    aiScore: c.aiScore,
    efficiency: c.conversions > 0 ? (c.conversions / c.spend) * 100 : 0,
    isProtected: constraints?.preserveCampaigns?.includes(c.id) || false,
  }));

  // Calculate account-level metrics
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

  const response = await service.complete({
    messages: [
      { role: 'system', content: OPTIMIZATION_PROMPT },
      {
        role: 'user',
        content: `Target Optimization Metric: ${targetMetric}
Aggressiveness: ${constraints?.aggressiveness || 'moderate'}
Max Budget Change: ${constraints?.maxBudgetChange || 20}%

Account Summary:
- Total Spend: $${totalSpend.toFixed(2)}
- Total Conversions: ${totalConversions}
- Average CPA: $${avgCPA.toFixed(2)}

Campaign Data:
${JSON.stringify(campaignAnalysis, null, 2)}

Generate an optimization plan focused on ${targetMetric}.`,
      },
    ],
    temperature: 0.2,
    maxTokens: 4096,
  });

  try {
    const plan: OptimizationPlan = JSON.parse(response.content);
    plan.generatedAt = new Date().toISOString();
    return plan;
  } catch {
    console.error('Failed to parse optimization plan:', response.content);
    return {
      summary: 'Unable to generate optimization plan. Please try again.',
      totalExpectedSavings: 0,
      totalExpectedConversionGain: 0,
      bidRecommendations: [],
      budgetRecommendations: [],
      pauseRecommendations: [],
      enableRecommendations: [],
      priority: 'low',
      generatedAt: new Date().toISOString(),
    };
  }
}

// Quick bid optimization for a single entity
export async function suggestBidAdjustment(
  entityData: {
    type: 'campaign' | 'ad_group' | 'keyword';
    id: string;
    name: string;
    currentBid?: number;
    spend: number;
    clicks: number;
    conversions: number;
    ctr: number;
    qualityScore?: number;
  },
  targetCPA?: number,
  config?: Partial<LLMConfig>
): Promise<BidRecommendation | null> {
  const service = new LLMService(config);

  const currentCPA = entityData.conversions > 0 ? entityData.spend / entityData.conversions : 0;

  const prompt = `Analyze this ${entityData.type} and suggest a bid adjustment:

Entity: ${entityData.name}
Current Bid: ${entityData.currentBid ? `$${entityData.currentBid.toFixed(2)}` : 'Unknown'}
Spend: $${entityData.spend.toFixed(2)}
Clicks: ${entityData.clicks}
Conversions: ${entityData.conversions}
CTR: ${entityData.ctr.toFixed(2)}%
Current CPA: ${currentCPA > 0 ? `$${currentCPA.toFixed(2)}` : 'N/A'}
${entityData.qualityScore ? `Quality Score: ${entityData.qualityScore}/10` : ''}
${targetCPA ? `Target CPA: $${targetCPA.toFixed(2)}` : ''}

Respond with JSON only:
{
  "shouldAdjust": true|false,
  "recommendedBid": number or null,
  "changePercent": number,
  "reason": "string",
  "confidence": "high|medium|low"
}`;

  const response = await service.complete({
    messages: [
      { role: 'system', content: 'You are a Google Ads bid optimization expert. Provide data-driven recommendations.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    maxTokens: 512,
  });

  try {
    const result = JSON.parse(response.content);
    if (!result.shouldAdjust) return null;

    return {
      entityType: entityData.type,
      entityId: entityData.id,
      entityName: entityData.name,
      currentBid: entityData.currentBid || 0,
      recommendedBid: result.recommendedBid,
      changePercent: result.changePercent,
      reason: result.reason,
      confidence: result.confidence,
      expectedImpact: {
        conversions: result.changePercent > 0 ? '+5-15%' : '-5-10%',
        cost: `${result.changePercent > 0 ? '+' : ''}${result.changePercent}%`,
        cpa: result.changePercent > 0 ? '+3-8%' : '-5-12%',
      },
    };
  } catch {
    return null;
  }
}

// Auto-optimization rules engine
export interface AutoOptimizationRule {
  id: string;
  name: string;
  condition: {
    metric: 'cpa' | 'roas' | 'ctr' | 'conversions' | 'spend';
    operator: '>' | '<' | '>=' | '<=' | '==';
    value: number;
    period: 'day' | 'week' | 'month';
  };
  action: {
    type: 'adjust_bid' | 'adjust_budget' | 'pause' | 'enable' | 'notify';
    value?: number; // Percentage change for adjustments
  };
  enabled: boolean;
}

export function evaluateAutoOptimizationRules(
  campaign: CampaignData,
  rules: AutoOptimizationRule[]
): Array<{ rule: AutoOptimizationRule; triggered: boolean; suggestedAction: string }> {
  return rules.map(rule => {
    if (!rule.enabled) {
      return { rule, triggered: false, suggestedAction: '' };
    }

    let metricValue: number;
    switch (rule.condition.metric) {
      case 'cpa': metricValue = campaign.cpa; break;
      case 'roas': metricValue = campaign.roas; break;
      case 'ctr': metricValue = campaign.ctr; break;
      case 'conversions': metricValue = campaign.conversions; break;
      case 'spend': metricValue = campaign.spend; break;
      default: metricValue = 0;
    }

    let triggered = false;
    switch (rule.condition.operator) {
      case '>': triggered = metricValue > rule.condition.value; break;
      case '<': triggered = metricValue < rule.condition.value; break;
      case '>=': triggered = metricValue >= rule.condition.value; break;
      case '<=': triggered = metricValue <= rule.condition.value; break;
      case '==': triggered = metricValue === rule.condition.value; break;
    }

    let suggestedAction = '';
    if (triggered) {
      switch (rule.action.type) {
        case 'adjust_bid':
          suggestedAction = `Adjust bid by ${rule.action.value}%`;
          break;
        case 'adjust_budget':
          suggestedAction = `Adjust budget by ${rule.action.value}%`;
          break;
        case 'pause':
          suggestedAction = 'Pause campaign';
          break;
        case 'enable':
          suggestedAction = 'Enable campaign';
          break;
        case 'notify':
          suggestedAction = 'Send notification';
          break;
      }
    }

    return { rule, triggered, suggestedAction };
  });
}
