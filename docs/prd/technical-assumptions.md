# Technical Assumptions

## Repository Structure

**Monorepo**
- Single repository with frontend and backend
- Shared TypeScript types
- Unified CI/CD pipeline

## Service Architecture

**Next.js Full-Stack Application**
- Next.js 14+ with App Router
- Server Components for data fetching
- API routes for backend logic
- Server-Sent Events for AI streaming

## Technology Stack

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

## Data Caching Strategy

Given Google Ads API rate limits (15K ops/day), aggressive caching is required:

| Data Type | Cache Duration | Refresh Trigger |
|-----------|---------------|-----------------|
| Campaign list | 1 hour | Manual refresh, write action |
| Campaign metrics | 4 hours | Manual refresh |
| Keywords/Ads | 4 hours | Manual refresh, drill-down |
| Search terms | 24 hours | Manual refresh |
| Account structure | 24 hours | Manual refresh |

## Testing Requirements

- Jest for unit tests (70%+ coverage on business logic)
- React Testing Library for components
- Playwright for E2E (critical paths)
- API route testing
