'use client';

import { useMemo } from 'react';

export interface LineChartDataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineChartDataPoint[];
  height?: number;
  color?: string;
  fillColor?: string;
  showGrid?: boolean;
  showAxis?: boolean;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
}

export default function LineChart({
  data,
  height = 200,
  color = '#3b82f6',
  fillColor = 'rgba(59, 130, 246, 0.1)',
  showGrid = true,
  showAxis = true,
  yAxisLabel,
  formatValue = (v) => v.toLocaleString(),
}: LineChartProps) {
  const { points, path, fillPath, maxValue, minValue, yTicks } = useMemo(() => {
    if (data.length === 0) {
      return { points: [], path: '', fillPath: '', maxValue: 0, minValue: 0, yTicks: [] };
    }

    const values = data.map((d) => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    // Calculate padding
    const padding = { top: 20, right: 20, bottom: showAxis ? 40 : 10, left: showAxis ? 60 : 10 };
    const chartWidth = 600 - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate points
    const stepX = chartWidth / (data.length - 1 || 1);
    const pointsArray = data.map((d, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + chartHeight - ((d.value - min) / range) * chartHeight;
      return { x, y, label: d.label, value: d.value };
    });

    // Create path
    const pathString = pointsArray
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    // Create fill path (area under the line)
    const fillPathString =
      pathString +
      ` L ${pointsArray[pointsArray.length - 1].x} ${padding.top + chartHeight}` +
      ` L ${padding.left} ${padding.top + chartHeight} Z`;

    // Calculate Y-axis ticks
    const tickCount = 5;
    const tickStep = range / (tickCount - 1);
    const ticks = Array.from({ length: tickCount }, (_, i) => ({
      value: min + tickStep * i,
      y: padding.top + chartHeight - (tickStep * i / range) * chartHeight,
    }));

    return {
      points: pointsArray,
      path: pathString,
      fillPath: fillPathString,
      maxValue: max,
      minValue: min,
      yTicks: ticks,
    };
  }, [data, height, showAxis]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
        style={{ height }}
      >
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: showAxis ? 40 : 10, left: showAxis ? 60 : 10 };
  const chartHeight = height - padding.top - padding.bottom;

  return (
    <div className="w-full">
      {yAxisLabel && (
        <div className="text-xs font-medium text-gray-700 mb-2">
          {yAxisLabel}
        </div>
      )}
      <svg
        viewBox="0 0 600 200"
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {showGrid &&
          yTicks.map((tick, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={tick.y}
              x2={600 - padding.right}
              y2={tick.y}
              stroke="currentColor"
              className="text-gray-200"
              strokeWidth="1"
              opacity="0.5"
            />
          ))}

        {/* Fill area */}
        <path d={fillPath} fill={fillColor} />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="white"
              stroke={color}
              strokeWidth="2"
              className="hover:r-6 transition-all cursor-pointer"
            />
            <title>
              {point.label}: {formatValue(point.value)}
            </title>
          </g>
        ))}

        {/* Y-axis */}
        {showAxis && (
          <>
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + chartHeight}
              stroke="currentColor"
              className="text-gray-300"
              strokeWidth="1"
            />
            {yTicks.map((tick, i) => (
              <text
                key={i}
                x={padding.left - 10}
                y={tick.y}
                textAnchor="end"
                alignmentBaseline="middle"
                className="text-[8px] fill-gray-600"
              >
                {formatValue(tick.value)}
              </text>
            ))}
          </>
        )}

        {/* X-axis labels */}
        {showAxis &&
          points.map((point, i) => {
            // Show only some labels to avoid crowding
            const showLabel = data.length <= 7 || i % Math.ceil(data.length / 7) === 0;
            if (!showLabel && i !== data.length - 1) return null;

            return (
              <text
                key={i}
                x={point.x}
                y={padding.top + chartHeight + 20}
                textAnchor="middle"
                className="text-[8px] fill-gray-600"
              >
                {point.label}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
