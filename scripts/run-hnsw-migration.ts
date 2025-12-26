/**
 * HNSW Migration Script
 * Run with: npx tsx scripts/run-hnsw-migration.ts
 */

import { Pool } from 'pg';

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
    console.log('🚀 Running HNSW Migration...\n');

    const statements = [
      // Add embedding_version columns
      "ALTER TABLE keywords ADD COLUMN IF NOT EXISTS embedding_version TEXT DEFAULT '1'",
      "ALTER TABLE search_terms ADD COLUMN IF NOT EXISTS embedding_version TEXT DEFAULT '1'",
      "ALTER TABLE keyword_clusters ADD COLUMN IF NOT EXISTS embedding_version TEXT DEFAULT '1'",

      // Drop old IVFFlat indexes
      'DROP INDEX IF EXISTS idx_keywords_embedding',
      'DROP INDEX IF EXISTS idx_search_terms_embedding',
      'DROP INDEX IF EXISTS idx_negative_list_keywords_embedding',

      // Create HNSW indexes
      'CREATE INDEX IF NOT EXISTS idx_keywords_embedding_hnsw ON keywords USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)',
      'CREATE INDEX IF NOT EXISTS idx_search_terms_embedding_hnsw ON search_terms USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)',
    ];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 60);
      try {
        await client.query(stmt);
        console.log('✅ [' + (i + 1) + '/' + statements.length + '] ' + preview + '...');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('already exists') || message.includes('does not exist')) {
          console.log('⏭️  [' + (i + 1) + '/' + statements.length + '] Skipped: ' + preview + '...');
        } else {
          console.log('❌ [' + (i + 1) + '/' + statements.length + '] Failed: ' + preview + '... - ' + message);
        }
      }
    }

    // Verify indexes
    const indexes = await client.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('keywords', 'search_terms') AND indexdef LIKE '%embedding%'"
    );

    console.log('\n📊 Current embedding indexes:');
    indexes.rows.forEach((row: { indexname: string; indexdef: string }) => {
      const type = row.indexdef.includes('hnsw') ? 'HNSW' : row.indexdef.includes('ivfflat') ? 'IVFFlat' : 'Unknown';
      console.log('   - ' + row.indexname + ' (' + type + ')');
    });

    console.log('\n🎉 HNSW Migration Complete!');

  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
