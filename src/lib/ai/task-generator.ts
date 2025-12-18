// AI Task Generator
// Generates ranked AI recommendations from campaign health data

import { Campaign } from '@/types/campaign';
import { CampaignIssue, RecommendedFix } from '@/types/health';
import { AITask } from '@/components/AIInbox/AIInbox';

// Generate AI tasks from campaigns with health data
export function generateAITasks(campaigns: Campaign[]): AITask[] {
  const tasks: AITask[] = [];

  for (const campaign of campaigns) {
    if (!campaign.health?.issues) continue;

    for (const issue of campaign.health.issues) {
      // Skip acknowledged issues
      if (issue.acknowledgedAt) continue;

      // Get the best fix for each issue
      const topFix = issue.fixes[0];
      if (!topFix) continue;

      const priority = calculatePriority(issue, topFix, campaign);
      const timeEstimate = estimateTime(topFix);

      tasks.push({
        id: `${campaign.id}-${issue.id}`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        issue,
        recommendedFix: topFix,
        priority,
        estimatedTimeMinutes: timeEstimate,
        createdAt: issue.createdAt,
        status: 'pending',
      });
    }
  }

  // Sort by priority (highest first)
  return tasks.sort((a, b) => b.priority - a.priority);
}

// Calculate task priority (0-100)
function calculatePriority(
  issue: CampaignIssue,
  fix: RecommendedFix,
  campaign: Campaign
): number {
  let priority = 50; // Base priority

  // Severity impact
  switch (issue.severity) {
    case 'critical':
      priority += 30;
      break;
    case 'warning':
      priority += 15;
      break;
    case 'info':
      priority += 0;
      break;
  }

  // Confidence impact
  switch (fix.confidence) {
    case 'high':
      priority += 15;
      break;
    case 'medium':
      priority += 8;
      break;
    case 'low':
      priority -= 5;
      break;
  }

  // Risk adjustment (lower risk = higher priority for quick wins)
  switch (fix.risk) {
    case 'low':
      priority += 10;
      break;
    case 'medium':
      priority += 0;
      break;
    case 'high':
      priority -= 10;
      break;
  }

  // Impact value boost
  if (issue.impactValue > 1000) priority += 10;
  if (issue.impactValue > 5000) priority += 10;

  // Quick wins get a boost
  if (fix.effort === 'quick') priority += 5;

  // High-spend campaigns get priority
  if (campaign.spend > 1000) priority += 5;
  if (campaign.spend > 5000) priority += 5;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, priority));
}

// Estimate time to implement fix in minutes
function estimateTime(fix: RecommendedFix): number {
  switch (fix.effort) {
    case 'quick':
      return 2;
    case 'moderate':
      return 15;
    case 'complex':
      return 60;
    default:
      return 10;
  }
}

// Filter tasks by criteria
export function filterTasks(
  tasks: AITask[],
  options: {
    minPriority?: number;
    maxTimeMinutes?: number;
    categories?: string[];
    riskLevel?: ('low' | 'medium' | 'high')[];
  }
): AITask[] {
  return tasks.filter((task) => {
    if (options.minPriority && task.priority < options.minPriority) return false;
    if (options.maxTimeMinutes && task.estimatedTimeMinutes > options.maxTimeMinutes) return false;
    if (options.categories && !options.categories.includes(task.issue.category)) return false;
    if (options.riskLevel && !options.riskLevel.includes(task.recommendedFix.risk)) return false;
    return true;
  });
}

// Get summary stats for tasks
export function getTaskStats(tasks: AITask[]) {
  const pending = tasks.filter((t) => t.status === 'pending');
  const highPriority = pending.filter((t) => t.priority >= 75);
  const quickWins = pending.filter((t) => t.estimatedTimeMinutes <= 5 && t.recommendedFix.risk === 'low');

  const totalImpact = pending.reduce((sum, t) => {
    const { max, metric } = t.recommendedFix.impactRange;
    if (metric === 'savings') return sum + max;
    return sum;
  }, 0);

  const totalTime = pending.reduce((sum, t) => sum + t.estimatedTimeMinutes, 0);

  // Group by category
  const byCategory: Record<string, number> = {};
  for (const task of pending) {
    byCategory[task.issue.category] = (byCategory[task.issue.category] || 0) + 1;
  }

  return {
    total: pending.length,
    highPriority: highPriority.length,
    quickWins: quickWins.length,
    totalEstimatedImpact: totalImpact,
    totalEstimatedTimeMinutes: totalTime,
    byCategory,
  };
}

// Get top N tasks
export function getTopTasks(tasks: AITask[], n: number = 5): AITask[] {
  return tasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => b.priority - a.priority)
    .slice(0, n);
}

// Get quick wins
export function getQuickWins(tasks: AITask[]): AITask[] {
  return tasks
    .filter(
      (t) =>
        t.status === 'pending' &&
        t.estimatedTimeMinutes <= 5 &&
        t.recommendedFix.risk === 'low' &&
        t.recommendedFix.confidence !== 'low'
    )
    .sort((a, b) => b.priority - a.priority);
}
