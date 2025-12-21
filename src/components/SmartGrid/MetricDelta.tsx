/**
 * MetricDelta Component
 *
 * Displays a percentage change delta with color coding.
 * Green for positive (good), red for negative (bad).
 * Supports inverted logic for metrics like CPA where decrease is good.
 */

'use client';

import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/16/solid';

interface MetricDeltaProps {
  delta: number;
  invert?: boolean; // If true, negative is good (e.g., CPA decrease)
  size?: 'sm' | 'md';
  showArrow?: boolean;
}

export function MetricDelta({ delta, invert = false, size = 'sm', showArrow = true }: MetricDeltaProps) {
  if (delta === 0) {
    return (
      <span className="text-[11px] text-[var(--text3)] ml-1">
        —
      </span>
    );
  }

  const isPositive = delta > 0;
  // For normal metrics: positive = good (green), negative = bad (red)
  // For inverted metrics (like CPA): negative = good (green), positive = bad (red)
  const isGood = invert ? !isPositive : isPositive;

  const colorClass = isGood
    ? 'text-emerald-600'
    : 'text-red-500';

  const formattedDelta = `${isPositive ? '+' : ''}${delta.toFixed(0)}%`;

  const sizeClasses = size === 'sm' ? 'text-[11px]' : 'text-[12px]';
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span className={`inline-flex items-center gap-0.5 ml-1 font-medium ${sizeClasses} ${colorClass}`}>
      {showArrow && (
        isPositive ? (
          <ArrowUpIcon className={iconSize} />
        ) : (
          <ArrowDownIcon className={iconSize} />
        )
      )}
      {formattedDelta}
    </span>
  );
}

export default MetricDelta;
