# High Level Architecture

## Technical Summary

The AI-Powered Google Ads Manager is a **Next.js 14 fullstack application** designed for **local development first** and **self-hosted deployment** on a personal server. The application uses **Docker Compose** for local development with **PostgreSQL** and **Redis** containers, and deploys to a personal server using **Docker** with **Nginx** as a reverse proxy.

The frontend implements an **Airtable-style Smart Grid** using TanStack Table with TanStack Query for data fetching and caching. The backend integrates with the **Google Ads API** for campaign data and actions, and the **Anthropic Claude API** for AI-powered analysis and chat. All write operations flow through a **Redis-backed Action Queue** with staged approval before execution.

This architecture achieves PRD goals by enabling full local development without cloud dependencies, maintaining sub-3-second page loads through aggressive caching, and staying within Google Ads API rate limits (15K ops/day) through intelligent data caching.

## Platform and Infrastructure Choice

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

## Repository Structure

**Structure:** Monorepo (Single Repository)

**Monorepo Tool:** npm workspaces (simple, built-in, sufficient for this scale)

**Package Organization:**
- Single Next.js app containing both frontend and backend
- Shared types in `/src/types`
- Docker configuration in `/docker`
- No separate packages needed for MVP

**Rationale:** For a Next.js fullstack app of this size, a simple monorepo without additional tooling (Turborepo, Nx) reduces complexity.

## High Level Architecture Diagram

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

## Architectural Patterns

- **Next.js App Router Architecture:** File-based routing with nested layouts, Server Components by default, Client Components for interactivity - _Rationale:_ Modern React patterns with optimal performance and SEO

- **Container-Based Architecture:** All services run in Docker containers for consistency between dev and prod - _Rationale:_ Reproducible environments, easy deployment, isolation

- **Repository Pattern:** Abstract data access through service classes - _Rationale:_ Enables testing, caching layer insertion, and future database flexibility

- **Cache-Aside Pattern:** Check cache first, fetch from API if miss, populate cache - _Rationale:_ Essential for staying within Google Ads API rate limits

- **Action Queue Pattern:** Stage all write operations in Redis queue before execution - _Rationale:_ Safety model requirement, enables review and rollback

- **Server-Sent Events (SSE):** Stream AI responses from Claude API - _Rationale:_ Better UX than polling, simpler than WebSockets for unidirectional streaming

- **Optimistic UI Updates:** Update UI immediately, sync with server async - _Rationale:_ Perceived performance improvement for user actions
