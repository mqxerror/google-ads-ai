import {
  defaultGuardrailSettings,
  checkActionGuardrails,
  type GuardrailSettings,
} from '../lib/guardrails';
import { Campaign } from '@/types/campaign';
import { QueuedAction } from '@/types/action-queue';

describe('Guardrails', () => {
  describe('defaultGuardrailSettings', () => {
    it('should have enabled flag set to true by default', () => {
      expect(defaultGuardrailSettings.enabled).toBe(true);
    });

    it('should not allow pausing all campaigns by default', () => {
      expect(defaultGuardrailSettings.allowPauseAllCampaigns).toBe(false);
    });

    it('should not allow zero budget by default', () => {
      expect(defaultGuardrailSettings.allowZeroBudget).toBe(false);
    });

    it('should have budget change threshold of 50%', () => {
      expect(defaultGuardrailSettings.budgetChangeThresholdPercent).toBe(50);
    });

    it('should warn on high performer pause by default', () => {
      expect(defaultGuardrailSettings.warnOnHighPerformerPause).toBe(true);
    });

    it('should have high performer threshold of 80', () => {
      expect(defaultGuardrailSettings.highPerformerThreshold).toBe(80);
    });
  });

  describe('checkActionGuardrails', () => {
    const mockCampaigns: Campaign[] = [
      {
        id: 'campaign-1',
        name: 'Campaign 1',
        status: 'ENABLED',
        type: 'SEARCH',
        spend: 500,
        impressions: 10000,
        clicks: 100,
        conversions: 10,
        ctr: 1,
        cpa: 50,
        roas: 2.5,
        aiScore: 75,
      },
      {
        id: 'campaign-2',
        name: 'Campaign 2',
        status: 'ENABLED',
        type: 'SEARCH',
        spend: 1000,
        impressions: 20000,
        clicks: 200,
        conversions: 20,
        ctr: 1,
        cpa: 50,
        roas: 2.5,
        aiScore: 85,
      },
    ];

    const mockSettings: GuardrailSettings = {
      enabled: true,
      allowPauseAllCampaigns: false,
      allowZeroBudget: false,
      budgetChangeThresholdPercent: 50,
      warnOnHighPerformerPause: true,
      highPerformerThreshold: 80,
    };

    it('should allow actions when guardrails are disabled', () => {
      const action = {
        entityId: 'campaign-1',
        entityType: 'campaign' as const,
        entityName: 'Campaign 1',
        actionType: 'pause_campaign' as const,
        currentValue: 'ENABLED',
        newValue: 'PAUSED',
        riskLevel: 'low' as const,
      };

      const result = checkActionGuardrails(action, {
        campaigns: mockCampaigns,
        pendingActions: [],
        settings: { ...mockSettings, enabled: false },
      });

      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe('low');
    });

    it('should block pausing the last active campaign', () => {
      const action = {
        entityId: 'campaign-1',
        entityType: 'campaign' as const,
        entityName: 'Campaign 1',
        actionType: 'pause_campaign' as const,
        currentValue: 'ENABLED',
        newValue: 'PAUSED',
        riskLevel: 'low' as const,
      };

      const singleCampaign = [mockCampaigns[0]];

      const result = checkActionGuardrails(action, {
        campaigns: singleCampaign,
        pendingActions: [],
        settings: mockSettings,
      });

      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe('high');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should block setting budget to zero', () => {
      const action = {
        entityId: 'campaign-1',
        entityType: 'campaign' as const,
        entityName: 'Campaign 1',
        actionType: 'update_budget' as const,
        currentValue: '1000',
        newValue: '0',
        riskLevel: 'low' as const,
      };

      const result = checkActionGuardrails(action, {
        campaigns: mockCampaigns,
        pendingActions: [],
        settings: mockSettings,
      });

      expect(result.allowed).toBe(false);
      expect(result.errors).toContain('Cannot set budget to $0. Pause the campaign instead.');
    });

    it('should warn on large budget changes', () => {
      const action = {
        entityId: 'campaign-1',
        entityType: 'campaign' as const,
        entityName: 'Campaign 1',
        actionType: 'update_budget' as const,
        currentValue: '1000',
        newValue: '2000',
        riskLevel: 'low' as const,
      };

      const result = checkActionGuardrails(action, {
        campaigns: mockCampaigns,
        pendingActions: [],
        settings: mockSettings,
      });

      expect(result.allowed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.riskLevel).toBe('high');
    });
  });
});
