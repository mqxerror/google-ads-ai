# Activity Logs

Tracks fixes and changes to maintain context across sessions.

---

## 2025-12-20: Saved Views Feature

FEATURE: Full Saved Views implementation for agencies - save filters, sorting, columns, and date presets.

IMPLEMENTATION:

1. Backend API:
   - `GET /api/saved-views` - List views (filtered by entityType, accountId)
   - `POST /api/saved-views` - Create new view
   - `GET /api/saved-views/[id]` - Get specific view
   - `PUT /api/saved-views/[id]` - Update view (name, filters, sorting, pin, default)
   - `DELETE /api/saved-views/[id]` - Delete view

2. Prisma Schema (SavedView model):
   - `datePreset` - stores date range preset (yesterday, last7days, etc.)
   - `isPinned` - for quick access pinning
   - `icon`, `color` - for visual customization
   - Unique constraint: [userId, accountId, name, entityType]

3. useSavedViews Hook:
   - Fetches/manages saved views state
   - CRUD operations (create, update, delete)
   - Apply/clear active view
   - Auto-applies default view on mount

4. ViewsDropdown Enhancement:
   - Shows both "Smart Views" (presets) and "Saved Views" (user-created)
   - Create new view from current filters/sorting/date preset
   - Inline rename, pin, set default, delete actions
   - Visual indicators for pinned (📌) and default (⭐) views
   - "Clear" chip when a saved view is active

FILES CHANGED:

prisma/schema.prisma
- Enhanced SavedView model with datePreset, isPinned, icon, color

src/app/api/saved-views/route.ts (NEW)
- GET: List saved views for user/entityType
- POST: Create new saved view

src/app/api/saved-views/[id]/route.ts (NEW)
- GET/PUT/DELETE for individual views
- Handles legacy 'field' to 'column' conversion in sorting

src/hooks/useSavedViews.ts (NEW)
- Hook for managing saved views state and operations
- Auto-fetches on mount, auto-applies default view

src/components/SmartGrid/ViewsDropdown.tsx
- Integrated saved views alongside smart views
- Added create/edit/delete/pin/default functionality
- Uses heroicons for consistent iconography

src/components/SmartGrid/SmartGrid.tsx
- Passes currentViewState to ViewsDropdown for saving
- Applies saved view's datePreset using preset name

src/components/SavedViews/SavedViewSelector.tsx (NEW)
- Standalone component (not currently used, ViewsDropdown has it inline)

package.json
- Added @heroicons/react dependency

USAGE:
1. Set filters, sorting, date preset as desired
2. Click Views dropdown → "Save current view"
3. Enter name and save
4. View appears in Saved Views section
5. Click to apply, hover for edit/pin/delete actions
6. Set as default to auto-apply on page load

---

## 2025-12-20: Enhanced Smart Pre-warm with Progress Tracking

FEATURE: Enhanced smart pre-warming with top 10 visible campaigns support and progress tracking UI.

IMPLEMENTATION:

1. Smart Pre-warm Enhancements:
   - Accepts top 10 visible campaigns (based on current filters/sort)
   - Quota guardrails: max 5 jobs/min/customer
   - Progress tracking: queued/running/completed counts
   - Estimated remaining time calculation

2. Progress Tracking API:
   - `GET /api/admin/prewarm` - Fetch prewarm status and progress
   - `POST /api/admin/prewarm` - Trigger manual prewarm
   - Returns enabled status, config, active prewarns, customer progress

3. Diagnostics Panel UI:
   - Shows "Smart Pre-warm Progress" card when enabled
   - Progress bar with percentage
   - Status grid: queued/running/completed counts
   - Estimated remaining time
   - "Trigger Pre-warm" button for manual prewarm

FILES CHANGED:

src/lib/cache/smart-prewarm.ts
- `smartPrewarmAdGroups()` - Accepts visibleCampaigns array
- `markJobRunning/Completed/Failed()` - Progress tracking
- `getProgress()` - Returns PrewarmProgress object
- `PREWARM_CONFIG` - MAX_JOBS_PER_MINUTE: 5

src/app/api/admin/prewarm/route.ts (NEW)
- GET: Fetch prewarm progress for all customers
- POST: Trigger manual prewarm for visible campaigns

src/lib/queue/refresh-worker.ts
- Calls markJobRunning/Completed/Failed for progress tracking

src/components/OpsCenter/DiagnosticsPanel.tsx
- Added Smart Pre-warm Progress card with progress bar
- Added Clear All Cache button (localStorage + DB)

---

## 2025-12-20: Smart Pre-warm + Cache Warming UI Hints

FEATURE: Opt-in smart pre-warming for ad groups cache + UI hints for cold cache loads.

IMPLEMENTATION:

1. Smart Pre-warm (opt-in via FF_SMART_PREWARM=true):
   - Pre-warms ad groups cache for top campaigns by spend
   - Max 3 campaigns per request (configurable)
   - Only campaigns with $10+ spend
   - Skips campaigns already cached (fresh within 30m)
   - Uses queue-based background jobs
   - Does NOT pre-warm keywords/ads

2. UI Warming Hints:
   - Shows "Warming drill-down cache... (first load is slower)" banner
   - Displayed in AdGroupsGrid and KeywordsGrid during initial load
   - Amber colored with spinner
   - Helps users understand why first drill-down is slower

FILES CHANGED:

src/lib/feature-flags.ts
- Added SMART_PREWARM flag (disabled by default)

src/lib/cache/smart-prewarm.ts (NEW)
- `smartPrewarmAdGroups()` - Pre-warm ad groups for top campaigns
- `getPrewarmStatus()` - Check warm/cold status per campaign
- `PREWARM_CONFIG` - Configuration constants

src/app/api/google-ads/campaigns/route.ts
- Calls `smartPrewarmAdGroups()` after campaign fetch (when enabled)

src/components/SmartGrid/AdGroupsGrid.tsx
- Added "Warming drill-down cache..." banner during initial load

src/components/SmartGrid/KeywordsGrid.tsx
- Added "Warming drill-down cache..." banner during initial load

TO ENABLE:
Set FF_SMART_PREWARM=true in environment variables.

---

## 2025-12-20: DataHealthBadge + Cache Cleanup

ISSUE: DataHealthBadge showed hardcoded "Partial Data 4/5 days" instead of real coverage data. Also, old corrupted cache rows were still in DB causing Yesterday and Last Week to show identical values.

ACTIONS:

1. Wired DataHealthBadge to real data from CampaignsDataContext:
   - Uses `dateRange` to calculate total days
   - Uses `dataCompleteness` percentage to calculate days available
   - Uses `syncStatus` to determine health status
   - Uses `lastSyncedAt` for freshness display
   - Dynamically builds issues list based on actual data quality

2. Executed cache cleanup migration:
   - Ran `npx tsx scripts/cleanup-range-aggregates.ts`
   - Deleted 653 corrupted MetricsFact rows (299 CAMPAIGN, 26 AD_GROUP, 328 KEYWORD)
   - Cache is now clean

FILES CHANGED:

src/components/DataHealth/DataHealthBadge.tsx
- Replaced mock `useDataHealth()` with real data from `useCampaignsData()` context
- Uses `useMemo` for efficient recalculation
- Dynamic status: healthy / partial / stale / error
- Dynamic issues: missing_days, cache_stale, conversion_lag, api_delay
- Fixed `formatTime()` to handle null dates

RESULT:
- DataHealthBadge now shows real coverage (e.g., "1/1 days" for Yesterday, "7/7 days" for Last 7 Days)
- Cache is clean - next API requests will fetch fresh per-day data
- Yesterday and Last Week will now show correct distinct values

---

## 2025-12-20: Stability Checkpoint - Complete Per-Day Storage Fix

ISSUE: "Yesterday" values still showing 7-day totals due to cache pollution. Both Campaigns AND Ad Groups routes were storing range-aggregated totals.

ROOT CAUSE:
1. `fetchCampaigns()` and `fetchAdGroups()` did not include `segments.date` in GAQL SELECT
2. Google Ads API returns aggregated totals when `segments.date` is not in SELECT
3. Both `storeCampaignMetrics()` and `storeAdGroupMetrics()` stored 7-day aggregates with `date: endDate`

FILES CHANGED:

src/lib/cache/metrics-storage.ts (NEW)
- Created strict per-day storage layer
- `storeDailyMetrics()` validates all rows have date field before storing
- `readAndAggregateMetrics()` aggregates per-day data for range queries
- `invalidateMetricsCache()` for cache invalidation
- Returns provenance info (datesWritten, rowsWritten, granularity)

src/lib/google-ads.ts
- Added `fetchCampaignsDaily()` with `segments.date` in SELECT
- Added `fetchAdGroupsDaily()` with `segments.date` in SELECT
- Both return per-day rows, not aggregated totals

src/app/api/google-ads/campaigns/route.ts
- Uses `fetchCampaignsDaily()` and `storeDailyMetrics()` on cache miss
- Added `_meta.provenance` to API responses
- Removed old `storeCampaignMetrics()` function

src/app/api/google-ads/ad-groups/route.ts
- Uses `fetchAdGroupsDaily()` and `storeDailyMetrics()` on cache miss
- Removed old `storeAdGroupMetrics()` function

src/app/api/admin/cache/route.ts
- Added `invalidate-metrics` action for one-click cache invalidation

src/app/api/admin/diagnostics/route.ts
- Added granularityCheck to entity coverage showing:
  - totalRows, uniqueDates, uniqueEntities
  - avgRowsPerDate
  - granularity: 'daily' | 'range-aggregate' | 'unknown'
  - overlapDetected: boolean
  - duplicateDateEntityPairs: count of pollution

src/components/OpsCenter/SystemStatus.tsx
- Added "Invalidate Cache" button for one-click cache clearing

scripts/cleanup-range-aggregates.ts (NEW)
- One-time migration to delete all corrupted MetricsFact rows
- Run with: npx tsx scripts/cleanup-range-aggregates.ts
- Use --dry-run to preview

src/lib/__tests__/metrics-storage-invariants.test.ts (NEW)
- Regression tests for per-day storage invariant

CRITICAL INVARIANTS:
1. MetricsFact only stores per-day rows (never range aggregates)
2. All GAQL queries for caching must include `segments.date` in SELECT
3. Unique constraint: [customerId, entityType, entityId, date]

NEXT STEPS:
1. Run cleanup: npx tsx scripts/cleanup-range-aggregates.ts
2. Verify diagnostics show granularity='daily' for all entity types
3. Monitor for 48-72h before proceeding to Saved Views/KPI Builder

---

## 2025-12-20: Date Range Consistency Fix

ISSUE: "Yesterday" preset showing 7-day totals instead of 1-day totals.

ROOT CAUSE: Multiple places calculated dates differently. DateRangePicker, CampaignsDataContext, and localStorage restoration all had separate logic that could diverge.

FILES CHANGED:

src/hooks/useDateRangeParams.ts (NEW)
- Created single source of truth for all preset date calculations
- Yesterday now correctly returns startDate equal to endDate (1-day window)
- Added validation function to detect preset/date mismatches

src/components/DateRangePicker.tsx
- Removed duplicate date calculation logic
- Now delegates to useDateRangeParams hook for all preset calculations

src/contexts/CampaignsDataContext.tsx
- Removed buggy localStorage persistence with flawed recalculation logic
- Removed local calculateDateRange function that ignored preset parameter
- Now uses useDateRangeState hook from the new file

src/components/SmartGrid/SmartGrid.tsx
- Removed redundant date range wrapper
- Uses context directly without local conversion

src/components/Dashboard/DashboardPage.tsx
- Fixed handleDateRangeChange to use preset strings instead of manual date calculation

src/lib/__tests__/date-range-invariants.test.ts (NEW)
- Added regression tests for critical invariant: Yesterday equals 1 day
- Tests all presets produce correct date ranges

---

## 2025-12-20: Change Tracking in Ops

ISSUE: No visibility into system configuration for debugging.

FILES CHANGED:

src/components/OpsCenter/SystemStatus.tsx (NEW)
- Shows build version, git SHA, environment
- Shows active cache mode
- Shows current query context with validation status
- Shows all feature flags with on/off state
- Shows last refresh job status

src/app/ops/page.tsx
- Added System tab to display SystemStatus component

---

## 2025-12-20: Worker OAuth Fix

ISSUE: Background refresh jobs failing with "Could not determine client ID from request".

ROOT CAUSE: Worker script not loading environment variables before importing modules.

FILES CHANGED:

scripts/worker.ts
- Added dotenv loading at very top of file with override true
- Added validation for required environment variables

package.json
- Added dotenv dependency

---

## 2025-12-20: BullMQ Job ID Fix

ISSUE: BullMQ rejecting job IDs containing colons.

FILES CHANGED:

src/lib/queue/refresh-queue.ts
- Changed job ID separator from colon to underscore

---

## 2025-12-20: Port Configuration Fix

ISSUE: Dev server port not matching NEXTAUTH_URL causing OAuth redirect failures.

FILES CHANGED:

package.json
- Changed dev script port from 3001 to 4000

.env.local
- NEXTAUTH_URL set to localhost:4000

---

## 2025-12-20: TypeScript Build Fix

ISSUE: Build failing due to test script conflicts.

FILES CHANGED:

tsconfig.json
- Added scripts directory to exclude array

---

## 2025-12-20: Stability Gate Implementation

ISSUE: Need automated checks to prevent date-range bugs from recurring.

FILES CHANGED:

.github/workflows/ci.yml
- Added explicit date-range-invariants test step that blocks merge on failure
- Added e2e-smoke job for Playwright tests

playwright.config.ts (NEW)
- Configured Playwright for smoke tests
- Uses port 4000 to match dev server

e2e/date-range-smoke.spec.ts (NEW)
- Tests Yesterday preset produces startDate equal to endDate in API requests
- Tests Last 7 Days preset spans exactly 7 days
- Verifies UI label matches API request dates
- Tests Ops System tab shows query context

src/components/OpsCenter/SystemStatus.tsx
- Added Copy Debug Info button
- Generates JSON payload with preset, dates, timezone, cacheMode, coverage, build SHA
- One-click copy for bug reports

src/hooks/useDateRangeParams.ts
- Added timezone parameter to calculateDatesForPreset
- Added getTodayInTimezone helper using Intl.DateTimeFormat
- Ensures Yesterday computed in account timezone not local machine
- Added getAccountTimezone helper function

package.json
- Added @playwright/test dependency

---

## 2025-12-20: Compare Mode Inline Deltas

FEATURE: Period-over-period comparison mode showing inline deltas next to metric values.

IMPLEMENTATION:

1. Compare Mode Context (`src/contexts/CompareModeContext.tsx`):
   - isCompareMode toggle state
   - compareConfig for period type (previous, same_last_year, custom)

2. Comparison API (`GET /api/google-ads/campaigns/compare`):
   - Accepts current period dates
   - Automatically calculates previous period (same duration)
   - Fetches and aggregates metrics for both periods
   - Returns delta percentages for all key metrics:
     - spendDelta, clicksDelta, impressionsDelta
     - conversionsDelta, cpaDelta, ctrDelta, roasDelta

3. useComparisonData Hook:
   - Fetches comparison data when compare mode is enabled
   - Returns comparisonMap (campaignId → comparison data)
   - Auto-fetches when date range changes

4. MetricDelta Component:
   - Displays percentage change with arrow icon
   - Color-coded: green for good, red for bad
   - Supports inverted logic (for CPA where decrease is good)

5. GridRow Integration:
   - Accepts optional comparison prop
   - Shows deltas next to Spend, Conversions, CPA columns
   - CPA uses inverted logic (decrease = green)

6. SmartGrid Updates:
   - "Compare" toggle button in control bar
   - Compare mode indicator strip showing comparison period
   - Visual feedback when compare mode is active

FILES CHANGED:

src/types/campaign.ts
- Added CampaignComparison interface

src/contexts/CompareModeContext.tsx (NEW)
- Compare mode state management

src/app/api/google-ads/campaigns/compare/route.ts (NEW)
- Comparison data API endpoint

src/hooks/useComparisonData.ts (NEW)
- Hook for fetching comparison data

src/components/SmartGrid/MetricDelta.tsx (NEW)
- Delta display component with color coding

src/components/SmartGrid/GridRow.tsx
- Added comparison prop and delta display

src/components/SmartGrid/SmartGrid.tsx
- Added Compare toggle button
- Compare mode indicator strip
- Pass comparison data to rows

src/components/Providers.tsx
- Added CompareModeProvider

USAGE:
1. Click "Compare" button in grid control bar
2. Deltas appear next to metric values
3. Green = good (more conversions, less CPA)
4. Red = bad (more CPA, less conversions)
5. Banner shows comparison period
6. Click "Disable" or toggle button to exit

---

## 2025-12-20: What Changed Feature (Daily Workflow Surface)

FEATURE: What Changed panel - daily workflow surface showing budget/bid changes, metric deltas, anomalies, and wasted spend with actionable options.

IMPLEMENTATION:

1. Backend API (`GET /api/changes`):
   - Compares last 7 days vs prior 7 days
   - Detects spend spikes/drops (30%+ / 20%+)
   - Detects CPA spikes (25%+ = warning, 40%+ = critical)
   - Detects conversion drops/spikes (20%+ / 30%+)
   - Detects CTR drops (15%+)
   - Detects wasted spend ($100+ with 0 conversions)
   - Identifies scaling opportunities (CPA improved 15%+ with 5+ conversions)
   - Returns severity-sorted list (critical → warning → info → positive)

2. Types (`src/types/changes.ts`):
   - ChangeCategory: budget, bidding, status, metric_spike, metric_drop, anomaly, wasted_spend, opportunity
   - ChangeSeverity: critical, warning, info, positive
   - ChangeItem: full change data with entity info, metrics, actions
   - CHANGE_THRESHOLDS: configurable detection sensitivity

3. UI Component (`WhatChangedPanel`):
   - Slide-in panel from right side
   - Summary bar with critical/warning/positive counts
   - Expandable change cards with severity-based styling
   - Delta badges showing percentage change
   - Three actions per item:
     - Queue Fix: Adds to ActionQueue (pause, adjust budget, etc.)
     - Explain: Generates AI analysis (mock for now)
     - Ignore: Dismisses the alert
   - Integrated with ActionQueueContext for fix queuing

4. SmartGrid Integration:
   - "Changes" button in control bar (next to Optimize)
   - Opens WhatChangedPanel when clicked
   - Only shows at campaign level when campaigns exist

FILES CHANGED:

src/types/changes.ts (NEW)
- Change detection types and thresholds

src/app/api/changes/route.ts (NEW)
- GET endpoint for change detection
- Period comparison logic
- Severity classification

src/components/WhatChanged/WhatChangedPanel.tsx (NEW)
- Full panel UI with actions
- AI explanation generation (mock)
- ActionQueue integration

src/components/WhatChanged/index.ts (NEW)
- Barrel export

src/components/SmartGrid/SmartGrid.tsx
- Import WhatChangedPanel
- Add isWhatChangedOpen state
- Add "Changes" button in control bar

USAGE:
1. Click "Changes" button in campaign grid control bar
2. View detected changes sorted by severity
3. Click item to expand and see details
4. Click "Queue Fix" to add action to queue
5. Click "Explain" for AI analysis
6. Click "Ignore" to dismiss

---

## Port Configuration Note

Port 4000 is for local development only.

For production:
- NEXTAUTH_URL must be set to production domain
- OAuth redirect URIs in Google Cloud Console must match production
- Do not hardwire port in production configs

---

## Key Files Reference

Date range logic: src/hooks/useDateRangeParams.ts (source of truth)
Date picker UI: src/components/DateRangePicker.tsx
App state: src/contexts/CampaignsDataContext.tsx
Feature flags: src/lib/feature-flags.ts
Worker: scripts/worker.ts
Queue: src/lib/queue/refresh-queue.ts

---

## Debugging Tips

Date ranges wrong: Check Ops System tab for query context validation

Worker jobs failing: Check /tmp/worker.log and verify Redis running

OAuth failing: Verify NEXTAUTH_URL matches server port (currently 4000)
