import { QueuedAction, RiskLevel } from '@/types/action-queue';
import { Campaign } from '@/types/campaign';

export interface GuardrailResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  warnings: string[];
  errors: string[];
}

export interface GuardrailSettings {
  enabled: boolean;
  allowPauseAllCampaigns: boolean;
  allowZeroBudget: boolean;
  budgetChangeThresholdPercent: number; // Default 50
  warnOnHighPerformerPause: boolean;
  highPerformerThreshold: number; // Default 80 (AI score)
}

export const defaultGuardrailSettings: GuardrailSettings = {
  enabled: true,
  allowPauseAllCampaigns: false,
  allowZeroBudget: false,
  budgetChangeThresholdPercent: 50,
  warnOnHighPerformerPause: true,
  highPerformerThreshold: 80,
};

// Extended action type that includes optional aiScore for guardrail checks
// Also excludes riskLevel since it's calculated, not provided
export type ActionWithAIScore = Omit<QueuedAction, 'id' | 'status' | 'createdAt' | 'riskLevel'> & { aiScore?: number; riskLevel?: RiskLevel };

/**
 * Check a single action against guardrails
 */
export function checkActionGuardrails(
  action: ActionWithAIScore,
  context: {
    campaigns: Campaign[];
    pendingActions: QueuedAction[];
    settings: GuardrailSettings;
  }
): GuardrailResult {
  const { campaigns, pendingActions, settings } = context;
  const warnings: string[] = [];
  const errors: string[] = [];
  let riskLevel: RiskLevel = 'low';

  if (!settings.enabled) {
    return { allowed: true, riskLevel: 'low', warnings: [], errors: [] };
  }

  // Check: Pausing ALL active campaigns
  if (action.actionType === 'pause_campaign') {
    const activeCampaigns = campaigns.filter(c => c.status === 'ENABLED');
    const pendingPauses = pendingActions.filter(
      a => a.actionType === 'pause_campaign' && a.status !== 'rejected'
    );
    const alreadyPausingIds = new Set(pendingPauses.map(a => a.entityId));

    // Check if this action would pause all remaining active campaigns
    const remainingActive = activeCampaigns.filter(
      c => c.id !== action.entityId && !alreadyPausingIds.has(c.id)
    );

    if (remainingActive.length === 0 && activeCampaigns.length > 0) {
      if (!settings.allowPauseAllCampaigns) {
        errors.push('Cannot pause all active campaigns. At least one campaign must remain active.');
        return { allowed: false, riskLevel: 'high', warnings, errors };
      } else {
        warnings.push('Warning: This will pause your last active campaign.');
        riskLevel = 'high';
      }
    }

    // Check: Pausing high-performing campaign
    if (settings.warnOnHighPerformerPause && action.aiScore !== undefined) {
      if (action.aiScore >= settings.highPerformerThreshold) {
        warnings.push(`Warning: This campaign has a high AI Score (${action.aiScore}). Pausing may impact performance.`);
        riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      }
    }
  }

  // Check: Budget changes
  if (action.actionType === 'update_budget') {
    const currentBudget = Number(action.currentValue);
    const newBudget = Number(action.newValue);

    // Cannot set budget to $0
    if (newBudget === 0 && !settings.allowZeroBudget) {
      errors.push('Cannot set budget to $0. Pause the campaign instead.');
      return { allowed: false, riskLevel: 'high', warnings, errors };
    }

    // Large budget change warning
    if (currentBudget > 0) {
      const changePercent = Math.abs((newBudget - currentBudget) / currentBudget) * 100;

      if (changePercent >= settings.budgetChangeThresholdPercent) {
        const direction = newBudget > currentBudget ? 'increase' : 'decrease';
        warnings.push(`Large budget ${direction}: ${changePercent.toFixed(0)}% change detected.`);
        riskLevel = 'high';
      } else if (changePercent >= 25) {
        riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      }
    }
  }

  return {
    allowed: errors.length === 0,
    riskLevel,
    warnings,
    errors,
  };
}

/**
 * Check multiple actions against guardrails (for bulk operations)
 */
export function checkBulkActionsGuardrails(
  actions: Array<ActionWithAIScore>,
  context: {
    campaigns: Campaign[];
    pendingActions: QueuedAction[];
    settings: GuardrailSettings;
  }
): GuardrailResult {
  const { campaigns, pendingActions, settings } = context;
  const warnings: string[] = [];
  const errors: string[] = [];
  let riskLevel: RiskLevel = 'low';

  if (!settings.enabled) {
    return { allowed: true, riskLevel: 'low', warnings: [], errors: [] };
  }

  // Check: Pausing ALL active campaigns in bulk
  const pauseActions = actions.filter(a => a.actionType === 'pause_campaign');
  if (pauseActions.length > 0) {
    const activeCampaigns = campaigns.filter(c => c.status === 'ENABLED');
    const pausingIds = new Set(pauseActions.map(a => a.entityId));
    const alreadyPausingIds = new Set(
      pendingActions
        .filter(a => a.actionType === 'pause_campaign' && a.status !== 'rejected')
        .map(a => a.entityId)
    );

    const allPausingIds = new Set([...pausingIds, ...alreadyPausingIds]);
    const remainingActive = activeCampaigns.filter(c => !allPausingIds.has(c.id));

    if (remainingActive.length === 0 && activeCampaigns.length > 0) {
      if (!settings.allowPauseAllCampaigns) {
        errors.push(`Cannot pause all ${pauseActions.length} active campaigns. At least one must remain active.`);
        return { allowed: false, riskLevel: 'high', warnings, errors };
      } else {
        warnings.push(`Warning: This will pause all ${pauseActions.length} active campaigns.`);
        riskLevel = 'high';
      }
    }

    // Check high performers in bulk
    if (settings.warnOnHighPerformerPause) {
      const highPerformers = pauseActions.filter(
        a => a.aiScore !== undefined && a.aiScore >= settings.highPerformerThreshold
      );
      if (highPerformers.length > 0) {
        warnings.push(`${highPerformers.length} high-performing campaign(s) will be paused.`);
        riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      }
    }
  }

  // Individual action checks
  for (const action of actions) {
    const result = checkActionGuardrails(action, context);
    if (!result.allowed) {
      errors.push(...result.errors);
    }
    warnings.push(...result.warnings);
    if (result.riskLevel === 'high') riskLevel = 'high';
    else if (result.riskLevel === 'medium' && riskLevel !== 'high') riskLevel = 'medium';
  }

  // Dedupe warnings
  const uniqueWarnings = [...new Set(warnings)];
  const uniqueErrors = [...new Set(errors)];

  return {
    allowed: uniqueErrors.length === 0,
    riskLevel,
    warnings: uniqueWarnings,
    errors: uniqueErrors,
  };
}
