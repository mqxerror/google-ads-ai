# Feature Plan: Ad Group & Ads Deep Analysis

## Overview
Add drill-down capability to analyze campaigns at the ad group and individual ad level, with comparison and cloning features.

## User Flow

```
Dashboard → Campaign Row → Campaign Detail Drawer
                                    ↓
                            "View Ad Groups" button
                                    ↓
                           Ad Groups Panel (slide-in)
                                    ↓
                            Click Ad Group row
                                    ↓
                           Ads Panel (nested slide-in)
                                    ↓
                          Select ads → Compare / Clone
```

## Components to Build

### 1. CampaignAdGroupsPanel (`src/components/dashboard/CampaignAdGroupsPanel.tsx`)
A slide-in panel showing all ad groups for a campaign.

**Features:**
- List all ad groups with metrics (clicks, impressions, CTR, spend, conversions)
- Sort by any metric
- Filter by status (enabled/paused)
- Bulk pause/enable ad groups
- Click to drill into ads

**Data needed:**
```typescript
interface AdGroupWithMetrics {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED';
  cpcBid?: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpa: number;
  // AI analysis
  aiScore?: number;
  recommendation?: string;
}
```

### 2. AdGroupAdsPanel (`src/components/dashboard/AdGroupAdsPanel.tsx`)
A slide-in panel showing all ads in an ad group.

**Features:**
- List all ads with metrics
- Preview ad (RSA shows rotating headlines)
- Status toggle (enable/pause individual ads)
- Select multiple ads for comparison
- Clone/duplicate button

**Data needed:**
```typescript
interface AdWithMetrics {
  id: string;
  type: string;
  status: 'ENABLED' | 'PAUSED';
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpa: number;
  // Performance labels from Google
  adStrength?: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
}
```

### 3. AdComparisonModal (`src/components/dashboard/AdComparisonModal.tsx`)
Side-by-side comparison of 2-4 ads.

**Features:**
- Visual side-by-side layout
- Metric comparison table
- Highlight winner/loser
- AI recommendation on which to scale
- "Clone winner" button

### 4. AdCloneModal (`src/components/dashboard/AdCloneModal.tsx`)
Clone an ad with optional modifications.

**Features:**
- Copy to same ad group or different
- Edit headlines/descriptions before clone
- AI suggestion to improve clone
- Create as draft or publish immediately

## API Endpoints

### GET `/api/google-ads/ad-groups`
```typescript
// Query params
{
  customerId: string;
  campaignId: string;
  startDate?: string; // For metrics
  endDate?: string;
}

// Response
{
  adGroups: AdGroupWithMetrics[];
  summary: {
    totalAdGroups: number;
    enabledCount: number;
    totalSpend: number;
  }
}
```

### GET `/api/google-ads/ads`
```typescript
// Query params
{
  customerId: string;
  adGroupId: string;
  startDate?: string;
  endDate?: string;
}

// Response
{
  ads: AdWithMetrics[];
  summary: {
    totalAds: number;
    enabledCount: number;
    avgCtr: number;
  }
}
```

### POST `/api/google-ads/ads/clone`
```typescript
// Request
{
  customerId: string;
  sourceAdId: string;
  targetAdGroupId: string;
  modifications?: {
    headlines?: string[];
    descriptions?: string[];
    finalUrls?: string[];
  };
  publishImmediately?: boolean;
}

// Response
{
  success: boolean;
  newAdId?: string;
  draftId?: string;
}
```

## Google Ads API Queries

### Fetch Ad Groups with Metrics
```sql
SELECT
  ad_group.id,
  ad_group.name,
  ad_group.status,
  ad_group.cpc_bid_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.cost_micros,
  metrics.ctr
FROM ad_group
WHERE ad_group.campaign = 'customers/{customerId}/campaigns/{campaignId}'
  AND ad_group.status != 'REMOVED'
  AND segments.date BETWEEN '{startDate}' AND '{endDate}'
```

### Fetch Ads with Metrics
```sql
SELECT
  ad_group_ad.ad.id,
  ad_group_ad.ad.type,
  ad_group_ad.status,
  ad_group_ad.ad.responsive_search_ad.headlines,
  ad_group_ad.ad.responsive_search_ad.descriptions,
  ad_group_ad.ad.final_urls,
  ad_group_ad.ad_strength,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.cost_micros,
  metrics.ctr
FROM ad_group_ad
WHERE ad_group_ad.ad_group = 'customers/{customerId}/adGroups/{adGroupId}'
  AND ad_group_ad.status != 'REMOVED'
  AND segments.date BETWEEN '{startDate}' AND '{endDate}'
```

### Clone Ad (Create Operation)
```typescript
const operation = {
  create: {
    ad_group: `customers/${customerId}/adGroups/${targetAdGroupId}`,
    status: 'ENABLED', // or 'PAUSED' for draft mode
    ad: {
      responsive_search_ad: {
        headlines: headlines.map(h => ({ text: h })),
        descriptions: descriptions.map(d => ({ text: d })),
      },
      final_urls: finalUrls,
    },
  },
};
```

## Store Updates (`campaigns-store.ts`)

Add to the store:
```typescript
interface CampaignsState {
  // ... existing

  // Ad Groups & Ads state
  selectedCampaignId: string | null;
  selectedAdGroupId: string | null;
  adGroups: AdGroupWithMetrics[];
  ads: AdWithMetrics[];
  adGroupsLoading: boolean;
  adsLoading: boolean;

  // Actions
  fetchAdGroups: (campaignId: string) => Promise<void>;
  fetchAds: (adGroupId: string) => Promise<void>;
  toggleAdGroupStatus: (adGroupId: string) => Promise<void>;
  toggleAdStatus: (adId: string) => Promise<void>;
  cloneAd: (sourceAdId: string, targetAdGroupId: string, mods?: Partial<Ad>) => Promise<void>;
}
```

## UI Integration

### In CampaignDrawer
Add a "View Ad Groups" button that opens `CampaignAdGroupsPanel`:

```tsx
<button
  onClick={() => setShowAdGroups(true)}
  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white rounded-xl"
>
  <svg>...</svg>
  View Ad Groups ({campaign.adGroupCount})
</button>
```

### Activity Logging
Add activity types:
```typescript
type: 'ad_pause' | 'ad_enable' | 'ad_clone' | 'adgroup_pause' | 'adgroup_enable'
```

## Phased Implementation

### Phase 1: Ad Groups View
1. Create `GET /api/google-ads/ad-groups` endpoint
2. Build `CampaignAdGroupsPanel` component
3. Add "View Ad Groups" button to drawer
4. Add ad group status toggle

### Phase 2: Ads View
1. Create `GET /api/google-ads/ads` endpoint
2. Build `AdGroupAdsPanel` component
3. Add ad preview component
4. Add ad status toggle

### Phase 3: Comparison
1. Build `AdComparisonModal`
2. Add AI analysis for comparison
3. Highlight performance differences

### Phase 4: Cloning
1. Create `POST /api/google-ads/ads/clone` endpoint
2. Build `AdCloneModal`
3. Add AI suggestions for improvements
4. Test draft vs immediate publish

## Estimated Components

| Component | Lines | Priority |
|-----------|-------|----------|
| CampaignAdGroupsPanel | ~200 | P0 |
| AdGroupAdsPanel | ~250 | P0 |
| API: ad-groups/route.ts | ~100 | P0 |
| API: ads/route.ts | ~120 | P0 |
| AdComparisonModal | ~180 | P1 |
| AdCloneModal | ~150 | P1 |
| API: ads/clone/route.ts | ~80 | P1 |
| Store updates | ~50 | P0 |
