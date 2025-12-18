export type RuleEntityType = 'campaign' | 'adGroup' | 'keyword';

export type RuleMetric =
  | 'spend'
  | 'clicks'
  | 'impressions'
  | 'conversions'
  | 'ctr'
  | 'cpa'
  | 'roas'
  | 'cost_per_click'
  | 'conversion_rate'
  | 'quality_score';

export type RuleOperator =
  | 'greater_than'
  | 'less_than'
  | 'equals'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'not_equals';

export type RuleActionType =
  | 'pause'
  | 'enable'
  | 'adjust_budget'
  | 'adjust_bid'
  | 'send_notification';

export type RulePeriod = '1d' | '7d' | '14d' | '30d' | '60d' | '90d';

export type RuleSchedule = 'hourly' | 'daily' | 'weekly' | 'monthly';

export type RuleStatus = 'active' | 'paused' | 'error';

export interface RuleCondition {
  metric: RuleMetric;
  operator: RuleOperator;
  value: number;
  period: RulePeriod;
}

export interface RuleAction {
  type: RuleActionType;
  value?: number; // For budget/bid adjustments (percentage)
  notificationEmail?: string; // For notification actions
}

export interface AutomatedRule {
  id: string;
  name: string;
  description?: string;
  accountId: string;
  enabled: boolean;
  status: RuleStatus;
  entityType: RuleEntityType;
  entityFilter?: {
    // Optional filters to apply rule only to specific entities
    ids?: string[]; // Specific entity IDs
    nameContains?: string; // Entity name contains text
    statusIn?: ('ENABLED' | 'PAUSED')[]; // Only apply to entities with these statuses
  };
  conditions: RuleCondition[]; // Multiple conditions (AND logic)
  actions: RuleAction[]; // Multiple actions to execute
  schedule: RuleSchedule;
  lastRun?: string; // ISO timestamp
  nextRun?: string; // ISO timestamp
  executionHistory?: RuleExecution[];
  createdAt: string;
  updatedAt: string;
}

export interface RuleExecution {
  id: string;
  ruleId: string;
  executedAt: string;
  status: 'success' | 'partial_success' | 'failed';
  entitiesEvaluated: number;
  entitiesActioned: number;
  errors?: string[];
  details?: {
    entityId: string;
    entityName: string;
    actionTaken: string;
    success: boolean;
    error?: string;
  }[];
}

export interface RuleTemplate {
  name: string;
  description: string;
  category: 'performance' | 'budget' | 'quality' | 'maintenance';
  entityType: RuleEntityType;
  conditions: RuleCondition[];
  actions: RuleAction[];
  schedule: RuleSchedule;
}

// Predefined rule templates
export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: 'Pause Low-Performing Keywords',
    description: 'Automatically pause keywords with high CPA and low conversions',
    category: 'performance',
    entityType: 'keyword',
    conditions: [
      { metric: 'cpa', operator: 'greater_than', value: 50, period: '7d' },
      { metric: 'conversions', operator: 'less_than', value: 2, period: '7d' },
    ],
    actions: [{ type: 'pause' }],
    schedule: 'daily',
  },
  {
    name: 'Pause Campaigns with No Conversions',
    description: 'Pause campaigns that have spent budget but generated no conversions',
    category: 'performance',
    entityType: 'campaign',
    conditions: [
      { metric: 'conversions', operator: 'equals', value: 0, period: '14d' },
      { metric: 'spend', operator: 'greater_than', value: 100, period: '14d' },
    ],
    actions: [
      { type: 'pause' },
      { type: 'send_notification' },
    ],
    schedule: 'daily',
  },
  {
    name: 'Increase Budget for High ROAS Campaigns',
    description: 'Increase budget by 20% for campaigns with excellent ROAS',
    category: 'budget',
    entityType: 'campaign',
    conditions: [
      { metric: 'roas', operator: 'greater_than', value: 4, period: '7d' },
      { metric: 'conversions', operator: 'greater_than', value: 10, period: '7d' },
    ],
    actions: [{ type: 'adjust_budget', value: 20 }],
    schedule: 'weekly',
  },
  {
    name: 'Decrease Budget for Low CTR Campaigns',
    description: 'Reduce budget by 15% for campaigns with poor click-through rates',
    category: 'budget',
    entityType: 'campaign',
    conditions: [
      { metric: 'ctr', operator: 'less_than', value: 1, period: '7d' },
      { metric: 'impressions', operator: 'greater_than', value: 1000, period: '7d' },
    ],
    actions: [{ type: 'adjust_budget', value: -15 }],
    schedule: 'weekly',
  },
  {
    name: 'Pause Low Quality Score Keywords',
    description: 'Pause keywords with consistently low quality scores',
    category: 'quality',
    entityType: 'keyword',
    conditions: [
      { metric: 'quality_score', operator: 'less_than', value: 4, period: '14d' },
    ],
    actions: [{ type: 'pause' }],
    schedule: 'weekly',
  },
  {
    name: 'Alert on High Spend Campaigns',
    description: 'Send notification when daily spend exceeds threshold',
    category: 'budget',
    entityType: 'campaign',
    conditions: [
      { metric: 'spend', operator: 'greater_than', value: 500, period: '1d' },
    ],
    actions: [{ type: 'send_notification' }],
    schedule: 'hourly',
  },
  {
    name: 'Enable Paused Campaigns with Good History',
    description: 'Re-enable paused campaigns that previously had good ROAS',
    category: 'maintenance',
    entityType: 'campaign',
    conditions: [
      { metric: 'roas', operator: 'greater_than', value: 3, period: '30d' },
    ],
    actions: [{ type: 'enable' }],
    schedule: 'weekly',
  },
  {
    name: 'Increase Bids for High Conversion Rate Keywords',
    description: 'Boost bids by 25% for keywords with excellent conversion rates',
    category: 'performance',
    entityType: 'keyword',
    conditions: [
      { metric: 'conversion_rate', operator: 'greater_than', value: 10, period: '14d' },
      { metric: 'conversions', operator: 'greater_than', value: 5, period: '14d' },
    ],
    actions: [{ type: 'adjust_bid', value: 25 }],
    schedule: 'weekly',
  },
];

// Helper functions
export function getMetricLabel(metric: RuleMetric): string {
  const labels: Record<RuleMetric, string> = {
    spend: 'Spend',
    clicks: 'Clicks',
    impressions: 'Impressions',
    conversions: 'Conversions',
    ctr: 'CTR',
    cpa: 'CPA',
    roas: 'ROAS',
    cost_per_click: 'Cost per Click',
    conversion_rate: 'Conversion Rate',
    quality_score: 'Quality Score',
  };
  return labels[metric];
}

export function getOperatorLabel(operator: RuleOperator): string {
  const labels: Record<RuleOperator, string> = {
    greater_than: '>',
    less_than: '<',
    equals: '=',
    greater_than_or_equal: '>=',
    less_than_or_equal: '<=',
    not_equals: '!=',
  };
  return labels[operator];
}

export function getOperatorFullLabel(operator: RuleOperator): string {
  const labels: Record<RuleOperator, string> = {
    greater_than: 'Greater than',
    less_than: 'Less than',
    equals: 'Equals',
    greater_than_or_equal: 'Greater than or equal to',
    less_than_or_equal: 'Less than or equal to',
    not_equals: 'Not equals',
  };
  return labels[operator];
}

export function getPeriodLabel(period: RulePeriod): string {
  const labels: Record<RulePeriod, string> = {
    '1d': 'Last 1 day',
    '7d': 'Last 7 days',
    '14d': 'Last 14 days',
    '30d': 'Last 30 days',
    '60d': 'Last 60 days',
    '90d': 'Last 90 days',
  };
  return labels[period];
}

export function getScheduleLabel(schedule: RuleSchedule): string {
  const labels: Record<RuleSchedule, string> = {
    hourly: 'Every hour',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };
  return labels[schedule];
}

export function getActionDescription(action: RuleAction): string {
  switch (action.type) {
    case 'pause':
      return 'Pause entity';
    case 'enable':
      return 'Enable entity';
    case 'adjust_budget':
      return `${action.value && action.value > 0 ? 'Increase' : 'Decrease'} budget by ${Math.abs(action.value || 0)}%`;
    case 'adjust_bid':
      return `${action.value && action.value > 0 ? 'Increase' : 'Decrease'} bid by ${Math.abs(action.value || 0)}%`;
    case 'send_notification':
      return 'Send notification';
    default:
      return 'Unknown action';
  }
}

export function getRuleDescription(rule: AutomatedRule): string {
  const conditionParts = rule.conditions.map(c =>
    `${getMetricLabel(c.metric)} ${getOperatorLabel(c.operator)} ${c.value}`
  );
  const actionParts = rule.actions.map(a => getActionDescription(a));

  return `When ${conditionParts.join(' AND ')}, then ${actionParts.join(' and ')}`;
}
