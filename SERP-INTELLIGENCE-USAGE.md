# SERP Intelligence - Manual Checks Only

## Overview

SERP Intelligence is a **manual, user-controlled feature** that allows you to:
- Track organic search positions for keywords
- Monitor competitor ad presence
- Detect SERP features (Shopping Ads, Local Pack, etc.)
- Generate AI-powered PPC opportunities

**Important**: SERP position checks are **NOT automated**. Users must manually trigger checks by clicking "Check Now" in the dashboard. This approach:
- Gives users full control over API costs
- Enables this feature to be offered as a paid/premium tier
- Prevents unexpected charges from automatic daily checks

---

## How It Works

### 1. Add Keywords to Track
Users can add keywords from two places:

**From Keyword Factory**:
1. Generate keywords in Keyword Factory
2. Select keywords to track
3. Click "📊 Track Rankings" button
4. Enter target domain (e.g., "example.com")
5. Keywords added to SERP Intelligence

**From SERP Intelligence Dashboard**:
1. Navigate to `/serp-intelligence`
2. Click "Add Keywords" button
3. Enter keywords and settings
4. Keywords added for tracking

### 2. Manual Position Checks

**User triggers check**:
1. Go to SERP Intelligence dashboard
2. Click "Check Now" button next to keywords
3. API call to DataForSEO is triggered
4. Results displayed immediately
5. Historical data stored for trend analysis

**Rate Limiting**:
- 6-hour cooldown between manual checks
- Prevents excessive API usage
- Displays "Next check available in X hours" message

### 3. View Results

**Dashboard displays**:
- Current organic position (1-100)
- Position change from last check
- Competitor ad count
- SERP features detected
- 30-day position history chart
- AI-generated PPC opportunities

---

## API Costs

### DataForSEO Pricing
- **Cost per keyword check**: ~$0.025 (3 cents)
- **100 keywords checked**: $2.50
- **User pays per click**: Only charged when user clicks "Check Now"

### Cost Control
- No automatic daily checks
- 6-hour rate limiting
- User sees estimated cost before checking
- Budget control: Users choose when to spend

---

## Monetization Options

### Free Tier (Freemium Model)
- 10 keywords tracked
- 5 manual checks per month
- Basic position tracking

### Pro Tier ($29/month)
- 50 keywords tracked
- Unlimited manual checks
- AI opportunity recommendations
- Competitor analysis
- 90-day history

### Enterprise Tier ($99/month)
- 200 keywords tracked
- Unlimited manual checks
- White-label reports
- API access
- Priority support

---

## Database Schema

### tracked_keywords
Stores keywords user wants to monitor:
```sql
CREATE TABLE tracked_keywords (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  location_code TEXT DEFAULT '2840', -- US
  device TEXT DEFAULT 'desktop',
  language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### serp_snapshots
Stores historical position data:
```sql
CREATE TABLE serp_snapshots (
  id UUID PRIMARY KEY,
  tracked_keyword_id UUID REFERENCES tracked_keywords(id),
  organic_position INT, -- 1-100 or NULL
  competitor_ads_count INT DEFAULT 0,
  shopping_ads_present BOOLEAN DEFAULT FALSE,
  local_pack_present BOOLEAN DEFAULT FALSE,
  featured_snippet BOOLEAN DEFAULT FALSE,
  top_ad_domains TEXT[],
  organic_competitors TEXT[],
  snapshot_date DATE NOT NULL,
  api_cost_cents INT DEFAULT 3, -- ~$0.03 per check
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
```

### serp_opportunities
AI-generated PPC recommendations:
```sql
CREATE TABLE serp_opportunities (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  tracked_keyword_id UUID REFERENCES tracked_keywords(id),
  opportunity_type TEXT NOT NULL,
  priority TEXT NOT NULL, -- high/medium/low
  recommendation_text TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active/dismissed/implemented
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

### GET /api/serp-intelligence/keywords
List all tracked keywords for current user

**Response**:
```json
{
  "keywords": [
    {
      "id": "uuid",
      "keyword": "google ads optimization",
      "targetDomain": "example.com",
      "lastPosition": 12,
      "lastChecked": "2025-12-27T10:30:00Z",
      "canCheckNow": true
    }
  ]
}
```

### POST /api/serp-intelligence/keywords
Add new keywords to track

**Request**:
```json
{
  "customerId": "123-456-7890",
  "keywords": ["keyword 1", "keyword 2"],
  "targetDomain": "example.com",
  "locationCode": "2840",
  "device": "desktop",
  "language": "en"
}
```

### POST /api/serp-intelligence/check
Trigger manual SERP position check

**Request**:
```json
{
  "keywordIds": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "keywordId": "uuid1",
      "keyword": "google ads",
      "organicPosition": 8,
      "competitorAds": 4,
      "serpFeatures": ["shopping_ads", "local_pack"],
      "costCents": 3
    }
  ],
  "totalCostCents": 6
}
```

### GET /api/serp-intelligence/history/[keywordId]
Get historical position data for chart

**Response**:
```json
{
  "keyword": "google ads optimization",
  "history": [
    {
      "date": "2025-12-27",
      "position": 12,
      "competitorAds": 4
    },
    {
      "date": "2025-12-26",
      "position": 10,
      "competitorAds": 3
    }
  ]
}
```

### GET /api/serp-intelligence/opportunities
Get AI-generated PPC opportunities

**Response**:
```json
{
  "opportunities": [
    {
      "id": "uuid",
      "keyword": "google ads",
      "type": "weak_organic",
      "priority": "high",
      "recommendation": "Position dropped to #12 - consider protective PPC campaign",
      "estimatedClicks": 500,
      "estimatedCost": 150
    }
  ]
}
```

---

## Rate Limiting Implementation

### File: `src/lib/serp-intelligence/rate-limit.ts`

```typescript
export async function canCheckKeyword(keywordId: string): Promise<{
  canCheck: boolean;
  nextCheckAt?: Date;
  hoursRemaining?: number;
}> {
  const COOLDOWN_HOURS = 6;

  const lastCheck = await pool.query(
    'SELECT last_checked_at FROM tracked_keywords WHERE id = $1',
    [keywordId]
  );

  if (!lastCheck.rows[0]?.last_checked_at) {
    return { canCheck: true };
  }

  const lastCheckedAt = new Date(lastCheck.rows[0].last_checked_at);
  const nextCheckAt = new Date(lastCheckedAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
  const now = new Date();

  if (now >= nextCheckAt) {
    return { canCheck: true };
  }

  const hoursRemaining = Math.ceil((nextCheckAt.getTime() - now.getTime()) / (1000 * 60 * 60));

  return {
    canCheck: false,
    nextCheckAt,
    hoursRemaining
  };
}
```

---

## UI Components

### Check Now Button
Shows different states based on rate limit:

```typescript
{canCheck ? (
  <button onClick={handleCheckNow}>
    Check Now ($0.03)
  </button>
) : (
  <button disabled>
    Next check in {hoursRemaining}h
  </button>
)}
```

### Cost Estimate
Before checking multiple keywords:

```typescript
<div className="cost-estimate">
  <p>Selected keywords: {selectedCount}</p>
  <p>Estimated cost: ${(selectedCount * 0.03).toFixed(2)}</p>
  <button onClick={confirmCheck}>
    Proceed with Check
  </button>
</div>
```

---

## Testing

### Manual Test Flow
1. Navigate to `/serp-intelligence`
2. Add keyword "google ads" for domain "google.com"
3. Click "Check Now"
4. Verify API call to DataForSEO
5. Verify position data displayed
6. Verify snapshot stored in database
7. Try clicking "Check Now" again → should show cooldown message
8. Wait 6 hours (or manually update last_checked_at in DB)
9. Click "Check Now" again → should work

### Database Queries

**Check recent snapshots**:
```sql
SELECT
  tk.keyword,
  ss.organic_position,
  ss.competitor_ads_count,
  ss.snapshot_date,
  ss.api_cost_cents
FROM serp_snapshots ss
JOIN tracked_keywords tk ON ss.tracked_keyword_id = tk.id
ORDER BY ss.snapshot_date DESC
LIMIT 10;
```

**Check total API costs**:
```sql
SELECT
  COUNT(*) as total_checks,
  SUM(api_cost_cents) / 100.0 as total_cost_dollars,
  DATE(snapshot_date) as check_date
FROM serp_snapshots
GROUP BY DATE(snapshot_date)
ORDER BY check_date DESC;
```

---

## Future Enhancements (Paid Features)

### Scheduled Checks (Premium)
- Allow Pro users to enable daily/weekly automatic checks
- Set up budget caps per month
- Email alerts when budget threshold reached
- Pause auto-checks when budget exceeded

### Bulk Operations (Enterprise)
- Check all keywords at once
- Export position data to CSV
- API access for external tools
- Webhook notifications on position changes

### Advanced Analytics (Pro)
- Visibility score (estimated traffic potential)
- Competitor ad spend estimates
- Seasonal trend predictions
- Custom date range analysis

---

## Support & Troubleshooting

### "Check Now" button is disabled
- 6-hour cooldown between checks
- Check `last_checked_at` in database
- Pro users: No cooldown limit

### Position showing as NULL
- Keyword not in top 100 organic results
- Normal behavior - not all keywords rank high
- Consider PPC opportunity recommendation

### High API costs
- Each check costs ~$0.03 per keyword
- Users manually trigger checks = full cost control
- Add cost estimate before check confirmation

### DataForSEO API errors
- Check credentials in environment variables
- Verify API quota at https://app.dataforseo.com/
- Rate limiting: 1 req/second

---

**Summary**:
- ✅ Manual checks only (user clicks "Check Now")
- ✅ 6-hour cooldown prevents excessive usage
- ✅ Full cost transparency ($0.03 per keyword)
- ✅ Ready for freemium/paid tier pricing
- ✅ No automatic daily jobs
- ✅ User controls when to spend
