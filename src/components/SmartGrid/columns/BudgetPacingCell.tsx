'use client';

import { BudgetPacing, BudgetPacingStatus } from '@/types/health';

interface BudgetPacingCellProps {
  pacing: BudgetPacing;
  showDetails?: boolean;
}

function getStatusConfig(status: BudgetPacingStatus) {
  switch (status) {
    case 'on_track':
      return {
        label: 'On Track',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
        barColor: 'bg-emerald-500',
        icon: (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
      };
    case 'overspend':
      return {
        label: 'Overspending',
        color: 'text-rose-600',
        bgColor: 'bg-rose-100',
        barColor: 'bg-rose-500',
        icon: (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        ),
      };
    case 'underspend':
      return {
        label: 'Underspending',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
        barColor: 'bg-amber-500',
        icon: (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        ),
      };
    case 'limited':
      return {
        label: 'Limited',
        color: 'text-slate-600',
        bgColor: 'bg-slate-100',
        barColor: 'bg-slate-400',
        icon: (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      };
  }
}

export default function BudgetPacingCell({ pacing, showDetails = false }: BudgetPacingCellProps) {
  const config = getStatusConfig(pacing.status);
  const percentUsed = Math.min(pacing.percentUsed, 100);
  const isOverBudget = pacing.percentUsed > 100;

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="min-w-[100px]">
      {/* Status Badge */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={config.color}>{config.icon}</span>
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${config.barColor}`}
          style={{ width: `${percentUsed}%` }}
        />
      </div>

      {/* Details */}
      {showDetails && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
          <span className="tabular-nums">
            {formatCurrency(pacing.projectedSpend)} / {formatCurrency(pacing.budget)}
          </span>
          {pacing.daysRemaining > 0 && (
            <span>{pacing.daysRemaining}d left</span>
          )}
        </div>
      )}

      {/* Recommendation */}
      {pacing.recommendation && showDetails && (
        <p className="mt-1 text-[10px] text-slate-500 italic truncate" title={pacing.recommendation}>
          {pacing.recommendation}
        </p>
      )}
    </div>
  );
}

// Compact version for table cells
export function BudgetPacingBadge({ pacing }: { pacing: BudgetPacing }) {
  const config = getStatusConfig(pacing.status);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}
      title={`${pacing.percentUsed.toFixed(0)}% used${pacing.recommendation ? ` - ${pacing.recommendation}` : ''}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// Mini version for very compact spaces
export function BudgetPacingDot({ status }: { status: BudgetPacingStatus }) {
  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${config.barColor}`}
      title={config.label}
    />
  );
}
