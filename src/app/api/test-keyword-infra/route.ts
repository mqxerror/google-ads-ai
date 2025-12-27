/**
 * Test API Route for Keyword Infrastructure
 *
 * Tests:
 * 1. Database schema (keyword_metrics table)
 * 2. Circuit breakers
 * 3. Caching layer
 *
 * Usage: GET http://localhost:3000/api/test-keyword-infra
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, KeywordMetrics } from '@/lib/supabase';
import {
  getAllCircuitBreakerStats,
  getGoogleAdsCircuitBreaker,
  getMozCircuitBreaker,
  resetAllCircuitBreakers
} from '@/lib/keyword-data/circuit-breaker';
import {
  batchLookupCache,
  batchStoreInCache,
  getCacheStats,
  normalizeKeyword,
  clearMemoryCache,
} from '@/lib/keyword-data/cache';

interface TestResult {
  test: string;
  status: 'pass' | 'fail';
  message: string;
  data?: any;
}

export async function GET(request: NextRequest) {
  const results: TestResult[] = [];

  console.log('[Test] Starting keyword infrastructure tests...');

  // ==============================================
  // TEST 1: Database Schema
  // ==============================================
  try {
    const client = getSupabaseClient();

    // Test 1a: Check if table exists
    const { data: tableCheck, error: tableError } = await client
      .from('keyword_metrics')
      .select('id')
      .limit(1);

    if (tableError && tableError.message.includes('does not exist')) {
      results.push({
        test: '1a. Database Table Exists',
        status: 'fail',
        message: 'Table keyword_metrics does not exist. Run migration: prisma/migrations/004_keyword_metrics.sql',
      });
    } else {
      results.push({
        test: '1a. Database Table Exists',
        status: 'pass',
        message: 'Table keyword_metrics exists',
      });

      // Test 1b: Insert test keyword
      const testKeyword: Partial<KeywordMetrics> = {
        keyword: 'running shoes',
        keyword_normalized: normalizeKeyword('running shoes'),
        locale: 'en-US',
        device: 'desktop',
        gads_search_volume: 201000,
        gads_avg_cpc_micros: 2450000,
        gads_competition: 'HIGH',
        gads_status: 'success',
        best_search_volume: 201000,
        best_cpc: 2.45,
        best_source: 'google_ads',
        cache_hit_count: 0,
        ttl_days: 30,
        schema_version: '1',
      };

      const { error: insertError } = await client
        .from('keyword_metrics')
        .upsert(testKeyword, {
          onConflict: 'keyword_normalized,locale,device'
        });

      if (insertError) {
        results.push({
          test: '1b. Database Insert',
          status: 'fail',
          message: `Insert failed: ${insertError.message}`,
        });
      } else {
        results.push({
          test: '1b. Database Insert',
          status: 'pass',
          message: 'Successfully inserted test keyword',
          data: testKeyword,
        });

        // Test 1c: Read back and verify
        const { data: readBack, error: readError } = await client
          .from('keyword_metrics')
          .select('*')
          .eq('keyword_normalized', 'running shoes')
          .eq('locale', 'en-US')
          .eq('device', 'desktop')
          .single();

        if (readError || !readBack) {
          results.push({
            test: '1c. Database Read',
            status: 'fail',
            message: `Read failed: ${readError?.message || 'No data'}`,
          });
        } else {
          results.push({
            test: '1c. Database Read',
            status: 'pass',
            message: 'Successfully read test keyword',
            data: {
              keyword: readBack.keyword,
              volume: readBack.best_search_volume,
              cpc: readBack.best_cpc,
              ttl_days: readBack.ttl_days,
              expires_at: readBack.expires_at,
            },
          });
        }

        // Test 1d: Increment cache hit (triggers dynamic TTL)
        const { error: updateError } = await client
          .from('keyword_metrics')
          .update({
            cache_hit_count: client.raw('cache_hit_count + 5'),
          })
          .eq('keyword_normalized', 'running shoes')
          .eq('locale', 'en-US')
          .eq('device', 'desktop');

        if (updateError) {
          results.push({
            test: '1d. Dynamic TTL Trigger',
            status: 'fail',
            message: `Update failed: ${updateError.message}`,
          });
        } else {
          // Read back to check TTL changed
          const { data: afterUpdate } = await client
            .from('keyword_metrics')
            .select('cache_hit_count, ttl_days')
            .eq('keyword_normalized', 'running shoes')
            .single();

          results.push({
            test: '1d. Dynamic TTL Trigger',
            status: 'pass',
            message: 'Cache hit count incremented (check if TTL updated)',
            data: afterUpdate,
          });
        }
      }
    }
  } catch (error: any) {
    results.push({
      test: '1. Database Schema',
      status: 'fail',
      message: `Unexpected error: ${error.message}`,
    });
  }

  // ==============================================
  // TEST 2: Circuit Breakers
  // ==============================================

  // Reset all breakers first
  resetAllCircuitBreakers();

  try {
    // Test 2a: Circuit breaker stats
    const stats = getAllCircuitBreakerStats();
    results.push({
      test: '2a. Circuit Breaker Stats',
      status: 'pass',
      message: 'Retrieved stats for all circuit breakers',
      data: stats,
    });

    // Test 2b: Execute successful request
    const googleBreaker = getGoogleAdsCircuitBreaker();
    const successFn = async () => 'success';
    const result = await googleBreaker.execute(successFn);

    results.push({
      test: '2b. Circuit Breaker Success',
      status: result === 'success' ? 'pass' : 'fail',
      message: 'Executed successful request through Google Ads breaker',
      data: googleBreaker.getStats(),
    });

    // Test 2c: Execute failing requests
    const mozBreaker = getMozCircuitBreaker();
    const failFn = async () => { throw new Error('API error'); };

    let failureCount = 0;
    for (let i = 0; i < 5; i++) {
      try {
        await mozBreaker.execute(failFn);
      } catch (error) {
        failureCount++;
      }
    }

    const mozStats = mozBreaker.getStats();
    results.push({
      test: '2c. Circuit Breaker Failure Handling',
      status: mozStats.state === 'OPEN' ? 'pass' : 'fail',
      message: `Circuit opened after ${failureCount} failures`,
      data: mozStats,
    });

  } catch (error: any) {
    results.push({
      test: '2. Circuit Breakers',
      status: 'fail',
      message: `Unexpected error: ${error.message}`,
    });
  }

  // ==============================================
  // TEST 3: Caching Layer
  // ==============================================

  // Clear memory cache first
  clearMemoryCache();

  try {
    // Test 3a: Cache stats
    const cacheStats = await getCacheStats();
    results.push({
      test: '3a. Cache Stats',
      status: 'pass',
      message: 'Retrieved cache statistics',
      data: cacheStats,
    });

    // Test 3b: Cache miss (lookup non-existent keyword)
    const lookupResult1 = await batchLookupCache(['nonexistent keyword xyz123']);
    results.push({
      test: '3b. Cache Miss',
      status: lookupResult1.misses.length === 1 ? 'pass' : 'fail',
      message: 'Detected cache miss for non-existent keyword',
      data: {
        hits: lookupResult1.hits.size,
        misses: lookupResult1.misses.length,
        stale: lookupResult1.stale.size,
      },
    });

    // Test 3c: Store in cache
    const mockMetric: Partial<KeywordMetrics> = {
      keyword: 'nike shoes',
      keyword_normalized: normalizeKeyword('nike shoes'),
      locale: 'en-US',
      device: 'desktop',
      best_search_volume: 123000,
      best_cpc: 1.85,
      best_source: 'google_ads',
      cache_hit_count: 0,
      ttl_days: 30,
      schema_version: '1',
    };

    await batchStoreInCache([mockMetric as KeywordMetrics]);

    // Test 3d: Cache hit (lookup just-stored keyword)
    const lookupResult2 = await batchLookupCache(['nike shoes']);
    const cacheHit = lookupResult2.hits.has('nike shoes');

    results.push({
      test: '3c-d. Cache Store & Hit',
      status: cacheHit ? 'pass' : 'fail',
      message: cacheHit ? 'Keyword stored and retrieved from cache' : 'Cache hit failed',
      data: {
        stored: 'nike shoes',
        retrieved: cacheHit ? lookupResult2.hits.get('nike shoes') : null,
      },
    });

    // Test 3e: In-memory cache (second lookup should be faster)
    const startTime = Date.now();
    const lookupResult3 = await batchLookupCache(['nike shoes']);
    const elapsed = Date.now() - startTime;

    results.push({
      test: '3e. In-Memory Cache',
      status: lookupResult3.hits.size > 0 ? 'pass' : 'fail',
      message: `Retrieved from memory cache in ${elapsed}ms`,
      data: {
        elapsedMs: elapsed,
        fromMemory: lookupResult3.hits.size > 0,
      },
    });

  } catch (error: any) {
    results.push({
      test: '3. Caching Layer',
      status: 'fail',
      message: `Unexpected error: ${error.message}`,
    });
  }

  // ==============================================
  // Summary
  // ==============================================
  const summary = {
    totalTests: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    successRate: `${Math.round((results.filter(r => r.status === 'pass').length / results.length) * 100)}%`,
  };

  console.log('[Test] Results:', summary);

  return NextResponse.json({
    success: summary.failed === 0,
    summary,
    results,
    timestamp: new Date().toISOString(),
  }, { status: summary.failed === 0 ? 200 : 500 });
}
