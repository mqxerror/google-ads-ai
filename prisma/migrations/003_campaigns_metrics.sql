-- ===========================================
-- Campaigns & Metrics Migration for Quick Ads AI v2
-- Data Foundation: Store real Google Ads data
-- ===========================================

-- ===========================================
-- Users Table (store OAuth tokens)
-- ===========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    image TEXT,
    google_ads_customer_ids TEXT[], -- Array of accessible customer IDs
    refresh_token TEXT, -- Encrypted OAuth refresh token
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ===========================================
-- Google Ads Accounts Table
-- ===========================================
CREATE TABLE IF NOT EXISTS google_ads_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    descriptive_name TEXT,
    currency_code TEXT DEFAULT 'USD',
    time_zone TEXT DEFAULT 'America/New_York',
    is_manager BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON google_ads_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_customer ON google_ads_accounts(customer_id);

-- ===========================================
-- Campaigns Table
-- ===========================================
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
    google_campaign_id TEXT NOT NULL, -- The Google Ads campaign ID
    name TEXT NOT NULL,
    status TEXT CHECK (status IN ('ENABLED', 'PAUSED', 'REMOVED')) DEFAULT 'PAUSED',
    campaign_type TEXT CHECK (campaign_type IN ('SEARCH', 'DISPLAY', 'SHOPPING', 'VIDEO', 'PERFORMANCE_MAX', 'DEMAND_GEN', 'APP', 'LOCAL', 'SMART', 'DISCOVERY')),
    bidding_strategy TEXT,
    daily_budget DECIMAL(10,2),
    target_cpa DECIMAL(10,2),
    target_roas DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, google_campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_account ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(campaign_type);

-- ===========================================
-- Campaign Metrics Table (daily snapshots)
-- ===========================================
CREATE TABLE IF NOT EXISTS campaign_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0, -- In account currency
    conversions DECIMAL(10,2) DEFAULT 0,
    conversions_value DECIMAL(10,2) DEFAULT 0,
    ctr DECIMAL(5,4) DEFAULT 0, -- Click-through rate (0.0542 = 5.42%)
    avg_cpc DECIMAL(10,2) DEFAULT 0,
    avg_cpm DECIMAL(10,2) DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    cost_per_conversion DECIMAL(10,2) DEFAULT 0,
    roas DECIMAL(5,2) DEFAULT 0,
    -- AI Score components
    ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
    ai_score_ctr DECIMAL(5,2), -- CTR component (0-100)
    ai_score_conv DECIMAL(5,2), -- Conversion component (0-100)
    ai_score_cpc DECIMAL(5,2), -- CPC component (0-100)
    ai_score_qs DECIMAL(5,2), -- Quality Score component (0-100)
    data_confidence DECIMAL(3,2) DEFAULT 1.0, -- Modifier based on click count
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_campaign ON campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON campaign_metrics(date);
CREATE INDEX IF NOT EXISTS idx_metrics_campaign_date ON campaign_metrics(campaign_id, date DESC);

-- ===========================================
-- Campaign Aggregates Table (cached totals)
-- ===========================================
CREATE TABLE IF NOT EXISTS campaign_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE UNIQUE,
    period_days INTEGER DEFAULT 30, -- Aggregation period
    total_spend DECIMAL(12,2) DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_conversions DECIMAL(10,2) DEFAULT 0,
    total_conversions_value DECIMAL(12,2) DEFAULT 0,
    avg_ctr DECIMAL(5,4) DEFAULT 0,
    avg_cpc DECIMAL(10,2) DEFAULT 0,
    avg_cpa DECIMAL(10,2) DEFAULT 0,
    avg_roas DECIMAL(5,2) DEFAULT 0,
    current_ai_score INTEGER,
    ai_score_trend TEXT CHECK (ai_score_trend IN ('up', 'down', 'stable')),
    last_calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aggregates_campaign ON campaign_aggregates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_aggregates_score ON campaign_aggregates(current_ai_score DESC);

-- ===========================================
-- Ad Groups Table
-- ===========================================
CREATE TABLE IF NOT EXISTS ad_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    google_ad_group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT CHECK (status IN ('ENABLED', 'PAUSED', 'REMOVED')) DEFAULT 'PAUSED',
    ad_group_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, google_ad_group_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_groups_campaign ON ad_groups(campaign_id);

-- ===========================================
-- Sync Jobs Table (track data refresh)
-- ===========================================
CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
    job_type TEXT CHECK (job_type IN ('full_sync', 'incremental', 'metrics_only')) DEFAULT 'incremental',
    status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_account ON sync_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);

-- ===========================================
-- AI Recommendations Table
-- ===========================================
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    recommendation_type TEXT CHECK (recommendation_type IN ('pause', 'enable', 'increase_budget', 'decrease_budget', 'add_negatives', 'optimize_bids', 'improve_ads')),
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    potential_savings DECIMAL(10,2),
    potential_improvement DECIMAL(5,2), -- Percentage improvement
    is_dismissed BOOLEAN DEFAULT false,
    is_applied BOOLEAN DEFAULT false,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recommendations_campaign ON ai_recommendations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON ai_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON ai_recommendations(priority);

-- ===========================================
-- Functions for AI Score Calculation
-- ===========================================

-- Calculate AI Score from metrics
CREATE OR REPLACE FUNCTION calculate_ai_score(
    p_ctr DECIMAL,
    p_conversion_rate DECIMAL,
    p_avg_cpc DECIMAL,
    p_clicks INTEGER,
    p_quality_score INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_score INTEGER,
    ctr_score DECIMAL,
    conv_score DECIMAL,
    cpc_score DECIMAL,
    qs_score DECIMAL,
    data_confidence DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ctr_score DECIMAL;
    v_conv_score DECIMAL;
    v_cpc_score DECIMAL;
    v_qs_score DECIMAL;
    v_confidence DECIMAL;
    v_total DECIMAL;
BEGIN
    -- CTR Score (35% weight): 5% CTR = 100
    v_ctr_score := LEAST((p_ctr / 0.05) * 100, 100);

    -- Conversion Score (30% weight): 10% conv rate = 100
    v_conv_score := LEAST((p_conversion_rate / 0.10) * 100, 100);

    -- CPC Score (20% weight): Lower is better, $0.50 = 100, $10 = 0
    v_cpc_score := GREATEST(0, 100 - (p_avg_cpc / 10) * 100);

    -- Quality Score (15% weight): 10 = 100
    v_qs_score := (p_quality_score / 10.0) * 100;

    -- Data Confidence: Reduces score weight for campaigns with low data
    -- 100+ clicks = 100%, 50 clicks = 75%, 10 clicks = 50%
    v_confidence := LEAST(1.0, 0.5 + (p_clicks / 200.0));

    -- Weighted total
    v_total := (
        v_ctr_score * 0.35 +
        v_conv_score * 0.30 +
        v_cpc_score * 0.20 +
        v_qs_score * 0.15
    ) * v_confidence;

    RETURN QUERY SELECT
        ROUND(v_total)::INTEGER,
        ROUND(v_ctr_score, 2),
        ROUND(v_conv_score, 2),
        ROUND(v_cpc_score, 2),
        ROUND(v_qs_score, 2),
        ROUND(v_confidence, 2);
END;
$$;

-- Refresh campaign aggregates
CREATE OR REPLACE FUNCTION refresh_campaign_aggregates(p_campaign_id UUID, p_days INTEGER DEFAULT 30)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_metrics RECORD;
    v_ai_score RECORD;
BEGIN
    -- Calculate aggregates from daily metrics
    SELECT
        COALESCE(SUM(cost), 0) AS total_spend,
        COALESCE(SUM(clicks), 0) AS total_clicks,
        COALESCE(SUM(impressions), 0) AS total_impressions,
        COALESCE(SUM(conversions), 0) AS total_conversions,
        COALESCE(SUM(conversions_value), 0) AS total_conversions_value
    INTO v_metrics
    FROM campaign_metrics
    WHERE campaign_id = p_campaign_id
        AND date >= CURRENT_DATE - p_days;

    -- Calculate derived metrics
    DECLARE
        v_avg_ctr DECIMAL := CASE WHEN v_metrics.total_impressions > 0 THEN v_metrics.total_clicks::DECIMAL / v_metrics.total_impressions ELSE 0 END;
        v_avg_cpc DECIMAL := CASE WHEN v_metrics.total_clicks > 0 THEN v_metrics.total_spend / v_metrics.total_clicks ELSE 0 END;
        v_avg_cpa DECIMAL := CASE WHEN v_metrics.total_conversions > 0 THEN v_metrics.total_spend / v_metrics.total_conversions ELSE 0 END;
        v_avg_roas DECIMAL := CASE WHEN v_metrics.total_spend > 0 THEN v_metrics.total_conversions_value / v_metrics.total_spend ELSE 0 END;
        v_conv_rate DECIMAL := CASE WHEN v_metrics.total_clicks > 0 THEN v_metrics.total_conversions / v_metrics.total_clicks ELSE 0 END;
    BEGIN
        -- Calculate AI Score
        SELECT * INTO v_ai_score FROM calculate_ai_score(
            v_avg_ctr,
            v_conv_rate,
            v_avg_cpc,
            v_metrics.total_clicks::INTEGER
        );

        -- Upsert aggregates
        INSERT INTO campaign_aggregates (
            campaign_id, period_days, total_spend, total_clicks, total_impressions,
            total_conversions, total_conversions_value, avg_ctr, avg_cpc, avg_cpa,
            avg_roas, current_ai_score, last_calculated_at
        )
        VALUES (
            p_campaign_id, p_days, v_metrics.total_spend, v_metrics.total_clicks,
            v_metrics.total_impressions, v_metrics.total_conversions,
            v_metrics.total_conversions_value, v_avg_ctr, v_avg_cpc, v_avg_cpa,
            v_avg_roas, v_ai_score.total_score, NOW()
        )
        ON CONFLICT (campaign_id)
        DO UPDATE SET
            period_days = p_days,
            total_spend = v_metrics.total_spend,
            total_clicks = v_metrics.total_clicks,
            total_impressions = v_metrics.total_impressions,
            total_conversions = v_metrics.total_conversions,
            total_conversions_value = v_metrics.total_conversions_value,
            avg_ctr = v_avg_ctr,
            avg_cpc = v_avg_cpc,
            avg_cpa = v_avg_cpa,
            avg_roas = v_avg_roas,
            current_ai_score = v_ai_score.total_score,
            last_calculated_at = NOW();
    END;
END;
$$;

-- Update timestamp triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON google_ads_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ad_groups_updated_at
    BEFORE UPDATE ON ad_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
