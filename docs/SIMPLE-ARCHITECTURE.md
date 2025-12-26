# Quick Ads AI — Architecture Reference

**Version:** 1.0 (Simplified)
**Last Updated:** December 2024

---

## Overview

Quick Ads AI is a **stateless single-page application**. No database required for core functionality. All data flows from Google Ads API → processed in-memory → rendered in browser.

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    page.tsx (React)                      │    │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐ │    │
│  │  │   Campaign Table     │  │     AI Chat Panel        │ │    │
│  │  │   + Stats Cards      │  │     + Suggestions        │ │    │
│  │  └──────────────────────┘  └──────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fetch()
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS API ROUTES                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ /api/auth/*     │  │ /api/google-ads │  │ /api/ai/chat    │  │
│  │ (NextAuth)      │  │ /campaigns      │  │ (streaming)     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
     ┌────────────┐       ┌────────────┐       ┌────────────┐
     │   Google   │       │ Google Ads │       │  Anthropic │
     │   OAuth    │       │    API     │       │   Claude   │
     └────────────┘       └────────────┘       └────────────┘
```

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 16 (App Router) | Full-stack React with API routes |
| **Language** | TypeScript | Type safety |
| **Styling** | Tailwind CSS 4 | Utility-first, fast to build |
| **Auth** | NextAuth.js v5 | OAuth handling + session management |
| **Google Ads** | google-ads-api | Official-ish Node.js client |
| **AI** | Anthropic Claude | Streaming chat responses |
| **Deployment** | Dokploy (Docker) | Container-based hosting |

---

## Directory Structure

```
quick-ads-ai/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # THE dashboard (entire UI)
│   │   ├── layout.tsx            # HTML wrapper
│   │   ├── globals.css           # Tailwind + custom CSS vars
│   │   └── api/                  # API endpoints
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts  # Auth handlers
│   │       ├── google-ads/
│   │       │   └── campaigns/
│   │       │       └── route.ts  # GET/POST/PATCH campaigns
│   │       └── ai/
│   │           └── chat/
│   │               └── route.ts  # Streaming chat
│   ├── lib/                      # Shared utilities
│   │   ├── auth.ts               # NextAuth config
│   │   ├── google-ads.ts         # API wrapper
│   │   └── ai-score.ts           # Scoring algorithm
│   └── types/                    # TypeScript definitions
│       ├── campaign.ts           # Campaign, AdGroup, etc.
│       └── next-auth.d.ts        # Session extensions
├── public/                       # Static assets (empty)
├── package.json
├── tsconfig.json
├── tailwind.config.ts            # (uses v4 CSS config)
├── next.config.ts
└── .env.local                    # Environment variables
```

---

## Component Architecture

### Single Page Design
The entire app is one React component (`page.tsx`) with local state:

```typescript
// Simplified structure
export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);

  // Fetch campaigns on mount
  useEffect(() => { fetchCampaigns(); }, []);

  return (
    <div className="flex">
      {/* Left: Campaign Dashboard */}
      <div className="flex-1">
        <StatsCards campaigns={campaigns} />
        <CampaignTable campaigns={campaigns} onToggle={toggleStatus} />
      </div>

      {/* Right: AI Chat */}
      <div className="w-[400px]">
        <ChatMessages messages={messages} />
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
```

### State Management
- **No Redux/Zustand** — Simple `useState` for everything
- **No React Query** — Direct `fetch()` calls
- **Optimistic updates** — UI updates before API confirms

---

## API Endpoints

### `/api/auth/[...nextauth]`
NextAuth catch-all handler for OAuth flow.

**Providers:**
- `Google` — Real OAuth with `adwords` scope
- `Credentials` — Demo mode bypass

### `/api/google-ads/campaigns`

**GET** — Fetch all campaigns
```typescript
// Request
GET /api/google-ads/campaigns?customerId=demo

// Response
{
  "campaigns": [
    {
      "id": "1",
      "name": "Brand Search",
      "status": "ENABLED",
      "type": "SEARCH",
      "spend": 2500,
      "conversions": 45,
      "ctr": 8.0,
      "cpa": 55.56,
      "aiScore": 78,
      "aiRecommendation": "Consider increasing budget"
    }
  ]
}
```

**PATCH** — Update campaign status
```typescript
// Request
PATCH /api/google-ads/campaigns
{
  "customerId": "demo",
  "campaignId": "1",
  "status": "PAUSED"
}

// Response
{ "success": true }
```

### `/api/ai/chat`

**POST** — Streaming chat response
```typescript
// Request
POST /api/ai/chat
{
  "messages": [
    { "role": "user", "content": "What should I pause?" }
  ],
  "campaigns": [ /* current campaign data */ ]
}

// Response (SSE stream)
data: {"content": "Based "}
data: {"content": "on your "}
data: {"content": "data..."}
data: [DONE]
```

---

## Authentication Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  User   │────▶│  /login     │────▶│   Google    │
│ clicks  │     │  (redirect) │     │   OAuth     │
└─────────┘     └─────────────┘     └──────┬──────┘
                                           │
                                           ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Session │◀────│  NextAuth   │◀────│  Callback   │
│ created │     │  JWT        │     │  /api/auth  │
└─────────┘     └─────────────┘     └─────────────┘
```

**Session Contents:**
```typescript
interface Session {
  user: {
    id: string;
    name: string;
    email: string;
  };
  accessToken: string;   // Google OAuth token
  expires: string;
}
```

**Token Refresh:**
- Tokens expire after 1 hour
- Auto-refresh using `refresh_token` in JWT callback
- If refresh fails, session shows `error: 'RefreshAccessTokenError'`

---

## AI Score Algorithm

Located in `src/lib/ai-score.ts`

### Scoring Formula
```
Base Score: 50
+ CTR Factor:        -10 to +15
+ Conversion Factor: -20 to +20
+ Wasted Spend:      -25 to +15
+ ROAS Factor:       -5 to +10
────────────────────────────────
Total: 0-100 (clamped)
```

### Benchmarks by Campaign Type

**CTR Benchmarks:**
| Type | Good | Warning |
|------|------|---------|
| SEARCH | 3.17% | 2.0% |
| DISPLAY | 0.46% | 0.3% |
| SHOPPING | 0.86% | 0.5% |
| VIDEO | 0.4% | 0.2% |
| PERFORMANCE_MAX | 2.0% | 1.0% |

**CPA Benchmarks:**
| Type | Good | Warning |
|------|------|---------|
| SEARCH | $40 | $80 |
| DISPLAY | $60 | $120 |
| SHOPPING | $30 | $60 |
| PERFORMANCE_MAX | $35 | $70 |

---

## Google Ads API Integration

Located in `src/lib/google-ads.ts`

### Key Functions

```typescript
// Create API client
createGoogleAdsClient(): GoogleAdsApi

// Get customer instance
getCustomer(client, customerId, refreshToken, loginCustomerId?): Customer

// List accessible accounts (for future account switcher)
listAccessibleAccounts(refreshToken): Account[]

// Fetch campaigns with metrics
fetchCampaigns(refreshToken, customerId, loginCustomerId?, startDate?, endDate?): Campaign[]

// Update campaign status
updateCampaignStatus(refreshToken, customerId, campaignId, status): Result

// Create campaign (stub)
createCampaign(refreshToken, customerId, campaign): Result
```

### GAQL Query (Campaigns)
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  metrics.ctr,
  metrics.average_cpc
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND segments.date BETWEEN '2024-11-25' AND '2024-12-25'
ORDER BY metrics.cost_micros DESC
```

---

## Styling Architecture

### Tailwind CSS v4
Uses CSS-first configuration (no `tailwind.config.js`):

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-bg: #0a0a0a;
  --color-surface: #141414;
  --color-surface2: #1e1e1e;
  --color-divider: #2a2a2a;
  --color-text: #ffffff;
  --color-text2: #a0a0a0;
  --color-text3: #666666;
  --color-accent: #3b82f6;
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-danger: #ef4444;
}
```

### Component Classes
```css
.card {
  @apply bg-surface rounded-xl border border-divider;
}

.btn-primary {
  @apply bg-accent text-white rounded-lg font-medium
         hover:bg-accent-hover transition-colors;
}
```

---

## Environment Variables

```bash
# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=xxx
GOOGLE_ADS_LOGIN_CUSTOMER_ID=123-456-7890  # Optional MCC ID

# NextAuth
NEXTAUTH_URL=https://ads.mercan.com
NEXTAUTH_SECRET=random-32-char-string

# AI
ANTHROPIC_API_KEY=sk-ant-xxx

# Mode
DEMO_MODE=true  # Set to skip real OAuth
```

---

## Deployment

### Production Setup
```
┌─────────────────────────────────────────────────────┐
│                 NGINX (SSL Termination)              │
│                 ads.mercan.com:443                   │
└────────────────────────┬────────────────────────────┘
                         │ proxy_pass
                         ▼
┌─────────────────────────────────────────────────────┐
│              DOCKER CONTAINER                        │
│              localhost:3001 → 3000                   │
│  ┌─────────────────────────────────────────────┐    │
│  │          NEXT.JS APPLICATION                 │    │
│  │     (node server + static assets)            │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Dockerfile (Multi-stage)
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
CMD ["node", "server.js"]
```

### Dokploy Config
- **App ID:** `8GB4bxm0DjkVeAQDoN91Y`
- **Build:** Dockerfile
- **Port:** 3001 → 3000
- **Auto-deploy:** GitHub main branch

---

## Error Handling

### API Errors
```typescript
// Fallback to demo data on error
try {
  const campaigns = await fetchCampaigns(token, customerId);
  return NextResponse.json({ campaigns });
} catch (error) {
  console.error('Error:', error);
  return NextResponse.json({ campaigns: DEMO_CAMPAIGNS });
}
```

### Auth Errors
- Token refresh failure → `session.error = 'RefreshAccessTokenError'`
- No session → Redirect to login (not implemented in UI)

### AI Errors
- No API key → Falls back to simulated responses
- Streaming error → Error message in stream, then `[DONE]`

---

## What's NOT Implemented

| Feature | Status |
|---------|--------|
| Database | Not used |
| User preferences | Not stored |
| Multiple accounts | Not supported |
| Campaign creation | Stub only |
| Ad group management | Types exist, no UI |
| Keyword management | Types exist, no UI |
| Error boundaries | Missing |
| Loading skeletons | Missing |
| Mobile optimization | Basic only |
| Testing | None |

---

## Quick Reference

### Run Locally
```bash
npm install
npm run dev
# → http://localhost:3000
```

### Run Demo Mode
```bash
echo "DEMO_MODE=true" >> .env.local
npm run dev
```

### Build for Production
```bash
npm run build
npm run start
```

### Check Types
```bash
npx tsc --noEmit
```

---

*This document reflects the actual architecture as of December 2024.*
