# Manual Deployment Steps for SERP Intelligence

## Issue
Dokploy login credentials don't seem to be working through browser automation. Here's how to manually complete the deployment:

## Option 1: Add Environment Variables via Dokploy Web UI

1. **Login to Dokploy**: http://38.97.60.181:3000
   - Email: wassim@mercan.com
   - Password: 5ty6%TY^5ty6

2. **Navigate to your application**:
   - Find "quick-ads-ai" or "google-ads-manager" project
   - Click on it to open settings

3. **Add Environment Variables**:
   - Go to "Environment" or "Settings" tab
   - Click "Add Environment Variable"
   - Add these two variables:
     ```
     DATAFORSEO_LOGIN=wassim@mercan.com
     DATAFORSEO_PASSWORD=b8861f174919820b
     ```

4. **Deploy**:
   - Click "Deploy" or "Redeploy" button
   - Wait for deployment to complete

## Option 2: Direct Docker Environment Update

If you have SSH access to the server:

```bash
# SSH to server
ssh -p 2222 root@38.97.60.181

# Find your application container
docker ps | grep -i "quick-ads\|google-ads"

# If using docker-compose, find the docker-compose.yml file
# Usually in /root/dokploy/projects/[project-name]/

# Add environment variables to docker-compose.yml or .env file:
echo "DATAFORSEO_LOGIN=wassim@mercan.com" >> /path/to/app/.env
echo "DATAFORSEO_PASSWORD=b8861f174919820b" >> /path/to/app/.env

# Restart the container
docker-compose restart
# OR
docker restart <container-id>
```

## Option 3: Dokploy CLI (if available)

```bash
# If Dokploy has a CLI tool
dokploy env set DATAFORSEO_LOGIN=wassim@mercan.com
dokploy env set DATAFORSEO_PASSWORD=b8861f174919820b
dokploy deploy
```

## Verification

After adding the environment variables and deploying:

1. Access the application: https://ads.mercan.com
2. Navigate to "SERP Intelligence" in the menu
3. Try adding a keyword and clicking "Check Now"
4. If it works, you should see position data fetched from DataForSEO

## What's Already Done ✅

1. ✅ Code pushed to GitHub (branch: v2, commit: 77faf13)
2. ✅ Secrets removed from git history
3. ✅ Database migrations applied (tables ready)
4. ✅ All SERP Intelligence features implemented

## What's Needed ⏳

1. ⏳ Add DataForSEO credentials to production environment
2. ⏳ Deploy/restart application to pick up new env vars

## Troubleshooting Dokploy Login

If the password `5ty6%TY^5ty6` doesn't work, you may need to:
1. Reset the Dokploy admin password
2. Check if there's a different admin account
3. Access Dokploy configuration files directly on the server

---

**Quick Summary**: Just need to add 2 environment variables to Dokploy and redeploy!
