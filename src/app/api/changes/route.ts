/**
 * What Changed API
 *
 * GET /api/changes - Detect changes between current and previous period
 *
 * Analyzes:
 * - Budget changes
 * - Bid strategy changes
 * - Status changes
 * - Metric spikes/drops
 * - Anomalies
 * - Wasted spend
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  ChangeItem,
  ChangeSummary,
  ChangeCategory,
  ChangeSeverity,
  CHANGE_THRESHOLDS,
  WhatChangedResponse,
} from '@/types/changes';

interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  status: string;
  campaignType: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpa: number;
  ctr: number;
  roas: number;
}

// GET: Detect what changed
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json({ error: 'accountId required' }, { status: 400 });
  }

  try {
    // Get account
    const account = await prisma.googleAdsAccount.findUnique({
      where: { id: accountId },
      select: { googleAccountId: true },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const customerId = account.googleAccountId;

    // Calculate date ranges
    // Current period: last 7 days (excluding today)
    // Compare period: 7 days before that
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentEnd = new Date(today);
    currentEnd.setDate(currentEnd.getDate() - 1); // Yesterday

    const currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - 6); // 7 days ending yesterday

    const compareEnd = new Date(currentStart);
    compareEnd.setDate(compareEnd.getDate() - 1); // Day before current start

    const compareStart = new Date(compareEnd);
    compareStart.setDate(compareStart.getDate() - 6); // 7 days before that

    // Fetch metrics for both periods
    const [currentMetrics, compareMetrics] = await Promise.all([
      fetchPeriodMetrics(customerId, currentStart, currentEnd),
      fetchPeriodMetrics(customerId, compareStart, compareEnd),
    ]);

    // Detect changes
    const changes: ChangeItem[] = [];
    let changeId = 0;

    const currentPeriod = {
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0],
    };
    const comparePeriod = {
      start: compareStart.toISOString().split('T')[0],
      end: compareEnd.toISOString().split('T')[0],
    };

    // Build lookup map for compare period
    const compareMap = new Map<string, CampaignMetrics>();
    for (const c of compareMetrics) {
      compareMap.set(c.campaignId, c);
    }

    // Analyze each campaign
    for (const current of currentMetrics) {
      const previous = compareMap.get(current.campaignId);

      // --- Metric Changes ---
      if (previous) {
        // Spend spike
        if (
          previous.spend >= CHANGE_THRESHOLDS.MIN_SPEND_FOR_ALERT &&
          current.spend > previous.spend
        ) {
          const delta = ((current.spend - previous.spend) / previous.spend) * 100;
          if (delta >= CHANGE_THRESHOLDS.SPEND_SPIKE) {
            changes.push(
              createMetricChange(
                `change-${++changeId}`,
                current,
                'metric_spike',
                delta >= 50 ? 'warning' : 'info',
                'Spend',
                previous.spend,
                current.spend,
                delta,
                currentPeriod,
                comparePeriod
              )
            );
          }
        }

        // Spend drop
        if (
          previous.spend >= CHANGE_THRESHOLDS.MIN_SPEND_FOR_ALERT &&
          current.spend < previous.spend
        ) {
          const delta = ((current.spend - previous.spend) / previous.spend) * 100;
          if (Math.abs(delta) >= CHANGE_THRESHOLDS.SPEND_DROP) {
            changes.push(
              createMetricChange(
                `change-${++changeId}`,
                current,
                'metric_drop',
                'info',
                'Spend',
                previous.spend,
                current.spend,
                delta,
                currentPeriod,
                comparePeriod
              )
            );
          }
        }

        // CPA spike (bad)
        if (
          previous.cpa > 0 &&
          previous.conversions >= CHANGE_THRESHOLDS.MIN_CONVERSIONS_FOR_ALERT &&
          current.cpa > previous.cpa
        ) {
          const delta = ((current.cpa - previous.cpa) / previous.cpa) * 100;
          if (delta >= CHANGE_THRESHOLDS.CPA_SPIKE) {
            changes.push(
              createMetricChange(
                `change-${++changeId}`,
                current,
                'metric_spike',
                delta >= 40 ? 'critical' : 'warning',
                'CPA',
                previous.cpa,
                current.cpa,
                delta,
                currentPeriod,
                comparePeriod
              )
            );
          }
        }

        // CPA drop (good)
        if (
          previous.cpa > 0 &&
          previous.conversions >= CHANGE_THRESHOLDS.MIN_CONVERSIONS_FOR_ALERT &&
          current.cpa < previous.cpa
        ) {
          const delta = ((current.cpa - previous.cpa) / previous.cpa) * 100;
          if (Math.abs(delta) >= CHANGE_THRESHOLDS.CPA_DROP) {
            changes.push(
              createMetricChange(
                `change-${++changeId}`,
                current,
                'metric_drop',
                'positive',
                'CPA',
                previous.cpa,
                current.cpa,
                delta,
                currentPeriod,
                comparePeriod
              )
            );
          }
        }

        // Conversion drop (bad)
        if (
          previous.conversions >= CHANGE_THRESHOLDS.MIN_CONVERSIONS_FOR_ALERT &&
          current.conversions < previous.conversions
        ) {
          const delta =
            ((current.conversions - previous.conversions) / previous.conversions) * 100;
          if (Math.abs(delta) >= CHANGE_THRESHOLDS.CONVERSION_DROP) {
            changes.push(
              createMetricChange(
                `change-${++changeId}`,
                current,
                'metric_drop',
                Math.abs(delta) >= 40 ? 'critical' : 'warning',
                'Conversions',
                previous.conversions,
                current.conversions,
                delta,
                currentPeriod,
                comparePeriod
              )
            );
          }
        }

        // Conversion spike (good)
        if (
          previous.conversions >= CHANGE_THRESHOLDS.MIN_CONVERSIONS_FOR_ALERT &&
          current.conversions > previous.conversions
        ) {
          const delta =
            ((current.conversions - previous.conversions) / previous.conversions) * 100;
          if (delta >= CHANGE_THRESHOLDS.CONVERSION_SPIKE) {
            changes.push(
              createMetricChange(
                `change-${++changeId}`,
                current,
                'metric_spike',
                'positive',
                'Conversions',
                previous.conversions,
                current.conversions,
                delta,
                currentPeriod,
                comparePeriod
              )
            );
          }
        }

        // CTR drop
        if (previous.ctr > 0 && current.ctr < previous.ctr) {
          const delta = ((current.ctr - previous.ctr) / previous.ctr) * 100;
          if (
            Math.abs(delta) >= CHANGE_THRESHOLDS.CTR_DROP &&
            previous.impressions >= 1000
          ) {
            changes.push(
              createMetricChange(
                `change-${++changeId}`,
                current,
                'metric_drop',
                'warning',
                'CTR',
                previous.ctr,
                current.ctr,
                delta,
                currentPeriod,
                comparePeriod
              )
            );
          }
        }
      }

      // --- Wasted Spend ---
      if (
        current.spend >= CHANGE_THRESHOLDS.WASTED_SPEND_THRESHOLD &&
        current.conversions === 0 &&
        current.status === 'ENABLED'
      ) {
        changes.push({
          id: `change-${++changeId}`,
          category: 'wasted_spend',
          severity: current.spend >= 200 ? 'critical' : 'warning',
          entityType: 'campaign',
          entityId: current.campaignId,
          entityName: current.campaignName,
          title: `$${current.spend.toFixed(0)} spent with no conversions`,
          description: `Campaign has ${current.clicks} clicks but 0 conversions in the last 7 days`,
          metric: 'spend',
          currentMetricValue: current.spend,
          periodStart: currentPeriod.start,
          periodEnd: currentPeriod.end,
          detectedAt: new Date().toISOString(),
          estimatedImpact: {
            metric: 'spend',
            direction: 'negative',
            magnitude: current.spend >= 500 ? 'high' : current.spend >= 200 ? 'medium' : 'low',
            value: current.spend,
          },
          availableActions: [
            {
              type: 'queue_fix',
              label: 'Pause Campaign',
              description: 'Stop spending on non-converting campaign',
              actionPayload: {
                actionType: 'pause_campaign',
                entityType: 'campaign',
                entityId: current.campaignId,
                newValue: 'PAUSED',
              },
            },
            {
              type: 'explain',
              label: 'Explain',
              description: 'Get AI analysis of why this is happening',
            },
            {
              type: 'ignore',
              label: 'Ignore',
              description: 'Dismiss this alert',
            },
          ],
          status: 'new',
        });
      }

      // --- Opportunities (scaling candidates) ---
      if (
        current.conversions >= 5 &&
        current.cpa > 0 &&
        previous &&
        previous.cpa > 0 &&
        current.cpa <= previous.cpa * 0.85 && // CPA improved 15%+
        current.status === 'ENABLED'
      ) {
        changes.push({
          id: `change-${++changeId}`,
          category: 'opportunity',
          severity: 'positive',
          entityType: 'campaign',
          entityId: current.campaignId,
          entityName: current.campaignName,
          title: 'Scaling opportunity detected',
          description: `CPA improved by ${Math.abs(
            ((current.cpa - previous.cpa) / previous.cpa) * 100
          ).toFixed(0)}% with ${current.conversions} conversions`,
          previousMetricValue: previous.cpa,
          currentMetricValue: current.cpa,
          metric: 'CPA',
          delta: ((current.cpa - previous.cpa) / previous.cpa) * 100,
          periodStart: currentPeriod.start,
          periodEnd: currentPeriod.end,
          comparePeriodStart: comparePeriod.start,
          comparePeriodEnd: comparePeriod.end,
          detectedAt: new Date().toISOString(),
          estimatedImpact: {
            metric: 'conversions',
            direction: 'positive',
            magnitude: 'medium',
          },
          availableActions: [
            {
              type: 'queue_fix',
              label: 'Increase Budget 20%',
              description: 'Scale this performing campaign',
              actionPayload: {
                actionType: 'adjust_budget',
                entityType: 'campaign',
                entityId: current.campaignId,
                newValue: '1.2x',
              },
            },
            {
              type: 'explain',
              label: 'Explain',
              description: 'Understand what drove improvement',
            },
            {
              type: 'ignore',
              label: 'Ignore',
            },
          ],
          status: 'new',
        });
      }
    }

    // Sort changes: critical first, then warning, then by impact
    changes.sort((a, b) => {
      const severityOrder: Record<ChangeSeverity, number> = {
        critical: 0,
        warning: 1,
        info: 2,
        positive: 3,
      };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      // Then by absolute delta
      const aDelta = Math.abs(a.delta || 0);
      const bDelta = Math.abs(b.delta || 0);
      return bDelta - aDelta;
    });

    // Build summary
    const summary: ChangeSummary = {
      totalChanges: changes.length,
      byCategory: {
        budget: 0,
        bidding: 0,
        status: 0,
        metric_spike: 0,
        metric_drop: 0,
        anomaly: 0,
        wasted_spend: 0,
        opportunity: 0,
      },
      bySeverity: {
        critical: 0,
        warning: 0,
        info: 0,
        positive: 0,
      },
      criticalCount: 0,
      warningCount: 0,
      positiveCount: 0,
      topImpactItems: changes.slice(0, 5),
      currentPeriod,
      comparePeriod,
    };

    for (const change of changes) {
      summary.byCategory[change.category]++;
      summary.bySeverity[change.severity]++;
      if (change.severity === 'critical') summary.criticalCount++;
      if (change.severity === 'warning') summary.warningCount++;
      if (change.severity === 'positive') summary.positiveCount++;
    }

    const response: WhatChangedResponse = {
      success: true,
      summary,
      changes,
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[WhatChanged] Error:', error);
    return NextResponse.json(
      { error: 'Failed to detect changes', details: String(error) },
      { status: 500 }
    );
  }
}

// Helper: Fetch aggregated metrics for a period
async function fetchPeriodMetrics(
  customerId: string,
  startDate: Date,
  endDate: Date
): Promise<CampaignMetrics[]> {
  // Query MetricsFact for the date range
  const metrics = await prisma.metricsFact.groupBy({
    by: ['entityId'],
    where: {
      customerId,
      entityType: 'CAMPAIGN',
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      impressions: true,
      clicks: true,
      costMicros: true,
      conversions: true,
      conversionsValue: true,
    },
  });

  // Get entity names from hierarchy
  const entityIds = metrics.map((m) => m.entityId);
  const hierarchy = await prisma.entityHierarchy.findMany({
    where: {
      customerId,
      entityType: 'CAMPAIGN',
      entityId: { in: entityIds },
    },
    select: {
      entityId: true,
      entityName: true,
      status: true,
      campaignType: true,
    },
  });

  const hierarchyMap = new Map(hierarchy.map((h) => [h.entityId, h]));

  return metrics.map((m) => {
    const entity = hierarchyMap.get(m.entityId);
    const spend = Number(m._sum.costMicros || 0) / 1_000_000;
    const clicks = Number(m._sum.clicks || 0);
    const impressions = Number(m._sum.impressions || 0);
    const conversions = Number(m._sum.conversions || 0);

    return {
      campaignId: m.entityId,
      campaignName: entity?.entityName || `Campaign ${m.entityId}`,
      status: entity?.status || 'UNKNOWN',
      campaignType: entity?.campaignType || 'UNKNOWN',
      spend,
      clicks,
      impressions,
      conversions,
      cpa: conversions > 0 ? spend / conversions : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      roas:
        Number(m._sum.conversionsValue || 0) > 0 && spend > 0
          ? Number(m._sum.conversionsValue) / spend
          : 0,
    };
  });
}

// Helper: Create a metric change item
function createMetricChange(
  id: string,
  campaign: CampaignMetrics,
  category: ChangeCategory,
  severity: ChangeSeverity,
  metric: string,
  previousValue: number,
  currentValue: number,
  delta: number,
  currentPeriod: { start: string; end: string },
  comparePeriod: { start: string; end: string }
): ChangeItem {
  const isIncrease = delta > 0;
  const absChange = Math.abs(currentValue - previousValue);
  const formattedPrev =
    metric === 'CPA' || metric === 'Spend'
      ? `$${previousValue.toFixed(2)}`
      : metric === 'CTR'
      ? `${previousValue.toFixed(2)}%`
      : previousValue.toFixed(1);
  const formattedCurr =
    metric === 'CPA' || metric === 'Spend'
      ? `$${currentValue.toFixed(2)}`
      : metric === 'CTR'
      ? `${currentValue.toFixed(2)}%`
      : currentValue.toFixed(1);

  return {
    id,
    category,
    severity,
    entityType: 'campaign',
    entityId: campaign.campaignId,
    entityName: campaign.campaignName,
    title: `${metric} ${isIncrease ? 'increased' : 'decreased'} ${Math.abs(delta).toFixed(0)}%`,
    description: `${formattedPrev} → ${formattedCurr} (${isIncrease ? '+' : ''}${delta.toFixed(1)}%)`,
    metric,
    previousMetricValue: previousValue,
    currentMetricValue: currentValue,
    delta,
    absoluteDelta: absChange,
    periodStart: currentPeriod.start,
    periodEnd: currentPeriod.end,
    comparePeriodStart: comparePeriod.start,
    comparePeriodEnd: comparePeriod.end,
    detectedAt: new Date().toISOString(),
    estimatedImpact: {
      metric,
      direction:
        (metric === 'CPA' && isIncrease) || (metric !== 'CPA' && !isIncrease)
          ? 'negative'
          : 'positive',
      magnitude: Math.abs(delta) >= 40 ? 'high' : Math.abs(delta) >= 25 ? 'medium' : 'low',
    },
    availableActions: [
      {
        type: 'queue_fix',
        label: severity === 'critical' ? 'Queue Fix' : 'Take Action',
        description: getFixDescription(metric, isIncrease, campaign),
        actionPayload: getFixPayload(metric, isIncrease, campaign),
      },
      {
        type: 'explain',
        label: 'Explain',
        description: 'Get AI analysis of this change',
      },
      {
        type: 'ignore',
        label: 'Ignore',
        description: 'Dismiss this alert',
      },
    ],
    status: 'new',
  };
}

function getFixDescription(
  metric: string,
  isIncrease: boolean,
  campaign: CampaignMetrics
): string {
  if (metric === 'CPA' && isIncrease) {
    return 'Review and optimize targeting or reduce budget';
  }
  if (metric === 'Conversions' && !isIncrease) {
    return 'Check for tracking issues or bid adjustments';
  }
  if (metric === 'Spend' && isIncrease) {
    return 'Review budget and pacing';
  }
  if (metric === 'CTR' && !isIncrease) {
    return 'Review ad copy and targeting';
  }
  return 'Review campaign settings';
}

function getFixPayload(
  metric: string,
  isIncrease: boolean,
  campaign: CampaignMetrics
): { actionType: string; entityType: string; entityId: string; newValue: string } | undefined {
  if (metric === 'CPA' && isIncrease && campaign.cpa > 100) {
    return {
      actionType: 'pause_campaign',
      entityType: 'campaign',
      entityId: campaign.campaignId,
      newValue: 'PAUSED',
    };
  }
  return undefined;
}
