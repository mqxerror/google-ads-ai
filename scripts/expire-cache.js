const { Pool } = require('pg');

async function expireCache() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '38.97.60.181',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: process.env.POSTGRES_DB || 'google_ads_manager',
  });

  console.log('Expiring all keyword metrics cache entries to force fresh data fetch...');

  try {
    // Set expires_at to NOW() - 1 day to mark everything as stale
    const result = await pool.query(`
      UPDATE keyword_metrics
      SET expires_at = NOW() - INTERVAL '1 day',
          updated_at = NOW()
      WHERE expires_at > NOW()
    `);

    console.log(`✓ Expired ${result.rowCount} cache entries`);
    console.log('Next generation will fetch fresh data from Google Ads API');
  } catch (error) {
    console.error('Error expiring cache:', error);
  } finally {
    await pool.end();
  }
}

expireCache();
