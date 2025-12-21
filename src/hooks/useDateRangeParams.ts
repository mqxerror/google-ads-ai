/**
 * URL-Based Date Range Hook
 *
 * Single source of truth for date range across the app.
 * Stores in URL params so SSR + client always match.
 *
 * URL params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&preset=yesterday
 */

'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'last90days'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  preset: DateRangePreset;
}

// Default preset when no URL params
const DEFAULT_PRESET: DateRangePreset = 'last7days';

/**
 * Get current date in a specific timezone
 *
 * IMPORTANT: This ensures "Yesterday" is computed in the account's timezone,
 * not the server or client's local timezone. This prevents silent drift between:
 * - Server computing in UTC
 * - Client computing in local timezone
 * - Google Ads account having its own timezone
 *
 * @param timezone - IANA timezone string (e.g., 'America/New_York', 'Europe/London')
 */
function getTodayInTimezone(timezone?: string): Date {
  const now = new Date();

  if (!timezone) {
    // Default to client's timezone if not specified
    return now;
  }

  try {
    // Get the date parts in the target timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    // Parse the formatted date (en-CA gives YYYY-MM-DD format)
    const dateStr = formatter.format(now);
    const [year, month, day] = dateStr.split('-').map(Number);

    // Create a date object representing midnight in the target timezone
    // Note: This creates a Date in local time that represents the same calendar date
    return new Date(year, month - 1, day);
  } catch {
    // Fallback to local time if timezone is invalid
    console.warn(`[DateRange] Invalid timezone: ${timezone}, using local time`);
    return now;
  }
}

/**
 * Calculate actual dates for a preset
 * This is the ONLY place preset -> dates conversion should happen
 *
 * @param preset - The date range preset
 * @param timezone - Optional IANA timezone (e.g., 'America/New_York')
 *                   If not provided, uses client's local timezone
 */
export function calculateDatesForPreset(
  preset: DateRangePreset,
  timezone?: string
): { startDate: string; endDate: string } {
  const today = getTodayInTimezone(timezone);
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  switch (preset) {
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) };

    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      // CRITICAL: Yesterday must be startDate === endDate (1-day window)
      return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) };
    }

    case 'last7days': {
      const end = new Date(today);
      end.setDate(end.getDate() - 1); // End yesterday to avoid partial data
      const start = new Date(end);
      start.setDate(start.getDate() - 6); // 7 days total
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }

    case 'last30days': {
      const end = new Date(today);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 29); // 30 days total
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }

    case 'last90days': {
      const end = new Date(today);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 89); // 90 days total
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }

    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }

    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }

    case 'custom':
    default:
      // For custom, return today as a fallback (caller should provide explicit dates)
      return { startDate: formatDate(today), endDate: formatDate(today) };
  }
}

/**
 * Validate that dates match the preset's expected range
 * Used for debugging and assertions
 *
 * @param preset - The date range preset
 * @param startDate - Actual start date
 * @param endDate - Actual end date
 * @param timezone - Optional timezone to use for validation
 */
export function validatePresetDateMatch(
  preset: DateRangePreset,
  startDate: string,
  endDate: string,
  timezone?: string
): { valid: boolean; expected: { startDate: string; endDate: string }; error?: string } {
  if (preset === 'custom') {
    return { valid: true, expected: { startDate, endDate } };
  }

  const expected = calculateDatesForPreset(preset, timezone);

  if (expected.startDate !== startDate || expected.endDate !== endDate) {
    return {
      valid: false,
      expected,
      error: `Preset '${preset}' expected ${expected.startDate} to ${expected.endDate}, got ${startDate} to ${endDate}`,
    };
  }

  return { valid: true, expected };
}

/**
 * Get the account's timezone from the current account context
 * This should be called when selecting presets to ensure
 * dates are calculated in the account's timezone
 */
export function getAccountTimezone(account?: { timezone?: string }): string {
  return account?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Hook to manage date range via URL params
 * This is the single source of truth for date range
 *
 * NOTE: This hook must be used within a component wrapped in Suspense
 * or in a page that opts into client-side rendering.
 */
export function useDateRangeParams(): {
  dateRange: DateRange;
  setDateRange: (range: DateRange | DateRangePreset) => void;
  isInitialized: boolean;
} {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read from URL params
  const urlStartDate = searchParams.get('startDate');
  const urlEndDate = searchParams.get('endDate');
  const urlPreset = searchParams.get('preset') as DateRangePreset | null;

  // Determine if URL has date params
  const hasUrlParams = !!(urlStartDate && urlEndDate);

  // Calculate the effective date range
  const dateRange = useMemo((): DateRange => {
    // If URL has explicit dates, use them
    if (hasUrlParams && urlStartDate && urlEndDate) {
      return {
        startDate: urlStartDate,
        endDate: urlEndDate,
        preset: urlPreset || 'custom',
      };
    }

    // No URL params - calculate from default preset
    // This only happens on initial load before params are set
    const defaultDates = calculateDatesForPreset(DEFAULT_PRESET);
    return {
      ...defaultDates,
      preset: DEFAULT_PRESET,
    };
  }, [hasUrlParams, urlStartDate, urlEndDate, urlPreset]);

  // Setter that updates URL params
  const setDateRange = useCallback((rangeOrPreset: DateRange | DateRangePreset) => {
    let newRange: DateRange;

    if (typeof rangeOrPreset === 'string') {
      // It's a preset - calculate dates
      const dates = calculateDatesForPreset(rangeOrPreset);
      newRange = { ...dates, preset: rangeOrPreset };
    } else {
      // It's a full DateRange
      newRange = rangeOrPreset;
    }

    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    params.set('startDate', newRange.startDate);
    params.set('endDate', newRange.endDate);
    params.set('preset', newRange.preset);

    // Use router.replace to avoid adding history entry for every date change
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  return {
    dateRange,
    setDateRange,
    isInitialized: hasUrlParams,
  };
}

/**
 * SSR-safe version of date range hook that uses state instead of URL params
 * Use this in contexts where Suspense boundaries are not available (like providers)
 */
export function useDateRangeState(): {
  dateRange: DateRange;
  setDateRange: (range: DateRange | DateRangePreset) => void;
} {
  const [dateRange, setDateRangeState] = useState<DateRange>(() => {
    const dates = calculateDatesForPreset(DEFAULT_PRESET);
    return { ...dates, preset: DEFAULT_PRESET };
  });

  const setDateRange = useCallback((rangeOrPreset: DateRange | DateRangePreset) => {
    if (typeof rangeOrPreset === 'string') {
      const dates = calculateDatesForPreset(rangeOrPreset);
      setDateRangeState({ ...dates, preset: rangeOrPreset });
    } else {
      setDateRangeState(rangeOrPreset);
    }
  }, []);

  return { dateRange, setDateRange };
}

/**
 * Initialize date range in URL if not present
 * Call this once on app mount to ensure URL params are set
 */
export function useInitializeDateRangeParams() {
  const { dateRange, setDateRange, isInitialized } = useDateRangeParams();

  // Initialize URL params if not set
  // This should only run once on initial client render
  if (typeof window !== 'undefined' && !isInitialized) {
    // Don't use useEffect - we want this to be synchronous
    // The setDateRange will update URL params
    const dates = calculateDatesForPreset(DEFAULT_PRESET);
    setDateRange({ ...dates, preset: DEFAULT_PRESET });
  }

  return { dateRange, setDateRange, isInitialized };
}

/**
 * Get date range for SSR (no URL params available)
 * Returns the default preset with calculated dates
 */
export function getServerDateRange(): DateRange {
  const dates = calculateDatesForPreset(DEFAULT_PRESET);
  return { ...dates, preset: DEFAULT_PRESET };
}
