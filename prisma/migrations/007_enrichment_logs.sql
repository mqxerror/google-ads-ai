-- Migration: Add enrichment_logs table for debugging keyword enrichment pipeline
-- Tracks API requests, responses, and data transformation for troubleshooting

CREATE TABLE IF NOT EXISTS enrichment_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Request metadata
  request_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),

  -- Input parameters
  keywords TEXT[] NOT NULL,
  seed_keyword TEXT,
  locale VARCHAR(10) DEFAULT 'en-US',
  device VARCHAR(20) DEFAULT 'desktop',
  location_id VARCHAR(50) DEFAULT '2840',

  -- Provider configuration
  selected_providers TEXT[] NOT NULL,
  quota_check_result JSONB,

  -- API call details
  provider VARCHAR(50),
  api_endpoint TEXT,
  api_request JSONB,
  api_response JSONB,
  api_error JSONB,
  api_duration_ms INTEGER,

  -- Cache information
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  cached_data JSONB,

  -- Final enriched data
  enriched_keywords JSONB,

  -- Metadata
  status VARCHAR(50) DEFAULT 'pending', -- pending, success, partial, failed
  error_message TEXT
);

-- Create indexes
CREATE INDEX idx_enrichment_logs_request_id ON enrichment_logs(request_id);
CREATE INDEX idx_enrichment_logs_created_at ON enrichment_logs(created_at DESC);
CREATE INDEX idx_enrichment_logs_status ON enrichment_logs(status);

-- Add comment
COMMENT ON TABLE enrichment_logs IS 'Debug logs for keyword enrichment pipeline tracking API requests, responses, and data transformation';
