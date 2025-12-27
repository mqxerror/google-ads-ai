-- Migration: SERP Intelligence for PPC Campaign Optimization
-- Description: Track organic positions, competitor ads, and SERP features to identify PPC opportunities
-- NOT an SEO tool - this is for Google Ads campaign strategy and budget optimization
--
-- Tables:
-- 1. tracked_keywords - Keywords user wants to monitor for PPC decisions
-- 2. serp_snapshots - Daily position snapshots with competitive intelligence
-- 3. serp_opportunities - AI-generated PPC recommendations based on SERP data

-- =============================================================================
-- 1. TRACKED KEYWORDS TABLE
-- =============================================================================
-- Stores keywords user wants to track for PPC campaign intelligence
-- Use case: "Should I bid on this keyword or rely on organic?"

CREATE TABLE IF NOT EXISTS tracked_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenancy
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL, -- Google Ads customer ID for integration

  -- Keyword details
  keyword TEXT NOT NULL,
  keyword_normalized TEXT NOT NULL, -- Lowercase, trimmed for matching
  target_domain TEXT NOT NULL, -- User's website to track positions for

  -- Tracking configuration
  location_code TEXT NOT NULL DEFAULT '2840', -- Google geo target constant (2840 = US)
  device TEXT NOT NULL DEFAULT 'desktop', -- 'desktop' or 'mobile'
  language TEXT NOT NULL DEFAULT 'en',

  -- Status and settings
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  tracking_frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily' or 'weekly'

  -- Project grouping (optional)
  project_name TEXT, -- Group keywords by project/campaign
  color TEXT DEFAULT '#4F46E5', -- Color for UI differentiation
  icon TEXT, -- Optional icon for project

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ, -- Last time we fetched SERP data

  -- Prevent duplicates
  UNIQUE(user_id, customer_id, keyword_normalized, location_code, device),

  -- Validation
  CHECK (device IN ('desktop', 'mobile')),
  CHECK (tracking_frequency IN ('daily', 'weekly'))
);

-- Indexes for common queries
CREATE INDEX idx_tracked_keywords_user_active ON tracked_keywords(user_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX idx_tracked_keywords_project ON tracked_keywords(project_name)
  WHERE project_name IS NOT NULL;

CREATE INDEX idx_tracked_keywords_customer ON tracked_keywords(customer_id, is_active);

CREATE INDEX idx_tracked_keywords_last_checked ON tracked_keywords(last_checked_at)
  WHERE is_active = TRUE;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_tracked_keywords_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tracked_keywords_updated_at
  BEFORE UPDATE ON tracked_keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_tracked_keywords_timestamp();

-- Comments for documentation
COMMENT ON TABLE tracked_keywords IS 'Keywords tracked for PPC campaign intelligence - monitors organic positions and competitor ad presence';
COMMENT ON COLUMN tracked_keywords.target_domain IS 'User''s website domain (e.g., example.com) to track positions for';
COMMENT ON COLUMN tracked_keywords.location_code IS 'Google Ads geoTargetConstant ID (e.g., 2840 = United States)';
COMMENT ON COLUMN tracked_keywords.project_name IS 'Optional grouping for keywords (e.g., "Brand Campaign", "Product Launch")';

-- =============================================================================
-- 2. SERP SNAPSHOTS TABLE
-- =============================================================================
-- Daily snapshots of SERP positions and competitive intelligence
-- Use case: "How many competitors are bidding? What SERP features appear?"

CREATE TABLE IF NOT EXISTS serp_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_keyword_id UUID NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,

  -- Position data
  organic_position INT, -- 1-100, NULL if not in top 100
  position_change INT, -- Change from previous snapshot (calculated on insert)

  -- SERP features (affect PPC strategy)
  featured_snippet BOOLEAN NOT NULL DEFAULT FALSE,
  local_pack_present BOOLEAN NOT NULL DEFAULT FALSE,
  shopping_ads_present BOOLEAN NOT NULL DEFAULT FALSE,
  people_also_ask_present BOOLEAN NOT NULL DEFAULT FALSE,
  related_searches_present BOOLEAN NOT NULL DEFAULT FALSE,

  -- Competitive intelligence (PPC-focused)
  competitor_ads_count INT NOT NULL DEFAULT 0, -- Total ads (top + bottom)
  top_ads_count INT NOT NULL DEFAULT 0, -- Ads above organic results
  bottom_ads_count INT NOT NULL DEFAULT 0, -- Ads below organic results
  top_ad_domains TEXT[], -- Domains running ads at top
  bottom_ad_domains TEXT[], -- Domains running ads at bottom

  -- Organic competitive landscape
  organic_competitors TEXT[], -- Top 10 organic result domains
  organic_top_3_domains TEXT[], -- Top 3 organic results (high priority)

  -- Raw SERP data (for debugging/advanced analysis)
  serp_features_raw JSONB, -- Full SERP features array from ScrapingRobot
  raw_response JSONB, -- Full API response (optional, for debugging)

  -- Snapshot metadata
  snapshot_date DATE NOT NULL, -- Date of snapshot (not timestamp - one per day)
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- API tracking
  scrapingrobot_status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'rate_limited', 'no_results'
  scrapingrobot_error TEXT, -- Error message if failed
  api_cost_cents INT, -- Cost in cents (for budget tracking)

  -- Deduplication: one snapshot per keyword per day
  UNIQUE(tracked_keyword_id, snapshot_date),

  -- Validation
  CHECK (organic_position IS NULL OR (organic_position >= 1 AND organic_position <= 100)),
  CHECK (competitor_ads_count >= 0),
  CHECK (top_ads_count >= 0),
  CHECK (bottom_ads_count >= 0),
  CHECK (competitor_ads_count = top_ads_count + bottom_ads_count),
  CHECK (scrapingrobot_status IN ('success', 'error', 'rate_limited', 'no_results', 'pending'))
);

-- Indexes for time-series queries
CREATE INDEX idx_serp_snapshots_keyword_date ON serp_snapshots(tracked_keyword_id, snapshot_date DESC);
CREATE INDEX idx_serp_snapshots_date ON serp_snapshots(snapshot_date DESC);
CREATE INDEX idx_serp_snapshots_status ON serp_snapshots(scrapingrobot_status);

-- Index for finding recent position changes
CREATE INDEX idx_serp_snapshots_position_change ON serp_snapshots(position_change)
  WHERE position_change IS NOT NULL AND ABS(position_change) >= 3;

-- Index for PPC opportunity detection (weak organic + high competition)
CREATE INDEX idx_serp_snapshots_ppc_opportunities ON serp_snapshots(organic_position, competitor_ads_count)
  WHERE organic_position >= 8 OR competitor_ads_count >= 3;

-- Comments
COMMENT ON TABLE serp_snapshots IS 'Daily SERP snapshots for competitive PPC intelligence - positions, ads, SERP features';
COMMENT ON COLUMN serp_snapshots.competitor_ads_count IS 'Total paid ads on SERP - indicates competitiveness for PPC bidding';
COMMENT ON COLUMN serp_snapshots.shopping_ads_present IS 'Shopping carousel/ads present - informs Shopping campaign strategy';
COMMENT ON COLUMN serp_snapshots.position_change IS 'Change from previous day - large drops indicate need for protective ad campaigns';

-- =============================================================================
-- 3. SERP OPPORTUNITIES TABLE
-- =============================================================================
-- AI-generated PPC recommendations based on SERP intelligence
-- Use case: "What keywords should I bid on? What campaigns should I create?"

CREATE TABLE IF NOT EXISTS serp_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenancy
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracked_keyword_id UUID NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,

  -- Opportunity classification
  opportunity_type TEXT NOT NULL, -- 'weak_organic', 'high_competition', 'serp_feature', 'position_drop', 'new_competitor_ads'
  priority TEXT NOT NULL, -- 'high', 'medium', 'low'

  -- Recommendation details
  recommendation_text TEXT NOT NULL, -- Human-readable recommendation
  suggested_action TEXT NOT NULL, -- 'create_campaign', 'adjust_bids', 'add_to_existing', 'create_shopping_campaign', 'monitor'

  -- Impact estimation (for prioritization)
  estimated_impact JSONB, -- {additional_clicks: 500, estimated_cost: 150, estimated_conversions: 25}

  -- Campaign context (if applicable)
  related_campaign_id UUID, -- Existing campaign this keyword could be added to
  suggested_bid_amount_micros BIGINT, -- Suggested starting bid in micros

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'dismissed', 'implemented', 'expired'
  dismissed_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  implemented_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'), -- Auto-expire after 1 week

  -- Validation
  CHECK (opportunity_type IN ('weak_organic', 'high_competition', 'serp_feature', 'position_drop', 'new_competitor_ads')),
  CHECK (priority IN ('high', 'medium', 'low')),
  CHECK (suggested_action IN ('create_campaign', 'adjust_bids', 'add_to_existing', 'create_shopping_campaign', 'monitor', 'pause_ads')),
  CHECK (status IN ('active', 'dismissed', 'implemented', 'expired'))
);

-- Indexes for opportunity management
CREATE INDEX idx_serp_opportunities_user_status ON serp_opportunities(user_id, status, priority)
  WHERE status = 'active';

CREATE INDEX idx_serp_opportunities_keyword ON serp_opportunities(tracked_keyword_id, status);

CREATE INDEX idx_serp_opportunities_type ON serp_opportunities(opportunity_type, priority)
  WHERE status = 'active';

CREATE INDEX idx_serp_opportunities_expires ON serp_opportunities(expires_at)
  WHERE status = 'active';

-- Comments
COMMENT ON TABLE serp_opportunities IS 'AI-generated PPC recommendations based on SERP intelligence';
COMMENT ON COLUMN serp_opportunities.opportunity_type IS 'weak_organic = position >8, high_competition = many ads, serp_feature = Shopping/Local, position_drop = dropped >5 positions';
COMMENT ON COLUMN serp_opportunities.suggested_action IS 'Recommended PPC action to take advantage of opportunity';
COMMENT ON COLUMN serp_opportunities.estimated_impact IS 'JSON with estimated clicks, cost, conversions if opportunity is acted upon';

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to calculate position change when inserting new snapshot
CREATE OR REPLACE FUNCTION calculate_position_change()
RETURNS TRIGGER AS $$
DECLARE
  previous_position INT;
BEGIN
  -- Get previous snapshot's position
  SELECT organic_position INTO previous_position
  FROM serp_snapshots
  WHERE tracked_keyword_id = NEW.tracked_keyword_id
    AND snapshot_date < NEW.snapshot_date
  ORDER BY snapshot_date DESC
  LIMIT 1;

  -- Calculate change (negative = improved, positive = dropped)
  IF previous_position IS NOT NULL AND NEW.organic_position IS NOT NULL THEN
    NEW.position_change = NEW.organic_position - previous_position;
  ELSE
    NEW.position_change = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER serp_snapshots_calculate_position_change
  BEFORE INSERT ON serp_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION calculate_position_change();

-- Function to auto-expire old opportunities
CREATE OR REPLACE FUNCTION expire_old_opportunities()
RETURNS void AS $$
BEGIN
  UPDATE serp_opportunities
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get PPC opportunity score for a keyword
CREATE OR REPLACE FUNCTION get_ppc_opportunity_score(
  p_organic_position INT,
  p_competitor_ads_count INT,
  p_search_volume INT,
  p_position_change INT
)
RETURNS INT AS $$
DECLARE
  score INT := 0;
BEGIN
  -- Weak organic position (0-40 points)
  IF p_organic_position IS NULL OR p_organic_position > 20 THEN
    score := score + 40;
  ELSIF p_organic_position > 10 THEN
    score := score + 30;
  ELSIF p_organic_position > 5 THEN
    score := score + 15;
  END IF;

  -- High competitor ads (0-30 points)
  IF p_competitor_ads_count >= 6 THEN
    score := score + 30;
  ELSIF p_competitor_ads_count >= 3 THEN
    score := score + 20;
  ELSIF p_competitor_ads_count >= 1 THEN
    score := score + 10;
  END IF;

  -- Search volume (0-20 points)
  IF p_search_volume >= 10000 THEN
    score := score + 20;
  ELSIF p_search_volume >= 1000 THEN
    score := score + 15;
  ELSIF p_search_volume >= 100 THEN
    score := score + 10;
  END IF;

  -- Recent position drop (0-10 points)
  IF p_position_change >= 5 THEN
    score := score + 10;
  ELSIF p_position_change >= 3 THEN
    score := score + 5;
  END IF;

  RETURN LEAST(score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- SAMPLE DATA (for testing - can be removed in production)
-- =============================================================================

-- Note: Actual data will be inserted via API routes
-- This migration only creates the schema structure

COMMENT ON FUNCTION get_ppc_opportunity_score IS 'Calculate 0-100 score indicating PPC opportunity strength based on organic position, competition, volume, and trends';
COMMENT ON FUNCTION expire_old_opportunities IS 'Auto-expire opportunities older than 7 days - should be run daily via cron job';
COMMENT ON FUNCTION calculate_position_change IS 'Trigger function to calculate position change from previous snapshot';
