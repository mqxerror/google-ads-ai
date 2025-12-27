# SERP Intelligence Daily Cron Job Setup

## Overview

The SERP Intelligence feature automatically checks keyword positions once per day to track:
- Organic search positions for your domain
- Competitor ad counts
- SERP features (Shopping Ads, Local Pack, etc.)
- Position changes over time

**Cost**: ~$0.01 per keyword per check
- 100 keywords tracked daily = ~$1/day = $30/month
- 50 keywords tracked daily = ~$0.50/day = $15/month

## Setup on Production Server (Dokploy)

### Step 1: Generate CRON_SECRET

```bash
# SSH into server
ssh -p 2222 root@38.97.60.181

# Generate random secret
openssl rand -hex 32
# Example output: a3f9d8e7c6b5a4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9
```

### Step 2: Add Environment Variable to Dokploy

**Via Dokploy Database:**
```bash
# Connect to Dokploy PostgreSQL
docker exec -it dokploy-postgres.1.wrcfikzf990v8i42ic66yv2lq psql -U dokploy -d dokploy

# Add CRON_SECRET to application
UPDATE application
SET env = env || E'\nCRON_SECRET=a3f9d8e7c6b5a4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9'
WHERE "applicationId" = '8GB4bxm0DjkVeAQDoN91Y';

# Verify
SELECT env FROM application WHERE "applicationId" = '8GB4bxm0DjkVeAQDoN91Y';

\q
```

### Step 3: Restart Application

```bash
# Update Docker service to pick up new env vars
docker service update --force google-ads-ai-wgwtgx

# Verify env var is in container
docker ps | grep google-ads
# Get container ID (e.g., abc123def456)

docker exec <container_id> printenv | grep CRON_SECRET
# Should output: CRON_SECRET=a3f9d8e7c6b5a4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9
```

### Step 4: Setup System Cron Job

**Option A: Direct curl command (simplest)**
```bash
# Edit crontab
crontab -e

# Add this line (replace <YOUR_CRON_SECRET> with actual value):
0 3 * * * curl -H "Authorization: Bearer <YOUR_CRON_SECRET>" https://ads.mercan.com/api/cron/serp-daily-check >> /var/log/serp-check.log 2>&1

# Save and exit
```

**Option B: Using the Node.js script (more robust)**
```bash
# Copy script to server
cd /root
git clone <your-repo> serp-cron
cd serp-cron

# Make script executable
chmod +x cron-daily-serp-check.js

# Test the script
CRON_SECRET=<YOUR_CRON_SECRET> API_URL=https://ads.mercan.com ./cron-daily-serp-check.js

# If successful, add to crontab
crontab -e

# Add this line:
0 3 * * * cd /root/serp-cron && CRON_SECRET=<YOUR_CRON_SECRET> API_URL=https://ads.mercan.com ./cron-daily-serp-check.js >> /var/log/serp-check.log 2>&1
```

### Step 5: Verify Cron Job

**Check crontab:**
```bash
crontab -l
```

**Test manually:**
```bash
# Test the API endpoint directly
curl -H "Authorization: Bearer <YOUR_CRON_SECRET>" https://ads.mercan.com/api/cron/serp-daily-check

# Or using the script
CRON_SECRET=<YOUR_CRON_SECRET> API_URL=https://ads.mercan.com /root/serp-cron/cron-daily-serp-check.js
```

**Check logs after first run:**
```bash
tail -f /var/log/serp-check.log
```

## Cron Schedule Explained

```
0 3 * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-7, 0 and 7 are Sunday)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

**Common schedules:**
- `0 3 * * *` - Daily at 3 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 3 * * 1` - Every Monday at 3 AM
- `0 3 1 * *` - First day of every month at 3 AM

## Monitoring

### Check if cron is running:
```bash
# View recent cron logs
grep CRON /var/log/syslog | tail -20

# Check specific script output
tail -100 /var/log/serp-check.log
```

### Monitor database for new snapshots:
```bash
docker exec supabase-db psql -U postgres -d google_ads_manager -c "
  SELECT
    DATE(snapshot_date) as date,
    COUNT(*) as snapshots_created
  FROM serp_snapshots
  GROUP BY DATE(snapshot_date)
  ORDER BY date DESC
  LIMIT 7;
"
```

### Check API costs:
```bash
docker exec supabase-db psql -U postgres -d google_ads_manager -c "
  SELECT
    DATE(snapshot_date) as date,
    COUNT(*) as checks,
    SUM(api_cost_cents) / 100.0 as cost_dollars
  FROM serp_snapshots
  WHERE snapshot_date >= NOW() - INTERVAL '30 days'
  GROUP BY DATE(snapshot_date)
  ORDER BY date DESC;
"
```

## Troubleshooting

### Cron job not running?

1. **Check if cron service is running:**
   ```bash
   systemctl status cron
   # or on some systems:
   systemctl status crond
   ```

2. **Check crontab syntax:**
   ```bash
   crontab -l
   ```

3. **Check cron logs:**
   ```bash
   grep CRON /var/log/syslog | tail -50
   ```

4. **Test the API manually:**
   ```bash
   curl -v -H "Authorization: Bearer <YOUR_CRON_SECRET>" \
     https://ads.mercan.com/api/cron/serp-daily-check
   ```

### High API costs?

Check how many keywords are being tracked:
```bash
docker exec supabase-db psql -U postgres -d google_ads_manager -c "
  SELECT COUNT(*) FROM tracked_keywords WHERE is_active = true;
"
```

**Cost control:**
- Each keyword check = ~$0.01
- 100 keywords/day = ~$30/month
- 50 keywords/day = ~$15/month
- 25 keywords/day = ~$7.50/month

### API endpoint returns 401 Unauthorized?

- Check CRON_SECRET environment variable is set correctly
- Verify Authorization header matches: `Bearer <CRON_SECRET>`
- Check application logs for authentication errors

### Timeout errors?

- Default timeout is 5 minutes (300 seconds)
- If checking 100+ keywords, may need to increase
- Consider splitting into multiple smaller batches

## Alternative: Vercel Cron (if migrating to Vercel)

If you deploy to Vercel in the future, add this to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/serp-daily-check",
    "schedule": "0 3 * * *"
  }]
}
```

Then add CRON_SECRET to Vercel environment variables.

## Cost Estimation Tool

Estimate monthly costs for your tracked keywords:

```bash
curl https://ads.mercan.com/api/serp-intelligence/cost-estimate
```

## Support

For issues or questions:
- Check application logs: `docker service logs google-ads-ai-wgwtgx`
- Check database for errors: `SELECT * FROM serp_snapshots WHERE scrapingrobot_status = 'error' LIMIT 10;`
- Review DataForSEO API dashboard: https://app.dataforseo.com/

---

**Summary:**
1. ✅ Generate CRON_SECRET
2. ✅ Add to Dokploy application env vars
3. ✅ Restart application
4. ✅ Setup system cron job (3 AM daily)
5. ✅ Monitor logs and database
6. ✅ Track costs via dashboard
