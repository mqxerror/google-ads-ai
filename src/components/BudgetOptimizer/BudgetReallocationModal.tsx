'use client';

import { useState, useMemo } from 'react';
import { Campaign } from '@/types/campaign';
import { useActionQueue } from '@/contexts/ActionQueueContext';

interface BudgetReallocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
}

interface BudgetShift {
  id: string;
  campaignId: string;
  campaignName: string;
  currentBudget: number;
  suggestedBudget: number;
  change: number;
  changePercent: number;
  reason: string;
  aiScore: number;
  conversions: number;
  cpa: number;
  included: boolean;
}

// Calculate AI-suggested budget shifts
function calculateBudgetShifts(campaigns: Campaign[]): BudgetShift[] {
  const enabledCampaigns = campaigns.filter(c => c.status === 'ENABLED' && c.budget && c.budget > 0);

  if (enabledCampaigns.length < 2) return [];

  // Calculate performance scores
  const withScores = enabledCampaigns.map(c => ({
    ...c,
    performanceScore: c.conversions > 0
      ? (c.conversions * 100) / (c.cpa || 1) * (c.aiScore / 100)
      : c.aiScore * 0.1,
  }));

  // Sort by performance
  const sorted = [...withScores].sort((a, b) => b.performanceScore - a.performanceScore);

  // Top performers get budget increase, bottom performers get decrease
  const topCount = Math.ceil(sorted.length * 0.3);
  const bottomCount = Math.ceil(sorted.length * 0.3);

  const shifts: BudgetShift[] = [];

  // Calculate total reallocation pool (take 15% from bottom performers)
  const bottomPerformers = sorted.slice(-bottomCount);
  const reallocationPool = bottomPerformers.reduce((sum, c) => sum + (c.budget || 0) * 0.15, 0);

  // Distribute pool to top performers proportionally
  const topPerformers = sorted.slice(0, topCount);
  const topTotalBudget = topPerformers.reduce((sum, c) => sum + (c.budget || 0), 0);

  // Create shifts for top performers (increase)
  topPerformers.forEach(campaign => {
    const currentBudget = campaign.budget || 0;
    const budgetShare = currentBudget / topTotalBudget;
    const increase = reallocationPool * budgetShare;
    const suggestedBudget = currentBudget + increase;

    shifts.push({
      id: `shift-${campaign.id}`,
      campaignId: campaign.id,
      campaignName: campaign.name,
      currentBudget,
      suggestedBudget,
      change: increase,
      changePercent: (increase / currentBudget) * 100,
      reason: campaign.conversions > 0
        ? `High performer: ${campaign.conversions} conversions at $${campaign.cpa?.toFixed(2) || 0} CPA`
        : `Strong AI score: ${campaign.aiScore}/100`,
      aiScore: campaign.aiScore,
      conversions: campaign.conversions,
      cpa: campaign.cpa || 0,
      included: true,
    });
  });

  // Create shifts for bottom performers (decrease)
  bottomPerformers.forEach(campaign => {
    const currentBudget = campaign.budget || 0;
    const decrease = currentBudget * 0.15;
    const suggestedBudget = currentBudget - decrease;

    shifts.push({
      id: `shift-${campaign.id}`,
      campaignId: campaign.id,
      campaignName: campaign.name,
      currentBudget,
      suggestedBudget,
      change: -decrease,
      changePercent: -15,
      reason: campaign.conversions === 0
        ? 'No conversions - reduce exposure'
        : campaign.aiScore < 50
          ? `Low AI score: ${campaign.aiScore}/100`
          : `High CPA: $${campaign.cpa?.toFixed(2) || 0}`,
      aiScore: campaign.aiScore,
      conversions: campaign.conversions,
      cpa: campaign.cpa || 0,
      included: true,
    });
  });

  return shifts.sort((a, b) => b.change - a.change);
}

export default function BudgetReallocationModal({
  isOpen,
  onClose,
  campaigns,
}: BudgetReallocationModalProps) {
  const { addAction } = useActionQueue();
  const [isApplying, setIsApplying] = useState(false);
  const [shifts, setShifts] = useState<BudgetShift[]>(() => calculateBudgetShifts(campaigns));

  // Recalculate when campaigns change
  useMemo(() => {
    setShifts(calculateBudgetShifts(campaigns));
  }, [campaigns]);

  const toggleShift = (id: string) => {
    setShifts(prev =>
      prev.map(shift =>
        shift.id === id ? { ...shift, included: !shift.included } : shift
      )
    );
  };

  const includedShifts = shifts.filter(s => s.included);
  const totalIncrease = includedShifts.filter(s => s.change > 0).reduce((sum, s) => sum + s.change, 0);
  const totalDecrease = includedShifts.filter(s => s.change < 0).reduce((sum, s) => sum + Math.abs(s.change), 0);
  const netChange = totalIncrease - totalDecrease;

  const handleApply = () => {
    setIsApplying(true);

    includedShifts.forEach(shift => {
      addAction({
        actionType: 'update_budget',
        entityType: 'campaign',
        entityId: shift.campaignId,
        entityName: shift.campaignName,
        currentValue: `$${shift.currentBudget.toFixed(2)}`,
        newValue: `$${shift.suggestedBudget.toFixed(2)}`,
        reason: shift.reason,
      });
    });

    setIsApplying(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--surface)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--divider)] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[var(--text)]">
                Budget Reallocation
              </h2>
              <p className="text-[13px] text-[var(--text2)] mt-0.5">
                AI-suggested budget shifts across campaigns
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface2)] text-[var(--text2)]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-6 py-4 border-b border-[var(--divider)] flex-shrink-0">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--success)]/10 rounded-xl p-4">
              <div className="text-[11px] text-[var(--success)] font-medium uppercase tracking-wide mb-1">
                Increase
              </div>
              <div className="text-[20px] font-semibold text-[var(--success)] tabular-nums">
                +${totalIncrease.toFixed(0)}
              </div>
              <div className="text-[11px] text-[var(--text3)]">
                {includedShifts.filter(s => s.change > 0).length} campaigns
              </div>
            </div>
            <div className="bg-[var(--danger)]/10 rounded-xl p-4">
              <div className="text-[11px] text-[var(--danger)] font-medium uppercase tracking-wide mb-1">
                Decrease
              </div>
              <div className="text-[20px] font-semibold text-[var(--danger)] tabular-nums">
                -${totalDecrease.toFixed(0)}
              </div>
              <div className="text-[11px] text-[var(--text3)]">
                {includedShifts.filter(s => s.change < 0).length} campaigns
              </div>
            </div>
            <div className="bg-[var(--surface2)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--text3)] font-medium uppercase tracking-wide mb-1">
                Net Change
              </div>
              <div className={`text-[20px] font-semibold tabular-nums ${
                netChange >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
              }`}>
                {netChange >= 0 ? '+' : '-'}${Math.abs(netChange).toFixed(0)}
              </div>
              <div className="text-[11px] text-[var(--text3)]">
                daily budget
              </div>
            </div>
          </div>
        </div>

        {/* Shifts List */}
        <div className="flex-1 overflow-y-auto">
          {shifts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--surface2)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-[15px] font-medium text-[var(--text)] mb-1">
                No Reallocation Suggestions
              </h3>
              <p className="text-[13px] text-[var(--text3)]">
                Need at least 2 active campaigns with budgets to suggest shifts
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--divider)]">
              {/* Increases section */}
              {shifts.filter(s => s.change > 0).length > 0 && (
                <div className="px-6 py-3">
                  <h4 className="text-[11px] font-semibold text-[var(--success)] uppercase tracking-wide mb-2">
                    Increase Budget ({shifts.filter(s => s.change > 0).length})
                  </h4>
                  <div className="space-y-2">
                    {shifts.filter(s => s.change > 0).map(shift => (
                      <ShiftRow key={shift.id} shift={shift} onToggle={toggleShift} />
                    ))}
                  </div>
                </div>
              )}

              {/* Decreases section */}
              {shifts.filter(s => s.change < 0).length > 0 && (
                <div className="px-6 py-3">
                  <h4 className="text-[11px] font-semibold text-[var(--danger)] uppercase tracking-wide mb-2">
                    Decrease Budget ({shifts.filter(s => s.change < 0).length})
                  </h4>
                  <div className="space-y-2">
                    {shifts.filter(s => s.change < 0).map(shift => (
                      <ShiftRow key={shift.id} shift={shift} onToggle={toggleShift} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--divider)] bg-[var(--surface)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-10 px-4 bg-[var(--surface2)] text-[var(--text)] text-[14px] font-medium rounded-xl hover:bg-[var(--surface3)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || includedShifts.length === 0}
              className="flex-1 h-10 px-4 bg-[var(--accent)] text-white text-[14px] font-medium rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isApplying ? 'Adding...' : `Add ${includedShifts.length} Changes to Queue`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual shift row component
function ShiftRow({
  shift,
  onToggle,
}: {
  shift: BudgetShift;
  onToggle: (id: string) => void;
}) {
  const isIncrease = shift.change > 0;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
        shift.included
          ? isIncrease
            ? 'bg-[var(--success)]/5 border border-[var(--success)]/20'
            : 'bg-[var(--danger)]/5 border border-[var(--danger)]/20'
          : 'bg-[var(--surface2)] opacity-50'
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={shift.included}
        onChange={() => onToggle(shift.id)}
        className="w-4 h-4 rounded border-[var(--divider)] text-[var(--accent)] flex-shrink-0"
      />

      {/* Campaign info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--text)] truncate">
            {shift.campaignName}
          </span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
            shift.aiScore >= 70
              ? 'bg-[var(--success)]/10 text-[var(--success)]'
              : shift.aiScore >= 40
                ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                : 'bg-[var(--danger)]/10 text-[var(--danger)]'
          }`}>
            {shift.aiScore}
          </span>
        </div>
        <p className="text-[11px] text-[var(--text3)] mt-0.5">
          {shift.reason}
        </p>
      </div>

      {/* Budget change */}
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-2 justify-end">
          <span className="text-[12px] text-[var(--text3)] tabular-nums">
            ${shift.currentBudget.toFixed(0)}
          </span>
          <svg className="w-3 h-3 text-[var(--text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span className={`text-[13px] font-semibold tabular-nums ${
            isIncrease ? 'text-[var(--success)]' : 'text-[var(--danger)]'
          }`}>
            ${shift.suggestedBudget.toFixed(0)}
          </span>
        </div>
        <div className={`text-[11px] mt-0.5 ${
          isIncrease ? 'text-[var(--success)]' : 'text-[var(--danger)]'
        }`}>
          {isIncrease ? '+' : ''}{shift.changePercent.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
