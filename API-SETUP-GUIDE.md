# API Setup Guide - Complete Configuration

This guide covers setup for all external APIs used in the Google Ads AI Manager.

## Table of Contents

1. [Google Ads API](#1-google-ads-api) ✅ **Already Configured**
2. [Google OAuth 2.0](#2-google-oauth-20) ✅ **Already Configured**
3. [DataForSEO API](#3-dataforseo-api) ✅ **Already Configured**
4. [Anthropic Claude API](#4-anthropic-claude-api) ✅ **Already Configured**
5. [OpenAI API](#5-openai-api) ✅ **Already Configured**
6. [Google Trends API](#6-google-trends-api) ⚠️ **NEEDS SETUP**
7. [YouTube Data API](#7-youtube-data-api) ⚠️ **NEEDS SETUP**
8. [Google Natural Language API](#8-google-natural-language-api) ⚠️ **NEEDS SETUP**
9. [Moz API](#9-moz-api) ⏸️ **Optional**

---

## 1. Google Ads API

**Status**: ✅ Already Configured

**Purpose**: Fetch campaign data, keywords, performance metrics

**Current Configuration**:
```env
GOOGLE_ADS_DEVELOPER_TOKEN=<your_developer_token>
```

**Note**: Actual values are configured in production environment variables.

**Documentation**: https://developers.google.com/google-ads/api/docs/start

---

## 2. Google OAuth 2.0

**Status**: ✅ Already Configured

**Purpose**: User authentication and Google Ads account access

**Current Configuration**:
```env
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
```

**Note**: Actual values are configured in production environment variables.

**Documentation**: https://developers.google.com/identity/protocols/oauth2

---

## 3. DataForSEO API

**Status**: ✅ Already Configured

**Purpose**: SERP position tracking, competitor analysis

**Current Configuration**:
```env
DATAFORSEO_LOGIN=<your_dataforseo_email>
DATAFORSEO_PASSWORD=<your_dataforseo_password>
```

**Note**: Actual values are configured in production environment variables.

**Pricing**: ~$0.01 per keyword check
**Dashboard**: https://app.dataforseo.com/api-dashboard
**Documentation**: https://docs.dataforseo.com/

---

## 4. Anthropic Claude API

**Status**: ✅ Already Configured

**Purpose**: AI keyword generation, opportunity analysis

**Current Configuration**:
```env
ANTHROPIC_API_KEY=<your_anthropic_api_key>
```

**Note**: Actual values are configured in production environment variables.

**Documentation**: https://docs.anthropic.com/

---

## 5. OpenAI API

**Status**: ✅ Already Configured

**Purpose**: Backup AI model for keyword generation

**Current Configuration**:
```env
OPENAI_API_KEY=<your_openai_api_key>
```

**Note**: Actual values are configured in production environment variables.

**Documentation**: https://platform.openai.com/docs/

---

## 6. Google Trends API

**Status**: ⚠️ **NEEDS SETUP**

**Purpose**: Track keyword search trends, identify rising/declining keywords

### What It Does:
- Shows keyword popularity over time
- Identifies "breakout" keywords (rapidly growing search volume)
- Provides seasonal trend data
- Helps prioritize PPC spend on trending topics

### Setup Steps:

#### Option 1: Unofficial Google Trends (Free, No API Key)

Use `google-trends-api` npm package (already works without configuration):

```bash
npm install google-trends-api
```

**No API key needed!** This package scrapes public Google Trends data.

**Example Usage** (already implemented in codebase):
```typescript
import googleTrends from 'google-trends-api';

const trendData = await googleTrends.interestOverTime({
  keyword: 'running shoes',
  geo: 'US',
  startTime: new Date('2024-01-01'),
  endTime: new Date(),
});
```

**Limitations**:
- Rate limited (too many requests = temporary ban)
- Less reliable than official API
- May break if Google changes their HTML structure

**Current Status**: ✅ This is what we're using - no setup needed!

#### Option 2: Google Trends Official API (Recommended for Production)

**Currently not available** - Google doesn't offer an official public Trends API.

**Alternatives**:
1. **SerpApi Google Trends** (Paid)
   - Website: https://serpapi.com/google-trends-api
   - Pricing: ~$50/month for 5,000 searches
   - Reliable, official API wrapper

2. **Apify Google Trends Scraper** (Paid)
   - Website: https://apify.com/
   - Pricing: Pay per use
   - Runs on cloud infrastructure

**Recommendation**:
- **Development/Testing**: Use unofficial `google-trends-api` (free)
- **Production**: Upgrade to SerpApi if you need reliability

### Add SerpApi (Optional Upgrade):

```bash
# 1. Sign up at https://serpapi.com/
# 2. Get API key from dashboard
# 3. Add to environment variables:

SERPAPI_KEY=your_serpapi_key_here
```

**Code Changes Needed**:
```typescript
// src/lib/google-apis/trends.ts
const SERPAPI_KEY = process.env.SERPAPI_KEY;

async function getTrendData(keyword: string) {
  if (SERPAPI_KEY) {
    // Use paid SerpApi (reliable)
    const response = await fetch(
      `https://serpapi.com/search?engine=google_trends&q=${keyword}&api_key=${SERPAPI_KEY}`
    );
    return response.json();
  } else {
    // Fall back to free google-trends-api
    return googleTrends.interestOverTime({ keyword });
  }
}
```

---

## 7. YouTube Data API

**Status**: ⚠️ **NEEDS SETUP**

**Purpose**: Analyze YouTube content for keyword opportunities

### What It Does:
- Find how many YouTube videos exist for a keyword
- Identify "content gaps" (high search volume, low video count)
- Suggest keywords for YouTube ads
- Analyze competitor video performance

### Setup Steps:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create or Select a Project**
   - Click "Select a project" → "New Project"
   - Name: "Google Ads Manager APIs"
   - Click "Create"

3. **Enable YouTube Data API v3**
   - Go to: https://console.cloud.google.com/apis/library
   - Search: "YouTube Data API v3"
   - Click "Enable"

4. **Create API Key**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "+ CREATE CREDENTIALS" → "API key"
   - Copy the API key (e.g., `AIzaSyC1234567890abcdefghijklmnopqrstuv`)

5. **Restrict API Key** (Important for Security)
   - Click on the API key you just created
   - Under "API restrictions":
     - Select "Restrict key"
     - Choose "YouTube Data API v3"
   - Under "Application restrictions":
     - Select "HTTP referrers (web sites)"
     - Add: `ads.mercan.com/*`
   - Click "Save"

6. **Add to Environment Variables**

   **Via Dokploy Database**:
   ```bash
   docker exec -it dokploy-postgres.1.wrcfikzf990v8i42ic66yv2lq psql -U dokploy -d dokploy

   UPDATE application
   SET env = env || E'\nYOUTUBE_API_KEY=AIzaSyC1234567890abcdefghijklmnopqrstuv'
   WHERE "applicationId" = '8GB4bxm0DjkVeAQDoN91Y';

   \q
   ```

   **Restart Application**:
   ```bash
   docker service update --force google-ads-ai-wgwtgx
   ```

7. **Verify**
   ```bash
   # Check env var is set
   docker ps | grep google-ads
   docker exec <container_id> printenv | grep YOUTUBE_API_KEY
   ```

### Pricing & Quotas:
- **Free Tier**: 10,000 quota units/day
- **1 video search** = 100 quota units
- **Daily limit**: ~100 keyword searches/day (free)
- **Paid**: $0.000002 per quota unit

**Quota Calculator**: https://developers.google.com/youtube/v3/determine_quota_cost

---

## 8. Google Natural Language API

**Status**: ⚠️ **NEEDS SETUP**

**Purpose**: Analyze keyword intent and extract entities

### What It Does:
- Classify keyword intent (transactional, informational, navigational)
- Extract entities (brands, products, locations)
- Improve keyword quality scoring
- Better negative keyword suggestions

### Setup Steps:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Select your project (or create one)

2. **Enable Natural Language API**
   - Go to: https://console.cloud.google.com/apis/library
   - Search: "Cloud Natural Language API"
   - Click "Enable"

3. **Create Service Account**
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
   - Click "+ CREATE SERVICE ACCOUNT"
   - Name: "google-ads-nlp"
   - Description: "NLP analysis for keyword intent"
   - Click "Create and Continue"
   - Role: "Cloud Natural Language API User"
   - Click "Done"

4. **Create JSON Key**
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Select "JSON"
   - Click "Create" - downloads `google-ads-nlp-xxxx.json`

5. **Add Credentials to Server**

   **Upload JSON file to server**:
   ```bash
   # On your local machine
   scp -P 2222 google-ads-nlp-xxxx.json root@38.97.60.181:/root/google-nlp-credentials.json
   ```

   **Add to Dokploy**:
   ```bash
   docker exec -it dokploy-postgres.1.wrcfikzf990v8i42ic66yv2lq psql -U dokploy -d dokploy

   UPDATE application
   SET env = env || E'\nGOOGLE_APPLICATION_CREDENTIALS=/root/google-nlp-credentials.json'
   WHERE "applicationId" = '8GB4bxm0DjkVeAQDoN91Y';

   \q
   ```

   **Restart**:
   ```bash
   docker service update --force google-ads-ai-wgwtgx
   ```

### Pricing:
- **Free Tier**: 5,000 text records/month
- **Paid**: $1.00 per 1,000 text records
- **Entity Analysis**: $1.00 per 1,000 records
- **Sentiment Analysis**: $1.00 per 1,000 records

**For 100 keywords/day**: ~$3/month

**Documentation**: https://cloud.google.com/natural-language/docs/

---

## 9. Moz API

**Status**: ⏸️ **Optional** (Not Configured)

**Purpose**: Keyword difficulty, domain authority, organic CTR estimates

### What It Does:
- Keyword difficulty scores (0-100)
- Organic CTR estimates
- Domain authority metrics
- SERP feature detection

### Setup Steps:

1. **Sign up for Moz Pro**
   - Visit: https://moz.com/products/pro
   - Plans start at $99/month (includes API access)

2. **Get API Credentials**
   - Login to Moz Pro
   - Go to: https://moz.com/products/api/keys
   - Click "Create API Key"
   - Copy Access ID and Secret Key

3. **Add to Environment**
   ```bash
   docker exec -it dokploy-postgres.1.wrcfikzf990v8i42ic66yv2lq psql -U dokploy -d dokploy

   UPDATE application
   SET env = env || E'\nMOZ_ACCESS_ID=your_access_id_here\nMOZ_SECRET_KEY=your_secret_key_here'
   WHERE "applicationId" = '8GB4bxm0DjkVeAQDoN91Y';

   \q
   ```

### Pricing:
- **Moz Pro**: $99/month (includes API)
- **API Rows**: 25,000 rows/month included
- **Overage**: $0.50 per 1,000 rows

**Note**: Currently optional - we're using Google Ads API for search volume data instead.

---

## Summary Checklist

### ✅ Already Configured
- [x] Google Ads API
- [x] Google OAuth 2.0
- [x] DataForSEO API
- [x] Anthropic Claude API
- [x] OpenAI API

### ⚠️ Needs Setup (Optional but Recommended)
- [ ] YouTube Data API (for content gap analysis)
- [ ] Google Natural Language API (for intent classification)
- [ ] Google Trends API (using free unofficial package - works!)
- [ ] Moz API (optional, paid alternative)

### 📊 Cost Estimate (If All APIs Enabled)

**Monthly Costs**:
- DataForSEO (100 keywords/day): **$30/month** ✅ Already paying
- Google Trends API (SerpApi): **$50/month** (or free with unofficial)
- YouTube Data API: **FREE** (within quota)
- Google NLP API: **$3/month** (100 keywords/day)
- Moz API: **$99/month** (optional)

**Total with all premium APIs**: ~$182/month
**Total with free/unofficial**: ~$30/month (current)

---

## Quick Setup Script

Run this to check which environment variables are missing:

```bash
#!/bin/bash
echo "🔍 Checking API Configuration..."
echo ""

# Check each required env var
envars=(
  "GOOGLE_ADS_DEVELOPER_TOKEN"
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
  "DATAFORSEO_LOGIN"
  "DATAFORSEO_PASSWORD"
  "ANTHROPIC_API_KEY"
  "OPENAI_API_KEY"
  "CRON_SECRET"
  "YOUTUBE_API_KEY"
  "GOOGLE_APPLICATION_CREDENTIALS"
  "MOZ_ACCESS_ID"
  "MOZ_SECRET_KEY"
)

for var in "${envars[@]}"; do
  if docker exec <container_id> printenv "$var" &>/dev/null; then
    echo "✅ $var is set"
  else
    echo "❌ $var is NOT set"
  fi
done
```

---

## Support & Documentation

- **Google Cloud Console**: https://console.cloud.google.com/
- **DataForSEO Dashboard**: https://app.dataforseo.com/
- **Anthropic Console**: https://console.anthropic.com/
- **OpenAI Platform**: https://platform.openai.com/

For issues, check application logs:
```bash
docker service logs google-ads-ai-wgwtgx --tail 100
```
