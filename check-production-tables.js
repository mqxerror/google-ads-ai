/**
 * Check what SERP Intelligence tables/indexes exist in production
 */

const { Client } = require('pg');

const client = new Client({
  host: '38.97.60.181',
  port: 5433,
  user: 'postgres',
  password: 'postgres123',
  database: 'google_ads_manager',
});

async function checkTables() {
  try {
    await client.connect();
    console.log('✓ Connected to production database\n');

    // Check tables
    console.log('📊 Checking SERP Intelligence tables...\n');
    const tablesResult = await client.query(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns
              WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_name IN ('tracked_keywords', 'serp_snapshots', 'serp_opportunities')
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length > 0) {
      console.log('Tables found:');
      tablesResult.rows.forEach((row) => {
        console.log(`   ✓ ${row.table_name} (${row.column_count} columns)`);
      });
    } else {
      console.log('   ❌ No SERP Intelligence tables found');
    }

    // Check user_id column types
    console.log('\n🔍 Checking user_id column types...\n');
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

    if (columnsResult.rows.length > 0) {
      console.log('user_id columns:');
      columnsResult.rows.forEach((row) => {
        const icon = row.data_type === 'text' ? '✓' : '⚠️';
        console.log(`   ${icon} ${row.table_name}.user_id: ${row.data_type}`);
      });
    } else {
      console.log('   ❌ No user_id columns found');
    }

    // Check indexes
    console.log('\n📑 Checking indexes...\n');
    const indexesResult = await client.query(`
      SELECT
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('tracked_keywords', 'serp_snapshots', 'serp_opportunities')
      ORDER BY tablename, indexname;
    `);

    if (indexesResult.rows.length > 0) {
      console.log('Indexes found:');
      indexesResult.rows.forEach((row) => {
        console.log(`   - ${row.tablename}.${row.indexname}`);
      });
    } else {
      console.log('   ❌ No indexes found');
    }

    // Check functions
    console.log('\n⚙️  Checking functions...\n');
    const functionsResult = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN ('calculate_position_change', 'expire_old_opportunities', 'get_ppc_opportunity_score')
      ORDER BY routine_name;
    `);

    if (functionsResult.rows.length > 0) {
      console.log('Functions found:');
      functionsResult.rows.forEach((row) => {
        console.log(`   ✓ ${row.routine_name}()`);
      });
    } else {
      console.log('   ❌ No functions found');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTables();
