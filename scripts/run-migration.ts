/**
 * Database Migration Runner for Vector Store
 *
 * Run with: npx tsx scripts/run-migration.ts
 */

import pg from 'pg';

const { Client } = pg;

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Run migrations step by step
    console.log('\n📄 Running Vector Store Migration...\n');

    // Step 1: Enable pgvector
    console.log('1️⃣ Enabling pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('   ✅ pgvector enabled');

    // Step 2: Create keywords table
    console.log('2️⃣ Creating keywords table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS keywords (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        keyword TEXT NOT NULL,
        embedding vector(1536),
        campaign_id TEXT,
        ad_group_id TEXT,
        match_type TEXT,
        intent TEXT,
        intent_score DECIMAL(3,2),
        search_volume INTEGER,
        cpc DECIMAL(10,2),
        competition TEXT,
        is_negative BOOLEAN DEFAULT false,
        source TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('   ✅ keywords table created');

    // Step 3: Create search_terms table
    console.log('3️⃣ Creating search_terms table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS search_terms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        search_term TEXT NOT NULL,
        embedding vector(1536),
        campaign_id TEXT,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversions DECIMAL(10,2) DEFAULT 0,
        cost DECIMAL(10,2) DEFAULT 0,
        matched_keyword TEXT,
        is_negative_candidate BOOLEAN DEFAULT false,
        negative_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('   ✅ search_terms table created');

    // Step 4: Create keyword_clusters table
    console.log('4️⃣ Creating keyword_clusters table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS keyword_clusters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        centroid vector(1536),
        keyword_count INTEGER DEFAULT 0,
        avg_intent_score DECIMAL(3,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('   ✅ keyword_clusters table created');

    // Step 5: Create keyword_cluster_members table
    console.log('5️⃣ Creating keyword_cluster_members table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS keyword_cluster_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
        cluster_id UUID REFERENCES keyword_clusters(id) ON DELETE CASCADE,
        similarity DECIMAL(4,3),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(keyword_id, cluster_id)
      )
    `);
    console.log('   ✅ keyword_cluster_members table created');

    // Step 6: Create indexes
    console.log('6️⃣ Creating indexes...');
    const indexes = [
      { name: 'idx_keywords_campaign', sql: 'CREATE INDEX IF NOT EXISTS idx_keywords_campaign ON keywords(campaign_id)' },
      { name: 'idx_keywords_is_negative', sql: 'CREATE INDEX IF NOT EXISTS idx_keywords_is_negative ON keywords(is_negative)' },
      { name: 'idx_keywords_source', sql: 'CREATE INDEX IF NOT EXISTS idx_keywords_source ON keywords(source)' },
      { name: 'idx_search_terms_campaign', sql: 'CREATE INDEX IF NOT EXISTS idx_search_terms_campaign ON search_terms(campaign_id)' },
      { name: 'idx_search_terms_negative', sql: 'CREATE INDEX IF NOT EXISTS idx_search_terms_negative ON search_terms(is_negative_candidate)' },
      { name: 'idx_search_terms_cost', sql: 'CREATE INDEX IF NOT EXISTS idx_search_terms_cost ON search_terms(cost DESC)' },
      { name: 'idx_cluster_members_keyword', sql: 'CREATE INDEX IF NOT EXISTS idx_cluster_members_keyword ON keyword_cluster_members(keyword_id)' },
      { name: 'idx_cluster_members_cluster', sql: 'CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON keyword_cluster_members(cluster_id)' },
    ];

    for (const idx of indexes) {
      await client.query(idx.sql);
      console.log(`   ✅ ${idx.name}`);
    }

    // Step 7: Create vector indexes (IVFFlat) - requires data to work efficiently
    console.log('7️⃣ Creating vector similarity indexes...');
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_keywords_embedding ON keywords
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
      `);
      console.log('   ✅ idx_keywords_embedding (IVFFlat)');
    } catch (e) {
      console.log('   ⚠️ IVFFlat index creation deferred (needs data first)');
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_search_terms_embedding ON search_terms
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
      `);
      console.log('   ✅ idx_search_terms_embedding (IVFFlat)');
    } catch (e) {
      console.log('   ⚠️ IVFFlat index creation deferred (needs data first)');
    }

    // Step 8: Create search_similar_keywords function
    console.log('8️⃣ Creating search_similar_keywords function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION search_similar_keywords(
        query_embedding vector(1536),
        similarity_threshold FLOAT DEFAULT 0.7,
        match_count INT DEFAULT 20,
        filter_campaign_id TEXT DEFAULT NULL,
        exclude_negatives BOOLEAN DEFAULT false
      )
      RETURNS TABLE (
        id UUID,
        keyword TEXT,
        campaign_id TEXT,
        ad_group_id TEXT,
        match_type TEXT,
        intent TEXT,
        intent_score DECIMAL,
        search_volume INTEGER,
        cpc DECIMAL,
        competition TEXT,
        is_negative BOOLEAN,
        source TEXT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        similarity FLOAT
      )
      LANGUAGE plpgsql
      AS $func$
      BEGIN
        RETURN QUERY
        SELECT
          k.id,
          k.keyword,
          k.campaign_id,
          k.ad_group_id,
          k.match_type,
          k.intent,
          k.intent_score,
          k.search_volume,
          k.cpc,
          k.competition,
          k.is_negative,
          k.source,
          k.created_at,
          k.updated_at,
          1 - (k.embedding <=> query_embedding) AS similarity
        FROM keywords k
        WHERE k.embedding IS NOT NULL
          AND (filter_campaign_id IS NULL OR k.campaign_id = filter_campaign_id)
          AND (NOT exclude_negatives OR k.is_negative = false)
          AND 1 - (k.embedding <=> query_embedding) >= similarity_threshold
        ORDER BY k.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $func$
    `);
    console.log('   ✅ search_similar_keywords');

    // Step 9: Create search_similar_search_terms function
    console.log('9️⃣ Creating search_similar_search_terms function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION search_similar_search_terms(
        query_embedding vector(1536),
        similarity_threshold FLOAT DEFAULT 0.7,
        match_count INT DEFAULT 20,
        filter_campaign_id TEXT DEFAULT NULL,
        only_negative_candidates BOOLEAN DEFAULT false
      )
      RETURNS TABLE (
        id UUID,
        search_term TEXT,
        campaign_id TEXT,
        impressions INTEGER,
        clicks INTEGER,
        conversions DECIMAL,
        cost DECIMAL,
        matched_keyword TEXT,
        is_negative_candidate BOOLEAN,
        negative_reason TEXT,
        created_at TIMESTAMPTZ,
        similarity FLOAT
      )
      LANGUAGE plpgsql
      AS $func$
      BEGIN
        RETURN QUERY
        SELECT
          st.id,
          st.search_term,
          st.campaign_id,
          st.impressions,
          st.clicks,
          st.conversions,
          st.cost,
          st.matched_keyword,
          st.is_negative_candidate,
          st.negative_reason,
          st.created_at,
          1 - (st.embedding <=> query_embedding) AS similarity
        FROM search_terms st
        WHERE st.embedding IS NOT NULL
          AND (filter_campaign_id IS NULL OR st.campaign_id = filter_campaign_id)
          AND (NOT only_negative_candidates OR st.is_negative_candidate = true)
          AND 1 - (st.embedding <=> query_embedding) >= similarity_threshold
        ORDER BY st.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $func$
    `);
    console.log('   ✅ search_similar_search_terms');

    // Step 10: Create find_negative_candidates function
    console.log('🔟 Creating find_negative_candidates function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION find_negative_candidates(
        p_campaign_id TEXT,
        p_min_cost DECIMAL DEFAULT 10,
        p_similarity_threshold FLOAT DEFAULT 0.7,
        p_limit INT DEFAULT 50
      )
      RETURNS TABLE (
        id UUID,
        search_term TEXT,
        campaign_id TEXT,
        impressions INTEGER,
        clicks INTEGER,
        conversions DECIMAL,
        cost DECIMAL,
        matched_keyword TEXT,
        is_negative_candidate BOOLEAN,
        negative_reason TEXT,
        created_at TIMESTAMPTZ,
        similarity FLOAT
      )
      LANGUAGE plpgsql
      AS $func$
      BEGIN
        RETURN QUERY
        WITH negative_keywords AS (
          SELECT k.embedding
          FROM keywords k
          WHERE k.is_negative = true
            AND k.campaign_id = p_campaign_id
            AND k.embedding IS NOT NULL
        ),
        search_term_scores AS (
          SELECT
            st.*,
            MAX(1 - (st.embedding <=> nk.embedding)) AS max_similarity
          FROM search_terms st
          CROSS JOIN negative_keywords nk
          WHERE st.campaign_id = p_campaign_id
            AND st.embedding IS NOT NULL
            AND st.cost >= p_min_cost
            AND st.is_negative_candidate = false
          GROUP BY st.id
        )
        SELECT
          sts.id,
          sts.search_term,
          sts.campaign_id,
          sts.impressions,
          sts.clicks,
          sts.conversions,
          sts.cost,
          sts.matched_keyword,
          sts.is_negative_candidate,
          sts.negative_reason,
          sts.created_at,
          sts.max_similarity AS similarity
        FROM search_term_scores sts
        WHERE sts.max_similarity >= p_similarity_threshold
        ORDER BY sts.max_similarity DESC, sts.cost DESC
        LIMIT p_limit;
      END;
      $func$
    `);
    console.log('   ✅ find_negative_candidates');

    // Step 11: Create updated_at trigger
    console.log('1️⃣1️⃣ Creating updated_at trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $func$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_keywords_updated_at ON keywords
    `);

    await client.query(`
      CREATE TRIGGER update_keywords_updated_at
        BEFORE UPDATE ON keywords
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
    console.log('   ✅ updated_at trigger');

    // Verification
    console.log('\n✅ Migration completed successfully!\n');

    // Verify tables exist
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('keywords', 'search_terms', 'keyword_clusters', 'keyword_cluster_members')
      ORDER BY table_name
    `);

    console.log('📊 Tables:');
    for (const row of tablesResult.rows) {
      console.log(`   ✓ ${row.table_name}`);
    }

    // Verify functions exist
    const functionsResult = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('search_similar_keywords', 'search_similar_search_terms', 'find_negative_candidates')
      ORDER BY routine_name
    `);

    console.log('\n⚡ Functions:');
    for (const row of functionsResult.rows) {
      console.log(`   ✓ ${row.routine_name}`);
    }

    // Check pgvector extension
    const extensionResult = await client.query(`
      SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
    `);

    if (extensionResult.rows.length > 0) {
      console.log(`\n🧬 pgvector: v${extensionResult.rows[0].extversion}`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed');
  }
}

// Run the migration
runMigration();
