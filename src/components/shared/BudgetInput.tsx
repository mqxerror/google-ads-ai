'use client';

import React from 'react';

interface BudgetInputProps {
  dailyBudget: number;
  onChange: (budget: number) => void;
  currency?: string;
  showMonthlyEstimate?: boolean;
  minBudget?: number;
  maxBudget?: number;
  label?: string;
  helperText?: string;
  className?: string;
}

/**
 * Reusable budget input component with daily/monthly estimates
 * Use in: Search, PMax, Display, Demand Gen, Video campaigns
 */
export function BudgetInput({
  dailyBudget,
  onChange,
  currency = '$',
  showMonthlyEstimate = true,
  minBudget = 1,
  maxBudget = 10000,
  label = 'Daily Budget',
  helperText,
  className = '',
}: BudgetInputProps) {
  const monthlyEstimate = dailyBudget * 30.4; // Average days per month

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-text mb-2">
        {label} *
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text3">
          {currency}
        </span>
        <input
          type="number"
          value={dailyBudget}
          onChange={(e) => {
            const value = parseFloat(e.target.value) || 0;
            onChange(Math.max(minBudget, Math.min(maxBudget, value)));
          }}
          min={minBudget}
          max={maxBudget}
          step="1"
          className="w-full pl-8 pr-4 py-3 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
        />
      </div>

      {/* Estimates and helper text */}
      <div className="mt-2 space-y-1">
        {showMonthlyEstimate && (
          <p className="text-sm text-text3">
            Monthly estimate: <span className="font-medium text-text">{currency}{monthlyEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </p>
        )}
        {helperText && (
          <p className="text-xs text-text3">{helperText}</p>
        )}
      </div>

      {/* Budget recommendation */}
      {dailyBudget < 10 && (
        <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded text-xs text-warning">
          Low budget may limit campaign reach. Consider {currency}10+ daily for better results.
        </div>
      )}
    </div>
  );
}

export default BudgetInput;
