-- Add intent classification to keyword_list_items
-- This persists intent classification per list item

ALTER TABLE keyword_list_items
ADD COLUMN IF NOT EXISTS intent TEXT CHECK (intent IN ('commercial', 'informational', 'navigational', 'transactional'));

ALTER TABLE keyword_list_items
ADD COLUMN IF NOT EXISTS intent_confidence DECIMAL(3,2);

ALTER TABLE keyword_list_items
ADD COLUMN IF NOT EXISTS intent_source TEXT CHECK (intent_source IN ('ollama', 'embeddings', 'rules', 'openai'));

ALTER TABLE keyword_list_items
ADD COLUMN IF NOT EXISTS intent_classified_at TIMESTAMPTZ;

-- Index for filtering by intent
CREATE INDEX IF NOT EXISTS idx_keyword_list_items_intent ON keyword_list_items(intent);

COMMENT ON COLUMN keyword_list_items.intent IS 'Search intent: commercial, informational, navigational, transactional';
COMMENT ON COLUMN keyword_list_items.intent_confidence IS 'Confidence score 0-1 for the classification';
COMMENT ON COLUMN keyword_list_items.intent_source IS 'Source of classification: ollama, embeddings, rules, openai';
