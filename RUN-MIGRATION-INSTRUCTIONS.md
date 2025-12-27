# How to Run Migration 005 - Location Targeting

## Method 1: Via Supabase Studio (Easiest) ✅

1. **Open Supabase Studio:**
   - URL: http://38.97.60.181:3002
   - Username: `wassim`
   - Password: `5ty6%TY^5ty6`

2. **Go to SQL Editor:**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy the migration SQL:**
   - Open file: `prisma/migrations/005_add_location_to_cache.sql`
   - Copy ALL the SQL content

4. **Paste and Run:**
   - Paste the SQL into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)
   - ✅ You should see "Success. No rows returned"

5. **Verify:**
   - Run this query to verify:
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'keyword_metrics' AND column_name = 'location_id';
   ```
   - Should return 1 row showing the location_id column

---

## Method 2: Get API Keys and Run via Script

If you want to enable enrichment features, you need to get your Supabase API keys:

1. **Open Supabase Studio:** http://38.97.60.181:3002

2. **Go to Settings → API:**
   - Copy the **anon/public key** (starts with `eyJ...`)
   - Copy the **service_role key** (starts with `eyJ...`)

3. **Update .env.local:**
   ```bash
   SUPABASE_ANON_KEY="eyJ..."  # Your anon key
   SUPABASE_SERVICE_KEY="eyJ..."  # Your service role key
   ```

4. **Restart dev server:**
   ```bash
   # Kill current server and restart
   npm run dev
   ```

---

## To See the Location Dropdown in UI

**Important:** The location dropdown is only visible when you **enable "Enrich with Metrics"**!

Steps to see it:
1. Open Keyword Factory: http://localhost:3000/keyword-factory
2. Look for "Enrich with Metrics" section (has "NEW" badge)
3. **Toggle the switch ON** ✅
4. The location dropdown will appear below with 📍 icon
5. Select your target location (US, GB, PT, etc.)

---

## Quick Test

Once migration is done and you have API keys:

1. Enable "Enrich with Metrics" toggle
2. Select location: **Portugal** 🇵🇹
3. Enter seed: "portugal golden visa"
4. Click Generate Keywords
5. You should see location-specific metrics (if you have Google Ads API configured)

Compare with:
- Location: **United States** 🇺🇸
- Should show different volume/CPC values

---

## Current Status

❌ **Migration:** Not run yet (need to run SQL in Supabase Studio)
❌ **API Keys:** Missing (need to get from Supabase Studio)
✅ **Code:** All location targeting code is ready
✅ **UI:** Location dropdown exists (visible when enrichment is enabled)

**Next Step:** Run the migration via Supabase Studio (Method 1 above) 👆
