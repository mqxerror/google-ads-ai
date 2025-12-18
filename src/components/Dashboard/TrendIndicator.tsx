'use client';

interface TrendIndicatorProps {
  value: number;
  previousValue: number;
  format?: 'number' | 'currency' | 'percentage';
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function TrendIndicator({
  value,
  previousValue,
  format = 'number',
  showValue = true,
  size = 'md',
}: TrendIndicatorProps) {
  const change = value - previousValue;
  const percentChange = previousValue !== 0 ? (change / previousValue) * 100 : 0;

  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return `$${Math.abs(val).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      case 'percentage':
        return `${Math.abs(val).toFixed(2)}%`;
      default:
        return Math.abs(val).toLocaleString();
    }
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  if (isNeutral) {
    return (
      <div className={`flex items-center gap-1 text-gray-500 ${sizeClasses[size]}`}>
        <svg width={iconSize[size]} height={iconSize[size]} viewBox="0 0 16 16" fill="none">
          <path
            d="M2 8h12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className="font-medium">0%</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 ${
        isPositive ? 'text-green-600' : 'text-red-600'
      } ${sizeClasses[size]}`}
    >
      {/* Arrow Icon */}
      <svg
        width={iconSize[size]}
        height={iconSize[size]}
        viewBox="0 0 16 16"
        fill="none"
        className={isNegative ? 'rotate-180' : ''}
      >
        <path
          d="M8 3v10M8 3l-3 3M8 3l3 3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Percentage */}
      <span className="font-medium">{Math.abs(percentChange).toFixed(1)}%</span>

      {/* Optional Value */}
      {showValue && (
        <span className="text-gray-600">
          ({isPositive ? '+' : '-'}
          {formatValue(change)})
        </span>
      )}
    </div>
  );
}
