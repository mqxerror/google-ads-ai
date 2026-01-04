-- =====================================================
-- Migration: 019_competitor_dna_updates
-- Description: Add missing columns for Competitor DNA and Unified Report
-- Created: 2026-01-04
-- =====================================================

-- Add missing columns to competitor_dna table
ALTER TABLE competitor_dna ADD COLUMN IF NOT EXISTS key_differentiators JSONB;
ALTER TABLE competitor_dna ADD COLUMN IF NOT EXISTS model_used TEXT;

-- Add unified report columns to intelligence_projects
ALTER TABLE intelligence_projects ADD COLUMN IF NOT EXISTS unified_report TEXT;
ALTER TABLE intelligence_projects ADD COLUMN IF NOT EXISTS unified_report_status TEXT DEFAULT 'pending'
    CHECK (unified_report_status IN ('pending', 'in_progress', 'completed', 'failed'));

-- Add model_used to audience_dna if missing
ALTER TABLE audience_dna ADD COLUMN IF NOT EXISTS model_used TEXT;

-- Add step tracking columns to audience_dna if missing
ALTER TABLE audience_dna ADD COLUMN IF NOT EXISTS current_step TEXT;
ALTER TABLE audience_dna ADD COLUMN IF NOT EXISTS step_progress INTEGER DEFAULT 0;
ALTER TABLE audience_dna ADD COLUMN IF NOT EXISTS step_message TEXT;

-- =====================================================
-- Verification Query
-- =====================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'competitor_dna'
-- ORDER BY ordinal_position;
