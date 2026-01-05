# Ad Preview Center - Implementation Plan

## Overview

A centralized preview system for viewing ads across multiple formats, managing asset coverage, and performing smart cropping operations. Available both as an inline modal during campaign creation and as a standalone page for post-creation review.

---

## Architecture

### Component Hierarchy

```
AdPreviewCenter/
├── FormatPreviewGrid        # Multi-format preview display
│   ├── DisplayFormatPreview   # 300x250, 728x90, 160x600, etc.
│   ├── YouTubePreview         # In-stream, Discovery, Shorts
│   ├── SearchPreview          # Google SERP style
│   └── GmailDiscoverPreview   # Gmail/Discover feed style
├── AssetCoveragePanel       # Shows asset requirements & coverage
│   ├── AspectRatioChecklist   # 1:1, 1.91:1, 4:5 coverage
│   ├── MissingAssetAlert      # Warnings for missing formats
│   └── AssetQualityScore      # Overall asset health
├── SmartCropStudio          # Batch cropping workflow
│   ├── CropPreview            # Live crop preview
│   ├── AspectRatioSelector    # Quick ratio buttons
│   ├── FocalPointEditor       # AI-suggested focal points
│   └── BatchCropQueue         # Process multiple images
└── AdCopyEditor             # Inline headline/description editing
    ├── HeadlineVariants       # Multiple headline options
    ├── DescriptionVariants    # Multiple description options
    └── CharacterCounter       # Real-time limits
```

---

## Implementation Phases

### Phase 1: FormatPreviewGrid Component
**Priority:** High | **Effort:** 3 hours

#### Purpose
Display all ad formats in a unified grid view, allowing users to see how their assets render across different placements.

#### File Location
`src/components/ad-preview/FormatPreviewGrid.tsx`

#### Props Interface
```typescript
interface FormatPreviewGridProps {
  campaignType: 'SEARCH' | 'DISPLAY' | 'PMAX' | 'DEMAND_GEN' | 'VIDEO';
  headlines: string[];
  descriptions: string[];
  images: UploadedAsset[];
  logos: UploadedAsset[];
  videos?: UploadedAsset[];
  businessName?: string;
  finalUrl?: string;
  onFormatSelect?: (format: AdFormat) => void;
  selectedFormat?: AdFormat;
}
```

#### Supported Formats
| Campaign Type | Formats to Show |
|--------------|-----------------|
| DISPLAY | 300x250, 728x90, 160x600, 320x50 |
| PMAX | Search, Display (all), YouTube, Gmail, Discover |
| DEMAND_GEN | YouTube Shorts, Discover Feed, Gmail |
| VIDEO | In-stream, Discovery, Shorts |
| SEARCH | Desktop SERP, Mobile SERP |

#### UI Layout
```
┌─────────────────────────────────────────────────────────┐
│  Format Preview Grid                    [Filter: All ▼] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ 300x250  │  │ 728x90   │  │ 160x600  │  │ 320x50  │ │
│  │ [preview]│  │ [preview]│  │ [preview]│  │[preview]│ │
│  │ Display  │  │ Leaderbd │  │ Skyscpr  │  │ Mobile  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │   YouTube        │  │   Gmail/Discover │            │
│  │   In-stream      │  │   Feed Preview   │            │
│  │   [preview]      │  │   [preview]      │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Phase 2: AssetCoveragePanel Component
**Priority:** High | **Effort:** 2 hours

#### Purpose
Show users which aspect ratios and asset types are covered, highlight missing requirements, and provide quality scores.

#### File Location
`src/components/ad-preview/AssetCoveragePanel.tsx`

#### Props Interface
```typescript
interface AssetCoveragePanelProps {
  images: UploadedAsset[];
  logos: UploadedAsset[];
  videos?: UploadedAsset[];
  campaignType: CampaignType;
  onUploadMore?: (assetType: 'image' | 'logo' | 'video') => void;
  onCropAsset?: (asset: UploadedAsset, targetRatio: AspectRatio) => void;
}
```

#### Required Aspect Ratios by Campaign
```typescript
const REQUIRED_RATIOS = {
  PMAX: {
    images: ['1.91:1', '1:1', '4:5'],  // Landscape, Square, Portrait
    logos: ['1:1', '4:1'],              // Square logo, Wide logo
  },
  DISPLAY: {
    images: ['1.91:1', '1:1'],
    logos: ['1:1'],
  },
  DEMAND_GEN: {
    images: ['1.91:1', '1:1', '4:5', '9:16'],  // Includes vertical for Shorts
    logos: ['1:1'],
  },
};
```

#### UI Layout
```
┌─────────────────────────────────────────┐
│  Asset Coverage          Score: 85/100  │
├─────────────────────────────────────────┤
│                                         │
│  Images                                 │
│  ┌────────────────────────────────────┐ │
│  │ ✓ Landscape (1.91:1)    3 images  │ │
│  │ ✓ Square (1:1)          2 images  │ │
│  │ ⚠ Portrait (4:5)        0 images  │ │
│  │   [+ Add] [Crop existing]         │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Logos                                  │
│  ┌────────────────────────────────────┐ │
│  │ ✓ Square (1:1)          1 logo    │ │
│  │ ✗ Wide (4:1)            Missing   │ │
│  │   [+ Upload wide logo]            │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ⚠ Add portrait images for better      │
│    YouTube Shorts performance          │
│                                         │
└─────────────────────────────────────────┘
```

---

### Phase 3: SmartCropStudio Component
**Priority:** Medium | **Effort:** 4 hours

#### Purpose
Provide a powerful cropping interface that allows users to create multiple aspect ratio versions from a single image, with AI-suggested focal points.

#### File Location
`src/components/ad-preview/SmartCropStudio.tsx`

#### Props Interface
```typescript
interface SmartCropStudioProps {
  image: UploadedAsset;
  requiredRatios: AspectRatio[];
  existingCrops?: CroppedVersion[];
  onSaveCrops: (crops: CroppedVersion[]) => void;
  onCancel: () => void;
}

interface CroppedVersion {
  ratio: AspectRatio;
  cropArea: { x: number; y: number; width: number; height: number };
  previewUrl: string;
  status: 'pending' | 'saved';
}
```

#### Features
1. **Batch Crop Mode** - Crop for all required ratios in one session
2. **Smart Focal Point** - Auto-detect faces/products for crop suggestions
3. **Live Preview** - See how crop looks in actual ad format
4. **Undo/Redo** - Full history support
5. **Zoom Controls** - Fine-tune crop area

#### UI Layout
```
┌──────────────────────────────────────────────────────────────┐
│  Smart Crop Studio                              [Save All]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────┐  ┌────────────────────────────┐│
│  │                         │  │  Crop Queue                ││
│  │    [Main Image with     │  │  ┌────────────────────────┐││
│  │     Crop Overlay]       │  │  │ ✓ 1.91:1 Landscape    │││
│  │                         │  │  │ ○ 1:1 Square          │││
│  │                         │  │  │ ○ 4:5 Portrait        │││
│  │                         │  │  │ ○ 9:16 Vertical       │││
│  │                         │  │  └────────────────────────┘││
│  │                         │  │                            ││
│  └─────────────────────────┘  │  Preview                   ││
│                               │  ┌────────────────────────┐││
│  Ratio: [1.91:1 ▼]            │  │  [Live ad preview     │││
│  Zoom: [────●────]            │  │   with current crop]  │││
│                               │  └────────────────────────┘││
│  [Reset] [Undo] [Redo]        └────────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### Phase 4: Standalone Page
**Priority:** Medium | **Effort:** 2 hours

#### Purpose
Create a dedicated `/ad-preview-center` route that combines all preview components for comprehensive asset management.

#### File Location
`src/app/ad-preview-center/page.tsx`

#### Features
1. **Campaign Selector** - Choose which campaign to preview
2. **Full-Screen Preview** - Larger format previews
3. **Asset Library** - View all uploaded assets
4. **Export Options** - Download previews as images
5. **Share Link** - Generate shareable preview links

#### Page Layout
```
┌────────────────────────────────────────────────────────────────────┐
│  Ad Preview Center                                                  │
│  Campaign: [Select Campaign ▼]                    [Share] [Export] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────┐│
│  │                                  │ │                          ││
│  │      FormatPreviewGrid           │ │   AssetCoveragePanel     ││
│  │      (expanded view)             │ │                          ││
│  │                                  │ │   - Coverage stats       ││
│  │                                  │ │   - Missing assets       ││
│  │                                  │ │   - Quality score        ││
│  │                                  │ │                          ││
│  └──────────────────────────────────┘ └──────────────────────────┘│
│                                                                    │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Ad Copy Variants                                              ││
│  │  Headlines: [Edit inline...]                                   ││
│  │  Descriptions: [Edit inline...]                                ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

### Phase 5: Campaign Detail Integration
**Priority:** Low | **Effort:** 1 hour

#### Purpose
Add links and quick-access buttons to existing campaign views that open the Ad Preview Center.

#### Files to Modify
- `src/components/campaigns/CampaignsTable.tsx` - Add preview action button
- `src/components/campaigns/VisualCampaignModal.tsx` - Add "Open Preview Center" link
- `src/app/campaigns/[id]/page.tsx` - Embed preview section (if exists)

#### Integration Points
1. **Campaigns Table** - Preview icon in actions column
2. **Campaign Creation Modal** - "Full Preview" button in review step
3. **Campaign Detail Page** - Embedded preview section

---

## Shared Types

```typescript
// src/types/ad-preview.ts

export type AspectRatio = '1:1' | '1.91:1' | '4:5' | '9:16' | '16:9' | '4:1';

export type AdFormat =
  | 'display-300x250'
  | 'display-728x90'
  | 'display-160x600'
  | 'display-320x50'
  | 'youtube-instream'
  | 'youtube-discovery'
  | 'youtube-shorts'
  | 'gmail-feed'
  | 'discover-feed'
  | 'search-desktop'
  | 'search-mobile';

export interface FormatConfig {
  id: AdFormat;
  name: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  campaignTypes: CampaignType[];
}

export const AD_FORMATS: FormatConfig[] = [
  { id: 'display-300x250', name: 'Medium Rectangle', width: 300, height: 250, aspectRatio: '1.91:1', campaignTypes: ['DISPLAY', 'PMAX'] },
  { id: 'display-728x90', name: 'Leaderboard', width: 728, height: 90, aspectRatio: '1.91:1', campaignTypes: ['DISPLAY', 'PMAX'] },
  // ... etc
];
```

---

## Constants

```typescript
// src/constants/ad-formats.ts

export const ASPECT_RATIO_REQUIREMENTS = {
  PMAX: {
    required: ['1.91:1', '1:1'],
    recommended: ['4:5'],
    optional: ['9:16'],
  },
  DISPLAY: {
    required: ['1.91:1'],
    recommended: ['1:1'],
    optional: [],
  },
  DEMAND_GEN: {
    required: ['1.91:1', '1:1'],
    recommended: ['4:5', '9:16'],
    optional: [],
  },
};

export const FORMAT_DISPLAY_SIZES = {
  'display-300x250': { width: 300, height: 250, label: 'Medium Rectangle' },
  'display-728x90': { width: 728, height: 90, label: 'Leaderboard' },
  'display-160x600': { width: 160, height: 600, label: 'Wide Skyscraper' },
  'display-320x50': { width: 320, height: 50, label: 'Mobile Banner' },
  'display-300x600': { width: 300, height: 600, label: 'Half Page' },
};
```

---

## File Structure

```
src/
├── components/
│   └── ad-preview/
│       ├── index.ts                    # Barrel exports
│       ├── FormatPreviewGrid.tsx       # Phase 1
│       ├── AssetCoveragePanel.tsx      # Phase 2
│       ├── SmartCropStudio.tsx         # Phase 3
│       ├── previews/
│       │   ├── DisplayFormatPreview.tsx
│       │   ├── YouTubePreview.tsx
│       │   ├── GmailDiscoverPreview.tsx
│       │   └── SearchPreview.tsx
│       └── shared/
│           ├── FormatBadge.tsx
│           └── AspectRatioIndicator.tsx
├── app/
│   └── ad-preview-center/
│       └── page.tsx                    # Phase 4
├── types/
│   └── ad-preview.ts                   # Shared types
└── constants/
    └── ad-formats.ts                   # Format configurations
```

---

## Dependencies

- `react-image-crop` - For SmartCropStudio (already may be installed)
- No new external dependencies required

---

## Testing Checklist

- [ ] FormatPreviewGrid renders all formats for each campaign type
- [ ] AssetCoveragePanel correctly calculates coverage
- [ ] SmartCropStudio saves crops in correct aspect ratios
- [ ] Standalone page loads campaign data correctly
- [ ] Campaign table preview button opens correct campaign
- [ ] Mobile responsive layouts work correctly

---

## Future Enhancements

1. **AI-Powered Suggestions** - Use AI to suggest headline/description improvements
2. **A/B Test Preview** - Compare multiple creative variants
3. **Performance Overlay** - Show historical performance data on previews
4. **Video Trimming** - Basic video editing for YouTube ads
5. **Template Library** - Save and reuse successful ad formats

---

## Progress Tracking

| Phase | Component | Status | Date |
|-------|-----------|--------|------|
| 1 | FormatPreviewGrid | Complete | Jan 2025 |
| 2 | AssetCoveragePanel | Complete | Jan 2025 |
| 3 | SmartCropStudio | Complete | Jan 2025 |
| 4 | Standalone Page | Complete | Jan 2025 |
| 5 | Campaign Integration | Complete | Jan 2025 |

---

## Files Created

- `src/types/ad-preview.ts` - Shared types for ad preview components
- `src/constants/ad-formats.ts` - Ad format configurations
- `src/components/ad-preview/FormatPreviewGrid.tsx` - Multi-format preview grid
- `src/components/ad-preview/AssetCoveragePanel.tsx` - Asset coverage analysis
- `src/components/ad-preview/SmartCropStudio.tsx` - Batch image cropping
- `src/components/ad-preview/previews/DisplayFormatPreview.tsx` - Display ad previews
- `src/components/ad-preview/previews/YouTubePreview.tsx` - YouTube ad previews
- `src/components/ad-preview/previews/GmailDiscoverPreview.tsx` - Gmail/Discover previews
- `src/components/ad-preview/previews/SearchPreview.tsx` - Search ad previews
- `src/app/ad-preview-center/page.tsx` - Standalone preview center page

## Integration Points Added

- Tools menu in main page (`src/app/page.tsx`) - Link to Ad Preview Center
- VisualCampaignModal review step - "Open Full Preview Center" link

---

*Last Updated: January 2025*
