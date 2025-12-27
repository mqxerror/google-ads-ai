-- Migration: Add location_id to keyword_metrics for geo-targeted caching
-- Date: 2025-12-26
-- Purpose: Support location-specific keyword metrics (per GPT recommendation)

-- Step 1: Add location_id column with default US (2840)
ALTER TABLE keyword_metrics
ADD COLUMN location_id TEXT NOT NULL DEFAULT '2840';

-- Step 2: Drop existing unique constraint
ALTER TABLE keyword_metrics
DROP CONSTRAINT IF EXISTS unique_keyword_locale_device;

-- Step 3: Add new unique constraint including location_id
ALTER TABLE keyword_metrics
ADD CONSTRAINT unique_keyword_locale_device_location
UNIQUE NULLS NOT DISTINCT (keyword_normalized, locale, device, location_id);

-- Step 4: Create index for location-based lookups
CREATE INDEX IF NOT EXISTS idx_keyword_metrics_location
ON keyword_metrics(location_id, keyword_normalized);

-- Step 5: Update existing upsert conflict references in stored procedures if needed
-- (The application code will handle the new conflict target)

COMMENT ON COLUMN keyword_metrics.location_id IS 'Google Ads geoTargetConstant (e.g., 2840 for US, 2826 for UK)';
