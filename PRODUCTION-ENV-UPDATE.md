# Production Environment Variables - DataForSEO

## Required Environment Variables for SERP Intelligence

Add these environment variables to the `quick-ads-ai` application in Dokploy:

### DataForSEO API Credentials

```bash
DATAFORSEO_LOGIN=wassim@mercan.com
DATAFORSEO_PASSWORD=b8861f174919820b
```

## How to Add via Dokploy

1. **Access Dokploy Dashboard**:
   - URL: `http://38.97.60.181:3000` (or your Dokploy port)

2. **Navigate to Application**:
   - Find the `quick-ads-ai` or `google-ads-manager` application
   - Go to "Environment Variables" or "Settings" tab

3. **Add Variables**:
   - Click "Add Environment Variable"
   - Add `DATAFORSEO_LOGIN` = `wassim@mercan.com`
   - Add `DATAFORSEO_PASSWORD` = `b8861f174919820b`

4. **Save and Restart**:
   - Save the changes
   - Restart/redeploy the application for changes to take effect

## Verification

After deployment, the SERP Intelligence feature will be able to:
- Track keyword positions via DataForSEO API
- Cost: ~$0.025 per keyword check
- Rate limit: 6 hours between manual checks

## Current Status

✅ Git secrets removed - pushed to GitHub
✅ Database migrations applied (010 and 011)
⏳ Environment variables need to be added via Dokploy
⏳ Application needs to be redeployed

## Alternative: Direct .env File Update

If you prefer to update the .env file directly via SSH:

```bash
# SSH to server
ssh -p 2222 root@38.97.60.181

# Find the application directory (usually in /root/dokploy or similar)
# Edit the .env file
echo "DATAFORSEO_LOGIN=wassim@mercan.com" >> /path/to/app/.env
echo "DATAFORSEO_PASSWORD=b8861f174919820b" >> /path/to/app/.env

# Restart the application via Dokploy or Docker
```
