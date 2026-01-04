'use client';

import { useMemo } from 'react';

interface MonthlyVolume {
  year: number;
  month: number;
  volume: number;
}

interface TrendSparklineProps {
  data: MonthlyVolume[];
  width?: number;
  height?: number;
  showTooltip?: boolean;
  className?: string;
}

/**
 * Calculate trend direction from data
 */
function getTrendDirection(data: MonthlyVolume[]): 'rising' | 'falling' | 'stable' {
  if (data.length < 2) return 'stable';

  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const firstAvg = firstHalf.reduce((sum, d) => sum + d.volume, 0) / firstHalf.length || 0;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.volume, 0) / secondHalf.length || 0;

  const change = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

  if (change > 15) return 'rising';
  if (change < -15) return 'falling';
  return 'stable';
}

/**
 * Get color based on trend direction
 */
function getTrendColor(direction: 'rising' | 'falling' | 'stable'): string {
  switch (direction) {
    case 'rising':
      return '#22c55e'; // green-500
    case 'falling':
      return '#ef4444'; // red-500
    case 'stable':
      return '#6b7280'; // gray-500
  }
}

/**
 * Format month for tooltip
 */
function formatMonth(year: number, month: number): string {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/**
 * TrendSparkline - Mini chart showing 12-month search volume trend
 */
export default function TrendSparkline({
  data,
  width = 80,
  height = 24,
  showTooltip = true,
  className = '',
}: TrendSparklineProps) {
  const { path, points, direction, minVolume, maxVolume } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', points: [], direction: 'stable' as const, minVolume: 0, maxVolume: 0 };
    }

    // Sort by date
    const sorted = [...data].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    const volumes = sorted.map(d => d.volume);
    const min = Math.min(...volumes);
    const max = Math.max(...volumes);
    const range = max - min || 1;

    // Calculate points
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const calculatedPoints = sorted.map((d, i) => {
      const x = padding + (i / (sorted.length - 1 || 1)) * chartWidth;
      const y = padding + chartHeight - ((d.volume - min) / range) * chartHeight;
      return { x, y, ...d };
    });

    // Create SVG path
    const pathData = calculatedPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    return {
      path: pathData,
      points: calculatedPoints,
      direction: getTrendDirection(sorted),
      minVolume: min,
      maxVolume: max,
    };
  }, [data, width, height]);

  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-gray-400 text-xs ${className}`}
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  const color = getTrendColor(direction);

  return (
    <div className={`relative group ${className}`} style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Gradient fill */}
        <defs>
          <linearGradient id={`gradient-${direction}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {path && (
          <path
            d={`${path} L ${width - 2} ${height - 2} L 2 ${height - 2} Z`}
            fill={`url(#gradient-${direction})`}
          />
        )}

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="2"
            fill={color}
          />
        )}
      </svg>

      {/* Trend arrow */}
      <div
        className="absolute -right-1 top-1/2 -translate-y-1/2 text-xs font-bold"
        style={{ color }}
      >
        {direction === 'rising' ? '↑' : direction === 'falling' ? '↓' : '→'}
      </div>

      {/* Tooltip on hover */}
      {showTooltip && points.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
            <div className="font-medium mb-1">
              {formatMonth(points[0].year, points[0].month)} - {formatMonth(points[points.length - 1].year, points[points.length - 1].month)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Range:</span>
              <span>{minVolume.toLocaleString()} - {maxVolume.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Trend:</span>
              <span style={{ color }}>{direction}</span>
            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

/**
 * Compact sparkline for table cells (no tooltip)
 */
export function CompactSparkline({ data, className = '' }: { data: MonthlyVolume[]; className?: string }) {
  return (
    <TrendSparkline
      data={data}
      width={60}
      height={20}
      showTooltip={false}
      className={className}
    />
  );
}
