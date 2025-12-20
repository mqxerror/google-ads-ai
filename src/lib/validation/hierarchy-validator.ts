/**
 * Hierarchy Validator
 *
 * Ensures data consistency across entity levels:
 * Campaign → Ad Groups → Keywords → Ads
 *
 * Validates that child entity metrics don't exceed parent totals
 * within configurable tolerances.
 */

export interface MetricValues {
  impressions: number;
  clicks: number;
  cost: number; // Already converted from micros (in dollars)
  conversions: number;
  conversionsValue?: number;
}

export interface ValidationResult {
  isValid: boolean;
  discrepancies: MetricDiscrepancy[];
  summary: string;
}

export interface MetricDiscrepancy {
  metric: keyof MetricValues;
  parentValue: number;
  childSum: number;
  difference: number;
  percentDiff: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

// Tolerance thresholds (as percentages)
// These account for rounding, attribution windows, and API timing differences
export const TOLERANCES = {
  // Strict metrics - should be very close
  impressions: 0.1,    // 0.1% tolerance
  clicks: 0.1,         // 0.1% tolerance
  cost: 0.5,           // 0.5% tolerance (rounding from micros)

  // Flexible metrics - attribution can cause differences
  conversions: 5.0,    // 5% tolerance (attribution models)
  conversionsValue: 5.0, // 5% tolerance
} as const;

// Absolute tolerances for small values
const ABSOLUTE_TOLERANCES = {
  impressions: 1,
  clicks: 1,
  cost: 0.01,         // 1 cent
  conversions: 0.1,   // 0.1 conversions
  conversionsValue: 0.01,
} as const;

/**
 * Validate that child entity metrics are consistent with parent
 *
 * @param parent - Parent entity metrics (e.g., campaign)
 * @param children - Array of child entity metrics (e.g., ad groups)
 * @param options - Validation options
 * @returns ValidationResult with discrepancies
 */
export function validateHierarchy(
  parent: MetricValues,
  children: MetricValues[],
  options: {
    parentName?: string;
    childrenName?: string;
    isPartialData?: boolean;
    customTolerances?: Partial<typeof TOLERANCES>;
  } = {}
): ValidationResult {
  const {
    parentName = 'Parent',
    childrenName = 'Children',
    isPartialData = false,
    customTolerances = {},
  } = options;

  // If partial data (includes today), skip strict validation
  if (isPartialData) {
    return {
      isValid: true,
      discrepancies: [],
      summary: 'Validation skipped: partial data includes today',
    };
  }

  const tolerances = { ...TOLERANCES, ...customTolerances };
  const discrepancies: MetricDiscrepancy[] = [];

  // Sum child metrics
  const childSum: MetricValues = {
    impressions: children.reduce((sum, c) => sum + (c.impressions || 0), 0),
    clicks: children.reduce((sum, c) => sum + (c.clicks || 0), 0),
    cost: children.reduce((sum, c) => sum + (c.cost || 0), 0),
    conversions: children.reduce((sum, c) => sum + (c.conversions || 0), 0),
    conversionsValue: children.reduce((sum, c) => sum + (c.conversionsValue || 0), 0),
  };

  // Check each metric
  const metricsToCheck: (keyof MetricValues)[] = ['impressions', 'clicks', 'cost', 'conversions'];

  for (const metric of metricsToCheck) {
    const parentValue = parent[metric] || 0;
    const sumValue = childSum[metric] || 0;
    const difference = sumValue - parentValue;

    // Skip if both are zero
    if (parentValue === 0 && sumValue === 0) continue;

    // Calculate percent difference (relative to parent)
    const percentDiff = parentValue !== 0
      ? (difference / parentValue) * 100
      : (sumValue > 0 ? 100 : 0);

    const tolerance = tolerances[metric] || 1;
    const absoluteTolerance = ABSOLUTE_TOLERANCES[metric] || 0;

    // Check if within tolerance (either relative or absolute)
    const withinRelativeTolerance = Math.abs(percentDiff) <= tolerance;
    const withinAbsoluteTolerance = Math.abs(difference) <= absoluteTolerance;

    if (!withinRelativeTolerance && !withinAbsoluteTolerance) {
      // Child sum exceeds parent = error (impossible without data issues)
      // Child sum less than parent = warning (possible with filtering/removed entities)
      const severity: MetricDiscrepancy['severity'] =
        difference > 0 ? 'error' :
        Math.abs(percentDiff) > tolerance * 2 ? 'warning' : 'info';

      const metricLabel = metric === 'cost' ? 'spend' : metric;
      const direction = difference > 0 ? 'exceeds' : 'is less than';

      discrepancies.push({
        metric,
        parentValue,
        childSum: sumValue,
        difference,
        percentDiff,
        severity,
        message: `${childrenName} ${metricLabel} (${formatMetricValue(metric, sumValue)}) ${direction} ${parentName} (${formatMetricValue(metric, parentValue)}) by ${formatMetricValue(metric, Math.abs(difference))} (${Math.abs(percentDiff).toFixed(1)}%)`,
      });
    }
  }

  const hasErrors = discrepancies.some(d => d.severity === 'error');
  const hasWarnings = discrepancies.some(d => d.severity === 'warning');

  let summary: string;
  if (discrepancies.length === 0) {
    summary = `${childrenName} metrics are consistent with ${parentName}`;
  } else if (hasErrors) {
    summary = `Data inconsistency detected: ${discrepancies.filter(d => d.severity === 'error').length} metric(s) exceed parent totals`;
  } else if (hasWarnings) {
    summary = `Minor discrepancies detected: ${discrepancies.length} metric(s) differ from expected`;
  } else {
    summary = `${discrepancies.length} minor difference(s) within acceptable range`;
  }

  return {
    isValid: !hasErrors,
    discrepancies,
    summary,
  };
}

/**
 * Format metric value for display
 */
function formatMetricValue(metric: keyof MetricValues, value: number): string {
  switch (metric) {
    case 'cost':
    case 'conversionsValue':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'conversions':
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    default:
      return value.toLocaleString('en-US');
  }
}

/**
 * Quick check if child sum exceeds parent for a single metric
 */
export function checkMetricExceedsParent(
  parentValue: number,
  childSum: number,
  metric: keyof MetricValues = 'cost'
): boolean {
  const tolerance = TOLERANCES[metric] || 1;
  const absoluteTolerance = ABSOLUTE_TOLERANCES[metric] || 0;

  const difference = childSum - parentValue;
  const percentDiff = parentValue !== 0 ? (difference / parentValue) * 100 : 0;

  return difference > 0 &&
         Math.abs(percentDiff) > tolerance &&
         Math.abs(difference) > absoluteTolerance;
}

/**
 * Create a validation context for logging
 */
export function createValidationContext(
  customerId: string,
  dateRange: { startDate: string; endDate: string },
  entityType: 'campaign' | 'adGroup' | 'keyword'
): string {
  return `[Validation] Customer: ${customerId}, Date: ${dateRange.startDate} to ${dateRange.endDate}, Entity: ${entityType}`;
}
