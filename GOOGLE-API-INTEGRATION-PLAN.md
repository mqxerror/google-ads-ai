# Google API Integration Plan
## Free Keyword Intelligence with Google's Ecosystem

### Vision
Build a comprehensive keyword intelligence system using **100% free Google APIs** instead of expensive third-party services (Moz: $1/kw, DataForSEO: $0.002/kw).

---

## API Inventory & Integration Priority

### ✅ Phase 1: Already Implemented
| API | Status | Purpose | Limit |
|-----|--------|---------|-------|
| **Google Ads API** | ✅ Live | Volume, CPC, Competition, Keyword Ideas | Unlimited* |

*Requires active Google Ads account

---

### 🚀 Phase 2: High-Value Quick Wins (Implement First)

#### 1. **Google Autocomplete API** (Highest Priority)
**Why First:** Unlimited, instant keyword expansion, no API key needed

**What It Provides:**
- Real-time search suggestions (what people are typing)
- Long-tail keyword variations
- Question-based queries
- "People Also Ask" style keywords

**Implementation:**
```typescript
// Endpoint: https://suggestqueries.google.com/complete/search?client=firefox&q={keyword}
async function getGoogleSuggestions(keyword: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword)}`;
  const response = await fetch(url);
  const [query, suggestions] = await response.json();
  return suggestions; // Array of suggested keywords
}
```

**UI Impact:**
- Add "🔍 Google Suggests" badge to keywords from autocomplete
- Show suggestion count in stats
- Filter/sort by suggestion source

**Database:**
```sql
ALTER TABLE keyword_metrics ADD COLUMN google_autocomplete_suggestions TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN autocomplete_fetched_at TIMESTAMP;
```

**Value:** Instant 10-50x keyword expansion from user's seed keyword

---

#### 2. **Google Trends API (Pytrends)** (Second Priority)
**Why Important:** Trending topics, seasonality, geographic interest

**What It Provides:**
- Interest over time (trending up/down?)
- Interest by region (which states/countries?)
- Related queries (rising, top)
- Search volume trend (relative)

**Implementation:**
```typescript
// Use pytrends library via Python microservice or Node wrapper
interface TrendsData {
  interestOverTime: { date: string; value: number }[];
  interestByRegion: { region: string; value: number }[];
  relatedQueries: {
    rising: { query: string; value: number }[];
    top: { query: string; value: number }[];
  };
}
```

**UI Impact:**
- 📈 "Trending" badge for rising keywords
- 📉 "Declining" warning for dropping keywords
- Regional heat map showing where keyword is popular
- Seasonality chart (show monthly trends)

**Database:**
```sql
ALTER TABLE keyword_metrics ADD COLUMN trends_interest_score INT; -- 0-100
ALTER TABLE keyword_metrics ADD COLUMN trends_direction VARCHAR(20); -- rising, declining, stable
ALTER TABLE keyword_metrics ADD COLUMN trends_monthly JSONB; -- 12-month trend data
ALTER TABLE keyword_metrics ADD COLUMN trends_fetched_at TIMESTAMP;
```

**Value:** Avoid declining keywords, prioritize trending opportunities

---

#### 3. **YouTube Data API** (Third Priority)
**Why Valuable:** Video search intent, content gaps, trending topics

**What It Provides:**
- Video search suggestions
- Trending video topics
- Video tags (what creators optimize for)
- Search volume indicators (view counts)

**Implementation:**
```typescript
// GET https://www.googleapis.com/youtube/v3/search?part=snippet&q={keyword}&key={API_KEY}
interface YouTubeKeywordData {
  suggestions: string[];
  topVideoTags: string[];
  totalResults: number;
  avgViews: number;
  contentGap: boolean; // Low competition, high views
}
```

**UI Impact:**
- 🎥 "Video Opportunity" badge for keywords with high YouTube volume but low text content
- Show top video titles/tags as keyword ideas
- "Content Gap" indicator (high views, few videos = opportunity)

**Database:**
```sql
ALTER TABLE keyword_metrics ADD COLUMN youtube_video_count INT;
ALTER TABLE keyword_metrics ADD COLUMN youtube_avg_views INT;
ALTER TABLE keyword_metrics ADD COLUMN youtube_top_tags TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN youtube_fetched_at TIMESTAMP;
```

**Value:** Identify video content opportunities, discover trending topics early

---

### 🔥 Phase 3: Advanced Intelligence

#### 4. **Google NLP API** (Intent Classification)
**What It Provides:**
- Entity extraction (what is this keyword about?)
- Sentiment analysis (positive/negative/neutral)
- Content categories (e.g., "/Business & Industrial/Advertising & Marketing")
- Salience scores (importance of entities)

**Implementation:**
```typescript
interface NLPAnalysis {
  entities: { name: string; type: string; salience: number }[];
  categories: { name: string; confidence: number }[];
  sentiment: { score: number; magnitude: number };
  primaryIntent: 'informational' | 'transactional' | 'navigational' | 'commercial';
}
```

**UI Impact:**
- 🧠 "AI Intent" badge with confidence score
- Entity tags (e.g., "About: CRM Software, Marketing, SaaS")
- Category classification (better than keyword matching)
- Sentiment indicator (problem-solving vs. positive queries)

**Database:**
```sql
ALTER TABLE keyword_metrics ADD COLUMN nlp_entities JSONB;
ALTER TABLE keyword_metrics ADD COLUMN nlp_categories JSONB;
ALTER TABLE keyword_metrics ADD COLUMN nlp_intent VARCHAR(50);
ALTER TABLE keyword_metrics ADD COLUMN nlp_intent_confidence FLOAT;
ALTER TABLE keyword_metrics ADD COLUMN nlp_fetched_at TIMESTAMP;
```

**Value:** Better intent classification than regex patterns, entity-based clustering

---

#### 5. **Google Custom Search JSON API** (SERP Analysis)
**What It Provides:**
- Top 10 search results
- SERP features (Featured snippets, People Also Ask, Knowledge Panel)
- Competitor domains ranking
- Meta descriptions, titles

**Implementation:**
```typescript
interface SERPData {
  topDomains: string[];
  serpFeatures: ('featured_snippet' | 'people_also_ask' | 'knowledge_panel' | 'local_pack')[];
  domainAuthority: { domain: string; position: number }[];
  avgTitleLength: number;
  avgMetaLength: number;
}
```

**UI Impact:**
- 🏆 "Easy Rank" badge (low-authority domains in top 10)
- 💎 "Featured Snippet Opportunity" flag
- Competitor list (who's ranking?)
- SERP feature indicators

**Database:**
```sql
ALTER TABLE keyword_metrics ADD COLUMN serp_top_domains TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN serp_features TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN serp_difficulty_score INT; -- Based on domain authority
ALTER TABLE keyword_metrics ADD COLUMN serp_fetched_at TIMESTAMP;
```

**Value:** Understand ranking difficulty, identify SERP feature opportunities

**Limit:** 100 queries/day (use strategically for high-value keywords)

---

#### 6. **Google Knowledge Graph API** (Entity Intelligence)
**What It Provides:**
- Entity descriptions
- Related entities
- Entity types (Person, Organization, Place, etc.)
- Detailed info (descriptions, images, URLs)

**Implementation:**
```typescript
interface EntityData {
  entityId: string;
  name: string;
  types: string[]; // ['Thing', 'Organization', 'Corporation']
  description: string;
  relatedEntities: { name: string; entityId: string }[];
}
```

**UI Impact:**
- 🔗 "Entity Cluster" grouping (group keywords by entity)
- Related topic suggestions
- Entity-based ad group recommendations
- Competitive entity mapping

**Database:**
```sql
ALTER TABLE keyword_metrics ADD COLUMN entity_id VARCHAR(255);
ALTER TABLE keyword_metrics ADD COLUMN entity_type TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN related_entities JSONB;
ALTER TABLE keyword_metrics ADD COLUMN entity_fetched_at TIMESTAMP;
```

**Value:** Smart keyword clustering, topic authority mapping

---

#### 7. **Google Search Console API** (Owned Performance)
**What It Provides:**
- Real queries driving traffic to YOUR site
- Actual clicks, impressions, CTR, position
- Performance by page, country, device
- Query-to-URL mapping

**Implementation:**
```typescript
interface GSCData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  page: string;
  country: string;
  device: string;
}
```

**UI Impact:**
- ⭐ "Already Ranking" badge for keywords you have impressions for
- Position tracking (are we moving up/down?)
- CTR optimization opportunities (high impressions, low clicks)
- Content gap analysis (high impressions on page X, should create dedicated page)

**Database:**
```sql
ALTER TABLE keyword_metrics ADD COLUMN gsc_clicks INT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_impressions INT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_ctr FLOAT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_position FLOAT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_landing_page TEXT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_fetched_at TIMESTAMP;
```

**Value:** Connect paid and organic search, identify content gaps

**Requirement:** User must verify site ownership in Search Console

---

## Database Schema Updates

### Updated `keyword_metrics` Table
```sql
-- Existing columns (already have)
-- keyword, keyword_normalized, locale, device, location_id
-- gads_search_volume, gads_avg_cpc_micros, gads_competition
-- best_search_volume, best_cpc, best_difficulty, best_intent, best_source
-- created_at, updated_at, cache_hit_count, expires_at, ttl_days

-- NEW: Google Autocomplete
ALTER TABLE keyword_metrics ADD COLUMN google_autocomplete_suggestions TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN autocomplete_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN autocomplete_status VARCHAR(50);

-- NEW: Google Trends
ALTER TABLE keyword_metrics ADD COLUMN trends_interest_score INT; -- 0-100
ALTER TABLE keyword_metrics ADD COLUMN trends_direction VARCHAR(20); -- rising, declining, stable
ALTER TABLE keyword_metrics ADD COLUMN trends_monthly JSONB; -- [{month, value}]
ALTER TABLE keyword_metrics ADD COLUMN trends_related_rising JSONB; -- [{query, value}]
ALTER TABLE keyword_metrics ADD COLUMN trends_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN trends_status VARCHAR(50);

-- NEW: YouTube
ALTER TABLE keyword_metrics ADD COLUMN youtube_video_count INT;
ALTER TABLE keyword_metrics ADD COLUMN youtube_avg_views INT;
ALTER TABLE keyword_metrics ADD COLUMN youtube_top_tags TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN youtube_content_gap BOOLEAN; -- Opportunity indicator
ALTER TABLE keyword_metrics ADD COLUMN youtube_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN youtube_status VARCHAR(50);

-- NEW: Google NLP
ALTER TABLE keyword_metrics ADD COLUMN nlp_entities JSONB; -- [{name, type, salience}]
ALTER TABLE keyword_metrics ADD COLUMN nlp_categories JSONB; -- [{name, confidence}]
ALTER TABLE keyword_metrics ADD COLUMN nlp_intent VARCHAR(50);
ALTER TABLE keyword_metrics ADD COLUMN nlp_intent_confidence FLOAT;
ALTER TABLE keyword_metrics ADD COLUMN nlp_sentiment_score FLOAT; -- -1 to 1
ALTER TABLE keyword_metrics ADD COLUMN nlp_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN nlp_status VARCHAR(50);

-- NEW: Google Custom Search (SERP)
ALTER TABLE keyword_metrics ADD COLUMN serp_top_domains TEXT[]; -- Top 10 domains
ALTER TABLE keyword_metrics ADD COLUMN serp_features TEXT[]; -- SERP features present
ALTER TABLE keyword_metrics ADD COLUMN serp_difficulty_score INT; -- 0-100 based on domain authority
ALTER TABLE keyword_metrics ADD COLUMN serp_has_featured_snippet BOOLEAN;
ALTER TABLE keyword_metrics ADD COLUMN serp_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN serp_status VARCHAR(50);

-- NEW: Google Knowledge Graph
ALTER TABLE keyword_metrics ADD COLUMN entity_id VARCHAR(255);
ALTER TABLE keyword_metrics ADD COLUMN entity_types TEXT[];
ALTER TABLE keyword_metrics ADD COLUMN entity_description TEXT;
ALTER TABLE keyword_metrics ADD COLUMN related_entities JSONB;
ALTER TABLE keyword_metrics ADD COLUMN entity_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN entity_status VARCHAR(50);

-- NEW: Google Search Console
ALTER TABLE keyword_metrics ADD COLUMN gsc_clicks INT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_impressions INT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_ctr FLOAT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_position FLOAT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_landing_page TEXT;
ALTER TABLE keyword_metrics ADD COLUMN gsc_fetched_at TIMESTAMP;
ALTER TABLE keyword_metrics ADD COLUMN gsc_status VARCHAR(50);

-- NEW: Composite scoring
ALTER TABLE keyword_metrics ADD COLUMN composite_opportunity_score INT; -- 0-100 based on all sources
ALTER TABLE keyword_metrics ADD COLUMN composite_calculated_at TIMESTAMP;
```

---

## Implementation Architecture

### 1. **Multi-Source Enrichment Pipeline**

```typescript
// src/lib/google-apis/orchestrator.ts
interface EnrichmentOptions {
  sources: ('autocomplete' | 'trends' | 'youtube' | 'nlp' | 'serp' | 'knowledge_graph' | 'gsc')[];
  useCache: boolean;
  priorityThreshold?: number; // Only enrich keywords above this opportunity score
}

async function enrichKeywordWithGoogleAPIs(
  keyword: string,
  options: EnrichmentOptions
): Promise<EnrichedKeywordData> {
  const results = await Promise.allSettled([
    options.sources.includes('autocomplete') ? getAutocomplete(keyword) : null,
    options.sources.includes('trends') ? getTrends(keyword) : null,
    options.sources.includes('youtube') ? getYouTube(keyword) : null,
    options.sources.includes('nlp') ? getNLP(keyword) : null,
    options.sources.includes('serp') ? getSERP(keyword) : null,
    options.sources.includes('knowledge_graph') ? getKnowledgeGraph(keyword) : null,
    options.sources.includes('gsc') ? getGSC(keyword) : null,
  ]);

  return mergeResults(results);
}
```

### 2. **Smart Caching Strategy**

Different APIs have different refresh rates:

| API | Cache TTL | Reason |
|-----|-----------|--------|
| Google Ads | 30 days | Volume/CPC changes slowly |
| Autocomplete | 7 days | Suggestions update weekly |
| Trends | 1 day | Interest changes daily |
| YouTube | 7 days | Video landscape changes weekly |
| NLP | Never expire | Intent doesn't change |
| SERP | 1 day | Rankings change daily |
| Knowledge Graph | Never expire | Entity data is static |
| Search Console | 1 day | Performance updates daily |

### 3. **Rate Limiting & Quota Management**

```typescript
// src/lib/google-apis/quota-manager.ts
const DAILY_LIMITS = {
  customSearch: 100, // 100 queries/day
  youtube: 10000, // 10K units/day
  nlp: 5000, // 5K units/month
  knowledgeGraph: 100000, // 100K calls/day
  autocomplete: Infinity, // Unlimited (rate limited)
  trends: Infinity, // Unlimited (rate limited)
  gsc: 50000, // 50K rows/day
};

// Prioritize high-value keywords for quota-limited APIs
async function enrichWithQuotaManagement(keywords: string[]) {
  // Sort by opportunity score
  const sorted = keywords.sort((a, b) => b.opportunityScore - a.opportunityScore);

  // Use Custom Search only for top 100 keywords
  const topKeywords = sorted.slice(0, 100);
  await enrichWithSERP(topKeywords);

  // Use NLP for top 5000 keywords per month
  const nlpCandidates = sorted.slice(0, 5000);
  await enrichWithNLP(nlpCandidates);

  // Use autocomplete/trends for all (unlimited)
  await enrichWithAutocomplete(keywords);
  await enrichWithTrends(keywords);
}
```

---

## UI Enhancements

### New Keyword Table Columns

| Column | Data | Source |
|--------|------|--------|
| **Trend** | 📈📉➡️ | Google Trends |
| **Video Opp** | 🎥 | YouTube API |
| **SERP Features** | 💎🔍 | Custom Search |
| **Intent** | 🧠 | Google NLP |
| **Your Rank** | #5 ⭐ | Search Console |

### New Filters
- **Trending Keywords** - Show only rising/hot keywords
- **Video Opportunities** - High YouTube volume, low competition
- **SERP Feature Targets** - Keywords with featured snippet opportunities
- **Already Ranking** - Keywords you already have impressions for
- **Entity Clusters** - Group by Knowledge Graph entity

### New Badges
- `🔥 Trending` - Rising interest (Trends)
- `🎥 Video Opp` - Content gap opportunity (YouTube)
- `💎 Featured Snippet` - SERP feature present (Custom Search)
- `🧠 High Intent` - Strong transactional/commercial intent (NLP)
- `⭐ Ranking` - Already getting impressions (Search Console)
- `🔗 Entity Match` - Related to known entity (Knowledge Graph)

---

## Premium Tier Unlocks

### Free Tier (Current)
- ✅ Google Ads (Volume, CPC, Competition)
- ✅ Autocomplete (Suggestions)
- ✅ Basic opportunity scoring

### Premium Tier (Token-Based)
- 🎯 Google Trends (Trending topics, seasonality)
- 📊 YouTube Analysis (Video opportunities)
- 🧠 NLP Intent (AI-powered classification)
- 💎 SERP Analysis (Top 100 keywords/day)
- 🔗 Entity Clustering (Knowledge Graph)
- ⭐ Search Console Integration (Own site performance)

**Pricing Model:**
- **Free:** 50 keywords/month with full enrichment
- **Starter:** $29/mo - 500 keywords/month
- **Pro:** $99/mo - 5,000 keywords/month
- **Enterprise:** $299/mo - Unlimited

---

## Implementation Priority

### Week 1: Quick Wins
1. ✅ Google Autocomplete (expand keyword ideas)
2. ✅ Google Trends (trending indicators)
3. ✅ Database schema updates

### Week 2: Content Intelligence
4. ✅ YouTube API (video opportunities)
5. ✅ UI enhancements (new badges, filters)

### Week 3: Advanced Features
6. ✅ Google NLP (intent classification)
7. ✅ Custom Search (SERP analysis for top keywords)

### Week 4: Final Integration
8. ✅ Knowledge Graph (entity clustering)
9. ✅ Search Console (owned performance)
10. ✅ Composite opportunity scoring
11. ✅ Premium tier UI/billing

---

## Success Metrics

**Data Coverage:**
- 100% of keywords have Google Ads data
- 100% of keywords have Autocomplete suggestions
- 100% of keywords have Trends data
- Top 100 keywords have SERP analysis
- Top 5000 keywords have NLP intent

**User Value:**
- 10-50x keyword expansion from autocomplete
- Trending indicators on 100% of keywords
- Video opportunity identification
- Better intent classification than competitors
- All for $0 API costs (vs. $1/kw Moz, $0.002/kw DataForSEO)

---

## Next Steps

1. **Choose starting point:** Autocomplete or Trends?
2. **Database migration:** Run schema update
3. **API setup:** Get API keys (YouTube, NLP, Custom Search, Knowledge Graph)
4. **Build services:** One API at a time
5. **UI integration:** Show new data in keyword table
6. **Test & iterate:** Validate data quality

**Ready to start?** I recommend beginning with **Google Autocomplete** - it's the easiest to implement (no API key, unlimited, instant value) and will immediately 10x your keyword suggestions.

Should I build the Autocomplete integration first?
