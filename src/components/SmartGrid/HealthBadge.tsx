'use client';

import { CampaignHealth, getHealthLabel, getHealthColor, HealthLabel } from '@/types/health';

interface HealthBadgeProps {
  health?: CampaignHealth;
  score?: number; // Fallback to raw score if no health object
  showLabel?: boolean;
  showTrend?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

// Get icon for health trend
function TrendIcon({ trend, className }: { trend: CampaignHealth['trend']; className?: string }) {
  if (trend === 'improving') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    );
  }
  if (trend === 'declining') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
    </svg>
  );
}

export default function HealthBadge({
  health,
  score: rawScore,
  showLabel = true,
  showTrend = false,
  size = 'md',
  onClick,
}: HealthBadgeProps) {
  const score = health?.score ?? rawScore ?? 0;
  const label = health?.label ?? getHealthLabel(score);
  const trend = health?.trend;
  const trendChange = health?.trendChange;

  // No score available
  if (score === 0 && !health) {
    return <span className="text-slate-400">-</span>;
  }

  // Size variants
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
    lg: 'text-sm px-2.5 py-1 gap-2',
  };

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  };

  // Color based on health label
  const getColors = (healthLabel: HealthLabel) => {
    switch (healthLabel) {
      case 'Healthy':
        return {
          bg: 'bg-emerald-100',
          text: 'text-emerald-700',
          ring: 'hover:ring-emerald-300',
          trend: 'text-emerald-600',
        };
      case 'Watch':
        return {
          bg: 'bg-amber-100',
          text: 'text-amber-700',
          ring: 'hover:ring-amber-300',
          trend: 'text-amber-600',
        };
      case 'Action Needed':
        return {
          bg: 'bg-rose-100',
          text: 'text-rose-700',
          ring: 'hover:ring-rose-300',
          trend: 'text-rose-600',
        };
    }
  };

  const colors = getColors(label);

  // Trend color override
  const trendColor = trend === 'improving'
    ? 'text-emerald-500'
    : trend === 'declining'
    ? 'text-rose-500'
    : 'text-slate-400';

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        inline-flex items-center rounded-md font-semibold
        ${sizeClasses[size]}
        ${colors.bg} ${colors.text}
        ${onClick ? `cursor-pointer hover:ring-2 ${colors.ring} transition-all` : ''}
      `}
    >
      {/* Score */}
      <span className="font-bold tabular-nums">{score}</span>

      {/* Label (optional) */}
      {showLabel && (
        <>
          <span className="opacity-50">|</span>
          <span className="font-medium">{label === 'Action Needed' ? 'Action' : label}</span>
        </>
      )}

      {/* Trend indicator (optional) */}
      {showTrend && trend && (
        <span className={`flex items-center gap-0.5 ${trendColor}`}>
          <TrendIcon trend={trend} className={iconSizes[size]} />
          {trendChange !== undefined && (
            <span className="text-[10px] tabular-nums">
              {trendChange > 0 ? '+' : ''}{trendChange}
            </span>
          )}
        </span>
      )}

      {/* Info icon if clickable */}
      {onClick && (
        <svg className={`${iconSizes[size]} opacity-60`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </Component>
  );
}

// Compact version for tight spaces
export function HealthDot({
  health,
  score: rawScore,
  size = 'md'
}: {
  health?: CampaignHealth;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const score = health?.score ?? rawScore ?? 0;
  const label = health?.label ?? getHealthLabel(score);

  const dotSizes = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  const getColor = (healthLabel: HealthLabel) => {
    switch (healthLabel) {
      case 'Healthy':
        return 'bg-emerald-500';
      case 'Watch':
        return 'bg-amber-500';
      case 'Action Needed':
        return 'bg-rose-500';
    }
  };

  if (score === 0 && !health) {
    return <span className={`${dotSizes[size]} rounded-full bg-slate-300`} />;
  }

  return (
    <span
      className={`${dotSizes[size]} rounded-full ${getColor(label)}`}
      title={`Health: ${score} (${label})`}
    />
  );
}

// Mini badge for inline usage
export function HealthMini({
  health,
  score: rawScore
}: {
  health?: CampaignHealth;
  score?: number;
}) {
  const score = health?.score ?? rawScore ?? 0;
  const label = health?.label ?? getHealthLabel(score);

  const getColor = (healthLabel: HealthLabel) => {
    switch (healthLabel) {
      case 'Healthy':
        return 'text-emerald-600';
      case 'Watch':
        return 'text-amber-600';
      case 'Action Needed':
        return 'text-rose-600';
    }
  };

  if (score === 0 && !health) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <span className={`font-semibold tabular-nums ${getColor(label)}`}>
      {score}
    </span>
  );
}
