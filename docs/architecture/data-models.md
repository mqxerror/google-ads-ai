# Data Models

## User

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

## GoogleAdsAccount

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

## CachedCampaign

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

## PendingAction

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

## ActivityLog

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

## SavedView

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
