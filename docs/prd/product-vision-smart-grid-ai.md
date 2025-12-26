# Product Vision: Smart Grid + AI

## Core UI Philosophy

**Primary Surface: Airtable-Style Smart Grid**

The main interface is NOT a dashboard with charts and cards. It's a powerful, filterable data grid where:

- **Rows = Entities** (Campaigns, Ad Groups, Keywords, Ads, Search Terms)
- **Columns = Metrics + Actions** (Spend, Clicks, Conv, CTR, CPA, Status, AI Score, Quick Actions)
- **Views = Saved Filters** (e.g., "Wasted Spend", "Top Performers", "Needs Attention")
- **Bulk Actions** = Select multiple rows, apply action to all

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Account Switcher ▼]  [Campaigns ▼]  [Date: Last 30 Days ▼]  [+ New View]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Views: [All] [Wasted Spend] [Top Performers] [Paused] [+ Create View]      │
├─────────────────────────────────────────────────────────────────────────────┤
│  □  Campaign Name       Status   Type      Spend     Conv   CPA    AI Score │
├─────────────────────────────────────────────────────────────────────────────┤
│  □  Brand Keywords      ●Active  Search    $1,234    45     $27    92 🟢    │
│  □  Competitor Terms    ●Active  Search    $2,100    12     $175   34 🔴    │
│  □  PMax - All Products ●Active  PMax      $5,600    89     $63    78 🟡    │
│  □  Shopping Feed       ●Active  Shopping  $3,200    67     $48    85 🟢    │
│  □  Display Retarget    ○Paused  Display   $0        0      -      -        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Bulk Actions ▼]  Selected: 0  │  Total Spend: $12,134  │  Total Conv: 213 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Secondary Surface: AI Chat Panel**

A collapsible side panel for:
- Complex questions ("Why is my CPA up 40% this week?")
- Multi-step analysis ("Compare my Search vs PMax performance")
- Strategic recommendations ("What should I focus on this month?")

The chat can SUGGEST actions that populate the Action Queue, but the user executes from the grid.

## Multi-Account Architecture (Day 1)

Users can connect multiple Google Ads accounts and switch between them instantly:

- **Account Switcher** in header — dropdown with all connected accounts
- **Cross-Account Views** — see aggregated data across all accounts (Phase 1.5)
- **Account Health Summary** — quick status for each account in sidebar
- **MCC Support** — connect via Manager Account for agencies

**Why Day 1:** Many SMB owners have 2-5 accounts (different businesses, regions, brands). Forcing single-account is a dealbreaker.

## Mode Toggle: Simple Mode vs Pro Mode

**Simple Mode (Default for SMB owners):**
- Fewer columns visible (Name, Status, Spend, Conversions, AI Recommendation)
- AI Score prominently displayed with plain-English explanation
- One-click "Fix This" buttons for common issues
- Guided workflows ("Let's clean up your account")

**Pro Mode (For power users/agencies):**
- All columns visible (QS, Impression Share, Search Lost IS, etc.)
- Advanced filters and custom views
- Bulk editing capabilities
- Raw API data access
- Export to CSV/Google Sheets

Toggle in header: `[Simple Mode] / [Pro Mode]`
