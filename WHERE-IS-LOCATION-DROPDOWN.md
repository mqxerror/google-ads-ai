# Where to Find the Location Dropdown 📍

## Current Issue

Looking at your screenshot, the **location dropdown is hidden** because the "Enrich with Metrics" toggle is **OFF**.

## How to See It

### Step 1: Find the "Enrich with Metrics" Section

In the left sidebar, you'll see:

```
┌─────────────────────────────────┐
│ Options                         │
│ ☑ Generate variations           │
│ ☑ Generate synonyms             │
│ ☑ Suggest negatives             │
│                                 │
│ Enrich with Metrics    NEW      │  ← This section
│ ───────────────────── [OFF]     │  ← Toggle is currently OFF
│                                 │
│ Get real search volume, CPC...  │
└─────────────────────────────────┘
```

### Step 2: Toggle "Enrich with Metrics" to ON

Click the toggle switch to enable enrichment:

```
┌─────────────────────────────────┐
│ Enrich with Metrics    NEW      │
│ ───────────────────── [ON] ✅   │  ← Toggle ON
│                                 │
│ 📍 Target Location              │  ← Location dropdown appears!
│ ┌─────────────────────────────┐ │
│ │ 🇺🇸 United States          ▼│ │
│ └─────────────────────────────┘ │
│ Metrics vary by location...     │
│                                 │
│ 📊 Providers                    │
│ ☑ Google Ads Keyword Planner    │
│                                 │
│ 🎯 Max Keywords to Enrich       │
│ [50]                            │
└─────────────────────────────────┘
```

## Complete View When Enabled

When you enable "Enrich with Metrics", you'll see:

1. **📍 Target Location** dropdown
   - 🇺🇸 United States (default)
   - 🇬🇧 United Kingdom
   - 🇨🇦 Canada
   - 🇦🇺 Australia
   - 🇩🇪 Germany
   - 🇫🇷 France
   - 🇪🇸 Spain
   - 🇮🇹 Italy
   - 🇵🇹 Portugal
   - 🇧🇷 Brazil
   - 🇮🇳 India
   - 🇸🇬 Singapore
   - 🇦🇪 UAE

2. **📊 Providers** checkboxes
   - ☑ Google Ads Keyword Planner

3. **🎯 Max Keywords to Enrich** slider
   - Default: 50 keywords

4. **📊 Min Search Volume** input
   - Optional filter

## Why It Matters

Different locations = Different metrics!

Example for "portugal golden visa":
- 🇺🇸 United States: 10,000 searches/month @ $5 CPC
- 🇵🇹 Portugal: 500 searches/month @ $0.50 CPC
- 20x volume difference!

## Prerequisites

To actually USE enrichment (not just see the UI):

1. **Migration 005 must be run** (see RUN-MIGRATION-INSTRUCTIONS.md)
2. **Supabase API keys** must be configured in .env.local
3. **Google Ads API** credentials must be set up

But you can **see the UI** without any of this - just toggle the switch ON! 🎯
