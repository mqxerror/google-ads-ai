#!/usr/bin/env npx tsx
/**
 * Date Range Regression Test
 *
 * Tests that date range switching produces:
 * 1. Different totals for different ranges
 * 2. Different cache keys
 * 3. Consistent _meta.queryContext
 * 4. Yesterday = exactly 1-day window
 *
 * Usage: npm run test:date-range
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TIMEOUT_MS = 30000;

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

interface CampaignResponse {
  campaigns: Array<{
    campaignId: string;
    name: string;
    impressions: number;
    clicks: number;
    cost: number;
  }>;
  _meta: {
    queryContext: {
      startDate: string;
      endDate: string;
      timezone: string;
      includeToday: boolean;
      conversionMode: string;
      requestedPreset?: string;
    };
    datesCovered: {
      minDate: string | null;
      maxDate: string | null;
      count: number;
      expectedCount: number;
      coveragePercent: number;
      isComplete: boolean;
    };
    missingDays: string[];
    warnings: string[];
    cacheKey: string;
    source: string;
  };
}

const results: TestResult[] = [];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateRanges() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const last7DaysStart = new Date(today);
  last7DaysStart.setDate(last7DaysStart.getDate() - 6);

  return {
    yesterday: {
      startDate: formatDate(yesterday),
      endDate: formatDate(yesterday),
      preset: 'yesterday',
    },
    last7Days: {
      startDate: formatDate(last7DaysStart),
      endDate: formatDate(today),
      preset: 'last7days',
    },
    today: {
      startDate: formatDate(today),
      endDate: formatDate(today),
      preset: 'today',
    },
  };
}

async function fetchCampaigns(
  accountId: string,
  startDate: string,
  endDate: string,
  preset?: string
): Promise<CampaignResponse | null> {
  const params = new URLSearchParams({
    accountId,
    startDate,
    endDate,
  });
  if (preset) {
    params.set('preset', preset);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/google-ads/campaigns?${params}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`Failed to fetch: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Fetch error:', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getFirstAccountId(): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}/api/accounts`);
    if (!response.ok) return null;
    const data = await response.json();
    const client = data.accounts?.find((a: { isManager: boolean }) => !a.isManager);
    return client?.id || null;
  } catch {
    return null;
  }
}

function calculateTotals(campaigns: CampaignResponse['campaigns']) {
  return campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + (c.impressions || 0),
      clicks: acc.clicks + (c.clicks || 0),
      cost: acc.cost + (c.cost || 0),
    }),
    { impressions: 0, clicks: 0, cost: 0 }
  );
}

async function test(name: string, fn: () => Promise<boolean | string>): Promise<void> {
  try {
    const result = await fn();
    if (typeof result === 'string') {
      results.push({ name, passed: false, error: result });
      console.log(`❌ ${name}: ${result}`);
    } else {
      results.push({ name, passed: result });
      console.log(`${result ? '✅' : '❌'} ${name}`);
    }
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(`❌ ${name}: ${error}`);
  }
}

async function main() {
  console.log('\n📅 DATE RANGE REGRESSION TEST\n');
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log('─'.repeat(60));

  // Get account ID
  const accountId = await getFirstAccountId();
  if (!accountId) {
    console.error('❌ No account found. Make sure the server is running and you have accounts.');
    process.exit(1);
  }
  console.log(`\nUsing account: ${accountId}\n`);

  const ranges = getDateRanges();

  // Fetch data for each range
  console.log('Fetching data for different date ranges...\n');

  const yesterdayData = await fetchCampaigns(
    accountId,
    ranges.yesterday.startDate,
    ranges.yesterday.endDate,
    ranges.yesterday.preset
  );

  const last7DaysData = await fetchCampaigns(
    accountId,
    ranges.last7Days.startDate,
    ranges.last7Days.endDate,
    ranges.last7Days.preset
  );

  const last7DaysData2 = await fetchCampaigns(
    accountId,
    ranges.last7Days.startDate,
    ranges.last7Days.endDate,
    ranges.last7Days.preset
  );

  if (!yesterdayData || !last7DaysData || !last7DaysData2) {
    console.error('❌ Failed to fetch campaign data');
    process.exit(1);
  }

  console.log('\n─'.repeat(60));
  console.log('\nRUNNING TESTS:\n');

  // Test 1: _meta.queryContext exists and matches request
  await test('1. Yesterday queryContext matches request', async () => {
    const ctx = yesterdayData._meta?.queryContext;
    if (!ctx) return 'Missing _meta.queryContext';
    if (ctx.startDate !== ranges.yesterday.startDate) return `startDate mismatch: ${ctx.startDate} vs ${ranges.yesterday.startDate}`;
    if (ctx.endDate !== ranges.yesterday.endDate) return `endDate mismatch: ${ctx.endDate} vs ${ranges.yesterday.endDate}`;
    if (ctx.requestedPreset !== 'yesterday') return `preset mismatch: ${ctx.requestedPreset}`;
    return true;
  });

  // Test 2: Yesterday is exactly 1-day window
  await test('2. Yesterday is exactly 1-day window', async () => {
    const ctx = yesterdayData._meta?.queryContext;
    if (!ctx) return 'Missing queryContext';
    const start = new Date(ctx.startDate);
    const end = new Date(ctx.endDate);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days !== 1) return `Expected 1 day, got ${days} days (${ctx.startDate} to ${ctx.endDate})`;
    return true;
  });

  // Test 3: Last 7 days is exactly 7-day window
  await test('3. Last 7 Days is exactly 7-day window', async () => {
    const ctx = last7DaysData._meta?.queryContext;
    if (!ctx) return 'Missing queryContext';
    const start = new Date(ctx.startDate);
    const end = new Date(ctx.endDate);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days !== 7) return `Expected 7 days, got ${days} days (${ctx.startDate} to ${ctx.endDate})`;
    return true;
  });

  // Test 4: datesCovered exists with correct structure
  await test('4. datesCovered has required fields', async () => {
    const dc = yesterdayData._meta?.datesCovered;
    if (!dc) return 'Missing datesCovered';
    if (typeof dc.count !== 'number') return 'Missing count';
    if (typeof dc.expectedCount !== 'number') return 'Missing expectedCount';
    if (typeof dc.coveragePercent !== 'number') return 'Missing coveragePercent';
    if (typeof dc.isComplete !== 'boolean') return 'Missing isComplete';
    return true;
  });

  // Test 5: Different ranges have different cache keys
  await test('5. Different ranges have different cache keys', async () => {
    const key1 = yesterdayData._meta?.cacheKey;
    const key2 = last7DaysData._meta?.cacheKey;
    if (!key1 || !key2) return 'Missing cache keys';
    if (key1 === key2) return `Cache keys should be different: ${key1}`;
    return true;
  });

  // Test 6: Same range produces same cache key (idempotent)
  await test('6. Same range produces same cache key', async () => {
    const key1 = last7DaysData._meta?.cacheKey;
    const key2 = last7DaysData2._meta?.cacheKey;
    if (!key1 || !key2) return 'Missing cache keys';
    if (key1 !== key2) return `Cache keys should match: ${key1} vs ${key2}`;
    return true;
  });

  // Test 7: Totals are different for different ranges (if data exists)
  await test('7. Different ranges can have different totals', async () => {
    const totals1 = calculateTotals(yesterdayData.campaigns);
    const totals7 = calculateTotals(last7DaysData.campaigns);

    console.log(`   Yesterday totals: ${totals1.impressions} impr, ${totals1.clicks} clicks, $${totals1.cost.toFixed(2)}`);
    console.log(`   Last 7 Days totals: ${totals7.impressions} impr, ${totals7.clicks} clicks, $${totals7.cost.toFixed(2)}`);

    // If both have data and totals are identical, that's suspicious
    if (totals1.impressions > 0 && totals7.impressions > 0) {
      if (totals1.impressions === totals7.impressions &&
          totals1.clicks === totals7.clicks &&
          Math.abs(totals1.cost - totals7.cost) < 0.01) {
        return 'WARNING: Yesterday and Last 7 Days have identical totals - this may indicate a bug';
      }
    }
    return true;
  });

  // Test 8: missingDays array exists
  await test('8. missingDays array exists', async () => {
    if (!Array.isArray(yesterdayData._meta?.missingDays)) return 'Missing missingDays array';
    if (!Array.isArray(last7DaysData._meta?.missingDays)) return 'Missing missingDays array';
    return true;
  });

  // Test 9: warnings array exists
  await test('9. warnings array exists', async () => {
    if (!Array.isArray(yesterdayData._meta?.warnings)) return 'Missing warnings array';
    return true;
  });

  // Test 10: Coverage percent is reasonable
  await test('10. Coverage percent is between 0-100', async () => {
    const pct = last7DaysData._meta?.datesCovered?.coveragePercent;
    if (typeof pct !== 'number') return 'Missing coveragePercent';
    if (pct < 0 || pct > 100) return `Invalid coverage percent: ${pct}`;
    console.log(`   Coverage: ${pct}% (${last7DaysData._meta.datesCovered.count}/${last7DaysData._meta.datesCovered.expectedCount} days)`);
    return true;
  });

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log('\n📊 SUMMARY\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total:  ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ DATE RANGE TESTS FAILED\n');
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ ALL DATE RANGE TESTS PASSED\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n💥 Test crashed:', error);
  process.exit(1);
});
