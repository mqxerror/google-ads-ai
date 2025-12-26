# Epic 1: Foundation & Multi-Account Auth

**Goal:** Establish project infrastructure with Next.js and Docker-based local development, implement Google Ads OAuth supporting multiple accounts, and create the account switcher.

---

## Story 1.1: Project Setup and Local Development Environment

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

## Story 1.2: Database Schema with Multi-Account Support

**As a** developer,
**I want** PostgreSQL configured with Prisma supporting multiple accounts per user,
**so that** users can connect many Google Ads accounts.

**Acceptance Criteria:**
1. Prisma configured with PostgreSQL
2. Schema includes: User, GoogleAdsAccount (many-to-one), OAuthToken, ActivityLog
3. Migrations working
4. User can have 1-50 GoogleAdsAccounts

---

## Story 1.3: Google OAuth with Multi-Account Connection

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

## Story 1.4: Account Switcher Component

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

## Story 1.5: Basic App Shell and Navigation

**As a** user,
**I want** a consistent navigation layout,
**so that** I can easily access different features.

**Acceptance Criteria:**
1. Header with logo, account switcher, mode toggle, user menu
2. Main content area for Smart Grid
3. Collapsible AI chat panel (placeholder)
4. Action Queue drawer (placeholder)
5. Mobile-responsive hamburger menu
