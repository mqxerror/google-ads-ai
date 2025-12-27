/**
 * Run SERP Intelligence migrations on production database
 * Migrations: 010_serp_intelligence.sql, 011_fix_user_id_types.sql
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Production database connection
const client = new Client({
  host: '38.97.60.181',
  port: 5433,
  user: 'postgres',
  password: 'postgres123',
  database: 'google_ads_manager',
});

async function runMigrations() {
  console.log('🔗 Connecting to production database...');
  console.log('   Host: 38.97.60.181:5433');
  console.log('   Database: google_ads_manager\n');

  try {
    await client.connect();
    console.log('✓ Connected to production database\n');

    // Run migration 010
    console.log('📝 Running migration 010: SERP Intelligence schema...');
    const migration010 = fs.readFileSync(
      path.join(__dirname, 'prisma/migrations/010_serp_intelligence.sql'),
      'utf8'
    );
    await client.query(migration010);
    console.log('✓ Migration 010 completed successfully\n');

    // Run migration 011
    console.log('📝 Running migration 011: Fix user_id types...');
    const migration011 = fs.readFileSync(
      path.join(__dirname, 'prisma/migrations/011_fix_user_id_types.sql'),
      'utf8'
    );
    await client.query(migration011);
    console.log('✓ Migration 011 completed successfully\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('tracked_keywords', 'serp_snapshots', 'serp_opportunities')
      ORDER BY table_name;
    `);

    console.log('\n✓ Tables created:');
    tablesResult.rows.forEach((row) => {
      console.log(`   - ${row.table_name}`);
    });

    // Verify user_id column types
    console.log('\n🔍 Verifying user_id column types...');
    const columnsResult = await client.query(`
      SELECT
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'user_id'
        AND table_name IN ('tracked_keywords', 'serp_opportunities')
      ORDER BY table_name;
    `);

    console.log('\n✓ Column types:');
    columnsResult.rows.forEach((row) => {
      console.log(`   - ${row.table_name}.user_id: ${row.data_type}`);
    });

    console.log('\n✅ All migrations completed successfully!');
    console.log('\n📊 SERP Intelligence tables are ready for production');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

runMigrations();
