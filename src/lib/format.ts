// Centralized formatting utilities for consistent number display
// All formatters are locale-aware and handle edge cases

/**
 * Format a number with locale-aware separators
 * 579522 → "579,522" (en-US) or "579.522" (de-DE)
 */
export function formatNumber(
  value: number,
  options: {
    locale?: string;
    decimals?: number;
    compact?: boolean;
    fallback?: string;
  } = {}
): string {
  const { locale = 'en-US', decimals, compact = false, fallback = '-' } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }

  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })}K`;
    }
  }

  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals ?? 0,
  });
}

/**
 * Format currency with proper symbol and separators
 * 12456.78 → "$12,456.78" or "$12.5K" (compact)
 */
export function formatCurrency(
  value: number,
  options: {
    currency?: string;
    locale?: string;
    compact?: boolean;
    showCents?: boolean;
    fallback?: string;
  } = {}
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    compact = false,
    showCents = true,
    fallback = '-',
  } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }

  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `$${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `$${(value / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })}K`;
    }
  }

  return value.toLocaleString(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

/**
 * Format percentage with consistent decimals
 * 0.1234 → "12.34%" or 12.34 → "12.34%"
 */
export function formatPercent(
  value: number,
  options: {
    decimals?: number;
    locale?: string;
    fromDecimal?: boolean;
    fallback?: string;
  } = {}
): string {
  const { decimals = 2, locale = 'en-US', fromDecimal = false, fallback = '-' } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }

  const percentValue = fromDecimal ? value * 100 : value;

  return `${percentValue.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/**
 * Calculate and format delta between two values
 * Returns both the percentage change and formatted values
 */
export function formatDelta(
  current: number,
  previous: number,
  options: {
    format?: 'number' | 'currency' | 'percent';
    locale?: string;
    showSign?: boolean;
  } = {}
): {
  percentChange: number;
  absoluteChange: number;
  direction: 'up' | 'down' | 'neutral';
  formatted: string;
  formattedPercent: string;
} {
  const { format = 'number', locale = 'en-US', showSign = true } = options;

  const absoluteChange = current - previous;
  const percentChange = previous !== 0 ? (absoluteChange / previous) * 100 : 0;

  const direction: 'up' | 'down' | 'neutral' =
    absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'neutral';

  let formatted: string;
  const sign = showSign && absoluteChange > 0 ? '+' : '';

  switch (format) {
    case 'currency':
      formatted = `${sign}${formatCurrency(absoluteChange, { locale })}`;
      break;
    case 'percent':
      formatted = `${sign}${formatPercent(absoluteChange, { locale })}`;
      break;
    default:
      formatted = `${sign}${formatNumber(absoluteChange, { locale })}`;
  }

  const formattedPercent = `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`;

  return {
    percentChange,
    absoluteChange,
    direction,
    formatted,
    formattedPercent,
  };
}

/**
 * Format large numbers in a human-readable way
 * 1234567 → "1.23M"
 */
export function formatCompact(
  value: number,
  options: {
    locale?: string;
    decimals?: number;
  } = {}
): string {
  const { locale = 'en-US', decimals = 1 } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toLocaleString(locale, { maximumFractionDigits: decimals })}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toLocaleString(locale, { maximumFractionDigits: decimals })}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toLocaleString(locale, { maximumFractionDigits: decimals })}K`;
  }

  return value.toLocaleString(locale, { maximumFractionDigits: decimals });
}

/**
 * Format a value for tabular display (fixed width)
 * Ensures numbers align in columns
 */
export function formatTabular(
  value: number,
  options: {
    type: 'currency' | 'number' | 'percent';
    width?: number;
    locale?: string;
  }
): string {
  const { type, locale = 'en-US' } = options;

  let formatted: string;

  switch (type) {
    case 'currency':
      formatted = formatCurrency(value, { locale, showCents: true });
      break;
    case 'percent':
      formatted = formatPercent(value, { locale, decimals: 2 });
      break;
    default:
      formatted = formatNumber(value, { locale });
  }

  return formatted;
}

/**
 * Format a date relative to now
 * "2 hours ago", "yesterday", "3 days ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a date for display
 */
export function formatDate(
  date: Date | string,
  options: {
    format?: 'short' | 'medium' | 'long';
    locale?: string;
  } = {}
): string {
  const { format = 'medium', locale = 'en-US' } = options;
  const d = new Date(date);

  switch (format) {
    case 'short':
      return d.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
    case 'long':
      return d.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    default:
      return d.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
  }
}
