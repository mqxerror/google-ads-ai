-- ============================================
-- UNIFIED CAMPAIGN SYSTEM - ALTER EXISTING + CREATE NEW
-- Migration 020 - 2025-01-04
-- ============================================

-- ============================================
-- ALTER CAMPAIGNS TABLE (add missing columns)
-- ============================================
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_locations JSONB DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_languages JSONB DEFAULT '["en"]';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ad_schedule JSONB;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS include_search_partners BOOLEAN DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS include_display_network BOOLEAN DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS final_url TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tracking_template TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS intelligence_project_id UUID;

-- Backfill type from campaign_type if exists
UPDATE campaigns SET type = campaign_type WHERE type IS NULL AND campaign_type IS NOT NULL;
UPDATE campaigns SET type = 'SEARCH' WHERE type IS NULL;

-- ============================================
-- ALTER AD_GROUPS TABLE (add missing columns)
-- ============================================
ALTER TABLE ad_groups ADD COLUMN IF NOT EXISTS cpc_bid DECIMAL(10,2);
ALTER TABLE ad_groups ADD COLUMN IF NOT EXISTS targeting_type TEXT;

-- ============================================
-- ASSET GROUPS (PMax, Demand Gen) - NEW
-- ============================================
CREATE TABLE IF NOT EXISTS asset_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  google_asset_group_id TEXT,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'ENABLED',
  final_url TEXT NOT NULL,
  path1 TEXT,
  path2 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPAIGN ASSETS (Images, Videos, Logos, Text) - NEW
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  google_asset_id TEXT,
  type TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  aspect_ratio TEXT,
  duration_seconds INTEGER,
  youtube_video_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  content_hash TEXT,
  UNIQUE(user_id, content_hash)
);

-- Add updated_at column if table already exists
ALTER TABLE campaign_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- ASSET LINKS - NEW
-- ============================================
CREATE TABLE IF NOT EXISTS asset_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES campaign_assets(id) ON DELETE CASCADE,
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE CASCADE,
  asset_group_id UUID REFERENCES asset_groups(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  performance_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPAIGN KEYWORDS - NEW (separate from existing keywords table)
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE CASCADE,
  google_keyword_id TEXT,
  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL,
  status TEXT DEFAULT 'ENABLED',
  cpc_bid DECIMAL(10,2),
  quality_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPAIGN NEGATIVE KEYWORDS - NEW
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_negative_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL,
  level TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPAIGN AUDIENCES - NEW
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  definition JSONB,
  google_audience_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIENCE TARGETING - NEW
-- ============================================
CREATE TABLE IF NOT EXISTS audience_targeting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE CASCADE,
  asset_group_id UUID REFERENCES asset_groups(id) ON DELETE CASCADE,
  audience_id UUID REFERENCES campaign_audiences(id) ON DELETE CASCADE,
  targeting_mode TEXT NOT NULL,
  bid_modifier DECIMAL(5,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPAIGN PERFORMANCE - NEW
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  conversion_value DECIMAL(10,2) DEFAULT 0,
  ctr DECIMAL(5,4),
  cpc DECIMAL(10,2),
  cpa DECIMAL(10,2),
  roas DECIMAL(10,2),
  video_views INTEGER,
  video_quartile_25 INTEGER,
  video_quartile_50 INTEGER,
  video_quartile_75 INTEGER,
  video_quartile_100 INTEGER,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_asset_groups_campaign ON asset_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_user ON campaign_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_type ON campaign_assets(type);
CREATE INDEX IF NOT EXISTS idx_asset_links_ad_group ON asset_links(ad_group_id);
CREATE INDEX IF NOT EXISTS idx_asset_links_asset_group ON asset_links(asset_group_id);
CREATE INDEX IF NOT EXISTS idx_campaign_keywords_ad_group ON campaign_keywords(ad_group_id);
CREATE INDEX IF NOT EXISTS idx_campaign_neg_kw_campaign ON campaign_negative_keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_audiences_user ON campaign_audiences(user_id);
CREATE INDEX IF NOT EXISTS idx_audience_targeting_campaign ON audience_targeting(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_performance_date ON campaign_performance(campaign_id, date);
