-- =====================================================
-- Migration: 018_intelligence_steps
-- Description: Add granular step tracking for Intelligence analysis
-- Created: 2026-01-03
-- =====================================================

-- Add step tracking columns to brand_dna
ALTER TABLE brand_dna
ADD COLUMN IF NOT EXISTS current_step TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS step_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS step_message TEXT,
ADD COLUMN IF NOT EXISTS steps_log JSONB DEFAULT '[]'::jsonb;

-- Add step tracking columns to audience_dna
ALTER TABLE audience_dna
ADD COLUMN IF NOT EXISTS current_step TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS step_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS step_message TEXT;

-- Add step tracking columns to competitor_dna
ALTER TABLE competitor_dna
ADD COLUMN IF NOT EXISTS current_step TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS step_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS step_message TEXT;

-- Add model tracking to all DNA tables
ALTER TABLE brand_dna ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE audience_dna ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE competitor_dna ADD COLUMN IF NOT EXISTS model_used TEXT;

COMMENT ON COLUMN brand_dna.current_step IS 'Current analysis step: idle, scraping_homepage, scraping_about, researching, analyzing, generating_report, saving, completed, failed';
COMMENT ON COLUMN brand_dna.step_progress IS 'Progress percentage 0-100';
COMMENT ON COLUMN brand_dna.steps_log IS 'Array of {step, status, message, timestamp, duration_ms}';
