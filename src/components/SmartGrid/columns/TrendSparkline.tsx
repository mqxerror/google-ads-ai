'use client';

import { TrendData } from '@/types/health';

interface TrendSparklineProps {
  trend: TrendData;
  width?: number;
  height?: number;
  showChange?: boolean;
  color?: 'auto' | 'green' | 'red' | 'blue';
}

export default function TrendSparkline({
  trend,
  width = 60,
  height = 20,
  showChange = true,
  color = 'auto',
}: TrendSparklineProps) {
  const { values, changePercent, direction } = trend;

  if (!values || values.length === 0) {
    return <span className="text-xs text-slate-400">-</span>;
  }

  // Determine color based on direction or override
  const getStrokeColor = () => {
    if (color !== 'auto') {
      const colors = {
        green: '#10b981',
        red: '#ef4444',
        blue: '#3b82f6',
      };
      return colors[color];
    }
    return direction === 'up' ? '#10b981' : direction === 'down' ? '#ef4444' : '#94a3b8';
  };

  const getChangeColor = () => {
    if (direction === 'stable') return 'text-slate-500';
    return direction === 'up'
      ? 'text-emerald-600'
      : 'text-rose-600';
  };

  // Calculate SVG path
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const padding = 2;
  const effectiveHeight = height - padding * 2;
  const effectiveWidth = width - padding * 2;

  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * effectiveWidth;
    const y = padding + effectiveHeight - ((value - minValue) / range) * effectiveHeight;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Create gradient fill area
  const areaPathD = `M ${padding},${height - padding} L ${points.join(' L ')} L ${width - padding},${height - padding} Z`;

  return (
    <div className="flex items-center gap-2">
      {/* Sparkline SVG */}
      <svg
        width={width}
        height={height}
        className="flex-shrink-0"
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${direction}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              stopColor={getStrokeColor()}
              stopOpacity="0.3"
            />
            <stop
              offset="100%"
              stopColor={getStrokeColor()}
              stopOpacity="0.05"
            />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <path
          d={areaPathD}
          fill={`url(#gradient-${direction})`}
        />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End dot */}
        <circle
          cx={width - padding}
          cy={padding + effectiveHeight - ((values[values.length - 1] - minValue) / range) * effectiveHeight}
          r="2"
          fill={getStrokeColor()}
        />
      </svg>

      {/* Change percentage */}
      {showChange && (
        <span className={`text-xs font-semibold tabular-nums ${getChangeColor()}`}>
          {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

// Compact version for inline use
export function MiniSparkline({
  values,
  direction = 'stable',
}: {
  values: number[];
  direction?: 'up' | 'down' | 'stable';
}) {
  if (!values || values.length < 2) return null;

  const width = 40;
  const height = 12;
  const padding = 1;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + (height - padding * 2) - ((value - minValue) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const strokeColor = direction === 'up' ? '#10b981' : direction === 'down' ? '#ef4444' : '#94a3b8';

  return (
    <svg width={width} height={height} className="inline-block">
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
