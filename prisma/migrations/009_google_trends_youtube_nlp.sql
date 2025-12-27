-- Migration: Add Google Trends, YouTube, and NLP columns
-- Comprehensive enrichment data from free Google APIs

-- Google Trends columns
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS trends_interest_score INT DEFAULT 0; -- 0-100 average interest
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS trends_direction VARCHAR(20) DEFAULT 'stable'; -- rising, declining, stable, breakout
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS trends_monthly JSONB; -- [{date, value}] 12-month data
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS trends_related_rising JSONB; -- [{query, value}]
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS trends_peak_interest INT DEFAULT 0;
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS trends_peak_month VARCHAR(7); -- YYYY-MM
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS trends_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS trends_status VARCHAR(50) DEFAULT 'pending';

-- YouTube API columns
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS youtube_video_count INT DEFAULT 0;
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS youtube_avg_views INT DEFAULT 0;
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS youtube_top_tags TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS youtube_content_gap BOOLEAN DEFAULT FALSE; -- Opportunity indicator
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS youtube_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS youtube_status VARCHAR(50) DEFAULT 'pending';

-- Google NLP columns
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS nlp_entities JSONB; -- [{name, type, salience}]
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS nlp_categories JSONB; -- [{name, confidence}]
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS nlp_intent VARCHAR(50); -- transactional, informational, etc.
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS nlp_intent_confidence FLOAT DEFAULT 0;
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS nlp_sentiment_score FLOAT DEFAULT 0; -- -1 to 1
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS nlp_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN IF NOT EXISTS nlp_status VARCHAR(50) DEFAULT 'pending';

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_keyword_metrics_trends_direction ON keyword_metrics(trends_direction);
CREATE INDEX IF NOT EXISTS idx_keyword_metrics_youtube_gap ON keyword_metrics(youtube_content_gap) WHERE youtube_content_gap = TRUE;
CREATE INDEX IF NOT EXISTS idx_keyword_metrics_nlp_intent ON keyword_metrics(nlp_intent);

-- Add comments
COMMENT ON COLUMN keyword_metrics.trends_interest_score IS 'Google Trends average interest score (0-100)';
COMMENT ON COLUMN keyword_metrics.trends_direction IS 'Trending direction: rising, declining, stable, breakout';
COMMENT ON COLUMN keyword_metrics.youtube_content_gap IS 'TRUE if high views but low competition - content opportunity';
COMMENT ON COLUMN keyword_metrics.nlp_intent IS 'AI-classified search intent from Google NLP';
