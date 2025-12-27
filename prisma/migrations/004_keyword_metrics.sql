-- =====================================================
-- Migration: 004_keyword_metrics
-- Description: Keyword metrics cache with dynamic TTL
-- Created: 2025-12-26
-- =====================================================

-- Drop existing table if exists (for clean re-runs)
DROP TABLE IF EXISTS keyword_metrics CASCADE;

-- =====================================================
-- Main Table: keyword_metrics
-- =====================================================
CREATE TABLE keyword_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Keyword Identity (normalized for cache hits)
    keyword TEXT NOT NULL,
    keyword_normalized TEXT NOT NULL,  -- lowercase, trimmed, for matching
    locale TEXT NOT NULL DEFAULT 'en-US',
    device TEXT NOT NULL DEFAULT 'desktop' CHECK (device IN ('desktop', 'mobile', 'tablet')),

    -- Google Ads Metrics
    gads_search_volume INTEGER,
    gads_avg_cpc_micros BIGINT,  -- Store in micros (like Google Ads API)
    gads_competition TEXT CHECK (gads_competition IN ('LOW', 'MEDIUM', 'HIGH')),
    gads_competition_index DECIMAL(3,2) CHECK (gads_competition_index >= 0 AND gads_competition_index <= 1),
    gads_fetched_at TIMESTAMPTZ,
    gads_status TEXT CHECK (gads_status IN ('success', 'not_found', 'error', 'quota_exceeded')),
    gads_error TEXT,

    -- Moz Metrics
    moz_volume INTEGER,
    moz_difficulty INTEGER CHECK (moz_difficulty >= 0 AND moz_difficulty <= 100),
    moz_organic_ctr DECIMAL(5,4) CHECK (moz_organic_ctr >= 0 AND moz_organic_ctr <= 1),
    moz_priority INTEGER CHECK (moz_priority >= 0 AND moz_priority <= 100),
    moz_intent_primary TEXT CHECK (moz_intent_primary IN ('informational', 'navigational', 'commercial', 'transactional')),
    moz_intent_scores JSONB,  -- {"informational": 0.2, "transactional": 0.7, ...}
    moz_fetched_at TIMESTAMPTZ,
    moz_status TEXT CHECK (moz_status IN ('success', 'not_found', 'error', 'quota_exceeded')),
    moz_error TEXT,

    -- DataForSEO Metrics
    dataforseo_search_volume INTEGER,
    dataforseo_cpc DECIMAL(10,2),
    dataforseo_competition DECIMAL(3,2) CHECK (dataforseo_competition >= 0 AND dataforseo_competition <= 1),
    dataforseo_trends JSONB,  -- Monthly volume trends
    dataforseo_fetched_at TIMESTAMPTZ,
    dataforseo_status TEXT CHECK (dataforseo_status IN ('success', 'not_found', 'error', 'quota_exceeded')),
    dataforseo_error TEXT,

    -- Derived/Computed Fields (best available data from all sources)
    best_search_volume INTEGER,  -- Prioritized: Google Ads > DataForSEO > Moz
    best_cpc DECIMAL(10,2),  -- Average CPC in dollars
    best_difficulty INTEGER CHECK (best_difficulty >= 0 AND best_difficulty <= 100),
    best_intent TEXT CHECK (best_intent IN ('informational', 'navigational', 'commercial', 'transactional')),
    best_source TEXT CHECK (best_source IN ('google_ads', 'moz', 'dataforseo', 'none')),

    -- Cache Management with Dynamic TTL
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cache_hit_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    ttl_days INTEGER NOT NULL DEFAULT 30,  -- Dynamic: 7 for popular, 30 for long-tail
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

    -- Version Tracking (for API schema changes)
    schema_version TEXT NOT NULL DEFAULT '1',

    -- Unique constraint for cache key
    CONSTRAINT unique_keyword_locale_device UNIQUE NULLS NOT DISTINCT (keyword_normalized, locale, device)
);

-- =====================================================
-- Indexes
-- =====================================================

-- Primary lookup index (exact match cache lookup)
CREATE INDEX idx_keyword_metrics_lookup
    ON keyword_metrics(keyword_normalized, locale, device);

-- Expiration check (for cleanup jobs)
-- Note: Cannot use NOW() in WHERE clause - use simple index instead
CREATE INDEX idx_keyword_metrics_expired
    ON keyword_metrics(expires_at);

-- Needs refresh (for proactive refresh jobs - popular keywords expiring soon)
-- Note: Cannot use NOW() in WHERE clause - filter in application code instead
CREATE INDEX idx_keyword_metrics_needs_refresh
    ON keyword_metrics(expires_at, cache_hit_count, last_accessed_at)
    WHERE cache_hit_count > 5;

-- Partial indexes for failed fetches (for retry logic)
CREATE INDEX idx_keyword_metrics_gads_failed
    ON keyword_metrics(gads_status, updated_at)
    WHERE gads_status IN ('error', 'quota_exceeded');

CREATE INDEX idx_keyword_metrics_moz_failed
    ON keyword_metrics(moz_status, updated_at)
    WHERE moz_status IN ('error', 'quota_exceeded');

CREATE INDEX idx_keyword_metrics_dataforseo_failed
    ON keyword_metrics(dataforseo_status, updated_at)
    WHERE dataforseo_status IN ('error', 'quota_exceeded');

-- Search volume lookup (for filtering and sorting)
CREATE INDEX idx_keyword_metrics_volume
    ON keyword_metrics(best_search_volume DESC NULLS LAST);

-- Popularity tracking (for dynamic TTL decisions)
CREATE INDEX idx_keyword_metrics_popularity
    ON keyword_metrics(cache_hit_count DESC, last_accessed_at DESC);

-- Full-text search on keywords (for fuzzy matching)
CREATE INDEX idx_keyword_metrics_text_search
    ON keyword_metrics USING gin(to_tsvector('english', keyword));

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to calculate dynamic TTL based on popularity
CREATE OR REPLACE FUNCTION calculate_dynamic_ttl(p_cache_hit_count INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Popular keywords (>10 hits): 7-day TTL
    IF p_cache_hit_count > 10 THEN
        RETURN 7;
    -- Moderately popular (5-10 hits): 14-day TTL
    ELSIF p_cache_hit_count >= 5 THEN
        RETURN 14;
    -- Long-tail keywords (<5 hits): 30-day TTL
    ELSE
        RETURN 30;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update TTL and expiration when cache is accessed
CREATE OR REPLACE FUNCTION update_keyword_cache_access()
RETURNS TRIGGER AS $$
DECLARE
    new_ttl_days INTEGER;
BEGIN
    -- Calculate new TTL based on updated hit count
    new_ttl_days := calculate_dynamic_ttl(NEW.cache_hit_count);

    -- Update TTL and expiration
    NEW.ttl_days := new_ttl_days;
    NEW.expires_at := NOW() + (new_ttl_days || ' days')::INTERVAL;
    NEW.last_accessed_at := NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update expiration when hit count changes
CREATE TRIGGER trg_keyword_metrics_access
    BEFORE UPDATE OF cache_hit_count ON keyword_metrics
    FOR EACH ROW
    WHEN (OLD.cache_hit_count IS DISTINCT FROM NEW.cache_hit_count)
    EXECUTE FUNCTION update_keyword_cache_access();

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER trg_keyword_metrics_updated_at
    BEFORE UPDATE ON keyword_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to check if metrics are stale
CREATE OR REPLACE FUNCTION keyword_metrics_is_stale(p_keyword_metric_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT expires_at INTO v_expires_at
    FROM keyword_metrics
    WHERE id = p_keyword_metric_id;

    RETURN v_expires_at IS NULL OR v_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to find keywords needing proactive refresh
CREATE OR REPLACE FUNCTION keyword_metrics_needing_refresh(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    keyword TEXT,
    cache_hit_count INTEGER,
    days_until_expiry INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        km.id,
        km.keyword,
        km.cache_hit_count,
        EXTRACT(DAY FROM km.expires_at - NOW())::INTEGER as days_until_expiry
    FROM keyword_metrics km
    WHERE km.expires_at < NOW() + INTERVAL '3 days'  -- Expiring within 3 days
        AND km.expires_at > NOW()  -- Not already expired
        AND km.cache_hit_count > 5  -- Only popular keywords
    ORDER BY km.cache_hit_count DESC, km.expires_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired, unused keywords
CREATE OR REPLACE FUNCTION cleanup_expired_keyword_metrics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete keywords that:
    -- 1. Expired more than 7 days ago
    -- 2. Have never been accessed (cache_hit_count = 0)
    DELETE FROM keyword_metrics
    WHERE expires_at < NOW() - INTERVAL '7 days'
        AND cache_hit_count = 0;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE keyword_metrics IS 'Cached keyword metrics from Google Ads, Moz, and DataForSEO with dynamic TTL';
COMMENT ON COLUMN keyword_metrics.keyword_normalized IS 'Lowercase, trimmed version for cache matching';
COMMENT ON COLUMN keyword_metrics.ttl_days IS 'Dynamic TTL: 7 days if popular (>10 hits), 14 days if moderate (5-10 hits), 30 days for long-tail (<5 hits)';
COMMENT ON COLUMN keyword_metrics.best_search_volume IS 'Best available volume from Google Ads > DataForSEO > Moz';
COMMENT ON COLUMN keyword_metrics.best_source IS 'Which API provided the best/most data';
COMMENT ON FUNCTION calculate_dynamic_ttl IS 'Calculates TTL days based on keyword popularity (cache hit count)';
COMMENT ON FUNCTION keyword_metrics_needing_refresh IS 'Finds popular keywords expiring soon for proactive background refresh';
COMMENT ON FUNCTION cleanup_expired_keyword_metrics IS 'Removes expired keywords with zero cache hits';
