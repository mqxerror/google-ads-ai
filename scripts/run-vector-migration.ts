/**
 * Run Vector Store Migration
 * Execute with: npx tsx scripts/run-vector-migration.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  host: '38.97.60.181',
  port: 5433,
  user: 'postgres',
  password: 'postgres123',
  database: 'google_ads_manager',
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Vector Store Migration...\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../prisma/migrations/002_vector_store.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 60).replace(/\n/g, ' ');

      try {
        await client.query(statement);
        console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
      } catch (err: any) {
        // Skip "already exists" errors for idempotency
        if (err.message.includes('already exists') ||
            err.message.includes('duplicate key') ||
            err.message.includes('does not exist')) {
          console.log(`⏭️  [${i + 1}/${statements.length}] Skipped (already exists): ${preview}...`);
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] Failed: ${preview}...`);
          console.error(`   Error: ${err.message}`);
        }
      }
    }

    // Verify tables were created
    console.log('\n📊 Verifying tables...');
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('keywords', 'search_terms', 'keyword_clusters', 'negative_keyword_lists', 'landing_page_scans')
    `);

    console.log('\n✅ Tables created:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));

    // Check if pgvector extension is enabled
    const extensions = await client.query(`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `);

    if (extensions.rows.length > 0) {
      console.log('\n✅ pgvector extension is enabled');
    } else {
      console.log('\n⚠️  pgvector extension could not be enabled (may require superuser)');
    }

    console.log('\n🎉 Vector Store Migration Complete!');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
