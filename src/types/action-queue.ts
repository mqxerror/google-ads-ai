export type ActionType =
  // Core entity actions
  | 'pause_campaign'
  | 'enable_campaign'
  | 'pause_ad_group'
  | 'enable_ad_group'
  | 'pause_keyword'
  | 'enable_keyword'
  | 'update_budget'
  | 'update_bid'
  // AI recommendation actions
  | 'adjust_budget'
  | 'adjust_bid'
  | 'add_negatives'
  | 'improve_ads'
  | 'review_targeting'
  | 'fix_tracking'
  | 'review_keywords'
  | 'scale_budget';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';

export type EntityType = 'campaign' | 'ad_group' | 'keyword';

export interface QueuedAction {
  id: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  currentValue: string | number | boolean;
  newValue: string | number | boolean;
  riskLevel: RiskLevel;
  status: ActionStatus;
  reason?: string; // AI recommendation reason or user note
  accountId?: string; // Google Ads account ID this action belongs to
  adGroupId?: string; // For keywords, the parent ad group ID
  createdAt: Date;
  executedAt?: Date;
  error?: string;
}

export interface ActionQueueState {
  actions: QueuedAction[];
  isExecuting: boolean;
}

// Helper to get action label
export function getActionLabel(actionType: ActionType): string {
  const labels: Record<ActionType, string> = {
    pause_campaign: 'Pause Campaign',
    enable_campaign: 'Enable Campaign',
    pause_ad_group: 'Pause Ad Group',
    enable_ad_group: 'Enable Ad Group',
    pause_keyword: 'Pause Keyword',
    enable_keyword: 'Enable Keyword',
    update_budget: 'Update Budget',
    update_bid: 'Update Bid',
    adjust_budget: 'Adjust Budget',
    adjust_bid: 'Adjust Bid',
    add_negatives: 'Add Negative Keywords',
    improve_ads: 'Improve Ads',
    review_targeting: 'Review Targeting',
    fix_tracking: 'Fix Tracking',
    review_keywords: 'Review Keywords',
    scale_budget: 'Scale Budget',
  };
  return labels[actionType];
}

// Helper to get risk color
export function getRiskColor(riskLevel: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
  };
  return colors[riskLevel];
}

// Helper to calculate risk level for an action
export function calculateRiskLevel(
  actionType: ActionType,
  entityType: EntityType,
  currentValue: string | number | boolean,
  newValue: string | number | boolean,
  aiScore?: number
): RiskLevel {
  // Pausing high-performing campaigns is high risk
  if (actionType === 'pause_campaign' && aiScore && aiScore > 80) {
    return 'high';
  }

  // Budget changes > 50% are high risk
  if (actionType === 'update_budget' || actionType === 'adjust_budget') {
    const current = Number(currentValue);
    const next = Number(newValue);
    if (current > 0) {
      const changePercent = Math.abs((next - current) / current) * 100;
      if (changePercent > 50) return 'high';
      if (changePercent > 25) return 'medium';
    }
    return 'medium'; // Budget adjustments are at least medium risk
  }

  // Bid changes - similar to budget
  if (actionType === 'update_bid' || actionType === 'adjust_bid') {
    return 'medium';
  }

  // Adding negatives is generally low risk
  if (actionType === 'add_negatives') {
    return 'low';
  }

  // Scaling budget is medium-high risk
  if (actionType === 'scale_budget') {
    return 'medium';
  }

  // Review actions are low risk (just investigation)
  if (actionType === 'review_targeting' || actionType === 'review_keywords') {
    return 'low';
  }

  // Improving ads or fixing tracking is medium risk
  if (actionType === 'improve_ads' || actionType === 'fix_tracking') {
    return 'medium';
  }

  // Enabling campaigns is usually low risk
  if (actionType === 'enable_campaign' || actionType === 'enable_ad_group') {
    return 'low';
  }

  // Pausing ad groups/keywords is medium risk
  if (actionType === 'pause_ad_group' || actionType === 'pause_keyword') {
    return 'medium';
  }

  // Default to medium for pause actions
  if (actionType === 'pause_campaign') {
    return 'medium';
  }

  return 'low';
}
