-- =====================================================
-- Migration: 015_dataforseo_kd
-- Description: Add DataForSEO Keyword Difficulty column
-- Created: 2026-01-03
-- =====================================================

-- Add DataForSEO Keyword Difficulty to keyword_metrics
ALTER TABLE keyword_metrics
ADD COLUMN IF NOT EXISTS dataforseo_kd INTEGER CHECK (dataforseo_kd >= 0 AND dataforseo_kd <= 100);

ALTER TABLE keyword_metrics
ADD COLUMN IF NOT EXISTS dataforseo_kd_fetched_at TIMESTAMPTZ;

-- Index for KD lookup
CREATE INDEX IF NOT EXISTS idx_keyword_metrics_kd
ON keyword_metrics(keyword_normalized, dataforseo_kd)
WHERE dataforseo_kd IS NOT NULL;

-- Update best_difficulty to use DataForSEO KD if available
COMMENT ON COLUMN keyword_metrics.dataforseo_kd IS 'Keyword Difficulty from DataForSEO Labs (0-100). Cost: $0.30/1000 keywords';
COMMENT ON COLUMN keyword_metrics.dataforseo_kd_fetched_at IS 'When KD was last fetched from DataForSEO';
