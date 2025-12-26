# Unified Project Structure

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
