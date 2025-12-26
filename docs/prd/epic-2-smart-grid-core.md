# Epic 2: Smart Grid Core

**Goal:** Build the primary Airtable-style data grid with campaigns, filtering, sorting, saved views, and drill-down.

---

## Story 2.1: Campaign Smart Grid

**As a** user,
**I want** to see all my campaigns in a data grid,
**so that** I can quickly scan and act on my advertising.

**Acceptance Criteria:**
1. Grid displays all campaigns for selected account
2. Columns: Name, Status, Type, Spend, Clicks, Conv, CTR, CPA, AI Score
3. Columns are sortable (click header)
4. Loading skeleton while data fetches
5. Empty state if no campaigns
6. Grid loads within 3 seconds

---

## Story 2.2: Grid Filtering

**As a** user,
**I want** to filter the grid by any column,
**so that** I can focus on specific campaigns.

**Acceptance Criteria:**
1. Filter button opens filter panel
2. Can filter by: Status, Type, Spend range, AI Score range
3. Multiple filters can be combined (AND logic)
4. Active filters shown as chips above grid
5. Clear all filters button
6. Filter updates grid instantly

---

## Story 2.3: Saved Views

**As a** user,
**I want** to save filter/sort configurations as views,
**so that** I can quickly access common views.

**Acceptance Criteria:**
1. Pre-built views available: All, Needs Attention, Wasted Spend, Top Performers
2. "Save View" button creates custom view from current filters
3. Views shown as tabs/buttons above grid
4. Users can rename and delete custom views
5. Views persist per user per account

---

## Story 2.4: Row Selection and Bulk Actions

**As a** user,
**I want** to select multiple campaigns and act on them at once,
**so that** I can make changes efficiently.

**Acceptance Criteria:**
1. Checkbox column for row selection
2. "Select All" in header selects visible rows
3. Selection count shown in footer
4. Bulk Actions dropdown: Pause Selected, Enable Selected
5. Bulk action adds items to Action Queue (not immediate execution)

---

## Story 2.5: Drill-Down Navigation

**As a** user,
**I want** to click a campaign and see its ad groups, then keywords,
**so that** I can explore the account hierarchy.

**Acceptance Criteria:**
1. Clicking campaign row opens that campaign's ad groups in grid
2. Breadcrumb navigation: Account > Campaign > Ad Group
3. Ad group grid shows: Name, Status, Clicks, Conv, CPA
4. Clicking ad group shows keywords/ads (tabs)
5. Back button returns to previous level
6. Drill-down loads within 2 seconds

---

## Story 2.6: Entity Detail Panel

**As a** user,
**I want** to see full details of an entity without leaving the grid,
**so that** I can get more info quickly.

**Acceptance Criteria:**
1. Right-click or expand icon opens slide-out panel
2. Panel shows all metrics, settings, and AI recommendations
3. Panel has action buttons (Pause, Edit Budget, etc.)
4. Changes from panel go to Action Queue
5. Panel can be pinned open or closed
