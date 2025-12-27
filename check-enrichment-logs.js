const { Pool } = require('pg');

async function checkLogs() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '38.97.60.181',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: process.env.POSTGRES_DB || 'google_ads_manager',
  });

  console.log('Checking enrichment logs...\n');

  try {
    const result = await pool.query(`
      SELECT
        request_id,
        created_at,
        keywords,
        selected_providers,
        cache_hits,
        cache_misses,
        status,
        error_message,
        quota_check_result
      FROM enrichment_logs
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log(`Found ${result.rows.length} enrichment logs:\n`);

    result.rows.forEach((log, i) => {
      console.log(`=== Log ${i + 1} ===`);
      console.log(`Request ID: ${log.request_id}`);
      console.log(`Created: ${log.created_at}`);
      console.log(`Keywords: ${log.keywords?.length || 0} total`);
      console.log(`Selected Providers: ${JSON.stringify(log.selected_providers)}`);
      console.log(`Cache Hits: ${log.cache_hits}`);
      console.log(`Cache Misses: ${log.cache_misses}`);
      console.log(`Status: ${log.status}`);
      console.log(`Error: ${log.error_message || 'None'}`);
      console.log(`Quota Check:`);
      console.log(JSON.stringify(log.quota_check_result, null, 2));
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkLogs();
