# AI-Powered Google Ads Manager — Product Requirements Document (PRD)

---

## 1. Goals and Background Context

### 1.1 Goals

- **Enable SMB owners to manage ALL Google Ads campaign types with AI assistance** — reducing expertise barrier and time investment from 10-20 hours/month to <5 hours/month
- **Provide an Airtable-style Smart Grid as the primary UI surface** — data-first experience where users see, filter, and act on campaigns/ads/keywords in a spreadsheet-like interface
- **Support multi-account portfolio management from Day 1** — users with 2-50 accounts can switch context instantly and see cross-account insights
- **Deliver AI-powered analysis AND structured actions** — chat for complex queries, but primary optimizations happen through the Smart Grid with action buttons
- **Execute optimizations through a safety-first Action Queue** — all write operations are staged, reviewed, and executed with guardrails
- **Reduce wasted ad spend by 15%+** — through automated waste detection and one-click recommendations
- **Achieve time to first value under 5 minutes** — from signup to first meaningful insight

### 1.2 Background Context

Google Ads management is a complex, expertise-intensive discipline where most SMB owners lack the 3-5+ years of experience needed for expert-level decisions. A typical $10K/month account with no expert management wastes $1,500-$3,000/month on poor keywords, missed negatives, and suboptimal bids — that's $18K-$36K/year in preventable loss.

The current landscape offers no solution that combines deep expertise, actual account access, actionable execution, affordable pricing, and a modern data-grid interface. Existing tools either require PPC knowledge (Optmyzr, WordStream), are expensive (agencies at $2K-$10K/month), or lack account access (ChatGPT). This application bridges that gap with an Airtable-style Smart Grid combined with AI chat.

**Key Product Insight:** Most users don't want a "dashboard" — they want a spreadsheet where they can see their data, make a business decision in 30 seconds, and move on. The Smart Grid delivers this.

### 1.3 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2024-12-13 | 1.0 | Initial PRD from Project Brief | PM Agent |
| 2024-12-14 | 2.0 | Major pivot: Smart Grid UI, Multi-account Day 1, All Campaign Types, Action Queue, Capability Matrix | PM Agent |

---

## 2. Product Vision: Smart Grid + AI

### 2.1 Core UI Philosophy

**Primary Surface: Airtable-Style Smart Grid**

The main interface is NOT a dashboard with charts and cards. It's a powerful, filterable data grid where:

- **Rows = Entities** (Campaigns, Ad Groups, Keywords, Ads, Search Terms)
- **Columns = Metrics + Actions** (Spend, Clicks, Conv, CTR, CPA, Status, AI Score, Quick Actions)
- **Views = Saved Filters** (e.g., "Wasted Spend", "Top Performers", "Needs Attention")
- **Bulk Actions** = Select multiple rows, apply action to all

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Account Switcher ▼]  [Campaigns ▼]  [Date: Last 30 Days ▼]  [+ New View]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Views: [All] [Wasted Spend] [Top Performers] [Paused] [+ Create View]      │
├─────────────────────────────────────────────────────────────────────────────┤
│  □  Campaign Name       Status   Type      Spend     Conv   CPA    AI Score │
├─────────────────────────────────────────────────────────────────────────────┤
│  □  Brand Keywords      ●Active  Search    $1,234    45     $27    92 🟢    │
│  □  Competitor Terms    ●Active  Search    $2,100    12     $175   34 🔴    │
│  □  PMax - All Products ●Active  PMax      $5,600    89     $63    78 🟡    │
│  □  Shopping Feed       ●Active  Shopping  $3,200    67     $48    85 🟢    │
│  □  Display Retarget    ○Paused  Display   $0        0      -      -        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Bulk Actions ▼]  Selected: 0  │  Total Spend: $12,134  │  Total Conv: 213 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Secondary Surface: AI Chat Panel**

A collapsible side panel for:
- Complex questions ("Why is my CPA up 40% this week?")
- Multi-step analysis ("Compare my Search vs PMax performance")
- Strategic recommendations ("What should I focus on this month?")

The chat can SUGGEST actions that populate the Action Queue, but the user executes from the grid.

### 2.2 Multi-Account Architecture (Day 1)

Users can connect multiple Google Ads accounts and switch between them instantly:

- **Account Switcher** in header — dropdown with all connected accounts
- **Cross-Account Views** — see aggregated data across all accounts (Phase 1.5)
- **Account Health Summary** — quick status for each account in sidebar
- **MCC Support** — connect via Manager Account for agencies

**Why Day 1:** Many SMB owners have 2-5 accounts (different businesses, regions, brands). Forcing single-account is a dealbreaker.

### 2.3 Mode Toggle: Simple Mode vs Pro Mode

**Simple Mode (Default for SMB owners):**
- Fewer columns visible (Name, Status, Spend, Conversions, AI Recommendation)
- AI Score prominently displayed with plain-English explanation
- One-click "Fix This" buttons for common issues
- Guided workflows ("Let's clean up your account")

**Pro Mode (For power users/agencies):**
- All columns visible (QS, Impression Share, Search Lost IS, etc.)
- Advanced filters and custom views
- Bulk editing capabilities
- Raw API data access
- Export to CSV/Google Sheets

Toggle in header: `[Simple Mode] / [Pro Mode]`

---

## 3. Campaign Type Support & Capability Matrix

### 3.1 Supported Campaign Types (MVP)

All Google Ads campaign types are supported with varying levels of read/write capability:

| Campaign Type | Read Support | Write Support (MVP) | Write Support (Later) |
|---------------|--------------|---------------------|----------------------|
| **Search** | Full | Full | - |
| **Performance Max** | Full | Limited | Full |
| **Shopping** | Full | Moderate | Full |
| **Display** | Full | Limited | Moderate |
| **Video** | Full | Limited | Moderate |
| **Demand Gen** | Full | Limited | Moderate |
| **App** | Full | Minimal | Limited |

### 3.2 Detailed Capability Matrix

#### Search Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Keywords, RSAs, Search Terms | ✅ | - | Full read access |
| **Metrics Fetchable** | | | |
| Impressions, Clicks, CTR, Conversions, Cost, CPA, ROAS | ✅ | - | All standard metrics |
| Quality Score, Impression Share, Search Lost IS | ✅ | - | Advanced metrics |
| **Insights Generatable** | | | |
| Wasted spend analysis | ✅ | - | High-spend, low-conversion keywords |
| Negative keyword recommendations | ✅ | - | From search terms report |
| Ad copy performance comparison | ✅ | - | RSA asset analysis |
| Quality Score improvement suggestions | ✅ | - | Based on QS factors |
| Budget pacing alerts | ✅ | - | Over/under spending |
| **Actions Executable** | | | |
| Pause/Enable campaigns, ad groups, keywords, ads | ✅ | - | Core actions |
| Adjust campaign budgets | ✅ | - | With guardrails |
| Add negative keywords | ✅ | - | Campaign or ad group level |
| Adjust keyword bids | ✅ | - | Manual CPC only |
| Create new RSA variants | - | ✅ | AI-generated copy |
| Add new keywords | - | ✅ | From recommendations |

#### Performance Max (PMax) Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Asset Groups, Assets, Listing Groups | ✅ | - | Read-only for most |
| **Metrics Fetchable** | | | |
| Impressions, Clicks, Conversions, Cost, ROAS | ✅ | - | Campaign-level metrics |
| Asset performance labels | ✅ | - | Best/Good/Low |
| Placement reports (where ads showed) | ✅ | - | Limited transparency |
| **Insights Generatable** | | | |
| Asset performance analysis | ✅ | - | Which assets work/don't |
| Audience signal effectiveness | - | ✅ | Limited API data |
| Search category insights | ✅ | - | Where PMax is showing |
| **Actions Executable** | | | |
| Pause/Enable campaigns | ✅ | - | Campaign level only |
| Adjust campaign budgets | ✅ | - | With guardrails |
| Adjust ROAS/CPA targets | ✅ | - | Bidding strategy |
| Add/remove assets | - | ✅ | Images, headlines, descriptions |
| Modify listing groups | - | ✅ | Product targeting |
| **Constraints** | | | |
| Cannot see/modify individual keywords | N/A | N/A | PMax limitation |
| Cannot see exact search terms | N/A | N/A | Google limitation |

#### Shopping Campaigns (Standard)

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Product Groups, Products | ✅ | - | Full hierarchy |
| **Metrics Fetchable** | | | |
| All standard metrics + ROAS | ✅ | - | Product-level available |
| Product-level performance | ✅ | - | Via product groups |
| **Insights Generatable** | | | |
| Product performance ranking | ✅ | - | Best/worst sellers |
| Bid optimization suggestions | ✅ | - | Based on ROAS |
| Product group structure analysis | - | ✅ | Optimization suggestions |
| **Actions Executable** | | | |
| Pause/Enable campaigns, ad groups | ✅ | - | Standard actions |
| Adjust budgets | ✅ | - | With guardrails |
| Adjust product group bids | ✅ | - | Manual CPC |
| Exclude products | - | ✅ | Via product groups |
| Restructure product groups | - | ✅ | Advanced |

#### Display Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Responsive Display Ads, Audiences, Placements | ✅ | - | |
| **Metrics Fetchable** | | | |
| Standard metrics + View-through conversions | ✅ | - | |
| Placement reports | ✅ | - | Where ads showed |
| **Insights Generatable** | | | |
| Placement quality analysis | ✅ | - | Flag junk placements |
| Audience performance comparison | ✅ | - | Which audiences convert |
| **Actions Executable** | | | |
| Pause/Enable campaigns, ad groups, ads | ✅ | - | |
| Adjust budgets | ✅ | - | |
| Exclude placements | - | ✅ | Block bad sites |
| Adjust audience bids | - | ✅ | |

#### Video Campaigns (YouTube)

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Video Ads, Audiences | ✅ | - | |
| **Metrics Fetchable** | | | |
| Views, View Rate, CPV, Conversions | ✅ | - | Video-specific metrics |
| Audience retention (limited) | - | ✅ | Requires YouTube API |
| **Insights Generatable** | | | |
| Video performance comparison | ✅ | - | Which videos work |
| Audience targeting effectiveness | ✅ | - | |
| **Actions Executable** | | | |
| Pause/Enable campaigns, ad groups | ✅ | - | |
| Adjust budgets and bids | ✅ | - | |
| Modify targeting | - | ✅ | Audiences, topics |

#### Demand Gen Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns, Ad Groups, Assets | ✅ | - | Similar to PMax |
| **Metrics Fetchable** | | | |
| Standard metrics | ✅ | - | |
| Asset performance | ✅ | - | |
| **Insights Generatable** | | | |
| Asset performance analysis | ✅ | - | |
| **Actions Executable** | | | |
| Pause/Enable, budget adjustments | ✅ | - | |
| Asset modifications | - | ✅ | |

#### App Campaigns

| Capability | MVP | Later | Notes |
|------------|-----|-------|-------|
| **Primary Entities (Read)** | | | |
| Campaigns (limited control by design) | ✅ | - | Google automates most |
| **Metrics Fetchable** | | | |
| Installs, In-app actions, Cost | ✅ | - | |
| **Insights Generatable** | | | |
| Performance trends | ✅ | - | Limited optimization levers |
| **Actions Executable** | | | |
| Pause/Enable campaigns | ✅ | - | |
| Adjust budgets and CPA targets | ✅ | - | |
| Asset changes | - | ✅ | Very limited |
| **Constraints** | | | |
| Most optimization is automated by Google | N/A | N/A | By design |

---

## 4. Requirements

### 4.1 Functional Requirements

**Authentication & Multi-Account Management**
- **FR1:** Users shall authenticate via Google OAuth 2.0 to connect Google Ads accounts
- **FR2:** Users shall connect multiple Google Ads accounts (up to 50)
- **FR3:** Users shall switch between connected accounts via account switcher dropdown
- **FR4:** The system shall securely store and refresh OAuth tokens for all connected accounts
- **FR5:** Users shall disconnect individual accounts at any time
- **FR6:** Users shall connect via MCC (Manager Account) to access client accounts
- **FR7:** The system shall display account name, ID, and health status in the account list

**Smart Grid Interface**
- **FR8:** The primary UI shall be an Airtable-style data grid with sortable, filterable columns
- **FR9:** Grid rows shall represent entities (Campaigns, Ad Groups, Keywords, Ads, Search Terms)
- **FR10:** Grid columns shall include: Name, Status, Type, Spend, Clicks, Conversions, CTR, CPA, ROAS, AI Score
- **FR11:** Users shall filter grid by any column value or combination
- **FR12:** Users shall sort grid by any column (ascending/descending)
- **FR13:** Users shall create and save custom views (filter + sort + column configurations)
- **FR14:** Users shall select multiple rows for bulk actions
- **FR15:** Grid shall support drill-down navigation (Campaign → Ad Groups → Keywords/Ads)
- **FR16:** Grid shall load and display data within 3 seconds
- **FR17:** Grid shall support pagination or virtual scrolling for large datasets (1000+ rows)
- **FR18:** Users shall toggle between Simple Mode and Pro Mode

**Simple Mode vs Pro Mode**
- **FR19:** Simple Mode shall display fewer columns with AI-focused recommendations
- **FR20:** Simple Mode shall show "Fix This" buttons for common issues
- **FR21:** Pro Mode shall display all available columns and metrics
- **FR22:** Pro Mode shall enable advanced filtering and bulk editing
- **FR23:** Mode preference shall persist per user

**AI Score & Recommendations**
- **FR24:** Each campaign/entity shall display an AI Score (0-100) indicating health
- **FR25:** AI Score shall be color-coded: green (70+), yellow (40-69), red (<40)
- **FR26:** Clicking AI Score shall reveal explanation and recommended actions
- **FR27:** AI shall generate prioritized recommendations per entity
- **FR28:** Recommendations shall include: issue description, impact estimate, and action button

**Action Queue & Safety Model**
- **FR29:** All write operations shall be staged in an Action Queue before execution
- **FR30:** Action Queue shall display pending actions with: entity, action type, current value, new value, risk level
- **FR31:** Users shall review and approve/reject individual actions or approve all
- **FR32:** High-risk actions shall require explicit confirmation with impact warning
- **FR33:** The system shall enforce guardrails: budget changes >50% require confirmation
- **FR34:** The system shall enforce guardrails: cannot pause all campaigns simultaneously
- **FR35:** Users shall undo executed actions within 24 hours (where API supports)
- **FR36:** All actions shall be logged with timestamp, user, before/after values

**AI Chat Interface**
- **FR37:** AI chat shall be accessible via collapsible side panel
- **FR38:** Users shall ask natural language questions about their account(s)
- **FR39:** AI responses shall stream in real-time
- **FR40:** AI shall reference actual account data in responses
- **FR41:** AI can suggest actions that populate the Action Queue
- **FR42:** Chat history shall persist during session
- **FR43:** Users shall clear chat history

**Campaign Management (All Types)**
- **FR44:** Users shall view all campaigns in Smart Grid with type indicator
- **FR45:** Users shall filter campaigns by type (Search, PMax, Shopping, etc.)
- **FR46:** Users shall pause/enable campaigns with one click
- **FR47:** Users shall adjust campaign budgets via inline edit or modal
- **FR48:** Users shall adjust bidding strategy targets (CPA, ROAS) where applicable

**Search Campaign Specific**
- **FR49:** Users shall view keywords with QS, match type, status, and metrics
- **FR50:** Users shall pause/enable keywords
- **FR51:** Users shall adjust keyword bids
- **FR52:** Users shall view search terms report with recommendations
- **FR53:** Users shall add negative keywords from recommendations
- **FR54:** Users shall view RSAs with asset-level performance

**Ad Regeneration Workflow**
- **FR55:** For underperforming ads, AI shall offer "Regenerate" option
- **FR56:** AI shall generate new ad copy variants based on top performers
- **FR57:** Generated ads shall be previewed before adding to Action Queue
- **FR58:** Users shall edit AI-generated copy before submission

**Reporting & Insights**
- **FR59:** System shall generate Wasted Spend analysis identifying budget leaks
- **FR60:** System shall provide device performance breakdown
- **FR61:** System shall provide day-of-week and hour-of-day performance heatmaps
- **FR62:** Users shall export grid data to CSV
- **FR63:** Users shall generate PDF reports (Phase 2)

**Audit Trail & Rollback**
- **FR64:** All changes shall be logged in Activity Log with full details
- **FR65:** Activity Log shall show: timestamp, user, action, entity, before/after values
- **FR66:** Users shall filter Activity Log by date, action type, entity
- **FR67:** Users shall rollback changes where Google Ads API supports

### 4.2 Non-Functional Requirements

**Performance**
- **NFR1:** Smart Grid shall load within 3 seconds on standard broadband
- **NFR2:** AI chat responses shall begin streaming within 2 seconds
- **NFR3:** Account switching shall complete within 1 second
- **NFR4:** System shall handle accounts with up to 500 campaigns and 10,000 keywords
- **NFR5:** Virtual scrolling shall maintain 60fps for grids with 1000+ rows

**Security**
- **NFR6:** All data transmission shall use HTTPS/TLS 1.3
- **NFR7:** OAuth tokens shall be encrypted at rest (AES-256)
- **NFR8:** API keys shall never be exposed to client-side code
- **NFR9:** JWT tokens shall expire after 24 hours with refresh capability
- **NFR10:** Rate limiting: 100 requests/minute per user
- **NFR11:** Action Queue provides defense-in-depth against accidental changes

**Reliability**
- **NFR12:** System shall have 99.5% uptime excluding scheduled maintenance
- **NFR13:** System shall gracefully handle Google Ads API rate limits (15K ops/day)
- **NFR14:** Failed API calls shall retry with exponential backoff
- **NFR15:** System shall queue actions during API outages and retry when available

**Usability**
- **NFR16:** UI shall be responsive from 320px to 4K displays
- **NFR17:** UI shall follow WCAG 2.1 AA accessibility guidelines
- **NFR18:** Error messages shall be user-friendly with suggested actions
- **NFR19:** Keyboard navigation shall be fully supported in Smart Grid

**Data Freshness**
- **NFR20:** Campaign data shall be no more than 4 hours stale
- **NFR21:** Users shall manually trigger data refresh
- **NFR22:** Last sync timestamp shall be visible in UI
- **NFR23:** Critical metrics (spend, conversions) shall update more frequently (1 hour)

**Scalability**
- **NFR24:** Architecture shall support 10,000+ users
- **NFR25:** Database queries shall use proper indexing for sub-100ms response
- **NFR26:** Caching layer shall reduce Google Ads API calls by 80%

**Compliance**
- **NFR27:** System shall comply with Google Ads API Terms of Service
- **NFR28:** User data handling shall comply with GDPR requirements
- **NFR29:** System shall provide data export for user portability

---

## 5. User Interface Design Goals

### 5.1 Overall UX Vision

A powerful, data-first interface that lets users make business decisions in 30 seconds. The primary experience is a Smart Grid — think Airtable meets Google Ads. Users see their data, spot issues via AI scores, and take action without leaving the grid.

**Design Principles:**
1. **Data-first, not dashboard-first** — users came for their data, show it immediately
2. **30-second decisions** — surface the most important info; hide complexity until needed
3. **Safety by design** — Action Queue prevents accidents; guardrails enforce best practices
4. **Simple by default, powerful when needed** — Simple Mode for SMBs, Pro Mode for agencies

### 5.2 Key Interaction Paradigms

- **Smart Grid as home base:** All navigation starts and returns to the grid
- **Inline actions:** Edit budgets, pause entities without modal interruption
- **Bulk operations:** Select many, act once
- **Action Queue staging:** Write operations are staged, reviewed, then executed
- **AI as advisor:** Chat suggests, user decides and executes
- **Saved Views:** Power users create custom views; new users get pre-built views

### 5.3 Core Screens and Views

1. **Smart Grid (Primary)** — Campaign/Entity grid with filters, sorts, AI scores, actions
2. **Entity Detail Panel** — Slide-out panel showing full details when row is clicked
3. **AI Chat Panel** — Collapsible side panel for natural language interaction
4. **Action Queue** — Drawer showing pending actions awaiting approval
5. **Activity Log** — Full history of changes with rollback options
6. **Account Switcher** — Dropdown in header for multi-account navigation
7. **Settings** — Connected accounts, mode preference, notifications, data export
8. **Onboarding** — OAuth flow, first account connection, guided tour

### 5.4 Pre-Built Views (Default)

| View Name | Description | Filter Logic |
|-----------|-------------|--------------|
| **All Campaigns** | Default view, all campaigns | No filter |
| **Needs Attention** | Low AI Score | AI Score < 50 |
| **Wasted Spend** | High spend, low conversions | Spend > $100 AND Conversions = 0 |
| **Top Performers** | High AI Score, good metrics | AI Score > 80 |
| **Paused** | Paused campaigns | Status = Paused |
| **Search Campaigns** | Only Search type | Type = Search |
| **PMax Campaigns** | Only PMax type | Type = Performance Max |

### 5.5 Accessibility

**WCAG 2.1 AA Compliance:**
- Color contrast ratios 4.5:1 minimum
- Full keyboard navigation (Tab, Enter, Arrow keys in grid)
- Screen reader support with proper ARIA labels
- Focus indicators clearly visible
- No information conveyed by color alone (icons + color)

### 5.6 Target Platforms

- **Desktop-first** (primary use case for data work)
- **Tablet landscape** (functional, simplified grid)
- **Mobile** (read-only summary, basic actions)
- **Browsers:** Chrome, Firefox, Safari, Edge (latest 2 versions)

---

## 6. Technical Assumptions

### 6.1 Repository Structure

**Monorepo**
- Single repository with frontend and backend
- Shared TypeScript types
- Unified CI/CD pipeline

### 6.2 Service Architecture

**Next.js Full-Stack Application**
- Next.js 14+ with App Router
- Server Components for data fetching
- API routes for backend logic
- Server-Sent Events for AI streaming

### 6.3 Technology Stack

**Frontend:**
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- TanStack Table (data grid)
- TanStack Query (data fetching/caching)
- Zustand (state management)

**Backend:**
- Next.js API Routes
- Prisma ORM
- NextAuth.js (authentication)

**Database:**
- PostgreSQL 16 (users, accounts, settings, activity logs, cached data)
- Redis 7 (caching, rate limiting, Action Queue)

**External APIs:**
- Google Ads API (all campaign types)
- Anthropic Claude API (AI chat and analysis)

**Infrastructure:**
- Docker + Docker Compose (local development)
- Self-hosted deployment (personal server)
- Nginx (reverse proxy, SSL termination)
- Let's Encrypt (SSL certificates)

### 6.4 Data Caching Strategy

Given Google Ads API rate limits (15K ops/day), aggressive caching is required:

| Data Type | Cache Duration | Refresh Trigger |
|-----------|---------------|-----------------|
| Campaign list | 1 hour | Manual refresh, write action |
| Campaign metrics | 4 hours | Manual refresh |
| Keywords/Ads | 4 hours | Manual refresh, drill-down |
| Search terms | 24 hours | Manual refresh |
| Account structure | 24 hours | Manual refresh |

### 6.5 Testing Requirements

- Jest for unit tests (70%+ coverage on business logic)
- React Testing Library for components
- Playwright for E2E (critical paths)
- API route testing

---

## 7. Epic List

### Epic 1: Foundation & Multi-Account Auth
**Goal:** Project setup, deployment, OAuth flow supporting multiple Google Ads accounts with account switcher.

### Epic 2: Smart Grid Core
**Goal:** Build the Airtable-style data grid with campaigns, filtering, sorting, saved views, and drill-down navigation.

### Epic 3: AI Score & Recommendations Engine
**Goal:** Calculate AI health scores for entities, generate recommendations, display in grid and detail panels.

### Epic 4: Action Queue & Safety Model
**Goal:** Implement staged write operations with review flow, guardrails, and execution with audit logging.

### Epic 5: AI Chat Integration
**Goal:** Add collapsible AI chat panel with streaming responses, account context, and action suggestions.

### Epic 6: Campaign Type Support
**Goal:** Ensure all campaign types (Search, PMax, Shopping, Display, Video, Demand Gen, App) are properly displayed and managed per Capability Matrix.

### Epic 7: Polish & Launch Readiness
**Goal:** Simple/Pro mode toggle, activity log with rollback, error handling, mobile responsiveness, performance optimization.

---

## 8. Epic Details

### Epic 1: Foundation & Multi-Account Auth

**Goal:** Establish project infrastructure with Next.js and Docker-based local development, implement Google Ads OAuth supporting multiple accounts, and create the account switcher.

---

#### Story 1.1: Project Setup and Local Development Environment

**As a** developer,
**I want** the Next.js project scaffolded with Docker-based local development,
**so that** I have a working foundation.

**Acceptance Criteria:**
1. Next.js 14+ with App Router and TypeScript
2. Tailwind CSS configured
3. ESLint and Prettier configured
4. Docker Compose configured with PostgreSQL and Redis containers
5. Local development server running at localhost:3000
6. Homepage displays placeholder

---

#### Story 1.2: Database Schema with Multi-Account Support

**As a** developer,
**I want** PostgreSQL configured with Prisma supporting multiple accounts per user,
**so that** users can connect many Google Ads accounts.

**Acceptance Criteria:**
1. Prisma configured with PostgreSQL
2. Schema includes: User, GoogleAdsAccount (many-to-one), OAuthToken, ActivityLog
3. Migrations working
4. User can have 1-50 GoogleAdsAccounts

---

#### Story 1.3: Google OAuth with Multi-Account Connection

**As a** user,
**I want** to connect multiple Google Ads accounts via OAuth,
**so that** I can manage all my advertising in one place.

**Acceptance Criteria:**
1. NextAuth.js with Google OAuth provider
2. OAuth requests Google Ads API scopes
3. "Add Account" button initiates OAuth for additional accounts
4. Each connected account stored with tokens
5. Tokens auto-refresh when expired
6. User can disconnect individual accounts

---

#### Story 1.4: Account Switcher Component

**As a** user,
**I want** to switch between my connected accounts instantly,
**so that** I can manage multiple businesses efficiently.

**Acceptance Criteria:**
1. Account switcher dropdown in header
2. Shows all connected accounts with name and ID
3. Current account highlighted
4. Switching accounts loads that account's data
5. "Add Account" option at bottom of dropdown
6. Account health indicator (color dot) next to each account

---

#### Story 1.5: Basic App Shell and Navigation

**As a** user,
**I want** a consistent navigation layout,
**so that** I can easily access different features.

**Acceptance Criteria:**
1. Header with logo, account switcher, mode toggle, user menu
2. Main content area for Smart Grid
3. Collapsible AI chat panel (placeholder)
4. Action Queue drawer (placeholder)
5. Mobile-responsive hamburger menu

---

### Epic 2: Smart Grid Core

**Goal:** Build the primary Airtable-style data grid with campaigns, filtering, sorting, saved views, and drill-down.

---

#### Story 2.1: Campaign Smart Grid

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

#### Story 2.2: Grid Filtering

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

#### Story 2.3: Saved Views

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

#### Story 2.4: Row Selection and Bulk Actions

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

#### Story 2.5: Drill-Down Navigation

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

#### Story 2.6: Entity Detail Panel

**As a** user,
**I want** to see full details of an entity without leaving the grid,
**so that** I can get more info quickly.

**Acceptance Criteria:**
1. Right-click or expand icon opens slide-out panel
2. Panel shows all metrics, settings, and AI recommendations
3. Panel has action buttons (Pause, Edit Budget, etc.)
4. Changes from panel go to Action Queue
5. Panel can be pinned open or closed

---

### Epic 3: AI Score & Recommendations Engine

**Goal:** Calculate AI health scores, generate recommendations, and display them in the grid.

---

#### Story 3.1: AI Score Calculation

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

#### Story 3.2: Recommendation Generation

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

#### Story 3.3: Recommendations in Grid

**As a** user,
**I want** to see top recommendation in the grid,
**so that** I can act without drilling down.

**Acceptance Criteria:**
1. "Top Issue" column shows primary recommendation summary
2. "Fix" button in column adds action to Action Queue
3. Hovering shows full recommendation text
4. Pro Mode shows all recommendations in expandable row

---

#### Story 3.4: Wasted Spend View

**As a** user,
**I want** a dedicated view showing wasted spend,
**so that** I can stop losing money.

**Acceptance Criteria:**
1. "Wasted Spend" saved view pre-configured
2. Shows entities with Spend > $100 and Conversions = 0
3. Sorted by Spend descending
4. Total wasted spend shown in header
5. Bulk "Pause All Wasted" action available

---

### Epic 4: Action Queue & Safety Model

**Goal:** Implement staged write operations with review, guardrails, and audit logging.

---

#### Story 4.1: Action Queue UI

**As a** user,
**I want** all my changes staged in a queue before execution,
**so that** I can review before committing.

**Acceptance Criteria:**
1. Action Queue drawer accessible from header (badge shows count)
2. Queue lists pending actions: Entity, Action, Current → New, Risk Level
3. Each action has Approve/Reject buttons
4. "Approve All" and "Clear All" buttons
5. Risk levels: Low (green), Medium (yellow), High (red)

---

#### Story 4.2: Action Staging

**As a** user,
**I want** my actions (pause, budget change) to go to queue instead of immediate execution,
**so that** I don't make accidental changes.

**Acceptance Criteria:**
1. Pause/Enable actions add to queue (not immediate)
2. Budget changes add to queue with before/after values
3. Bulk actions add multiple items to queue
4. Toast notification: "Action added to queue (3 pending)"
5. Option to execute immediately for low-risk actions (setting)

---

#### Story 4.3: Guardrails

**As a** user,
**I want** the system to warn me about risky changes,
**so that** I don't accidentally hurt my account.

**Acceptance Criteria:**
1. Budget change >50% flagged as High Risk
2. Cannot pause ALL active campaigns (error message)
3. Cannot set budget to $0 (must pause instead)
4. Pausing top-performing campaign (AI Score >80) shows warning
5. Guardrails configurable in Settings (advanced users can disable)

---

#### Story 4.4: Action Execution

**As a** user,
**I want** to execute approved actions against Google Ads,
**so that** my changes take effect.

**Acceptance Criteria:**
1. "Execute" button processes approved actions
2. Progress indicator during execution
3. Success/failure status per action
4. Failed actions can be retried
5. Grid refreshes after execution completes

---

#### Story 4.5: Audit Logging

**As a** user,
**I want** all changes logged with full details,
**so that** I have a history of what happened.

**Acceptance Criteria:**
1. Every executed action logged to database
2. Log includes: timestamp, user, action, entity, before/after, success/fail
3. Activity Log page shows chronological history
4. Filter by date, action type, entity
5. Export log to CSV

---

#### Story 4.6: Rollback Capability

**As a** user,
**I want** to undo a recent change,
**so that** I can recover from mistakes.

**Acceptance Criteria:**
1. "Undo" button on recently executed actions (within 24h)
2. Undo adds reverse action to queue
3. Not all actions are reversible (noted in UI)
4. Rollback logged as separate action

---

### Epic 5: AI Chat Integration

**Goal:** Add collapsible AI chat panel with streaming responses and action suggestions.

---

#### Story 5.1: Chat Panel UI

**As a** user,
**I want** an AI chat panel to ask questions,
**so that** I can get insights naturally.

**Acceptance Criteria:**
1. Collapsible panel on right side of screen
2. Text input at bottom
3. Chat history displayed as bubbles (user/AI)
4. Expand/collapse toggle in header
5. Clear history button

---

#### Story 5.2: Streaming AI Responses

**As a** user,
**I want** AI responses to stream in real-time,
**so that** I don't wait for full response.

**Acceptance Criteria:**
1. Responses stream token-by-token via SSE
2. Typing indicator while generating
3. Smooth auto-scroll as content appears
4. Stop button to cancel long responses
5. Retry button on failures

---

#### Story 5.3: Account Context in Chat

**As a** user,
**I want** the AI to know my account data,
**so that** responses are specific to me.

**Acceptance Criteria:**
1. AI receives current account summary as context
2. AI can reference specific campaigns by name
3. AI responses include actual numbers from data
4. Context refreshes when account data updates

---

#### Story 5.4: Action Suggestions from Chat

**As a** user,
**I want** the AI to suggest actions I can execute,
**so that** recommendations are actionable.

**Acceptance Criteria:**
1. AI responses can include action buttons
2. Clicking button adds action to Action Queue
3. Actions clearly labeled: "Pause Campaign X"
4. Multiple actions can be suggested in one response
5. Actions have context from the conversation

---

### Epic 6: Campaign Type Support

**Goal:** Ensure all campaign types are properly displayed and managed per Capability Matrix.

---

#### Story 6.1: Campaign Type Indicators

**As a** user,
**I want** to see what type each campaign is,
**so that** I know what capabilities apply.

**Acceptance Criteria:**
1. Type column shows: Search, PMax, Shopping, Display, Video, Demand Gen, App
2. Type icons for quick recognition
3. Filter by type works correctly
4. Type-specific columns show when drilling down

---

#### Story 6.2: Search Campaign Deep Support

**As a** user managing Search campaigns,
**I want** full keyword and ad management,
**so that** I can optimize search advertising.

**Acceptance Criteria:**
1. Keyword grid with: Keyword, Match Type, Status, QS, Clicks, Conv, CPA
2. Pause/Enable keywords
3. Adjust keyword bids
4. Search terms report with negative keyword recommendations
5. RSA grid with asset-level performance

---

#### Story 6.3: PMax Campaign Support

**As a** user managing PMax campaigns,
**I want** to see and adjust what I can,
**so that** I optimize within PMax constraints.

**Acceptance Criteria:**
1. Campaign-level metrics displayed
2. Asset group performance visible
3. Asset performance labels (Best/Good/Low)
4. Pause/Enable, budget, and target adjustments work
5. UI clearly indicates PMax limitations

---

#### Story 6.4: Shopping Campaign Support

**As a** user managing Shopping campaigns,
**I want** product-level performance visibility,
**so that** I can optimize my product ads.

**Acceptance Criteria:**
1. Product group hierarchy visible
2. Product-level metrics (if available)
3. Pause/Enable, budget adjustments work
4. Product group bid adjustments work

---

#### Story 6.5: Display/Video/Demand Gen/App Support

**As a** user managing other campaign types,
**I want** appropriate visibility and actions,
**so that** all my campaigns are manageable.

**Acceptance Criteria:**
1. All campaign types display in grid with metrics
2. Pause/Enable and budget changes work for all types
3. Type-specific metrics shown where applicable
4. Limitations clearly indicated per type

---

### Epic 7: Polish & Launch Readiness

**Goal:** Simple/Pro mode, activity log, error handling, mobile, performance.

---

#### Story 7.1: Simple Mode vs Pro Mode Toggle

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

#### Story 7.2: Activity Log Page

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

#### Story 7.3: Error Handling

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

#### Story 7.4: Mobile Responsive

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

#### Story 7.5: Performance Optimization

**As a** user,
**I want** the app to feel fast,
**so that** I have a good experience.

**Acceptance Criteria:**
1. Grid virtualization for 1000+ rows
2. Data caching with stale-while-revalidate
3. Skeleton loaders during fetch
4. Optimistic UI updates for actions
5. LCP < 2.5 seconds

---

## 9. Monetization Alignment

### 9.1 Freemium Model (Recommended)

| Tier | Accounts | Features | Price |
|------|----------|----------|-------|
| **Free** | 1 | Read-only, basic AI chat, no actions | $0 |
| **Starter** | 3 | Full features, 100 actions/month | $29/mo |
| **Pro** | 10 | Full features, unlimited actions, priority support | $79/mo |
| **Agency** | 50 | Full features, white-label, API access | $199/mo |

### 9.2 Usage-Based Considerations

- Action Queue executions could be metered
- AI chat tokens could have soft limits
- Data refresh frequency could vary by tier

---

## 10. Checklist Results Report

*To be completed after PRD review*

- [ ] All functional requirements map to at least one user story
- [ ] All non-functional requirements addressed in stories or architecture
- [ ] Epic dependencies are logical and sequential
- [ ] Stories are sized appropriately for AI agent execution (2-4 hours)
- [ ] Acceptance criteria are testable and unambiguous
- [ ] Capability Matrix covers all campaign types
- [ ] Safety model (Action Queue + Guardrails) is comprehensive
- [ ] Multi-account architecture is Day 1 ready

---

## 11. Next Steps

### 11.1 UX Expert Prompt

> Review the PRD for AI-Powered Google Ads Manager v2.0. Create a front-end specification document with:
> 1. Wireframes for Smart Grid interface (campaigns, drill-down, filters)
> 2. Action Queue drawer design with approval flow
> 3. AI Chat panel integration with grid
> 4. Simple Mode vs Pro Mode visual differences
> 5. Account Switcher and multi-account UX
> 6. Mobile responsive card view
> 7. Component library recommendations (TanStack Table, etc.)

### 11.2 Architect Prompt

> Review the PRD for AI-Powered Google Ads Manager v2.0. Create a technical architecture document covering:
> 1. Multi-account data model and OAuth token management
> 2. Smart Grid data fetching with TanStack Table + TanStack Query
> 3. Action Queue implementation (Redis-backed with persistence)
> 4. Google Ads API integration for ALL campaign types
> 5. Caching strategy to stay within API rate limits
> 6. AI Score calculation service
> 7. Claude AI integration with account context injection
> 8. Audit logging schema and queries

---

*Generated by BMad Method - Product Manager Agent (v2.0 - Smart Grid Architecture)*
