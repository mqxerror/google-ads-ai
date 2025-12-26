# Epic 3: AI Score & Recommendations Engine

**Goal:** Calculate AI health scores for entities, generate recommendations, and display them in the grid.

---

## Story 3.1: AI Score Calculation

**As a** user,
**I want** each campaign to have an AI Score indicating health,
**so that** I can quickly identify problems.

**Acceptance Criteria:**
1. AI Score 0-100 calculated for each campaign
2. Score factors: CTR vs benchmark, conversion rate, wasted spend %, Quality Score (Search)
3. Score displayed in grid column with color (green/yellow/red)
4. Clicking score shows breakdown of factors
5. Scores refresh when data refreshes

---

## Story 3.2: Recommendation Generation

**As a** developer,
**I want** the AI to generate specific recommendations per entity,
**so that** users know what actions to take.

**Acceptance Criteria:**
1. Each entity with AI Score < 70 gets recommendations
2. Recommendation includes: issue, impact estimate, action button
3. Recommendations stored in database (cached)
4. Recommendations regenerate when data refreshes
5. Maximum 5 recommendations per entity

---

## Story 3.3: Recommendations in Grid

**As a** user,
**I want** to see top recommendation in the grid,
**so that** I can act without drilling down.

**Acceptance Criteria:**
1. "Top Issue" column shows primary recommendation summary
2. "Fix" button in column adds action to Action Queue
3. Hovering shows full recommendation text
4. Pro Mode shows all recommendations in expandable row

---

## Story 3.4: Wasted Spend View

**As a** user,
**I want** a dedicated view showing wasted spend,
**so that** I can stop losing money.

**Acceptance Criteria:**
1. "Wasted Spend" saved view pre-configured
2. Shows entities with Spend > $100 and Conversions = 0
3. Sorted by Spend descending
4. Total wasted spend shown in header
5. Bulk "Pause All Wasted" action available
