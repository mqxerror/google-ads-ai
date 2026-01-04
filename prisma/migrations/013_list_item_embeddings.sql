-- =====================================================
-- Migration: 013_list_item_embeddings
-- Description: Add embedding column to keyword_list_items for caching
-- Created: 2025-01-03
-- =====================================================

-- Add embedding column to keyword_list_items
ALTER TABLE keyword_list_items
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add metadata columns for embedding versioning
ALTER TABLE keyword_list_items
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small';

ALTER TABLE keyword_list_items
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Create index for efficient vector similarity search
CREATE INDEX IF NOT EXISTS idx_keyword_list_items_embedding
ON keyword_list_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index for finding items without embeddings
CREATE INDEX IF NOT EXISTS idx_keyword_list_items_no_embedding
ON keyword_list_items (list_id) WHERE embedding IS NULL;

-- =====================================================
-- Function: Get embeddings from global keywords cache
-- =====================================================
CREATE OR REPLACE FUNCTION get_cached_embeddings(p_keywords TEXT[])
RETURNS TABLE (
    keyword_normalized TEXT,
    embedding vector(1536)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (LOWER(TRIM(k.keyword)))
        LOWER(TRIM(k.keyword)) as keyword_normalized,
        k.embedding
    FROM keywords k
    WHERE LOWER(TRIM(k.keyword)) = ANY(
        SELECT LOWER(TRIM(unnest)) FROM unnest(p_keywords)
    )
    AND k.embedding IS NOT NULL
    ORDER BY LOWER(TRIM(k.keyword)), k.updated_at DESC;
END;
$$;

-- =====================================================
-- Function: Batch update embeddings for list items
-- =====================================================
CREATE OR REPLACE FUNCTION update_list_item_embeddings(
    p_list_id UUID,
    p_embeddings JSONB  -- Array of {keyword_normalized, embedding}
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated INTEGER := 0;
    v_item JSONB;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_embeddings)
    LOOP
        UPDATE keyword_list_items
        SET
            embedding = (v_item->>'embedding')::vector,
            embedding_model = 'text-embedding-3-small',
            embedding_updated_at = NOW()
        WHERE list_id = p_list_id
          AND keyword_normalized = v_item->>'keyword_normalized';

        v_updated := v_updated + 1;
    END LOOP;

    RETURN v_updated;
END;
$$;

-- =====================================================
-- Verification
-- =====================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'keyword_list_items'
--   AND column_name LIKE '%embedding%';
