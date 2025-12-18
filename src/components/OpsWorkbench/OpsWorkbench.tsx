'use client';

import { useState, useMemo } from 'react';
import { useActionQueue } from '@/contexts/ActionQueueContext';
import { QueuedAction, RiskLevel as ActionRiskLevel } from '@/types/action-queue';

type ActionCategory = 'budget' | 'bidding' | 'targeting' | 'creative' | 'all';
type RiskFilterLevel = 'all' | 'low' | 'medium' | 'high';

interface ActionGroup {
  category: ActionCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  actions: QueuedAction[];
}

export default function OpsWorkbench() {
  const { actions, removeAction, clearAll, approveAll, executeApproved, pendingCount, isExecuting } = useActionQueue();
  const [activeCategory, setActiveCategory] = useState<ActionCategory>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilterLevel>('all');
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());

  // Categorize actions
  const categorizeAction = (action: QueuedAction): ActionCategory => {
    if (action.actionType.includes('budget')) return 'budget';
    if (action.actionType.includes('bid')) return 'bidding';
    if (action.actionType.includes('negative') || action.actionType.includes('keyword')) return 'targeting';
    if (action.actionType.includes('ad') || action.actionType.includes('creative')) return 'creative';
    return 'budget'; // default
  };

  // Get risk level for action (use the action's riskLevel or derive from type)
  const getActionRisk = (action: QueuedAction): ActionRiskLevel => {
    // Use the pre-calculated risk level if available
    if (action.riskLevel) return action.riskLevel;
    // Fallback logic
    if (action.actionType.includes('pause')) return 'high';
    if (action.actionType.includes('budget')) return 'medium';
    return 'low';
  };

  // Group actions by category
  const actionGroups = useMemo((): ActionGroup[] => {
    const groups: Record<ActionCategory, QueuedAction[]> = {
      budget: [],
      bidding: [],
      targeting: [],
      creative: [],
      all: [],
    };

    actions.forEach(action => {
      if (action.status === 'pending') {
        const category = categorizeAction(action);
        const risk = getActionRisk(action);

        if (riskFilter === 'all' || riskFilter === risk) {
          groups[category].push(action);
          groups.all.push(action);
        }
      }
    });

    return [
      {
        category: 'all',
        label: 'All Actions',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        ),
        color: 'slate',
        actions: groups.all,
      },
      {
        category: 'budget',
        label: 'Budget',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: 'emerald',
        actions: groups.budget,
      },
      {
        category: 'bidding',
        label: 'Bidding',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
        color: 'purple',
        actions: groups.bidding,
      },
      {
        category: 'targeting',
        label: 'Targeting',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        color: 'blue',
        actions: groups.targeting,
      },
      {
        category: 'creative',
        label: 'Creative',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
        color: 'amber',
        actions: groups.creative,
      },
    ];
  }, [actions, riskFilter]);

  const activeGroup = actionGroups.find(g => g.category === activeCategory) || actionGroups[0];

  const toggleSelectAction = (actionId: string) => {
    const newSelected = new Set(selectedActions);
    if (newSelected.has(actionId)) {
      newSelected.delete(actionId);
    } else {
      newSelected.add(actionId);
    }
    setSelectedActions(newSelected);
  };

  const selectAll = () => {
    const allIds = activeGroup.actions.map(a => a.id);
    setSelectedActions(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedActions(new Set());
  };

  const removeSelected = () => {
    selectedActions.forEach(id => removeAction(id));
    setSelectedActions(new Set());
  };

  const riskColors = {
    low: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    medium: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    high: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
  };

  const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
    slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ops Workbench</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Review and apply AI-recommended changes
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Risk Filter */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {(['all', 'low', 'medium', 'high'] as RiskFilterLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setRiskFilter(level)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    riskFilter === level
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {level === 'all' ? 'All Risk' : `${level.charAt(0).toUpperCase() + level.slice(1)} Risk`}
                </button>
              ))}
            </div>

            {/* Execute All */}
            <button
              onClick={() => {
                approveAll();
                executeApproved();
              }}
              disabled={pendingCount === 0 || isExecuting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              {isExecuting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Executing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Execute All ({pendingCount})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Category Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-4 space-y-2">
          {actionGroups.map((group) => {
            const colors = categoryColors[group.color];
            const isActive = activeCategory === group.category;

            return (
              <button
                key={group.category}
                onClick={() => setActiveCategory(group.category)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? `${colors.bg} ${colors.text} ring-1 ${colors.border.replace('border', 'ring')}`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? colors.text : 'text-gray-400'}>{group.icon}</span>
                  <span className="font-medium">{group.label}</span>
                </div>
                {group.actions.length > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    isActive ? 'bg-white/50 text-current' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {group.actions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Actions List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Bulk Actions Bar */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={selectedActions.size === activeGroup.actions.length ? deselectAll : selectAll}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <input
                  type="checkbox"
                  checked={selectedActions.size === activeGroup.actions.length && activeGroup.actions.length > 0}
                  onChange={() => {}}
                  className="w-4 h-4 rounded border-gray-300"
                />
                Select All
              </button>
              {selectedActions.size > 0 && (
                <span className="text-sm text-gray-500">
                  {selectedActions.size} selected
                </span>
              )}
            </div>
            {selectedActions.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={removeSelected}
                  className="px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Remove Selected
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex-1 overflow-auto p-6">
            {activeGroup.actions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No pending actions</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  {riskFilter !== 'all'
                    ? `No ${riskFilter} risk actions in this category. Try adjusting your filters.`
                    : 'Use Quick Fix or AI recommendations to add actions to your queue.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeGroup.actions.map((action) => {
                  const risk = getActionRisk(action);
                  const riskColor = riskColors[risk];
                  const isSelected = selectedActions.has(action.id);

                  return (
                    <div
                      key={action.id}
                      className={`bg-white rounded-xl border transition-all ${
                        isSelected ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectAction(action.id)}
                            className="w-4 h-4 mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900">{action.entityName}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-sm text-gray-500 capitalize">{action.entityType}</span>
                              <span className={`ml-auto px-2 py-0.5 text-xs font-medium rounded ${riskColor.bg} ${riskColor.text}`}>
                                {risk} risk
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-500">{action.currentValue}</span>
                              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <span className="font-medium text-indigo-600">{action.newValue}</span>
                            </div>
                            {action.reason && (
                              <p className="text-xs text-gray-500 mt-2">{action.reason}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeAction(action.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
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

        {/* Impact Summary Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Impact Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <span className="text-sm text-emerald-700">Projected Savings</span>
                <span className="text-lg font-bold text-emerald-700">$1,240/mo</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-700">CPA Improvement</span>
                <span className="text-lg font-bold text-blue-700">-18%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <span className="text-sm text-purple-700">Volume Impact</span>
                <span className="text-lg font-bold text-purple-700">+12%</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Risk Distribution</h3>
            <div className="space-y-2">
              {(['low', 'medium', 'high'] as ActionRiskLevel[]).map((risk) => {
                const count = actions.filter(a => a.status === 'pending' && getActionRisk(a) === risk).length;
                const total = pendingCount || 1;
                const percent = Math.round((count / total) * 100);

                return (
                  <div key={risk} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${riskColors[risk].dot}`} />
                    <span className="text-sm text-gray-600 capitalize flex-1">{risk}</span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${riskColors[risk].dot}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={clearAll}
              disabled={pendingCount === 0}
              className="w-full px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50 rounded-lg transition-colors"
            >
              Clear All Actions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
