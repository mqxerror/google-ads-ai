import { AIScoreBreakdown, CampaignType } from '@/types/campaign';

export interface Recommendation {
  id: string;
  issue: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  impactEstimate: string;
  actionLabel: string;
  actionType: 'pause' | 'adjust_bid' | 'add_keywords' | 'improve_quality' | 'review' | 'enable';
  priority: number; // 1-10, higher is more urgent
}

interface CampaignData {
  id: string;
  name: string;
  spend: number;
  conversions: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpa: number;
  roas: number;
  type: CampaignType;
  status: string;
  aiScore: number;
  aiScoreBreakdown?: AIScoreBreakdown;
}

export function generateRecommendations(campaign: CampaignData): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { spend, conversions, clicks, impressions, ctr, cpa, roas, type, aiScoreBreakdown } = campaign;

  // Only generate recommendations for campaigns with issues (score < 70)
  if (campaign.aiScore >= 70 && spend > 0) {
    return [];
  }

  // Check each factor in the breakdown for issues
  if (aiScoreBreakdown?.factors) {
    for (const factor of aiScoreBreakdown.factors) {
      if (factor.status === 'critical' || factor.status === 'warning') {
        const rec = generateRecommendationForFactor(factor.name, factor.status, campaign);
        if (rec) {
          recommendations.push(rec);
        }
      }
    }
  }

  // Additional rule-based recommendations

  // 1. Wasted spend - high priority
  if (spend > 100 && conversions === 0) {
    recommendations.push({
      id: `${campaign.id}-wasted-spend`,
      issue: 'High spend with no conversions',
      description: `This campaign has spent $${spend.toFixed(2)} without generating any conversions. Consider pausing to stop wasted spend.`,
      impact: 'high',
      impactEstimate: `Save $${spend.toFixed(0)}+/week`,
      actionLabel: 'Pause Campaign',
      actionType: 'pause',
      priority: 10,
    });
  }

  // 2. Low CTR
  if (ctr < 1 && impressions > 1000) {
    const expectedCtr = type === 'SEARCH' ? 3.17 : type === 'DISPLAY' ? 0.46 : 2.0;
    recommendations.push({
      id: `${campaign.id}-low-ctr`,
      issue: 'CTR below industry benchmark',
      description: `CTR of ${ctr.toFixed(2)}% is below the ${expectedCtr}% benchmark for ${type} campaigns. Improve ad copy and targeting.`,
      impact: 'medium',
      impactEstimate: `Potential ${((expectedCtr - ctr) / ctr * 100).toFixed(0)}% more clicks`,
      actionLabel: 'Review Ads',
      actionType: 'review',
      priority: 6,
    });
  }

  // 3. High CPA
  const cpaBenchmark = type === 'SEARCH' ? 40 : type === 'SHOPPING' ? 30 : 50;
  if (cpa > cpaBenchmark * 1.5 && conversions > 0) {
    recommendations.push({
      id: `${campaign.id}-high-cpa`,
      issue: 'Cost per acquisition too high',
      description: `CPA of $${cpa.toFixed(2)} is ${((cpa / cpaBenchmark - 1) * 100).toFixed(0)}% higher than the $${cpaBenchmark} benchmark.`,
      impact: 'high',
      impactEstimate: `Save $${((cpa - cpaBenchmark) * conversions).toFixed(0)} on ${conversions} conversions`,
      actionLabel: 'Optimize Bids',
      actionType: 'adjust_bid',
      priority: 8,
    });
  }

  // 4. Low conversion rate with clicks
  if (clicks > 100 && conversions === 0) {
    recommendations.push({
      id: `${campaign.id}-no-conversions`,
      issue: 'No conversions from clicks',
      description: `${clicks} clicks with no conversions. Check landing page, conversion tracking, or targeting.`,
      impact: 'high',
      impactEstimate: 'Fix to convert ${clicks} visitors',
      actionLabel: 'Review Setup',
      actionType: 'review',
      priority: 9,
    });
  }

  // 5. Low ROAS
  if (roas > 0 && roas < 1 && spend > 50) {
    recommendations.push({
      id: `${campaign.id}-low-roas`,
      issue: 'Negative return on ad spend',
      description: `ROAS of ${roas.toFixed(2)}x means you're losing money. Every $1 spent returns only $${roas.toFixed(2)}.`,
      impact: 'high',
      impactEstimate: `Losing $${((1 - roas) * spend).toFixed(0)} currently`,
      actionLabel: 'Reduce Budget',
      actionType: 'adjust_bid',
      priority: 9,
    });
  }

  // 6. Paused campaign with good history
  if (campaign.status === 'PAUSED' && conversions > 10 && cpa < cpaBenchmark) {
    recommendations.push({
      id: `${campaign.id}-enable-performer`,
      issue: 'High-performing campaign is paused',
      description: `This campaign had ${conversions} conversions at $${cpa.toFixed(2)} CPA. Consider enabling it.`,
      impact: 'medium',
      impactEstimate: `Potential ${conversions}+ more conversions`,
      actionLabel: 'Enable Campaign',
      actionType: 'enable',
      priority: 5,
    });
  }

  // Sort by priority and limit to 5
  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

function generateRecommendationForFactor(
  factorName: string,
  status: 'warning' | 'critical',
  campaign: CampaignData
): Recommendation | null {
  const severity = status === 'critical' ? 'high' : 'medium';
  const priorityBoost = status === 'critical' ? 2 : 0;

  switch (factorName) {
    case 'CTR Performance':
      return {
        id: `${campaign.id}-factor-ctr`,
        issue: 'Click-through rate needs improvement',
        description: 'Your ads are not resonating with the audience. Test new ad variations with stronger headlines and CTAs.',
        impact: severity,
        impactEstimate: 'Improve engagement by 20-50%',
        actionLabel: 'Create Ad Variants',
        actionType: 'review',
        priority: 5 + priorityBoost,
      };

    case 'Conversion Efficiency':
      return {
        id: `${campaign.id}-factor-conversion`,
        issue: 'Conversion efficiency is poor',
        description: 'Traffic is not converting well. Review landing pages, offers, and audience targeting.',
        impact: severity,
        impactEstimate: 'Reduce CPA by 25-40%',
        actionLabel: 'Optimize Funnel',
        actionType: 'review',
        priority: 7 + priorityBoost,
      };

    case 'Wasted Spend':
      return {
        id: `${campaign.id}-factor-waste`,
        issue: 'Significant budget waste detected',
        description: `$${campaign.spend.toFixed(0)} spent without adequate returns. Consider pausing or reallocating budget.`,
        impact: severity,
        impactEstimate: `Save $${campaign.spend.toFixed(0)}+`,
        actionLabel: 'Review Budget',
        actionType: 'adjust_bid',
        priority: 8 + priorityBoost,
      };

    case 'Return on Ad Spend':
      return {
        id: `${campaign.id}-factor-roas`,
        issue: 'Return on investment is below target',
        description: 'The campaign is not generating enough revenue relative to spend. Focus on high-converting audiences.',
        impact: severity,
        impactEstimate: 'Target 2x+ ROAS',
        actionLabel: 'Improve Targeting',
        actionType: 'review',
        priority: 6 + priorityBoost,
      };

    case 'Quality Score':
      return {
        id: `${campaign.id}-factor-quality`,
        issue: 'Quality Score affecting ad rank',
        description: 'Low Quality Score increases CPCs and reduces visibility. Improve ad relevance and landing page experience.',
        impact: severity,
        impactEstimate: 'Reduce CPC by 15-30%',
        actionLabel: 'Improve Quality',
        actionType: 'improve_quality',
        priority: 4 + priorityBoost,
      };

    default:
      return null;
  }
}

// Get the top recommendation for display in grid
export function getTopRecommendation(campaign: CampaignData): Recommendation | null {
  const recommendations = generateRecommendations(campaign);
  return recommendations.length > 0 ? recommendations[0] : null;
}

// Get impact badge color with dark mode support
export function getImpactColor(impact: Recommendation['impact']): string {
  switch (impact) {
    case 'high':
      return 'bg-rose-100 text-rose-700';
    case 'medium':
      return 'bg-amber-100 text-amber-700';
    case 'low':
      return 'bg-emerald-100 text-emerald-700';
  }
}
