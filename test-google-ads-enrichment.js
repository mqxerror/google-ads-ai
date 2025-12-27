/**
 * Test Google Ads keyword enrichment directly
 * Run this to diagnose why enrichment isn't working
 */

const { enrichKeywordsWithMetrics } = require('./src/lib/keyword-data');

async function test() {
  console.log('Testing Google Ads keyword enrichment...\n');

  // Test keywords
  const keywords = ['seo services', 'ppc management', 'google ads agency'];

  console.log('Test keywords:', keywords);
  console.log('\nCalling enrichKeywordsWithMetrics...\n');

  try {
    const result = await enrichKeywordsWithMetrics(keywords, {
      locale: 'en-US',
      device: 'desktop',
      providers: ['google_ads'],
      useCache: false, // Disable cache for this test
      forceRefresh: true,
      locationId: '2840', // US
      // Note: We need actual session tokens for this to work
      // These would come from the user's session
    });

    console.log('\n=== RESULTS ===');
    console.log('Total Requested:', result.stats.totalRequested);
    console.log('Cached:', result.stats.cached);
    console.log('Google Fetched:', result.stats.googleFetched);
    console.log('Failed:', result.stats.failed);
    console.log('Enriched Keywords:', result.enriched.size);

    if (result.enriched.size > 0) {
      console.log('\nSample enriched keyword:');
      const first = Array.from(result.enriched.values())[0];
      console.log(JSON.stringify(first, null, 2));
    }

    if (result.stats.errors.length > 0) {
      console.log('\nErrors:');
      result.stats.errors.forEach(err => {
        console.log(`  - ${err.keyword} (${err.provider}): ${err.error}`);
      });
    }

    console.log('\n✓ Test complete');
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
  }
}

test();
