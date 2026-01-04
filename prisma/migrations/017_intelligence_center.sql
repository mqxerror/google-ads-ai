-- =====================================================
-- Migration: 017_intelligence_center
-- Description: Intelligence Center - Brand DNA, Audience DNA, Competitor DNA
-- Created: 2026-01-03
-- =====================================================

-- Drop existing tables if exists (for clean re-runs)
DROP TABLE IF EXISTS competitor_dna CASCADE;
DROP TABLE IF EXISTS audience_dna CASCADE;
DROP TABLE IF EXISTS brand_dna CASCADE;
DROP TABLE IF EXISTS intelligence_projects CASCADE;

-- =====================================================
-- Table 1: intelligence_projects
-- Master table for intelligence analyses (one per brand)
-- =====================================================
CREATE TABLE intelligence_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,

    -- Project identity
    name TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    domain TEXT,
    industry TEXT,
    business_model TEXT, -- B2B, B2C, SaaS, ecommerce, service, etc.

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'researching', 'analyzing', 'completed', 'failed')),

    -- Progress tracking
    brand_dna_status TEXT DEFAULT 'pending'
        CHECK (brand_dna_status IN ('pending', 'in_progress', 'completed', 'failed')),
    audience_dna_status TEXT DEFAULT 'pending'
        CHECK (audience_dna_status IN ('pending', 'in_progress', 'completed', 'failed')),
    competitor_dna_status TEXT DEFAULT 'pending'
        CHECK (competitor_dna_status IN ('pending', 'in_progress', 'completed', 'failed')),

    -- Cost tracking
    total_api_cost DECIMAL(10, 4) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_project_name UNIQUE(user_id, name)
);

CREATE INDEX idx_intelligence_projects_user ON intelligence_projects(user_id, created_at DESC);
CREATE INDEX idx_intelligence_projects_status ON intelligence_projects(status);

COMMENT ON TABLE intelligence_projects IS 'Intelligence analyses for brands - one project per brand';
COMMENT ON COLUMN intelligence_projects.business_model IS 'B2B, B2C, SaaS, ecommerce, service, marketplace, etc.';
COMMENT ON COLUMN intelligence_projects.total_api_cost IS 'Running total of API costs for this project';

-- =====================================================
-- Table 2: brand_dna
-- Deep research into brand identity and positioning
-- =====================================================
CREATE TABLE brand_dna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES intelligence_projects(id) ON DELETE CASCADE,

    -- Raw research data (JSON for flexibility)
    raw_research JSONB, -- Perplexity/DataForSEO results
    website_content TEXT, -- Homepage scraped content
    about_page_content TEXT, -- About page scraped content
    news_content TEXT, -- Recent news/PR

    -- Analyzed structured data
    mission_vision TEXT,
    brand_values JSONB, -- Array of core values with descriptions
    brand_positioning TEXT, -- One-liner positioning statement
    unique_differentiators JSONB, -- Array of USPs
    target_market TEXT,
    brand_voice TEXT, -- Communication style/tone
    company_story TEXT, -- Origin/history narrative
    key_milestones JSONB, -- Array of milestones

    -- Keywords & messaging
    brand_keywords JSONB, -- Key terms/phrases they use
    taglines JSONB, -- Known taglines/slogans

    -- Full synthesized report
    full_report TEXT, -- Markdown format

    -- Processing metadata
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'researching', 'scraping', 'analyzing', 'completed', 'failed')),
    error_message TEXT,
    api_cost DECIMAL(10, 4) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_project_brand_dna UNIQUE(project_id)
);

CREATE INDEX idx_brand_dna_project ON brand_dna(project_id);
CREATE INDEX idx_brand_dna_status ON brand_dna(status);

COMMENT ON TABLE brand_dna IS 'Brand identity and positioning analysis';
COMMENT ON COLUMN brand_dna.raw_research IS 'JSON blob of all raw research data for debugging';
COMMENT ON COLUMN brand_dna.brand_values IS 'Array: [{value: "Innovation", description: "..."}, ...]';

-- =====================================================
-- Table 3: audience_dna
-- Customer personas with deep psychological profiling
-- =====================================================
CREATE TABLE audience_dna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES intelligence_projects(id) ON DELETE CASCADE,

    -- Persona identity
    persona_name TEXT NOT NULL,
    persona_title TEXT, -- e.g., "The Busy Professional"
    avatar_emoji TEXT DEFAULT '👤',
    position INTEGER DEFAULT 0, -- Order (1, 2, 3)

    -- Demographics (optional)
    demographics JSONB, -- {age_range, gender, location, income, etc.}

    -- Psychographics
    life_situation TEXT, -- What life stage/situation triggers need
    goals_aspirations JSONB, -- Array of goals
    pain_points JSONB, -- Array of problems
    fears_anxieties JSONB, -- Array of fears
    values_beliefs JSONB, -- What they value

    -- Behavior patterns
    behavior_patterns JSONB, -- How they research, decide, buy
    decision_factors JSONB, -- What influences their decisions
    purchase_motivations JSONB, -- Why they buy
    objections JSONB, -- Common hesitations
    trust_signals JSONB, -- What builds trust

    -- Journey stage
    awareness_level TEXT CHECK (awareness_level IN (
        'unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'
    )),

    -- Where to find them
    channels JSONB, -- Where they hang out online/offline
    influencers JSONB, -- Who they follow/trust
    communities JSONB, -- Groups they belong to

    -- Raw research
    raw_research JSONB,

    -- Full synthesized profile
    full_profile TEXT, -- Markdown format

    -- Processing metadata
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'researching', 'analyzing', 'completed', 'failed')),
    error_message TEXT,
    api_cost DECIMAL(10, 4) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audience_dna_project ON audience_dna(project_id, position);
CREATE INDEX idx_audience_dna_status ON audience_dna(status);

COMMENT ON TABLE audience_dna IS 'Customer personas with psychological profiling';
COMMENT ON COLUMN audience_dna.awareness_level IS 'Eugene Schwartz awareness levels';
COMMENT ON COLUMN audience_dna.life_situation IS 'What life event or situation triggers the need';

-- =====================================================
-- Table 4: competitor_dna
-- Competitive intelligence and gap analysis
-- =====================================================
CREATE TABLE competitor_dna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES intelligence_projects(id) ON DELETE CASCADE,

    -- Competitor identity
    competitor_name TEXT NOT NULL,
    competitor_domain TEXT,
    competitor_logo_url TEXT,
    threat_level TEXT CHECK (threat_level IN ('direct', 'indirect', 'emerging', 'substitute')),
    position INTEGER DEFAULT 0, -- Order (1, 2, 3)

    -- Brand positioning
    brand_positioning TEXT,
    unique_value_prop TEXT,
    tagline TEXT,

    -- Content strategy
    content_strategy JSONB, -- Blog, social, video, etc.
    pillar_pages JSONB, -- Main content pillars
    content_frequency TEXT,

    -- SEO metrics (from DataForSEO)
    domain_authority INTEGER,
    monthly_traffic INTEGER,
    keyword_overlap INTEGER, -- Shared keywords with our brand
    avg_position DECIMAL(5, 2),
    top_keywords JSONB, -- Array of their top keywords

    -- Market position
    market_position TEXT,
    pricing_strategy TEXT,
    target_audience TEXT,

    -- SWOT analysis
    strengths JSONB, -- Array
    weaknesses JSONB, -- Array
    opportunities JSONB, -- Gaps we can exploit
    threats JSONB, -- Where they beat us

    -- Ad intelligence (if available)
    ad_copy_examples JSONB, -- Sample ad copies
    ad_keywords JSONB, -- Keywords they bid on

    -- Raw research
    raw_research JSONB,
    scraped_content TEXT,

    -- Full synthesized report
    full_report TEXT, -- Markdown format

    -- Processing metadata
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'discovering', 'researching', 'analyzing', 'completed', 'failed')),
    error_message TEXT,
    api_cost DECIMAL(10, 4) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitor_dna_project ON competitor_dna(project_id, position);
CREATE INDEX idx_competitor_dna_status ON competitor_dna(status);
CREATE INDEX idx_competitor_dna_domain ON competitor_dna(competitor_domain);

COMMENT ON TABLE competitor_dna IS 'Competitive intelligence for identified competitors';
COMMENT ON COLUMN competitor_dna.threat_level IS 'direct=same market, indirect=similar offering, emerging=growing threat, substitute=alternative solution';

-- =====================================================
-- Trigger: updated_at for all tables
-- =====================================================
CREATE TRIGGER trg_intelligence_projects_updated_at
    BEFORE UPDATE ON intelligence_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_brand_dna_updated_at
    BEFORE UPDATE ON brand_dna
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audience_dna_updated_at
    BEFORE UPDATE ON audience_dna
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_competitor_dna_updated_at
    BEFORE UPDATE ON competitor_dna
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Function: Update project status based on DNA status
-- =====================================================
CREATE OR REPLACE FUNCTION update_project_status()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id UUID;
    v_brand_status TEXT;
    v_audience_status TEXT;
    v_competitor_status TEXT;
    v_new_status TEXT;
BEGIN
    -- Get project_id from the changed row
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);

    -- Get current statuses
    SELECT brand_dna_status, audience_dna_status, competitor_dna_status
    INTO v_brand_status, v_audience_status, v_competitor_status
    FROM intelligence_projects
    WHERE id = v_project_id;

    -- Override with new value if this is the corresponding table
    IF TG_TABLE_NAME = 'brand_dna' THEN
        v_brand_status := COALESCE(NEW.status, v_brand_status);
    ELSIF TG_TABLE_NAME = 'audience_dna' THEN
        -- For audience, check if ALL personas are complete
        SELECT CASE
            WHEN COUNT(*) = 0 THEN 'pending'
            WHEN COUNT(*) FILTER (WHERE status = 'completed') = COUNT(*) THEN 'completed'
            WHEN COUNT(*) FILTER (WHERE status = 'failed') > 0 THEN 'failed'
            ELSE 'in_progress'
        END INTO v_audience_status
        FROM audience_dna
        WHERE project_id = v_project_id;
    ELSIF TG_TABLE_NAME = 'competitor_dna' THEN
        -- For competitors, check if ALL are complete
        SELECT CASE
            WHEN COUNT(*) = 0 THEN 'pending'
            WHEN COUNT(*) FILTER (WHERE status = 'completed') = COUNT(*) THEN 'completed'
            WHEN COUNT(*) FILTER (WHERE status = 'failed') > 0 THEN 'failed'
            ELSE 'in_progress'
        END INTO v_competitor_status
        FROM competitor_dna
        WHERE project_id = v_project_id;
    END IF;

    -- Determine overall project status
    IF v_brand_status = 'failed' OR v_audience_status = 'failed' OR v_competitor_status = 'failed' THEN
        v_new_status := 'failed';
    ELSIF v_brand_status = 'completed' AND v_audience_status = 'completed' AND v_competitor_status = 'completed' THEN
        v_new_status := 'completed';
    ELSIF v_brand_status = 'pending' AND v_audience_status = 'pending' AND v_competitor_status = 'pending' THEN
        v_new_status := 'draft';
    ELSE
        v_new_status := 'analyzing';
    END IF;

    -- Update project
    UPDATE intelligence_projects
    SET
        brand_dna_status = v_brand_status,
        audience_dna_status = v_audience_status,
        competitor_dna_status = v_competitor_status,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_project_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all DNA tables
CREATE TRIGGER trg_brand_dna_project_status
    AFTER INSERT OR UPDATE OF status ON brand_dna
    FOR EACH ROW
    EXECUTE FUNCTION update_project_status();

CREATE TRIGGER trg_audience_dna_project_status
    AFTER INSERT OR UPDATE OF status OR DELETE ON audience_dna
    FOR EACH ROW
    EXECUTE FUNCTION update_project_status();

CREATE TRIGGER trg_competitor_dna_project_status
    AFTER INSERT OR UPDATE OF status OR DELETE ON competitor_dna
    FOR EACH ROW
    EXECUTE FUNCTION update_project_status();

-- =====================================================
-- Function: Track API costs
-- =====================================================
CREATE OR REPLACE FUNCTION update_project_api_cost()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE intelligence_projects
    SET total_api_cost = (
        SELECT COALESCE(SUM(api_cost), 0)
        FROM (
            SELECT api_cost FROM brand_dna WHERE project_id = NEW.project_id
            UNION ALL
            SELECT api_cost FROM audience_dna WHERE project_id = NEW.project_id
            UNION ALL
            SELECT api_cost FROM competitor_dna WHERE project_id = NEW.project_id
        ) costs
    )
    WHERE id = NEW.project_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brand_dna_api_cost
    AFTER INSERT OR UPDATE OF api_cost ON brand_dna
    FOR EACH ROW
    EXECUTE FUNCTION update_project_api_cost();

CREATE TRIGGER trg_audience_dna_api_cost
    AFTER INSERT OR UPDATE OF api_cost ON audience_dna
    FOR EACH ROW
    EXECUTE FUNCTION update_project_api_cost();

CREATE TRIGGER trg_competitor_dna_api_cost
    AFTER INSERT OR UPDATE OF api_cost ON competitor_dna
    FOR EACH ROW
    EXECUTE FUNCTION update_project_api_cost();

-- =====================================================
-- Verification Query
-- =====================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('intelligence_projects', 'brand_dna', 'audience_dna', 'competitor_dna')
-- ORDER BY table_name;
