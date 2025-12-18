'use client';

interface HealthBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function HealthBadge({ score, showLabel = true, size = 'md' }: HealthBadgeProps) {
  // Determine health status based on score
  const getHealthStatus = (s: number): { label: string; dotClass: string } => {
    if (s >= 75) return { label: 'Healthy', dotClass: 'healthy' };
    if (s >= 50) return { label: 'Attention', dotClass: 'warning' };
    return { label: 'Critical', dotClass: 'critical' };
  };

  const { label, dotClass } = getHealthStatus(score);

  const sizeClasses = size === 'sm'
    ? 'gap-1.5 px-2 py-0.5'
    : 'gap-2 px-3 py-1';

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={`health-badge ${sizeClasses}`}>
      <span className={`health-dot ${dotClass} ${dotSize}`} />
      {showLabel && (
        <span className={`health-label ${textSize}`}>{label}</span>
      )}
      <span className={`health-score ${textSize}`}>{score}</span>
    </div>
  );
}
