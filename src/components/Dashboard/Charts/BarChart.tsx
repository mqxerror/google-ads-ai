'use client';

import { useMemo } from 'react';

export interface BarChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartDataPoint[];
  height?: number;
  horizontal?: boolean;
  showValues?: boolean;
  formatValue?: (value: number) => string;
  maxBars?: number;
}

export default function BarChart({
  data,
  height = 300,
  horizontal = false,
  showValues = true,
  formatValue = (v) => v.toLocaleString(),
  maxBars = 10,
}: BarChartProps) {
  const chartData = useMemo(() => {
    // Limit to max bars
    const limitedData = data.slice(0, maxBars);

    if (limitedData.length === 0) {
      return { bars: [], maxValue: 0 };
    }

    const values = limitedData.map((d) => d.value);
    const maxValue = Math.max(...values, 1);

    return { bars: limitedData, maxValue };
  }, [data, maxBars]);

  if (chartData.bars.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
        style={{ height }}
      >
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
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

  if (horizontal) {
    return (
      <div className="w-full space-y-3" style={{ height }}>
        {chartData.bars.map((bar, i) => {
          const percentage = (bar.value / chartData.maxValue) * 100;
          const barColor = bar.color || defaultColors[i % defaultColors.length];

          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700 truncate flex-1">
                  {bar.label}
                </span>
                {showValues && (
                  <span className="text-gray-600 ml-2 font-mono">
                    {formatValue(bar.value)}
                  </span>
                )}
              </div>
              <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-500 flex items-center justify-end px-2"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: barColor,
                  }}
                >
                  {percentage > 20 && showValues && (
                    <span className="text-xs font-semibold text-white">
                      {percentage.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical bars
  const barWidth = 100 / chartData.bars.length;
  const padding = 40;
  const chartHeight = height - padding;

  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }}>
      {/* Bars */}
      {chartData.bars.map((bar, i) => {
        const barHeight = (bar.value / chartData.maxValue) * chartHeight;
        const x = i * barWidth + barWidth * 0.15;
        const barActualWidth = barWidth * 0.7;
        const y = chartHeight - barHeight;
        const barColor = bar.color || defaultColors[i % defaultColors.length];

        return (
          <g key={i}>
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barActualWidth}
              height={barHeight}
              fill={barColor}
              className="transition-all duration-500 hover:opacity-80"
              rx="1"
            >
              <title>
                {bar.label}: {formatValue(bar.value)}
              </title>
            </rect>

            {/* Value label */}
            {showValues && barHeight > 10 && (
              <text
                x={x + barActualWidth / 2}
                y={y + 5}
                textAnchor="middle"
                className="text-[3px] fill-white font-semibold"
              >
                {formatValue(bar.value)}
              </text>
            )}

            {/* X-axis label */}
            <text
              x={x + barActualWidth / 2}
              y={chartHeight + 15}
              textAnchor="middle"
              className="text-[3px] fill-gray-600"
            >
              {bar.label.length > 12 ? bar.label.slice(0, 12) + '...' : bar.label}
            </text>
          </g>
        );
      })}

      {/* X-axis line */}
      <line
        x1="0"
        y1={chartHeight}
        x2="100"
        y2={chartHeight}
        stroke="currentColor"
        className="text-gray-300"
        strokeWidth="0.2"
      />
    </svg>
  );
}
