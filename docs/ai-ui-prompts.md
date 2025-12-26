# AI UI Generation Prompts

This document contains optimized prompts for AI frontend generation tools (v0.dev, Lovable, Bolt, etc.) to rapidly prototype the AI-Powered Google Ads Manager interface.

**Usage Instructions:**
1. Copy the desired prompt
2. Paste into v0.dev, Lovable, or similar tool
3. Iterate on the output
4. Export code and integrate into your Next.js project

**Important:** All AI-generated code requires human review, testing, and refinement before production use.

---

## Table of Contents

1. [Foundation & Layout Shell](#1-foundation--layout-shell)
2. [Smart Grid - Campaign View](#2-smart-grid---campaign-view)
3. [Account Switcher Dropdown](#3-account-switcher-dropdown)
4. [Action Queue Drawer](#4-action-queue-drawer)
5. [AI Chat Panel](#5-ai-chat-panel)
6. [Entity Detail Panel](#6-entity-detail-panel)
7. [AI Score Badge Component](#7-ai-score-badge-component)
8. [Mobile Card View](#8-mobile-card-view)
9. [Onboarding Flow](#9-onboarding-flow)
10. [Settings Page](#10-settings-page)
11. [Full Application Assembly](#11-full-application-assembly)

---

## 1. Foundation & Layout Shell

### v0.dev Prompt

```
Create a responsive application shell for a Google Ads management SaaS using Next.js 14 App Router and Tailwind CSS.

## High-Level Goal
Build the main layout wrapper with header, main content area, and slide-out panels that will contain a data grid application.

## Tech Stack
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Lucide icons

## Detailed Instructions

### Header (64px height, fixed top)
1. Left section:
   - Logo placeholder (32x32px icon + "AdsPilot" text in semibold)
   - Account Switcher button showing "Acme Corp ▼" with a chevron-down icon

2. Center section:
   - Navigation tabs: "Campaigns" | "Ad Groups" | "Keywords" | "Ads"
   - Active tab has blue underline and darker text
   - Tabs should be horizontally centered

3. Right section:
   - Mode toggle: segmented control with "Simple" and "Pro" options
   - Action Queue button: icon button with badge showing count "3"
   - AI Chat toggle: message-circle icon button
   - User menu: avatar circle with dropdown on click

### Main Content Area
1. Full height below header (calc(100vh - 64px))
2. Light gray background (#F9FAFB)
3. Contains a placeholder div for the Smart Grid
4. Padding: 24px on desktop, 16px on mobile

### Right Panel Slot (for Entity Detail, AI Chat)
1. Fixed position on right side
2. 400px width on desktop
3. Full screen on mobile
4. Slide-in animation from right (200ms ease-out)
5. Semi-transparent overlay behind panel on mobile
6. Close button in top-right corner

### Drawer Slot (for Action Queue)
1. Slides in from right on desktop (400px)
2. Slides up from bottom on mobile (80% height)
3. Has a drag handle on mobile for swipe-to-close

## Visual Style
- Background: #F9FAFB (neutral-50)
- Header background: white with subtle bottom border (#E5E7EB)
- Primary blue: #2563EB
- Font: Inter (system fallback: -apple-system, sans-serif)
- Shadows: subtle (shadow-sm for cards, shadow-lg for panels)

## Responsive Behavior
- Mobile (<768px): Hide center nav tabs, show hamburger menu instead
- Tablet (768-1024px): Compress spacing, smaller text
- Desktop (>1024px): Full layout as described

## Constraints
- Use CSS Grid or Flexbox for layout (no absolute positioning except panels)
- All interactive elements must have visible focus states
- Include dark mode support via Tailwind's dark: prefix (structure only, not full theme)
- Export as a single layout.tsx component

## Code Example for Panel Animation
```css
.panel-enter {
  transform: translateX(100%);
}
.panel-enter-active {
  transform: translateX(0);
  transition: transform 200ms ease-out;
}
```

Generate the complete layout component with TypeScript types and proper accessibility attributes.
```

---

## 2. Smart Grid - Campaign View

### v0.dev Prompt

```
Create an Airtable-style data grid component for displaying Google Ads campaigns using React, TypeScript, and Tailwind CSS.

## High-Level Goal
Build a fully-featured data grid that displays campaign data with sorting, filtering, row selection, and inline actions. This is the primary interface users will interact with.

## Tech Stack
- React 18+ with TypeScript
- Tailwind CSS
- @tanstack/react-table for grid logic
- Lucide icons

## Detailed Instructions

### Grid Toolbar (above the grid)
1. View Tabs Row:
   - Horizontal tabs: "All" | "Needs Attention" | "Wasted Spend" | "Top Performers" | "+ Create View"
   - Active tab has blue background with white text
   - Inactive tabs have gray text, hover shows light gray background
   - "+ Create View" is a ghost button style

2. Filter Row:
   - Filter button with funnel icon, shows active filter count as badge
   - Date range dropdown: "Last 7 Days" | "Last 30 Days" | "Last 90 Days" | "Custom"
   - Refresh button with refresh-cw icon
   - "Updated 2 min ago" timestamp text (muted)
   - Search input on the right (optional, for Pro mode)

### Grid Header Row
Columns (left to right):
1. Checkbox (32px) - for bulk selection, header has "select all" checkbox
2. Campaign Name (flex-1, min 200px) - sortable
3. Status (100px) - sortable
4. Type (100px) - sortable, filterable
5. Spend (100px) - sortable, right-aligned, monospace font
6. Conversions (100px) - sortable, right-aligned
7. CPA (100px) - sortable, right-aligned, monospace
8. AI Score (120px) - sortable, center-aligned
9. Actions (80px) - not sortable, center-aligned

Header cells:
- Click to sort (shows arrow-up or arrow-down icon)
- Shift+click for multi-column sort
- Hover shows subtle background

### Grid Data Rows
Each row displays:
1. Checkbox - unchecked by default
2. Campaign Name - primary text, truncate with ellipsis if too long
3. Status - colored dot + text:
   - Green dot (#10B981) + "Active"
   - Gray dot (#6B7280) + "Paused"
   - Yellow dot (#F59E0B) + "Limited"
4. Type - badge style:
   - Search: blue badge
   - PMax: purple badge
   - Shopping: green badge
   - Display: orange badge
   - Video: red badge
5. Spend - format as currency "$1,234.56"
6. Conversions - format as number with commas "1,234"
7. CPA - format as currency "$27.50"
8. AI Score - colored badge:
   - 70-100: green background, white text
   - 40-69: yellow background, dark text
   - 0-39: red background, white text
   - Show number inside badge
9. Actions:
   - If AI Score < 70: Show "Fix" button (primary small)
   - Else: Show "..." menu button (ghost)

Row states:
- Default: white background
- Hover: light gray background (#F9FAFB)
- Selected: light blue background (#EFF6FF) with blue left border
- Expanded: show recommendation details below (optional)

### Grid Footer
1. Left: Bulk Actions dropdown (disabled when no selection)
   - Options: "Pause Selected", "Enable Selected", "Add to Queue"
2. Center: "Selected: 0 of 47 campaigns"
3. Right: Pagination or "Load More" button

### Sample Data
```typescript
const campaigns = [
  { id: 1, name: "Brand Keywords", status: "active", type: "search", spend: 1234.56, conversions: 45, cpa: 27.43, aiScore: 92 },
  { id: 2, name: "Competitor Terms", status: "active", type: "search", spend: 2100.00, conversions: 12, cpa: 175.00, aiScore: 34 },
  { id: 3, name: "PMax - All Products", status: "active", type: "pmax", spend: 5600.00, conversions: 89, cpa: 62.92, aiScore: 78 },
  { id: 4, name: "Shopping Feed", status: "active", type: "shopping", spend: 3200.00, conversions: 67, cpa: 47.76, aiScore: 85 },
  { id: 5, name: "Display Retargeting", status: "paused", type: "display", spend: 0, conversions: 0, cpa: 0, aiScore: null },
];
```

## Visual Style
- Grid lines: subtle (#E5E7EB), horizontal only
- Row height: 52px
- Header height: 44px with sticky positioning
- Font sizes: Header 13px semibold, Body 14px regular, Numbers 13px medium monospace
- Zebra striping: optional (every other row #FAFAFA)

## Responsive Behavior
- Desktop (>1024px): Full grid as described
- Tablet (768-1024px): Hide some columns (Type, Conversions), make others narrower
- Mobile (<768px): Switch to Card View (separate component)

## Accessibility
- Grid uses role="grid" with proper row/cell roles
- Sortable columns have aria-sort attribute
- Checkboxes have proper labels
- Focus trap within grid for keyboard navigation

## Constraints
- Use @tanstack/react-table for all sorting/filtering/selection logic
- Do NOT use any CSS framework besides Tailwind
- Export as reusable component with typed props
- Include loading skeleton state
- Include empty state ("No campaigns found")

Generate the complete CampaignGrid component with all subcomponents, TypeScript types, and sample data.
```

---

## 3. Account Switcher Dropdown

### v0.dev Prompt

```
Create an Account Switcher dropdown component for a multi-account Google Ads management app.

## High-Level Goal
Build a dropdown that allows users to switch between connected Google Ads accounts, showing account health and spend at a glance.

## Tech Stack
- React + TypeScript
- Tailwind CSS
- shadcn/ui Dropdown Menu
- Lucide icons

## Detailed Instructions

### Trigger Button
1. Shows current account name (truncate at 20 chars)
2. Chevron-down icon on right
3. Small health indicator dot before the name
4. On hover: subtle background change
5. Width: auto (based on content), min 160px, max 240px

### Dropdown Panel
1. Width: 320px
2. Max height: 400px with overflow scroll
3. Border radius: 8px
4. Shadow: shadow-lg
5. Background: white

### Dropdown Content

#### Search Input (top, sticky)
- Placeholder: "Search accounts..."
- Search icon on left
- Only show if user has 5+ accounts
- Filter accounts as user types

#### Account List
Each account item shows:
1. Health dot (left):
   - Green (#10B981) if avg AI Score > 70
   - Yellow (#F59E0B) if 40-70
   - Red (#EF4444) if < 40
   - Gray (#9CA3AF) if disconnected/error
2. Account info (center):
   - Account name (primary text, semibold)
   - Account ID in format "123-456-7890" (secondary text, muted)
   - Monthly spend: "$12,134 this month" (tertiary text, small)
3. Checkmark (right): only on currently selected account
4. Warning icon: if account needs reconnection

Account item states:
- Default: white background
- Hover: gray-50 background
- Selected/Current: blue-50 background with checkmark
- Disconnected: opacity-60 with warning badge

#### Divider

#### Add Account Button (bottom, sticky)
- "+ Add Another Account" with plus icon
- Ghost button style, full width
- On click: triggers OAuth flow

### Sample Data
```typescript
const accounts = [
  { id: "123-456-7890", name: "Acme Corporation", spend: 12134, aiScore: 92, status: "connected" },
  { id: "234-567-8901", name: "Beta LLC", spend: 5200, aiScore: 68, status: "connected" },
  { id: "345-678-9012", name: "Gamma Industries", spend: 8900, aiScore: 34, status: "connected" },
  { id: "456-789-0123", name: "Delta Company", spend: 0, aiScore: null, status: "disconnected" },
];
```

## Visual Style
- Use Inter font
- Primary text: #111827
- Secondary text: #6B7280
- Divider: #E5E7EB
- Hover background: #F9FAFB

## Keyboard Navigation
- Arrow keys to navigate items
- Enter to select
- Escape to close
- Type to search (focus search input)

## Constraints
- Use shadcn/ui DropdownMenu as base
- Component must be controlled (selectedAccountId prop)
- Export onAccountChange callback
- Include loading state for when accounts are fetching

Generate the complete AccountSwitcher component with TypeScript types.
```

---

## 4. Action Queue Drawer

### v0.dev Prompt

```
Create an Action Queue drawer component that displays pending Google Ads actions awaiting user approval.

## High-Level Goal
Build a slide-out drawer that shows all staged actions with risk levels, allowing users to review, approve, edit, or remove actions before execution.

## Tech Stack
- React + TypeScript
- Tailwind CSS
- Framer Motion for animations
- Lucide icons

## Detailed Instructions

### Drawer Container
1. Slides in from right on desktop (400px width)
2. Slides up from bottom on mobile (85vh height)
3. Has overlay behind it (black at 20% opacity)
4. Click overlay to close
5. Animation: 200ms ease-out

### Drawer Header
1. Title: "Action Queue" with list-checks icon
2. Badge showing count "(5 pending)"
3. Close button (X icon) on right
4. Sticky at top

### Warning Banner (conditional)
- Only shows if high-risk actions exist
- Yellow/amber background
- Warning icon + text: "2 high-risk actions require your attention"
- Dismissible (X button)

### Actions List (scrollable)
Group actions by risk level with section headers:

#### High Risk Section (red)
Header: "🔴 HIGH RISK" with red background badge

Action Card:
```
┌─────────────────────────────────────┐
│ Pause Campaign                      │
│ Campaign: Competitor Terms          │
│ ─────────────────────────────────── │
│ Current: Active → Paused            │
│ ─────────────────────────────────── │
│ ⚠️ Impact: Stops $70/day spend       │
│ ─────────────────────────────────── │
│ [Approve] [Remove]                  │
└─────────────────────────────────────┘
```

#### Medium Risk Section (yellow)
Header: "🟡 MEDIUM RISK"

Action Card:
```
┌─────────────────────────────────────┐
│ Adjust Budget                       │
│ Campaign: Brand Keywords            │
│ ─────────────────────────────────── │
│ Current: $50/day → $75/day (+50%)   │
│ ─────────────────────────────────── │
│ [Approve] [Edit] [Remove]           │
└─────────────────────────────────────┘
```

#### Low Risk Section (green)
Header: "🟢 LOW RISK"

Action Card:
```
┌─────────────────────────────────────┐
│ Add Negative Keyword                │
│ To: Brand Keywords (Campaign)       │
│ ─────────────────────────────────── │
│ Keyword: "free stuff"               │
│ Match Type: Phrase                  │
│ ─────────────────────────────────── │
│ [Approve] [Remove]                  │
└─────────────────────────────────────┘
```

### Action Card States
- Default: white background, subtle border
- Approved: green-50 background, green left border, checkmark badge
- Editing: shows inline form
- Removing: fade out animation

### Drawer Footer (sticky)
1. Left: "Clear All" secondary/ghost button
2. Right: "Execute (N) Actions" primary button
   - Disabled if no approved actions
   - Shows spinner when executing
3. Below button: "3 approved, 2 pending review" helper text

### Execution State
When "Execute" is clicked:
1. Button shows spinner and "Executing..."
2. Each action card shows progress state
3. Success: green checkmark, card fades out
4. Failure: red X, "Retry" button appears
5. After all complete: show summary toast

### Sample Data
```typescript
const pendingActions = [
  {
    id: 1,
    type: "pause_campaign",
    risk: "high",
    entity: { type: "campaign", name: "Competitor Terms", id: "123" },
    currentValue: "active",
    newValue: "paused",
    impact: "Stops $70/day spend",
    approved: false
  },
  {
    id: 2,
    type: "adjust_budget",
    risk: "medium",
    entity: { type: "campaign", name: "Brand Keywords", id: "456" },
    currentValue: "$50/day",
    newValue: "$75/day",
    changePercent: 50,
    approved: false
  },
  {
    id: 3,
    type: "add_negative",
    risk: "low",
    entity: { type: "campaign", name: "Brand Keywords", id: "456" },
    keyword: "free stuff",
    matchType: "phrase",
    approved: true
  }
];
```

## Visual Style
- Card shadows: shadow-sm
- Risk colors: High=#FEE2E2 bg, Medium=#FEF3C7 bg, Low=#D1FAE5 bg
- Approved state: green-50 bg with green-500 left border
- Buttons: Use shadcn/ui Button variants

## Responsive Behavior
- Desktop: 400px drawer from right
- Mobile: Full-width drawer from bottom with drag handle

## Constraints
- Use Framer Motion for slide animations
- Include haptic feedback trigger points (for mobile)
- Export component with open/onClose props
- Include empty state: "No pending actions"

Generate the complete ActionQueueDrawer component.
```

---

## 5. AI Chat Panel

### v0.dev Prompt

```
Create a collapsible AI Chat panel for a Google Ads management app that provides contextual insights and actionable recommendations.

## High-Level Goal
Build a chat interface where users can ask questions about their Google Ads data and receive AI-powered responses with embedded action buttons.

## Tech Stack
- React + TypeScript
- Tailwind CSS
- Framer Motion for animations
- Lucide icons

## Detailed Instructions

### Panel Container
1. Fixed position on right side of screen
2. Width: 380px on desktop, full screen on mobile
3. Height: 100vh - header height (calc(100vh - 64px))
4. Slides in from right (200ms ease-out)
5. Z-index above main content, below modals

### Panel Header
1. Left: "AI Assistant" text with sparkles icon
2. Right: "Clear" text button, Close (X) button
3. Bottom border separator
4. Height: 56px

### Context Indicator (below header)
1. Light blue background bar
2. Icon: bar-chart-2
3. Text: "Using data from: Acme Corp"
4. Subtext: "Last updated: 2 min ago"
5. Optional: "Refresh" link

### Chat Messages Area (scrollable)
Message types:

#### User Message (right-aligned)
```
┌─────────────────────────────────────┐
│                    What's wasting   │
│                    money in my      │
│                    account?     👤  │
└─────────────────────────────────────┘
```
- Blue background (#2563EB)
- White text
- Rounded corners (more rounded on right)
- Max width: 85%
- Timestamp below (optional, muted)

#### AI Message (left-aligned)
```
┌─────────────────────────────────────┐
│ 🤖  I found 3 areas of concern:    │
│                                     │
│ **1. Competitor Terms Campaign**    │
│ Spent $2,100 with only 12           │
│ conversions. Your CPA of $175 is    │
│ 4x higher than your account         │
│ average of $45.                     │
│                                     │
│ [Pause Campaign]                    │
│                                     │
│ **2. Search term: "free stuff"**    │
│ 234 clicks, 0 conversions, $89      │
│ wasted.                             │
│                                     │
│ [Add as Negative Keyword]           │
│                                     │
│ **3. Mobile Performance**           │
│ Your mobile CPA is 2x desktop.      │
│ Consider reducing mobile bids.      │
│                                     │
│ [View Device Report]                │
└─────────────────────────────────────┘
```
- Light gray background (#F3F4F6)
- Dark text
- Rounded corners (more rounded on left)
- Supports markdown formatting (bold, lists, code)
- Embedded action buttons (outlined style)
- Max width: 85%

#### System Message (centered)
```
        ── Chat cleared ──
```
- Muted text, centered
- No background
- Small font

#### Typing Indicator
```
┌─────────────────────────────────────┐
│ 🤖  ● ● ●                          │
└─────────────────────────────────────┘
```
- Three dots with bounce animation
- Same style as AI message

### Action Buttons in Messages
- Outlined button style
- Small size
- On click: add to Action Queue
- After click: change to "Added ✓" disabled state
- Multiple buttons stack vertically

### Input Area (bottom, sticky)
1. Text input with placeholder "Ask about your account..."
2. Send button (arrow-up icon) on right
3. Send button disabled when input empty
4. Input grows vertically with multiline (max 4 lines)
5. "Stop" button appears during AI generation (replaces Send)

### States
1. Empty state: "Ask me anything about your Google Ads performance"
2. Loading/Generating: Typing indicator + "Stop" button
3. Error: Red error message with "Retry" button
4. Offline: "You're offline" banner

### Sample Conversation
```typescript
const messages = [
  { role: "user", content: "What's wasting money in my account?" },
  {
    role: "assistant",
    content: "I found 3 areas of concern:\n\n**1. Competitor Terms Campaign**\nSpent $2,100 with only 12 conversions...",
    actions: [
      { label: "Pause Campaign", action: "pause_campaign", entityId: "123" },
      { label: "Add as Negative Keyword", action: "add_negative", keyword: "free stuff" }
    ]
  }
];
```

## Visual Style
- Panel background: white
- User messages: #2563EB background
- AI messages: #F3F4F6 background
- Action buttons: outlined, primary color
- Input border: #E5E7EB, focus: #2563EB

## Animations
- Message appear: fade in + slide up (150ms)
- Typing dots: staggered bounce
- Panel slide: 200ms ease-out

## Keyboard Shortcuts
- Enter: Send message
- Shift+Enter: New line
- Escape: Close panel
- Cmd/Ctrl+K: Open panel (global)

## Constraints
- Support markdown rendering in AI messages
- Messages auto-scroll to bottom on new message
- Include character limit indicator (optional)
- Export with open/onClose/onSendMessage props

Generate the complete AIChatPanel component with all message types and states.
```

---

## 6. Entity Detail Panel

### v0.dev Prompt

```
Create a slide-out Entity Detail Panel for displaying comprehensive campaign/ad group information with metrics, recommendations, and actions.

## High-Level Goal
Build a contextual panel that shows full details of a selected entity without navigating away from the main grid.

## Tech Stack
- React + TypeScript
- Tailwind CSS
- Recharts for mini charts
- Lucide icons

## Detailed Instructions

### Panel Container
1. Slides in from right (400px width)
2. Full height below header
3. White background with left shadow
4. Can be "pinned" open (stays while navigating grid)

### Panel Header
1. Back arrow button (if drilled down)
2. Entity type icon (target for campaign, layers for ad group, etc.)
3. Entity name (truncate with tooltip if long)
4. Pin toggle button (pin icon)
5. Close button (X)

### Status Bar (below header)
Horizontal badges showing:
1. Status: "● Active" (green) or "○ Paused" (gray)
2. Type: "Search" (blue badge)
3. AI Score: "AI: 92" with appropriate color

### Quick Actions Row
1. Primary action: "Pause" or "Enable" toggle button
2. Secondary action: "Edit Budget: $50/day" - shows current value, click to edit
3. More menu: "..." with additional options

### Metrics Summary Grid
2x3 grid of metric cards:
```
┌─────────┬─────────┬─────────┐
│ Spend   │ Conv    │ CPA     │
│ $1,234  │ 45      │ $27     │
│ ▲ 12%   │ ▲ 8%    │ ▼ 3%    │
├─────────┼─────────┼─────────┤
│ Clicks  │ CTR     │ Impr    │
│ 2,341   │ 3.2%    │ 73,156  │
│ ▲ 5%    │ ▼ 0.2%  │ ▲ 15%   │
└─────────┴─────────┴─────────┘
```
- Each card shows: Label, Value, Change indicator
- Green up arrow for positive changes (lower CPA is positive)
- Red down arrow for negative changes
- Comparing to previous period (30 days)

### AI Recommendations Section
Header: "AI Recommendations" with lightbulb icon

Recommendation Cards (stack vertically):
```
┌─────────────────────────────────────┐
│ 🟡 Consider adding negative keywords│
│                                     │
│ Search term "free stuff" has 234    │
│ clicks with 0 conversions.          │
│                                     │
│ Estimated savings: $120/month       │
│                                     │
│ [Add Negatives]  [Dismiss]          │
└─────────────────────────────────────┘
```

Recommendation severity colors:
- Critical (red border): Immediate action needed
- Warning (yellow border): Should address soon
- Info (blue border): Opportunity/suggestion
- Success (green border): Positive observation

### Performance Chart
1. Toggle: [7D] [30D] [90D]
2. Line chart showing primary metric over time
3. Dual Y-axis: Spend (left), Conversions (right)
4. Interactive: hover to see values
5. Height: 200px

### Children Section (collapsible)
Header: "Ad Groups (5)" with expand/collapse chevron

List items:
```
• Exact Match Keywords    45 kw  →
• Phrase Match           28 kw  →
• Broad Match Modified   12 kw  →
```
- Click to navigate/drill down
- Show count of grandchildren
- Arrow indicates drillable

### Activity Section (collapsible)
Header: "Recent Activity" with clock icon

Activity items:
```
• Budget changed $50 → $75    2 days ago
• Keyword paused: "cheap"     5 days ago
• Created by John Smith       30 days ago
```

## Visual Style
- Sections separated by light gray dividers
- Card backgrounds: #F9FAFB
- Metric values: semibold, larger font
- Change indicators: small badges

## Responsive
- Desktop: 400px panel alongside grid
- Mobile: Full screen overlay

## Constraints
- Use Recharts for the performance chart
- All actions go through Action Queue
- Export with entityType, entityId, onClose props
- Include loading skeleton state

Generate the complete EntityDetailPanel component.
```

---

## 7. AI Score Badge Component

### v0.dev Prompt

```
Create a reusable AI Score Badge component that displays an entity's health score with expandable details.

## High-Level Goal
Build a compact badge that shows a 0-100 score with color coding, and expands on click to show score breakdown and recommendations.

## Tech Stack
- React + TypeScript
- Tailwind CSS
- Framer Motion for expand animation
- Lucide icons

## Detailed Instructions

### Compact State (default)
```
┌──────────┐
│ 78 🟡    │
└──────────┘
```
1. Shows numeric score (0-100)
2. Background color based on score:
   - 70-100: Green (#10B981 bg, white text)
   - 40-69: Yellow (#F59E0B bg, dark text)
   - 0-39: Red (#EF4444 bg, white text)
   - null: Gray (#9CA3AF bg, white text) with "—"
3. Pill shape, height 24px
4. Cursor pointer on hover
5. Subtle scale animation on hover (1.05)

### Hover Tooltip
Quick preview showing top issue:
```
┌─────────────────────────────┐
│ High CPA on mobile traffic  │
│ Click for details           │
└─────────────────────────────┘
```

### Expanded State (on click)
Expands inline or as popover:
```
┌─────────────────────────────────────┐
│ AI Score: 78/100            [×]    │
├─────────────────────────────────────┤
│ Score Breakdown                     │
│                                     │
│ CTR Performance      ████████░░ 80 │
│ Conversion Rate      ███████░░░ 70 │
│ Wasted Spend         █████████░ 90 │
│ Quality Score        ██████░░░░ 60 │
├─────────────────────────────────────┤
│ Top Issues                          │
│                                     │
│ ⚠️ Mobile CPA is 2x desktop        │
│    [Adjust Bids]                    │
│                                     │
│ ⚠️ 3 keywords have QS < 5          │
│    [View Keywords]                  │
└─────────────────────────────────────┘
```

### Score Breakdown Bars
- Horizontal progress bars
- Color matches overall score logic per factor
- Show numeric value at end
- Factors vary by entity type:
  - Campaign: CTR, Conv Rate, Wasted Spend, Budget Pacing
  - Keyword: QS, CTR, Conv Rate, Position

### Top Issues List
- Show up to 3 issues
- Each has icon (warning, info, error)
- Optional action button per issue
- "See all recommendations" link at bottom

### Props Interface
```typescript
interface AIScoreBadgeProps {
  score: number | null;
  breakdown?: {
    factor: string;
    score: number;
    weight: number;
  }[];
  issues?: {
    severity: 'critical' | 'warning' | 'info';
    message: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  }[];
  size?: 'sm' | 'md' | 'lg';
  expandable?: boolean;
  onActionClick?: (action: string) => void;
}
```

## Visual Style
- Badge font: semibold
- Expanded panel: white bg, shadow-lg, rounded-lg
- Progress bars: 8px height, rounded
- Smooth expand animation (200ms)

## Constraints
- Works in both grid cell and standalone contexts
- Expanded state can be popover or inline based on prop
- Click outside closes expanded state
- Keyboard accessible (Enter to expand, Escape to close)

Generate the complete AIScoreBadge component with all states.
```

---

## 8. Mobile Card View

### v0.dev Prompt

```
Create a mobile-optimized Card View that replaces the data grid on small screens, showing campaigns as swipeable cards.

## High-Level Goal
Build a card-based interface for mobile users that maintains full functionality of the grid in a touch-friendly format.

## Tech Stack
- React + TypeScript
- Tailwind CSS
- Framer Motion for gestures
- Lucide icons

## Detailed Instructions

### View Container
1. Full width, scrollable vertically
2. Pull-to-refresh at top
3. Sticky view tabs at top
4. Floating Action Button for bulk actions (when items selected)

### View Tabs (horizontal scroll)
```
[All] [Attention] [Wasted] [Top Performers] [Paused]
```
- Horizontally scrollable
- Active tab: blue bg, white text
- Sticky below header

### Campaign Card
```
┌─────────────────────────────────────┐
│ Brand Keywords               🟢 92 │
│ Search • Active                     │
│ ─────────────────────────────────── │
│ Spend        Conv         CPA       │
│ $1,234       45           $27       │
│ ─────────────────────────────────── │
│ [Pause]              [Details →]    │
└─────────────────────────────────────┘
```

Card elements:
1. Header row: Name (bold) + AI Score badge (right)
2. Subheader: Type badge + Status text
3. Metrics row: 3 key metrics with labels
4. Action row: Primary action + Details button

### Card with Issue Callout
```
┌─────────────────────────────────────┐
│ Competitor Terms             🔴 34 │
│ Search • Active                     │
│ ─────────────────────────────────── │
│ ⚠️ High CPA: $175 (avg: $45)        │
│ ─────────────────────────────────── │
│ Spend        Conv         CPA       │
│ $2,100       12           $175      │
│ ─────────────────────────────────── │
│ [Fix: Pause]            [Details →] │
└─────────────────────────────────────┘
```
- Yellow warning banner when AI Score < 50
- "Fix" button shows recommended action

### Card Interactions

#### Tap Card
- Expands to show more details (accordion style)
- Shows additional metrics and mini recommendations

#### Swipe Left
- Reveals action buttons: [Pause] [Queue] [More]
- Red background for destructive actions

#### Swipe Right
- Quick action: Add to selection for bulk operations
- Blue background with checkmark

#### Long Press
- Enter multi-select mode
- Shows checkbox on all cards

### Expanded Card State
```
┌─────────────────────────────────────┐
│ Brand Keywords               🟢 92 │
│ Search • Active                 [▲] │
│ ─────────────────────────────────── │
│ Spend    Conv    CPA    CTR    ROAS │
│ $1,234   45      $27    3.2%   4.2x │
│ ─────────────────────────────────── │
│ AI Recommendation:                  │
│ "Consider increasing budget by 20%  │
│  to capture more converting         │
│  traffic"                           │
│ [Increase Budget]                   │
│ ─────────────────────────────────── │
│ [Pause]  [Edit Budget]  [Details →] │
└─────────────────────────────────────┘
```

### Multi-Select Mode
- Checkbox appears on each card (top-left)
- Floating bar at bottom shows count
- "Select All" option
- Bulk actions: [Pause All] [Enable All] [Cancel]

### Pull-to-Refresh
- Pull down to trigger refresh
- Shows spinner while loading
- "Updated just now" text appears

### Empty State
```
┌─────────────────────────────────────┐
│                                     │
│            📭                       │
│                                     │
│      No campaigns found             │
│                                     │
│   Try adjusting your filters or     │
│   connect a Google Ads account      │
│                                     │
│        [Clear Filters]              │
│                                     │
└─────────────────────────────────────┘
```

### Loading State
- Skeleton cards with shimmer animation
- Show 3-4 skeleton cards

## Visual Style
- Card: white bg, rounded-xl, shadow-sm
- Card spacing: 12px gap
- Card padding: 16px
- Metric labels: 11px, muted
- Metric values: 16px, semibold

## Gestures
- Swipe threshold: 80px
- Swipe velocity: 0.5
- Bounce back if not past threshold

## Constraints
- Use Framer Motion for all gestures
- Maintain parity with desktop grid functionality
- Support iOS safe areas (bottom padding)
- Export as standalone component

Generate the complete MobileCardView component.
```

---

## 9. Onboarding Flow

### v0.dev Prompt

```
Create a guided onboarding flow for first-time users connecting their Google Ads account.

## High-Level Goal
Build a multi-step onboarding experience that guides users through OAuth connection and introduces key features via a spotlight tour.

## Tech Stack
- React + TypeScript
- Tailwind CSS
- Framer Motion for transitions
- Lucide icons

## Detailed Instructions

### Step 1: Welcome Screen
```
┌─────────────────────────────────────┐
│                                     │
│          🎯 AdsPilot               │
│                                     │
│     Your AI-Powered Google Ads      │
│           Manager                   │
│                                     │
│   Get expert insights and take      │
│   action in seconds, not hours.     │
│                                     │
│     [Connect Google Ads →]          │
│                                     │
│   By connecting, you agree to our   │
│   Terms of Service and Privacy      │
│   Policy                            │
│                                     │
└─────────────────────────────────────┘
```
- Centered layout
- Animated logo entrance
- Single CTA button
- Legal links at bottom

### Step 2: OAuth Flow
1. User clicks "Connect Google Ads"
2. Show loading state: "Connecting to Google..."
3. Redirect to Google OAuth
4. On return, show: "Setting up your account..."
5. Fetch initial data in background

### Step 3: Account Selection (if multiple)
```
┌─────────────────────────────────────┐
│                                     │
│     Which account should we         │
│     start with?                     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ○ Acme Corporation          │   │
│  │   123-456-7890 • $12K/mo    │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ ○ Beta LLC                  │   │
│  │   234-567-8901 • $5K/mo     │   │
│  └─────────────────────────────┘   │
│                                     │
│   You can add more accounts later   │
│                                     │
│            [Continue →]             │
│                                     │
└─────────────────────────────────────┘
```
- Radio selection for accounts
- Show account ID and monthly spend
- Helper text about adding more later

### Step 4: Initial Analysis Loading
```
┌─────────────────────────────────────┐
│                                     │
│         Analyzing your account...   │
│                                     │
│    ████████████░░░░░░░░  60%       │
│                                     │
│    ✓ Fetching campaigns            │
│    ✓ Analyzing performance         │
│    ⟳ Calculating AI Scores         │
│    ○ Generating recommendations    │
│                                     │
│    This usually takes 30-60        │
│    seconds                          │
│                                     │
└─────────────────────────────────────┘
```
- Animated progress bar
- Checklist of steps with status icons
- Estimated time remaining

### Step 5: Results Summary
```
┌─────────────────────────────────────┐
│                                     │
│    🎉 Your account is ready!       │
│                                     │
│    Here's what we found:            │
│                                     │
│    Account Health: 72/100 🟡        │
│                                     │
│    ┌─────────────────────────────┐ │
│    │ 12 Campaigns analyzed       │ │
│    │ 3  Need attention           │ │
│    │ $450 Potential savings/mo   │ │
│    └─────────────────────────────┘ │
│                                     │
│       [Start Managing →]            │
│                                     │
│     or [Take a Quick Tour]          │
│                                     │
└─────────────────────────────────────┘
```
- Celebration animation (confetti optional)
- Key stats from initial analysis
- Two CTAs: Jump in or take tour

### Step 6: Feature Tour (Spotlight Overlay)
Series of spotlight highlights with tooltips:

**Tour Step 1: Account Switcher**
```
┌────────────────────────┐
│ Acme Corp ▼            │ ← [Spotlight]
└────────────────────────┘
        ↓
┌─────────────────────────────┐
│ Switch between accounts     │
│ instantly. Add more         │
│ accounts anytime.           │
│                             │
│ [1/5]      [Next →]         │
└─────────────────────────────┘
```

**Tour Step 2: Smart Grid**
- Highlight the grid area
- "Your campaigns at a glance. Click any row to see details."

**Tour Step 3: AI Score Column**
- Highlight AI Score column
- "AI Score shows account health. Red means action needed."

**Tour Step 4: Action Queue**
- Highlight queue badge
- "All changes go here first. Review before applying."

**Tour Step 5: AI Chat**
- Highlight chat toggle
- "Ask anything about your account. AI knows your data."

### Tour Navigation
- Progress dots: ● ● ○ ○ ○
- "Skip Tour" link
- Back/Next buttons
- Dim overlay around spotlight area

## Visual Style
- Clean, minimal design
- Lots of whitespace
- Blue primary accents
- Celebration: subtle confetti or sparkle animation

## Transitions
- Steps fade/slide between each other
- Spotlight has smooth transition between targets
- Progress bar animates smoothly

## Constraints
- Tour must work on mobile (full-screen tooltips)
- Save tour completion status to not show again
- Allow re-triggering tour from Settings
- Skip saves progress, doesn't restart

Generate the complete OnboardingFlow component with all steps.
```

---

## 10. Settings Page

### v0.dev Prompt

```
Create a Settings page for managing connected accounts, preferences, and data export.

## High-Level Goal
Build a clean settings interface with sections for account management, display preferences, and data controls.

## Tech Stack
- React + TypeScript
- Tailwind CSS
- shadcn/ui components
- Lucide icons

## Detailed Instructions

### Page Layout
1. Max width: 768px, centered
2. Header: "Settings" with gear icon
3. Sections separated by dividers
4. Save button sticky at bottom (mobile)

### Section 1: Connected Accounts
```
┌─────────────────────────────────────┐
│ Connected Accounts                  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 Acme Corporation             │ │
│ │ 123-456-7890                    │ │
│ │ Connected 30 days ago           │ │
│ │                    [Disconnect] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🟡 Beta LLC                     │ │
│ │ 234-567-8901                    │ │
│ │ Connected 14 days ago           │ │
│ │                    [Disconnect] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⚠️ Delta Company                │ │
│ │ 456-789-0123                    │ │
│ │ Connection expired              │ │
│ │                    [Reconnect]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [+ Add Another Account]             │
│                                     │
└─────────────────────────────────────┘
```

### Section 2: Display Preferences
```
┌─────────────────────────────────────┐
│ Display Preferences                 │
│                                     │
│ Default Mode                        │
│ ┌─────────────────────────────────┐ │
│ │ ○ Simple Mode                   │ │
│ │   Streamlined view for quick    │ │
│ │   decisions                     │ │
│ ├─────────────────────────────────┤ │
│ │ ● Pro Mode                      │ │
│ │   Full metrics and advanced     │ │
│ │   controls                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Default Date Range                  │
│ [Last 30 Days              ▼]       │
│                                     │
│ Compact Grid Rows                   │
│ [Toggle: OFF]                       │
│                                     │
│ Show Currency                       │
│ [USD - US Dollar           ▼]       │
│                                     │
└─────────────────────────────────────┘
```

### Section 3: Action Queue Settings
```
┌─────────────────────────────────────┐
│ Action Queue                        │
│                                     │
│ Auto-execute Low Risk Actions       │
│ [Toggle: OFF]                       │
│ Skip queue for pause/enable single  │
│ entities                            │
│                                     │
│ Require Confirmation For            │
│ ☑ Budget changes > 20%             │
│ ☑ Pausing active campaigns         │
│ ☑ Bulk actions (3+ items)          │
│                                     │
│ Guardrails                          │
│ ☑ Prevent pausing all campaigns    │
│ ☑ Warn when pausing top performers │
│                                     │
└─────────────────────────────────────┘
```

### Section 4: Notifications
```
┌─────────────────────────────────────┐
│ Notifications                       │
│                                     │
│ Email Notifications                 │
│ ☑ Weekly performance summary       │
│ ☐ Daily alerts for critical issues │
│ ☐ AI recommendation digest         │
│                                     │
│ In-App Notifications                │
│ ☑ Show toast for completed actions │
│ ☑ Alert badge for new issues       │
│                                     │
└─────────────────────────────────────┘
```

### Section 5: Data & Privacy
```
┌─────────────────────────────────────┐
│ Data & Privacy                      │
│                                     │
│ Export Your Data                    │
│ Download all your data including    │
│ activity history and settings       │
│ [Export as JSON]  [Export as CSV]   │
│                                     │
│ Data Retention                      │
│ Activity logs are kept for 90 days  │
│                                     │
│ Delete Account                      │
│ Permanently remove your account     │
│ and all associated data             │
│ [Delete Account]  ← danger button   │
│                                     │
└─────────────────────────────────────┘
```

### Section 6: Help & Support
```
┌─────────────────────────────────────┐
│ Help & Support                      │
│                                     │
│ [Restart Onboarding Tour]           │
│ [View Keyboard Shortcuts]           │
│ [Contact Support]                   │
│ [Documentation]                     │
│                                     │
│ Version 1.0.0                       │
│                                     │
└─────────────────────────────────────┘
```

## Interactions

### Disconnect Account
1. Click "Disconnect"
2. Confirmation modal: "Disconnect Acme Corporation? You can reconnect anytime."
3. [Cancel] [Disconnect]
4. On confirm: Account removed from list, toast notification

### Delete Account
1. Click "Delete Account"
2. Scary modal with red styling
3. Type account email to confirm
4. [Cancel] [Permanently Delete]

## Visual Style
- Section headers: semibold, muted color
- Cards: white bg, subtle border
- Toggles: shadcn/ui Switch
- Danger buttons: red outline or red bg

## Responsive
- Full width on mobile
- Centered container on desktop
- Bottom sticky save button on mobile

## Constraints
- Use shadcn/ui form components
- Include form validation
- Auto-save toggles (no submit button needed)
- Show save confirmation toast

Generate the complete SettingsPage component.
```

---

## 11. Full Application Assembly

### v0.dev Prompt (Master Prompt)

```
Create a complete Google Ads management application combining all previously defined components into a cohesive Next.js application.

## High-Level Goal
Assemble the full application with proper routing, state management, and component integration.

## Tech Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui component library
- @tanstack/react-table
- @tanstack/react-query
- Zustand for global state
- Framer Motion for animations
- Recharts for data visualization
- Lucide React for icons

## Application Structure

```
app/
├── layout.tsx          # Root layout with providers
├── page.tsx            # Redirect to /dashboard or /login
├── login/
│   └── page.tsx        # Login/OAuth page
├── onboarding/
│   └── page.tsx        # Onboarding flow
├── dashboard/
│   ├── layout.tsx      # Dashboard layout with shell
│   ├── page.tsx        # Smart Grid (campaigns)
│   ├── [campaignId]/
│   │   └── page.tsx    # Ad Groups view
│   └── settings/
│       └── page.tsx    # Settings page
components/
├── layout/
│   ├── AppShell.tsx
│   ├── Header.tsx
│   └── MobileNav.tsx
├── grid/
│   ├── SmartGrid.tsx
│   ├── GridToolbar.tsx
│   ├── GridRow.tsx
│   └── MobileCardView.tsx
├── panels/
│   ├── EntityDetailPanel.tsx
│   ├── AIChatPanel.tsx
│   └── ActionQueueDrawer.tsx
├── shared/
│   ├── AccountSwitcher.tsx
│   ├── AIScoreBadge.tsx
│   ├── RiskBadge.tsx
│   └── ViewTabs.tsx
└── onboarding/
    ├── OnboardingFlow.tsx
    └── SpotlightTour.tsx
lib/
├── store.ts            # Zustand store
├── api.ts              # API client
└── utils.ts            # Helper functions
```

## Global State (Zustand)

```typescript
interface AppState {
  // Current context
  currentAccountId: string | null;
  setCurrentAccount: (id: string) => void;

  // UI state
  mode: 'simple' | 'pro';
  toggleMode: () => void;

  // Panels
  detailPanelOpen: boolean;
  detailPanelEntity: Entity | null;
  openDetailPanel: (entity: Entity) => void;
  closeDetailPanel: () => void;

  chatPanelOpen: boolean;
  toggleChatPanel: () => void;

  actionQueueOpen: boolean;
  toggleActionQueue: () => void;

  // Action Queue
  pendingActions: Action[];
  addAction: (action: Action) => void;
  removeAction: (id: string) => void;
  approveAction: (id: string) => void;
  clearActions: () => void;
}
```

## Data Fetching (React Query)

```typescript
// Campaigns
const { data: campaigns } = useQuery({
  queryKey: ['campaigns', accountId],
  queryFn: () => fetchCampaigns(accountId),
});

// AI Recommendations
const { data: recommendations } = useQuery({
  queryKey: ['recommendations', entityId],
  queryFn: () => fetchRecommendations(entityId),
});
```

## Key Integration Points

### 1. Account Switching
- AccountSwitcher updates Zustand store
- All queries invalidate and refetch
- Grid resets to default view
- Panels close

### 2. Action Queue Flow
- Grid actions → addAction to store
- ActionQueueDrawer reads from store
- Execute → API call → remove from store → invalidate queries

### 3. AI Chat Integration
- Chat sends message with account context
- Response may include action suggestions
- Action buttons call addAction
- Success callback shows toast

### 4. Panel Coordination
- Only one panel open at a time (detail OR chat)
- Action queue is a drawer (can coexist)
- Mobile: panels are full-screen modals

## Routing

```typescript
// Middleware for auth
export function middleware(request: NextRequest) {
  const session = getSession(request);
  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

## API Routes

```
app/api/
├── auth/
│   └── [...nextauth]/route.ts
├── accounts/
│   └── route.ts
├── campaigns/
│   └── route.ts
├── actions/
│   └── execute/route.ts
└── chat/
    └── route.ts  # Streaming AI responses
```

## Responsive Breakpoints

```typescript
const breakpoints = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
  wide: '(min-width: 1440px)',
};
```

## Component Integration Example

```tsx
// dashboard/page.tsx
export default function DashboardPage() {
  const { mode, currentAccountId } = useAppStore();
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div className="flex flex-col h-full">
      <GridToolbar />
      {isMobile ? (
        <MobileCardView accountId={currentAccountId} />
      ) : (
        <SmartGrid accountId={currentAccountId} mode={mode} />
      )}
      <EntityDetailPanel />
      <AIChatPanel />
      <ActionQueueDrawer />
    </div>
  );
}
```

## Accessibility Requirements
- All components keyboard navigable
- ARIA labels on interactive elements
- Focus management when panels open/close
- Reduced motion support

## Performance Requirements
- Virtual scrolling for grid (1000+ rows)
- Lazy load panels
- Skeleton loading states
- Optimistic updates for actions

Generate the complete application structure with all components properly integrated.
```

---

## Usage Tips

### For v0.dev
1. Start with individual components (prompts 2-10)
2. Iterate and refine each component
3. Export code and integrate manually
4. Use prompt 11 as a reference for assembly

### For Lovable
1. Use prompts as feature descriptions
2. Build incrementally, screen by screen
3. Lovable handles routing automatically
4. Focus on component behavior in prompts

### For Bolt
1. Combine prompts for related features
2. Specify file structure explicitly
3. Include TypeScript types in prompts
4. Request tests alongside components

---

## Important Reminders

1. **AI-generated code requires review** — Always test thoroughly before production
2. **Iterate incrementally** — Don't expect perfection on first generation
3. **Maintain design consistency** — Use these prompts as a system, not individually
4. **Accessibility matters** — Verify keyboard navigation and screen reader support
5. **Performance testing** — Virtual scrolling and lazy loading need real data testing

---

*Generated by BMad Method - UX Expert Agent (Sally)*
