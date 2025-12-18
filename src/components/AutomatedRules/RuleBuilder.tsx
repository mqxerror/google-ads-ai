'use client';

import { useState, useEffect } from 'react';
import type {
  AutomatedRule,
  RuleTemplate,
  RuleEntityType,
  RuleMetric,
  RuleOperator,
  RulePeriod,
  RuleActionType,
  RuleSchedule,
  RuleCondition,
  RuleAction,
} from '@/types/rules';
import {
  getMetricLabel,
  getOperatorFullLabel,
  getPeriodLabel,
  getScheduleLabel,
} from '@/types/rules';
import { validateRule } from '@/lib/rules-engine';

interface RuleBuilderProps {
  rule?: AutomatedRule | null;
  template?: RuleTemplate | null;
  onSave: (rule: Omit<AutomatedRule, 'id' | 'accountId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

export default function RuleBuilder({ rule, template, onSave, onCancel }: RuleBuilderProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState<RuleEntityType>('campaign');
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { metric: 'cpa', operator: 'greater_than', value: 0, period: '7d' },
  ]);
  const [actions, setActions] = useState<RuleAction[]>([{ type: 'pause' }]);
  const [schedule, setSchedule] = useState<RuleSchedule>('daily');
  const [enabled, setEnabled] = useState(true);

  // Initialize form from rule or template
  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description || '');
      setEntityType(rule.entityType);
      setConditions(rule.conditions);
      setActions(rule.actions);
      setSchedule(rule.schedule);
      setEnabled(rule.enabled);
    } else if (template) {
      setName(template.name);
      setDescription(template.description);
      setEntityType(template.entityType);
      setConditions(template.conditions);
      setActions(template.actions);
      setSchedule(template.schedule);
      setEnabled(true);
    }
  }, [rule, template]);

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      { metric: 'cpa', operator: 'greater_than', value: 0, period: '7d' },
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const handleUpdateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  };

  const handleAddAction = () => {
    setActions([...actions, { type: 'pause' }]);
  };

  const handleRemoveAction = (index: number) => {
    if (actions.length > 1) {
      setActions(actions.filter((_, i) => i !== index));
    }
  };

  const handleUpdateAction = (index: number, updates: Partial<RuleAction>) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  };

  const handleSave = async () => {
    const ruleData = {
      name,
      description,
      entityType,
      conditions,
      actions,
      schedule,
      enabled,
      status: 'active' as const,
    };

    const validation = validateRule(ruleData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsSaving(true);
    setErrors([]);

    try {
      await onSave(ruleData);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to save rule']);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {rule ? 'Edit Rule' : template ? 'Create from Template' : 'Create New Rule'}
        </h3>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h4>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="font-medium text-gray-900">Basic Information</h4>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rule Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g., Pause low-performing keywords"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Describe what this rule does..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Apply To <span className="text-red-500">*</span>
          </label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as RuleEntityType)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="campaign">Campaigns</option>
            <option value="adGroup">Ad Groups</option>
            <option value="keyword">Keywords</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Schedule <span className="text-red-500">*</span>
          </label>
          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value as RuleSchedule)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="hourly">Every hour</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {getScheduleLabel(schedule)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
            Enable rule immediately
          </label>
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">
            Conditions <span className="text-sm font-normal text-gray-500">(All must be met)</span>
          </h4>
          <button
            onClick={handleAddCondition}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Condition
          </button>
        </div>

        {conditions.map((condition, index) => (
          <div key={index} className="rounded-lg border border-gray-300 bg-white p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Condition {index + 1}</span>
              {conditions.length > 1 && (
                <button
                  onClick={() => handleRemoveCondition(index)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Metric</label>
                <select
                  value={condition.metric}
                  onChange={(e) =>
                    handleUpdateCondition(index, { metric: e.target.value as RuleMetric })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="spend">Spend</option>
                  <option value="clicks">Clicks</option>
                  <option value="impressions">Impressions</option>
                  <option value="conversions">Conversions</option>
                  <option value="ctr">CTR (%)</option>
                  <option value="cpa">CPA</option>
                  <option value="roas">ROAS</option>
                  <option value="cost_per_click">Cost per Click</option>
                  <option value="conversion_rate">Conversion Rate (%)</option>
                  {entityType === 'keyword' && (
                    <option value="quality_score">Quality Score</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Operator</label>
                <select
                  value={condition.operator}
                  onChange={(e) =>
                    handleUpdateCondition(index, { operator: e.target.value as RuleOperator })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="greater_than">Greater than</option>
                  <option value="less_than">Less than</option>
                  <option value="equals">Equals</option>
                  <option value="greater_than_or_equal">Greater than or equal to</option>
                  <option value="less_than_or_equal">Less than or equal to</option>
                  <option value="not_equals">Not equals</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                <input
                  type="number"
                  value={condition.value}
                  onChange={(e) =>
                    handleUpdateCondition(index, { value: parseFloat(e.target.value) || 0 })
                  }
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Time Period</label>
                <select
                  value={condition.period}
                  onChange={(e) =>
                    handleUpdateCondition(index, { period: e.target.value as RulePeriod })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="1d">Last 1 day</option>
                  <option value="7d">Last 7 days</option>
                  <option value="14d">Last 14 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="60d">Last 60 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Actions</h4>
          <button
            onClick={handleAddAction}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Action
          </button>
        </div>

        {actions.map((action, index) => (
          <div key={index} className="rounded-lg border border-gray-300 bg-white p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Action {index + 1}</span>
              {actions.length > 1 && (
                <button
                  onClick={() => handleRemoveAction(index)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Action Type</label>
                <select
                  value={action.type}
                  onChange={(e) => {
                    const type = e.target.value as RuleActionType;
                    handleUpdateAction(index, {
                      type,
                      value: type === 'adjust_budget' || type === 'adjust_bid' ? 10 : undefined,
                    });
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="pause">Pause</option>
                  <option value="enable">Enable</option>
                  {entityType === 'campaign' && (
                    <option value="adjust_budget">Adjust Budget</option>
                  )}
                  {(entityType === 'keyword' || entityType === 'adGroup') && (
                    <option value="adjust_bid">Adjust Bid</option>
                  )}
                  <option value="send_notification">Send Notification</option>
                </select>
              </div>

              {(action.type === 'adjust_budget' || action.type === 'adjust_bid') && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Adjustment (%)
                  </label>
                  <input
                    type="number"
                    value={action.value || 0}
                    onChange={(e) =>
                      handleUpdateAction(index, { value: parseInt(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., 20 or -15"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Positive to increase, negative to decrease
                  </p>
                </div>
              )}

              {action.type === 'send_notification' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={action.notificationEmail || ''}
                    onChange={(e) =>
                      handleUpdateAction(index, { notificationEmail: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="email@example.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave blank to use account default
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
