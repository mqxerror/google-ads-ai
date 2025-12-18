'use client';

import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import RuleBuilder from './RuleBuilder';
import RulesList from './RulesList';
import type { AutomatedRule, RuleTemplate, RULE_TEMPLATES } from '@/types/rules';

interface RulesPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function RulesPanel({ isOpen = true, onClose }: RulesPanelProps) {
  const { currentAccount } = useAccount();
  const [rules, setRules] = useState<AutomatedRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomatedRule | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);

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

  const handleCreateRule = async (rule: Omit<AutomatedRule, 'id' | 'accountId' | 'createdAt' | 'updatedAt'>) => {
    setError(null);
    try {
      const response = await fetch('/api/automated-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount?.id,
          rule,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create rule');
      }

      const data = await response.json();
      setRules([...rules, data.rule]);
      setShowBuilder(false);
      setSelectedTemplate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
      throw err;
    }
  };

  const handleUpdateRule = async (ruleId: string, updates: Partial<AutomatedRule>) => {
    setError(null);
    try {
      const response = await fetch('/api/automated-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount?.id,
          ruleId,
          updates,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update rule');
      }

      const data = await response.json();
      setRules(rules.map(r => r.id === ruleId ? data.rule : r));
      setEditingRule(null);
      setShowBuilder(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
      throw err;
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setError(null);
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

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    await handleUpdateRule(ruleId, { enabled });
  };

  const handleEditRule = (rule: AutomatedRule) => {
    setEditingRule(rule);
    setShowBuilder(true);
  };

  const handleUseTemplate = (template: RuleTemplate) => {
    setSelectedTemplate(template);
    setShowBuilder(true);
  };

  const handleCloseBuilder = () => {
    setShowBuilder(false);
    setEditingRule(null);
    setSelectedTemplate(null);
  };

  if (!isOpen) return null;

  // Check if being used as standalone page (no onClose) or as modal panel
  const isStandalone = !onClose;

  // Standalone page content (no modal wrapper)
  if (isStandalone) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {showBuilder ? (
            <RuleBuilder
              rule={editingRule}
              template={selectedTemplate}
              onSave={editingRule ? (rule) => handleUpdateRule(editingRule.id, rule) : handleCreateRule}
              onCancel={handleCloseBuilder}
            />
          ) : (
            <>
              {/* Create Button */}
              <button
                onClick={() => setShowBuilder(true)}
                className="mb-6 w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Create New Rule
              </button>

              {/* Rules List */}
              <RulesList
                rules={rules}
                isLoading={isLoading}
                onToggle={handleToggleRule}
                onEdit={handleEditRule}
                onDelete={handleDeleteRule}
                onUseTemplate={handleUseTemplate}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // Modal panel version
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl overflow-y-auto bg-white shadow-2xl">
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

          {showBuilder ? (
            <RuleBuilder
              rule={editingRule}
              template={selectedTemplate}
              onSave={editingRule ? (rule) => handleUpdateRule(editingRule.id, rule) : handleCreateRule}
              onCancel={handleCloseBuilder}
            />
          ) : (
            <>
              {/* Create Button */}
              <button
                onClick={() => setShowBuilder(true)}
                className="mb-6 w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Create New Rule
              </button>

              {/* Rules List */}
              <RulesList
                rules={rules}
                isLoading={isLoading}
                onToggle={handleToggleRule}
                onEdit={handleEditRule}
                onDelete={handleDeleteRule}
                onUseTemplate={handleUseTemplate}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
