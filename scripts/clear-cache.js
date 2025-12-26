const { Pool } = require('pg');

async function clearCache() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '38.97.60.181',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: process.env.POSTGRES_DB || 'google_ads_manager',
  });

  try {
    console.log('Clearing keyword metrics cache with corrupted CPC values...');

    // Delete entries with obviously wrong CPC (anything over $1000 is wrong)
    const result = await pool.query(
      'DELETE FROM keyword_metrics WHERE best_cpc > 1000 OR gads_avg_cpc_micros > 1000000000'
    );

    console.log(`✓ Deleted ${result.rowCount} corrupted cache entries`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error clearing cache:', error);
    await pool.end();
    process.exit(1);
  }
}

clearCache();
