/**
 * Feature Flags Configuration
 *
 * Controls risky or experimental features that can be disabled without redeploy.
 * All flags default to enabled for backwards compatibility.
 *
 * Environment variables:
 * - FF_HYBRID_FETCH=false - Disable hybrid fetch (cache + API fallback)
 * - FF_QUEUE_REFRESH=false - Disable background queue refresh
 * - FF_HIERARCHY_VALIDATION=false - Disable hierarchy validation
 * - FF_DATE_RANGE_ANALYSIS=false - Disable date range analysis
 *
 * Usage:
 * ```ts
 * import { isEnabled } from '@/lib/feature-flags';
 *
 * if (isEnabled('HYBRID_FETCH')) {
 *   // Use hybrid fetch
 * } else {
 *   // Fall back to direct API calls
 * }
 * ```
 */

export type FeatureFlag =
  | 'HYBRID_FETCH'           // Cache-first with API fallback
  | 'QUEUE_REFRESH'          // Background refresh via BullMQ
  | 'HIERARCHY_VALIDATION'   // Sampled hierarchy validation
  | 'DATE_RANGE_ANALYSIS'    // Date range coverage analysis
  | 'INLINE_REFRESH'         // Inline refresh for missing data
  | 'WORKER_HEARTBEAT'       // Worker heartbeat monitoring
  | 'SMART_PREWARM';         // Pre-warm ad groups for top campaigns (opt-in)

interface FeatureFlagConfig {
  envVar: string;
  defaultValue: boolean;
  description: string;
}

const FLAG_CONFIG: Record<FeatureFlag, FeatureFlagConfig> = {
  HYBRID_FETCH: {
    envVar: 'FF_HYBRID_FETCH',
    defaultValue: true,
    description: 'Cache-first fetch with API fallback for missing date ranges',
  },
  QUEUE_REFRESH: {
    envVar: 'FF_QUEUE_REFRESH',
    defaultValue: true,
    description: 'Background refresh via BullMQ queue',
  },
  HIERARCHY_VALIDATION: {
    envVar: 'FF_HIERARCHY_VALIDATION',
    defaultValue: true,
    description: 'Sampled validation of entity hierarchy consistency',
  },
  DATE_RANGE_ANALYSIS: {
    envVar: 'FF_DATE_RANGE_ANALYSIS',
    defaultValue: true,
    description: 'Analysis of cached data coverage for date ranges',
  },
  INLINE_REFRESH: {
    envVar: 'FF_INLINE_REFRESH',
    defaultValue: true,
    description: 'Inline API fetch for missing data chunks',
  },
  WORKER_HEARTBEAT: {
    envVar: 'FF_WORKER_HEARTBEAT',
    defaultValue: true,
    description: 'Worker heartbeat monitoring via Redis',
  },
  SMART_PREWARM: {
    envVar: 'FF_SMART_PREWARM',
    defaultValue: false,  // Opt-in: disabled by default
    description: 'Pre-warm ad groups cache for top campaigns (by spend)',
  },
};

// Cache for parsed flag values
const flagCache = new Map<FeatureFlag, boolean>();

/**
 * Check if a feature flag is enabled
 *
 * @param flag - The feature flag to check
 * @returns true if the feature is enabled
 */
export function isEnabled(flag: FeatureFlag): boolean {
  // Check cache first
  if (flagCache.has(flag)) {
    return flagCache.get(flag)!;
  }

  const config = FLAG_CONFIG[flag];
  if (!config) {
    console.warn(`[FeatureFlags] Unknown flag: ${flag}`);
    return true; // Default to enabled for unknown flags
  }

  // Read from environment variable
  const envValue = process.env[config.envVar];

  let enabled: boolean;
  if (envValue === undefined || envValue === '') {
    // Use default if not set
    enabled = config.defaultValue;
  } else {
    // Parse as boolean: 'false', '0', 'no', 'off' are false, everything else is true
    enabled = !['false', '0', 'no', 'off', 'disabled'].includes(envValue.toLowerCase());
  }

  // Cache the result
  flagCache.set(flag, enabled);

  return enabled;
}

/**
 * Check if a feature flag is disabled
 *
 * @param flag - The feature flag to check
 * @returns true if the feature is disabled
 */
export function isDisabled(flag: FeatureFlag): boolean {
  return !isEnabled(flag);
}

/**
 * Get all feature flag states (for diagnostics)
 *
 * @returns Object with all flag states
 */
export function getAllFlags(): Record<FeatureFlag, { enabled: boolean; envVar: string; description: string }> {
  const flags = Object.keys(FLAG_CONFIG) as FeatureFlag[];

  return flags.reduce((acc, flag) => {
    const config = FLAG_CONFIG[flag];
    acc[flag] = {
      enabled: isEnabled(flag),
      envVar: config.envVar,
      description: config.description,
    };
    return acc;
  }, {} as Record<FeatureFlag, { enabled: boolean; envVar: string; description: string }>);
}

/**
 * Clear the flag cache (useful for testing)
 */
export function clearFlagCache(): void {
  flagCache.clear();
}

/**
 * Log all feature flag states
 */
export function logFlags(): void {
  const flags = getAllFlags();
  console.log('[FeatureFlags] Current state:');
  Object.entries(flags).forEach(([flag, state]) => {
    const icon = state.enabled ? '✅' : '❌';
    console.log(`  ${icon} ${flag}: ${state.enabled ? 'enabled' : 'disabled'} (${state.envVar})`);
  });
}
