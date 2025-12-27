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

  console.log('Running migration 009: Add Google Trends, YouTube, and NLP columns...');

  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'prisma/migrations/009_google_trends_youtube_nlp.sql'),
      'utf-8'
    );

    await pool.query(migrationSQL);
    console.log('✓ Migration 009 completed successfully');
    console.log('✓ Added Trends, YouTube, and NLP columns to keyword_metrics table');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
