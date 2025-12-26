-- Vector Store Setup for Quick Ads AI
-- P0 Priority: Foundation for all AI-powered keyword features

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Keywords table with embeddings + model metadata
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  embedding VECTOR(1536),  -- OpenAI ada-002 dimension
  embedding_model TEXT DEFAULT 'text-embedding-ada-002',
  embedding_dimensions INTEGER DEFAULT 1536,
  embedding_created_at TIMESTAMPTZ,
  campaign_id TEXT,
  ad_group_id TEXT,
  match_type TEXT,  -- BROAD, PHRASE, EXACT
  is_negative BOOLEAN DEFAULT FALSE,
  search_volume INTEGER,
  competition TEXT,  -- HIGH, MEDIUM, LOW
  cpc_estimate DECIMAL(10, 2),
  intent_score FLOAT,  -- 0-1 commercial intent
  quality_score INTEGER,  -- 1-10
  account_id UUID REFERENCES google_ads_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search terms table (from Google Ads) with embedding metadata
CREATE TABLE IF NOT EXISTS search_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_term TEXT NOT NULL,
  embedding VECTOR(1536),
  embedding_model TEXT DEFAULT 'text-embedding-ada-002',
  embedding_dimensions INTEGER DEFAULT 1536,
  embedding_created_at TIMESTAMPTZ,
  campaign_id TEXT,
  impressions INTEGER,
  clicks INTEGER,
  cost DECIMAL(10, 2),
  conversions INTEGER,
  added_as_keyword BOOLEAN DEFAULT FALSE,
  added_as_negative BOOLEAN DEFAULT FALSE,
  account_id UUID REFERENCES google_ads_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keyword clusters table
CREATE TABLE IF NOT EXISTS keyword_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  centroid VECTOR(1536),  -- Cluster center embedding
  keyword_count INTEGER,
  avg_intent_score FLOAT,
  account_id UUID REFERENCES google_ads_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cluster membership (which keywords belong to which cluster)
CREATE TABLE IF NOT EXISTS keyword_cluster_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES keyword_clusters(id) ON DELETE CASCADE,
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  similarity_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cluster_id, keyword_id)
);

-- Negative keyword lists (pre-built and custom)
CREATE TABLE IF NOT EXISTS negative_keyword_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- e.g., 'free', 'jobs', 'diy', 'competitors'
  is_prebuilt BOOLEAN DEFAULT FALSE,
  keyword_count INTEGER DEFAULT 0,
  account_id UUID REFERENCES google_ads_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Negative keywords in lists
CREATE TABLE IF NOT EXISTS negative_list_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES negative_keyword_lists(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  embedding VECTOR(1536),
  embedding_model TEXT DEFAULT 'text-embedding-ada-002',
  embedding_created_at TIMESTAMPTZ,
  match_type TEXT DEFAULT 'BROAD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, keyword)
);

-- Landing page scans
CREATE TABLE IF NOT EXISTS landing_page_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  extracted_keywords TEXT[],
  value_propositions TEXT[],
  content_summary TEXT,
  scan_status TEXT DEFAULT 'pending',  -- pending, completed, failed
  raw_content TEXT,
  account_id UUID REFERENCES google_ads_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast similarity search (IVFFlat)
-- Using lists = 100 for datasets < 1M rows
CREATE INDEX IF NOT EXISTS idx_keywords_embedding
  ON keywords USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_search_terms_embedding
  ON search_terms USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_negative_list_keywords_embedding
  ON negative_list_keywords USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Regular indexes for common queries
CREATE INDEX IF NOT EXISTS idx_keywords_account ON keywords(account_id);
CREATE INDEX IF NOT EXISTS idx_keywords_campaign ON keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_keywords_is_negative ON keywords(is_negative);
CREATE INDEX IF NOT EXISTS idx_search_terms_account ON search_terms(account_id);
CREATE INDEX IF NOT EXISTS idx_keyword_clusters_account ON keyword_clusters(account_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_keywords_updated_at ON keywords;
CREATE TRIGGER update_keywords_updated_at
    BEFORE UPDATE ON keywords
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_negative_keyword_lists_updated_at ON negative_keyword_lists;
CREATE TRIGGER update_negative_keyword_lists_updated_at
    BEFORE UPDATE ON negative_keyword_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert pre-built negative keyword lists
INSERT INTO negative_keyword_lists (name, description, category, is_prebuilt, keyword_count)
VALUES
  ('Free Seekers', 'Keywords indicating users looking for free alternatives', 'free', TRUE, 0),
  ('Job Seekers', 'Keywords from people looking for jobs, not services', 'jobs', TRUE, 0),
  ('DIY/How-To', 'Users wanting to do it themselves, not hire', 'diy', TRUE, 0),
  ('Informational', 'Research queries unlikely to convert', 'informational', TRUE, 0),
  ('Competitor Brands', 'Common competitor brand variations to exclude', 'competitors', TRUE, 0)
ON CONFLICT DO NOTHING;
