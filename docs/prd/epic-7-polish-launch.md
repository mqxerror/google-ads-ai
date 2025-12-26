# Epic 7: Polish & Launch Readiness

**Goal:** Simple/Pro mode, activity log, error handling, mobile, performance.

---

## Story 7.1: Simple Mode vs Pro Mode Toggle

**As a** user,
**I want** to toggle between simple and advanced views,
**so that** I get the right experience for my expertise.

**Acceptance Criteria:**
1. Toggle in header: Simple / Pro
2. Simple Mode: fewer columns, AI recommendations prominent
3. Pro Mode: all columns, advanced filters, bulk edit
4. Preference persists per user
5. New users default to Simple Mode

---

## Story 7.2: Activity Log Page

**As a** user,
**I want** a dedicated page showing all changes,
**so that** I have complete audit trail.

**Acceptance Criteria:**
1. Activity Log accessible from navigation
2. Shows all actions across all accounts
3. Filterable by date, account, action type
4. Expandable rows show full before/after details
5. Export to CSV

---

## Story 7.3: Error Handling

**As a** user,
**I want** clear error messages when things fail,
**so that** I know what to do.

**Acceptance Criteria:**
1. API errors show user-friendly message with retry
2. Google Ads API specific errors explained
3. Offline indicator if connection lost
4. Rate limit warnings with countdown
5. 404 and 500 error pages

---

## Story 7.4: Mobile Responsive

**As a** user,
**I want** basic functionality on mobile,
**so that** I can check my ads on the go.

**Acceptance Criteria:**
1. Grid collapses to card view on mobile
2. Key metrics visible in cards
3. Pause/Enable actions accessible
4. Chat panel is full-screen on mobile
5. Navigation via hamburger menu

---

## Story 7.5: Performance Optimization

**As a** user,
**I want** the app to feel fast,
**so that** I have a good experience.

**Acceptance Criteria:**
1. Grid virtualization for 1000+ rows
2. Data caching with stale-while-revalidate
3. Skeleton loaders during fetch
4. Optimistic UI updates for actions
5. LCP < 2.5 seconds
