# Testing Keyword Infrastructure (3 Completed Tasks)

## What We Built

✅ **Task 1: Database Schema** (`004_keyword_metrics.sql`)
- `keyword_metrics` table with dynamic TTL
- Multi-source support (Google Ads, Moz, DataForSEO)
- Helper functions for TTL calculation, refresh detection, cleanup

✅ **Task 2: Circuit Breakers** (`circuit-breaker.ts`)
- Prevents cascading API failures
- Three states: CLOSED, OPEN, HALF_OPEN
- Independent breakers for each API

✅ **Task 3: Caching Layer** (`cache.ts`)
- Two-tier: In-memory (1hr) + Database (dynamic 7-30 days)
- Batch operations for performance
- Automatic dynamic TTL recalculation

---

## How to Test

### Option 1: Web Browser (Easiest)

1. **Apply Migration** (one-time):
   ```bash
   # If you have psql installed:
   psql "$DATABASE_URL" -f prisma/migrations/004_keyword_metrics.sql

   # OR manually in Supabase Dashboard → SQL Editor:
   # Copy/paste content from: prisma/migrations/004_keyword_metrics.sql
   ```

2. **Run Tests** (via browser):
   - Open: http://localhost:3000/api/test-keyword-infra
   - You'll see JSON response with all test results
   - Look for `"success": true` at the top

### Option 2: Command Line (Automated)

```bash
# Run the test script (applies migration + runs tests)
./test-keyword-infra.sh
```

### Option 3: Manual curl

```bash
# 1. Apply migration (see Option 1)

# 2. Run tests
curl http://localhost:3000/api/test-keyword-infra | jq '.'
```

---

## Expected Test Results

### ✅ What Success Looks Like

```json
{
  "success": true,
  "summary": {
    "totalTests": 10,
    "passed": 10,
    "failed": 0,
    "successRate": "100%"
  },
  "results": [
    {"test": "1a. Database Table Exists", "status": "pass"},
    {"test": "1b. Database Insert", "status": "pass"},
    {"test": "1c. Database Read", "status": "pass"},
    {"test": "1d. Dynamic TTL Trigger", "status": "pass"},
    {"test": "2a. Circuit Breaker Stats", "status": "pass"},
    {"test": "2b. Circuit Breaker Success", "status": "pass"},
    {"test": "2c. Circuit Breaker Failure Handling", "status": "pass"},
    {"test": "3a. Cache Stats", "status": "pass"},
    {"test": "3b. Cache Miss", "status": "pass"},
    {"test": "3c-d. Cache Store & Hit", "status": "pass"},
    {"test": "3e. In-Memory Cache", "status": "pass"}
  ]
}
```

### ❌ Common Issues

**Issue: "Table keyword_metrics does not exist"**
- Fix: Run the migration (see Option 1, step 1)

**Issue: "Connection error"**
- Fix: Check `DATABASE_URL` or Supabase credentials in `.env`

**Issue: "Dev server not running"**
- Fix: Run `npm run dev` in another terminal

---

## What Each Test Checks

### Database Tests (1a-1d)
- ✓ Table created with correct schema
- ✓ Can insert keyword metrics
- ✓ Can read keyword metrics
- ✓ Dynamic TTL updates when cache_hit_count increments

### Circuit Breaker Tests (2a-2c)
- ✓ Circuit breakers initialized
- ✓ Successful requests pass through
- ✓ Circuit opens after failure threshold
- ✓ Requests fail fast when circuit is open

### Caching Tests (3a-3e)
- ✓ Cache stats retrieved
- ✓ Cache miss detected correctly
- ✓ Keywords stored in database cache
- ✓ Keywords retrieved from cache
- ✓ In-memory cache working (fast lookups)

---

## Next Steps After Testing

If all tests pass:
1. ✅ Database schema ready for keyword metrics
2. ✅ Circuit breakers protecting API calls
3. ✅ Caching layer minimizing API costs

Ready to continue with:
4. Google Ads Keyword Planner integration
5. DataForSEO API integration
6. Orchestration layer
7. Background refresh job
8. Quota tracking
9. API route enhancement
10. Frontend UI

---

## Debugging

View test details in browser DevTools:
```javascript
// In browser console after visiting test endpoint:
fetch('http://localhost:3000/api/test-keyword-infra')
  .then(r => r.json())
  .then(console.log)
```

Check database directly:
```sql
-- In Supabase SQL Editor:
SELECT * FROM keyword_metrics LIMIT 10;

-- Check dynamic TTL:
SELECT keyword, cache_hit_count, ttl_days, expires_at
FROM keyword_metrics
ORDER BY cache_hit_count DESC;
```

---

**Questions?** Check server logs in terminal where `npm run dev` is running.
