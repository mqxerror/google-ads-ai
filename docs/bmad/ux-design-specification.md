---
stepsCompleted: [1, 2]
inputDocuments:
  - codebase-analysis
  - team-party-mode
workflowType: 'ux-design'
lastStep: 2
project_name: 'Google Ads AI'
user_name: 'User'
date: '2026-01-05'
---

# UX Design Specification Google Ads AI

**Author:** User
**Date:** 2026-01-05

---

## Current App Analysis (Codebase Review)

### App Overview
**Quick Ads AI** - A Google Ads management platform with AI-powered features for campaign optimization, analysis, and creation.

### Current Screens & Features

| Screen | Route | Purpose |
|--------|-------|---------|
| **Dashboard** | `/` | Main hub - KPI cards, monthly chart, campaign table, AI chat sidebar |
| **Insight Hub** | `/command` | Dedicated AI chat interface with account selector |
| **Spend Shield** | `/spend-shield` | Search term analysis, waste detection, negative keyword suggestions |
| **Campaign Create** | `/campaigns/create` | Multi-step wizard for Search, PMax, Display, Video, Demand Gen |
| **Keyword Factory** | `/keyword-factory` | Keyword generation tool |
| **Keyword Lists** | `/lists` | Organize and cluster keywords |
| **SERP Intelligence** | `/serp-intelligence` | Search position tracking |
| **Intelligence Center** | `/intelligence` | Brand & audience research |
| **Ad Preview Center** | `/ad-preview-center` | Multi-format ad previews |
| **Landing Analyzer** | `/landing-analyzer` | Page speed & relevance check |
| **Settings** | `/settings/api-keys` | API key configuration |

### Current UI Architecture

**Header:**
- Logo (Quick Ads)
- Navigation pills (Dashboard, Campaigns, Insights, Settings)
- Tools dropdown (9 tools)
- Account switcher dropdown
- Demo/Sync status
- User avatar

**Dashboard Layout:**
- Left column (2/3): KPI cards → Monthly chart → Campaign table
- Right column (1/3): AI Chat sidebar

**Design System:**
- Dark theme with CSS variables (bg, surface, surface2, divider, text, text2, text3, accent)
- Rounded corners (xl, full for pills)
- Card-based layout
- Gradient accents

### Key Components (50+ components)
- Campaign Wizard (5-step)
- Ad Editor with AI generation
- Multiple ad preview formats (Search, Display, YouTube, Gmail)
- Insight Hub chat panel
- What-If Drawer
- Negative Keywords Panel
- Various shared inputs (Budget, Bidding, Location, Headlines, etc.)

### Current Pain Points Identified

1. **Monolithic Dashboard** - `page.tsx` is 1,385 lines with 20+ useState hooks
2. **No Data Caching** - Always refreshes, feels slow
3. **Tools Hidden** - 9 tools buried in dropdown
4. **No Inline Editing** - Must use modals for changes
5. **Campaign Table Limited** - No bulk actions, no budget editing
6. **AI Chat Duplicated** - In dashboard sidebar AND Insight Hub

---

## Executive Summary

### Project Vision
Quick Ads AI aims to be the fastest way for SMB owners and marketing managers to optimize Google Ads campaigns through AI-powered insights and streamlined workflows. The core promise: **"Stop wasting money on bad ads in 30 seconds."**

### Target Users (Focused Scope)

| User | Profile | Key Need |
|------|---------|----------|
| **SMB Owner** | Runs a business, manages $5-20K/month ads, non-expert | "Stop wasting my money" |
| **Marketing Manager** | Handles multiple channels, $10-50K/month, semi-expert | "Give me quick wins, I'm busy" |

*Note: Agency/multi-client features deferred to future phase.*

### Key Design Challenges

1. **Cognitive load** - Users aren't PPC experts, need simple red/green indicators
2. **Time constraints** - Marketing managers need 30-second check-ins, not deep analysis
3. **Perceived performance** - App feels slow due to no caching, heavy page
4. **Action friction** - Too many clicks to do common tasks (pause, edit budget)

### Design Opportunities

1. **"30-second decisions"** - Scannable dashboard with instant actions
2. **AI-first actions** - "Pause Wasters" as the #1 prominent button
3. **Inline everything** - Edit budgets, status directly in table
4. **Smart caching** - Feel instant, stay fresh (5-min cache)

---

## Waster Definition

### What is a "Waster"?
A campaign that is **spending money but not making money back**.

### Technical Definition
```
Waster = AI Score < 40 AND Status = ENABLED
```

### AI Score Calculation

| Factor | Weight | What it measures |
|--------|--------|------------------|
| CTR | 20% | Are people clicking? (< 1% is bad) |
| Conversion Rate | 30% | Are clicks converting? |
| CPA | 25% | Cost per conversion (vs industry avg) |
| ROAS | 25% | Return on ad spend |

### Visual Indicators

| AI Score | Badge | Meaning |
|----------|-------|---------|
| 0-39 | 🔴 Red | **Waster** - Pause or fix immediately |
| 40-69 | 🟡 Yellow | **Needs attention** - Review soon |
| 70-100 | 🟢 Green | **Healthy** - Performing well |

---

## Priority Matrix (Team Consensus)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| **P0** | Pause Wasters button (prominent) | #1 user anxiety = wasted spend |
| **P0** | Data caching (5-min) | App feels slow without it |
| **P0** | Inline budget editing | Most common action |
| **P1** | Remove sidebar AI chat | Clutter, use Insight Hub link |
| **P1** | Quick actions bar | Surface top 3 tools |
| **P1** | Skeleton loaders | Perceived performance |
| **P2** | Keyboard shortcuts | Nice-to-have |
| **P2** | Budget overspend alerts | Proactive help |

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->
