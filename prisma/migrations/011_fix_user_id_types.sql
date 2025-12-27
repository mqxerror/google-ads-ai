-- Migration: Fix user_id column types to use TEXT instead of UUID
-- The User table uses CUID format (text), not UUID

-- Drop foreign key constraints first
ALTER TABLE tracked_keywords DROP CONSTRAINT IF EXISTS tracked_keywords_user_id_fkey;
ALTER TABLE serp_opportunities DROP CONSTRAINT IF EXISTS serp_opportunities_user_id_fkey;

-- Change user_id column types from UUID to TEXT
ALTER TABLE tracked_keywords ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE serp_opportunities ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Re-add foreign key constraints
ALTER TABLE tracked_keywords ADD CONSTRAINT tracked_keywords_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE serp_opportunities ADD CONSTRAINT serp_opportunities_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Update indexes if needed (they should still work with TEXT)
-- No changes needed for indexes as they work with TEXT as well
