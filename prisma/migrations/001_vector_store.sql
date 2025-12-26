-- ===========================================
-- Vector Store Migration for Quick Ads AI v2
-- ===========================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ===========================================
-- Keywords Table
-- ===========================================
CREATE TABLE IF NOT EXISTS keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    embedding vector(1536),
    campaign_id TEXT,
    ad_group_id TEXT,
    match_type TEXT CHECK (match_type IN ('BROAD', 'PHRASE', 'EXACT')),
    intent TEXT CHECK (intent IN ('commercial', 'informational', 'navigational', 'transactional')),
    intent_score DECIMAL(3,2),
    search_volume INTEGER,
    cpc DECIMAL(10,2),
    competition TEXT CHECK (competition IN ('LOW', 'MEDIUM', 'HIGH')),
    is_negative BOOLEAN DEFAULT false,
    source TEXT CHECK (source IN ('google_ads', 'dataforseo', 'manual', 'ai_suggested')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for keywords
CREATE INDEX IF NOT EXISTS idx_keywords_campaign ON keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_keywords_is_negative ON keywords(is_negative);
CREATE INDEX IF NOT EXISTS idx_keywords_source ON keywords(source);

-- Vector similarity index (IVFFlat for faster approximate search)
CREATE INDEX IF NOT EXISTS idx_keywords_embedding ON keywords
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ===========================================
-- Search Terms Table
-- ===========================================
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
);

-- Indexes for search terms
CREATE INDEX IF NOT EXISTS idx_search_terms_campaign ON search_terms(campaign_id);
CREATE INDEX IF NOT EXISTS idx_search_terms_negative ON search_terms(is_negative_candidate);
CREATE INDEX IF NOT EXISTS idx_search_terms_cost ON search_terms(cost DESC);

-- Vector similarity index
CREATE INDEX IF NOT EXISTS idx_search_terms_embedding ON search_terms
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ===========================================
-- Keyword Clusters Table
-- ===========================================
CREATE TABLE IF NOT EXISTS keyword_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    centroid vector(1536),
    keyword_count INTEGER DEFAULT 0,
    avg_intent_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Keyword to Cluster Mapping
-- ===========================================
CREATE TABLE IF NOT EXISTS keyword_cluster_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES keyword_clusters(id) ON DELETE CASCADE,
    similarity DECIMAL(4,3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(keyword_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_members_keyword ON keyword_cluster_members(keyword_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON keyword_cluster_members(cluster_id);

-- ===========================================
-- Vector Similarity Search Functions
-- ===========================================

-- Search similar keywords by embedding
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
AS $$
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
$$;

-- Search similar search terms by embedding
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
AS $$
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
$$;

-- Find negative keyword candidates based on similarity to existing negatives
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
AS $$
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
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_keywords_updated_at
    BEFORE UPDATE ON keywords
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Utility function to bulk insert with embeddings
-- ===========================================
CREATE OR REPLACE FUNCTION upsert_keyword_with_embedding(
    p_keyword TEXT,
    p_embedding vector(1536),
    p_campaign_id TEXT DEFAULT NULL,
    p_match_type TEXT DEFAULT NULL,
    p_is_negative BOOLEAN DEFAULT false,
    p_source TEXT DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO keywords (keyword, embedding, campaign_id, match_type, is_negative, source)
    VALUES (p_keyword, p_embedding, p_campaign_id, p_match_type, p_is_negative, p_source)
    ON CONFLICT (keyword, campaign_id)
    DO UPDATE SET
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
EXCEPTION
    WHEN unique_violation THEN
        -- Handle case where there's no unique constraint yet
        INSERT INTO keywords (keyword, embedding, campaign_id, match_type, is_negative, source)
        VALUES (p_keyword, p_embedding, p_campaign_id, p_match_type, p_is_negative, p_source)
        RETURNING id INTO v_id;
        RETURN v_id;
END;
$$;

-- Add unique constraint for keyword + campaign combination
ALTER TABLE keywords ADD CONSTRAINT IF NOT EXISTS unique_keyword_campaign
    UNIQUE NULLS NOT DISTINCT (keyword, campaign_id);

-- Grant permissions (adjust role name as needed)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
