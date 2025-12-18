'use client';

import { useMemo } from 'react';

export interface PieChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartDataPoint[];
  size?: number;
  donut?: boolean;
  donutWidth?: number;
  showLegend?: boolean;
  showPercentages?: boolean;
  formatValue?: (value: number) => string;
}

export default function PieChart({
  data,
  size = 200,
  donut = true,
  donutWidth = 30,
  showLegend = true,
  showPercentages = true,
  formatValue = (v) => v.toLocaleString(),
}: PieChartProps) {
  const { segments, total } = useMemo(() => {
    const totalValue = data.reduce((sum, d) => sum + d.value, 0);

    if (totalValue === 0) {
      return { segments: [], total: 0 };
    }

    const defaultColors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#f97316', // orange
    ];

    let currentAngle = -90; // Start from top

    const segmentData = data.map((d, i) => {
      const percentage = (d.value / totalValue) * 100;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const color = d.color || defaultColors[i % defaultColors.length];

      return {
        ...d,
        percentage,
        startAngle,
        endAngle,
        color,
      };
    });

    return { segments: segmentData, total: totalValue };
  }, [data]);

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex items-center justify-center bg-gray-50 rounded-full border border-gray-200"
          style={{ width: size, height: size }}
        >
          <p className="text-sm text-gray-500">No data</p>
        </div>
      </div>
    );
  }

  const center = size / 2;
  const radius = size / 2 - 10;
  const innerRadius = donut ? radius - donutWidth : 0;

  const polarToCartesian = (centerX: number, centerY: number, r: number, degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return {
      x: centerX + r * Math.cos(radians),
      y: centerY + r * Math.sin(radians),
    };
  };

  const createArcPath = (
    startAngle: number,
    endAngle: number,
    outerR: number,
    innerR: number
  ) => {
    const start = polarToCartesian(center, center, outerR, startAngle);
    const end = polarToCartesian(center, center, outerR, endAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    if (innerR === 0) {
      // Regular pie slice
      return `M ${center} ${center} L ${start.x} ${start.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
    } else {
      // Donut slice
      const innerStart = polarToCartesian(center, center, innerR, endAngle);
      const innerEnd = polarToCartesian(center, center, innerR, startAngle);

      return `M ${start.x} ${start.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${end.x} ${end.y} L ${innerStart.x} ${innerStart.y} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerEnd.x} ${innerEnd.y} Z`;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      {/* Chart */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform transition-transform">
          {segments.map((segment, i) => (
            <g key={i} className="hover:opacity-80 transition-opacity cursor-pointer">
              <path
                d={createArcPath(segment.startAngle, segment.endAngle, radius, innerRadius)}
                fill={segment.color}
                stroke="white"
                strokeWidth="2"
              >
                <title>
                  {segment.label}: {formatValue(segment.value)} ({segment.percentage.toFixed(1)}
                  %)
                </title>
              </path>
            </g>
          ))}
        </svg>

        {/* Center text for donut */}
        {donut && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-2xl font-bold text-gray-900">
              {formatValue(total)}
            </div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="space-y-2 min-w-[160px]">
          {segments.map((segment, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="truncate text-gray-700">{segment.label}</div>
                <div className="text-xs text-gray-500 font-mono">
                  {formatValue(segment.value)}
                  {showPercentages && ` (${segment.percentage.toFixed(1)}%)`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
