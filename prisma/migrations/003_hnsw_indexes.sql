-- HNSW Indexes for Better Performance
-- HNSW (Hierarchical Navigable Small World) generally provides:
-- - Faster query times than IVFFlat
-- - Better recall at the same speed
-- - No training required (vs IVFFlat which needs lists tuning)

-- Add embedding_version column for tracking model versions
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS embedding_version TEXT DEFAULT '1';
ALTER TABLE search_terms ADD COLUMN IF NOT EXISTS embedding_version TEXT DEFAULT '1';
ALTER TABLE negative_list_keywords ADD COLUMN IF NOT EXISTS embedding_version TEXT DEFAULT '1';
ALTER TABLE keyword_clusters ADD COLUMN IF NOT EXISTS embedding_version TEXT DEFAULT '1';

-- Drop old IVFFlat indexes
DROP INDEX IF EXISTS idx_keywords_embedding;
DROP INDEX IF EXISTS idx_search_terms_embedding;
DROP INDEX IF EXISTS idx_negative_list_keywords_embedding;

-- Create HNSW indexes with optimized parameters
-- m = 16: number of connections per layer (default 16, higher = better recall, more memory)
-- ef_construction = 64: size of dynamic candidate list during build (default 64)

CREATE INDEX IF NOT EXISTS idx_keywords_embedding_hnsw
  ON keywords USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_search_terms_embedding_hnsw
  ON search_terms USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_negative_list_keywords_embedding_hnsw
  ON negative_list_keywords USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index for finding embeddings that need re-generation
CREATE INDEX IF NOT EXISTS idx_keywords_needs_reembedding
  ON keywords (embedding_version)
  WHERE embedding IS NOT NULL AND embedding_version != '2';

CREATE INDEX IF NOT EXISTS idx_search_terms_needs_reembedding
  ON search_terms (embedding_version)
  WHERE embedding IS NOT NULL AND embedding_version != '2';

-- Function to update embedding with version tracking
CREATE OR REPLACE FUNCTION update_keyword_embedding(
  p_keyword_id UUID,
  p_embedding VECTOR(1536),
  p_model TEXT,
  p_version TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE keywords
  SET
    embedding = p_embedding,
    embedding_model = p_model,
    embedding_version = p_version,
    embedding_created_at = NOW(),
    updated_at = NOW()
  WHERE id = p_keyword_id;
END;
$$ LANGUAGE plpgsql;

-- Function for semantic keyword search using HNSW
CREATE OR REPLACE FUNCTION search_similar_keywords(
  query_embedding VECTOR(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20,
  filter_campaign_id TEXT DEFAULT NULL,
  exclude_negatives BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  keyword TEXT,
  campaign_id TEXT,
  match_type TEXT,
  is_negative BOOLEAN,
  search_volume INT,
  quality_score INT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.keyword,
    k.campaign_id,
    k.match_type,
    k.is_negative,
    k.search_volume,
    k.quality_score,
    1 - (k.embedding <=> query_embedding) as similarity
  FROM keywords k
  WHERE k.embedding IS NOT NULL
    AND (filter_campaign_id IS NULL OR k.campaign_id = filter_campaign_id)
    AND (NOT exclude_negatives OR k.is_negative = FALSE)
    AND 1 - (k.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function for semantic search term search
CREATE OR REPLACE FUNCTION search_similar_search_terms(
  query_embedding VECTOR(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20,
  filter_campaign_id TEXT DEFAULT NULL,
  only_negative_candidates BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  search_term TEXT,
  campaign_id TEXT,
  impressions INT,
  clicks INT,
  cost DECIMAL,
  conversions INT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id,
    st.search_term,
    st.campaign_id,
    st.impressions,
    st.clicks,
    st.cost,
    st.conversions,
    1 - (st.embedding <=> query_embedding) as similarity
  FROM search_terms st
  WHERE st.embedding IS NOT NULL
    AND (filter_campaign_id IS NULL OR st.campaign_id = filter_campaign_id)
    AND (NOT only_negative_candidates OR (st.conversions = 0 AND st.cost > 5))
    AND 1 - (st.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY st.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to find negative keyword candidates
CREATE OR REPLACE FUNCTION find_negative_candidates(
  p_campaign_id TEXT,
  p_min_cost DECIMAL DEFAULT 10,
  p_similarity_threshold FLOAT DEFAULT 0.7,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  search_term TEXT,
  cost DECIMAL,
  clicks INT,
  impressions INT,
  similar_to_negative TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.search_term,
    st.cost,
    st.clicks,
    st.impressions,
    neg.keyword as similar_to_negative,
    1 - (st.embedding <=> neg.embedding) as similarity
  FROM search_terms st
  CROSS JOIN LATERAL (
    SELECT k.keyword, k.embedding
    FROM keywords k
    WHERE k.is_negative = TRUE
      AND k.embedding IS NOT NULL
    ORDER BY k.embedding <=> st.embedding
    LIMIT 1
  ) neg
  WHERE st.campaign_id = p_campaign_id
    AND st.conversions = 0
    AND st.cost >= p_min_cost
    AND st.embedding IS NOT NULL
    AND 1 - (st.embedding <=> neg.embedding) >= p_similarity_threshold
  ORDER BY st.cost DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
