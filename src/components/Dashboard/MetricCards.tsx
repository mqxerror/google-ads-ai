'use client';

import TrendIndicator from './TrendIndicator';
import Sparkline from './Charts/Sparkline';

export interface MetricCardData {
  title: string;
  value: string | number;
  previousValue?: number;
  currentValue?: number;
  format?: 'number' | 'currency' | 'percentage';
  sparklineData?: number[];
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

interface MetricCardsProps {
  metrics: MetricCardData[];
}

export default function MetricCards({ metrics }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <MetricCard key={index} metric={metric} />
      ))}
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricCardData }) {
  const {
    title,
    value,
    previousValue,
    currentValue,
    format = 'number',
    sparklineData,
    icon,
  } = metric;

  const displayValue = typeof value === 'number' ? formatMetricValue(value, format) : value;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
        </div>
        {icon && (
          <div className="text-gray-400 flex-shrink-0">{icon}</div>
        )}
      </div>

      <div className="mb-3">
        <p className="text-3xl font-bold text-gray-900">{displayValue}</p>
      </div>

      <div className="flex items-center justify-between">
        {previousValue !== undefined && currentValue !== undefined && (
          <TrendIndicator
            value={currentValue}
            previousValue={previousValue}
            format={format}
            showValue={false}
            size="sm"
          />
        )}

        {sparklineData && sparklineData.length > 0 && (
          <div className="ml-auto">
            <Sparkline
              data={sparklineData}
              width={80}
              height={24}
              color={getTrendColor(sparklineData)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function formatMetricValue(value: number, format: string): string {
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    case 'percentage':
      return `${value.toFixed(2)}%`;
    default:
      return value.toLocaleString();
  }
}

function getTrendColor(data: number[]): string {
  if (data.length < 2) return '#3b82f6';
  const first = data[0];
  const last = data[data.length - 1];
  if (last > first) return '#10b981'; // green
  if (last < first) return '#ef4444'; // red
  return '#3b82f6'; // blue
}
