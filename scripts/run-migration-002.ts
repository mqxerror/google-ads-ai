/**
 * Run embedding metadata migration
 */

import pg from 'pg';

const { Client } = pg;

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected to database\n');

    console.log('Adding embedding metadata columns...');

    // Add to keywords
    await client.query(`
      ALTER TABLE keywords
      ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-ada-002',
      ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER DEFAULT 1536,
      ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ
    `);
    console.log('  keywords table updated');

    // Add to search_terms
    await client.query(`
      ALTER TABLE search_terms
      ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-ada-002',
      ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER DEFAULT 1536,
      ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ
    `);
    console.log('  search_terms table updated');

    // Add to keyword_clusters
    await client.query(`
      ALTER TABLE keyword_clusters
      ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-ada-002',
      ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER DEFAULT 1536
    `);
    console.log('  keyword_clusters table updated');

    // Create indexes
    console.log('\nCreating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_keywords_embedding_model ON keywords(embedding_model)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_search_terms_embedding_model ON search_terms(embedding_model)
    `);
    console.log('  indexes created');

    // Create helper function
    console.log('\nCreating get_embedding_stats function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION get_embedding_stats()
      RETURNS TABLE (
        table_name TEXT,
        total_rows BIGINT,
        with_embeddings BIGINT,
        current_model_count BIGINT,
        needs_reembedding BIGINT
      )
      LANGUAGE plpgsql
      AS $func$
      DECLARE
        current_model TEXT := 'text-embedding-ada-002';
      BEGIN
        RETURN QUERY
        SELECT
          'keywords'::TEXT,
          COUNT(*)::BIGINT,
          COUNT(embedding)::BIGINT,
          COUNT(*) FILTER (WHERE embedding_model = current_model)::BIGINT,
          COUNT(*) FILTER (WHERE embedding IS NOT NULL AND embedding_model != current_model)::BIGINT
        FROM keywords
        UNION ALL
        SELECT
          'search_terms'::TEXT,
          COUNT(*)::BIGINT,
          COUNT(embedding)::BIGINT,
          COUNT(*) FILTER (WHERE embedding_model = current_model)::BIGINT,
          COUNT(*) FILTER (WHERE embedding IS NOT NULL AND embedding_model != current_model)::BIGINT
        FROM search_terms;
      END;
      $func$
    `);
    console.log('  function created');

    console.log('\nMigration 002 complete!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
