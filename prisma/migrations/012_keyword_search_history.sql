-- Migration: 012_keyword_search_history
-- Description: Store keyword factory searches for analysis
-- Created: 2025-01-03

-- Keyword Search History Table
-- Stores every keyword search for later analysis
CREATE TABLE IF NOT EXISTS keyword_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    customer_id TEXT,

    -- Search input
    seed_keywords TEXT[] NOT NULL,
    target_location TEXT DEFAULT 'US',
    language TEXT DEFAULT 'en',

    -- Options used
    options JSONB DEFAULT '{}',

    -- Results summary
    total_keywords_generated INTEGER DEFAULT 0,
    keywords_enriched INTEGER DEFAULT 0,
    clusters_created INTEGER DEFAULT 0,

    -- Intent classification source
    intent_source TEXT CHECK (intent_source IN ('ollama', 'embeddings', 'rules')),
    ollama_classified INTEGER DEFAULT 0,
    embeddings_classified INTEGER DEFAULT 0,
    rules_classified INTEGER DEFAULT 0,

    -- Keyword breakdown
    by_type JSONB DEFAULT '{}',
    by_intent JSONB DEFAULT '{}',
    by_match_type JSONB DEFAULT '{}',
    by_source JSONB DEFAULT '{}',

    -- Full results (stored as JSONB for flexibility)
    keywords JSONB DEFAULT '[]',
    negative_keywords JSONB DEFAULT '[]',
    clusters JSONB DEFAULT '[]',

    -- Performance metrics
    enrichment_stats JSONB DEFAULT '{}',
    processing_time_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes for common queries
    CONSTRAINT keyword_search_history_user_id_idx UNIQUE (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keyword_search_history_user_id ON keyword_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_keyword_search_history_customer_id ON keyword_search_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_keyword_search_history_created_at ON keyword_search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_search_history_location ON keyword_search_history(target_location);
CREATE INDEX IF NOT EXISTS idx_keyword_search_history_seed_keywords ON keyword_search_history USING GIN(seed_keywords);

-- Add comment
COMMENT ON TABLE keyword_search_history IS 'Stores keyword factory searches for later analysis and insights';
