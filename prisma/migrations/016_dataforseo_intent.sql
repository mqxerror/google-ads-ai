-- =====================================================
-- Migration: 016_dataforseo_intent
-- Description: Add DataForSEO Search Intent columns
-- Created: 2026-01-03
-- =====================================================

-- Add DataForSEO Search Intent columns to keyword_metrics
ALTER TABLE keyword_metrics
ADD COLUMN IF NOT EXISTS dataforseo_intent TEXT CHECK (dataforseo_intent IN ('informational', 'navigational', 'commercial', 'transactional'));

ALTER TABLE keyword_metrics
ADD COLUMN IF NOT EXISTS dataforseo_intent_probability DECIMAL(5,4) CHECK (dataforseo_intent_probability >= 0 AND dataforseo_intent_probability <= 1);

ALTER TABLE keyword_metrics
ADD COLUMN IF NOT EXISTS dataforseo_secondary_intents JSONB;

ALTER TABLE keyword_metrics
ADD COLUMN IF NOT EXISTS dataforseo_intent_fetched_at TIMESTAMPTZ;

-- Index for intent lookup
CREATE INDEX IF NOT EXISTS idx_keyword_metrics_intent
ON keyword_metrics(keyword_normalized, dataforseo_intent)
WHERE dataforseo_intent IS NOT NULL;

-- Comments
COMMENT ON COLUMN keyword_metrics.dataforseo_intent IS 'Primary search intent from DataForSEO (commercial, informational, navigational, transactional). Cost: $0.02/1000 keywords';
COMMENT ON COLUMN keyword_metrics.dataforseo_intent_probability IS 'Confidence score for primary intent (0-1)';
COMMENT ON COLUMN keyword_metrics.dataforseo_secondary_intents IS 'Secondary intents with probabilities: [{"intent": "commercial", "probability": 0.3}]';
COMMENT ON COLUMN keyword_metrics.dataforseo_intent_fetched_at IS 'When intent was last fetched from DataForSEO';
