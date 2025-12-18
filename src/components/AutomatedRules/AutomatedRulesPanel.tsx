'use client';

import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';

interface AutomatedRule {
  id: string;
  name: string;
  enabled: boolean;
  entityType: 'campaign' | 'adGroup' | 'keyword';
  condition: {
    metric: string;
    operator: 'greater_than' | 'less_than' | 'equals';
    value: number;
    period: string;
  };
  action: {
    type: 'pause' | 'enable' | 'adjust_budget' | 'adjust_bid';
    value?: number;
  };
  lastRun?: string;
  nextRun?: string;
}

interface AutomatedRulesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const RULE_TEMPLATES = [
  {
    name: 'Pause low-performing keywords',
    entityType: 'keyword' as const,
    condition: { metric: 'cpa', operator: 'greater_than' as const, value: 50, period: '7d' },
    action: { type: 'pause' as const },
  },
  {
    name: 'Pause campaigns with no conversions',
    entityType: 'campaign' as const,
    condition: { metric: 'conversions', operator: 'equals' as const, value: 0, period: '14d' },
    action: { type: 'pause' as const },
  },
  {
    name: 'Increase budget for high ROAS campaigns',
    entityType: 'campaign' as const,
    condition: { metric: 'roas', operator: 'greater_than' as const, value: 4, period: '7d' },
    action: { type: 'adjust_budget' as const, value: 20 },
  },
  {
    name: 'Decrease budget for low CTR campaigns',
    entityType: 'campaign' as const,
    condition: { metric: 'ctr', operator: 'less_than' as const, value: 1, period: '7d' },
    action: { type: 'adjust_budget' as const, value: -15 },
  },
];

export default function AutomatedRulesPanel({ isOpen, onClose }: AutomatedRulesPanelProps) {
  const { currentAccount } = useAccount();
  const [rules, setRules] = useState<AutomatedRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New rule form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRule, setNewRule] = useState<Omit<AutomatedRule, 'id' | 'lastRun' | 'nextRun'>>({
    name: '',
    enabled: true,
    entityType: 'campaign',
    condition: { metric: 'cpa', operator: 'greater_than', value: 0, period: '7d' },
    action: { type: 'pause' },
  });

  useEffect(() => {
    if (!isOpen || !currentAccount?.id) return;
    loadRules();
  }, [isOpen, currentAccount?.id]);

  const loadRules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/automated-rules?accountId=${currentAccount?.id}`);
      if (!response.ok) {
        throw new Error('Failed to load rules');
      }
      const data = await response.json();
      setRules(data.rules || []);
    } catch (err) {
      console.error('Error loading rules:', err);
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!newRule.name.trim()) {
      setError('Please enter a rule name');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/automated-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount?.id,
          rule: newRule,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create rule');
      }

      const data = await response.json();
      setRules([...rules, data.rule]);
      setShowCreateForm(false);
      setNewRule({
        name: '',
        enabled: true,
        entityType: 'campaign',
        condition: { metric: 'cpa', operator: 'greater_than', value: 0, period: '7d' },
        action: { type: 'pause' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/automated-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount?.id,
          ruleId,
          updates: { enabled },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update rule');
      }

      setRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/automated-rules?accountId=${currentAccount?.id}&ruleId=${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete rule');
      }

      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const applyTemplate = (template: typeof RULE_TEMPLATES[0]) => {
    setNewRule({
      name: template.name,
      enabled: true,
      entityType: template.entityType,
      condition: template.condition,
      action: template.action,
    });
    setShowCreateForm(true);
  };

  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      cpa: 'CPA',
      roas: 'ROAS',
      ctr: 'CTR',
      clicks: 'Clicks',
      conversions: 'Conversions',
      spend: 'Spend',
      impressions: 'Impressions',
    };
    return labels[metric] || metric;
  };

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      greater_than: '>',
      less_than: '<',
      equals: '=',
    };
    return labels[operator] || operator;
  };

  const getActionLabel = (action: AutomatedRule['action']) => {
    switch (action.type) {
      case 'pause': return 'Pause';
      case 'enable': return 'Enable';
      case 'adjust_budget': return `${action.value! > 0 ? 'Increase' : 'Decrease'} budget by ${Math.abs(action.value!)}%`;
      case 'adjust_bid': return `${action.value! > 0 ? 'Increase' : 'Decrease'} bid by ${Math.abs(action.value!)}%`;
      default: return 'Unknown action';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Automated Rules</h2>
            <p className="mt-1 text-sm text-gray-500">
              Set up rules to automatically optimize your campaigns
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Create New Rule Button */}
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="mb-6 w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600"
            >
              + Create New Rule
            </button>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-4 font-medium text-gray-900">Create New Rule</h3>

              {/* Rule Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Enter rule name..."
                />
              </div>

              {/* Entity Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Apply To</label>
                <select
                  value={newRule.entityType}
                  onChange={(e) => setNewRule({ ...newRule, entityType: e.target.value as AutomatedRule['entityType'] })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="campaign">Campaigns</option>
                  <option value="adGroup">Ad Groups</option>
                  <option value="keyword">Keywords</option>
                </select>
              </div>

              {/* Condition */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">When</label>
                <div className="flex gap-2">
                  <select
                    value={newRule.condition.metric}
                    onChange={(e) => setNewRule({ ...newRule, condition: { ...newRule.condition, metric: e.target.value } })}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="cpa">CPA</option>
                    <option value="roas">ROAS</option>
                    <option value="ctr">CTR (%)</option>
                    <option value="clicks">Clicks</option>
                    <option value="conversions">Conversions</option>
                    <option value="spend">Spend ($)</option>
                  </select>
                  <select
                    value={newRule.condition.operator}
                    onChange={(e) => setNewRule({ ...newRule, condition: { ...newRule.condition, operator: e.target.value as typeof newRule.condition.operator } })}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="greater_than">&gt;</option>
                    <option value="less_than">&lt;</option>
                    <option value="equals">=</option>
                  </select>
                  <input
                    type="number"
                    value={newRule.condition.value}
                    onChange={(e) => setNewRule({ ...newRule, condition: { ...newRule.condition, value: parseFloat(e.target.value) || 0 } })}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="mt-2">
                  <select
                    value={newRule.condition.period}
                    onChange={(e) => setNewRule({ ...newRule, condition: { ...newRule.condition, period: e.target.value } })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="1d">Last 1 day</option>
                    <option value="7d">Last 7 days</option>
                    <option value="14d">Last 14 days</option>
                    <option value="30d">Last 30 days</option>
                  </select>
                </div>
              </div>

              {/* Action */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Then</label>
                <div className="flex gap-2">
                  <select
                    value={newRule.action.type}
                    onChange={(e) => {
                      const type = e.target.value as AutomatedRule['action']['type'];
                      setNewRule({
                        ...newRule,
                        action: type === 'pause' || type === 'enable'
                          ? { type }
                          : { type, value: 10 }
                      });
                    }}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="pause">Pause</option>
                    <option value="enable">Enable</option>
                    <option value="adjust_budget">Adjust Budget</option>
                    <option value="adjust_bid">Adjust Bid</option>
                  </select>
                  {(newRule.action.type === 'adjust_budget' || newRule.action.type === 'adjust_bid') && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={newRule.action.value || 0}
                        onChange={(e) => setNewRule({ ...newRule, action: { ...newRule.action, value: parseInt(e.target.value) || 0 } })}
                        className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRule}
                  disabled={isCreating}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Rule'}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Quick Templates */}
          {!showCreateForm && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Quick Templates</h3>
              <div className="grid gap-2">
                {RULE_TEMPLATES.map((template, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(template)}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-900">{template.name}</span>
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Existing Rules */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">Active Rules</h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-lg bg-gray-50 py-8 text-center">
                <p className="text-sm text-gray-500">No automated rules yet</p>
                <p className="mt-1 text-xs text-gray-400">Create your first rule above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`rounded-lg border p-4 ${rule.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-2 w-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span className="font-medium text-gray-900">{rule.name}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          When {rule.entityType} {getMetricLabel(rule.condition.metric)} {getOperatorLabel(rule.condition.operator)} {rule.condition.value} ({rule.condition.period}), {getActionLabel(rule.action)}
                        </p>
                        {rule.lastRun && (
                          <p className="mt-1 text-xs text-gray-400">
                            Last run: {new Date(rule.lastRun).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                          className={`rounded-lg px-3 py-1 text-xs font-medium ${
                            rule.enabled
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {rule.enabled ? 'Pause' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
