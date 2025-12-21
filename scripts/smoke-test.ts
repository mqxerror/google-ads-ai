#!/usr/bin/env npx tsx
/**
 * Smoke Test Script
 *
 * Tests the main user flow:
 * 1. Check auth status
 * 2. Load accounts
 * 3. Load campaigns for an account
 * 4. Load ad groups for a campaign
 * 5. Load keywords for an ad group
 * 6. Check ops diagnostics
 *
 * Usage: npm run smoke-test
 *
 * Requirements:
 * - Dev server running on localhost:3001
 * - Valid session cookie (or demo mode)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TIMEOUT_MS = 30000;

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function test(name: string, fn: () => Promise<unknown>): Promise<TestResult> {
  const start = Date.now();
  try {
    const data = await fn();
    const result: TestResult = {
      name,
      status: 'pass',
      duration: Date.now() - start,
      data,
    };
    results.push(result);
    console.log(`✅ ${name} (${result.duration}ms)`);
    return result;
  } catch (error) {
    const result: TestResult = {
      name,
      status: 'fail',
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
    results.push(result);
    console.log(`❌ ${name} (${result.duration}ms): ${result.error}`);
    return result;
  }
}

function skip(name: string, reason: string): TestResult {
  const result: TestResult = {
    name,
    status: 'skip',
    duration: 0,
    error: reason,
  };
  results.push(result);
  console.log(`⏭️  ${name}: ${reason}`);
  return result;
}

async function main() {
  console.log('\n🔥 SMOKE TEST - Google Ads Manager\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms\n`);
  console.log('─'.repeat(50));

  // Store context between tests
  let accountId: string | null = null;
  let customerId: string | null = null;
  let campaignId: string | null = null;
  let adGroupId: string | null = null;

  // Test 1: Check server is up
  await test('1. Server health check', async () => {
    const response = await fetchWithTimeout(`${BASE_URL}/api/health`);
    // Health endpoint may not exist, try accounts as fallback
    if (!response.ok && response.status !== 401) {
      const fallback = await fetchWithTimeout(`${BASE_URL}/api/accounts`);
      if (!fallback.ok && fallback.status !== 401) {
        throw new Error(`Server not responding properly: ${fallback.status}`);
      }
    }
    return { status: 'Server is up' };
  });

  // Test 2: Load accounts
  const accountsResult = await test('2. Load accounts (/api/accounts)', async () => {
    const response = await fetchWithTimeout(`${BASE_URL}/api/accounts`);
    if (response.status === 401) {
      throw new Error('Not authenticated - need valid session');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data.accounts || data.accounts.length === 0) {
      throw new Error('No accounts found');
    }

    // Pick first non-manager account
    const clientAccount = data.accounts.find((a: { isManager: boolean }) => !a.isManager);
    if (!clientAccount) {
      throw new Error('No client (non-manager) accounts found');
    }

    accountId = clientAccount.id;
    customerId = clientAccount.googleAccountId;

    return {
      totalAccounts: data.accounts.length,
      selectedAccount: clientAccount.accountName,
      accountId,
      customerId,
    };
  });

  // Test 3: Load campaigns
  if (!accountId) {
    skip('3. Load campaigns', 'No account available');
  } else {
    const campaignsResult = await test('3. Load campaigns (/api/google-ads/campaigns)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const params = new URLSearchParams({
        accountId: accountId!,
        startDate: yesterday,
        endDate: today,
      });

      const response = await fetchWithTimeout(`${BASE_URL}/api/google-ads/campaigns?${params}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      const data = await response.json();

      // Pick first enabled campaign
      const campaigns = data.campaigns || [];
      const enabledCampaign = campaigns.find((c: { status: string }) => c.status === 'ENABLED');
      if (enabledCampaign) {
        campaignId = enabledCampaign.campaignId || enabledCampaign.id;
      } else if (campaigns.length > 0) {
        campaignId = campaigns[0].campaignId || campaigns[0].id;
      }

      return {
        totalCampaigns: campaigns.length,
        enabledCampaigns: campaigns.filter((c: { status: string }) => c.status === 'ENABLED').length,
        selectedCampaign: campaignId,
        freshness: data.freshness,
      };
    });
  }

  // Test 4: Load ad groups
  if (!campaignId) {
    skip('4. Load ad groups', 'No campaign available');
  } else {
    await test('4. Load ad groups (/api/google-ads/ad-groups)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const params = new URLSearchParams({
        accountId: accountId!,
        campaignId: campaignId!,
        startDate: yesterday,
        endDate: today,
      });

      const response = await fetchWithTimeout(`${BASE_URL}/api/google-ads/ad-groups?${params}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      const data = await response.json();

      // Pick first ad group
      const adGroups = data.adGroups || [];
      if (adGroups.length > 0) {
        adGroupId = adGroups[0].adGroupId || adGroups[0].id;
      }

      return {
        totalAdGroups: adGroups.length,
        selectedAdGroup: adGroupId,
        freshness: data.freshness,
      };
    });
  }

  // Test 5: Load keywords
  if (!adGroupId) {
    skip('5. Load keywords', 'No ad group available');
  } else {
    await test('5. Load keywords (/api/google-ads/keywords)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const params = new URLSearchParams({
        accountId: accountId!,
        adGroupId: adGroupId!,
        startDate: yesterday,
        endDate: today,
      });

      const response = await fetchWithTimeout(`${BASE_URL}/api/google-ads/keywords?${params}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      const keywords = data.keywords || [];

      return {
        totalKeywords: keywords.length,
        freshness: data.freshness,
      };
    });
  }

  // Test 6: Ops Diagnostics
  await test('6. Ops diagnostics (/api/admin/diagnostics)', async () => {
    const params = customerId
      ? new URLSearchParams({
          customerId: customerId!,
          startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
        })
      : new URLSearchParams();

    const response = await fetchWithTimeout(`${BASE_URL}/api/admin/diagnostics?${params}`);
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    if (response.status === 403) {
      throw new Error('Not authorized for admin access');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    const data = await response.json();

    return {
      redis: data.redis?.available ? '✅ Connected' : '❌ Unavailable',
      queue: data.queue?.ready ? '✅ Ready' : '⚠️ Not Ready',
      worker: data.worker?.status === 'active' ? '✅ Active' : `⚠️ ${data.worker?.status || 'Unknown'}`,
      database: data.database ? `✅ ${data.database.totalRows} rows` : '❌ Error',
      dbError: data.dbError,
      entityCoverageError: data.entityCoverageError,
    };
  });

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log('\n📊 SUMMARY\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  console.log(`   Passed:  ${passed}`);
  console.log(`   Failed:  ${failed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total:   ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ SMOKE TEST FAILED\n');
    console.log('Failed tests:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ SMOKE TEST PASSED\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n💥 Smoke test crashed:', error);
  process.exit(1);
});
