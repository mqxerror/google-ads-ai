import type {
  AutomatedRule,
  RuleCondition,
  RuleAction,
  RuleExecution,
  RuleOperator,
} from '@/types/rules';
import type { Campaign, AdGroup, Keyword } from '@/types/campaign';

export type EvaluationEntity = Campaign | AdGroup | Keyword;

interface EntityMetrics {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
  cost_per_click?: number;
  conversion_rate?: number;
  quality_score?: number;
}

/**
 * Evaluates if a condition is met for a given entity
 */
export function evaluateCondition(
  condition: RuleCondition,
  metrics: EntityMetrics
): boolean {
  const metricValue = metrics[condition.metric as keyof EntityMetrics];

  if (metricValue === undefined) {
    console.warn(`Metric ${condition.metric} not found in entity metrics`);
    return false;
  }

  return compareValues(metricValue, condition.operator, condition.value);
}

/**
 * Compares two values based on the operator
 */
function compareValues(
  actualValue: number,
  operator: RuleOperator,
  targetValue: number
): boolean {
  switch (operator) {
    case 'greater_than':
      return actualValue > targetValue;
    case 'less_than':
      return actualValue < targetValue;
    case 'equals':
      return Math.abs(actualValue - targetValue) < 0.0001; // Float comparison
    case 'greater_than_or_equal':
      return actualValue >= targetValue;
    case 'less_than_or_equal':
      return actualValue <= targetValue;
    case 'not_equals':
      return Math.abs(actualValue - targetValue) >= 0.0001;
    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Evaluates all conditions for a rule (AND logic)
 */
export function evaluateRule(
  rule: AutomatedRule,
  entity: EvaluationEntity
): boolean {
  if (!rule.enabled || rule.status !== 'active') {
    return false;
  }

  // Check entity type filter if specified
  if (rule.entityFilter) {
    if (rule.entityFilter.ids && !rule.entityFilter.ids.includes(entity.id)) {
      return false;
    }

    if (rule.entityFilter.nameContains) {
      // Keywords use 'text' property instead of 'name'
      const entityName = 'name' in entity ? entity.name : 'text' in entity ? entity.text : '';
      const nameMatch = entityName
        .toLowerCase()
        .includes(rule.entityFilter.nameContains.toLowerCase());
      if (!nameMatch) {
        return false;
      }
    }

    if (rule.entityFilter.statusIn) {
      if (!rule.entityFilter.statusIn.includes(entity.status as typeof rule.entityFilter.statusIn[number])) {
        return false;
      }
    }
  }

  // Extract metrics from entity - use type casting for optional properties
  const campaignEntity = entity as Campaign;
  const keywordEntity = entity as Keyword;

  const metrics: EntityMetrics = {
    spend: entity.spend || 0,
    clicks: entity.clicks || 0,
    impressions: campaignEntity.impressions || 0,
    conversions: entity.conversions || 0,
    ctr: campaignEntity.ctr || 0,
    cpa: entity.cpa || 0,
    roas: campaignEntity.roas || 0,
    cost_per_click: entity.clicks > 0 ? entity.spend / entity.clicks : 0,
    conversion_rate: entity.clicks > 0 ? (entity.conversions / entity.clicks) * 100 : 0,
    quality_score: keywordEntity.qualityScore,
  };

  // Evaluate all conditions (AND logic)
  return rule.conditions.every((condition) =>
    evaluateCondition(condition, metrics)
  );
}

/**
 * Evaluates a rule against multiple entities
 */
export function evaluateRuleForEntities(
  rule: AutomatedRule,
  entities: EvaluationEntity[]
): EvaluationEntity[] {
  return entities.filter((entity) => evaluateRule(rule, entity));
}

/**
 * Generates an action plan for entities that match a rule
 */
export interface ActionPlan {
  entityId: string;
  entityName: string;
  entityType: string;
  actions: RuleAction[];
  currentStatus?: string;
  currentBudget?: number;
  currentBid?: number;
}

export function generateActionPlan(
  rule: AutomatedRule,
  matchedEntities: EvaluationEntity[]
): ActionPlan[] {
  return matchedEntities.map((entity) => {
    // Get entity name - Campaign/AdGroup have 'name', Keyword has 'text'
    const entityName = 'name' in entity ? entity.name : (entity as Keyword).text;

    return {
      entityId: entity.id,
      entityName,
      entityType: rule.entityType,
      actions: rule.actions,
      currentStatus: entity.status,
      currentBudget: (entity as Campaign).spend,
      currentBid: (entity as Keyword).spend,
    };
  });
}

/**
 * Simulates rule execution (for preview/dry-run)
 */
export function simulateRuleExecution(
  rule: AutomatedRule,
  entities: EvaluationEntity[]
): {
  matchedEntities: EvaluationEntity[];
  actionPlan: ActionPlan[];
  summary: {
    totalEvaluated: number;
    totalMatched: number;
    actionsTaken: number;
  };
} {
  const matchedEntities = evaluateRuleForEntities(rule, entities);
  const actionPlan = generateActionPlan(rule, matchedEntities);

  return {
    matchedEntities,
    actionPlan,
    summary: {
      totalEvaluated: entities.length,
      totalMatched: matchedEntities.length,
      actionsTaken: matchedEntities.length * rule.actions.length,
    },
  };
}

/**
 * Validates a rule configuration
 */
export function validateRule(rule: Partial<AutomatedRule>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!rule.name || rule.name.trim().length === 0) {
    errors.push('Rule name is required');
  }

  if (!rule.entityType) {
    errors.push('Entity type is required');
  }

  if (!rule.conditions || rule.conditions.length === 0) {
    errors.push('At least one condition is required');
  } else {
    rule.conditions.forEach((condition, index) => {
      if (!condition.metric) {
        errors.push(`Condition ${index + 1}: Metric is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`);
      }
      if (condition.value === undefined || condition.value === null) {
        errors.push(`Condition ${index + 1}: Value is required`);
      }
      if (!condition.period) {
        errors.push(`Condition ${index + 1}: Period is required`);
      }
    });
  }

  if (!rule.actions || rule.actions.length === 0) {
    errors.push('At least one action is required');
  } else {
    rule.actions.forEach((action, index) => {
      if (!action.type) {
        errors.push(`Action ${index + 1}: Action type is required`);
      }
      if (
        (action.type === 'adjust_budget' || action.type === 'adjust_bid') &&
        (action.value === undefined || action.value === null)
      ) {
        errors.push(`Action ${index + 1}: Value is required for budget/bid adjustments`);
      }
      if (action.type === 'send_notification' && !action.notificationEmail) {
        // Email is optional, will use default
      }
    });
  }

  if (!rule.schedule) {
    errors.push('Schedule is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates the next run time for a rule
 */
export function calculateNextRun(
  schedule: AutomatedRule['schedule'],
  lastRun?: string
): Date {
  const now = new Date();
  const base = lastRun ? new Date(lastRun) : now;

  switch (schedule) {
    case 'hourly':
      return new Date(base.getTime() + 60 * 60 * 1000);
    case 'daily':
      const daily = new Date(base);
      daily.setDate(daily.getDate() + 1);
      daily.setHours(0, 0, 0, 0);
      return daily;
    case 'weekly':
      const weekly = new Date(base);
      weekly.setDate(weekly.getDate() + 7);
      weekly.setHours(0, 0, 0, 0);
      return weekly;
    case 'monthly':
      const monthly = new Date(base);
      monthly.setMonth(monthly.getMonth() + 1);
      monthly.setHours(0, 0, 0, 0);
      return monthly;
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * Creates a rule execution record
 */
export function createExecutionRecord(
  ruleId: string,
  actionPlan: ActionPlan[],
  results: { entityId: string; success: boolean; error?: string }[]
): RuleExecution {
  const successCount = results.filter((r) => r.success).length;
  const status: RuleExecution['status'] =
    successCount === results.length
      ? 'success'
      : successCount === 0
      ? 'failed'
      : 'partial_success';

  return {
    id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ruleId,
    executedAt: new Date().toISOString(),
    status,
    entitiesEvaluated: actionPlan.length,
    entitiesActioned: successCount,
    errors: results
      .filter((r) => !r.success && r.error)
      .map((r) => r.error!),
    details: actionPlan.map((plan) => {
      const result = results.find((r) => r.entityId === plan.entityId);
      return {
        entityId: plan.entityId,
        entityName: plan.entityName,
        actionTaken: plan.actions.map((a) => a.type).join(', '),
        success: result?.success || false,
        error: result?.error,
      };
    }),
  };
}

/**
 * Formats a rule for display
 */
export function formatRuleForDisplay(rule: AutomatedRule): {
  title: string;
  description: string;
  status: string;
  schedule: string;
} {
  const conditionTexts = rule.conditions.map((c) => {
    const metricLabels: Record<string, string> = {
      spend: 'Spend',
      clicks: 'Clicks',
      conversions: 'Conversions',
      ctr: 'CTR',
      cpa: 'CPA',
      roas: 'ROAS',
    };
    const opLabels: Record<string, string> = {
      greater_than: '>',
      less_than: '<',
      equals: '=',
      greater_than_or_equal: '>=',
      less_than_or_equal: '<=',
      not_equals: '!=',
    };
    return `${metricLabels[c.metric] || c.metric} ${opLabels[c.operator] || c.operator} ${c.value}`;
  });

  const actionTexts = rule.actions.map((a) => {
    switch (a.type) {
      case 'pause':
        return 'Pause';
      case 'enable':
        return 'Enable';
      case 'adjust_budget':
        return `${a.value! > 0 ? 'Increase' : 'Decrease'} budget by ${Math.abs(a.value!)}%`;
      case 'adjust_bid':
        return `${a.value! > 0 ? 'Increase' : 'Decrease'} bid by ${Math.abs(a.value!)}%`;
      case 'send_notification':
        return 'Send notification';
      default:
        return a.type;
    }
  });

  return {
    title: rule.name,
    description: `When ${conditionTexts.join(' AND ')}, then ${actionTexts.join(' and ')}`,
    status: rule.enabled ? 'Active' : 'Paused',
    schedule: rule.schedule.charAt(0).toUpperCase() + rule.schedule.slice(1),
  };
}
