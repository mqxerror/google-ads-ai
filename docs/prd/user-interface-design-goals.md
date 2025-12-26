# User Interface Design Goals

## Overall UX Vision

A powerful, data-first interface that lets users make business decisions in 30 seconds. The primary experience is a Smart Grid — think Airtable meets Google Ads. Users see their data, spot issues via AI scores, and take action without leaving the grid.

**Design Principles:**
1. **Data-first, not dashboard-first** — users came for their data, show it immediately
2. **30-second decisions** — surface the most important info; hide complexity until needed
3. **Safety by design** — Action Queue prevents accidents; guardrails enforce best practices
4. **Simple by default, powerful when needed** — Simple Mode for SMBs, Pro Mode for agencies

## Key Interaction Paradigms

- **Smart Grid as home base:** All navigation starts and returns to the grid
- **Inline actions:** Edit budgets, pause entities without modal interruption
- **Bulk operations:** Select many, act once
- **Action Queue staging:** Write operations are staged, reviewed, then executed
- **AI as advisor:** Chat suggests, user decides and executes
- **Saved Views:** Power users create custom views; new users get pre-built views

## Core Screens and Views

1. **Smart Grid (Primary)** — Campaign/Entity grid with filters, sorts, AI scores, actions
2. **Entity Detail Panel** — Slide-out panel showing full details when row is clicked
3. **AI Chat Panel** — Collapsible side panel for natural language interaction
4. **Action Queue** — Drawer showing pending actions awaiting approval
5. **Activity Log** — Full history of changes with rollback options
6. **Account Switcher** — Dropdown in header for multi-account navigation
7. **Settings** — Connected accounts, mode preference, notifications, data export
8. **Onboarding** — OAuth flow, first account connection, guided tour

## Pre-Built Views (Default)

| View Name | Description | Filter Logic |
|-----------|-------------|--------------|
| **All Campaigns** | Default view, all campaigns | No filter |
| **Needs Attention** | Low AI Score | AI Score < 50 |
| **Wasted Spend** | High spend, low conversions | Spend > $100 AND Conversions = 0 |
| **Top Performers** | High AI Score, good metrics | AI Score > 80 |
| **Paused** | Paused campaigns | Status = Paused |
| **Search Campaigns** | Only Search type | Type = Search |
| **PMax Campaigns** | Only PMax type | Type = Performance Max |

## Accessibility

**WCAG 2.1 AA Compliance:**
- Color contrast ratios 4.5:1 minimum
- Full keyboard navigation (Tab, Enter, Arrow keys in grid)
- Screen reader support with proper ARIA labels
- Focus indicators clearly visible
- No information conveyed by color alone (icons + color)

## Target Platforms

- **Desktop-first** (primary use case for data work)
- **Tablet landscape** (functional, simplified grid)
- **Mobile** (read-only summary, basic actions)
- **Browsers:** Chrome, Firefox, Safari, Edge (latest 2 versions)
