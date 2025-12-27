# SERP Intelligence - Manual Tracking Only

## ✅ Configuration Complete

The SERP Intelligence feature is now configured with:
- **DataForSEO API** for accurate, structured SERP data
- **Manual tracking only** - keywords are NEVER checked automatically
- Professional modals instead of JavaScript alerts

---

## 🔑 API Credentials

DataForSEO credentials are already configured in `.env.local`:
```
DATAFORSEO_LOGIN=wassim@mercan.com
DATAFORSEO_PASSWORD=5ty6%TY^5ty6
```

Get your credentials from: https://app.dataforseo.com/api-dashboard

---

## 🎯 How It Works

### 1. Add Keywords to Track
From Keyword Factory:
1. Generate keywords
2. Select keywords you want to track
3. Click "Track Rankings" button
4. Enter your target domain (e.g., `example.com`)
5. Keywords are added to database (NO SERP check yet)

### 2. Check Positions Manually
From SERP Intelligence Dashboard:
1. Select keywords to check
2. Click "Check Now" button
3. DataForSEO API fetches real SERP data:
   - Organic position (1-100)
   - Competitor ad counts
   - SERP features (Shopping, Local Pack, etc.)
   - Top 10 organic competitors
4. Results stored in database

### 3. Rate Limiting
- **Current (TESTING)**: 10 seconds between checks
- **Production**: 6 hours between manual checks
- Change in: `src/app/api/serp-intelligence/check/route.ts:24`

---

## 💰 Pricing

### DataForSEO Costs
- **~$0.025 per keyword check** (~2.5 cents)
- **100 keywords checked once** = $2.50
- **100 keywords daily for 30 days** = $75/month

### Free Alternatives (if needed)
The system is designed to be API-agnostic. You can swap DataForSEO with:
- SerpApi (similar pricing)
- ValueSerp (cheaper, ~$0.01/keyword)
- Google Search Console API (free but limited)

---

## 🚫 NO Automatic Tracking

**CONFIRMED**: No automatic/scheduled checks are configured:
- ✅ No cron jobs
- ✅ No Vercel cron schedules
- ✅ No background workers
- ✅ No automatic polling
- ✅ No daily checker scripts

**All SERP checks are triggered manually by user clicking "Check Now"**

---

## 📁 Key Files

### DataForSEO Integration
- `src/lib/dataforseo.ts` - API client for structured SERP data
- `src/app/api/serp-intelligence/check/route.ts` - Manual check endpoint

### Database
- `prisma/migrations/010_serp_intelligence.sql` - Schema (tracked_keywords, serp_snapshots, serp_opportunities)
- `prisma/migrations/011_fix_user_id_types.sql` - Fixed UUID → TEXT for user_id

### UI Components
- `src/app/serp-intelligence/page.tsx` - Main dashboard
- `src/app/keyword-factory/components/TrackRankingsModal.tsx` - Add keywords modal
- `src/app/keyword-factory/components/TrackSuccessModal.tsx` - Success confirmation

---

## 🧪 Testing DataForSEO

1. Wait 10 seconds after last check (rate limit)
2. Go to SERP Intelligence dashboard
3. Select 1-3 keywords
4. Click "Check Now"
5. Check console logs for DataForSEO API calls
6. Verify results show:
   - Organic position
   - Competitor ads count
   - SERP features

### Expected Console Output
```
[DataForSEO] Checking SERP for "portugal golden visa" (location: 2840, desktop)
[DataForSEO] Request: { keyword: "portugal golden visa", location_code: 2840, ... }
[DataForSEO] Response status code: 20000
[DataForSEO] Items in result: 12
[DataForSEO] Organic: 10, Paid: 2, Features: 0
[DataForSEO] ✓ "portugal golden visa" - Position: 5, Ads: 2, Features: None
```

---

## 🔄 Switching Back to 6-Hour Rate Limit (Production)

After testing, change this line:
```typescript
// src/app/api/serp-intelligence/check/route.ts:24
const MANUAL_CHECK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
```

---

## 📊 DataForSEO vs ScrapingRobot

| Feature | ScrapingRobot | DataForSEO |
|---------|---------------|------------|
| **Structured Data** | ❌ HTML only | ✅ JSON |
| **Organic Positions** | ❌ Manual parsing | ✅ Built-in |
| **Ad Counts** | ❌ Manual parsing | ✅ Built-in |
| **SERP Features** | ❌ Manual parsing | ✅ Built-in |
| **Cost per Check** | ~$0.01 | ~$0.025 |
| **Reliability** | ⚠️ 500 errors | ✅ Stable |

---

## 🐛 Troubleshooting

### "Rate limit exceeded"
Wait 10 seconds (or 6 hours in production) between manual checks.

### "DataForSEO API error: 401"
Check credentials in `.env.local` - get from https://app.dataforseo.com/api-dashboard

### "No SERP data returned"
Check console for API errors. DataForSEO might be down or quota exceeded.

### Keywords not tracking
1. Verify database has entries: `SELECT * FROM tracked_keywords;`
2. Check user_id is TEXT format (CUID), not UUID
3. Verify foreign key constraints are valid

---

## 📚 Documentation Sources

- [DataForSEO API v.3](https://docs.dataforseo.com/v3/)
- [Google Organic SERP Overview](https://docs.dataforseo.com/v3/serp-google-organic-overview/)
- [DataForSEO Authentication](https://docs.dataforseo.com/v3/auth/)
- [Kickstart Guide](https://dataforseo.com/blog/a-kickstart-guide-to-using-dataforseo-apis)
