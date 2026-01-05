# Campaign Creation Refactoring - Reusable Components

**Created:** 2026-01-04
**Status:** In Progress

## Overview
Extract reusable components from campaign creation flows to reduce code duplication and ensure consistency across Search, PMax, Display, Demand Gen, and Video campaigns.

---

## Issues to Fix

### 1. DNA Selector Can't Change Selection
**Problem:** Once a DNA report is applied, user can't select a different one
**File:** `src/components/shared/DnaAdCopySelector.tsx`
**Fix:** Add "Change" button that resets `applied` state and allows re-selection

### 2. Code Duplication Across Campaign Types
Multiple campaign modals duplicate:
- UTM builder logic
- Bidding strategy selection
- Location targeting
- Form field patterns
- Validation logic

---

## Reusable Components to Create

### Priority 1: Core Form Components

#### 1.1 `UtmBuilder` Component
**Current Location:** `WizardStep1Campaign.tsx:52-160` (only in Search)
**Use in:** Search, PMax, Display, Demand Gen, Video (ALL campaigns need landing URLs)

```typescript
// src/components/shared/UtmBuilder.tsx
interface UtmBuilderProps {
  baseUrl: string;
  onUrlChange: (fullUrl: string) => void;
  campaignName?: string;
  defaultSource?: string;
}
```

**Features:**
- Template presets (Google Ads, Facebook, Email, etc.)
- Auto-generate from campaign name
- Preview final URL
- Copy to clipboard

#### 1.2 `BiddingStrategySelector` Component
**Duplicated in:** WizardStep4Budget.tsx, VisualCampaignModal.tsx, VideoCampaignModal.tsx
**Use in:** ALL campaign types

```typescript
// src/components/shared/BiddingStrategySelector.tsx
interface BiddingStrategySelectorProps {
  value: BiddingStrategy;
  onChange: (strategy: BiddingStrategy) => void;
  campaignType: CampaignType;
  showTargetInputs?: boolean; // For CPA/ROAS targets
}
```

#### 1.3 `LocationTargeting` Component
**Duplicated in:** WizardStep1Campaign.tsx, VisualCampaignModal.tsx, VideoCampaignModal.tsx
**Use in:** ALL campaign types

```typescript
// src/components/shared/LocationTargeting.tsx
interface LocationTargetingProps {
  selected: string[];
  onChange: (locations: string[]) => void;
  mode?: 'chips' | 'dropdown' | 'search';
}
```

#### 1.4 `BudgetInput` Component
**Duplicated in:** WizardStep4Budget.tsx, VisualCampaignModal.tsx, VideoCampaignModal.tsx
**Use in:** ALL campaign types

```typescript
// src/components/shared/BudgetInput.tsx
interface BudgetInputProps {
  dailyBudget: number;
  onChange: (budget: number) => void;
  currency?: string;
  showMonthlyEstimate?: boolean;
  minBudget?: number;
}
```

### Priority 2: Ad Copy & Preview Components

#### 2.1 `HeadlineInput` Component (with character counter)
**Use in:** Search, PMax, Display, Demand Gen

```typescript
// src/components/shared/HeadlineInput.tsx
interface HeadlineInputProps {
  headlines: string[];
  onChange: (headlines: string[]) => void;
  minCount: number;
  maxCount: number;
  maxLength: number; // 30 for headlines, 90 for long headlines
  label?: string;
}
```

#### 2.2 `DescriptionInput` Component
**Use in:** Search, PMax, Display, Demand Gen, Video

```typescript
// src/components/shared/DescriptionInput.tsx
interface DescriptionInputProps {
  descriptions: string[];
  onChange: (descriptions: string[]) => void;
  minCount: number;
  maxCount: number;
  maxLength: number; // 90 chars
}
```

#### 2.3 `AdPreviewCard` Component (Visual Preview)
**Use in:** Search, PMax, Display, Demand Gen

```typescript
// src/components/shared/AdPreviewCard.tsx
interface AdPreviewCardProps {
  type: 'search' | 'display' | 'pmax' | 'video';
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  businessName?: string;
  images?: string[];
  logo?: string;
}
```

**Renders:**
- Search: Google SERP-style preview
- Display: Multiple format previews (300x250, 728x90, etc.)
- PMax: Responsive preview with assets

### Priority 3: Selection Components

#### 3.1 `SelectableCardGrid` Component
**Duplicated in:** 4+ files for campaign type, goals, ad formats, bidding
**Use in:** ALL campaign wizards

```typescript
// src/components/shared/SelectableCardGrid.tsx
interface SelectableCardGridProps<T> {
  options: Array<{
    value: T;
    icon: string;
    title: string;
    description: string;
    features?: string[];
  }>;
  selected: T;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
}
```

#### 3.2 `CollapsibleSection` Component
**Use in:** Advanced settings across all campaign types

```typescript
// src/components/shared/CollapsibleSection.tsx
interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}
```

### Priority 4: Image & Asset Components

#### 4.1 `AssetCropModal` Component
**Enhance existing:** `ImageCropper.tsx`
**Use in:** PMax, Display, Demand Gen

```typescript
// src/components/shared/AssetCropModal.tsx
interface AssetCropModalProps {
  image: UploadedAsset;
  requiredRatios: AspectRatio[];
  onComplete: (croppedVersions: CroppedAsset[]) => void;
  onCancel: () => void;
}
```

**Features:**
- Show all required ratios with checkmarks
- Batch crop workflow
- Preview each crop before confirming

---

## Shared Constants to Extract

```typescript
// src/constants/campaign.ts
export const BIDDING_STRATEGIES = { ... };
export const LOCATIONS = { ... };
export const CAMPAIGN_TYPES = { ... };

// src/constants/utm.ts
export const UTM_TEMPLATES = { ... };

// src/constants/ad-limits.ts
export const AD_LIMITS = {
  HEADLINE_MAX_LENGTH: 30,
  LONG_HEADLINE_MAX_LENGTH: 90,
  DESCRIPTION_MAX_LENGTH: 90,
  // ...
};
```

---

## Implementation Plan

### Phase 1: Bug Fixes & Quick Wins (Do First)
1. **Fix DNA selector** - Add reset/change functionality
2. **Extract constants** - Move duplicated data to shared files
3. **Create `BudgetInput`** - Simple, high reuse

### Phase 2: Core Form Components
4. **Create `UtmBuilder`** - Extract from WizardStep1, add to all campaigns
5. **Create `BiddingStrategySelector`** - Consolidate 3 implementations
6. **Create `LocationTargeting`** - Consolidate 3 implementations
7. **Create `HeadlineInput` & `DescriptionInput`** - With validation

### Phase 3: Selection & Layout Components
8. **Create `SelectableCardGrid`** - Replace 4+ duplicated patterns
9. **Create `CollapsibleSection`** - For advanced settings
10. **Create `SummaryCard`** - For review steps

### Phase 4: Ad Previews
11. **Create `SearchAdPreview`** - Google SERP mockup
12. **Create `DisplayAdPreview`** - Multiple format mockups
13. **Create `AdPreviewCard`** - Unified wrapper

### Phase 5: Asset Management (Later)
14. **Enhance `AssetCropModal`** - Batch cropping workflow
15. **Create asset requirement checklist** - Show what's missing

### Phase 6: Search Extensions (Future)
16. **Add sitelinks support**
17. **Add callouts & snippets**
18. **Add call extensions**

---

## Files to Modify

### New Files to Create
| File | Purpose |
|------|---------|
| `src/components/shared/UtmBuilder.tsx` | UTM parameter builder |
| `src/components/shared/BiddingStrategySelector.tsx` | Bidding selection |
| `src/components/shared/LocationTargeting.tsx` | Location picker |
| `src/components/shared/BudgetInput.tsx` | Budget with estimates |
| `src/components/shared/HeadlineInput.tsx` | Headlines with counter |
| `src/components/shared/DescriptionInput.tsx` | Descriptions with counter |
| `src/components/shared/SelectableCardGrid.tsx` | Option cards |
| `src/components/shared/CollapsibleSection.tsx` | Expandable sections |
| `src/components/shared/AdPreviewCard.tsx` | Ad preview wrapper |
| `src/components/ads/SearchAdPreview.tsx` | Search SERP preview |
| `src/constants/campaign.ts` | Shared campaign constants |
| `src/constants/utm.ts` | UTM templates |
| `src/constants/ad-limits.ts` | Character limits |

### Files to Update
| File | Changes |
|------|---------|
| `src/components/shared/DnaAdCopySelector.tsx` | Fix can't change selection |
| `src/components/campaigns/VisualCampaignModal.tsx` | Use new components |
| `src/components/campaigns/VideoCampaignModal.tsx` | Use new components |
| `src/components/campaigns/WizardStep1Campaign.tsx` | Extract UTM, use components |
| `src/components/campaigns/WizardStep4Budget.tsx` | Use BiddingStrategySelector |
| `src/components/campaigns/WizardStep5Review.tsx` | Add visual ad preview |

---

## Component Reuse Matrix

| Component | Search | PMax | Display | Demand Gen | Video |
|-----------|--------|------|---------|------------|-------|
| UtmBuilder | ✓ | ✓ | ✓ | ✓ | ✓ |
| BiddingStrategySelector | ✓ | ✓ | ✓ | ✓ | ✓ |
| LocationTargeting | ✓ | ✓ | ✓ | ✓ | ✓ |
| BudgetInput | ✓ | ✓ | ✓ | ✓ | ✓ |
| HeadlineInput | ✓ | ✓ | ✓ | ✓ | - |
| DescriptionInput | ✓ | ✓ | ✓ | ✓ | ✓ |
| DnaAdCopySelector | ✓ | ✓ | ✓ | ✓ | ✓ |
| SelectableCardGrid | ✓ | ✓ | ✓ | ✓ | ✓ |
| AdPreviewCard | ✓ | ✓ | ✓ | ✓ | - |

---

## Progress Tracking

- [ ] Phase 1: Bug Fixes & Quick Wins
- [ ] Phase 2: Core Form Components
- [ ] Phase 3: Selection & Layout Components
- [ ] Phase 4: Ad Previews
- [ ] Phase 5: Asset Management
- [ ] Phase 6: Search Extensions
