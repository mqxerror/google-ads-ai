# Intelligence Section Plan

## Overview

Build a comprehensive **Intelligence Center** that replicates and enhances the n8n "Brand DNA and Audience DNA" workflow. This will be a new major section of the app that provides deep research and analysis capabilities.

---

## What Your n8n Workflow Does (Analysis)

### 1. Brand DNA
**Purpose:** Deep research into a company/brand to understand its identity

**Process:**
1. Receives brand name + domain via webhook
2. Uses Perplexity to search for:
   - Company mission, values, vision
   - Brand positioning & market position
   - Company story, history, milestones
   - Leadership & culture
   - Recent news & developments
3. Scrapes main website + about page
4. AI analyzes all data to create comprehensive "Brand DNA Report"

**Output:** Brand identity document with positioning, values, differentiators

---

### 2. Audience DNA
**Purpose:** Create detailed audience personas based on brand analysis

**Process:**
1. Takes Brand DNA Report as input
2. AI identifies 3 distinct customer "life situations" (personas)
3. For each persona, uses Perplexity to research:
   - Behavior patterns
   - Purchase motivations
   - Decision-making processes
   - Psychological characteristics
   - Community interactions
4. AI synthesizes deep audience profiles

**Output:** 3 detailed audience personas with psychological insights

---

### 3. Competitor DNA
**Purpose:** Identify and analyze top competitors

**Process:**
1. Analyzes brand's website for products/services/positioning
2. Generates search queries based on:
   - Industry + competitors
   - Business model (SaaS, service, marketplace)
   - Market landscape
3. Uses Perplexity + DataForSEO to find competitors
4. AI selects top 3 most relevant competitors
5. For each competitor, researches:
   - Content strategy
   - Pillar pages
   - Brand positioning
   - SEO performance
   - Market position
6. Generates competitor intelligence reports

**Output:** Competitive analysis with strategic insights

---

## Architecture for Quick Ads AI

### New Section: `/intelligence`

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE CENTER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Brand DNA     │  │  Audience DNA   │  │ Competitor DNA  │ │
│  │                 │  │                 │  │                 │ │
│  │ 🏢 Research a   │  │ 👥 Create 3     │  │ ⚔️ Find & analyze│ │
│  │ brand's identity│  │ audience        │  │ top competitors │ │
│  │ & positioning   │  │ personas        │  │                 │ │
│  │                 │  │                 │  │                 │ │
│  │ [Start Analysis]│  │ [Create Personas│  │ [Find Compet.]  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     MY REPORTS                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Brand: Acme Corp | Created: Jan 3, 2026 | [View] [Edit]  │  │
│  │ - Brand DNA ✅ | Audience DNA ✅ | Competitor DNA 🔄      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

```sql
-- Intelligence projects (one per brand analysis)
CREATE TABLE intelligence_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  business_model TEXT,
  status TEXT DEFAULT 'draft', -- draft, in_progress, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brand DNA reports
CREATE TABLE brand_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES intelligence_projects(id) ON DELETE CASCADE,

  -- Raw research data
  perplexity_search_results JSONB,
  website_content TEXT,
  about_page_content TEXT,

  -- Analyzed data
  mission_vision TEXT,
  brand_values JSONB, -- array of values
  brand_positioning TEXT,
  unique_differentiators JSONB,
  target_market TEXT,
  brand_voice TEXT,
  company_story TEXT,

  -- Full report
  full_report TEXT, -- markdown

  status TEXT DEFAULT 'pending', -- pending, researching, analyzing, completed, failed
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audience DNA (personas)
CREATE TABLE audience_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES intelligence_projects(id) ON DELETE CASCADE,

  -- Persona details
  persona_name TEXT NOT NULL,
  persona_description TEXT,
  life_situation TEXT,

  -- Research data
  behavior_patterns JSONB,
  purchase_motivations JSONB,
  decision_factors JSONB,
  psychological_profile TEXT,
  pain_points JSONB,
  goals_aspirations JSONB,

  -- Audience journey
  awareness_stage TEXT, -- unaware, problem_aware, solution_aware, product_aware, most_aware
  typical_objections JSONB,
  trust_signals JSONB,

  -- Full profile
  full_profile TEXT, -- markdown

  position INT DEFAULT 0, -- order (1, 2, 3)
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitor DNA
CREATE TABLE competitor_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES intelligence_projects(id) ON DELETE CASCADE,

  -- Competitor identity
  competitor_name TEXT NOT NULL,
  competitor_domain TEXT,
  threat_level TEXT, -- direct, indirect, emerging

  -- Research data
  content_strategy JSONB,
  pillar_pages JSONB,
  seo_performance JSONB,
  brand_positioning TEXT,
  market_position TEXT,

  -- SEO metrics (from DataForSEO)
  keyword_intersections INT,
  avg_position DECIMAL(5,2),
  estimated_traffic INT,
  top_keywords JSONB,

  -- AI analysis
  strengths JSONB,
  weaknesses JSONB,
  opportunities JSONB, -- gaps we can exploit

  -- Full report
  full_report TEXT,

  position INT DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

### Projects
```
GET    /api/intelligence                    # List all projects
POST   /api/intelligence                    # Create new project
GET    /api/intelligence/[id]               # Get project with all DNA
DELETE /api/intelligence/[id]               # Delete project
```

### Brand DNA
```
POST   /api/intelligence/[id]/brand-dna     # Start brand DNA analysis
GET    /api/intelligence/[id]/brand-dna     # Get brand DNA report
PUT    /api/intelligence/[id]/brand-dna     # Update/edit report
```

### Audience DNA
```
POST   /api/intelligence/[id]/audience-dna  # Generate audience personas
GET    /api/intelligence/[id]/audience-dna  # Get all personas
PUT    /api/intelligence/[id]/audience-dna/[personaId]  # Edit persona
```

### Competitor DNA
```
POST   /api/intelligence/[id]/competitor-dna         # Find competitors
GET    /api/intelligence/[id]/competitor-dna         # Get all competitors
POST   /api/intelligence/[id]/competitor-dna/[compId]/analyze  # Deep analyze one
```

---

## AI/Research Services

### 1. Perplexity Integration (Real-time Research)
- **Purpose:** Web search with AI synthesis
- **Cost:** ~$0.005 per search
- **Use for:**
  - Brand research (mission, values, news)
  - Audience behavior research
  - Competitor content analysis

### 2. OpenAI/Claude (Analysis)
- **Purpose:** Synthesize research into reports
- **Use for:**
  - Creating Brand DNA report from raw data
  - Generating audience personas
  - Competitive analysis

### 3. DataForSEO (SEO Intelligence)
- **Purpose:** Competitor keyword overlap, traffic estimates
- **Use for:**
  - Finding SEO competitors
  - Keyword intersection analysis
  - Traffic estimates

### 4. Website Scraping
- **Purpose:** Get brand's own content
- **Use for:**
  - Homepage content
  - About page
  - Product/service pages

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Database migrations for intelligence tables
- [ ] Basic CRUD API for projects
- [ ] Intelligence Center UI (list projects, create new)

### Phase 2: Brand DNA
- [ ] Perplexity integration for research
- [ ] Website scraping (Puppeteer or similar)
- [ ] AI analysis pipeline (OpenAI/Claude)
- [ ] Brand DNA report generation
- [ ] UI for viewing/editing Brand DNA

### Phase 3: Audience DNA
- [ ] Persona generation from Brand DNA
- [ ] Perplexity research for each persona
- [ ] Psychological profiling
- [ ] UI for viewing/editing personas

### Phase 4: Competitor DNA
- [ ] Competitor discovery (Perplexity + DataForSEO)
- [ ] Deep competitor analysis
- [ ] SEO gap analysis
- [ ] UI for competitive intelligence

### Phase 5: Integration
- [ ] Use intelligence in Campaign Wizard
- [ ] Pre-fill ad copy with Brand DNA voice
- [ ] Target audiences based on Audience DNA
- [ ] Negative keywords from competitor analysis

---

## UI Mockups

### Intelligence Center Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│ 🧠 Intelligence Center                        [+ New Analysis]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ YOUR ANALYSES                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🏢 Acme Corporation                          Jan 3, 2026    │ │
│ │ acme.com • SaaS • B2B                                        │ │
│ │                                                              │ │
│ │ Brand DNA     Audience DNA    Competitor DNA                 │ │
│ │ ✅ Complete   ✅ 3 Personas   🔄 2/3 Analyzed               │ │
│ │                                                              │ │
│ │ [View Report]  [Continue Analysis]  [Use in Campaign]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🏢 Golden Visa Portugal                      Dec 28, 2025   │ │
│ │ goldenvisapt.com • Real Estate • B2C                        │ │
│ │                                                              │ │
│ │ Brand DNA     Audience DNA    Competitor DNA                 │ │
│ │ ✅ Complete   ✅ 3 Personas   ✅ Complete                   │ │
│ │                                                              │ │
│ │ [View Report]  [Update Analysis]  [Use in Campaign]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Brand DNA View
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back    Acme Corporation - Brand DNA            [Edit] [Export]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ MISSION & VISION                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ To democratize AI-powered analytics for small businesses... │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ BRAND VALUES                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │Simplicity│ │Innovation│ │ Customer │ │Transparen│            │
│ │          │ │          │ │  First   │ │    cy    │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                  │
│ POSITIONING                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ "The most affordable enterprise-grade analytics platform    │ │
│ │  for growing SMBs"                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ KEY DIFFERENTIATORS                                              │
│ • No-code setup in under 5 minutes                              │
│ • AI-powered insights without data science team                 │
│ • Pay-as-you-grow pricing                                       │
│                                                                  │
│ [Generate Audience DNA →]                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cost Estimates

| Operation | API | Cost Per |
|-----------|-----|----------|
| Brand research | Perplexity | ~$0.02 (4 searches) |
| Website scrape | Self-hosted | Free |
| Brand DNA synthesis | Claude | ~$0.05 |
| Audience research | Perplexity | ~$0.03 (6 searches) |
| Persona synthesis | Claude | ~$0.08 (3 personas) |
| Competitor discovery | Perplexity + DataForSEO | ~$0.10 |
| Competitor analysis | Claude | ~$0.15 (3 competitors) |
| **Total per project** | | **~$0.43** |

---

## Integration with Existing Features

### Campaign Wizard Enhancement
When creating a campaign, user can:
1. Select an Intelligence Project
2. Auto-fill:
   - Brand voice for ad copy
   - Target audiences from personas
   - Competitor keywords for negatives
   - Positioning for headlines

### Keyword Factory Enhancement
- "Research Intent" button uses Audience DNA
- Suggest keywords based on persona pain points
- Filter by awareness stage

---

## Questions to Discuss

1. **Perplexity API** - Do you have API access, or should we use alternative (Tavily, SerpAPI)?

2. **Real-time vs Batch** - Should analysis run:
   - In real-time (user waits 2-3 min)?
   - Background job (user gets notified when done)?
   - Hybrid (quick summary → deep analysis in background)?

3. **AI Model** - Which to use for synthesis?
   - Claude (better reasoning)
   - GPT-4 (faster)
   - Mix (Claude for reports, GPT-4 for quick tasks)

4. **Priority** - Which DNA to build first?
   - Brand DNA (foundation for others)
   - Audience DNA (most useful for ads)
   - Competitor DNA (quick wins)

5. **Website Scraping** - Method preference?
   - Puppeteer (full JS rendering)
   - Firecrawl API (managed service)
   - Simple fetch (basic HTML)

---

## Next Steps

1. Confirm architecture approach
2. Set up Perplexity API integration
3. Create database migrations
4. Build Brand DNA first (foundation)
5. Iterate based on results
