-- =====================================================
-- Migration: 006_keyword_center
-- Description: Keyword Center - Lists, Tags, Account Data, Performance, SERP, Trends
-- Created: 2025-12-26
-- =====================================================

-- Drop existing tables if exists (for clean re-runs)
DROP TABLE IF EXISTS keyword_tag_assignments CASCADE;
DROP TABLE IF EXISTS keyword_tags CASCADE;
DROP TABLE IF EXISTS keyword_list_items CASCADE;
DROP TABLE IF EXISTS keyword_lists CASCADE;
DROP TABLE IF EXISTS keyword_account_data CASCADE;
DROP TABLE IF EXISTS keyword_performance_history CASCADE;
DROP TABLE IF EXISTS keyword_serp_features CASCADE;
DROP TABLE IF EXISTS keyword_trends CASCADE;

-- =====================================================
-- Table 1: keyword_lists
-- Save named collections of keywords
-- =====================================================
CREATE TABLE keyword_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT DEFAULT '📁',
    is_favorite BOOLEAN DEFAULT false,

    -- Denormalized metrics for quick display
    keyword_count INTEGER DEFAULT 0,
    total_search_volume BIGINT,
    avg_cpc DECIMAL(10,2),
    avg_opportunity_score INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_list_name UNIQUE(user_id, name)
);

CREATE INDEX idx_keyword_lists_user ON keyword_lists(user_id, created_at DESC);
CREATE INDEX idx_keyword_lists_favorite ON keyword_lists(user_id, is_favorite DESC);

COMMENT ON TABLE keyword_lists IS 'Named collections of keywords for organization';
COMMENT ON COLUMN keyword_lists.keyword_count IS 'Denormalized count for quick display';

-- =====================================================
-- Table 2: keyword_list_items
-- Many-to-many mapping between keywords and lists
-- =====================================================
CREATE TABLE keyword_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES keyword_lists(id) ON DELETE CASCADE,

    keyword TEXT NOT NULL,
    keyword_normalized TEXT NOT NULL,
    position INTEGER DEFAULT 0,

    -- Snapshot when added (for tracking changes)
    snapshot_search_volume INTEGER,
    snapshot_cpc DECIMAL(10,2),
    snapshot_opportunity_score INTEGER,
    notes TEXT,

    added_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_list_keyword UNIQUE(list_id, keyword_normalized)
);

CREATE INDEX idx_keyword_list_items_list ON keyword_list_items(list_id, position);
CREATE INDEX idx_keyword_list_items_keyword ON keyword_list_items(keyword_normalized);

COMMENT ON TABLE keyword_list_items IS 'Keywords in lists with snapshot metrics';
COMMENT ON COLUMN keyword_list_items.snapshot_search_volume IS 'Volume when added to track changes';

-- =====================================================
-- Table 3: keyword_tags
-- Flexible tagging system
-- =====================================================
CREATE TABLE keyword_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6B7280',
    description TEXT,
    keyword_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_tag_name UNIQUE(user_id, name)
);

CREATE INDEX idx_keyword_tags_user ON keyword_tags(user_id);

COMMENT ON TABLE keyword_tags IS 'Flexible tags for multi-dimensional keyword organization';

-- =====================================================
-- Table 4: keyword_tag_assignments
-- Many-to-many between keywords and tags
-- =====================================================
CREATE TABLE keyword_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_normalized TEXT NOT NULL,
    tag_id UUID NOT NULL REFERENCES keyword_tags(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    tagged_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_keyword_tag UNIQUE(keyword_normalized, tag_id, user_id)
);

CREATE INDEX idx_keyword_tag_assignments_keyword ON keyword_tag_assignments(keyword_normalized);
CREATE INDEX idx_keyword_tag_assignments_tag ON keyword_tag_assignments(tag_id);

COMMENT ON TABLE keyword_tag_assignments IS 'Many-to-many assignments between keywords and tags';

-- =====================================================
-- Table 5: keyword_account_data
-- Track which keywords exist in user's Google Ads account
-- =====================================================
CREATE TABLE keyword_account_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,

    keyword TEXT NOT NULL,
    keyword_normalized TEXT NOT NULL,

    campaign_id TEXT NOT NULL,
    campaign_name TEXT NOT NULL,
    ad_group_id TEXT,
    ad_group_name TEXT,
    match_type TEXT NOT NULL CHECK (match_type IN ('EXACT', 'PHRASE', 'BROAD')),
    status TEXT NOT NULL CHECK (status IN ('ENABLED', 'PAUSED', 'REMOVED')),

    last_synced_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_account_keyword
        UNIQUE(user_id, customer_id, keyword_normalized, campaign_id, match_type)
);

CREATE INDEX idx_keyword_account_keyword ON keyword_account_data(keyword_normalized);
CREATE INDEX idx_keyword_account_user_customer ON keyword_account_data(user_id, customer_id);
CREATE INDEX idx_keyword_account_synced ON keyword_account_data(last_synced_at);

COMMENT ON TABLE keyword_account_data IS 'Keywords from user Google Ads account for existence check';
COMMENT ON COLUMN keyword_account_data.match_type IS 'EXACT, PHRASE, or BROAD match type';

-- =====================================================
-- Table 6: keyword_performance_history
-- Time-series performance data from Google Ads
-- =====================================================
CREATE TABLE keyword_performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    keyword_normalized TEXT NOT NULL,
    campaign_id TEXT NOT NULL,

    date DATE NOT NULL,

    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions DECIMAL(10,2) DEFAULT 0,
    cost_micros BIGINT DEFAULT 0,
    ctr DECIMAL(5,4), -- Click-through rate
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 10),

    synced_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_keyword_performance_day
        UNIQUE(user_id, customer_id, keyword_normalized, campaign_id, date)
);

CREATE INDEX idx_keyword_performance_keyword ON keyword_performance_history(keyword_normalized, date DESC);
CREATE INDEX idx_keyword_performance_date ON keyword_performance_history(date DESC);
CREATE INDEX idx_keyword_performance_user ON keyword_performance_history(user_id, customer_id, date DESC);

COMMENT ON TABLE keyword_performance_history IS 'Historical performance data from Google Ads API';
COMMENT ON COLUMN keyword_performance_history.cost_micros IS 'Cost in micros (divide by 1,000,000 for dollars)';

-- =====================================================
-- Table 7: keyword_serp_features
-- SERP analysis data from DataForSEO
-- =====================================================
CREATE TABLE keyword_serp_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_normalized TEXT NOT NULL,
    location_id TEXT NOT NULL,
    device TEXT NOT NULL DEFAULT 'desktop',

    has_featured_snippet BOOLEAN DEFAULT false,
    has_knowledge_panel BOOLEAN DEFAULT false,
    has_local_pack BOOLEAN DEFAULT false,
    total_ads_count INTEGER DEFAULT 0,
    top_ads_count INTEGER DEFAULT 0,
    organic_results_count INTEGER DEFAULT 0,

    serp_difficulty INTEGER, -- 0-100 calculated based on features

    checked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

    CONSTRAINT unique_serp_check UNIQUE(keyword_normalized, location_id, device)
);

CREATE INDEX idx_keyword_serp_features_keyword ON keyword_serp_features(keyword_normalized);
CREATE INDEX idx_keyword_serp_features_expires ON keyword_serp_features(expires_at);

COMMENT ON TABLE keyword_serp_features IS 'SERP features analysis from DataForSEO with 30-day cache';
COMMENT ON COLUMN keyword_serp_features.serp_difficulty IS 'Calculated difficulty 0-100 based on SERP features';

-- =====================================================
-- Table 8: keyword_trends
-- Monthly search volume trends
-- =====================================================
CREATE TABLE keyword_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_normalized TEXT NOT NULL,
    location_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    search_volume INTEGER NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('google_ads', 'dataforseo', 'google_trends')),
    fetched_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_keyword_trend_month
        UNIQUE(keyword_normalized, location_id, year, month, source)
);

CREATE INDEX idx_keyword_trends_keyword ON keyword_trends(keyword_normalized, year DESC, month DESC);
CREATE INDEX idx_keyword_trends_date ON keyword_trends(year DESC, month DESC);

COMMENT ON TABLE keyword_trends IS 'Monthly search volume trends for seasonality detection';

-- =====================================================
-- Helper Functions for Lists
-- =====================================================

-- Function to update list denormalized metrics
CREATE OR REPLACE FUNCTION update_keyword_list_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate metrics for the affected list
    UPDATE keyword_lists
    SET
        keyword_count = (
            SELECT COUNT(*)
            FROM keyword_list_items
            WHERE list_id = COALESCE(NEW.list_id, OLD.list_id)
        ),
        total_search_volume = (
            SELECT COALESCE(SUM(snapshot_search_volume), 0)
            FROM keyword_list_items
            WHERE list_id = COALESCE(NEW.list_id, OLD.list_id)
        ),
        avg_cpc = (
            SELECT AVG(snapshot_cpc)
            FROM keyword_list_items
            WHERE list_id = COALESCE(NEW.list_id, OLD.list_id)
                AND snapshot_cpc IS NOT NULL
        ),
        avg_opportunity_score = (
            SELECT AVG(snapshot_opportunity_score)::INTEGER
            FROM keyword_list_items
            WHERE list_id = COALESCE(NEW.list_id, OLD.list_id)
                AND snapshot_opportunity_score IS NOT NULL
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.list_id, OLD.list_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update list metrics when items change
CREATE TRIGGER trg_keyword_list_items_metrics
    AFTER INSERT OR UPDATE OR DELETE ON keyword_list_items
    FOR EACH ROW
    EXECUTE FUNCTION update_keyword_list_metrics();

-- =====================================================
-- Helper Functions for Tags
-- =====================================================

-- Function to update tag keyword count
CREATE OR REPLACE FUNCTION update_keyword_tag_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate count for the affected tag
    UPDATE keyword_tags
    SET keyword_count = (
        SELECT COUNT(DISTINCT keyword_normalized)
        FROM keyword_tag_assignments
        WHERE tag_id = COALESCE(NEW.tag_id, OLD.tag_id)
    )
    WHERE id = COALESCE(NEW.tag_id, OLD.tag_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update tag count when assignments change
CREATE TRIGGER trg_keyword_tag_assignments_count
    AFTER INSERT OR UPDATE OR DELETE ON keyword_tag_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_keyword_tag_count();

-- =====================================================
-- Utility Functions
-- =====================================================

-- Function to get keywords with account status
CREATE OR REPLACE FUNCTION get_keywords_with_account_status(
    p_user_id TEXT,
    p_customer_id TEXT,
    p_keywords TEXT[]
)
RETURNS TABLE (
    keyword TEXT,
    in_account BOOLEAN,
    campaigns JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.keyword,
        kad.keyword IS NOT NULL as in_account,
        CASE
            WHEN kad.keyword IS NULL THEN '[]'::JSONB
            ELSE jsonb_agg(
                jsonb_build_object(
                    'campaignId', kad.campaign_id,
                    'campaignName', kad.campaign_name,
                    'adGroupId', kad.ad_group_id,
                    'adGroupName', kad.ad_group_name,
                    'matchType', kad.match_type,
                    'status', kad.status
                )
            )
        END as campaigns
    FROM unnest(p_keywords) AS k(keyword)
    LEFT JOIN keyword_account_data kad ON
        kad.keyword_normalized = LOWER(TRIM(k.keyword))
        AND kad.user_id = p_user_id
        AND kad.customer_id = p_customer_id
    GROUP BY k.keyword, kad.keyword;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: updated_at for keyword_lists
-- =====================================================
CREATE TRIGGER trg_keyword_lists_updated_at
    BEFORE UPDATE ON keyword_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to verify all tables were created:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name LIKE 'keyword_%'
-- ORDER BY table_name;
