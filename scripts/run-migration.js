/**
 * Run SQL migration script
 * Usage: node scripts/run-migration.js 019_competitor_dna_updates.sql
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const migrationFile = process.argv[2] || '019_competitor_dna_updates.sql';
  const migrationPath = path.join(__dirname, '../prisma/migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '38.97.60.181',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: process.env.POSTGRES_DATABASE || 'google_ads_manager',
  });

  try {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`Running migration: ${migrationFile}`);
    console.log('---');

    await pool.query(sql);

    console.log('Migration completed successfully!');

    // Verify the columns exist
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'competitor_dna'
      ORDER BY ordinal_position
    `);

    console.log('\ncompetitor_dna columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
