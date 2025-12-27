const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '38.97.60.181',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: process.env.POSTGRES_DB || 'google_ads_manager',
  });

  console.log('Running migration 007: Add enrichment_logs table for debugging...');

  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'prisma/migrations/007_enrichment_logs.sql'),
      'utf-8'
    );

    await pool.query(migrationSQL);
    console.log('✓ Migration 007 completed successfully');
    console.log('✓ enrichment_logs table created');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
