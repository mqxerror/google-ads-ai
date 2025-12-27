-- Migration: Add Google Autocomplete support to keyword_metrics
-- Stores autocomplete suggestions for keyword expansion

ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS google_autocomplete_suggestions TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS autocomplete_total_count INT DEFAULT 0;
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS autocomplete_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS autocomplete_status VARCHAR(50) DEFAULT 'pending';

-- Create index for faster autocomplete queries
CREATE INDEX IF NOT EXISTS idx_keyword_metrics_autocomplete ON keyword_metrics(autocomplete_status, autocomplete_fetched_at);

-- Add comment
COMMENT ON COLUMN keyword_metrics.google_autocomplete_suggestions IS 'Google autocomplete keyword suggestions (unlimited, no API key required)';
COMMENT ON COLUMN keyword_metrics.autocomplete_total_count IS 'Total number of autocomplete suggestions found';
COMMENT ON COLUMN keyword_metrics.autocomplete_fetched_at IS 'Timestamp when autocomplete data was last fetched';
COMMENT ON COLUMN keyword_metrics.autocomplete_status IS 'Status: pending, success, failed';
