# Campaign System Architecture Plan

> **Status:** In Progress
> **Last Updated:** 2025-01-04
> **Goal:** Build a modular campaign creation system supporting all Google Ads campaign types

---

## Overview

Separate campaign creation into specialized modals while sharing reusable components and a unified data structure for reporting.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAMPAIGN HUB                                  │
│  Central entry point for creating any campaign type                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   SEARCH     │  │   VISUAL     │  │   VIDEO      │              │
│  │   Wizard     │  │   Modal      │  │   Modal      │              │
│  │   (Done)     │  │   (New)      │  │   (New)      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│         │                 │                 │                       │
│         └────────────────┼─────────────────┘                       │
│                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              SHARED COMPONENTS                                │   │
│  │  AssetUploader │ AudienceBuilder │ BudgetSettings │ Preview  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              UNIFIED DATA LAYER                               │   │
│  │  campaigns table │ assets table │ audiences table            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              REPORTING & ANALYTICS                            │   │
│  │  Unified dashboard with cross-campaign insights              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Campaign Types & Modals

### 1. Search Wizard (DONE)
- **Status:** ✅ Complete
- **Location:** `src/components/campaigns/CampaignWizard.tsx`
- **Features:** Keywords, text ads, ad groups, negative keywords

### 2. Visual Campaign Modal (NEW)
- **Types:** Display, Performance Max, Demand Gen
- **Core Need:** Image/video assets + audience targeting
- **Shared because:** All three need the same asset infrastructure

### 3. Video Campaign Modal (NEW)
- **Types:** YouTube Ads (In-stream, Discovery, Bumper)
- **Core Need:** Video assets + YouTube-specific targeting
- **Separate because:** Different ad formats and targeting options

---

## Unified Data Structure

### Core Tables

```sql
-- ============================================
-- CAMPAIGNS (Unified across all types)
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  google_campaign_id TEXT,                    -- After sync to Google Ads

  -- Basic Info
  name TEXT NOT NULL,
  type TEXT NOT NULL,                         -- 'SEARCH', 'DISPLAY', 'PMAX', 'DEMAND_GEN', 'VIDEO'
  status TEXT DEFAULT 'DRAFT',                -- 'DRAFT', 'PENDING', 'ACTIVE', 'PAUSED', 'REMOVED'

  -- Targeting
  target_locations JSONB DEFAULT '[]',        -- Array of geo codes
  target_languages JSONB DEFAULT '["en"]',

  -- Budget & Bidding
  daily_budget DECIMAL(10,2),
  bidding_strategy TEXT,                      -- 'MANUAL_CPC', 'MAXIMIZE_CONVERSIONS', 'TARGET_CPA', etc.
  target_cpa DECIMAL(10,2),
  target_roas DECIMAL(5,2),

  -- Scheduling
  start_date DATE,
  end_date DATE,
  ad_schedule JSONB,                          -- Day/hour targeting

  -- Network Settings (Search-specific)
  include_search_partners BOOLEAN DEFAULT FALSE,
  include_display_network BOOLEAN DEFAULT FALSE,

  -- URLs
  final_url TEXT,
  tracking_template TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,                      -- Last sync with Google Ads

  -- Intelligence Link
  intelligence_project_id UUID REFERENCES intelligence_projects(id)
);

-- ============================================
-- AD GROUPS (Search, Display, Video)
-- ============================================
CREATE TABLE ad_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  google_ad_group_id TEXT,

  name TEXT NOT NULL,
  status TEXT DEFAULT 'ENABLED',

  -- Bidding (can override campaign)
  cpc_bid DECIMAL(10,2),

  -- Targeting (Display/Video)
  targeting_type TEXT,                        -- 'KEYWORDS', 'AUDIENCES', 'PLACEMENTS', 'TOPICS'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ASSET GROUPS (PMax, Demand Gen)
-- ============================================
CREATE TABLE asset_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  google_asset_group_id TEXT,

  name TEXT NOT NULL,
  status TEXT DEFAULT 'ENABLED',
  final_url TEXT NOT NULL,

  -- Path fields for display URL
  path1 TEXT,
  path2 TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ASSETS (Images, Videos, Logos, Text)
-- ============================================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  google_asset_id TEXT,

  -- Asset Type
  type TEXT NOT NULL,                         -- 'IMAGE', 'VIDEO', 'LOGO', 'HEADLINE', 'DESCRIPTION', 'LONG_HEADLINE', 'BUSINESS_NAME', 'CALL_TO_ACTION'

  -- Content
  content TEXT,                               -- For text assets
  file_url TEXT,                              -- For media assets (stored in cloud storage)
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,

  -- Dimensions (for images/videos)
  width INTEGER,
  height INTEGER,
  aspect_ratio TEXT,                          -- '1:1', '1.91:1', '4:5', '16:9'
  duration_seconds INTEGER,                   -- For videos

  -- YouTube (for video assets)
  youtube_video_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Deduplication
  content_hash TEXT,                          -- MD5 hash for media, text hash for text
  UNIQUE(user_id, content_hash)
);

-- ============================================
-- ASSET LINKS (Connect assets to ad groups/asset groups)
-- ============================================
CREATE TABLE asset_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,

  -- Polymorphic link (either ad_group or asset_group)
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE CASCADE,
  asset_group_id UUID REFERENCES asset_groups(id) ON DELETE CASCADE,

  -- Role/Position
  field_type TEXT NOT NULL,                   -- 'HEADLINE', 'DESCRIPTION', 'MARKETING_IMAGE', 'SQUARE_MARKETING_IMAGE', 'LOGO', 'LANDSCAPE_LOGO', 'YOUTUBE_VIDEO', etc.
  position INTEGER DEFAULT 0,

  -- Performance (synced from Google)
  performance_label TEXT,                     -- 'BEST', 'GOOD', 'LOW', 'PENDING'

  CONSTRAINT asset_link_target CHECK (
    (ad_group_id IS NOT NULL AND asset_group_id IS NULL) OR
    (ad_group_id IS NULL AND asset_group_id IS NOT NULL)
  )
);

-- ============================================
-- KEYWORDS (Search campaigns)
-- ============================================
CREATE TABLE campaign_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE CASCADE,
  google_keyword_id TEXT,

  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL,                   -- 'BROAD', 'PHRASE', 'EXACT'
  status TEXT DEFAULT 'ENABLED',

  -- Bidding
  cpc_bid DECIMAL(10,2),

  -- Performance (synced)
  quality_score INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NEGATIVE KEYWORDS
-- ============================================
CREATE TABLE negative_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE CASCADE,

  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL,

  -- Level
  level TEXT NOT NULL,                        -- 'CAMPAIGN', 'AD_GROUP'

  CONSTRAINT negative_keyword_level CHECK (
    (level = 'CAMPAIGN' AND campaign_id IS NOT NULL AND ad_group_id IS NULL) OR
    (level = 'AD_GROUP' AND ad_group_id IS NOT NULL)
  )
);

-- ============================================
-- AUDIENCES (Targeting)
-- ============================================
CREATE TABLE audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  name TEXT NOT NULL,
  type TEXT NOT NULL,                         -- 'CUSTOM', 'IN_MARKET', 'AFFINITY', 'REMARKETING', 'SIMILAR', 'COMBINED'

  -- For custom audiences
  definition JSONB,                           -- Keywords, URLs, apps that define the audience

  -- Google reference
  google_audience_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIENCE TARGETING (Link audiences to campaigns/ad groups)
-- ============================================
CREATE TABLE audience_targeting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE CASCADE,
  asset_group_id UUID REFERENCES asset_groups(id) ON DELETE CASCADE,
  audience_id UUID REFERENCES audiences(id) ON DELETE CASCADE,

  targeting_mode TEXT NOT NULL,               -- 'TARGETING', 'OBSERVATION'
  bid_modifier DECIMAL(5,2) DEFAULT 1.0
);

-- ============================================
-- CAMPAIGN PERFORMANCE (Synced from Google Ads)
-- ============================================
CREATE TABLE campaign_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,

  date DATE NOT NULL,

  -- Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  conversion_value DECIMAL(10,2) DEFAULT 0,

  -- Calculated
  ctr DECIMAL(5,4),
  cpc DECIMAL(10,2),
  cpa DECIMAL(10,2),
  roas DECIMAL(10,2),

  -- Video metrics
  video_views INTEGER,
  video_quartile_25 INTEGER,
  video_quartile_50 INTEGER,
  video_quartile_75 INTEGER,
  video_quartile_100 INTEGER,

  synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, date)
);

-- Indexes for performance
CREATE INDEX idx_campaigns_user ON campaigns(user_id);
CREATE INDEX idx_campaigns_type ON campaigns(type);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_performance_date ON campaign_performance(campaign_id, date);
```

---

## TypeScript Types

```typescript
// types/campaigns.ts

export type CampaignType = 'SEARCH' | 'DISPLAY' | 'PMAX' | 'DEMAND_GEN' | 'VIDEO';
export type CampaignStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REMOVED';
export type BiddingStrategy = 'MANUAL_CPC' | 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CLICKS' | 'TARGET_CPA' | 'TARGET_ROAS';
export type MatchType = 'BROAD' | 'PHRASE' | 'EXACT';
export type AssetType = 'IMAGE' | 'VIDEO' | 'LOGO' | 'HEADLINE' | 'DESCRIPTION' | 'LONG_HEADLINE' | 'BUSINESS_NAME' | 'CALL_TO_ACTION';
export type AspectRatio = '1:1' | '1.91:1' | '4:5' | '16:9' | '9:16';

export interface Campaign {
  id: string;
  userId: string;
  googleCampaignId?: string;

  name: string;
  type: CampaignType;
  status: CampaignStatus;

  // Targeting
  targetLocations: string[];
  targetLanguages: string[];

  // Budget
  dailyBudget: number;
  biddingStrategy: BiddingStrategy;
  targetCpa?: number;
  targetRoas?: number;

  // Dates
  startDate?: string;
  endDate?: string;

  // Network (Search)
  includeSearchPartners: boolean;
  includeDisplayNetwork: boolean;

  // URLs
  finalUrl: string;
  trackingTemplate?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;

  // Relations
  adGroups?: AdGroup[];
  assetGroups?: AssetGroup[];
  intelligenceProjectId?: string;
}

export interface AdGroup {
  id: string;
  campaignId: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  cpcBid?: number;
  keywords?: Keyword[];
  assets?: AssetLink[];
}

export interface AssetGroup {
  id: string;
  campaignId: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  finalUrl: string;
  path1?: string;
  path2?: string;
  assets?: AssetLink[];
  audienceSignals?: AudienceSignal[];
}

export interface Asset {
  id: string;
  userId: string;
  type: AssetType;

  // Content
  content?: string;         // Text assets
  fileUrl?: string;         // Media assets
  fileName?: string;
  fileSize?: number;
  mimeType?: string;

  // Dimensions
  width?: number;
  height?: number;
  aspectRatio?: AspectRatio;
  durationSeconds?: number;

  // YouTube
  youtubeVideoId?: string;

  createdAt: string;
}

export interface AssetLink {
  id: string;
  assetId: string;
  asset?: Asset;
  adGroupId?: string;
  assetGroupId?: string;
  fieldType: string;
  position: number;
  performanceLabel?: 'BEST' | 'GOOD' | 'LOW' | 'PENDING';
}

export interface Keyword {
  id: string;
  adGroupId: string;
  keyword: string;
  matchType: MatchType;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  cpcBid?: number;
  qualityScore?: number;
}

export interface CampaignPerformance {
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  cpa?: number;
  roas?: number;

  // Video
  videoViews?: number;
}
```

---

## Shared Components

### 1. AssetUploader
```
Location: src/components/shared/AssetUploader.tsx

Features:
- Drag & drop upload
- Image cropping for required sizes
- Size/format validation
- Preview with aspect ratio
- YouTube video URL parser
- Asset library (reuse previous uploads)
```

### 2. AudienceBuilder
```
Location: src/components/shared/AudienceBuilder.tsx

Features:
- Demographics selector (age, gender, income)
- In-market audiences browser
- Affinity audiences browser
- Custom audience creator (keywords, URLs, apps)
- Audience combination (AND/OR logic)
```

### 3. BudgetSettings
```
Location: src/components/shared/BudgetSettings.tsx

Features:
- Daily budget input with recommendations
- Bidding strategy selector
- Target CPA/ROAS inputs
- Budget pacing visualization
```

### 4. CampaignPreview
```
Location: src/components/shared/CampaignPreview.tsx

Features:
- Multi-format preview (Search, Display, YouTube, etc.)
- Device preview (mobile, desktop, tablet)
- Real-time updates as user edits
```

### 5. LocationTargeting
```
Location: src/components/shared/LocationTargeting.tsx

Features:
- Country/region/city selector
- Radius targeting
- Location exclusions
- Map visualization
```

---

## Implementation Phases

### Phase 1: Data Layer (COMPLETE)
- [x] Design unified schema
- [x] Create database migration (`prisma/migrations/020_unified_campaign_system.sql`)
- [x] Create TypeScript types (`src/types/campaign.ts`)
- [x] Create API routes for campaigns CRUD (`src/app/api/campaigns/`)
- [x] Create database operations (`src/lib/database/campaigns.ts`)

### Phase 2: Asset Infrastructure (PARTIAL)
- [x] AssetUploader component (`src/components/shared/AssetUploader.tsx`)
- [ ] Cloud storage integration (S3/GCS)
- [x] Asset library UI (integrated in AssetUploader)
- [ ] Image cropping/resizing

### Phase 3: Visual Campaign Modal (PARTIAL)
- [x] Visual Campaign Modal base (`src/components/campaigns/VisualCampaignModal.tsx`)
- [x] Campaign type selection (Display/PMax/Demand Gen)
- [x] Asset group management
- [x] Basic targeting settings
- [ ] Ad preview component

### Phase 4: PMax Extension
- [ ] Asset group management
- [ ] PMax-specific settings
- [ ] Multi-format preview

### Phase 5: Demand Gen Extension
- [ ] Demand Gen specific features
- [ ] Carousel ad support

### Phase 6: Video Campaign Modal
- [ ] YouTube video selector
- [ ] Video ad formats (in-stream, discovery, bumper)
- [ ] Video-specific targeting

### Phase 7: Dashboard & Reporting
- [ ] Unified campaign dashboard
- [ ] Cross-campaign performance comparison
- [ ] Performance trends
- [ ] AI recommendations

---

## File Structure (Planned)

```
src/
├── components/
│   ├── campaigns/
│   │   ├── CampaignWizard.tsx           # Search (existing)
│   │   ├── VisualCampaignModal.tsx      # Display/PMax/DemandGen
│   │   ├── VideoCampaignModal.tsx       # YouTube
│   │   ├── CampaignHub.tsx              # Entry point
│   │   └── wizard/                      # Search wizard steps
│   │
│   └── shared/
│       ├── AssetUploader.tsx
│       ├── AssetLibrary.tsx
│       ├── AudienceBuilder.tsx
│       ├── BudgetSettings.tsx
│       ├── LocationTargeting.tsx
│       └── CampaignPreview/
│           ├── SearchPreview.tsx
│           ├── DisplayPreview.tsx
│           ├── VideoPreview.tsx
│           └── index.tsx
│
├── app/
│   └── api/
│       └── campaigns/
│           ├── route.ts                 # List/Create campaigns
│           ├── [id]/
│           │   ├── route.ts             # Get/Update/Delete
│           │   ├── ad-groups/route.ts
│           │   ├── asset-groups/route.ts
│           │   └── performance/route.ts
│           └── assets/
│               ├── route.ts             # Asset library
│               └── upload/route.ts      # Upload handler
│
├── lib/
│   └── database/
│       ├── campaigns.ts                 # Campaign CRUD
│       ├── assets.ts                    # Asset management
│       └── audiences.ts                 # Audience management
│
└── types/
    └── campaigns.ts                     # All campaign types
```

---

## Notes

- Search campaigns remain in existing wizard (don't break what works)
- Visual campaigns (Display/PMax/Demand Gen) share asset infrastructure
- Video campaigns have unique YouTube integration needs
- All campaigns feed into unified reporting
- Intelligence reports can be linked to any campaign for AI-powered ad generation
