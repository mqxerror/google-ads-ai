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

  console.log('Running migration 011: Fix user_id column types to TEXT...');

  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'prisma/migrations/011_fix_user_id_types.sql'),
      'utf-8'
    );

    await pool.query(migrationSQL);
    console.log('✓ Migration 011 completed successfully');
    console.log('✓ Changed user_id columns from UUID to TEXT in:');
    console.log('  - tracked_keywords');
    console.log('  - serp_opportunities');
    console.log('✓ Foreign key constraints updated');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
