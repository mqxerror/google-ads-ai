# Quick Ads AI — Simplified Product Requirements Document

**Version:** 2.1 (Savings-First AI Operator)
**Last Updated:** December 2024
**Status:** Current Implementation + Planned Features

---

## What This Document Is

This PRD documents **what Quick Ads AI actually is today** — a simple, fast Google Ads dashboard with AI assistance. It's written for a new team to understand the product without agency complexity.

**Core Value Proposition:** "Stop wasting spend. Grow what works."

---

## 1. Product Overview

### What It Is
**Quick Ads AI** is a web application with two modes:

| Mode | Default | Purpose |
|------|---------|---------|
| **Monitor Mode** | ✓ Yes | Single-page dashboard + AI assistant + one-click toggles |
| **Build Mode** | Optional | Smart Campaign Creator + keyword tools (power users) |

This keeps the app "simple" for 80% of sessions while letting power users go deeper.

### What It Is NOT (Out of Scope)
- Multi-account management (MCC)
- Agency features
- User settings or preferences
- Team collaboration
- Report generation
- Autonomous optimization (AI recommends, humans approve)

### Target User
**Simple customer**: A business owner or marketer who runs Google Ads and wants quick visibility + AI help without complexity.

---

## 2. Current Features

### 2.1 Dashboard (Main Screen) — Monitor Mode

Single page with two panels, designed to feel **smart without adding UI clutter**:

**Left Panel — Campaign Overview**
| Component | Description |
|-----------|-------------|
| Header | "Quick Ads AI" branding + tagline |
| Stats Summary | 4 cards: Total Spend, Conversions, Active Campaigns, Avg AI Score |
| **Focus Filter** | Tab bar: `All` \| `Needs Attention` \| `Top Performers` \| `Wasted Spend` |
| Campaign Table | Sortable list with smart inline context |

**Campaign Table Enhancements:**
| Feature | Description |
|---------|-------------|
| **Clickable AI Score** | Click score → side panel/popover showing top 2 drivers + recommended action |
| **Row-level Microcopy** | Subtle one-liner under campaign name when score is low (e.g., "High CPA vs benchmark") |
| **AI Highlights** | When AI recommends actions, relevant rows auto-highlight |

**Right Panel — AI Assistant (Action Cockpit)**
| Component | Description |
|-----------|-------------|
| Header | Sparkle icon + "AI Assistant" title |
| Suggestion Chips | "Optimize my campaigns", "What should I pause?", "Show top performers" |
| Chat Area | Scrollable message history with streaming responses |
| **Action Cards** | AI responses include compact cards with Review button (not "Do it now") |
| Input | Text field + Send button |

**AI Chat Output Patterns:**
- **Row Highlighting:** When user asks "what should I pause?", AI responds AND auto-highlights those campaigns in table
- **Action Confirmation Cards:** Compact cards showing "Pause 2 campaigns → Est. savings $X/30 days" with `[Review]` button
- **Benchmark Explainer:** When AI references benchmarks, tiny "based on what?" link shows explanation

### 2.2 Campaign Table Columns
| Column | Data | Format |
|--------|------|--------|
| Campaign | Name + Type badge | Text + SEARCH/SHOPPING/etc tag |
| Status | Visual indicator | Green dot (ENABLED) or Gray dot (PAUSED) |
| Spend | Total spend | $X,XXX |
| Conv | Conversion count | Integer |
| CTR | Click-through rate | X.XX% |
| CPA | Cost per acquisition | $X.XX |
| AI Score | Performance score | 0-100 with color coding (Green 70+, Yellow 40-69, Red <40) |
| Action | Toggle button | "Pause" or "Enable" |

### 2.3 AI Score Calculation

The AI Score is calculated from 4 normalized factors (weights sum to 100%), each compared against industry benchmarks by campaign type:

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| CTR Performance | 30% | Click-through rate vs benchmark |
| Conversion Efficiency | 30% | CPA vs benchmark |
| Wasted Spend | 25% | Spend without conversions |
| ROAS/Value Coverage | 15% | Return on ad spend (only if value data available) |

**Data Confidence Modifier:**
Low-volume campaigns shouldn't get aggressively scored from noise.

| Data Points (clicks) | Confidence | Score Modifier |
|---------------------|------------|----------------|
| < 10 clicks | Low | Score pulls toward 50 (neutral) |
| 10-50 clicks | Medium | Score scaled 75% toward calculated |
| > 50 clicks | High | Full calculated score used |

```typescript
// Confidence adjustment formula
const confidence = clicks < 10 ? 0.3 : clicks < 50 ? 0.75 : 1.0;
const adjustedScore = 50 + (rawScore - 50) * confidence;
```

**Status Levels:**
- `good` = Positive contribution to score
- `warning` = Below benchmark but not critical
- `critical` = Significant problem requiring action

**Clickable Score UI:**
When user clicks an AI Score, show a popover with:
1. Top 2 score drivers (e.g., "CTR below benchmark", "$X wasted spend")
2. One recommended action (e.g., "Consider pausing or reviewing keywords")
3. Data confidence indicator

### 2.4 AI Chat
- **Provider:** Claude via Anthropic API
- **Model:** Configurable via `CLAUDE_MODEL` env var (default: `claude-sonnet-4-20250514`)
- **Fallback:** Simulated responses when no API key
- **Context:** AI receives current campaign data with each message
- **Streaming:** Real-time response streaming via SSE

**AI Can:**
- Analyze campaign performance
- Recommend which campaigns to pause
- Identify top performers to scale
- Answer questions about the data
- **Highlight table rows** when recommending actions
- **Show action cards** with estimated impact

**AI Cannot:**
- Execute actions directly (always requires user approval)
- Access historical data
- Manage keywords/ads autonomously

---

## 3. Technical Implementation

### 3.1 Tech Stack
| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Auth | NextAuth.js v5 (beta) |
| Google Ads | google-ads-api v21 |
| AI | Anthropic Claude API |

### 3.2 File Structure
```
src/
├── app/
│   ├── page.tsx              # Main dashboard (single page)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/
│       ├── auth/[...nextauth]/route.ts  # Auth endpoints
│       ├── google-ads/campaigns/route.ts # Campaign CRUD
│       └── ai/chat/route.ts             # AI chat streaming
├── lib/
│   ├── auth.ts               # NextAuth config + demo mode
│   ├── google-ads.ts         # Google Ads API wrapper
│   └── ai-score.ts           # AI scoring algorithm
└── types/
    ├── campaign.ts           # Campaign, AdGroup, Keyword, Ad types
    └── next-auth.d.ts        # Session type extensions
```

### 3.3 API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/*` | Various | NextAuth handlers |
| `/api/google-ads/campaigns` | GET | Fetch campaigns |
| `/api/google-ads/campaigns` | PATCH | Update campaign status |
| `/api/google-ads/campaigns` | POST | Create campaign (stub) |
| `/api/ai/chat` | POST | AI chat with streaming |

### 3.4 Authentication Flow
1. User clicks login
2. Google OAuth with `adwords` scope
3. Access token stored in session
4. Token auto-refreshes via refresh_token

**Demo Mode:**
- Enabled via `DEMO_MODE=true` env var
- Uses credential-based auth with mock user
- Returns hardcoded demo campaigns

### 3.5 Environment Variables
```
# Authentication
GOOGLE_CLIENT_ID=           # Google OAuth client ID
GOOGLE_CLIENT_SECRET=       # Google OAuth client secret
GOOGLE_ADS_DEVELOPER_TOKEN= # Google Ads API token
GOOGLE_ADS_LOGIN_CUSTOMER_ID= # Manager account ID (optional)
NEXTAUTH_URL=               # App URL for OAuth
NEXTAUTH_SECRET=            # Session encryption key

# AI Configuration
ANTHROPIC_API_KEY=          # Claude API key
CLAUDE_MODEL=               # Model ID (default: claude-sonnet-4-20250514)

# App Mode
DEMO_MODE=                  # true/false for demo mode
```

**Note:** `CLAUDE_MODEL` should be updated when Anthropic releases new models. Always log the active model in `/api/ai/chat` responses for debugging.

---

## 4. Data Flow

### 4.1 Campaign Data Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Next.js    │────▶│ Google Ads  │
│  (React)    │◀────│  API Route  │◀────│    API      │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │
      │                    ▼
      │            ┌─────────────┐
      │            │  AI Score   │
      │            │ Calculator  │
      │            └─────────────┘
      ▼
┌─────────────┐
│  Campaign   │
│   Table     │
└─────────────┘
```

### 4.2 AI Chat Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│  Chat API   │────▶│  Anthropic  │
│   Input     │     │   Route     │     │  Claude     │
└─────────────┘     └─────────────┘     └─────────────┘
      ▲                    │
      │                    │ SSE Stream
      │                    ▼
      │            ┌─────────────┐
      └────────────│   Chat UI   │
                   │  (updates)  │
                   └─────────────┘
```

---

## 5. User Journey

### 5.1 Happy Path
1. User lands on dashboard
2. Campaigns load automatically (demo or real via OAuth)
3. User sees stats summary + campaign table
4. User notices low AI Score on a campaign
5. User asks AI: "Why is Generic Keywords doing poorly?"
6. AI explains: "High CPA $350, CTR below benchmark, $4,200 spent with only 12 conversions"
7. User clicks "Pause" button on that campaign
8. Campaign status updates immediately (optimistic UI)
9. User asks: "What should I scale?"
10. AI recommends top performers

### 5.2 Demo Mode Journey
1. User loads app with `DEMO_MODE=true`
2. 5 demo campaigns load automatically
3. User can interact with AI chat
4. Status toggles work (local state only)
5. No real Google Ads connection required

---

## 6. Current Limitations

| Limitation | Impact | Notes |
|------------|--------|-------|
| Single account only | Can't manage multiple ad accounts | No MCC support |
| No persistent storage | Changes don't persist across sessions in demo | Real mode uses API |
| No ad group drill-down | Can't see ad group/keyword details | Types exist but unused |
| No campaign creation | Can only view/toggle existing campaigns | POST endpoint is stub |
| Hardcoded customer ID | Uses "demo" as customerId | Need account switcher |
| No date range selector | Fixed to last 30 days | Hardcoded in API |
| No login page UI | Direct OAuth redirect | Needs `/login` page |

---

## 7. Demo Campaigns (Reference)

The demo mode includes 5 sample campaigns:

| Name | Type | Status | Spend | Conv | CTR | CPA | AI Score |
|------|------|--------|-------|------|-----|-----|----------|
| Brand Search | SEARCH | ENABLED | $2,500 | 45 | 8.0% | $55.56 | 78 |
| Generic Keywords | SEARCH | ENABLED | $4,200 | 12 | 3.2% | $350 | 35 |
| Shopping Feed | SHOPPING | ENABLED | $1,800 | 28 | 5.4% | $64.29 | 82 |
| Display Remarketing | DISPLAY | PAUSED | $950 | 3 | 0.4% | $316.67 | 28 |
| Performance Max | PERFORMANCE_MAX | ENABLED | $3,200 | 52 | 2.97% | $61.54 | 71 |

---

## 8. Deployment

### Current Production
- **URL:** https://ads.mercan.com
- **Host:** Dokploy (Docker)
- **Database:** Supabase PostgreSQL (configured but minimal usage)
- **Domain:** Via Nginx reverse proxy with Let's Encrypt SSL

### Environment
- Node.js runtime
- Docker multi-stage build
- Auto-deployment from GitHub main branch

---

## 9. What a New Developer Needs to Know

### To Run Locally
```bash
npm install
npm run dev
```
App runs on http://localhost:3000

### To Test Without Google Ads
Set `DEMO_MODE=true` in `.env.local`

### Key Files to Understand
1. `src/app/page.tsx` — The entire UI
2. `src/lib/google-ads.ts` — All Google Ads API logic
3. `src/lib/ai-score.ts` — Scoring algorithm
4. `src/app/api/ai/chat/route.ts` — AI chat endpoint

### No Database Needed
The current implementation doesn't require a database for core functionality. All data comes from Google Ads API or is calculated on the fly.

---

## 10. Planned Features: Savings-First Keyword Intelligence

**Design Philosophy:** Every feature anchors to one universal outcome: **"Stop wasting spend. Grow what works."**

The keyword tools are NOT positioned as "vector search" or "clustering tools" — they're positioned as **savings finders** that use AI under the hood.

### 10.1 Vector Store Architecture (Infrastructure)

> **User-facing narrative:** "We find wasted spend by understanding what your keywords actually mean."
> **Technical reality:** Vector embeddings power semantic matching.

**Purpose:** Store all keywords as vector embeddings in Supabase for semantic search, clustering, and opportunity discovery.

**Why Vector Store (Technical):**
- Find semantically similar keywords (not just string matching)
- Discover keyword opportunities based on meaning
- Cluster keywords by semantic similarity automatically
- Identify gaps in keyword coverage
- Cross-reference search terms with existing keywords

**Embedding Metadata (for model migration):**
Every vector row stores:
- `embedding_model` — e.g., "text-embedding-ada-002"
- `embedding_dimensions` — e.g., 1536
- `embedding_created_at` — timestamp

This allows incremental re-embedding when switching models.

**Supabase Setup:**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Keywords table with embeddings + model metadata
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  embedding VECTOR(1536),  -- OpenAI ada-002 dimension
  embedding_model TEXT DEFAULT 'text-embedding-ada-002',
  embedding_dimensions INTEGER DEFAULT 1536,
  embedding_created_at TIMESTAMPTZ,
  campaign_id TEXT,
  ad_group_id TEXT,
  match_type TEXT,  -- BROAD, PHRASE, EXACT
  intent TEXT,  -- commercial, informational, navigational, transactional
  intent_score FLOAT,
  search_volume INTEGER,
  cpc FLOAT,
  competition TEXT,  -- LOW, MEDIUM, HIGH
  is_negative BOOLEAN DEFAULT FALSE,
  source TEXT,  -- 'google_ads', 'dataforseo', 'manual', 'ai_suggested'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search terms table (from Google Ads) with embedding metadata
CREATE TABLE search_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_term TEXT NOT NULL,
  embedding VECTOR(1536),
  embedding_model TEXT DEFAULT 'text-embedding-ada-002',
  embedding_dimensions INTEGER DEFAULT 1536,
  embedding_created_at TIMESTAMPTZ,
  campaign_id TEXT,
  impressions INTEGER,
  clicks INTEGER,
  conversions FLOAT,
  cost FLOAT,
  matched_keyword TEXT,
  is_negative_candidate BOOLEAN DEFAULT FALSE,
  negative_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keyword clusters table
CREATE TABLE keyword_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  centroid VECTOR(1536),  -- Cluster center embedding
  keyword_count INTEGER,
  avg_intent_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast similarity search
CREATE INDEX ON keywords USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON search_terms USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Embedding Generation:**
```typescript
// Using OpenAI embeddings (1536 dimensions)
import OpenAI from 'openai';

async function generateEmbedding(text: string): Promise<number[]> {
  const openai = new OpenAI();
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
}
```

**Semantic Search Query:**
```sql
-- Find keywords similar to a search term
SELECT
  keyword,
  intent,
  search_volume,
  1 - (embedding <=> $1) as similarity
FROM keywords
WHERE 1 - (embedding <=> $1) > 0.8  -- 80% similarity threshold
ORDER BY similarity DESC
LIMIT 20;
```

---

### 10.2 Keyword Clustering Tool (Vector-Based)

**Purpose:** Automatically group keywords by semantic meaning using vector similarity.

**How It Works:**
1. User pastes keywords
2. System generates embeddings for each keyword
3. K-means clustering on embedding vectors
4. Each cluster gets a centroid and auto-generated name
5. Results stored in vector DB for future reference

**UI Components:**
| Component | Description |
|-----------|-------------|
| Keywords Input | Text area for pasting keywords (max 5000) |
| Similarity Threshold | Slider 0.5-0.95 (how tight clusters should be) |
| Min Cluster Size | Minimum keywords per group (default: 2) |
| Cluster Button | Triggers vector clustering |
| Results View | Expandable groups with similarity scores |
| Save to DB | Store clusters for future use |

**Data Flow:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Paste     │────▶│  Generate   │────▶│   Vector    │────▶│  Clustered  │
│  Keywords   │     │  Embeddings │     │  Clustering │     │   Groups    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                                        │
                          ▼                                        ▼
                   ┌─────────────┐                          ┌─────────────┐
                   │  Supabase   │                          │    Save     │
                   │  pgvector   │◀─────────────────────────│  Clusters   │
                   └─────────────┘                          └─────────────┘
```

**API Endpoint:** `POST /api/keywords/cluster`
```typescript
// Request
{
  keywords: string[],
  similarityThreshold: number,  // 0.5-0.95
  minClusterSize: number,
  saveToDb: boolean
}

// Response
{
  clusters: [
    {
      id: "uuid",
      name: "portugal citizenship",
      keywords: [
        { keyword: "buy portugal citizenship", similarity: 0.95 },
        { keyword: "purchase portuguese citizenship", similarity: 0.92 },
        { keyword: "portugal citizenship by investment", similarity: 0.89 }
      ],
      avgSimilarity: 0.92
    }
  ],
  unclustered: ["keyword that didn't fit any cluster"]
}
```

---

### 10.3 Negative Keywords Manager (Savings-First)

**Purpose:** AI-powered identification and management of negative keywords with quick selection-based approval.

> **Key UX Principle:** Lead with ROI, not clusters. The first thing users see is **potential savings**, not technical features.

**Default View — Wasted Spend Patterns:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Potential Savings This Month                                │
│                                                                 │
│     💰 $523.00                                                  │
│     from 6 negative keyword patterns                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Suggested Negatives                              [Approve All] │
├─────────────────────────────────────────────────────────────────┤
│  ☑ "free"          12 search terms   $145.50 wasted   95% conf │
│  ☑ "jobs"          8 search terms    $98.20 wasted    92% conf │
│  ☑ "how to"        15 search terms   $87.30 wasted    88% conf │
│  ☐ "cheap"         5 search terms    $62.00 wasted    75% conf │
│  ☑ "salary"        6 search terms    $78.50 wasted    90% conf │
│  ☑ "download"      9 search terms    $51.50 wasted    87% conf │
├─────────────────────────────────────────────────────────────────┤
│  Selected: 5 of 6 ($461.00 savings)    [Apply to Campaign]      │
└─────────────────────────────────────────────────────────────────┘

Tabs: [ Suggested ] [ Applied ] [ Clusters (Advanced) ]
```

**Why Savings-First:**
- If you lead with "clusters," you feel like a keyword tool
- If you lead with "savings," you feel like an AI operator that prints money

**UI Components:**
| Component | Description |
|-----------|-------------|
| Suggestion List | Checkbox list with keyword, reason, confidence |
| Select All / None | Quick toggle buttons |
| Approve All Button | Apply all suggestions instantly |
| Apply Selected | Apply only checked items |
| Confidence Filter | Slider to show only high-confidence suggestions |
| Pre-built Lists | Dropdown to add entire category (Job Seekers, Free Seekers, etc.) |

**Pre-built Negative Lists:**
| List Name | Keywords Count | Example Keywords |
|-----------|----------------|------------------|
| Job Seekers | 45 | "jobs", "careers", "hiring", "salary", "resume" |
| Free Seekers | 38 | "free", "download", "torrent", "cheap", "coupon" |
| DIY/How-to | 52 | "how to", "tutorial", "guide", "diy", "learn" |
| Informational | 67 | "what is", "definition", "meaning", "wiki" |

**Vector-Enhanced Detection:**
```sql
-- Find search terms semantically similar to known negative patterns
SELECT
  st.search_term,
  st.cost,
  st.conversions,
  1 - (st.embedding <=> neg.embedding) as similarity
FROM search_terms st
CROSS JOIN LATERAL (
  SELECT embedding FROM keywords WHERE is_negative = true
) neg
WHERE st.conversions = 0
  AND st.cost > 10
  AND 1 - (st.embedding <=> neg.embedding) > 0.7
ORDER BY st.cost DESC;
```

**API Endpoint:** `POST /api/keywords/suggest-negatives`
```typescript
// Request
{
  campaignId: string,
  minConfidence: number,  // 0.5-1.0
  includePrebuiltLists: string[]  // ["job_seekers", "free_seekers"]
}

// Response
{
  suggestions: [
    {
      keyword: "free",
      reason: "Low commercial intent",
      confidence: 0.95,
      source: "ai_analysis",
      searchTermMatches: 12,  // How many search terms match
      wastedSpend: 145.50     // $ spent on this pattern
    }
  ],
  prebuiltApplied: ["job_seekers"],
  totalPotentialSavings: 523.00
}
```

**API Endpoint:** `POST /api/keywords/apply-negatives`
```typescript
// Request
{
  campaignId: string,
  keywords: string[],
  matchType: "BROAD" | "PHRASE" | "EXACT"
}

// Response
{
  applied: 5,
  failed: 0,
  campaignId: "123456"
}
```

---

### 10.4 Smart Campaign Creation Tool — Build Mode

**Purpose:** AI-powered campaign builder that creates optimized campaigns from a simple business description.

> **UX Philosophy:** Simplify the wizard into a single "draft" moment. Same underlying pipeline, much less perceived complexity.

**What Makes It Smart:**
1. **Scans landing page** for content, keywords, and value propositions (Crawl4AI + Claude)
2. **Auto-generates keywords** from business description + landing page using AI + DataForSEO
3. **Clusters keywords into ad groups** using vector similarity
4. **Writes ad copy** tailored to each ad group's theme + landing page content
5. **Sets intent-based bids** (commercial intent = higher bid)
6. **Pre-applies relevant negative keywords** from vector store
7. **Suggests budget** based on competition data

**Landing Page Scanner (Crawl4AI + Claude):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  🔍 Scanning Landing Page...                                        │
│  URL: https://mercan.com/portugal-golden-visa                       │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ Page Content Extracted                                          │
│  ✅ Value Propositions Identified (5)                               │
│  ✅ Keywords Extracted (23)                                         │
│  ✅ CTAs Analyzed (3)                                               │
│  ✅ Pricing/Offers Found                                            │
└─────────────────────────────────────────────────────────────────────┘
```

**What the Scanner Extracts:**
| Data Point | Use Case |
|------------|----------|
| **Headlines/H1-H3** | Ad headline inspiration |
| **Meta Description** | Ad description base |
| **Value Propositions** | Unique selling points for ads |
| **Keywords in Content** | Seed keywords for expansion |
| **CTAs** | Call-to-action language for ads |
| **Pricing/Offers** | Specific offers to highlight |
| **Trust Signals** | Testimonials, certifications to mention |
| **Page Structure** | Landing page quality score |

**Scanner API Flow:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   URL Input  │────▶│   Crawl4AI   │────▶│   Raw HTML   │
│              │     │   Scraper    │     │   + Text     │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │   Claude     │
                                          │   Analyze    │
                                          │   Content    │
                                          └──────────────┘
                                                 │
                     ┌───────────────────────────┼───────────────────────────┐
                     │                           │                           │
                     ▼                           ▼                           ▼
              ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
              │   Keywords   │           │   Ad Copy    │           │   Campaign   │
              │   Extracted  │           │   Suggestions│           │   Settings   │
              └──────────────┘           └──────────────┘           └──────────────┘
```

**API Endpoint:** `POST /api/landing-page/scan`
```typescript
// Request
{
  url: string,
  extractKeywords: boolean,
  generateAdCopy: boolean
}

// Response
{
  url: string,
  title: string,
  metaDescription: string,
  headlines: string[],
  valuePropositions: string[],
  extractedKeywords: string[],
  ctas: string[],
  pricing: { found: boolean, details: string },
  trustSignals: string[],
  suggestedAdCopy: {
    headlines: string[],
    descriptions: string[]
  },
  qualityScore: number,  // 0-100
  warnings: string[]  // e.g., "No clear CTA found"
}
```

**User Flow — Single Draft Moment:**

Instead of a 5-step wizard, the user gets one input → one AI-generated draft → progressive disclosure to edit.

```
┌─────────────────────────────────────────────────────────────────────┐
│  🚀 Create Smart Campaign                                           │
├─────────────────────────────────────────────────────────────────────┤
│  What's your business?                                              │
│  [Portugal Golden Visa consulting services                       ]  │
│                                                                     │
│  Landing Page URL (optional):                                       │
│  [https://mercan.com/portugal-golden-visa                        ]  │
│                                                                     │
│  Goal:  (○) Leads  (●) Sales  (○) Traffic                          │
│                                                                     │
│                              [✨ Generate Draft Campaign]           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    (AI generates everything in ~30 seconds)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  📋 Draft Campaign: "Portugal Golden Visa - US"                     │
│                                                                     │
│  ┌─ Summary ─────────────────────────────────────────────────────┐  │
│  │  📊 5 Ad Groups  │  🔑 127 Keywords  │  🚫 45 Negatives       │  │
│  │  💰 $100/day suggested  │  📈 Est. 15-25 leads/month          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ▸ Ad Groups & Keywords (127 total)               [Expand to edit]  │
│  ▸ Ad Copy (15 headlines, 4 descriptions)         [Expand to edit]  │
│  ▸ Negative Keywords (45 auto-applied)            [Expand to edit]  │
│  ▸ Budget & Bidding ($100/day recommended)        [Expand to edit]  │
│                                                                     │
│  [Save as Draft]              [🚀 Launch Campaign]                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Progressive Disclosure:** Users only expand sections they want to customize. Most users just click "Launch Campaign" after reviewing the summary.

**Expanded Section Example:**
```
▾ Ad Groups & Keywords (127 total)
  ┌─ Golden Visa Portugal (24 keywords) ─────────────────────────────┐
  │  ☑ golden visa portugal              Vol: 12K   CPC: $4.50       │
  │  ☑ portugal golden visa program      Vol: 8K    CPC: $5.20       │
  │  ☑ portugal golden visa requirements Vol: 6K    CPC: $3.80       │
  │  [Show 21 more...]                                               │
  └──────────────────────────────────────────────────────────────────┘
  ┌─ Portugal Citizenship (18 keywords) ─────────────────────────────┐
  │  ...                                                             │
  └──────────────────────────────────────────────────────────────────┘
  [+ Add keywords]  [Remove low-intent]
```

**AI Generation Pipeline:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Business   │────▶│   Claude     │────▶│   Seed       │
│   Description│     │   Extract    │     │   Keywords   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
        ┌────────────────────────────────────────┤
        │                                        │
        ▼                                        ▼
┌──────────────┐                         ┌──────────────┐
│  DataForSEO  │                         │  Vector DB   │
│  Expand +    │                         │  Find        │
│  Volume Data │                         │  Similar     │
└──────────────┘                         └──────────────┘
        │                                        │
        └────────────────┬───────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Vector     │
                  │   Cluster    │
                  │   into       │
                  │   Ad Groups  │
                  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Claude     │
                  │   Generate   │
                  │   Ad Copy    │
                  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Apply      │
                  │   Negatives  │
                  │   from DB    │
                  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Google     │
                  │   Ads API    │
                  │   Create     │
                  └──────────────┘
```

**API Endpoints:**

`POST /api/campaigns/analyze`
```typescript
// Request
{
  businessDescription: string,
  websiteUrl?: string,
  targetLocation: string,
  goal: "leads" | "sales" | "traffic"
}

// Response
{
  seedKeywords: string[],
  suggestedBudget: number,
  competitionLevel: "low" | "medium" | "high",
  estimatedCpc: number
}
```

`POST /api/campaigns/generate-structure`
```typescript
// Request
{
  seedKeywords: string[],
  similarityThreshold: number,
  includeVolume: boolean
}

// Response
{
  adGroups: [
    {
      name: "Golden Visa Portugal",
      keywords: [
        { keyword: "golden visa portugal", volume: 12000, cpc: 4.50, intent: "commercial" }
      ]
    }
  ]
}
```

`POST /api/campaigns/generate-ads`
```typescript
// Request
{
  adGroupName: string,
  keywords: string[],
  businessDescription: string,
  websiteUrl: string
}

// Response
{
  headlines: string[],  // 15 headlines
  descriptions: string[]  // 4 descriptions
}
```

`POST /api/campaigns/create`
```typescript
// Request
{
  name: string,
  dailyBudget: number,
  biddingStrategy: "MAXIMIZE_CONVERSIONS" | "MANUAL_CPC" | "TARGET_CPA",
  targetCpa?: number,
  adGroups: AdGroup[],
  negativeKeywords: string[]
}

// Response
{
  campaignId: string,
  status: "created" | "pending_review",
  googleAdsUrl: string
}
```

---

### 10.5 Keyword Research Reports

**Purpose:** Competitor and keyword expansion research tools.

**Report Types:**
| Report | Description | Data Source |
|--------|-------------|-------------|
| **Expand Keywords** | Find related keywords from seeds | Claude AI + DataForSEO |
| **Suggest Keywords** | AI-generated keyword ideas | Claude AI |
| **Competitor Keyword Spy** | See competitor's keywords | DataForSEO API |
| **Keyword Intent Filter** | Classify by intent type | Claude AI |
| **Semantic Gap Analysis** | Find keyword opportunities you're missing | Vector DB |

**Keyword Intent Classification:**
| Intent Type | Description | Action |
|-------------|-------------|--------|
| Commercial | Ready to buy | Keep, bid high |
| Informational | Researching | Consider removing or low bid |
| Navigational | Looking for specific site | Add as negative (unless your brand) |
| Transactional | Ready to act | Keep, bid high |

**Semantic Gap Analysis (New):**
```sql
-- Find keywords competitors have that we don't (semantically)
SELECT DISTINCT
  competitor_kw.keyword,
  competitor_kw.search_volume,
  MIN(1 - (competitor_kw.embedding <=> our_kw.embedding)) as closest_match
FROM competitor_keywords competitor_kw
CROSS JOIN keywords our_kw
WHERE our_kw.campaign_id = $1
GROUP BY competitor_kw.keyword, competitor_kw.search_volume, competitor_kw.embedding
HAVING MIN(1 - (competitor_kw.embedding <=> our_kw.embedding)) < 0.7
ORDER BY competitor_kw.search_volume DESC;
```

**API Endpoint:** `POST /api/keywords/expand`
```typescript
// Request
{
  seedKeywords: string[],
  language: "en",
  maxResults: 50,
  includeIntentScores: boolean,
  sources: ["ai", "dataforseo", "vector_similar"]
}

// Response
{
  keywords: [
    {
      keyword: "portugal golden visa requirements",
      volume: 6000,
      cpc: 3.80,
      competition: "medium",
      intent: "commercial",
      intentScore: 85,
      source: "dataforseo"
    }
  ]
}
```

---

### 10.6 Implementation Priority

| Priority | Feature | Complexity | Value |
|----------|---------|------------|-------|
| **P0** | Vector Store Setup (Supabase pgvector) | Medium | Critical — Foundation for all features |
| **P1** | Landing Page Scanner (Crawl4AI + Claude) | Medium | High — Smart keyword extraction |
| **P1** | Negative Keywords AI Suggest | Medium | High — Direct ROI impact |
| **P1** | Pre-built Negative Lists | Low | Medium — Quick win |
| **P1** | Smart Campaign Creation (Basic) | High | High — Core value prop |
| **P2** | Keyword Clustering Tool | Medium | High — Better ad groups |
| **P2** | Keyword Intent Filter | Low | Medium — Better targeting |
| **P2** | Semantic Gap Analysis | Medium | High — Competitive advantage |
| **P3** | Expand Keywords | Medium | Medium — Discovery |
| **P3** | Competitor Spy | Medium | Medium — Uses DataForSEO API |

---

### 10.7 New File Structure (Planned)

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   ├── keywords/
│   │   └── page.tsx                # Keyword tools page (NEW)
│   ├── campaigns/
│   │   ├── page.tsx                # Campaign list (NEW)
│   │   ├── new/
│   │   │   └── page.tsx            # Smart campaign creator (NEW)
│   │   └── [id]/
│   │       └── page.tsx            # Campaign detail (NEW)
│   └── api/
│       ├── ai/
│       │   ├── chat/route.ts       # Existing
│       │   ├── embeddings/route.ts # NEW: Generate embeddings
│       │   └── generate-ads/route.ts # NEW: Ad copy generation
│       ├── keywords/
│       │   ├── cluster/route.ts    # NEW: Vector clustering
│       │   ├── suggest-negatives/route.ts # NEW
│       │   ├── expand/route.ts     # NEW: Keyword expansion
│       │   └── apply-negatives/route.ts   # NEW
│       ├── campaigns/
│       │   ├── route.ts            # Existing: CRUD
│       │   ├── analyze/route.ts    # NEW: Business analysis
│       │   ├── generate-structure/route.ts # NEW
│       │   └── create/route.ts     # NEW: Full campaign creation
│       ├── landing-page/
│       │   └── scan/route.ts       # NEW: Landing page scanner
│       └── google-ads/
│           ├── campaigns/route.ts  # Existing
│           └── search-terms/route.ts # NEW
├── lib/
│   ├── ai-score.ts                 # Existing
│   ├── embeddings.ts               # NEW: OpenAI embedding utils
│   ├── vector-search.ts            # NEW: Supabase pgvector queries
│   ├── dataforseo.ts               # NEW: DataForSEO API client
│   ├── moz.ts                      # NEW: Moz API client
│   ├── crawl4ai.ts                 # NEW: Landing page scanner client
│   ├── negative-lists.ts           # NEW: Pre-built negative lists
│   └── supabase.ts                 # NEW: Supabase client
├── components/
│   ├── keywords/
│   │   ├── KeywordClusterTool.tsx      # NEW
│   │   ├── NegativeKeywordsManager.tsx # NEW
│   │   ├── KeywordIntentBadge.tsx      # NEW
│   │   └── KeywordTable.tsx            # NEW
│   └── campaigns/
│       ├── CampaignWizard.tsx          # NEW: Multi-step creator
│       ├── AdGroupEditor.tsx           # NEW
│       ├── AdCopyGenerator.tsx         # NEW
│       └── BudgetCalculator.tsx        # NEW
└── types/
    ├── campaign.ts                 # Existing + extensions
    ├── keyword.ts                  # NEW: Keyword types
    └── vector.ts                   # NEW: Embedding types
```

---

### 10.8 Google Ads API Requirements

To support these features, additional API calls needed:

| API | Purpose | Endpoint |
|-----|---------|----------|
| Search Terms Report | Get actual search queries | `search_term_view` |
| Keyword Ideas | Suggest new keywords | `keyword_plan_idea_service` |
| Negative Keywords | Add negatives to campaign | `campaign_criterion` |

**Search Terms Query (GAQL):**
```sql
SELECT
  search_term_view.search_term,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.cost_micros
FROM search_term_view
WHERE campaign.id = {campaignId}
  AND segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
LIMIT 500
```

---

### 10.9 Third-Party Data Sources (Available)

**DataForSEO API** — Keyword & Competitor Research
| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `/keywords_data/google_ads/keywords_for_site` | Get keywords for a domain | Competitor spy |
| `/keywords_data/google_ads/search_volume` | Search volume data | Keyword research |
| `/keywords_data/google_ads/keywords_for_keywords` | Related keywords | Keyword expansion |
| `/serp/google/organic` | SERP analysis | Competitor positions |
| `/dataforseo_labs/google/keyword_ideas` | Keyword suggestions | Discovery |

**Moz API** — Domain Authority & Link Data
| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `/url-metrics` | Domain/Page Authority | Competitor strength |
| `/link-intersect` | Common backlinks | Competitive analysis |
| `/top-pages` | Top pages by links | Content analysis |

**Environment Variables (New):**
```
# Embeddings
OPENAI_API_KEY=             # OpenAI API key (for embeddings)

# Supabase (Vector Store)
SUPABASE_URL=               # Supabase project URL
SUPABASE_ANON_KEY=          # Supabase anon key
SUPABASE_SERVICE_KEY=       # Supabase service role key (for admin ops)
DATABASE_URL=               # PostgreSQL connection string

# DataForSEO
DATAFORSEO_LOGIN=           # DataForSEO username
DATAFORSEO_PASSWORD=        # DataForSEO password

# Moz
MOZ_API_TOKEN=              # Moz API token (base64 encoded)

# Crawl4AI (Landing Page Scanner)
CRAWL4AI_URL=               # Crawl4AI server URL (http://38.97.60.181:11235)
CRAWL4AI_TOKEN=             # Bearer token for authentication
```

**Cost Considerations:**
- DataForSEO: Pay-per-request model (~$0.002 per keyword)
- Moz: Monthly plan with API limits
- Claude AI: Per-token pricing (minimal for keyword tasks)

---

## 11. Future Considerations (Not Committed)

Beyond keyword features, if the product evolves further:
- Account switcher for multiple Google Ads accounts
- Date range selector
- Campaign creation wizard
- Persistent user preferences
- Email notifications

---

*This document reflects the actual implementation as of December 2024, plus planned keyword research features.*
