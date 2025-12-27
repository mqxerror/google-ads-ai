#!/usr/bin/env node
/**
 * Run all pending migrations for Keyword Factory
 * Uses PostgreSQL credentials from SERVER_INFRASTRUCTURE_REFERENCE.md
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL credentials from SERVER_INFRASTRUCTURE_REFERENCE.md
const config = {
  host: '38.97.60.181',
  port: 5433,
  user: 'postgres',
  password: 'postgres123',
  database: 'postgres',
};

const migrations = [
  '004_keyword_metrics.sql',    // Create keyword_metrics table
  '005_add_location_to_cache.sql', // Add location_id column
  '006_keyword_center.sql',     // Add Keyword Center tables (lists, tags, account data, performance, SERP, trends)
];

console.log('🔄 Running Keyword Factory Migrations');
console.log('📍 PostgreSQL:', `${config.user}@${config.host}:${config.port}/${config.database}\n`);

async function runMigrations() {
  const client = new Client(config);

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    for (const migrationFile of migrations) {
      const migrationPath = path.join(__dirname, 'prisma/migrations', migrationFile);

      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Skipping ${migrationFile} - file not found`);
        continue;
      }

      console.log(`\n📄 Running: ${migrationFile}`);
      console.log('─'.repeat(60));

      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

      try {
        await client.query(migrationSQL);
        console.log(`✅ ${migrationFile} completed successfully!`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${migrationFile} - objects already exist, skipping...`);
        } else {
          console.error(`❌ ${migrationFile} failed:`, error.message);
          throw error;
        }
      }
    }

    // Verify the setup
    console.log('\n📝 Verifying migrations...');
    console.log('─'.repeat(60));

    // Check all keyword tables
    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'keyword_%'
      ORDER BY table_name;
    `);

    console.log('\n✅ Keyword Tables:');
    const expectedTables = [
      'keyword_metrics',
      'keyword_lists',
      'keyword_list_items',
      'keyword_tags',
      'keyword_tag_assignments',
      'keyword_account_data',
      'keyword_performance_history',
      'keyword_serp_features',
      'keyword_trends'
    ];

    const foundTables = tableResult.rows.map(row => row.table_name);
    expectedTables.forEach(tableName => {
      const exists = foundTables.includes(tableName);
      console.log(`   ${exists ? '✅' : '❌'} ${tableName}`);
    });

    // Check keyword_metrics columns
    const metricsColumnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'keyword_metrics'
        AND column_name IN ('id', 'keyword', 'location_id', 'best_search_volume', 'best_cpc')
      ORDER BY column_name;
    `);

    console.log('\n📊 keyword_metrics key columns:');
    metricsColumnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Check keyword_lists columns
    const listsColumnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'keyword_lists'
        AND column_name IN ('id', 'user_id', 'name', 'keyword_count')
      ORDER BY column_name;
    `);

    console.log('\n📋 keyword_lists key columns:');
    listsColumnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Count total indexes
    const indexResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename LIKE 'keyword_%';
    `);

    console.log(`\n🔍 Total indexes on keyword tables: ${indexResult.rows[0].count}`);

    console.log('\n✅ All migrations completed successfully!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Restart your dev server: npm run dev');
    console.log('   2. Start using the Keyword Center dashboard');
    console.log('   3. Create lists and tags to organize keywords');
    console.log('   4. Sync your Google Ads account to see existing keywords');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed.\n');
  }
}

runMigrations();
