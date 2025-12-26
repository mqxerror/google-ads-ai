-- ===========================================
-- Add Embedding Metadata for Model Migration
-- ===========================================
-- Purpose: Store embedding model info so we can migrate models incrementally

-- Add metadata columns to keywords table
ALTER TABLE keywords
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-ada-002',
ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER DEFAULT 1536,
ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ;

-- Add metadata columns to search_terms table
ALTER TABLE search_terms
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-ada-002',
ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER DEFAULT 1536,
ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ;

-- Add metadata columns to keyword_clusters table
ALTER TABLE keyword_clusters
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-ada-002',
ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER DEFAULT 1536;

-- Create index for finding rows that need re-embedding after model change
CREATE INDEX IF NOT EXISTS idx_keywords_embedding_model ON keywords(embedding_model);
CREATE INDEX IF NOT EXISTS idx_search_terms_embedding_model ON search_terms(embedding_model);

-- ===========================================
-- Helper function to check embedding freshness
-- ===========================================
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
  table_name TEXT,
  total_rows BIGINT,
  with_embeddings BIGINT,
  current_model_count BIGINT,
  needs_reembedding BIGINT
)
LANGUAGE plpgsql
AS $$
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
$$;
