'use client';

import { useState } from 'react';
import type { AutomatedRule, RuleTemplate } from '@/types/rules';
import { RULE_TEMPLATES, getRuleDescription, getScheduleLabel } from '@/types/rules';

interface RulesListProps {
  rules: AutomatedRule[];
  isLoading: boolean;
  onToggle: (ruleId: string, enabled: boolean) => Promise<void>;
  onEdit: (rule: AutomatedRule) => void;
  onDelete: (ruleId: string) => Promise<void>;
  onUseTemplate: (template: RuleTemplate) => void;
}

export default function RulesList({
  rules,
  isLoading,
  onToggle,
  onEdit,
  onDelete,
  onUseTemplate,
}: RulesListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }
    setDeletingId(ruleId);
    try {
      await onDelete(ruleId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    setTogglingId(ruleId);
    try {
      await onToggle(ruleId, enabled);
    } finally {
      setTogglingId(null);
    }
  };

  const toggleExpand = (ruleId: string) => {
    setExpandedId(expandedId === ruleId ? null : ruleId);
  };

  const getStatusBadge = (rule: AutomatedRule) => {
    if (!rule.enabled) {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
          Paused
        </span>
      );
    }
    if (rule.status === 'error') {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Active
      </span>
    );
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      performance: 'bg-blue-100 text-blue-700',
      budget: 'bg-green-100 text-green-700',
      quality: 'bg-purple-100 text-purple-700',
      maintenance: 'bg-orange-100 text-orange-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Templates Section */}
      {showTemplates && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Quick Templates</h3>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Hide
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {RULE_TEMPLATES.slice(0, 4).map((template, i) => (
              <button
                key={i}
                onClick={() => onUseTemplate(template)}
                className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${getCategoryColor(template.category)}`}>
                    {template.category}
                  </span>
                  <svg className="ml-auto h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="font-medium text-gray-900 text-sm">{template.name}</div>
                <div className="text-xs text-gray-500">{template.description}</div>
              </button>
            ))}
          </div>
          {RULE_TEMPLATES.length > 4 && (
            <button
              onClick={() => {/* Could show all templates in a modal */}}
              className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View all {RULE_TEMPLATES.length} templates
            </button>
          )}
        </div>
      )}

      {/* Active Rules */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          Active Rules ({rules.length})
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-lg bg-gray-50 py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No automated rules</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a rule or using a template.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const isExpanded = expandedId === rule.id;
              const isDeleting = deletingId === rule.id;
              const isToggling = togglingId === rule.id;

              return (
                <div
                  key={rule.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    rule.enabled
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(rule)}
                        <span className="text-xs text-gray-500">
                          {rule.entityType === 'adGroup' ? 'Ad Group' : rule.entityType.charAt(0).toUpperCase() + rule.entityType.slice(1)}s
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{getScheduleLabel(rule.schedule)}</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{rule.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{getRuleDescription(rule)}</p>

                      {rule.lastRun && (
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Last run: {new Date(rule.lastRun).toLocaleString()}</span>
                          {rule.nextRun && (
                            <>
                              <span>•</span>
                              <span>Next run: {new Date(rule.nextRun).toLocaleString()}</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && rule.executionHistory && rule.executionHistory.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">Recent Executions</h5>
                          <div className="space-y-2">
                            {rule.executionHistory.slice(0, 3).map((execution) => (
                              <div key={execution.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">
                                  {new Date(execution.executedAt).toLocaleString()}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">
                                    {execution.entitiesActioned}/{execution.entitiesEvaluated} actioned
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                                      execution.status === 'success'
                                        ? 'bg-green-100 text-green-700'
                                        : execution.status === 'failed'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                    }`}
                                  >
                                    {execution.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => toggleExpand(rule.id)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-600"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      <button
                        onClick={() => onEdit(rule)}
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-100"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>

                      <button
                        onClick={() => handleToggle(rule.id, !rule.enabled)}
                        disabled={isToggling}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          rule.enabled
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        } disabled:opacity-50`}
                        title={rule.enabled ? 'Pause rule' : 'Enable rule'}
                      >
                        {isToggling ? '...' : rule.enabled ? 'Pause' : 'Enable'}
                      </button>

                      <button
                        onClick={() => handleDelete(rule.id)}
                        disabled={isDeleting}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Delete"
                      >
                        {isDeleting ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
