# Coding Standards

## Critical Rules

- **Type Sharing:** Define all shared types in `src/types/index.ts`
- **API Calls:** Use hooks from `@/hooks`, never direct fetch
- **Environment Variables:** Access via `@/lib/constants.ts`
- **Error Handling:** All API routes use `handleApiError()`
- **Database Access:** Import Prisma from `@/lib/prisma`
- **Redis Access:** Import from `@/lib/redis`
- **Authentication:** Use `requireAuth()` in API routes

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `SmartGrid.tsx` |
| Hooks | camelCase with 'use' | `useCampaigns.ts` |
| API Routes | kebab-case folders | `/api/ad-groups` |
| Database Tables | snake_case | `google_ads_accounts` |
| TypeScript Types | PascalCase | `CachedCampaign` |
