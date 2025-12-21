/**
 * Query Context - Date Range Correctness Hardening
 *
 * Ensures consistent date handling across:
 * - UI date picker
 * - API requests
 * - Cache keys
 * - Database queries
 * - Google Ads API (GAQL)
 *
 * Every API response includes _meta with:
 * - queryContext: exact parameters used for the query
 * - datesCovered: actual data coverage from cache/API
 * - missingDays: gaps in coverage
 */

export interface QueryContext {
  startDate: string;           // YYYY-MM-DD
  endDate: string;             // YYYY-MM-DD
  timezone: string;            // e.g., 'America/New_York', 'UTC'
  includeToday: boolean;       // Whether today's partial data is included
  conversionMode: 'default' | 'by_conversion_time' | 'by_click_time';
  requestedPreset?: string;    // e.g., 'yesterday', 'last7days' (for validation)
}

export interface DatesCovered {
  minDate: string | null;      // Earliest date with data
  maxDate: string | null;      // Latest date with data
  count: number;               // Number of days with data
  expectedCount: number;       // Expected days based on range
  coveragePercent: number;     // count / expectedCount * 100
  isComplete: boolean;         // coveragePercent === 100
}

export interface QueryMeta {
  queryContext: QueryContext;
  datesCovered: DatesCovered;
  missingDays: string[];       // YYYY-MM-DD format
  warnings: string[];          // Any data quality warnings
  cacheKey?: string;           // Cache key used (for debugging)
  dataSource: 'cache' | 'api' | 'hybrid';
}

/**
 * Generate all dates in a range (inclusive)
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Calculate date coverage from actual data dates
 */
export function calculateDatesCovered(
  startDate: string,
  endDate: string,
  actualDates: string[]
): { datesCovered: DatesCovered; missingDays: string[] } {
  const expectedDates = getDateRange(startDate, endDate);
  const actualSet = new Set(actualDates);

  const coveredDates = expectedDates.filter(d => actualSet.has(d));
  const missingDays = expectedDates.filter(d => !actualSet.has(d));

  const minDate = coveredDates.length > 0
    ? coveredDates.reduce((a, b) => a < b ? a : b)
    : null;
  const maxDate = coveredDates.length > 0
    ? coveredDates.reduce((a, b) => a > b ? a : b)
    : null;

  const coveragePercent = expectedDates.length > 0
    ? Math.round((coveredDates.length / expectedDates.length) * 100)
    : 0;

  return {
    datesCovered: {
      minDate,
      maxDate,
      count: coveredDates.length,
      expectedCount: expectedDates.length,
      coveragePercent,
      isComplete: coveragePercent === 100,
    },
    missingDays,
  };
}

/**
 * Build query context from request parameters
 */
export function buildQueryContext(
  startDate: string,
  endDate: string,
  options: {
    timezone?: string;
    includeToday?: boolean;
    conversionMode?: 'default' | 'by_conversion_time' | 'by_click_time';
    requestedPreset?: string;
  } = {}
): QueryContext {
  return {
    startDate,
    endDate,
    timezone: options.timezone || 'UTC',
    includeToday: options.includeToday ?? true,
    conversionMode: options.conversionMode || 'default',
    requestedPreset: options.requestedPreset,
  };
}

/**
 * Create a deterministic cache key that includes ALL query parameters
 * This ensures different date ranges never share cache entries
 */
export function createQueryCacheKey(params: {
  customerId: string;
  entityType: string;
  startDate: string;
  endDate: string;
  timezone?: string;
  conversionMode?: string;
  includeToday?: boolean;
  parentEntityId?: string;
  filters?: Record<string, unknown>;
  columns?: string[];
}): string {
  const {
    customerId,
    entityType,
    startDate,
    endDate,
    timezone = 'UTC',
    conversionMode = 'default',
    includeToday = true,
    parentEntityId,
    filters,
    columns,
  } = params;

  // Create deterministic hashes for complex objects
  const filtersHash = filters
    ? hashObject(filters)
    : 'none';
  const columnsHash = columns?.length
    ? hashArray(columns.sort())
    : 'default';

  // Build key with ALL parameters
  const keyParts = [
    customerId,
    entityType,
    `${startDate}_${endDate}`,
    `tz:${timezone}`,
    `conv:${conversionMode}`,
    `today:${includeToday}`,
  ];

  if (parentEntityId) {
    keyParts.push(`parent:${parentEntityId}`);
  }

  keyParts.push(`f:${filtersHash}`);
  keyParts.push(`c:${columnsHash}`);

  return keyParts.join('|');
}

/**
 * Simple hash function for objects (deterministic)
 */
function hashObject(obj: Record<string, unknown>): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return hashString(str);
}

/**
 * Simple hash function for arrays
 */
function hashArray(arr: string[]): string {
  return hashString(arr.join(','));
}

/**
 * Simple string hash (djb2)
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

/**
 * Validate that query context matches expected preset
 * Throws in development if there's a mismatch
 */
export function validateQueryContext(context: QueryContext): { valid: boolean; error?: string } {
  const { startDate, endDate, requestedPreset } = context;

  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Validate preset matches actual range
  if (requestedPreset === 'yesterday' || requestedPreset === 'today') {
    if (daysDiff !== 1) {
      const error = `VALIDATION FAILED: Preset "${requestedPreset}" requires 1-day window, got ${daysDiff} days (${startDate} to ${endDate})`;
      if (process.env.NODE_ENV === 'development') {
        console.error(`[QueryContext] ${error}`);
      }
      return { valid: false, error };
    }
  }

  if (requestedPreset === 'last7days') {
    if (daysDiff !== 7) {
      const error = `VALIDATION FAILED: Preset "last7days" requires 7-day window, got ${daysDiff} days`;
      if (process.env.NODE_ENV === 'development') {
        console.error(`[QueryContext] ${error}`);
      }
      return { valid: false, error };
    }
  }

  if (requestedPreset === 'last30days') {
    if (daysDiff !== 30) {
      const error = `VALIDATION FAILED: Preset "last30days" requires 30-day window, got ${daysDiff} days`;
      if (process.env.NODE_ENV === 'development') {
        console.error(`[QueryContext] ${error}`);
      }
      return { valid: false, error };
    }
  }

  return { valid: true };
}

/**
 * Build full _meta object for API response
 */
export function buildQueryMeta(
  context: QueryContext,
  actualDates: string[],
  dataSource: 'cache' | 'api' | 'hybrid',
  cacheKey?: string
): QueryMeta {
  const { datesCovered, missingDays } = calculateDatesCovered(
    context.startDate,
    context.endDate,
    actualDates
  );

  const warnings: string[] = [];

  // Add coverage warning
  if (!datesCovered.isComplete) {
    warnings.push(`Partial coverage: ${datesCovered.coveragePercent}% (${datesCovered.count}/${datesCovered.expectedCount} days)`);
  }

  // Add today warning if including incomplete data
  if (context.includeToday) {
    const today = new Date().toISOString().split('T')[0];
    if (context.endDate === today) {
      warnings.push('Includes today (data may be incomplete until midnight)');
    }
  }

  // Validate preset
  const validation = validateQueryContext(context);
  if (!validation.valid && validation.error) {
    warnings.push(validation.error);
  }

  return {
    queryContext: context,
    datesCovered,
    missingDays,
    warnings,
    cacheKey,
    dataSource,
  };
}

/**
 * Extract unique dates from metrics array
 */
export function extractDatesFromMetrics(
  metrics: Array<{ date: Date | string }>
): string[] {
  const dates = new Set<string>();
  for (const m of metrics) {
    const dateStr = m.date instanceof Date
      ? m.date.toISOString().split('T')[0]
      : String(m.date).split('T')[0];
    dates.add(dateStr);
  }
  return Array.from(dates);
}
