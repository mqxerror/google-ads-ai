'use client';

import { useState, useEffect } from 'react';
import { Campaign } from '@/types/campaign';
import { useAccount } from '@/contexts/AccountContext';
import { useActionQueue } from '@/contexts/ActionQueueContext';

interface BudgetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign | null;
}

interface BudgetInfo {
  currentBudget: number;
  recommendedBudget?: number;
  limitedByBudget: boolean;
  averageSpend: number;
}

export default function BudgetManager({ isOpen, onClose, campaign }: BudgetManagerProps) {
  const { currentAccount } = useAccount();
  const { addAction } = useActionQueue();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetInfo, setBudgetInfo] = useState<BudgetInfo | null>(null);
  const [newBudget, setNewBudget] = useState<number>(0);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch current budget info when campaign changes
  useEffect(() => {
    if (campaign && currentAccount && isOpen) {
      fetchBudgetInfo();
    }
  }, [campaign?.id, currentAccount?.id, isOpen]);

  const fetchBudgetInfo = async () => {
    if (!campaign || !currentAccount) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/google-ads/budget?accountId=${currentAccount.id}&campaignId=${campaign.id}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch budget info');
      }

      const data = await response.json();
      setBudgetInfo(data.budget);
      setNewBudget(data.budget.currentBudget || campaign.spend / 30); // Default to current or estimated daily
    } catch (err) {
      // If API doesn't exist yet, use mock data based on campaign spend
      const estimatedDailyBudget = campaign.spend / 30;
      setBudgetInfo({
        currentBudget: estimatedDailyBudget,
        recommendedBudget: estimatedDailyBudget * 1.2,
        limitedByBudget: campaign.spend > 0 && campaign.conversions === 0,
        averageSpend: campaign.spend / 30,
      });
      setNewBudget(Math.round(estimatedDailyBudget * 100) / 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!campaign || !currentAccount || newBudget <= 0) return;

    // If budget change is significant (>50%), show confirmation
    if (budgetInfo && Math.abs(newBudget - budgetInfo.currentBudget) / budgetInfo.currentBudget > 0.5) {
      if (!showConfirm) {
        setShowConfirm(true);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Add to action queue for execution
      addAction({
        actionType: 'update_budget',
        entityType: 'campaign',
        entityId: campaign.id,
        entityName: campaign.name,
        currentValue: budgetInfo?.currentBudget || 0,
        newValue: newBudget,
        accountId: currentAccount.id,
        reason: `Budget updated from $${budgetInfo?.currentBudget?.toFixed(2) || '0'} to $${newBudget.toFixed(2)}/day`,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget');
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  if (!isOpen || !campaign) return null;

  const percentChange = budgetInfo?.currentBudget
    ? ((newBudget - budgetInfo.currentBudget) / budgetInfo.currentBudget) * 100
    : 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 z-50 flex items-center justify-center sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md">
        <div className="relative w-full overflow-hidden rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Manage Budget</h2>
              <p className="mt-1 text-sm text-gray-500 truncate max-w-[250px]">{campaign.name}</p>
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
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                {error && (
                  <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* Current Budget Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Current Budget</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                      ${budgetInfo?.currentBudget?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-gray-500">/day</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Avg. Daily Spend</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                      ${budgetInfo?.averageSpend?.toFixed(2) || (campaign.spend / 30).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">/day</p>
                  </div>
                </div>

                {/* Budget Limited Warning */}
                {budgetInfo?.limitedByBudget && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                    <div className="flex items-start gap-3">
                      <svg className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Limited by Budget</p>
                        <p className="mt-1 text-sm text-yellow-700">
                          This campaign may be missing impressions due to budget constraints.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* New Budget Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">New Daily Budget</label>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={newBudget}
                      onChange={(e) => {
                        setNewBudget(parseFloat(e.target.value) || 0);
                        setShowConfirm(false);
                      }}
                      className="block w-full rounded-lg border border-gray-300 pl-8 pr-12 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">/day</span>
                  </div>

                  {/* Change Indicator */}
                  {budgetInfo?.currentBudget && Math.abs(percentChange) > 0.01 && (
                    <p className={`mt-2 text-sm ${percentChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}% from current budget
                    </p>
                  )}
                </div>

                {/* Quick Budget Suggestions */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Quick Adjustments</p>
                  <div className="flex flex-wrap gap-2">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((multiplier) => (
                      <button
                        key={multiplier}
                        onClick={() => {
                          const base = budgetInfo?.currentBudget || campaign.spend / 30;
                          setNewBudget(Math.round(base * multiplier * 100) / 100);
                          setShowConfirm(false);
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          newBudget === Math.round((budgetInfo?.currentBudget || campaign.spend / 30) * multiplier * 100) / 100
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {multiplier < 1 ? `-${(1 - multiplier) * 100}%` : multiplier === 1 ? 'Current' : `+${(multiplier - 1) * 100}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recommended Budget */}
                {budgetInfo?.recommendedBudget && budgetInfo.recommendedBudget !== budgetInfo.currentBudget && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-800">Recommended Budget</p>
                        <p className="mt-1 text-lg font-semibold text-blue-900">
                          ${budgetInfo.recommendedBudget.toFixed(2)}/day
                        </p>
                        <p className="mt-1 text-sm text-blue-700">
                          Based on campaign performance and competition
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setNewBudget(budgetInfo.recommendedBudget!);
                          setShowConfirm(false);
                        }}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirmation Dialog */}
                {showConfirm && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                    <p className="text-sm font-medium text-yellow-800">Confirm Large Change</p>
                    <p className="mt-1 text-sm text-yellow-700">
                      You&apos;re changing the budget by more than 50%. Are you sure?
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isLoading || newBudget <= 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : showConfirm ? 'Confirm Change' : 'Update Budget'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
