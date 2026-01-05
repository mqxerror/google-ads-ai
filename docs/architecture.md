# AI-Powered Google Ads Manager — Fullstack Architecture Document

This document outlines the complete fullstack architecture for the AI-Powered Google Ads Manager, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

---

## 1. Introduction

### 1.1 Starter Template

**N/A - Greenfield project**

This is a greenfield Next.js 14 application. We will use the official `create-next-app` with App Router as the foundation, customized with our specific tech stack choices.

### 1.2 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2024-12-14 | 1.0 | Initial Fullstack Architecture Document | Architect Agent |
| 2024-12-14 | 1.1 | Updated for self-hosted deployment (Docker + personal server) | Architect Agent |
| 2026-01-04 | 1.2 | Added Google Ads API integration architecture - REST API solution for PMax/Display/Demand Gen campaigns with Sharp image processing | Claude |

---

## 2. High Level Architecture

### 2.1 Technical Summary

The AI-Powered Google Ads Manager is a **Next.js 14 fullstack application** designed for **local development first** and **self-hosted deployment** on a personal server. The application uses **Docker Compose** for local development with **PostgreSQL** and **Redis** containers, and deploys to a personal server using **Docker** with **Nginx** as a reverse proxy.

The frontend implements an **Airtable-style Smart Grid** using TanStack Table with TanStack Query for data fetching and caching. The backend integrates with the **Google Ads API** for campaign data and actions, and the **Anthropic Claude API** for AI-powered analysis and chat. All write operations flow through a **Redis-backed Action Queue** with staged approval before execution.

This architecture achieves PRD goals by enabling full local development without cloud dependencies, maintaining sub-3-second page loads through aggressive caching, and staying within Google Ads API rate limits (15K ops/day) through intelligent data caching.

### 2.2 Platform and Infrastructure Choice

**Platform:** Self-Hosted (Docker + Personal Server)

**Development Stack:**
- Docker Compose (local development orchestration)
- PostgreSQL 16 (containerized database)
- Redis 7 (containerized cache and queue)
- Node.js 20 LTS (runtime)

**Production Stack:**
- Docker (containerized deployment)
- Nginx (reverse proxy, SSL termination)
- PostgreSQL 16 (can be containerized or native)
- Redis 7 (containerized)
- Let's Encrypt / Certbot (SSL certificates)
- PM2 or Docker (process management)

**Rationale:**
| Option | Pros | Cons |
|--------|------|------|
| **Self-Hosted Docker** | Full control, no vendor lock-in, cost-effective, works offline | More setup, manual SSL, manual scaling |
| **Vercel** | Easy deployment, auto-scaling, built-in CDN | Vendor lock-in, costs at scale, requires internet |
| **AWS/GCP** | Enterprise features, global scale | Complex, expensive, overkill for personal use |

**Decision:** Self-hosted with Docker chosen for full control, offline development capability, cost-effectiveness, and deployment to personal server.

### 2.3 Repository Structure

**Structure:** Monorepo (Single Repository)

**Monorepo Tool:** npm workspaces (simple, built-in, sufficient for this scale)

**Package Organization:**
- Single Next.js app containing both frontend and backend
- Shared types in `/src/types`
- Docker configuration in `/docker`
- No separate packages needed for MVP

**Rationale:** For a Next.js fullstack app of this size, a simple monorepo without additional tooling (Turborepo, Nx) reduces complexity.

### 2.4 High Level Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end

    subgraph "Reverse Proxy"
        Nginx[Nginx<br/>SSL Termination<br/>Load Balancing]
    end

    subgraph "Application Layer (Docker)"
        NextApp[Next.js 14 App<br/>Node.js Container]

        subgraph "Frontend"
            RSC[React Server Components]
            RCC[React Client Components]
            SmartGrid[Smart Grid UI]
            ChatPanel[AI Chat Panel]
        end

        subgraph "Backend (API Routes)"
            AuthAPI[/api/auth/*<br/>NextAuth.js]
            CampaignAPI[/api/campaigns/*]
            ActionsAPI[/api/actions/*]
            ChatAPI[/api/chat<br/>Streaming SSE]
        end
    end

    subgraph "Data Layer (Docker)"
        Postgres[(PostgreSQL 16<br/>Users, Accounts,<br/>Activity Logs)]
        Redis[(Redis 7<br/>Cache, Action Queue,<br/>Rate Limits)]
    end

    subgraph "External APIs"
        GoogleAds[Google Ads API<br/>Campaign Data & Actions]
        Claude[Anthropic Claude API<br/>AI Analysis & Chat]
        GoogleOAuth[Google OAuth 2.0<br/>Authentication]
    end

    Browser --> Nginx
    Mobile --> Nginx
    Nginx --> NextApp

    NextApp --> RSC
    NextApp --> RCC
    RSC --> SmartGrid
    RCC --> ChatPanel

    NextApp --> AuthAPI
    NextApp --> CampaignAPI
    NextApp --> ActionsAPI
    NextApp --> ChatAPI

    AuthAPI --> Postgres
    AuthAPI --> GoogleOAuth
    CampaignAPI --> Redis
    CampaignAPI --> GoogleAds
    ActionsAPI --> Redis
    ActionsAPI --> Postgres
    ActionsAPI --> GoogleAds
    ChatAPI --> Claude
    ChatAPI --> Redis
```

### 2.5 Architectural Patterns

- **Next.js App Router Architecture:** File-based routing with nested layouts, Server Components by default, Client Components for interactivity - _Rationale:_ Modern React patterns with optimal performance and SEO

- **Container-Based Architecture:** All services run in Docker containers for consistency between dev and prod - _Rationale:_ Reproducible environments, easy deployment, isolation

- **Repository Pattern:** Abstract data access through service classes - _Rationale:_ Enables testing, caching layer insertion, and future database flexibility

- **Cache-Aside Pattern:** Check cache first, fetch from API if miss, populate cache - _Rationale:_ Essential for staying within Google Ads API rate limits

- **Action Queue Pattern:** Stage all write operations in Redis queue before execution - _Rationale:_ Safety model requirement, enables review and rollback

- **Server-Sent Events (SSE):** Stream AI responses from Claude API - _Rationale:_ Better UX than polling, simpler than WebSockets for unidirectional streaming

- **Optimistic UI Updates:** Update UI immediately, sync with server async - _Rationale:_ Perceived performance improvement for user actions

---

## 3. Tech Stack

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.3+ | Type-safe JavaScript | Industry standard, catches errors at compile time |
| Frontend Framework | Next.js | 14.x | React framework with App Router | Best-in-class DX, SSR/SSG, API routes |
| UI Component Library | shadcn/ui | latest | Accessible component primitives | Unstyled, customizable, copy-paste ownership |
| CSS Framework | Tailwind CSS | 3.4+ | Utility-first styling | Rapid development, consistent design system |
| State Management | Zustand | 4.x | Lightweight global state | Simple API, no boilerplate, TypeScript support |
| Data Fetching | TanStack Query | 5.x | Server state management | Caching, background refresh, optimistic updates |
| Data Grid | TanStack Table | 8.x | Headless table logic | Full control over UI, sorting, filtering, pagination |
| Backend Language | TypeScript | 5.3+ | Type-safe JavaScript | Shared types with frontend |
| Backend Framework | Next.js API Routes | 14.x | API endpoints | Integrated with frontend, single deployment |
| API Style | REST | N/A | RESTful API | Familiar patterns, easy to debug |
| Database | PostgreSQL | 16 | Relational database | ACID compliance, JSON support, mature ecosystem |
| ORM | Prisma | 5.x | Database toolkit | Type-safe queries, migrations, excellent DX |
| Cache/Queue | Redis | 7.x | Caching and Action Queue | Fast, reliable, pub/sub support |
| Authentication | NextAuth.js | 5.x (beta) | Auth framework | Google OAuth support, session management |
| Containerization | Docker | 24.x | Container runtime | Consistent environments, easy deployment |
| Orchestration (Dev) | Docker Compose | 2.x | Local development | Multi-container orchestration |
| Reverse Proxy | Nginx | 1.25+ | Production proxy | SSL, load balancing, static files |
| Process Manager | PM2 | 5.x | Production process management | Auto-restart, clustering, logs |
| Frontend Testing | Vitest | 1.x | Unit testing | Fast, Vite-native, Jest-compatible API |
| Component Testing | React Testing Library | 14.x | Component testing | Best practices for React testing |
| Backend Testing | Vitest | 1.x | API route testing | Consistent with frontend testing |
| E2E Testing | Playwright | 1.x | End-to-end testing | Cross-browser, reliable, fast |
| Build Tool | Next.js | 14.x | Build and bundling | Integrated build system |
| CI/CD | GitHub Actions | N/A | Automation | Free, flexible, Docker support |
| Monitoring | Prometheus + Grafana | latest | Metrics and dashboards | Self-hosted, powerful |
| Logging | Pino | 8.x | Structured logging | Fast, JSON output |
| Icons | Lucide React | latest | Icon library | Consistent with shadcn/ui |
| Charts | Recharts | 2.x | Data visualization | React-native, composable |
| Animations | Framer Motion | 11.x | UI animations | Declarative, performant |

---

## 4. Data Models

### 4.1 User

**Purpose:** Represents an authenticated user of the application

**Key Attributes:**
- `id`: string (cuid) - Unique identifier
- `email`: string - User's email address (from Google)
- `name`: string | null - Display name
- `image`: string | null - Profile image URL
- `mode`: enum ('simple' | 'pro') - UI mode preference
- `createdAt`: DateTime - Account creation timestamp
- `updatedAt`: DateTime - Last update timestamp

**TypeScript Interface:**
```typescript
interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  mode: 'simple' | 'pro';
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**
- Has many `GoogleAdsAccount` (one-to-many)
- Has many `ActivityLog` (one-to-many)

---

### 4.2 GoogleAdsAccount

**Purpose:** Represents a connected Google Ads account with OAuth tokens

**Key Attributes:**
- `id`: string (cuid) - Unique identifier
- `userId`: string - Foreign key to User
- `googleAccountId`: string - Google Ads Customer ID (format: 123-456-7890)
- `accountName`: string - Display name from Google Ads
- `accessToken`: string (encrypted) - OAuth access token
- `refreshToken`: string (encrypted) - OAuth refresh token
- `tokenExpiresAt`: DateTime - Token expiration time
- `status`: enum ('connected' | 'disconnected' | 'error') - Connection status
- `lastSyncAt`: DateTime | null - Last data sync timestamp
- `createdAt`: DateTime
- `updatedAt`: DateTime

**TypeScript Interface:**
```typescript
interface GoogleAdsAccount {
  id: string;
  userId: string;
  googleAccountId: string;
  accountName: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**
- Belongs to `User` (many-to-one)
- Has many `CachedCampaign` (one-to-many)
- Has many `ActivityLog` (one-to-many)
- Has many `PendingAction` (one-to-many)

---

### 4.3 CachedCampaign

**Purpose:** Cached campaign data from Google Ads API to reduce API calls

**Key Attributes:**
- `id`: string (cuid)
- `accountId`: string - Foreign key to GoogleAdsAccount
- `campaignId`: string - Google Ads Campaign ID
- `name`: string - Campaign name
- `status`: enum ('ENABLED' | 'PAUSED' | 'REMOVED')
- `type`: enum ('SEARCH' | 'PERFORMANCE_MAX' | 'SHOPPING' | 'DISPLAY' | 'VIDEO' | 'DEMAND_GEN' | 'APP')
- `budget`: number - Daily budget in micros
- `metrics`: JSON - Performance metrics object
- `aiScore`: number | null - Calculated AI health score (0-100)
- `recommendations`: JSON | null - AI-generated recommendations
- `cachedAt`: DateTime - When this data was cached
- `expiresAt`: DateTime - Cache expiration time

**TypeScript Interface:**
```typescript
interface CachedCampaign {
  id: string;
  accountId: string;
  campaignId: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  type: CampaignType;
  budget: number;
  metrics: CampaignMetrics;
  aiScore: number | null;
  recommendations: Recommendation[] | null;
  cachedAt: Date;
  expiresAt: Date;
}

interface CampaignMetrics {
  impressions: number;
  clicks: number;
  cost: number; // in micros
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number | null;
  qualityScore: number | null; // Search only
}

interface Recommendation {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  issue: string;
  impact: string;
  action: RecommendedAction;
}

interface RecommendedAction {
  type: 'pause' | 'enable' | 'adjust_budget' | 'add_negative' | 'adjust_bid';
  entityType: 'campaign' | 'adgroup' | 'keyword' | 'ad';
  entityId: string;
  params?: Record<string, any>;
}
```

**Relationships:**
- Belongs to `GoogleAdsAccount` (many-to-one)

---

### 4.4 PendingAction

**Purpose:** Staged write operations awaiting user approval in the Action Queue

**Key Attributes:**
- `id`: string (cuid)
- `userId`: string - Foreign key to User
- `accountId`: string - Foreign key to GoogleAdsAccount
- `actionType`: enum ('pause' | 'enable' | 'adjust_budget' | 'add_negative' | 'adjust_bid')
- `entityType`: enum ('campaign' | 'adgroup' | 'keyword' | 'ad')
- `entityId`: string - Google Ads entity ID
- `entityName`: string - Display name for UI
- `currentValue`: string - Current state (for display)
- `newValue`: string - Proposed new state
- `riskLevel`: enum ('low' | 'medium' | 'high')
- `status`: enum ('pending' | 'approved' | 'rejected' | 'executed' | 'failed')
- `source`: enum ('user' | 'ai') - Who suggested this action
- `createdAt`: DateTime
- `executedAt`: DateTime | null

**TypeScript Interface:**
```typescript
interface PendingAction {
  id: string;
  userId: string;
  accountId: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  currentValue: string;
  newValue: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  source: 'user' | 'ai';
  createdAt: Date;
  executedAt: Date | null;
}
```

**Relationships:**
- Belongs to `User` (many-to-one)
- Belongs to `GoogleAdsAccount` (many-to-one)

---

### 4.5 ActivityLog

**Purpose:** Audit trail of all actions taken through the application

**Key Attributes:**
- `id`: string (cuid)
- `userId`: string - Foreign key to User
- `accountId`: string - Foreign key to GoogleAdsAccount
- `actionType`: string - Type of action performed
- `entityType`: string - Type of entity affected
- `entityId`: string - Google Ads entity ID
- `entityName`: string - Display name
- `beforeValue`: JSON | null - State before action
- `afterValue`: JSON | null - State after action
- `status`: enum ('success' | 'failed')
- `errorMessage`: string | null - Error details if failed
- `source`: enum ('user' | 'ai' | 'system')
- `createdAt`: DateTime

**TypeScript Interface:**
```typescript
interface ActivityLog {
  id: string;
  userId: string;
  accountId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  entityName: string;
  beforeValue: Record<string, any> | null;
  afterValue: Record<string, any> | null;
  status: 'success' | 'failed';
  errorMessage: string | null;
  source: 'user' | 'ai' | 'system';
  createdAt: Date;
}
```

**Relationships:**
- Belongs to `User` (many-to-one)
- Belongs to `GoogleAdsAccount` (many-to-one)

---

### 4.6 SavedView

**Purpose:** User-saved grid filter/sort configurations

**Key Attributes:**
- `id`: string (cuid)
- `userId`: string - Foreign key to User
- `accountId`: string - Foreign key to GoogleAdsAccount
- `name`: string - View name
- `entityType`: enum ('campaign' | 'adgroup' | 'keyword' | 'ad')
- `filters`: JSON - Filter configuration
- `sorting`: JSON - Sort configuration
- `columns`: JSON - Visible columns configuration
- `isDefault`: boolean - Whether this is the default view
- `createdAt`: DateTime
- `updatedAt`: DateTime

**TypeScript Interface:**
```typescript
interface SavedView {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  entityType: EntityType;
  filters: FilterConfig[];
  sorting: SortConfig[];
  columns: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface FilterConfig {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: any;
}

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}
```

---

## 5. API Specification

### 5.1 REST API Overview

Base URL: `/api`

All API routes use the following patterns:
- Authentication via NextAuth.js session (cookie-based)
- JSON request/response bodies
- Standard HTTP status codes
- Consistent error response format

### 5.2 API Endpoints

#### Authentication

```yaml
# NextAuth.js handles these automatically
GET /api/auth/signin          # Initiate OAuth flow
GET /api/auth/callback/google # OAuth callback
GET /api/auth/session         # Get current session
POST /api/auth/signout        # Sign out
```

#### Accounts

```yaml
GET /api/accounts
  description: List all connected Google Ads accounts for current user
  response:
    200:
      body:
        accounts: GoogleAdsAccount[]

POST /api/accounts
  description: Connect a new Google Ads account (initiate OAuth)
  response:
    200:
      body:
        authUrl: string  # Google OAuth URL to redirect user

DELETE /api/accounts/{accountId}
  description: Disconnect a Google Ads account
  params:
    accountId: string
  response:
    200:
      body:
        success: boolean
```

#### Campaigns

```yaml
GET /api/accounts/{accountId}/campaigns
  description: Get campaigns for an account (cached)
  params:
    accountId: string
  query:
    type?: CampaignType  # Filter by campaign type
    status?: string      # Filter by status
    view?: string        # Saved view ID
  response:
    200:
      body:
        campaigns: CachedCampaign[]
        cachedAt: string
        expiresAt: string

GET /api/accounts/{accountId}/campaigns/{campaignId}
  description: Get single campaign details
  params:
    accountId: string
    campaignId: string
  response:
    200:
      body:
        campaign: CachedCampaign
        adGroups: CachedAdGroup[]

POST /api/accounts/{accountId}/campaigns/refresh
  description: Force refresh campaign data from Google Ads API
  params:
    accountId: string
  response:
    200:
      body:
        campaigns: CachedCampaign[]
        cachedAt: string
```

#### Ad Groups

```yaml
GET /api/accounts/{accountId}/campaigns/{campaignId}/adgroups
  description: Get ad groups for a campaign
  response:
    200:
      body:
        adGroups: CachedAdGroup[]

GET /api/accounts/{accountId}/adgroups/{adGroupId}/keywords
  description: Get keywords for an ad group
  response:
    200:
      body:
        keywords: CachedKeyword[]

GET /api/accounts/{accountId}/adgroups/{adGroupId}/ads
  description: Get ads for an ad group
  response:
    200:
      body:
        ads: CachedAd[]
```

#### Action Queue

```yaml
GET /api/actions
  description: Get pending actions for current user
  query:
    accountId?: string  # Filter by account
    status?: string     # Filter by status
  response:
    200:
      body:
        actions: PendingAction[]

POST /api/actions
  description: Add action to queue
  body:
    accountId: string
    actionType: ActionType
    entityType: EntityType
    entityId: string
    entityName: string
    currentValue: string
    newValue: string
  response:
    201:
      body:
        action: PendingAction

PATCH /api/actions/{actionId}
  description: Update action status (approve/reject)
  params:
    actionId: string
  body:
    status: 'approved' | 'rejected'
  response:
    200:
      body:
        action: PendingAction

DELETE /api/actions/{actionId}
  description: Remove action from queue
  params:
    actionId: string
  response:
    200:
      body:
        success: boolean

POST /api/actions/execute
  description: Execute approved actions
  body:
    actionIds: string[]  # Specific actions to execute, or empty for all approved
  response:
    200:
      body:
        results: ActionResult[]
```

#### AI Chat

```yaml
POST /api/chat
  description: Send message to AI assistant (streaming response)
  body:
    accountId: string
    message: string
    conversationId?: string
  response:
    200:
      content-type: text/event-stream
      body: SSE stream with AI response chunks
```

#### Activity Log

```yaml
GET /api/activity
  description: Get activity log for current user
  query:
    accountId?: string
    actionType?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  response:
    200:
      body:
        activities: ActivityLog[]
        total: number
```

#### Views

```yaml
GET /api/views
  description: Get saved views for current user
  query:
    accountId?: string
    entityType?: string
  response:
    200:
      body:
        views: SavedView[]

POST /api/views
  description: Create a new saved view
  body:
    accountId: string
    name: string
    entityType: EntityType
    filters: FilterConfig[]
    sorting: SortConfig[]
    columns: string[]
  response:
    201:
      body:
        view: SavedView

PATCH /api/views/{viewId}
  description: Update a saved view
  response:
    200:
      body:
        view: SavedView

DELETE /api/views/{viewId}
  description: Delete a saved view
  response:
    200:
      body:
        success: boolean
```

### 5.3 Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: Record<string, any>;  // Additional context
    timestamp: string;      // ISO 8601 timestamp
    requestId: string;      // For debugging/support
  };
}

// Example error codes
type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'GOOGLE_ADS_ERROR'
  | 'AI_ERROR'
  | 'INTERNAL_ERROR';
```

---

## 6. Components

### 6.1 Frontend Components

#### Smart Grid Component

**Responsibility:** Primary data display and interaction surface for campaigns, ad groups, keywords, ads

**Key Interfaces:**
- `SmartGridProps`: Configuration for columns, data source, filters
- `useGridData()`: Hook for data fetching with TanStack Query
- `useGridSelection()`: Hook for row selection state

**Dependencies:** TanStack Table, TanStack Query, Zustand (for selection state)

**Technology Stack:** React Server Components for initial data, Client Components for interactivity

---

#### AI Chat Panel Component

**Responsibility:** Natural language interface for AI-powered analysis and recommendations

**Key Interfaces:**
- `AIChatPanelProps`: Panel open state, account context
- `useChatStream()`: Hook for SSE streaming
- `ChatMessage`: Message type with embedded actions

**Dependencies:** React, Zustand (panel state), SSE client

**Technology Stack:** Client Component, Server-Sent Events for streaming

---

#### Action Queue Drawer Component

**Responsibility:** Display and manage pending actions awaiting execution

**Key Interfaces:**
- `ActionQueueDrawerProps`: Open state, onExecute callback
- `usePendingActions()`: Hook for action queue state (React Query)
- `useActionMutations()`: Hooks for approve/reject/execute

**Dependencies:** TanStack Query, Zustand (drawer state), Framer Motion

**Technology Stack:** Client Component with optimistic updates

---

#### Account Switcher Component

**Responsibility:** Multi-account navigation and connection management

**Key Interfaces:**
- `AccountSwitcherProps`: Current account, onSwitch callback
- `useAccounts()`: Hook for account list
- `useCurrentAccount()`: Hook for active account context

**Dependencies:** TanStack Query, Zustand (current account state)

**Technology Stack:** Client Component with dropdown

---

### 6.2 Backend Services

#### Google Ads Service

**Responsibility:** All interactions with Google Ads API

**Key Interfaces:**
- `getCampaigns(accountId)`: Fetch campaigns with metrics
- `getAdGroups(campaignId)`: Fetch ad groups
- `getKeywords(adGroupId)`: Fetch keywords
- `executeMutation(action)`: Execute write operation
- `refreshTokenIfNeeded(account)`: Token management

**Dependencies:** Google Ads API client, Prisma (for tokens)

**Technology Stack:** TypeScript service class, google-ads-api npm package

---

#### Cache Service

**Responsibility:** Redis-based caching for API responses

**Key Interfaces:**
- `get<T>(key)`: Get cached value
- `set(key, value, ttl)`: Set cached value with TTL
- `invalidate(pattern)`: Invalidate cache keys matching pattern
- `getCampaignsFromCache(accountId)`: High-level campaign cache

**Dependencies:** Redis client (ioredis)

**Technology Stack:** ioredis for Redis connection

---

#### Action Queue Service

**Responsibility:** Manage pending actions in Redis

**Key Interfaces:**
- `addAction(action)`: Add to queue
- `getActions(userId)`: Get user's pending actions
- `updateStatus(actionId, status)`: Update action status
- `executeActions(actionIds)`: Execute approved actions
- `calculateRiskLevel(action)`: Determine risk level

**Dependencies:** Redis, Google Ads Service, Activity Log Service

**Technology Stack:** Redis-backed queue with Prisma for persistence

---

#### AI Analysis Service

**Responsibility:** AI-powered analysis and recommendations using Claude

**Key Interfaces:**
- `calculateAIScore(campaign)`: Generate health score
- `generateRecommendations(campaign)`: Generate action recommendations
- `streamChatResponse(message, context)`: Stream AI chat response
- `buildAccountContext(accountId)`: Build context for AI

**Dependencies:** Anthropic Claude SDK, Cache Service

**Technology Stack:** @anthropic-ai/sdk with streaming

---

#### Activity Log Service

**Responsibility:** Record all actions for audit trail

**Key Interfaces:**
- `logAction(action)`: Record an action
- `getActivityLog(filters)`: Query activity history
- `exportActivityLog(accountId)`: Export to CSV

**Dependencies:** Prisma

**Technology Stack:** Prisma ORM

---

### 6.3 Google Ads API Integration Architecture

#### Problem: google-ads-api Library Limitations

The `google-ads-api` npm package has significant limitations for complex operations:

1. **Atomic Mutate Operations Fail**: The library's `mutateResources()` method doesn't properly format operations for Google Ads API v21
2. **Asset Group Creation Blocked**: PMax/Demand Gen campaigns require ALL assets + asset group + asset links in ONE atomic transaction
3. **Error Messages Misleading**: Library returns "Mutate operations must have 'create', 'update', or 'remove' specified" even with correct format

#### Solution: Direct REST API Integration

Bypassed the library for complex operations using direct REST API calls:

```typescript
// src/lib/google-ads.ts
export async function executeRestMutate(
  refreshToken: string,
  customerId: string,
  mutateOperations: any[],
  loginCustomerId?: string
): Promise<any> {
  const accessToken = await getAccessToken(refreshToken);
  const url = `https://googleads.googleapis.com/v21/customers/${customerId}/googleAds:mutate`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      'Content-Type': 'application/json',
      ...(loginCustomerId && { 'login-customer-id': loginCustomerId }),
    },
    body: JSON.stringify({ mutateOperations, partialFailure: false }),
  });

  return await response.json();
}
```

#### REST API Operation Format

The REST API uses camelCase and specific operation wrapper keys:

```typescript
// Text Asset
{ assetOperation: { create: { resourceName, textAsset: { text } } } }

// Image Asset
{ assetOperation: { create: { resourceName, type: 'IMAGE', imageAsset: { data } } } }

// Asset Group
{ assetGroupOperation: { create: { resourceName, campaign, name, finalUrls, status } } }

// Asset Group Asset Link
{ assetGroupAssetOperation: { create: { assetGroup, asset, fieldType } } }
```

#### Image Processing with Sharp

Google Ads requires strict image specifications:

| Asset Type | Aspect Ratio | Recommended Size | Max File Size |
|------------|--------------|------------------|---------------|
| Marketing Image | 1.91:1 | 1200x628 | 5MB |
| Square Marketing Image | 1:1 | 1200x1200 | 5MB |
| Logo | 1:1 | 1200x1200 | 5MB |

**Solution**: Process all images with Sharp before upload:

```typescript
// src/lib/google-ads-visual.ts
async function processImageForGoogleAds(
  imageBuffer: Buffer,
  targetType: 'MARKETING_IMAGE' | 'SQUARE_MARKETING_IMAGE' | 'LOGO'
): Promise<{ data: string; mimeType: number; size: number } | null> {
  // 1. Calculate crop dimensions for target aspect ratio
  // 2. Center-crop to correct aspect ratio
  // 3. Resize to recommended dimensions
  // 4. Compress with progressive quality reduction until < 5MB
  // 5. Return base64 encoded JPEG
}
```

#### Campaign Type Support

| Campaign Type | Implementation | Asset Handling |
|---------------|----------------|----------------|
| **PMax** | REST API atomic mutate | Asset Groups with all assets linked in one operation |
| **Display** | REST API for ads | Responsive Display Ad with headlines, descriptions, images, logos |
| **Demand Gen** | REST API atomic mutate | Asset Groups (same pattern as PMax) |
| **Search** | Library (simple) | Keywords and text ads |

#### Key Files

| File | Purpose |
|------|---------|
| `src/lib/google-ads.ts` | REST API helpers, token management |
| `src/lib/google-ads-visual.ts` | PMax, Display, Demand Gen campaign creation |
| `src/app/api/campaigns/sync/route.ts` | Campaign sync endpoint |

### 6.4 Component Diagram

```mermaid
graph TB
    subgraph "Frontend Components"
        AppShell[App Shell Layout]
        SmartGrid[Smart Grid]
        DetailPanel[Entity Detail Panel]
        ChatPanel[AI Chat Panel]
        ActionQueue[Action Queue Drawer]
        AccountSwitcher[Account Switcher]
    end

    subgraph "Frontend Hooks & State"
        QueryClient[TanStack Query Client]
        ZustandStore[Zustand Store]
        useGrid[useGridData Hook]
        useChat[useChatStream Hook]
        useActions[useActions Hook]
    end

    subgraph "API Routes"
        AuthRoutes[/api/auth/*]
        CampaignRoutes[/api/campaigns/*]
        ActionRoutes[/api/actions/*]
        ChatRoutes[/api/chat]
    end

    subgraph "Backend Services"
        GoogleAdsService[Google Ads Service]
        CacheService[Cache Service]
        ActionQueueService[Action Queue Service]
        AIService[AI Analysis Service]
        ActivityService[Activity Log Service]
    end

    subgraph "External"
        GoogleAdsAPI[Google Ads API]
        ClaudeAPI[Claude API]
        Redis[(Redis)]
        Postgres[(PostgreSQL)]
    end

    AppShell --> SmartGrid
    AppShell --> DetailPanel
    AppShell --> ChatPanel
    AppShell --> ActionQueue
    AppShell --> AccountSwitcher

    SmartGrid --> useGrid
    ChatPanel --> useChat
    ActionQueue --> useActions

    useGrid --> QueryClient
    useChat --> QueryClient
    useActions --> QueryClient
    QueryClient --> CampaignRoutes
    QueryClient --> ActionRoutes
    QueryClient --> ChatRoutes

    AccountSwitcher --> ZustandStore
    ActionQueue --> ZustandStore

    CampaignRoutes --> GoogleAdsService
    CampaignRoutes --> CacheService
    CampaignRoutes --> AIService
    ActionRoutes --> ActionQueueService
    ActionRoutes --> ActivityService
    ChatRoutes --> AIService

    GoogleAdsService --> GoogleAdsAPI
    GoogleAdsService --> Postgres
    CacheService --> Redis
    ActionQueueService --> Redis
    ActionQueueService --> GoogleAdsService
    AIService --> ClaudeAPI
    AIService --> CacheService
    ActivityService --> Postgres
```

---

## 7. External APIs

### 7.1 Google Ads API

- **Purpose:** Fetch campaign data, metrics, and execute optimizations
- **Documentation:** https://developers.google.com/google-ads/api/docs/start
- **Base URL(s):** `https://googleads.googleapis.com/v15/`
- **Authentication:** OAuth 2.0 with refresh tokens
- **Rate Limits:** 15,000 operations/day (default), 1,000 mutate operations/day

**Key Endpoints Used:**
- `GET /customers/{customerId}/googleAds:searchStream` - Query campaigns, ad groups, keywords
- `POST /customers/{customerId}/googleAds:mutate` - Update entities (pause, enable, budget)
- `GET /customers/{customerId}/googleAds:search` - Search terms report

**Integration Notes:**
- Use google-ads-api npm package for TypeScript support
- Implement aggressive caching (4-hour TTL for metrics, 24-hour for structure)
- Queue all mutations through Action Queue
- Handle rate limits with exponential backoff
- Store refresh tokens encrypted in database

---

### 7.2 Anthropic Claude API

- **Purpose:** AI-powered analysis, recommendations, and chat interface
- **Documentation:** https://docs.anthropic.com/claude/reference
- **Base URL(s):** `https://api.anthropic.com/v1/`
- **Authentication:** API key in header (`x-api-key`)
- **Rate Limits:** Varies by plan (default: 60 requests/minute)

**Key Endpoints Used:**
- `POST /messages` - Create message (with streaming)

**Integration Notes:**
- Use @anthropic-ai/sdk for TypeScript support
- Enable streaming for chat responses (SSE)
- Build rich context including account metrics
- Cache AI score calculations (1-hour TTL)
- Implement token counting for context management

---

### 7.3 Google OAuth 2.0

- **Purpose:** User authentication and Google Ads API authorization
- **Documentation:** https://developers.google.com/identity/protocols/oauth2
- **Base URL(s):** `https://oauth2.googleapis.com/`
- **Authentication:** Client credentials (client_id, client_secret)
- **Rate Limits:** N/A (standard OAuth flow)

**Key Endpoints Used:**
- `GET /authorize` - Initiate OAuth flow
- `POST /token` - Exchange code for tokens
- `POST /token` - Refresh access token

**Integration Notes:**
- Use NextAuth.js with Google provider
- Request scopes: `openid email profile https://www.googleapis.com/auth/adwords`
- Store refresh tokens securely (encrypted)
- Implement automatic token refresh

---

## 8. Core Workflows

### 8.1 User Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAuth
    participant GoogleOAuth
    participant Database

    User->>Browser: Click "Sign in with Google"
    Browser->>NextAuth: GET /api/auth/signin
    NextAuth->>GoogleOAuth: Redirect to Google OAuth
    GoogleOAuth->>User: Show consent screen
    User->>GoogleOAuth: Grant permissions
    GoogleOAuth->>NextAuth: Redirect with auth code
    NextAuth->>GoogleOAuth: Exchange code for tokens
    GoogleOAuth->>NextAuth: Return tokens
    NextAuth->>Database: Create/update user
    NextAuth->>Browser: Set session cookie
    Browser->>User: Redirect to dashboard
```

### 8.2 Campaign Data Flow

```mermaid
sequenceDiagram
    participant UI as Smart Grid
    participant Query as TanStack Query
    participant API as API Route
    participant Cache as Redis Cache
    participant Service as GoogleAds Service
    participant GoogleAds as Google Ads API

    UI->>Query: useGridData(accountId)
    Query->>API: GET /api/accounts/{id}/campaigns
    API->>Cache: Check cache

    alt Cache Hit
        Cache->>API: Return cached data
        API->>Query: Return campaigns
    else Cache Miss
        API->>Service: getCampaigns(accountId)
        Service->>GoogleAds: searchStream query
        GoogleAds->>Service: Campaign data
        Service->>API: Processed campaigns
        API->>Cache: Store in cache (4hr TTL)
        API->>Query: Return campaigns
    end

    Query->>UI: Update grid data
```

### 8.3 Action Queue Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Action Queue UI
    participant Store as Zustand Store
    participant Query as TanStack Query
    participant API as API Route
    participant Queue as Action Queue Service
    participant GoogleAds as Google Ads API
    participant Log as Activity Log

    User->>UI: Click "Fix" on recommendation
    UI->>API: POST /api/actions
    API->>Queue: addAction()
    Queue->>API: Return action with risk level
    API->>UI: Action added
    UI->>Store: Update pending count

    User->>UI: Open Action Queue drawer
    UI->>Query: usePendingActions()
    Query->>API: GET /api/actions
    API->>Queue: getActions()
    Queue->>API: Return pending actions
    API->>UI: Display actions

    User->>UI: Click "Approve" on action
    UI->>API: PATCH /api/actions/{id}
    API->>Queue: updateStatus('approved')

    User->>UI: Click "Execute"
    UI->>API: POST /api/actions/execute
    API->>Queue: executeActions()

    loop For each action
        Queue->>GoogleAds: Execute mutation
        GoogleAds->>Queue: Result
        Queue->>Log: logAction()
    end

    Queue->>API: Return results
    API->>UI: Show success/failure
    UI->>Query: Invalidate campaign cache
```

### 8.4 AI Chat Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Chat Panel
    participant API as /api/chat
    participant AI as AI Service
    participant Cache as Redis Cache
    participant Claude as Claude API

    User->>UI: Type message
    UI->>API: POST /api/chat (SSE)
    API->>Cache: Get account context
    Cache->>API: Campaign summaries
    API->>AI: streamChatResponse()
    AI->>Claude: POST /messages (stream)

    loop Stream chunks
        Claude->>AI: Text chunk
        AI->>API: Format chunk
        API->>UI: SSE event
        UI->>User: Display text
    end

    Claude->>AI: Finish reason
    AI->>API: Parse action buttons
    API->>UI: Final message with actions
    UI->>User: Show action buttons
```

---

## 9. Database Schema

### 9.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// NextAuth.js required models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  mode          UserMode  @default(SIMPLE)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts          Account[]
  sessions          Session[]
  googleAdsAccounts GoogleAdsAccount[]
  pendingActions    PendingAction[]
  activityLogs      ActivityLog[]
  savedViews        SavedView[]
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Application models
model GoogleAdsAccount {
  id              String        @id @default(cuid())
  userId          String
  googleAccountId String        // Format: 123-456-7890
  accountName     String
  accessToken     String        @db.Text
  refreshToken    String        @db.Text
  tokenExpiresAt  DateTime
  status          AccountStatus @default(CONNECTED)
  lastSyncAt      DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  cachedCampaigns CachedCampaign[]
  pendingActions  PendingAction[]
  activityLogs    ActivityLog[]
  savedViews      SavedView[]

  @@unique([userId, googleAccountId])
  @@index([userId])
  @@index([googleAccountId])
}

model CachedCampaign {
  id              String         @id @default(cuid())
  accountId       String
  campaignId      String
  name            String
  status          CampaignStatus
  type            CampaignType
  budget          BigInt         // Budget in micros
  metrics         Json           // CampaignMetrics object
  aiScore         Int?           // 0-100
  recommendations Json?          // Recommendation[] array
  cachedAt        DateTime       @default(now())
  expiresAt       DateTime

  account GoogleAdsAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, campaignId])
  @@index([accountId])
  @@index([expiresAt])
}

model PendingAction {
  id           String       @id @default(cuid())
  userId       String
  accountId    String
  actionType   ActionType
  entityType   EntityType
  entityId     String
  entityName   String
  currentValue String
  newValue     String
  riskLevel    RiskLevel
  status       ActionStatus @default(PENDING)
  source       ActionSource @default(USER)
  createdAt    DateTime     @default(now())
  executedAt   DateTime?

  user    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  account GoogleAdsAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([accountId])
  @@index([status])
}

model ActivityLog {
  id           String       @id @default(cuid())
  userId       String
  accountId    String
  actionType   String
  entityType   String
  entityId     String
  entityName   String
  beforeValue  Json?
  afterValue   Json?
  status       LogStatus
  errorMessage String?
  source       ActionSource @default(USER)
  createdAt    DateTime     @default(now())

  user    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  account GoogleAdsAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([accountId])
  @@index([createdAt])
}

model SavedView {
  id         String     @id @default(cuid())
  userId     String
  accountId  String
  name       String
  entityType EntityType
  filters    Json       // FilterConfig[]
  sorting    Json       // SortConfig[]
  columns    Json       // string[]
  isDefault  Boolean    @default(false)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  user    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  account GoogleAdsAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([accountId])
}

// Enums
enum UserMode {
  SIMPLE
  PRO
}

enum AccountStatus {
  CONNECTED
  DISCONNECTED
  ERROR
}

enum CampaignStatus {
  ENABLED
  PAUSED
  REMOVED
}

enum CampaignType {
  SEARCH
  PERFORMANCE_MAX
  SHOPPING
  DISPLAY
  VIDEO
  DEMAND_GEN
  APP
}

enum ActionType {
  PAUSE
  ENABLE
  ADJUST_BUDGET
  ADD_NEGATIVE
  ADJUST_BID
}

enum EntityType {
  CAMPAIGN
  ADGROUP
  KEYWORD
  AD
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
}

enum ActionStatus {
  PENDING
  APPROVED
  REJECTED
  EXECUTED
  FAILED
}

enum ActionSource {
  USER
  AI
  SYSTEM
}

enum LogStatus {
  SUCCESS
  FAILED
}
```

---

## 10. Frontend Architecture

### 10.1 Component Architecture

#### Component Organization

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Landing/redirect page
│   ├── (auth)/                  # Auth group
│   │   ├── login/page.tsx
│   │   └── onboarding/page.tsx
│   ├── (dashboard)/             # Dashboard group (requires auth)
│   │   ├── layout.tsx           # Dashboard layout with shell
│   │   ├── page.tsx             # Main grid (campaigns)
│   │   ├── campaigns/
│   │   │   └── [campaignId]/page.tsx
│   │   ├── activity/page.tsx
│   │   └── settings/page.tsx
│   └── api/                     # API routes
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── header.tsx
│   │   └── mobile-nav.tsx
│   ├── grid/
│   │   ├── smart-grid.tsx
│   │   ├── grid-toolbar.tsx
│   │   ├── column-defs.tsx
│   │   └── mobile-card-view.tsx
│   ├── panels/
│   │   ├── entity-detail-panel.tsx
│   │   ├── ai-chat-panel.tsx
│   │   └── action-queue-drawer.tsx
│   └── shared/
│       ├── account-switcher.tsx
│       ├── ai-score-badge.tsx
│       └── risk-badge.tsx
├── hooks/
│   ├── use-accounts.ts
│   ├── use-campaigns.ts
│   ├── use-pending-actions.ts
│   ├── use-chat-stream.ts
│   └── use-media-query.ts
├── lib/
│   ├── api-client.ts
│   ├── utils.ts
│   └── constants.ts
├── stores/
│   └── app-store.ts             # Zustand store
└── types/
    └── index.ts                 # Shared types
```

### 10.2 State Management Architecture

#### State Structure

```typescript
// stores/app-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // Current context
  currentAccountId: string | null;
  setCurrentAccount: (id: string | null) => void;

  // UI mode
  mode: 'simple' | 'pro';
  setMode: (mode: 'simple' | 'pro') => void;
  toggleMode: () => void;

  // Panel states
  detailPanelOpen: boolean;
  detailPanelEntityId: string | null;
  openDetailPanel: (entityId: string) => void;
  closeDetailPanel: () => void;

  chatPanelOpen: boolean;
  toggleChatPanel: () => void;

  actionQueueOpen: boolean;
  toggleActionQueue: () => void;

  // Grid selection
  selectedRowIds: string[];
  setSelectedRowIds: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Implementation...
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        mode: state.mode,
        currentAccountId: state.currentAccountId,
      }),
    }
  )
);
```

### 10.3 Routing Architecture

#### Route Organization

```
app/
├── layout.tsx                    # Root: Providers, fonts
├── page.tsx                      # / → Redirect to dashboard or login
├── (auth)/
│   ├── layout.tsx               # Minimal layout (no shell)
│   ├── login/
│   │   └── page.tsx             # /login
│   └── onboarding/
│       └── page.tsx             # /onboarding
├── (dashboard)/
│   ├── layout.tsx               # Dashboard shell layout
│   ├── page.tsx                 # /dashboard (campaigns grid)
│   ├── campaigns/
│   │   └── [campaignId]/
│   │       └── page.tsx         # /dashboard/campaigns/[id]
│   ├── activity/
│   │   └── page.tsx             # /dashboard/activity
│   └── settings/
│       └── page.tsx             # /dashboard/settings
└── api/
    └── ...                      # API routes
```

---

## 11. Backend Architecture

### 11.1 Service Architecture

#### API Route Organization

```
app/api/
├── auth/
│   └── [...nextauth]/
│       └── route.ts            # NextAuth.js configuration
├── accounts/
│   ├── route.ts                # GET list, POST connect
│   └── [accountId]/
│       ├── route.ts            # DELETE disconnect
│       └── campaigns/
│           ├── route.ts        # GET campaigns
│           └── refresh/
│               └── route.ts    # POST force refresh
├── actions/
│   ├── route.ts                # GET list, POST add
│   ├── [actionId]/
│   │   └── route.ts            # PATCH update, DELETE remove
│   └── execute/
│       └── route.ts            # POST execute batch
├── chat/
│   └── route.ts                # POST streaming chat
├── activity/
│   └── route.ts                # GET activity log
└── views/
    ├── route.ts                # GET list, POST create
    └── [viewId]/
        └── route.ts            # PATCH update, DELETE remove
```

### 11.2 Authentication Configuration

```typescript
// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/adwords',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'database',
  },
};
```

---

## 12. Docker Configuration

### 12.1 Development Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: gads-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-gads}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-gads_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-gads_manager}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-gads}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: gads-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Adminer (Database GUI) - Development only
  adminer:
    image: adminer:latest
    container_name: gads-adminer
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  # Redis Commander (Redis GUI) - Development only
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: gads-redis-commander
    restart: unless-stopped
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: gads-network
```

### 12.2 Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Next.js Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: gads-app
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - gads-network

  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: gads-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - gads-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: gads-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - gads-network

  # Nginx Reverse Proxy
  nginx:
    image: nginx:1.25-alpine
    container_name: gads-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot_data:/var/www/certbot:ro
    depends_on:
      - app
    networks:
      - gads-network

  # Certbot for SSL (Let's Encrypt)
  certbot:
    image: certbot/certbot:latest
    container_name: gads-certbot
    volumes:
      - ./nginx/ssl:/etc/letsencrypt
      - certbot_data:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  postgres_data:
  redis_data:
  certbot_data:

networks:
  gads-network:
    driver: bridge
```

### 12.3 Application Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 12.4 Nginx Configuration

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream nextjs {
        server app:3000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name your-domain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/live/your-domain.com/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/live/your-domain.com/privkey.pem;

        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Proxy settings
        location / {
            proxy_pass http://nextjs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # SSE support for AI chat
            proxy_buffering off;
            proxy_read_timeout 86400s;
        }

        # Static files
        location /_next/static {
            proxy_pass http://nextjs;
            proxy_cache_valid 60m;
            add_header Cache-Control "public, immutable, max-age=31536000";
        }
    }
}
```

---

## 13. Unified Project Structure

```
google-ads-manager/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint, type-check, test
│       └── deploy.yml          # Build and deploy Docker image
├── docker/
│   ├── docker-compose.yml      # Development compose
│   ├── docker-compose.prod.yml # Production compose
│   └── Dockerfile              # Application Dockerfile
├── nginx/
│   ├── nginx.conf              # Nginx configuration
│   └── ssl/                    # SSL certificates (git-ignored)
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
├── public/
│   ├── favicon.ico
│   └── images/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   └── onboarding/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── campaigns/[campaignId]/page.tsx
│   │   │   ├── activity/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── accounts/
│   │       ├── actions/
│   │       ├── chat/route.ts
│   │       ├── activity/route.ts
│   │       └── views/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/
│   │   ├── grid/
│   │   ├── panels/
│   │   └── shared/
│   ├── hooks/
│   ├── services/               # Backend services
│   │   ├── google-ads.ts
│   │   ├── cache.ts
│   │   ├── action-queue.ts
│   │   ├── ai.ts
│   │   └── activity-log.ts
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client
│   │   ├── redis.ts            # Redis client
│   │   ├── auth.ts             # NextAuth config
│   │   ├── api-client.ts       # Frontend API client
│   │   ├── api-error.ts        # Error handling
│   │   └── utils.ts
│   ├── stores/
│   │   └── app-store.ts        # Zustand store
│   └── types/
│       └── index.ts            # Shared TypeScript types
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   ├── setup-dev.sh            # Development setup script
│   ├── deploy.sh               # Production deployment script
│   └── backup-db.sh            # Database backup script
├── .env.example
├── .env.local                  # Local development (git-ignored)
├── .env.production             # Production (git-ignored)
├── .eslintrc.json
├── .prettierrc
├── components.json             # shadcn/ui config
├── middleware.ts               # Next.js middleware
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 14. Development Workflow

### 14.1 Local Development Setup

#### Prerequisites

```bash
# Required
node >= 20.0.0
npm >= 10.0.0
docker >= 24.0.0
docker-compose >= 2.0.0
git

# Accounts needed (for API access)
- Google Cloud Console project (for OAuth + Ads API)
- Anthropic account (for Claude API)
```

#### Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/google-ads-manager.git
cd google-ads-manager

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your credentials
nano .env.local

# Start Docker services (PostgreSQL, Redis)
docker-compose up -d

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

#### Development Commands

```bash
# Start Docker services (database, cache)
docker-compose up -d

# Stop Docker services
docker-compose down

# View Docker logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Start Next.js dev server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test           # Run all tests
npm run test:unit      # Unit tests only
npm run test:e2e       # E2E tests

# Database management
npx prisma studio      # Open Prisma Studio GUI
npx prisma migrate dev # Create migration
npx prisma db push     # Push schema (dev only)
npx prisma db seed     # Seed database

# Build for production
npm run build
npm run start          # Start production server locally
```

### 14.2 Environment Configuration

#### Required Environment Variables

```bash
# .env.local (development)

# Database (Docker)
DATABASE_URL="postgresql://gads:gads_dev_password@localhost:5432/gads_manager"

# Redis (Docker)
REDIS_URL="redis://localhost:6379"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-dev-secret-key-change-in-production"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN="your-developer-token"

# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-..."

# Optional: Enable debug logging
DEBUG="true"
```

```bash
# .env.production

# Database
DATABASE_URL="postgresql://user:password@postgres:5432/gads_manager"

# Redis
REDIS_URL="redis://:password@redis:6379"

# NextAuth.js
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-production-secret-key"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN="your-developer-token"

# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## 15. Deployment Architecture

### 15.1 Deployment Strategy

**Local Development:**
- Docker Compose for PostgreSQL + Redis
- Next.js dev server with hot reload
- Prisma Studio for database GUI

**Personal Server Deployment:**
- Docker containers for all services
- Nginx reverse proxy with SSL
- Let's Encrypt for certificates
- PM2 or Docker for process management

### 15.2 Deployment Steps

```bash
# 1. SSH into your server
ssh user@your-server.com

# 2. Clone the repository
git clone https://github.com/your-org/google-ads-manager.git
cd google-ads-manager

# 3. Create production environment file
cp .env.example .env.production
nano .env.production  # Edit with production values

# 4. Update nginx config with your domain
nano nginx/nginx.conf

# 5. Get SSL certificate (first time)
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d your-domain.com

# 6. Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# 7. Run database migrations
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# 8. Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 15.3 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: |
          docker build -t gads-manager:${{ github.sha }} .

      - name: Save Docker image
        run: |
          docker save gads-manager:${{ github.sha }} | gzip > image.tar.gz

      - name: Copy to server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          source: "image.tar.gz"
          target: "/tmp"

      - name: Deploy on server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/google-ads-manager
            docker load < /tmp/image.tar.gz
            docker-compose -f docker-compose.prod.yml up -d --no-deps app
            docker system prune -f
```

### 15.4 Environments

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| Development | http://localhost:3000 | Docker PostgreSQL | Local development |
| Production | https://your-domain.com | Docker PostgreSQL | Live environment |

---

## 16. Security and Performance

### 16.1 Security Requirements

**Frontend Security:**
- CSP Headers via Next.js config
- XSS Prevention via React's escaping
- HTTP-only session cookies

**Backend Security:**
- Input Validation with Zod schemas
- Rate Limiting via Redis
- CORS: Same-origin only

**Infrastructure Security:**
- SSL/TLS via Nginx + Let's Encrypt
- Docker container isolation
- Non-root container users
- Secrets in environment variables (not in code)

### 16.2 Performance Optimization

**Frontend Performance:**
- Bundle Size Target: < 200KB initial JS
- Server Components for data fetching
- Image optimization via Next.js

**Backend Performance:**
- Response Time Target: < 500ms P95
- Redis caching (4-hour TTL for campaigns)
- Database indexes on query columns

**Caching Strategy:**
| Data Type | Cache Duration | Storage |
|-----------|---------------|---------|
| Campaign list | 1 hour | Redis |
| Campaign metrics | 4 hours | Redis |
| Keywords/Ads | 4 hours | Redis |
| Search terms | 24 hours | Redis |
| AI Scores | 1 hour | Redis |

---

## 17. Testing Strategy

### 17.1 Testing Pyramid

```
          E2E Tests (5%)
         /            \
    Integration Tests (20%)
       /                \
  Frontend Unit    Backend Unit (75%)
```

### 17.2 Running Tests

```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# Integration tests (requires Docker services)
npm run test:integration

# E2E tests (requires running app)
npm run test:e2e

# Coverage report
npm run test:coverage
```

---

## 18. Coding Standards

### 18.1 Critical Rules

- **Type Sharing:** Define all shared types in `src/types/index.ts`
- **API Calls:** Use hooks from `@/hooks`, never direct fetch
- **Environment Variables:** Access via `@/lib/constants.ts`
- **Error Handling:** All API routes use `handleApiError()`
- **Database Access:** Import Prisma from `@/lib/prisma`
- **Redis Access:** Import from `@/lib/redis`
- **Authentication:** Use `requireAuth()` in API routes

### 18.2 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `SmartGrid.tsx` |
| Hooks | camelCase with 'use' | `useCampaigns.ts` |
| API Routes | kebab-case folders | `/api/ad-groups` |
| Database Tables | snake_case | `google_ads_accounts` |
| TypeScript Types | PascalCase | `CachedCampaign` |

---

## 19. Monitoring and Logging

### 19.1 Monitoring Stack (Self-Hosted)

- **Application Logs:** Pino (JSON structured logging)
- **Metrics:** Prometheus (optional)
- **Dashboards:** Grafana (optional)
- **Error Tracking:** Sentry (optional, cloud service)

### 19.2 Logging Configuration

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

### 19.3 Key Metrics to Monitor

- Request rate and response times
- Error rate by endpoint
- Database query performance
- Redis cache hit rate
- Google Ads API quota usage

---

## 20. Checklist Results Report

### Pre-Development Checklist

- [x] Tech stack finalized (self-hosted Docker)
- [x] Database schema designed
- [x] API endpoints specified
- [x] Authentication flow defined
- [x] Docker configuration created
- [x] Nginx reverse proxy configured
- [x] Development workflow documented
- [x] Deployment strategy defined
- [x] Security requirements specified
- [x] Testing strategy defined

### Alignment with PRD

- [x] Smart Grid as primary UI
- [x] Multi-account support Day 1
- [x] All campaign types supported
- [x] Action Queue with safety model
- [x] AI Chat integration
- [x] Simple/Pro mode toggle
- [x] Self-hosted deployment (no Vercel)

---

*Generated by BMad Method - Architect Agent (Winston)*
